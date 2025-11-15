/**
 * SQLite Database Adapter
 * Implements BaseDatabaseAdapter for SQLite databases
 */

import Database from 'better-sqlite3'
import { Parser } from 'node-sql-parser'
import { BaseDatabaseAdapter } from './base-adapter'
import {
  DatabaseType,
  DatabaseError,
  type ConnectionConfig,
  type QueryResult,
  type TestConnectionResult,
  type QueryValidationResult,
  type PoolStats,
  type QueryOptions,
} from '../types/database'

import {
  type SchemaInfo,
  type SchemaOptions,
  type PromptContext,
  type TableMetadata,
  type ColumnMetadata,
  type RelationshipMetadata,
} from '../types/schema'

export class SQLiteAdapter extends BaseDatabaseAdapter {
  protected db: Database.Database | null = null
  private readonly filePath: string

  constructor(config: ConnectionConfig) {
    super(config)
    // For SQLite, the database path is stored in either database or host field
    this.filePath = config.database || config.host || ':memory:'
  }

  // ==================== CONNECTION MANAGEMENT ====================

  async createPool(): Promise<void> {
    if (this.db) {
      await this.closePool()
    }

    try {
      this.db = new Database(this.filePath, {
        readonly: false,
        fileMustExist: this.filePath !== ':memory:',
        timeout: this.config.connectionTimeout || 5000,
      })

      // Enable foreign keys (disabled by default in SQLite)
      this.db.pragma('foreign_keys = ON')

      // Test the connection
      this.db.prepare('SELECT 1').get()
      this.isConnected = true
    } catch (error: any) {
      throw new DatabaseError(`Failed to open SQLite database: ${error.message}`, error.code, undefined, error)
    }
  }

  async closePool(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isConnected = false
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()

    try {
      const tempDb = new Database(this.filePath, {
        readonly: true,
        fileMustExist: this.filePath !== ':memory:',
        timeout: 5000,
      })

      try {
        // Get SQLite version
        const versionResult = tempDb.prepare('SELECT sqlite_version() as version').get() as any
        const serverVersion = `SQLite ${versionResult.version}`

        // Get database file path
        const database = this.filePath

        const latency = Date.now() - startTime

        return {
          success: true,
          message: 'Connection successful',
          serverVersion,
          database,
          latency,
        }
      } finally {
        tempDb.close()
      }
    } catch (error: any) {
      return {
        success: false,
        error: this.mapError(error).message,
        latency: Date.now() - startTime,
      }
    }
  }

  getPoolStats(): PoolStats {
    // SQLite doesn't have a connection pool concept
    // It's a single connection per file
    return {
      totalConnections: this.isConnected ? 1 : 0,
      idleConnections: 0,
      activeConnections: this.isConnected ? 1 : 0,
      waitingClients: 0,
    }
  }

  // ==================== SCHEMA INTROSPECTION ====================

  async getSchema(options?: SchemaOptions): Promise<SchemaInfo> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    try {
      // Get all tables
      const tables = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
        .all() as any[]

      // Get foreign keys info
      const relationships: RelationshipMetadata[] = []
      const foreignKeys = new Map<string, Array<{ column: string; refTable: string; refColumn: string }>>()

      for (const table of tables) {
        const fkInfo = this.db.pragma(`foreign_key_list(${table.name})`) as any[]
        for (const fk of fkInfo) {
          if (!foreignKeys.has(table.name)) {
            foreignKeys.set(table.name, [])
          }
          foreignKeys.get(table.name)!.push({
            column: fk.from,
            refTable: fk.table,
            refColumn: fk.to,
          })

          relationships.push({
            from: table.name,
            fromCol: fk.from,
            to: fk.table,
            toCol: fk.to,
          })
        }
      }

      // Get columns for each table
      const schema: SchemaInfo = {
        tables: {},
        relationships,
      }

      for (const table of tables) {
        const tableName = table.name
        const tableInfo = this.db.pragma(`table_info(${tableName})`) as any[]

        // Enhance columns with FK info
        schema.tables[tableName] = tableInfo.map((col: any): ColumnMetadata => {
          const foreignKey = foreignKeys.get(tableName)?.find(fk => fk.column === col.name)

          return {
            column_name: col.name,
            data_type: col.type,
            is_nullable: col.notnull === 0,
            is_primary_key: col.pk === 1,
            default_value: col.dflt_value,
            foreign_key: foreignKey ? {
              refTable: foreignKey.refTable,
              refColumn: foreignKey.refColumn,
            } : undefined,
          }
        })
      }

      return schema
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    const tables = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as any[]

    return tables.map(t => t.name)
  }

