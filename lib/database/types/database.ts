/**
 * Core database type definitions
 * Used across all database adapters
 */

export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
  SQLSERVER = 'sqlserver',
  MONGODB = 'mongodb',
}

/**
 * Generic connection configuration
 * Adapters will extract their specific needs from this
 */
export interface ConnectionConfig {
  id?: string
  name: string
  db_type: DatabaseType
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  password_encrypted?: string

  // For connection strings (MongoDB, Postgres, etc.)
  connection_string?: string

  // SSL/TLS options
  ssl?: boolean | {
    rejectUnauthorized?: boolean
    ca?: string
    cert?: string
    key?: string
  }

  // Connection pool options
  poolMin?: number
  poolMax?: number

  // Timeouts
  connectionTimeout?: number
  idleTimeout?: number

  // Additional options (adapter-specific)
  options?: Record<string, any>
}

/**
 * Standard query result format
 * All adapters must return results in this format
 */
export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
  fields?: FieldInfo[]
  executionTime?: number
  affectedRows?: number
}

/**
 * Field/column information
 */
export interface FieldInfo {
  name: string
  dataType: string
  nullable: boolean
  defaultValue?: any
  maxLength?: number
  precision?: number
  scale?: number
}

/**
 * Connection test result
 */
export interface TestConnectionResult {
  success: boolean
  message?: string
  error?: string
  serverVersion?: string
  database?: string
  latency?: number
}

/**
 * Query validation result
 */
export interface QueryValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  tables: string[]
  columns: string[]
  parsedAST?: any
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  totalConnections: number
  idleConnections: number
  activeConnections: number
  waitingClients: number
}

/**
 * Database error with standardized structure
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public sqlState?: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Query execution options
 */
export interface QueryOptions {
  timeout?: number
  maxRows?: number
  readonly?: boolean
  parameters?: any[]
}
