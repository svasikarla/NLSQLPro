import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/security/encryption'
import { createDatabaseAdapter } from '@/lib/database/adapters/adapter-factory'
import { DatabaseType, type ConnectionConfig as AdapterConnectionConfig } from '@/lib/database/types/database'
import type { BaseDatabaseAdapter } from '@/lib/database/adapters/base-adapter'
import { ConnectionRetryService } from '@/lib/connection-manager/connection-retry'
import { checkConnectionHealth, needsHealthCheck, getHealthMonitor } from '@/lib/connection-manager/connection-health'
import { ConnectionRegistry } from '@/lib/connection-manager/connection-registry'

// Type definitions
export interface DatabaseConnection {
  id: string
  user_id: string
  name: string
  db_type: 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver'
  host: string
  port: number
  database: string
  username: string
  password: string // Legacy field (will be removed)
  password_encrypted?: string // New encrypted password field
  encrypted_at?: string
  ssl?: boolean // Whether to use SSL/TLS
  ssl_config?: any // SSL configuration (rejectUnauthorized, ca, cert, key)
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConnectionConfig {
  name: string
  db_type: 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver'
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  ssl_config?: any
}

// Connection adapter cache with TTL (in-memory)
interface CachedAdapter {
  adapter: BaseDatabaseAdapter
  createdAt: number
  lastUsedAt: number
}

const connectionAdapters = new Map<string, CachedAdapter>()
const ADAPTER_TTL = 30 * 60 * 1000 // 30 minutes
const ADAPTER_IDLE_TIMEOUT = 10 * 60 * 1000 // 10 minutes

/**
 * Get smart connection timeout based on database type and host
 * Uses new ConnectionRegistry for database-specific logic
 */
function getSmartConnectionTimeout(connection: DatabaseConnection): number {
  try {
    // Use database-specific manager for optimal timeout
    return ConnectionRegistry.getRecommendedTimeout(connection)
  } catch (error) {
    // Fallback to original logic if manager not available
    const host = connection.host.toLowerCase()

    if (host.includes('azure') || host.includes('database.windows.net')) {
      return 30000
    }
    if (host.includes('rds.amazonaws.com')) {
      return 20000
    }
    if (host.includes('cloudsql') || host.includes('gcp')) {
      return 20000
    }
    if (host.includes('supabase.co')) {
      return 15000
    }
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return 5000
    }

    return 20000
  }
}

/**
 * Convert database connection to adapter config
 */
function toAdapterConfig(connection: DatabaseConnection, password: string): AdapterConnectionConfig {
  // Map our db_type string to DatabaseType enum
  const dbTypeMap: Record<DatabaseConnection['db_type'], DatabaseType> = {
    'postgresql': DatabaseType.POSTGRESQL,
    'mysql': DatabaseType.MYSQL,
    'sqlite': DatabaseType.SQLITE,
    'sqlserver': DatabaseType.SQLSERVER,
  }

  // Get SSL config - priority order:
  // 1. Explicit SSL config from database
  // 2. Database-specific manager recommendation
  // 3. Auto-detect based on hostname
  let sslConfig

  if (connection.ssl !== undefined && connection.ssl !== null) {
    // Use explicitly configured SSL settings
    if (connection.ssl === true) {
      sslConfig = connection.ssl_config || { rejectUnauthorized: false }
    } else {
      sslConfig = false
    }
  } else {
    // Auto-detect SSL configuration
    try {
      sslConfig = ConnectionRegistry.getSSLConfig(connection)
    } catch (error) {
      // Fallback: Enable SSL with rejectUnauthorized: false for non-localhost connections
      // This handles self-signed certificates and cloud databases
      const isLocalhost = connection.host === 'localhost' ||
                         connection.host === '127.0.0.1' ||
                         connection.host.startsWith('192.168.') ||
                         connection.host.startsWith('10.') ||
                         connection.host.startsWith('172.16.')

      if (!isLocalhost) {
        // Enable SSL with self-signed cert support for remote connections
        sslConfig = { rejectUnauthorized: false }
        console.log(`[Connection] Auto-enabling SSL with self-signed cert support for ${connection.host}`)
      } else {
        sslConfig = false
      }
    }
  }

  const config: AdapterConnectionConfig = {
    id: connection.id,
    name: connection.name,
    db_type: dbTypeMap[connection.db_type],
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    password: password, // Decrypted password for actual use
    ssl: sslConfig,
    poolMin: 2,
    poolMax: 10,
    connectionTimeout: getSmartConnectionTimeout(connection), // Smart timeout based on provider
    idleTimeout: 30000,
  }

  return config
}

