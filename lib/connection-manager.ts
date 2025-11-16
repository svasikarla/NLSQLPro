import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/security/encryption'
import { createDatabaseAdapter } from '@/lib/database/adapters/adapter-factory'
import { DatabaseType, type ConnectionConfig as AdapterConnectionConfig } from '@/lib/database/types/database'
import type { BaseDatabaseAdapter } from '@/lib/database/adapters/base-adapter'

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
}

// Connection adapter cache (in-memory)
const connectionAdapters = new Map<string, BaseDatabaseAdapter>()

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

  return {
    id: connection.id,
    name: connection.name,
    db_type: dbTypeMap[connection.db_type],
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    password: password,
    ssl: connection.host.includes('supabase.com') ? { rejectUnauthorized: true } : undefined,
    poolMin: 2,
    poolMax: 10,
    connectionTimeout: connection.port === 6543 ? 10000 : 5000, // Longer timeout for poolers
    idleTimeout: 30000,
  }
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

    // Create adapter config
    const adapterConfig: AdapterConnectionConfig = {
      name: config.name,
      db_type: dbTypeMap[config.db_type],
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.host.includes('supabase.com') ? { rejectUnauthorized: true } : undefined,
    }

    // Create adapter using factory
    const adapter = createDatabaseAdapter(adapterConfig)

    // Test connection
    const result = await adapter.testConnection()

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Connection test failed',
      }
    }

    return {
      success: true,
      message: result.message || `Connection successful to ${config.database}`,
    }
  } catch (error) {
    console.error('Connection test failed:', error)

    // Provide helpful error messages
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('SASL') || errorMessage.includes('SCRAM') || errorMessage.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check your username and password.'
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('host')) {
      errorMessage = 'Host not found. Please check the hostname and ensure it\'s accessible.'
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('refused')) {
      errorMessage = 'Connection refused. Please check the host and port are correct.'
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'Connection timeout. The database server may be unreachable or slow to respond.'
    } else if (errorMessage.includes('SQLITE') && errorMessage.includes('open')) {
      errorMessage = 'SQLite file not found or cannot be opened. Please check the file path.'
    }

    return {
      success: false,
      error: errorMessage,
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
  const adapter = connectionAdapters.get(adapterKey)
  if (adapter) {
    await adapter.closePool()
    connectionAdapters.delete(adapterKey)
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
  const adapter = connectionAdapters.get(adapterKey)
  if (adapter) {
    await adapter.closePool()
    connectionAdapters.delete(adapterKey)
  }

  return { success: true, connection: data as DatabaseConnection }
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
  const adapter = connectionAdapters.get(adapterKey)
  if (adapter) {
    await adapter.closePool()
    connectionAdapters.delete(adapterKey)
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
 * Get or create a database adapter for a specific connection
 */
export async function getConnectionAdapter(
  userId: string,
  connectionId: string
): Promise<BaseDatabaseAdapter | null> {
  const adapterKey = `${userId}:${connectionId}`

  // Return existing adapter if available and connected
  const existingAdapter = connectionAdapters.get(adapterKey)
  if (existingAdapter && existingAdapter.isPoolConnected()) {
    return existingAdapter
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

    // Initialize connection pool
    await adapter.createPool()

    // Store in cache
    connectionAdapters.set(adapterKey, adapter)

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
  const promises = Array.from(connectionAdapters.values()).map((adapter) => adapter.closePool())
  await Promise.all(promises)
  connectionAdapters.clear()
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use closeAllAdapters instead
 */
export async function closeAllPools(): Promise<void> {
  console.warn('closeAllPools is deprecated. Use closeAllAdapters instead.')
  await closeAllAdapters()
}
