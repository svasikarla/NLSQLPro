/**
 * SQL Validation using node-sql-parser
 * Validates syntax, checks for invalid tables/columns, detects dangerous patterns
 */

import { Parser } from 'node-sql-parser'
import type { SchemaInfo } from '@/lib/database/types/schema'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  parsedAST?: any
  tables: string[]
  columns: string[]
}

// Re-export SchemaInfo for backward compatibility
export type { SchemaInfo }

/**
 * Validate SQL syntax and structure
 */
export function validateSQL(sql: string, dbType: string = 'postgresql'): ValidationResult {
  const parser = new Parser()
  const errors: string[] = []
  const warnings: string[] = []
  let parsedAST: any = null
  let tables: string[] = []
  let columns: string[] = []

  try {
    // Parse SQL - map dbType to node-sql-parser database names
    const parserDatabaseMap: Record<string, string> = {
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'sqlserver': 'TransactSQL',  // SQL Server support
      'sqlite': 'SQLite',
    }

    const parserDatabase = parserDatabaseMap[dbType.toLowerCase()] || 'PostgreSQL'
    const opt = { database: parserDatabase }
    parsedAST = parser.astify(sql, opt)

    // Convert to array if single statement
    const statements = Array.isArray(parsedAST) ? parsedAST : [parsedAST]

    for (const ast of statements) {
      // Validate: Only SELECT statements
      if (ast.type !== 'select') {
        errors.push(`Only SELECT queries allowed (found: ${ast.type})`)
        continue
      }

      // Extract tables
      if (ast.from) {
        for (const from of ast.from) {
          if (from.table) {
            tables.push(from.table)
          }
          // Handle joins
          if (from.join) {
            if (from.join.table) tables.push(from.join.table)
          }
        }
      }

      // Extract columns
      if (ast.columns) {
        for (const col of ast.columns) {
          if (col.expr && col.expr.column) {
            columns.push(col.expr.column)
          }
        }
      }

      // Check for dangerous patterns
      if (hasCartesianProduct(ast)) {
        warnings.push('⚠️ Potential cartesian product detected (JOIN without ON clause)')
      }

      if (hasSelectStar(ast)) {
        warnings.push('Query uses SELECT * - consider specifying columns for better performance')
      }

      // Check subquery depth
      const subqueryDepth = calculateSubqueryDepth(ast)
      if (subqueryDepth > 3) {
        warnings.push(`Query has ${subqueryDepth} nested subqueries (recommend max 3)`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsedAST,
      tables,
      columns,
    }
  } catch (error: any) {
    // Parse error
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

/**
 * Validate SQL against database schema
 * Checks if referenced tables and columns actually exist
 */
export function validateAgainstSchema(
  validation: ValidationResult,
  schema: SchemaInfo
): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!validation.valid) {
    return { valid: false, errors: validation.errors, warnings: validation.warnings }
  }

  // Check tables exist
  for (const table of validation.tables) {
    if (!schema.tables[table]) {
      errors.push(`Table "${table}" does not exist in schema`)
    }
  }

  // Check columns exist (basic check - would need more context for proper validation)
  // This is simplified - in reality, we'd need to know which table each column belongs to
  if (validation.columns.length > 0 && validation.columns[0] !== '*') {
    for (const col of validation.columns) {
      let found = false
      for (const [tableName, columns] of Object.entries(schema.tables)) {
        if (columns.some(c => c.column_name === col)) {
          found = true
          break
        }
      }
      if (!found && col !== '*') {
        warnings.push(`Column "${col}" might not exist (unable to verify without table context)`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...validation.errors, ...errors],
    warnings: [...validation.warnings, ...warnings],
  }
}

/**
 * Check if query has cartesian product (JOIN without ON)
 */
function hasCartesianProduct(ast: any): boolean {
  if (!ast.from || ast.from.length === 0) return false

  for (const from of ast.from) {
    if (from.join && from.join.length > 0) {
      for (const join of from.join) {
        // If join exists but no ON clause, it's a cartesian product
        if (!join.on) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if query uses SELECT *
 */
function hasSelectStar(ast: any): boolean {
  if (!ast.columns) return false

  return ast.columns.some((col: any) => col.expr && col.expr.column === '*')
}

/**
 * Calculate nested subquery depth
 */
function calculateSubqueryDepth(ast: any, depth: number = 0): number {
  let maxDepth = depth

  // Check FROM clause for subqueries
  if (ast.from) {
    for (const from of ast.from) {
      if (from.expr && from.expr.type === 'select') {
        maxDepth = Math.max(maxDepth, calculateSubqueryDepth(from.expr, depth + 1))
      }
    }
  }

  // Check WHERE clause for subqueries
  if (ast.where) {
    maxDepth = Math.max(maxDepth, findSubqueriesInExpression(ast.where, depth))
  }

  return maxDepth
}

/**
 * Find subqueries in expression (WHERE, HAVING, etc.)
 */
function findSubqueriesInExpression(expr: any, depth: number): number {
  let maxDepth = depth

  if (!expr) return maxDepth

  if (expr.type === 'select') {
    return calculateSubqueryDepth(expr, depth + 1)
  }

  // Recursively check left and right
  if (expr.left) {
    maxDepth = Math.max(maxDepth, findSubqueriesInExpression(expr.left, depth))
  }
  if (expr.right) {
    maxDepth = Math.max(maxDepth, findSubqueriesInExpression(expr.right, depth))
  }

  return maxDepth
}

/**
 * Dry-run validation
 * Executes query with LIMIT 0 to test structure without returning data
 */
export async function dryRunValidation(
  sql: string,
  executeQuery: (sql: string) => Promise<any>
): Promise<{
  valid: boolean
  error?: string
}> {
  try {
    // Inject LIMIT 0 to test query structure
    let testSQL = sql.trim()

    // Remove existing LIMIT if present
    testSQL = testSQL.replace(/LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '')

    // Add LIMIT 0
    testSQL = `${testSQL} LIMIT 0`

    await executeQuery(testSQL)
    return { valid: true }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Dry-run validation failed',
    }
  }
}
