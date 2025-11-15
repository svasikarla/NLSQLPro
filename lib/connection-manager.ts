import { Pool, PoolClient } from 'pg'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/security/encryption'

// Type definitions
export interface DatabaseConnection {
  id: string
  user_id: string
  name: string
  db_type: 'postgresql' | 'mysql' | 'sqlite'
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
  db_type: 'postgresql' | 'mysql' | 'sqlite'
  host: string
  port: number
  database: string
  username: string
  password: string
}

// Connection pool cache (in-memory)
const connectionPools = new Map<string, Pool>()

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
 * Test a database connection
 */
export async function testConnection(
  config: ConnectionConfig
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (config.db_type !== 'postgresql') {
    return { success: false, error: 'Only PostgreSQL is currently supported' }
  }

  let client: PoolClient | null = null
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 5000, // 5 second timeout
    max: 1, // Only need one connection for testing
  })

  try {
    client = await pool.connect()
    await client.query('SELECT 1')
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    console.error('Connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    if (client) client.release()
    await pool.end()
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

  // Clear connection pool cache when switching connections
  const poolKey = `${userId}:${connectionId}`
  const pool = connectionPools.get(poolKey)
  if (pool) {
    await pool.end()
    connectionPools.delete(poolKey)
  }

  return { success: true }
}

/**
 * Delete a connection
 */
export async function deleteConnection(
  userId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Clear connection pool cache
  const poolKey = `${userId}:${connectionId}`
  const pool = connectionPools.get(poolKey)
  if (pool) {
    await pool.end()
    connectionPools.delete(poolKey)
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
 * Get or create a connection pool for a specific connection
 */
export async function getConnectionPool(
  userId: string,
  connectionId: string
): Promise<Pool | null> {
  const poolKey = `${userId}:${connectionId}`

  // Return existing pool if available
  if (connectionPools.has(poolKey)) {
    return connectionPools.get(poolKey)!
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
    console.error('Error fetching connection for pool:', error)
    return null
  }

  const dbConnection = connection as DatabaseConnection

  if (dbConnection.db_type !== 'postgresql') {
    console.error('Only PostgreSQL is currently supported')
    return null
  }

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

  // Create new pool
  const pool = new Pool({
    host: dbConnection.host,
    port: dbConnection.port,
    database: dbConnection.database,
    user: dbConnection.username,
    password: password,
    max: 10, // Max 10 connections per pool
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
  })

  // Store in cache
  connectionPools.set(poolKey, pool)

  return pool
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

  if (config.db_type !== 'postgresql') {
    return { valid: false, error: 'Only PostgreSQL is currently supported' }
  }

  return { valid: true }
}

/**
 * Close all connection pools (for cleanup)
 */
export async function closeAllPools(): Promise<void> {
  const promises = Array.from(connectionPools.values()).map((pool) => pool.end())
  await Promise.all(promises)
  connectionPools.clear()
}
