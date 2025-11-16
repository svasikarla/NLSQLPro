/**
 * Query safety utilities
 * Enforces timeouts, row limits, and query complexity checks
 */

import { Parser } from 'node-sql-parser'

interface QuerySafetyConfig {
  maxRows: number          // Maximum rows to return (default: 1000)
  timeoutSeconds: number   // Query timeout in seconds (default: 30)
  maxJoins: number        // Maximum number of JOINs (default: 10)
  maxSubqueries: number   // Maximum nested subqueries (default: 3)
}

const DEFAULT_CONFIG: QuerySafetyConfig = {
  maxRows: 1000,
  timeoutSeconds: 30,
  maxJoins: 10,
  maxSubqueries: 3,
}

/**
 * Enforce row limit on SQL query
 * Adds or modifies LIMIT/TOP clause based on database type
 */
export function enforceRowLimit(
  sql: string,
  maxRows: number = DEFAULT_CONFIG.maxRows,
  dbType: string = 'postgresql'
): string {
  const trimmed = sql.trim()
  const upperSQL = trimmed.toUpperCase()

  // SQL Server uses TOP syntax
  if (dbType.toLowerCase() === 'sqlserver') {
    // Check if query already has TOP
    const topRegex = /SELECT\s+TOP\s+(\d+)/i
    const match = trimmed.match(topRegex)

    if (match) {
      const existingLimit = parseInt(match[1])
      if (existingLimit <= maxRows) return sql
      return trimmed.replace(topRegex, `SELECT TOP ${maxRows}`)
    }

    // Add TOP after SELECT
    return trimmed.replace(/^SELECT/i, `SELECT TOP ${maxRows}`)
  }

  // PostgreSQL, MySQL, SQLite use LIMIT syntax
  // Check if query already has a LIMIT clause
  const limitRegex = /LIMIT\s+(\d+)(\s+OFFSET\s+\d+)?$/i
  const match = trimmed.match(limitRegex)

  if (match) {
    const existingLimit = parseInt(match[1])

    // If existing limit is within our max, keep it
    if (existingLimit <= maxRows) {
      return sql
    }

    // Otherwise, replace with our max limit
    return trimmed.replace(limitRegex, `LIMIT ${maxRows}`)
  }

  // No LIMIT clause found, add one
  // Remove trailing semicolon if present
  const withoutSemicolon = trimmed.replace(/;+$/, '')
  return `${withoutSemicolon} LIMIT ${maxRows}`
}

/**
 * Generate database-specific timeout SQL
 * Different databases have different timeout syntax
 */
export function getTimeoutSQL(dbType: string, timeoutSeconds: number = DEFAULT_CONFIG.timeoutSeconds): string {
  switch (dbType.toLowerCase()) {
    case 'postgresql':
      return `SET statement_timeout = '${timeoutSeconds}s'`

    case 'mysql':
      // MySQL uses milliseconds
      return `SET SESSION max_execution_time = ${timeoutSeconds * 1000}`

    case 'sqlserver':
      // SQL Server uses SET QUERY_TIMEOUT (in seconds)
      return `SET QUERY_TIMEOUT ${timeoutSeconds}`

    case 'sqlite':
      // SQLite doesn't have statement-level timeout
      // Timeout is handled at driver level
      return ''

    default:
      return ''
  }
}

/**
 * Calculate query complexity score
 * Higher score = more complex/expensive query
 */