  async getTableMetadata(tableName: string, schema?: string): Promise<TableMetadata> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    try {
      // Get columns
      const tableInfo = this.db.pragma(`table_info(${tableName})`) as any[]

      // Get row count
      const countResult = this.db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as any
      const rowCount = countResult.count

      const columns: ColumnMetadata[] = tableInfo.map((col: any) => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: col.notnull === 0,
        is_primary_key: col.pk === 1,
        default_value: col.dflt_value,
      }))

      return {
        table_name: tableName,
        table_schema: 'main',
        columns,
        row_count: rowCount,
      }
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async getRelationships(schema?: string): Promise<RelationshipMetadata[]> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    const tables = await this.getTables()
    const relationships: RelationshipMetadata[] = []

    for (const tableName of tables) {
      const fkInfo = this.db.pragma(`foreign_key_list(${tableName})`) as any[]
      for (const fk of fkInfo) {
        relationships.push({
          from: tableName,
          fromCol: fk.from,
          to: fk.table,
          toCol: fk.to,
        })
      }
    }

    return relationships
  }

  async sampleTable(tableName: string, limit: number = 5): Promise<any[]> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    return this.db.prepare(`SELECT * FROM "${tableName}" LIMIT ?`).all(limit)
  }

  // ==================== QUERY EXECUTION ====================

  async executeQuery<T = any>(sql: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    try {
      const startTime = Date.now()

      // SQLite doesn't have built-in query timeout at execution level
      // We rely on the connection timeout set during initialization
      const stmt = this.db.prepare(sql)
      const rows = stmt.all() as T[]
      const executionTime = Date.now() - startTime

      return {
        rows,
        rowCount: rows.length,
        executionTime,
      }
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async executeWithTimeout<T = any>(sql: string, timeoutSeconds: number): Promise<QueryResult<T>> {
    // SQLite doesn't support per-query timeouts natively
    // We implement a simple timeout wrapper
    return new Promise<QueryResult<T>>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new DatabaseError('Query timeout exceeded', 'SQLITE_TIMEOUT'))
      }, timeoutSeconds * 1000)

      try {
        const result = await this.executeQuery<T>(sql)
        clearTimeout(timeoutId)
        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  async explainQuery(sql: string): Promise<any> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    const explainResult = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all()
    return explainResult
  }

  // ==================== SQL GENERATION & VALIDATION ====================

  getSQLDialect(): string {
    return 'SQLite'
  }

  async validateQuery(sql: string): Promise<QueryValidationResult> {
    const parser = new Parser()
    const errors: string[] = []
    const warnings: string[] = []
    let tables: string[] = []
    let columns: string[] = []
    let parsedAST: any = null

    try {
      parsedAST = parser.astify(sql, { database: 'sqlite' })
      const statements = Array.isArray(parsedAST) ? parsedAST : [parsedAST]

      for (const ast of statements) {
        if (ast.type !== 'select') {
          errors.push(`Only SELECT queries allowed (found: ${ast.type})`)
        }

        tables = this.extractTableNames(sql)
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        tables,
        columns,
        parsedAST,
      }
    } catch (error: any) {
      errors.push(`SQL syntax error: ${error.message}`)
      return {
        valid: false,
        errors,
        warnings,
        tables: [],
        columns: [],
      }
    }
  }

  sanitizeQuery(sql: string): string {
    // Remove comments
    sql = sql.replace(/--.*$/gm, '')
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '')

    // Remove trailing semicolons
    sql = sql.trim().replace(/;+$/, '')

    return sql.trim()
  }

  enforceRowLimit(sql: string, maxRows: number): string {
    const limitRegex = /LIMIT\s+(\d+)(\s+OFFSET\s+\d+)?$/i
    const match = sql.trim().match(limitRegex)

    if (match) {
      const existingLimit = parseInt(match[1])
      if (existingLimit <= maxRows) return sql
      return sql.replace(limitRegex, `LIMIT ${maxRows}`)
    }

    return `${sql.trim()} LIMIT ${maxRows}`
  }

  getTimeoutSQL(timeoutSeconds: number): string | null {
    // SQLite doesn't support SQL-level timeout configuration
    return null
  }

  // ==================== LLM INTEGRATION ====================

  formatSchemaForPrompt(schema: SchemaInfo): PromptContext {
    let schemaText = ''

    // Format tables with enhanced column info
    for (const [tableName, columns] of Object.entries(schema.tables)) {
      schemaText += `\n📋 Table: ${tableName}\n`
      schemaText += `Columns:\n`
      for (const col of columns) {
        let colInfo = `  - ${col.column_name} (${col.data_type})`

        if (col.is_primary_key) colInfo += ' PRIMARY KEY'
        if (!col.is_nullable) colInfo += ' NOT NULL'

        if (col.foreign_key) {
          colInfo += ` → REFERENCES ${col.foreign_key.refTable}(${col.foreign_key.refColumn})`
        }

        schemaText += colInfo + '\n'
      }
    }

    // Format relationships section
    const relationships = schema.relationships || []
    if (relationships.length > 0) {
      schemaText += `\n🔗 Relationships (for JOINs):\n`
      for (const rel of relationships) {
        schemaText += `  ${rel.from}.${rel.fromCol} → ${rel.to}.${rel.toCol}\n`
      }

      // Add JOIN examples
      schemaText += `\n💡 JOIN Examples:\n`
      const exampleCount = Math.min(3, relationships.length)
      const examples: string[] = []
      for (let i = 0; i < exampleCount; i++) {
        const rel = relationships[i]
        const example = `SELECT * FROM ${rel.from} JOIN ${rel.to} ON ${rel.from}.${rel.fromCol} = ${rel.to}.${rel.toCol}`
        schemaText += `  ${example}\n`
        examples.push(example)
      }

      return {
        schemaText,
        tables: Object.keys(schema.tables),
        relationships,
        examples,
      }
    }

    return {
      schemaText,
      tables: Object.keys(schema.tables),
      relationships,
    }
  }

  getSQLGenerationGuidelines(): string {
    return `CRITICAL RULES:
1. Only generate SELECT queries (read-only)
2. Use proper SQLite syntax
3. Use double quotes (") for identifiers with spaces or reserved words
4. Use the relationships shown above to write correct JOINs
5. Include LIMIT clause for safety (max 100 rows unless user specifies otherwise)
6. Return ONLY the SQL query, no explanations, no markdown formatting, no code blocks
7. Do not include semicolon at the end
8. When joining tables, ALWAYS use the foreign key relationships shown above
9. Use table aliases for clarity (e.g., u for users, o for orders)
10. If the query involves multiple tables, use explicit JOIN conditions based on the relationships

IMPORTANT JOIN INSTRUCTIONS:
- NEVER create joins without looking at the relationships section
- Use INNER JOIN for required relationships
- Use LEFT JOIN when the relationship is optional
- ALWAYS specify the ON condition explicitly

SQLITE-SPECIFIC:
- Use double quotes for identifiers: "table_name", "column_name"
- Date functions: date(), datetime(), strftime()
- String functions: substr(), length(), lower(), upper()
- No BOOLEAN type - use 0/1 integers
- Limited ALTER TABLE support`
  }

  getExampleQueries(): string[] {
    return [
      'SELECT * FROM users LIMIT 10',
      'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id',
      'SELECT * FROM products WHERE price > 100 ORDER BY price DESC LIMIT 20',
      'SELECT COUNT(*) as total, status FROM orders GROUP BY status',
    ]
  }

  // ==================== ERROR HANDLING ====================

  mapError(error: any): DatabaseError {
    const sqliteError = error as any

    return new DatabaseError(
      sqliteError.message || 'Unknown database error',
      sqliteError.code,
      undefined,
      sqliteError
    )
  }

  isConnectionError(error: any): boolean {
    const message = error.message?.toLowerCase() || ''
    return (
      message.includes('unable to open database') ||
      message.includes('database is locked') ||
      message.includes('file is not a database')
    )
  }

  isTimeoutError(error: any): boolean {
    return error.code === 'SQLITE_BUSY' || error.message?.includes('timeout')
  }

  isSyntaxError(error: any): boolean {
    return error.code === 'SQLITE_ERROR' && error.message?.includes('syntax error')
  }

  // ==================== UTILITY METHODS ====================

  async getServerVersion(): Promise<string> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    const result = this.db.prepare('SELECT sqlite_version() as version').get() as any
    return `SQLite ${result.version}`
  }

  async getCurrentDatabase(): Promise<string> {
    return this.filePath
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    const result = this.db
      .prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName) as any

    return result.count > 0
  }

  async columnExists(tableName: string, columnName: string, schema?: string): Promise<boolean> {
    if (!this.db) throw new DatabaseError('Database not initialized')

    try {
      const tableInfo = this.db.pragma(`table_info(${tableName})`) as any[]
      return tableInfo.some(col => col.name === columnName)
    } catch (error) {
      return false
    }
  }
}
