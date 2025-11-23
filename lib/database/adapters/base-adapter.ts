/**
 * Base Database Adapter
 * Abstract class defining the interface all database adapters must implement
 */

import type {
  ConnectionConfig,
  QueryResult,
  TestConnectionResult,
  QueryValidationResult,
  PoolStats,
  DatabaseError,
  QueryOptions,
} from '../types/database'

import type {
  SchemaInfo,
  SchemaOptions,
  PromptContext,
  TableMetadata,
  RelationshipMetadata,
} from '../types/schema'

/**
 * Abstract base adapter class
 * All database-specific adapters must extend this
 */
export abstract class BaseDatabaseAdapter {
  protected config: ConnectionConfig
  protected pool: any = null
  protected isConnected: boolean = false

  constructor(config: ConnectionConfig) {
    this.config = config
  }

  // ==================== CONNECTION MANAGEMENT ====================

  /**
   * Create and initialize connection pool
   */
  abstract createPool(): Promise<void>

  /**
   * Close connection pool and cleanup resources
   */
  abstract closePool(): Promise<void>

  /**
   * Test database connection
   * Returns connection details and latency
   */
  abstract testConnection(): Promise<TestConnectionResult>

  /**
   * Get connection pool statistics
   */
  abstract getPoolStats(): PoolStats

  // ==================== SCHEMA INTROSPECTION ====================

  /**
   * Get complete schema information
   * This is the main method for schema introspection
   */
  abstract getSchema(options?: SchemaOptions): Promise<SchemaInfo>

  /**
   * Get list of all tables
   */
  abstract getTables(schema?: string): Promise<string[]>

  /**
   * Get metadata for a specific table
   */
  abstract getTableMetadata(tableName: string, schema?: string): Promise<TableMetadata>

  /**
   * Get all foreign key relationships
   */
  abstract getRelationships(schema?: string): Promise<RelationshipMetadata[]>

  /**
   * Sample rows from a table
   * Used for providing example data in prompts
   */
  abstract sampleTable(tableName: string, limit?: number): Promise<any[]>

  // ==================== QUERY EXECUTION ====================

  /**
   * Execute a SQL query
   * Returns standardized QueryResult
   */
  abstract executeQuery<T = any>(
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult<T>>

  /**
   * Execute query with timeout
   * Must handle database-specific timeout mechanisms
   */
  abstract executeWithTimeout<T = any>(
    sql: string,
    timeoutSeconds: number
  ): Promise<QueryResult<T>>

  /**
   * Explain query execution plan
   * Used for query optimization and cost estimation
   */
  abstract explainQuery(sql: string): Promise<any>

  // ==================== SQL GENERATION & VALIDATION ====================

  /**
   * Get SQL dialect identifier
   * e.g., 'postgresql', 'mysql', 'tsql'
   */
  abstract getSQLDialect(): string

  /**
   * Validate SQL syntax for this database
   * Returns validation result with errors/warnings
   */
  abstract validateQuery(sql: string): Promise<QueryValidationResult>

  /**
   * Sanitize SQL query for safety
   * Apply database-specific security measures
   */
  abstract sanitizeQuery(sql: string): string

  /**
   * Enforce row limit on query
   * Database-specific LIMIT/TOP syntax
   */
  abstract enforceRowLimit(sql: string, maxRows: number): string

  /**
   * Generate timeout SQL statement
   * Database-specific timeout syntax
   */
  abstract getTimeoutSQL(timeoutSeconds: number): string | null

  // ==================== LLM INTEGRATION ====================

  /**
   * Format schema information for LLM prompts
   * Returns human-readable schema description with examples
   */
  abstract formatSchemaForPrompt(schema: SchemaInfo): PromptContext

  /**
   * Get database-specific SQL generation guidelines
   * Returns prompt instructions for the LLM
   */
  abstract getSQLGenerationGuidelines(): string

  /**
   * Get example queries for this database type
   * Used to guide LLM in generating correct syntax
   */
  abstract getExampleQueries(): string[]

  // ==================== ERROR HANDLING ====================

  /**
   * Map database-specific errors to standardized DatabaseError
   * Extracts error codes, SQL states, and meaningful messages
   */
  abstract mapError(error: any): DatabaseError

  /**
   * Check if error is a connection error
   */
  abstract isConnectionError(error: any): boolean

  /**
   * Check if error is a timeout error
   */
  abstract isTimeoutError(error: any): boolean

  /**
   * Check if error is a syntax error
   */
  abstract isSyntaxError(error: any): boolean

  // ==================== UTILITY METHODS ====================

  /**
   * Get database server version
   */
  abstract getServerVersion(): Promise<string>

  /**
   * Get current database name
   */
  abstract getCurrentDatabase(): Promise<string>

  /**
   * Check if a table exists
   */
  abstract tableExists(tableName: string, schema?: string): Promise<boolean>

  /**
   * Check if a column exists in a table
   */
  abstract columnExists(
    tableName: string,
    columnName: string,
    schema?: string
  ): Promise<boolean>

  // ==================== COMMON HELPER METHODS ====================

  /**
   * Get connection status
   */
  public isPoolConnected(): boolean {
    return this.isConnected
  }

  /**
   * Get adapter configuration
   */
  public getConfig(): Readonly<ConnectionConfig> {
    return Object.freeze({ ...this.config })
  }

  /**
   * Common validation: Check if query is SELECT-only
   */
  protected isSelectQuery(sql: string): boolean {
    const trimmed = sql.trim().toLowerCase()
    return trimmed.startsWith('select') || trimmed.startsWith('with')
  }

  /**
   * Common validation: Check for dangerous keywords
   */
  protected hasDangerousKeywords(sql: string): string[] {
    const dangerous = ['drop', 'delete', 'truncate', 'insert', 'update', 'alter', 'create']
    const sqlLower = sql.toLowerCase()
    const found: string[] = []

    for (const keyword of dangerous) {
      // Use word boundary regex to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, 'i')
      if (regex.test(sqlLower)) {
        found.push(keyword)
      }
    }

    return found
  }

  /**
   * Common helper: Extract table names from basic SELECT queries
   * Note: This is a simple implementation. Complex queries may need SQL parser.
   */
  protected extractTableNames(sql: string): string[] {
    const tables: string[] = []
    // Updated regex to handle schema-qualified table names (e.g., public.users, dbo.customers)
    // Matches: tablename OR schema.tablename
    const fromRegex = /from\s+(?:([a-z_][a-z0-9_]*)\.)?\s*([a-z_][a-z0-9_]*)/gi
    const joinRegex = /join\s+(?:([a-z_][a-z0-9_]*)\.)?\s*([a-z_][a-z0-9_]*)/gi

    let match
    while ((match = fromRegex.exec(sql)) !== null) {
      // match[2] is the table name (with or without schema qualifier)
      // If match[1] exists, it's the schema name (e.g., "public")
      tables.push(match[2]) // Only store the table name, not schema.table
    }
    while ((match = joinRegex.exec(sql)) !== null) {
      tables.push(match[2])
    }

    return [...new Set(tables)] // Remove duplicates
  }

  /**
   * Common cleanup logic
   */
  protected async cleanup(): Promise<void> {
    if (this.pool) {
      await this.closePool()
      this.pool = null
      this.isConnected = false
    }
  }
}

/**
 * Adapter factory interface
 * Used to create adapters based on database type
 */
export interface AdapterFactory {
  createAdapter(config: ConnectionConfig): BaseDatabaseAdapter
}
