/**
 * SQL Parser Integration
 *
 * Replaces brittle regex-based SQL parsing with proper AST analysis.
 * Uses node-sql-parser for accurate SQL query introspection.
 *
 * Benefits over regex:
 * - Handles multi-line queries, comments, complex nesting
 * - Extracts actual column names, not just patterns
 * - Detects JOIN types, subqueries, CTEs
 * - Validates SQL syntax
 */

import { Parser, AST, Select } from 'node-sql-parser'

export interface ParsedSQLQuery {
  isValid: boolean
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN'
  columns: string[]
  tables: string[]
  hasGroupBy: boolean
  hasOrderBy: boolean
  hasJoin: boolean
  hasAggregation: boolean
  hasWhere: boolean
  hasLimit: boolean
  hasSubquery: boolean
  hasCTE: boolean // Common Table Expressions (WITH clause)

  // Detailed analysis
  joinTypes: string[] // INNER, LEFT, RIGHT, FULL, CROSS
  aggregateFunctions: string[] // COUNT, SUM, AVG, MAX, MIN, etc.
  orderByColumns: string[]
  groupByColumns: string[]
  isTimeSeriesOrdered: boolean
  primaryTable?: string // The main table being queried

  // Raw AST for advanced use cases
  ast?: AST | AST[]

  // Error handling
  parseError?: string
}

/**
 * Parse SQL query and extract features
 */
export function parseSQL(sql: string): ParsedSQLQuery {
  const parser = new Parser()

  const defaultResult: ParsedSQLQuery = {
    isValid: false,
    type: 'UNKNOWN',
    columns: [],
    tables: [],
    hasGroupBy: false,
    hasOrderBy: false,
    hasJoin: false,
    hasAggregation: false,
    hasWhere: false,
    hasLimit: false,
    hasSubquery: false,
    hasCTE: false,
    joinTypes: [],
    aggregateFunctions: [],
    orderByColumns: [],
    groupByColumns: [],
    isTimeSeriesOrdered: false,
    primaryTable: undefined
  }

  try {
    // Parse SQL (supports MySQL, PostgreSQL, SQLite, MariaDB dialects)
    const ast = parser.astify(sql, { database: 'PostgreSQL' }) as AST | AST[]

    // Handle array of statements (take first one)
    const statement = Array.isArray(ast) ? ast[0] : ast

    if (!statement || statement.type !== 'select') {
      return {
        ...defaultResult,
        isValid: true,
        type: statement?.type?.toUpperCase() as any || 'UNKNOWN',
        ast: statement,
        parseError: 'Only SELECT queries are supported for visualization'
      }
    }

    const selectStmt = statement as Select

    // Extract columns
    const columns = extractColumns(selectStmt)

    // Extract tables
    const tables = extractTables(selectStmt)

    // Detect aggregation functions
    const aggregateFunctions = detectAggregateFunctions(selectStmt)

    // Detect JOINs
    const { hasJoin, joinTypes } = detectJoins(selectStmt)

    // Extract GROUP BY columns
    const groupByColumns = extractGroupByColumns(selectStmt)

    // Extract ORDER BY columns
    const orderByColumns = extractOrderByColumns(selectStmt)

    // Check if ordered by time column
    const isTimeSeriesOrdered = checkTimeSeriesOrdering(orderByColumns)

    // Check for subqueries and CTEs
    const hasSubquery = detectSubqueries(selectStmt)
    const hasCTE = !!selectStmt.with && selectStmt.with.length > 0

    // Determine primary table (first table in FROM clause)
    let primaryTable: string | undefined = undefined
    if (tables.length > 0) {
      primaryTable = tables[0]
    }

    return {
      isValid: true,
      type: 'SELECT',
      columns,
      tables,
      hasGroupBy: groupByColumns.length > 0,
      hasOrderBy: orderByColumns.length > 0,
      hasJoin,
      hasAggregation: aggregateFunctions.length > 0,
      hasWhere: !!selectStmt.where,
      hasLimit: !!selectStmt.limit,
      hasSubquery,
      hasCTE,
      joinTypes,
      aggregateFunctions,
      orderByColumns,
      groupByColumns,
      isTimeSeriesOrdered,
      primaryTable,
      ast: statement
    }
  } catch (error: any) {
    console.error('[SQL Parser] Parse error:', error)
    return {
      ...defaultResult,
      parseError: error.message || 'Failed to parse SQL query'
    }
  }
}

/**
 * Extract column names from SELECT statement
 */
function extractColumns(selectStmt: Select): string[] {
  const columns: string[] = []

  if (!selectStmt.columns || (selectStmt.columns as any) === '*') {
    return ['*']
  }

  if (Array.isArray(selectStmt.columns)) {
    for (const col of selectStmt.columns) {
      if (col.expr.type === 'column_ref') {
        const columnName = col.as || (col.expr.column === '*' ? '*' : col.expr.column)
        if (columnName) columns.push(columnName as string)
      } else if (col.expr.type === 'aggr_func') {
        const columnName = col.as || `${col.expr.name}(...)`
        columns.push(columnName as string)
      } else if (col.as) {
        columns.push(col.as)
      }
    }
  }

  return columns
}

/**
 * Extract table names from FROM and JOIN clauses
 */
function extractTables(selectStmt: Select): string[] {
  const tables: string[] = []

  if (selectStmt.from && Array.isArray(selectStmt.from)) {
    for (const fromItem of selectStmt.from) {
      if ((fromItem as any).table) {
        tables.push((fromItem as any).as || (fromItem as any).table)
      }
    }
  }

  return tables
}