/**
 * Get the active database connection for a user
 */
export async function getActiveConnection(userId: string): Promise<DatabaseConnection | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching active connection:', error)
    return null
  }

  return data as DatabaseConnection
}

/**
 * Get all connections for a user
 */
export async function getUserConnections(userId: string): Promise<DatabaseConnection[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_connections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user connections:', error)
    return []
  }

  return (data as DatabaseConnection[]) || []
}

/**
 * Create a new database connection
 */
export async function createConnection(
  userId: string,
  config: ConnectionConfig
): Promise<{ success: boolean; connection?: DatabaseConnection; error?: string }> {
  const supabase = await createClient()

  // Validate connection configuration
  const validation = validateConnectionConfig(config)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Encrypt the password before storing
  let encryptedPassword: string
  try {
    encryptedPassword = encrypt(config.password)
  } catch (error) {
    console.error('Error encrypting password:', error)
    return { success: false, error: 'Failed to encrypt password' }
  }

  const { data, error } = await supabase
    .from('user_connections')
    .insert({
      user_id: userId,
      name: config.name,
      db_type: config.db_type,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password_encrypted: encryptedPassword,
      encrypted_at: new Date().toISOString(),
      ssl: config.ssl ?? false,
      ssl_config: config.ssl ? (config.ssl_config || { rejectUnauthorized: false }) : null,
      is_active: false, // New connections are not active by default
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating connection:', error)
    return { success: false, error: error.message }
  }

  return { success: true, connection: data as DatabaseConnection }
}

/**
 * Test a database connection using the appropriate adapter
 */
export async function testConnection(
  config: ConnectionConfig
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Map our db_type string to DatabaseType enum
    const dbTypeMap: Record<ConnectionConfig['db_type'], DatabaseType> = {
      'postgresql': DatabaseType.POSTGRESQL,
      'mysql': DatabaseType.MYSQL,
      'sqlite': DatabaseType.SQLITE,
      'sqlserver': DatabaseType.SQLSERVER,
    }

    // Get SSL config - priority order:
    // 1. Explicit SSL config from test request
    // 2. Database-specific manager recommendation
    // 3. Auto-detect based on hostname
    let sslConfig

    if (config.ssl !== undefined && config.ssl !== null) {
      // Use explicitly configured SSL settings
      if (config.ssl === true) {
        sslConfig = config.ssl_config || { rejectUnauthorized: false }
      } else {
        sslConfig = false
      }
    } else {
      // Auto-detect SSL configuration
      try {
        // Create temporary connection object for SSL lookup
        const tempConn: DatabaseConnection = {
          id: '',
          user_id: '',
          name: config.name,
          db_type: config.db_type,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: '',
          is_active: false,
          created_at: '',
          updated_at: '',
        }
        sslConfig = ConnectionRegistry.getSSLConfig(tempConn)
      } catch (error) {
        // Fallback: Enable SSL with rejectUnauthorized: false for non-localhost connections
        // This handles self-signed certificates and cloud databases
        const isLocalhost = config.host === 'localhost' ||
                           config.host === '127.0.0.1' ||
                           config.host.startsWith('192.168.') ||
                           config.host.startsWith('10.') ||
                           config.host.startsWith('172.16.')

        if (!isLocalhost) {
          // Enable SSL with self-signed cert support for remote connections
          sslConfig = { rejectUnauthorized: false }
          console.log(`[Connection Test] Auto-enabling SSL with self-signed cert support for ${config.host}`)
        } else {
          sslConfig = false
        }
      }
    }

    // Create adapter config
    const adapterConfig: AdapterConnectionConfig = {
      name: config.name,
      db_type: dbTypeMap[config.db_type],
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: sslConfig,
    }

    // Create adapter using factory
    const adapter = createDatabaseAdapter(adapterConfig)

    // Test connection with retry logic (2 retries for interactive testing)
    const retryConfig = ConnectionRetryService.getTestConnectionConfig()
    const retryResult = await ConnectionRetryService.withRetry(
      () => adapter.testConnection(),
      retryConfig
    )

    if (!retryResult.success || !retryResult.data?.success) {
      const error = retryResult.error || new Error(retryResult.data?.error || 'Connection test failed')
      throw error
    }

    const result = retryResult.data
    const attemptInfo = retryResult.attempts > 1
      ? ` (succeeded after ${retryResult.attempts} attempts in ${retryResult.totalTime}ms)`
      : ''

    return {
      success: true,
      message: (result.message || `Connection successful to ${config.database}`) + attemptInfo,
    }
  } catch (error) {
    console.error('Connection test failed:', error)

    // Provide detailed, actionable error messages
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let detailedMessage = errorMessage

    if (errorMessage.includes('SASL') || errorMessage.includes('SCRAM') || errorMessage.includes('authentication') || errorMessage.includes('password')) {
      detailedMessage = '❌ Authentication Failed\n\n' +
        '• Double-check your username and password\n' +
        '• Ensure the user has permission to connect\n' +
        '• For PostgreSQL: check pg_hba.conf settings\n' +
        '• For cloud databases: verify firewall rules allow your IP'
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo') || errorMessage.includes('ENOENT')) {
      detailedMessage = '❌ DNS Resolution Failed\n\n' +
        '• Hostname cannot be found: ' + config.host + '\n' +
        '• Check for typos in the hostname\n' +
        '• Verify the database server is running\n' +
        '• For cloud databases: ensure the project/instance exists\n' +
        '• Try using IP address instead of hostname\n' +
        '• Check your network/firewall settings'
    } else if (errorMessage.includes('ECONNREFUSED')) {
      detailedMessage = '❌ Connection Refused\n\n' +
        '• Port ' + config.port + ' is not accepting connections\n' +
        '• Verify the database is running\n' +
        '• Check the port number is correct\n' +
        '• For PostgreSQL: default is 5432 (or 6543 for Supabase pooler)\n' +
        '• For MySQL: default is 3306\n' +
        '• For SQL Server: default is 1433\n' +
        '• Check firewall rules'
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      detailedMessage = '❌ Connection Timeout\n\n' +
        '• Could not connect within 30 seconds\n' +
        '• Database server may be slow or overloaded\n' +
        '• Network latency may be high\n' +
        '• Firewall may be blocking the connection\n' +
        '• For cloud databases: check if instance is paused/stopped\n' +
        '• Try again in a few moments'
    } else if (errorMessage.includes('ECONNRESET')) {
      detailedMessage = '❌ Connection Reset\n\n' +
        '• Database server closed the connection\n' +
        '• This may be due to:\n' +
        '  - Too many connections (reached max_connections)\n' +
        '  - Database restart or crash\n' +
        '  - Network interruption\n' +
        '  - SSL/TLS handshake failure'
    } else if (errorMessage.includes('SQLITE') && errorMessage.includes('open')) {
      detailedMessage = '❌ SQLite File Error\n\n' +
        '• File not found: ' + config.database + '\n' +
        '• Check the file path is correct\n' +
        '• Ensure the file exists on the server\n' +
        '• Verify read/write permissions'
    } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
      detailedMessage = '❌ SSL/TLS Error\n\n' +
        '• SSL certificate verification failed\n' +
        '• For development: you may need to disable SSL verification\n' +
        '• For production: ensure valid SSL certificates are installed\n' +
        '• Check if the database requires SSL connection'
    } else if (errorMessage.includes('max_connections') || errorMessage.includes('too many')) {
      detailedMessage = '❌ Too Many Connections\n\n' +
        '• Database has reached maximum connections\n' +
        '• Close idle connections\n' +
        '• Increase max_connections setting\n' +
        '• Use connection pooling (Supabase pooler, PgBouncer, etc.)'
    }

    return {
      success: false,
      error: detailedMessage,
    }
  }
}

