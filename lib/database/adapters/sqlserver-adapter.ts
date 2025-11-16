/**
 * SQL Server Database Adapter
 * Implements BaseDatabaseAdapter for Microsoft SQL Server databases
 */

import * as sql from 'mssql'
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

export class SQLServerAdapter extends BaseDatabaseAdapter {
  protected pool: sql.ConnectionPool | null = null

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

    const poolConfig: sql.config = {
      server: this.config.host || 'localhost',
      port: this.config.port || 1433,
      database: this.config.database,
      user: this.config.username,
      password: password,
      pool: {
        max: this.config.poolMax || 10,
        min: this.config.poolMin || 2,
        idleTimeoutMillis: this.config.idleTimeout || 30000,
      },
      connectionTimeout: this.config.connectionTimeout || 15000,
      requestTimeout: 30000,
      options: {
        encrypt: true, // SQL Server requires encryption by default
        trustServerCertificate: true, // For development; use proper certs in production
        enableArithAbort: true,
      },
    }

    this.pool = new sql.ConnectionPool(poolConfig)
    await this.pool.connect()
    this.isConnected = true
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.close()
      this.pool = null
      this.isConnected = false
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()
    let tempPool: sql.ConnectionPool | null = null

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

      const poolConfig: sql.config = {
        server: this.config.host || 'localhost',
        port: this.config.port || 1433,
        database: this.config.database,
        user: this.config.username,
        password: password,
        connectionTimeout: 5000,
        options: {
          encrypt: true, // SQL Server requires encryption by default
          trustServerCertificate: true,
          enableArithAbort: true,
        },
      }

      tempPool = new sql.ConnectionPool(poolConfig)
      await tempPool.connect()

      // Get server version
      const versionResult = await tempPool.request().query('SELECT @@VERSION as version')
      const serverVersion = versionResult.recordset[0].version

      // Get current database
      const dbResult = await tempPool.request().query('SELECT DB_NAME() as db')
      const database = dbResult.recordset[0].db

      const latency = Date.now() - startTime

