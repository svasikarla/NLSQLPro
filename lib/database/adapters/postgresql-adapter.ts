/**
 * PostgreSQL Database Adapter
 * Implements BaseDatabaseAdapter for PostgreSQL databases
 */

import { Pool, PoolClient } from 'pg'
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

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  protected pool: Pool | null = null

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

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.username,
      password: password,
      max: this.config.poolMax || 10,
      min: this.config.poolMin || 2,
      idleTimeoutMillis: this.config.idleTimeout || 30000,
      connectionTimeoutMillis: this.config.connectionTimeout || 5000,
      ssl: this.config.ssl,
    })

    // Test the connection
    const client = await this.pool.connect()
    try {
      await client.query('SELECT 1')
      this.isConnected = true
    } finally {
      client.release()
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
    let tempPool: Pool | null = null

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

      tempPool = new Pool({
        host: this.config.host,
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.username,
        password: password,
        max: 1,
        connectionTimeoutMillis: 5000,
      })

      const client = await tempPool.connect()
      try {
        // Get server version
        const versionResult = await client.query('SELECT version()')
        const serverVersion = versionResult.rows[0].version

        // Get current database
        const dbResult = await client.query('SELECT current_database()')
        const database = dbResult.rows[0].current_database

        const latency = Date.now() - startTime

        return {
          success: true,
          message: 'Connection successful',
          serverVersion,
          database,
          latency,
        }
      } finally {
        client.release()
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

    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    }
  }

  // ==================== SCHEMA INTROSPECTION ====================

  async getSchema(options?: SchemaOptions): Promise<SchemaInfo> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const client = await this.pool.connect()
    try {
      // Get all tables WITH schema names (e.g., "public.users")
      // CRITICAL: PostgreSQL uses schemas to organize tables (public, auth, extensions, etc.)
      const tablesQuery = `
        SELECT
          table_schema,
          table_name,
          table_schema || '.' || table_name as qualified_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_schema, table_name;
      `
      const tablesResult = await client.query(tablesQuery)

      // Get primary keys WITH schema-qualified table names
      const primaryKeysQuery = `
        SELECT
          tc.table_schema || '.' || tc.table_name as table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public';
      `
      const primaryKeysResult = await client.query(primaryKeysQuery)
      const primaryKeys = new Map<string, Set<string>>()

      for (const row of primaryKeysResult.rows) {
        if (!primaryKeys.has(row.table_name)) {
          primaryKeys.set(row.table_name, new Set())
        }
        primaryKeys.get(row.table_name)!.add(row.column_name)
      }

      // Get foreign keys WITH schema-qualified table names
      const foreignKeysQuery = `
        SELECT
          tc.table_schema || '.' || tc.table_name as table_name,
          kcu.column_name,
          ccu.table_schema || '.' || ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
      `
      const foreignKeysResult = await client.query(foreignKeysQuery)
      const foreignKeys = new Map<string, Array<{ column: string; refTable: string; refColumn: string }>>()
      const relationships: RelationshipMetadata[] = []

      for (const row of foreignKeysResult.rows) {
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

      for (const table of tablesResult.rows) {
        // Use qualified name (e.g., "public.users") as the key
        const qualifiedName = table.qualified_name
        const tableSchema = table.table_schema
        const tableName = table.table_name

        const columnsQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position;
        `
        const columnsResult = await client.query(columnsQuery, [tableSchema, tableName])

        // Enhance columns with PK/FK info using qualified name
        schema.tables[qualifiedName] = columnsResult.rows.map((col: any): ColumnMetadata => {
          const isPrimaryKey = primaryKeys.get(qualifiedName)?.has(col.column_name) || false
          const foreignKey = foreignKeys.get(qualifiedName)?.find(fk => fk.column === col.column_name)

          return {
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            is_primary_key: isPrimaryKey,
            default_value: col.column_default,
            foreign_key: foreignKey ? {
              refTable: foreignKey.refTable,
              refColumn: foreignKey.refColumn,
            } : undefined,
          }
        })
      }

      return schema
    } finally {
      client.release()
    }
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name;
    `
    const result = await this.pool.query(query, [schema || 'public'])
    return result.rows.map(row => row.table_name)
  }

  async getTableMetadata(tableName: string, schema?: string): Promise<TableMetadata> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const client = await this.pool.connect()
    try {
      // Get columns
      const columnsQuery = `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `
      const columnsResult = await client.query(columnsQuery, [schema || 'public', tableName])

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`
      const countResult = await client.query(countQuery)
      const rowCount = parseInt(countResult.rows[0].count)

      const columns: ColumnMetadata[] = columnsResult.rows.map((col: any) => ({
        column_name: col.column_name,
        data_type: col.data_type,
        is_nullable: col.is_nullable,
        default_value: col.column_default,
        max_length: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale,
      }))

      return {
        table_name: tableName,
        table_schema: schema || 'public',
        columns,
        row_count: rowCount,
      }
    } finally {
      client.release()
    }
  }

  async getRelationships(schema?: string): Promise<RelationshipMetadata[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const query = `
      SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1;
    `

    const result = await this.pool.query(query, [schema || 'public'])

    return result.rows.map((row: any): RelationshipMetadata => ({
      from: row.from_table,
      fromCol: row.from_column,
      to: row.to_table,
      toCol: row.to_column,
      constraintName: row.constraint_name,
    }))
  }

  async sampleTable(tableName: string, limit: number = 5): Promise<any[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const query = `SELECT * FROM "${tableName}" LIMIT $1`
    const result = await this.pool.query(query, [limit])
    return result.rows
  }

  // ==================== QUERY EXECUTION ====================

  async executeQuery<T = any>(sql: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const client = await this.pool.connect()
    try {
      const startTime = Date.now()

      // Set timeout if specified
      if (options?.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout * 1000}`)
      }

      const result = await client.query(sql)
      const executionTime = Date.now() - startTime

      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
        executionTime,
      }
    } finally {
      // Reset timeout
      if (options?.timeout) {
        await client.query('RESET statement_timeout')
      }
      client.release()
    }
  }

  async executeWithTimeout<T = any>(sql: string, timeoutSeconds: number): Promise<QueryResult<T>> {
    return this.executeQuery<T>(sql, { timeout: timeoutSeconds })
  }

  async explainQuery(sql: string): Promise<any> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const explainSQL = `EXPLAIN (FORMAT JSON, ANALYZE false) ${sql}`
    const result = await this.pool.query(explainSQL)
    return result.rows[0]['QUERY PLAN']
  }

  // ==================== SQL GENERATION & VALIDATION ====================

  getSQLDialect(): string {
    return 'PostgreSQL'
  }

  async validateQuery(sql: string): Promise<QueryValidationResult> {
    const parser = new Parser()
    const errors: string[] = []
    const warnings: string[] = []
    let tables: string[] = []
    let columns: string[] = []
    let parsedAST: any = null

    try {
      parsedAST = parser.astify(sql, { database: 'PostgreSQL' })
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

  getTimeoutSQL(timeoutSeconds: number): string {
    return `SET statement_timeout = ${timeoutSeconds * 1000}`
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

      // Add JOIN examples with PostgreSQL syntax
      schemaText += `\n💡 PostgreSQL JOIN Examples:\n`
      const exampleCount = Math.min(3, relationships.length)
      const examples: string[] = []
      for (let i = 0; i < exampleCount; i++) {
        const rel = relationships[i]
        // Use PostgreSQL syntax: double quotes for identifiers, LIMIT, table aliases
        const example = `SELECT f.*, t.* FROM "${rel.from}" AS f INNER JOIN "${rel.to}" AS t ON f."${rel.fromCol}" = t."${rel.toCol}" LIMIT 100`
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
2. Use proper PostgreSQL syntax
3. Use the relationships shown above to write correct JOINs
4. Include LIMIT clause for safety (max 100 rows unless user specifies otherwise)
5. Return ONLY the SQL query, no explanations, no markdown formatting, no code blocks
6. Do not include semicolon at the end
7. When joining tables, ALWAYS use the foreign key relationships shown above
8. Use table aliases for clarity (e.g., u for users, o for orders)
9. If the query involves multiple tables, use explicit JOIN conditions based on the relationships

IMPORTANT JOIN INSTRUCTIONS:
- NEVER create joins without looking at the relationships section
- Use INNER JOIN for required relationships
- Use LEFT JOIN when the relationship is optional
- ALWAYS specify the ON condition explicitly`
  }

  getExampleQueries(): string[] {
    return [
      'SELECT * FROM users LIMIT 10',
      'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id',
      'SELECT * FROM products WHERE price > 100 ORDER BY price DESC LIMIT 20',
    ]
  }

  // ==================== ERROR HANDLING ====================

  mapError(error: any): DatabaseError {
    const pgError = error as any

    return new DatabaseError(
      pgError.message || 'Unknown database error',
      pgError.code,
      pgError.sqlState,
      pgError
    )
  }

  isConnectionError(error: any): boolean {
    const code = error.code
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '08000', '08003', '08006'].includes(code)
  }

  isTimeoutError(error: any): boolean {
    return error.code === '57014' || error.message?.includes('timeout')
  }

  isSyntaxError(error: any): boolean {
    return error.code === '42601' || error.code === '42P01'
  }

  // ==================== UTILITY METHODS ====================

  async getServerVersion(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const result = await this.pool.query('SELECT version()')
    return result.rows[0].version
  }

  async getCurrentDatabase(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const result = await this.pool.query('SELECT current_database()')
    return result.rows[0].current_database
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const query = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      )
    `
    const result = await this.pool.query(query, [schema || 'public', tableName])
    return result.rows[0].exists
  }

  async columnExists(tableName: string, columnName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const query = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      )
    `
    const result = await this.pool.query(query, [schema || 'public', tableName, columnName])
    return result.rows[0].exists
  }
}
