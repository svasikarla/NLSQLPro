/**
 * MySQL Database Adapter
 * Implements BaseDatabaseAdapter for MySQL databases
 */

import mysql from 'mysql2/promise'
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

import { decrypt } from '@/lib/security/encryption'

export class MySQLAdapter extends BaseDatabaseAdapter {
  protected pool: mysql.Pool | null = null

  // ==================== CONNECTION MANAGEMENT ====================

  async createPool(): Promise<void> {
    if (this.pool) {
      await this.closePool()
    }

    // Decrypt password if encrypted
    let password: string
    if (this.config.password_encrypted) {
      password = decrypt(this.config.password_encrypted)
    } else if (this.config.password) {
      password = this.config.password
      console.warn('Using plain text password. Consider encrypting it.')
    } else {
      throw new DatabaseError('No password provided')
    }

    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.username,
      password: password,
      connectionLimit: this.config.poolMax || 10,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: this.config.connectionTimeout || 30000, // Increased for cloud databases
      idleTimeout: this.config.idleTimeout || 30000,
      ssl: this.config.ssl === true ? {} : this.config.ssl || undefined,
    })

    // Test the connection
    const connection = await this.pool.getConnection()
    try {
      await connection.ping()
      this.isConnected = true
    } finally {
      connection.release()
    }
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      this.isConnected = false
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()
    let tempPool: mysql.Pool | null = null

    try {
      // Decrypt password
      let password: string
      if (this.config.password_encrypted) {
        password = decrypt(this.config.password_encrypted)
      } else if (this.config.password) {
        password = this.config.password
      } else {
        return { success: false, error: 'No password provided' }
      }

      tempPool = mysql.createPool({
        host: this.config.host,
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.username,
        password: password,
        connectionLimit: 1,
        connectTimeout: this.config.connectionTimeout || 30000, // Increased for cloud databases
      })

      const connection = await tempPool.getConnection()
      try {
        // Get server version
        const [versionRows] = await connection.query('SELECT VERSION() as version')
        const serverVersion = (versionRows as any)[0].version

        // Get current database
        const [dbRows] = await connection.query('SELECT DATABASE() as db')
        const database = (dbRows as any)[0].db

        const latency = Date.now() - startTime

        return {
          success: true,
          message: 'Connection successful',
          serverVersion,
          database,
          latency,
        }
      } finally {
        connection.release()
      }
    } catch (error: any) {
      return {
        success: false,
        error: this.mapError(error).message,
        latency: Date.now() - startTime,
      }
    } finally {
      if (tempPool) {
        await tempPool.end()
      }
    }
  }

  getPoolStats(): PoolStats {
    if (!this.pool) {
      return {
        totalConnections: 0,
        idleConnections: 0,
        activeConnections: 0,
        waitingClients: 0,
      }
    }

    // MySQL2 pool doesn't expose these stats directly, so we return estimates
    // @ts-ignore - accessing internal pool properties
    const totalCount = this.pool?.pool?._allConnections?.length || 0
    // @ts-ignore
    const freeCount = this.pool?.pool?._freeConnections?.length || 0

    return {
      totalConnections: totalCount,
      idleConnections: freeCount,
      activeConnections: totalCount - freeCount,
      waitingClients: 0, // Not available in mysql2
    }
  }

  // ==================== SCHEMA INTROSPECTION ====================

  async getSchema(options?: SchemaOptions): Promise<SchemaInfo> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const connection = await this.pool.getConnection()
    try {
      const dbName = this.config.database

      // Get all tables
      const [tablesRows] = await connection.query(
        `SELECT TABLE_NAME as table_name
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME`,
        [dbName]
      )
      const tables = tablesRows as any[]

      // Get primary keys
      const [primaryKeysRows] = await connection.query(
        `SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
        [dbName]
      )
      const primaryKeysData = primaryKeysRows as any[]
      const primaryKeys = new Map<string, Set<string>>()

      for (const row of primaryKeysData) {
        if (!primaryKeys.has(row.table_name)) {
          primaryKeys.set(row.table_name, new Set())
        }
        primaryKeys.get(row.table_name)!.add(row.column_name)
      }

      // Get foreign keys
      const [foreignKeysRows] = await connection.query(
        `SELECT
           kcu.TABLE_NAME as table_name,
           kcu.COLUMN_NAME as column_name,
           kcu.REFERENCED_TABLE_NAME as foreign_table_name,
           kcu.REFERENCED_COLUMN_NAME as foreign_column_name
         FROM information_schema.KEY_COLUMN_USAGE kcu
         WHERE kcu.TABLE_SCHEMA = ?
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbName]
      )
      const foreignKeysData = foreignKeysRows as any[]
      const foreignKeys = new Map<string, Array<{ column: string; refTable: string; refColumn: string }>>()
      const relationships: RelationshipMetadata[] = []

      for (const row of foreignKeysData) {
        if (!foreignKeys.has(row.table_name)) {
          foreignKeys.set(row.table_name, [])
        }
        foreignKeys.get(row.table_name)!.push({
          column: row.column_name,
          refTable: row.foreign_table_name,
          refColumn: row.foreign_column_name,
        })

        relationships.push({
          from: row.table_name,
          fromCol: row.column_name,
          to: row.foreign_table_name,
          toCol: row.foreign_column_name,
        })
      }

      // Get columns for each table
      const schema: SchemaInfo = {
        tables: {},
        relationships,
      }

      for (const table of tables) {
        const tableName = table.table_name
        const [columnsRows] = await connection.query(
          `SELECT
             COLUMN_NAME as column_name,
             DATA_TYPE as data_type,
             IS_NULLABLE as is_nullable,
             COLUMN_DEFAULT as column_default,
             CHARACTER_MAXIMUM_LENGTH as max_length,
             NUMERIC_PRECISION as precision,
             NUMERIC_SCALE as scale,
             EXTRA as extra
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [dbName, tableName]
        )
        const columnsData = columnsRows as any[]

        // Enhance columns with PK/FK info
        schema.tables[tableName] = columnsData.map((col: any): ColumnMetadata => {
          const isPrimaryKey = primaryKeys.get(tableName)?.has(col.column_name) || false
          const foreignKey = foreignKeys.get(tableName)?.find(fk => fk.column === col.column_name)

          return {
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            is_primary_key: isPrimaryKey,
            is_auto_increment: col.extra?.toLowerCase().includes('auto_increment') || false,
            default_value: col.column_default,
            max_length: col.max_length,
            precision: col.precision,
            scale: col.scale,
            foreign_key: foreignKey ? {
              refTable: foreignKey.refTable,
              refColumn: foreignKey.refColumn,
            } : undefined,
          }
        })
      }

      return schema
    } finally {
      connection.release()
    }
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const dbName = schema || this.config.database
    const [rows] = await this.pool.query(
      `SELECT TABLE_NAME as table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [dbName]
    )
    return (rows as any[]).map(row => row.table_name)
  }

  async getTableMetadata(tableName: string, schema?: string): Promise<TableMetadata> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const connection = await this.pool.getConnection()
    try {
      const dbName = schema || this.config.database

      // Get columns
      const [columnsRows] = await connection.query(
        `SELECT
           COLUMN_NAME as column_name,
           DATA_TYPE as data_type,
           IS_NULLABLE as is_nullable,
           COLUMN_DEFAULT as column_default,
           CHARACTER_MAXIMUM_LENGTH as max_length,
           NUMERIC_PRECISION as precision,
           NUMERIC_SCALE as scale
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [dbName, tableName]
      )
      const columnsData = columnsRows as any[]

      // Get row count
      const [countRows] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``)
      const rowCount = parseInt((countRows as any)[0].count)

      const columns: ColumnMetadata[] = columnsData.map((col: any) => ({
        column_name: col.column_name,
        data_type: col.data_type,
        is_nullable: col.is_nullable,
        default_value: col.column_default,
        max_length: col.max_length,
        precision: col.precision,
        scale: col.scale,
      }))

      return {
        table_name: tableName,
        table_schema: dbName,
        columns,
        row_count: rowCount,
      }
    } finally {
      connection.release()
    }
  }

  async getRelationships(schema?: string): Promise<RelationshipMetadata[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const dbName = schema || this.config.database
    const [rows] = await this.pool.query(
      `SELECT
         kcu.TABLE_NAME as from_table,
         kcu.COLUMN_NAME as from_column,
         kcu.REFERENCED_TABLE_NAME as to_table,
         kcu.REFERENCED_COLUMN_NAME as to_column,
         kcu.CONSTRAINT_NAME as constraint_name
       FROM information_schema.KEY_COLUMN_USAGE kcu
       WHERE kcu.TABLE_SCHEMA = ?
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    )

    return (rows as any[]).map((row: any): RelationshipMetadata => ({
      from: row.from_table,
      fromCol: row.from_column,
      to: row.to_table,
      toCol: row.to_column,
      constraintName: row.constraint_name,
    }))
  }

  async sampleTable(tableName: string, limit: number = 5): Promise<any[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const [rows] = await this.pool.query(`SELECT * FROM \`${tableName}\` LIMIT ?`, [limit])
    return rows as any[]
  }

  // ==================== QUERY EXECUTION ====================

  async executeQuery<T = any>(sql: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const connection = await this.pool.getConnection()
    try {
      const startTime = Date.now()

      // Set timeout if specified (MySQL uses max_execution_time in milliseconds)
      if (options?.timeout) {
        await connection.query(`SET SESSION max_execution_time = ${options.timeout * 1000}`)
      }

      const [rows, fields] = await connection.query(sql)
      const executionTime = Date.now() - startTime

      return {
        rows: rows as T[],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime,
      }
    } finally {
      // Reset timeout
      if (options?.timeout) {
        await connection.query('SET SESSION max_execution_time = 0')
      }
      connection.release()
    }
  }

  async executeWithTimeout<T = any>(sql: string, timeoutSeconds: number): Promise<QueryResult<T>> {
    return this.executeQuery<T>(sql, { timeout: timeoutSeconds })
  }

  async explainQuery(sql: string): Promise<any> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const explainSQL = `EXPLAIN FORMAT=JSON ${sql}`
    const [rows] = await this.pool.query(explainSQL)
    return (rows as any)[0]['EXPLAIN']
  }

  // ==================== SQL GENERATION & VALIDATION ====================

  getSQLDialect(): string {
    return 'MySQL'
  }

  async validateQuery(sql: string): Promise<QueryValidationResult> {
    const parser = new Parser()
    const errors: string[] = []
    const warnings: string[] = []
    let tables: string[] = []
    let columns: string[] = []
    let parsedAST: any = null

    try {
      parsedAST = parser.astify(sql, { database: 'MySQL' })
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
    sql = sql.replace(/#.*$/gm, '') // MySQL also supports # for comments

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

  getTimeoutSQL(timeoutSeconds: number): string {
    return `SET SESSION max_execution_time = ${timeoutSeconds * 1000}`
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
        if (col.is_auto_increment) colInfo += ' AUTO_INCREMENT'
        if (col.is_nullable === 'NO') colInfo += ' NOT NULL'

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

      // Add JOIN examples with MySQL syntax
      schemaText += `\n💡 MySQL JOIN Examples:\n`
      const exampleCount = Math.min(3, relationships.length)
      const examples: string[] = []
      for (let i = 0; i < exampleCount; i++) {
        const rel = relationships[i]
        // Use MySQL syntax: backticks, LIMIT, table aliases
        const example = `SELECT f.*, t.* FROM \`${rel.from}\` AS f INNER JOIN \`${rel.to}\` AS t ON f.\`${rel.fromCol}\` = t.\`${rel.toCol}\` LIMIT 100`
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
2. Use proper MySQL syntax
3. Use backticks (\`) for table/column names with spaces or reserved words
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

MYSQL-SPECIFIC:
- Use backticks for identifiers: \`table_name\`, \`column_name\`
- Date functions: NOW(), CURDATE(), DATE_FORMAT()
- String functions: CONCAT(), SUBSTRING(), LOWER(), UPPER()`
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
    const mysqlError = error as any

    return new DatabaseError(
      mysqlError.message || 'Unknown database error',
      mysqlError.code,
      mysqlError.sqlState,
      mysqlError
    )
  }

  isConnectionError(error: any): boolean {
    const code = error.code
    return [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ER_ACCESS_DENIED_ERROR',
      'ER_BAD_DB_ERROR',
      'PROTOCOL_CONNECTION_LOST',
    ].includes(code)
  }

  isTimeoutError(error: any): boolean {
    return error.code === 'ER_QUERY_TIMEOUT' || error.message?.includes('timeout')
  }

  isSyntaxError(error: any): boolean {
    return error.code === 'ER_PARSE_ERROR' || error.code === 'ER_SYNTAX_ERROR'
  }

  // ==================== UTILITY METHODS ====================

  async getServerVersion(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const [rows] = await this.pool.query('SELECT VERSION() as version')
    return (rows as any)[0].version
  }

  async getCurrentDatabase(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const [rows] = await this.pool.query('SELECT DATABASE() as db')
    return (rows as any)[0].db
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const dbName = schema || this.config.database
    const [rows] = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, tableName]
    )
    return (rows as any)[0].count > 0
  }

  async columnExists(tableName: string, columnName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const dbName = schema || this.config.database
    const [rows] = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, tableName, columnName]
    )
    return (rows as any)[0].count > 0
  }
}