/**
 * Detect aggregate functions in SELECT columns
 */
function detectAggregateFunctions(selectStmt: Select): string[] {
  const functions: string[] = []
  const seen = new Set<string>()

  if (!selectStmt.columns || (selectStmt.columns as any) === '*') {
    return []
  }

  if (Array.isArray(selectStmt.columns)) {
    for (const col of selectStmt.columns) {
      if (col.expr.type === 'aggr_func') {
        const funcName = col.expr.name.toUpperCase()
        if (!seen.has(funcName)) {
          functions.push(funcName)
          seen.add(funcName)
        }
      }
    }
  }

  return functions
}

/**
 * Detect JOIN clauses and types
 */
function detectJoins(selectStmt: Select): { hasJoin: boolean; joinTypes: string[] } {
  const joinTypes: string[] = []

  if (selectStmt.from && Array.isArray(selectStmt.from) && selectStmt.from.length > 0) {
    for (const fromItem of selectStmt.from) {
      if ((fromItem as any).join) {
        const joinType = ((fromItem as any).join as string).toUpperCase()
        if (!joinTypes.includes(joinType)) {
          joinTypes.push(joinType)
        }
      }
    }
  }

  return {
    hasJoin: joinTypes.length > 0,
    joinTypes
  }
}

/**
 * Extract GROUP BY column names
 */
function extractGroupByColumns(selectStmt: Select): string[] {
  const columns: string[] = []

  if (selectStmt.groupby && Array.isArray(selectStmt.groupby)) {
    for (const groupItem of selectStmt.groupby) {
      if ((groupItem as any).type === 'column_ref') {
        columns.push((groupItem as any).column as string)
      }
    }
  }

  return columns
}

/**
 * Extract ORDER BY column names
 */
function extractOrderByColumns(selectStmt: Select): string[] {
  const columns: string[] = []

  if (selectStmt.orderby) {
    for (const orderItem of selectStmt.orderby) {
      if (orderItem.expr.type === 'column_ref') {
        columns.push(orderItem.expr.column as string)
      }
    }
  }

  return columns
}

/**
 * Check if query is ordered by a temporal column
 */
function checkTimeSeriesOrdering(orderByColumns: string[]): boolean {
  if (orderByColumns.length === 0) return false

  // Check first ORDER BY column for temporal patterns
  const firstColumn = orderByColumns[0].toLowerCase()

  const temporalPatterns = [
    'date', 'time', 'timestamp', 'created', 'updated',
    'year', 'month', 'day', 'hour', 'minute', 'at',
    'when', 'period', 'interval'
  ]

  return temporalPatterns.some(pattern => firstColumn.includes(pattern))
}

/**
 * Detect subqueries in FROM, WHERE, or SELECT clauses
 */
function detectSubqueries(selectStmt: Select): boolean {
  // Check FROM clause for subqueries
  if (selectStmt.from && Array.isArray(selectStmt.from)) {
    for (const fromItem of selectStmt.from) {
      if ((fromItem as any).expr && (fromItem as any).expr.type === 'select') {
        return true
      }
    }
  }

  // Check WHERE clause (simplified - node-sql-parser provides complex nested structure)
  // Full implementation would recursively search WHERE AST

  return false
}

/**
 * Convert ParsedSQLQuery to legacy SQLFeatures format
 * For backward compatibility with existing code
 */
export function toLegacySQLFeatures(parsed: ParsedSQLQuery): {
  hasGroupBy: boolean
  hasAggregation: boolean
  hasOrderBy: boolean
  hasJoin: boolean
  hasLimit: boolean
  aggregateFunctions: string[]
  isTimeSeriesOrdered: boolean
} {
  return {
    hasGroupBy: parsed.hasGroupBy,
    hasAggregation: parsed.hasAggregation,
    hasOrderBy: parsed.hasOrderBy,
    hasJoin: parsed.hasJoin,
    hasLimit: parsed.hasLimit,
    aggregateFunctions: parsed.aggregateFunctions,
    isTimeSeriesOrdered: parsed.isTimeSeriesOrdered
  }
}

/**
 * Validate SQL query for visualization
 * Returns issues if query is not suitable for charting
 */
export function validateForVisualization(parsed: ParsedSQLQuery): {
  isValid: boolean
  issues: string[]
  warnings: string[]
} {
  const issues: string[] = []
  const warnings: string[] = []

  if (!parsed.isValid) {
    issues.push(parsed.parseError || 'Invalid SQL syntax')
    return { isValid: false, issues, warnings }
  }

  if (parsed.type !== 'SELECT') {
    issues.push('Only SELECT queries can be visualized')
    return { isValid: false, issues, warnings }
  }

  if (parsed.columns.length === 0 || (parsed.columns.length === 1 && parsed.columns[0] === '*')) {
    warnings.push('SELECT * returns all columns - consider selecting specific columns for better charts')
  }

  if (parsed.hasSubquery) {
    warnings.push('Subqueries detected - chart may be complex')
  }

  if (parsed.hasCTE) {
    warnings.push('Common Table Expressions (CTEs) detected - ensure final SELECT is suitable for charting')
  }

  if (!parsed.hasLimit && !parsed.hasGroupBy) {
    warnings.push('No LIMIT clause - large result sets may slow down chart rendering')
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings
  }
}