      return {
        success: true,
        message: 'Connection successful',
        serverVersion,
        database,
        latency,
      }
    } catch (error: any) {
      return {
        success: false,
        error: this.mapError(error).message,
        latency: Date.now() - startTime,
      }
    } finally {
      if (tempPool) {
        await tempPool.close()
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
      totalConnections: this.pool.size,
      idleConnections: this.pool.available,
      activeConnections: this.pool.size - this.pool.available,
      waitingClients: this.pool.borrowed,
    }
  }

  // ==================== SCHEMA INTROSPECTION ====================

  async getSchema(options?: SchemaOptions): Promise<SchemaInfo> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    try {
      // Get all tables WITH schema names (e.g., "SalesLT.Product")
      // CRITICAL: SQL Server uses schemas to organize tables (SalesLT, dbo, HumanResources, etc.)
      const tablesResult = await this.pool.request().query(`
        SELECT
          TABLE_SCHEMA as table_schema,
          TABLE_NAME as table_name,
          TABLE_SCHEMA + '.' + TABLE_NAME as qualified_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `)
      const tables = tablesResult.recordset

      // Get primary keys WITH schema-qualified table names
      const primaryKeysResult = await this.pool.request().query(`
        SELECT
          tc.TABLE_SCHEMA + '.' + tc.TABLE_NAME as table_name,
          kcu.COLUMN_NAME as column_name
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          AND tc.TABLE_NAME = kcu.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_CATALOG = DB_NAME()
      `)
      const primaryKeysData = primaryKeysResult.recordset
      const primaryKeys = new Map<string, Set<string>>()

      for (const row of primaryKeysData) {
        if (!primaryKeys.has(row.table_name)) {
          primaryKeys.set(row.table_name, new Set())
        }
        primaryKeys.get(row.table_name)!.add(row.column_name)
      }

      // Get foreign keys WITH schema names (using SCHEMA_NAME function)
      const foreignKeysResult = await this.pool.request().query(`
        SELECT
          fk.name as constraint_name,
          SCHEMA_NAME(tp.schema_id) + '.' + tp.name as table_name,
          cp.name as column_name,
          SCHEMA_NAME(tr.schema_id) + '.' + tr.name as foreign_table_name,
          cr.name as foreign_column_name
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      `)
      const foreignKeysData = foreignKeysResult.recordset
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
          constraintName: row.constraint_name,
        })
      }

      // Get columns for each table
      const schema: SchemaInfo = {
        tables: {},
        relationships,
      }

      for (const table of tables) {
        // Use qualified name (e.g., "SalesLT.Product") as the key
        const qualifiedName = table.qualified_name
        const tableSchema = table.table_schema
        const tableName = table.table_name

        const columnsResult = await this.pool.request().query(`
          SELECT
            c.COLUMN_NAME as column_name,
            c.DATA_TYPE as data_type,
            c.IS_NULLABLE as is_nullable,
            c.COLUMN_DEFAULT as column_default,
            c.CHARACTER_MAXIMUM_LENGTH as max_length,
            c.NUMERIC_PRECISION as precision,
            c.NUMERIC_SCALE as scale,
            COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as is_identity
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_SCHEMA = '${tableSchema}' AND c.TABLE_NAME = '${tableName}' AND c.TABLE_CATALOG = DB_NAME()
          ORDER BY c.ORDINAL_POSITION
        `)
        const columnsData = columnsResult.recordset

        // Enhance columns with PK/FK info using qualified name
        schema.tables[qualifiedName] = columnsData.map((col: any): ColumnMetadata => {
          const isPrimaryKey = primaryKeys.get(qualifiedName)?.has(col.column_name) || false
          const foreignKey = foreignKeys.get(qualifiedName)?.find(fk => fk.column === col.column_name)

          return {
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            is_primary_key: isPrimaryKey,
            is_auto_increment: col.is_identity === 1,
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
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : ''
    const result = await this.pool.request().query(`
      SELECT TABLE_NAME as table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME() ${schemaFilter}
      ORDER BY TABLE_NAME
    `)
    return result.recordset.map((row: any) => row.table_name)
  }

  async getTableMetadata(tableName: string, schema?: string): Promise<TableMetadata> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    try {
      const schemaName = schema || 'dbo'

      // Get columns
      const columnsResult = await this.pool.request().query(`
        SELECT
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          CHARACTER_MAXIMUM_LENGTH as max_length,
          NUMERIC_PRECISION as precision,
          NUMERIC_SCALE as scale
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = '${schemaName}'
        ORDER BY ORDINAL_POSITION
      `)
      const columnsData = columnsResult.recordset

      // Get row count
      const countResult = await this.pool.request().query(`SELECT COUNT(*) as count FROM [${tableName}]`)
      const rowCount = countResult.recordset[0].count

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
        table_schema: schemaName,
        columns,
        row_count: rowCount,
      }
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async getRelationships(schema?: string): Promise<RelationshipMetadata[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const schemaFilter = schema ? `WHERE tp.schema_id = SCHEMA_ID('${schema}')` : ''
    const result = await this.pool.request().query(`
      SELECT
        fk.name as constraint_name,
        tp.name as from_table,
        cp.name as from_column,
        tr.name as to_table,
        cr.name as to_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      ${schemaFilter}
    `)

    return result.recordset.map((row: any): RelationshipMetadata => ({
      from: row.from_table,
      fromCol: row.from_column,
      to: row.to_table,
      toCol: row.to_column,
      constraintName: row.constraint_name,
    }))
  }

  async sampleTable(tableName: string, limit: number = 5): Promise<any[]> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const result = await this.pool.request().query(`SELECT TOP ${limit} * FROM [${tableName}]`)
    return result.recordset
  }

  // ==================== QUERY EXECUTION ====================

  async executeQuery<T = any>(sql: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    try {
      const startTime = Date.now()

      const request = this.pool.request()

      // Set timeout if specified (mssql doesn't support setting timeout on request directly)
      // Timeout is set at connection pool level in createPool()

      const result = await request.query(sql)
      const executionTime = Date.now() - startTime

      return {
        rows: result.recordset as T[],
        rowCount: result.recordset.length,
        executionTime,
      }
    } catch (error: any) {
      throw this.mapError(error)
    }
  }

  async executeWithTimeout<T = any>(sql: string, timeoutSeconds: number): Promise<QueryResult<T>> {
    return this.executeQuery<T>(sql, { timeout: timeoutSeconds })
  }

  async explainQuery(sql: string): Promise<any> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    // SQL Server uses SET SHOWPLAN_XML ON for query plans
    await this.pool.request().query('SET SHOWPLAN_XML ON')
    const result = await this.pool.request().query(sql)
    await this.pool.request().query('SET SHOWPLAN_XML OFF')

    return result.recordset[0]
  }

  // ==================== SQL GENERATION & VALIDATION ====================

  getSQLDialect(): string {
    return 'SQL Server'
  }

  async validateQuery(sql: string): Promise<QueryValidationResult> {
    const parser = new Parser()
    const errors: string[] = []
    const warnings: string[] = []
    let tables: string[] = []
    let columns: string[] = []
    let parsedAST: any = null

    try {
      parsedAST = parser.astify(sql, { database: 'TransactSQL' })
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
    // SQL Server uses TOP instead of LIMIT
    const topRegex = /SELECT\s+TOP\s+(\d+)/i
    const match = sql.trim().match(topRegex)

    if (match) {
      const existingLimit = parseInt(match[1])
      if (existingLimit <= maxRows) return sql
      return sql.replace(topRegex, `SELECT TOP ${maxRows}`)
    }

    // Add TOP clause after SELECT
    return sql.trim().replace(/^SELECT/i, `SELECT TOP ${maxRows}`)
  }

  getTimeoutSQL(timeoutSeconds: number): string | null {
    // SQL Server doesn't use SQL-level timeout configuration
    // Timeouts are set on the request object
    return null
  }

  // ==================== LLM INTEGRATION ====================

  formatSchemaForPrompt(schema: SchemaInfo): PromptContext {
    let schemaText = ''

    // Helper function to convert "Schema.Table" to "[Schema].[Table]"
    const bracketQualify = (qualifiedName: string): string => {
      if (qualifiedName.includes('.')) {
        const parts = qualifiedName.split('.')
        return parts.map(p => `[${p}]`).join('.')
      }
      return `[${qualifiedName}]`
    }

    // Format tables with enhanced column info
    for (const [tableName, columns] of Object.entries(schema.tables)) {
      // Display with bracket notation: [SalesLT].[Product]
      const bracketedName = bracketQualify(tableName)
      schemaText += `\n📋 Table: ${bracketedName}\n`
      schemaText += `Columns:\n`
      for (const col of columns) {
        let colInfo = `  - ${col.column_name} (${col.data_type})`

        if (col.is_primary_key) colInfo += ' PRIMARY KEY'
        if (col.is_auto_increment) colInfo += ' IDENTITY'
        if (col.is_nullable === 'NO') colInfo += ' NOT NULL'

        if (col.foreign_key) {
          const refTableBracketed = bracketQualify(col.foreign_key.refTable)
          colInfo += ` → REFERENCES ${refTableBracketed}(${col.foreign_key.refColumn})`
        }

        schemaText += colInfo + '\n'
      }
    }

    // Format relationships section
    const relationships = schema.relationships || []
    if (relationships.length > 0) {
      schemaText += `\n🔗 Relationships (for JOINs):\n`
      for (const rel of relationships) {
        const fromBracketed = bracketQualify(rel.from)
        const toBracketed = bracketQualify(rel.to)
        schemaText += `  ${fromBracketed}.${rel.fromCol} → ${toBracketed}.${rel.toCol}\n`
      }

      // Add JOIN examples with T-SQL syntax and schema qualification
      schemaText += `\n💡 T-SQL JOIN Examples (with schema qualification):\n`
      const exampleCount = Math.min(3, relationships.length)
      const examples: string[] = []
      for (let i = 0; i < exampleCount; i++) {
        const rel = relationships[i]
        const fromBracketed = bracketQualify(rel.from)
        const toBracketed = bracketQualify(rel.to)
        // Use T-SQL syntax: TOP, square brackets with schema.table, table aliases
        const example = `SELECT TOP 100 f.*, t.* FROM ${fromBracketed} AS f INNER JOIN ${toBracketed} AS t ON f.[${rel.fromCol}] = t.[${rel.toCol}]`
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
2. Use proper SQL Server (T-SQL) syntax
3. ALWAYS use schema-qualified table names: [Schema].[Table] (e.g., [SalesLT].[Product])
4. Use square brackets for ALL identifiers: [Schema].[Table], [column_name]
5. Use the relationships shown above to write correct JOINs
6. Use TOP clause instead of LIMIT (e.g., SELECT TOP 100 *)
7. Return ONLY the SQL query, no explanations, no markdown formatting, no code blocks
8. Do not include semicolon at the end
9. When joining tables, ALWAYS use the foreign key relationships shown above
10. Use table aliases for clarity (e.g., p for products, c for categories)
11. If the query involves multiple tables, use explicit JOIN conditions based on the relationships

⚠️ SCHEMA QUALIFICATION - ABSOLUTELY CRITICAL:
- SQL Server tables MUST be qualified with schema names
- ALWAYS use [Schema].[Table] format (e.g., [SalesLT].[Product])
- NEVER use bare table names (Product ❌, [SalesLT].[Product] ✅)
- Common schemas: SalesLT, dbo, HumanResources, Production, Purchasing
- If you see a table like "SalesLT.Product" in the schema, use [SalesLT].[Product]

IMPORTANT JOIN INSTRUCTIONS:
- NEVER create joins without looking at the relationships section
- Use INNER JOIN for required relationships
- Use LEFT JOIN when the relationship is optional
- ALWAYS specify the ON condition explicitly
- ALWAYS use schema-qualified names in JOIN clauses

SQL SERVER (T-SQL) SYNTAX - CRITICAL:
- Use square brackets for identifiers: [Schema].[Table], [column_name]
- Use TOP instead of LIMIT: SELECT TOP 100 * (NOT LIMIT 100)
- Use IDENTITY instead of AUTO_INCREMENT
- String concatenation: Use CONCAT() or + operator

DATE/TIME FUNCTIONS (T-SQL):
- Current timestamp: GETDATE() or SYSDATETIME() (NOT NOW() or CURRENT_TIMESTAMP)
- Extract date parts: DATEPART(year, date) or YEAR(date), MONTH(date), DAY(date) (NOT EXTRACT())
- Date arithmetic: DATEADD(day, 7, GETDATE()) (NOT date + INTERVAL)
- Date difference: DATEDIFF(day, start_date, end_date)
- Format dates: FORMAT(date, 'yyyy-MM-dd') or CONVERT(VARCHAR, date, 120)

STRING FUNCTIONS:
- Length: LEN(string) (NOT LENGTH())
- Substring: SUBSTRING(string, start, length) (same as PostgreSQL)
- Concatenation: CONCAT(str1, str2) or str1 + str2
- Case conversion: LOWER(), UPPER()
- Find position: CHARINDEX('search', string) (NOT POSITION() or INSTR())

AGGREGATES & WINDOW FUNCTIONS:
- Same as PostgreSQL: COUNT(), SUM(), AVG(), MIN(), MAX()
- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK() OVER (PARTITION BY ... ORDER BY ...)

IMPORTANT: DO NOT use PostgreSQL-specific functions like EXTRACT(), NOW(), or PostgreSQL date arithmetic`
  }

  getExampleQueries(): string[] {
    return [
      'SELECT TOP 10 * FROM [dbo].[users]',
      'SELECT u.name, o.total FROM [dbo].[users] u JOIN [dbo].[orders] o ON u.id = o.user_id',
      'SELECT TOP 20 * FROM [SalesLT].[Product] WHERE ListPrice > 100 ORDER BY ListPrice DESC',
      'SELECT COUNT(*) as total, [Status] FROM [dbo].[orders] GROUP BY [Status]',
      'SELECT TOP 100 * FROM [dbo].[orders] WHERE created_at > DATEADD(day, -30, GETDATE())',
      'SELECT YEAR(created_at) as year, COUNT(*) as count FROM [dbo].[orders] GROUP BY YEAR(created_at)',
      'SELECT * FROM [dbo].[users] WHERE DATEDIFF(day, last_login, GETDATE()) > 7',
      'SELECT p.*, c.Name as CategoryName FROM [SalesLT].[Product] p JOIN [SalesLT].[ProductCategory] c ON p.ProductCategoryID = c.ProductCategoryID',
    ]
  }

  // ==================== ERROR HANDLING ====================

  mapError(error: any): DatabaseError {
    const mssqlError = error as any

    return new DatabaseError(
      mssqlError.message || 'Unknown database error',
      mssqlError.code,
      mssqlError.state,
      mssqlError
    )
  }

  isConnectionError(error: any): boolean {
    const code = error.code
    return [
      'ESOCKET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ELOGIN',
      'ECONNCLOSED',
    ].includes(code)
  }

  isTimeoutError(error: any): boolean {
    return error.code === 'ETIMEOUT' || error.message?.includes('timeout')
  }

  isSyntaxError(error: any): boolean {
    // SQL Server syntax error codes
    return error.number === 102 || error.number === 156 || error.number === 207
  }

  // ==================== UTILITY METHODS ====================

  async getServerVersion(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const result = await this.pool.request().query('SELECT @@VERSION as version')
    return result.recordset[0].version
  }

  async getCurrentDatabase(): Promise<string> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const result = await this.pool.request().query('SELECT DB_NAME() as db')
    return result.recordset[0].db
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const schemaName = schema || 'dbo'
    const result = await this.pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = '${schemaName}'
    `)
    return result.recordset[0].count > 0
  }

  async columnExists(tableName: string, columnName: string, schema?: string): Promise<boolean> {
    if (!this.pool) throw new DatabaseError('Pool not initialized')

    const schemaName = schema || 'dbo'
    const result = await this.pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}' AND TABLE_SCHEMA = '${schemaName}'
    `)
    return result.recordset[0].count > 0
  }
}