/**
 * Activate a connection (and deactivate others for the user)
 */
export async function activateConnection(
  userId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // The database trigger will automatically deactivate other connections
  const { error } = await supabase
    .from('user_connections')
    .update({ is_active: true })
    .eq('id', connectionId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error activating connection:', error)
    return { success: false, error: error.message }
  }

  // Clear connection adapter cache when switching connections
  const adapterKey = `${userId}:${connectionId}`
  const cached = connectionAdapters.get(adapterKey)
  if (cached) {
    await cached.adapter.closePool()
    connectionAdapters.delete(adapterKey)
    getHealthMonitor().clearHealth(connectionId)
  }

  return { success: true }
}

/**
 * Update an existing database connection
 */
export async function updateConnection(
  userId: string,
  connectionId: string,
  config: Partial<ConnectionConfig> & { name: string }
): Promise<{ success: boolean; connection?: DatabaseConnection; error?: string }> {
  const supabase = await createClient()

  // Fetch existing connection to verify ownership
  const { data: existingConnection, error: fetchError } = await supabase
    .from('user_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existingConnection) {
    return { success: false, error: 'Connection not found' }
  }

  // Build update object with only provided fields
  const updateData: any = {
    name: config.name,
    updated_at: new Date().toISOString(),
  }

  // Update connection details if provided
  if (config.host !== undefined) updateData.host = config.host
  if (config.port !== undefined) updateData.port = config.port
  if (config.database !== undefined) updateData.database = config.database
  if (config.username !== undefined) updateData.username = config.username
  if (config.db_type !== undefined) updateData.db_type = config.db_type

  // Update SSL configuration if provided
  if (config.ssl !== undefined) {
    updateData.ssl = config.ssl
    if (config.ssl_config !== undefined) {
      updateData.ssl_config = config.ssl_config
    } else if (config.ssl === true) {
      // Default SSL config for self-signed certificates
      updateData.ssl_config = { rejectUnauthorized: false }
    }
  }

  // Only update password if provided
  if (config.password && config.password.trim().length > 0) {
    try {
      updateData.password_encrypted = encrypt(config.password)
      updateData.encrypted_at = new Date().toISOString()
    } catch (error) {
      console.error('Error encrypting password:', error)
      return { success: false, error: 'Failed to encrypt password' }
    }
  }

  // Perform update
  const { data, error } = await supabase
    .from('user_connections')
    .update(updateData)
    .eq('id', connectionId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating connection:', error)
    return { success: false, error: error.message }
  }

  // Clear connection adapter cache since credentials may have changed
  const adapterKey = `${userId}:${connectionId}`
  const cached = connectionAdapters.get(adapterKey)
  if (cached) {
    await cached.adapter.closePool()
    connectionAdapters.delete(adapterKey)
    getHealthMonitor().clearHealth(connectionId)
  }

  return { success: true, connection: data as DatabaseConnection }
}