export function calculateQueryComplexity(sql: string): {
  score: number
  warnings: string[]
  details: {
    joins: number
    subqueries: number
    aggregations: number
    hasWildcard: boolean
  }
} {
  const warnings: string[] = []
  const details = {
    joins: 0,
    subqueries: 0,
    aggregations: 0,
    hasWildcard: false,
  }

  const upperSQL = sql.toUpperCase()

  // Count JOINs
  const joinMatches = upperSQL.match(/\bJOIN\b/g)
  details.joins = joinMatches ? joinMatches.length : 0

  if (details.joins > DEFAULT_CONFIG.maxJoins) {
    warnings.push(`Query has ${details.joins} JOINs (max recommended: ${DEFAULT_CONFIG.maxJoins})`)
  }

  // Count subqueries (parentheses with SELECT)
  const subqueryMatches = upperSQL.match(/\(\s*SELECT\b/g)
  details.subqueries = subqueryMatches ? subqueryMatches.length : 0

  if (details.subqueries > DEFAULT_CONFIG.maxSubqueries) {
    warnings.push(`Query has ${details.subqueries} subqueries (max recommended: ${DEFAULT_CONFIG.maxSubqueries})`)
  }

  // Count aggregations
  const aggregationFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP BY']
  details.aggregations = aggregationFunctions.filter(func => upperSQL.includes(func)).length

  // Check for SELECT *
  if (upperSQL.match(/SELECT\s+\*/)) {
    details.hasWildcard = true
    warnings.push('Query uses SELECT * which may return unnecessary columns')
  }

  // Calculate complexity score
  let score = 0
  score += details.joins * 2         // Each JOIN adds 2 points
  score += details.subqueries * 5    // Each subquery adds 5 points
  score += details.aggregations * 1  // Each aggregation adds 1 point
  score += details.hasWildcard ? 1 : 0

  // Check for cartesian products (JOIN without ON clause)
  if (details.joins > 0) {
    const onClauses = (upperSQL.match(/\bON\b/g) || []).length
    if (onClauses < details.joins) {
      warnings.push('⚠️ CRITICAL: Possible cartesian product (JOIN without ON clause)')
      score += 50 // Massive penalty
    }
  }

  return { score, warnings, details }
}

/**
 * Validate SQL for safety
 * Returns validation result with recommendations
 */
export function validateQuerySafety(
  sql: string,
  dbType: string = 'postgresql',
  config: Partial<QuerySafetyConfig> = {}
): {
  safe: boolean
  errors: string[]
  warnings: string[]
  complexity: number
  recommendedTimeout: number
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const errors: string[] = []
  let { warnings, score: complexity } = calculateQueryComplexity(sql)

  const trimmed = sql.trim().toLowerCase()

  // Check 1: Must start with SELECT
  if (!trimmed.startsWith('select')) {
    errors.push('Only SELECT queries are allowed')
  }

  // Check 2: Dangerous keywords
  const dangerousKeywords = [
    'drop', 'delete', 'truncate', 'insert', 'update',
    'alter', 'create', 'grant', 'revoke', 'exec', 'execute'
  ]

  for (const keyword of dangerousKeywords) {
    if (trimmed.includes(keyword)) {
      errors.push(`Dangerous keyword detected: ${keyword.toUpperCase()}`)
    }
  }

  // Check 3: Database-specific dangerous functions
  const dangerousFunctions: Record<string, string[]> = {
    postgresql: ['pg_sleep', 'pg_read_file', 'pg_ls_dir', 'copy'],
    mysql: ['load_file', 'into outfile', 'into dumpfile', 'load data'],
    sqlserver: ['xp_cmdshell', 'sp_configure', 'openrowset'],
  }

  const dbDangerousFuncs = dangerousFunctions[dbType.toLowerCase()] || []
  for (const func of dbDangerousFuncs) {
    if (trimmed.includes(func.toLowerCase())) {
      errors.push(`Dangerous function detected: ${func}`)
    }
  }

  // Recommend timeout based on complexity
  let recommendedTimeout = finalConfig.timeoutSeconds
  if (complexity > 20) {
    recommendedTimeout = 60 // 1 minute for complex queries
    warnings.push('Complex query detected. Extended timeout recommended.')
  } else if (complexity > 10) {
    recommendedTimeout = 45 // 45 seconds
  }

  return {
    safe: errors.length === 0,
    errors,
    warnings,
    complexity,
    recommendedTimeout,
  }
}

/**
 * Apply all safety measures to a SQL query
 * Returns the safe version of the query
 */
export function makeSafeQuery(
  sql: string,
  dbType: string = 'postgresql',
  config: Partial<QuerySafetyConfig> = {}
): {
  sql: string
  timeoutSQL: string
  validation: ReturnType<typeof validateQuerySafety>
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Validate first
  const validation = validateQuerySafety(sql, dbType, finalConfig)

  if (!validation.safe) {
    throw new Error(`Query safety validation failed: ${validation.errors.join(', ')}`)
  }

  // Apply row limit (database-specific syntax)
  const safeSql = enforceRowLimit(sql, finalConfig.maxRows, dbType)

  // Get timeout SQL
  const timeoutSQL = getTimeoutSQL(dbType, validation.recommendedTimeout)

  return {
    sql: safeSql,
    timeoutSQL,
    validation,
  }
}