/**
 * Clear adapter cache for a specific connection
 * Forces reconnection with fresh settings (useful after SSL config changes)
 */
export async function clearAdapterCache(
  userId: string,
  connectionId?: string
): Promise<void> {
  if (connectionId) {
    // Clear specific connection
    const adapterKey = `${userId}:${connectionId}`
    const cached = connectionAdapters.get(adapterKey)
    if (cached) {
      await cached.adapter.closePool()
      connectionAdapters.delete(adapterKey)
      getHealthMonitor().clearHealth(connectionId)
      console.log(`[Cache] Cleared adapter cache for connection ${connectionId}`)
    }
  } else {
    // Clear all connections for user
    const userPrefix = `${userId}:`
    for (const [key, cached] of connectionAdapters.entries()) {
      if (key.startsWith(userPrefix)) {
        await cached.adapter.closePool()
        connectionAdapters.delete(key)
        const connId = key.split(':')[1]
        getHealthMonitor().clearHealth(connId)
      }
    }
    console.log(`[Cache] Cleared all adapter caches for user ${userId}`)
  }
}

/**
 * Delete a connection
 */
export async function deleteConnection(
  userId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Clear connection adapter cache
  const adapterKey = `${userId}:${connectionId}`
  const cached = connectionAdapters.get(adapterKey)
  if (cached) {
    await cached.adapter.closePool()
    connectionAdapters.delete(adapterKey)
    getHealthMonitor().clearHealth(connectionId)
  }

  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting connection:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get or create a database adapter for a specific connection with health checks and TTL
 */
export async function getConnectionAdapter(
  userId: string,
  connectionId: string
): Promise<BaseDatabaseAdapter | null> {
  const adapterKey = `${userId}:${connectionId}`
  const now = Date.now()

  // Check existing cached adapter
  const cached = connectionAdapters.get(adapterKey)
  if (cached && cached.adapter.isPoolConnected()) {
    const age = now - cached.createdAt
    const idle = now - cached.lastUsedAt

    // Check if adapter is expired (TTL or idle timeout)
    if (age > ADAPTER_TTL || idle > ADAPTER_IDLE_TIMEOUT) {
      console.log(`[Connection] Adapter expired (age: ${age}ms, idle: ${idle}ms), recreating...`)
      await cached.adapter.closePool()
      connectionAdapters.delete(adapterKey)
      getHealthMonitor().clearHealth(connectionId)
    } else {
      // Adapter exists and is within TTL, verify health if needed
      if (needsHealthCheck(connectionId, 60000)) {
        console.log(`[Connection] Performing health check...`)
        try {
          const health = await checkConnectionHealth(connectionId, cached.adapter)
          if (health.status === 'down') {
            console.log(`[Connection] Health check failed, recreating adapter...`)
            await cached.adapter.closePool()
            connectionAdapters.delete(adapterKey)
          } else {
            // Update last used time and return healthy adapter
            cached.lastUsedAt = now
            connectionAdapters.set(adapterKey, cached)
            return cached.adapter
          }
        } catch (error) {
          console.error('[Connection] Health check error:', error)
          await cached.adapter.closePool()
          connectionAdapters.delete(adapterKey)
        }
      } else {
        // Health check not needed, return cached adapter
        cached.lastUsedAt = now
        connectionAdapters.set(adapterKey, cached)
        return cached.adapter
      }
    }
  }

  // Fetch connection details
  const supabase = await createClient()
  const { data: connection, error } = await supabase
    .from('user_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single()

  if (error || !connection) {
    console.error('Error fetching connection for adapter:', error)
    return null
  }

  const dbConnection = connection as DatabaseConnection

  // Decrypt the password
  let password: string
  try {
    // Use encrypted password if available, fallback to legacy plain text
    if (dbConnection.password_encrypted) {
      password = decrypt(dbConnection.password_encrypted)
    } else if (dbConnection.password) {
      // Legacy plain text password (will be migrated)
      password = dbConnection.password
      console.warn('Using legacy plain text password. Please re-save this connection to encrypt it.')
    } else {
      console.error('No password found for connection')
      return null
    }
  } catch (error) {
    console.error('Error decrypting password:', error)
    return null
  }

  try {
    // Create adapter config
    const adapterConfig = toAdapterConfig(dbConnection, password)

    // Create adapter using factory
    const adapter = createDatabaseAdapter(adapterConfig)

    // Initialize connection pool with retry logic
    const retryConfig = ConnectionRetryService.getPoolCreationConfig()
    await ConnectionRetryService.withRetry(
      () => adapter.createPool(),
      retryConfig
    )

    // Store in cache with metadata
    const cachedAdapter: CachedAdapter = {
      adapter,
      createdAt: now,
      lastUsedAt: now,
    }
    connectionAdapters.set(adapterKey, cachedAdapter)

    // Perform initial health check
    await checkConnectionHealth(connectionId, adapter)

    return adapter
  } catch (error) {
    console.error('Error creating database adapter:', error)
    return null
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getConnectionAdapter instead
 */
export async function getConnectionPool(userId: string, connectionId: string): Promise<any | null> {
  console.warn('getConnectionPool is deprecated. Use getConnectionAdapter instead.')
  const adapter = await getConnectionAdapter(userId, connectionId)

  // For PostgreSQL, return the underlying pool for backward compatibility
  if (adapter && (adapter as any).pool) {
    return (adapter as any).pool
  }

  return null
}

/**
 * Validate connection configuration
 */
export function validateConnectionConfig(
  config: ConnectionConfig
): { valid: boolean; error?: string } {
  if (!config.name || config.name.trim().length === 0) {
    return { valid: false, error: 'Connection name is required' }
  }

  if (!config.db_type) {
    return { valid: false, error: 'Database type is required' }
  }

  const validTypes: ConnectionConfig['db_type'][] = ['postgresql', 'mysql', 'sqlite', 'sqlserver']
  if (!validTypes.includes(config.db_type)) {
    return { valid: false, error: 'Invalid database type' }
  }

  // SQLite has different requirements
  if (config.db_type === 'sqlite') {
    if (!config.database || config.database.trim().length === 0) {
      return { valid: false, error: 'Database file path is required for SQLite' }
    }
    // SQLite doesn't need host/port/username/password validation
    return { valid: true }
  }

  // For other databases, validate standard fields
  if (!config.host || config.host.trim().length === 0) {
    return { valid: false, error: 'Host is required' }
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    return { valid: false, error: 'Valid port number is required (1-65535)' }
  }

  if (!config.database || config.database.trim().length === 0) {
    return { valid: false, error: 'Database name is required' }
  }

  if (!config.username || config.username.trim().length === 0) {
    return { valid: false, error: 'Username is required' }
  }

  if (!config.password || config.password.trim().length === 0) {
    return { valid: false, error: 'Password is required' }
  }

  return { valid: true }
}

/**
 * Close all connection adapters (for cleanup)
 */
export async function closeAllAdapters(): Promise<void> {
  const promises = Array.from(connectionAdapters.values()).map((cached) => cached.adapter.closePool())
  await Promise.all(promises)
  connectionAdapters.clear()
  getHealthMonitor().reset()
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use closeAllAdapters instead
 */
export async function closeAllPools(): Promise<void> {
  console.warn('closeAllPools is deprecated. Use closeAllAdapters instead.')
  await closeAllAdapters()
}
