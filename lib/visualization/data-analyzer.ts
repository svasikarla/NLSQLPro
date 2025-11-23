/**
 * Data Analysis Utilities
 * Analyzes query results to detect column types, statistics, and patterns
 */

import { FieldInfo } from '@/lib/database/types/database'

export type ColumnType = 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'text' | 'unknown'

export interface ColumnMetadata {
  name: string
  type: ColumnType
  distinctCount: number
  nullCount: number
  min?: number | Date
  max?: number | Date
  avgLength?: number // For text columns
  sampleValues?: any[]
}

export interface DataStatistics {
  totalRows: number
  totalColumns: number
  numericColumns: ColumnMetadata[]
  categoricalColumns: ColumnMetadata[]
  temporalColumns: ColumnMetadata[]
  booleanColumns: ColumnMetadata[]
  textColumns: ColumnMetadata[]
}

export interface SQLFeatures {
  hasGroupBy: boolean
  hasAggregation: boolean
  hasOrderBy: boolean
  hasJoin: boolean
  hasLimit: boolean
  aggregateFunctions: string[]
  isTimeSeriesOrdered: boolean
}

/**
 * Analyzes query results and returns comprehensive metadata
 */
export function analyzeQueryResults(
  results: any[],
  sql?: string,
  fields?: FieldInfo[]
): DataStatistics {
  if (!results || results.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      numericColumns: [],
      categoricalColumns: [],
      temporalColumns: [],
      booleanColumns: [],
      textColumns: [],
    }
  }

  const columns = Object.keys(results[0])
  const columnMetadata = columns.map((col) =>
    detectColumnType(col, results, fields)
  )

  // Categorize columns by type
  const numericColumns = columnMetadata.filter((c) => c.type === 'numeric')
  const categoricalColumns = columnMetadata.filter((c) => c.type === 'categorical')
  const temporalColumns = columnMetadata.filter((c) => c.type === 'temporal')
  const booleanColumns = columnMetadata.filter((c) => c.type === 'boolean')
  const textColumns = columnMetadata.filter((c) => c.type === 'text')

  return {
    totalRows: results.length,
    totalColumns: columns.length,
    numericColumns,
    categoricalColumns,
    temporalColumns,
    booleanColumns,
    textColumns,
  }
}

/**
 * Detects the type of a column based on its values and database metadata
 */
export function detectColumnType(
  columnName: string,
  results: any[],
  fields?: FieldInfo[]
): ColumnMetadata {
  const fieldInfo = fields?.find((f) => f.name === columnName)
  const values = results.map((row) => row[columnName])
  const nonNullValues = values.filter((v) => v !== null && v !== undefined)
  const nullCount = results.length - nonNullValues.length

  // Use database metadata if available
  if (fieldInfo) {
    const dbType = fieldInfo.dataType.toLowerCase()

    // Numeric types
    if (
      ['int', 'integer', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'double', 'real', 'money'].some(
        (t) => dbType.includes(t)
      )
    ) {
      return analyzeNumericColumn(columnName, nonNullValues, nullCount)
    }

    // Temporal types
    if (
      ['timestamp', 'date', 'datetime', 'time', 'year'].some((t) =>
        dbType.includes(t)
      )
    ) {
      return analyzeTemporalColumn(columnName, nonNullValues, nullCount)
    }

    // Boolean types
    if (['boolean', 'bool', 'bit'].some((t) => dbType.includes(t))) {
      return analyzeBooleanColumn(columnName, nonNullValues, nullCount)
    }
  }

  // Fallback: Infer from actual values
  if (nonNullValues.length === 0) {
    return {
      name: columnName,
      type: 'unknown',
      distinctCount: 0,
      nullCount,
    }
  }

  // Check if all values are numbers
  if (nonNullValues.every((v) => typeof v === 'number' || !isNaN(Number(v)))) {
    return analyzeNumericColumn(columnName, nonNullValues, nullCount)
  }

  // Check if all values are booleans
  if (
    nonNullValues.every(
      (v) => typeof v === 'boolean' || v === 'true' || v === 'false' || v === 0 || v === 1
    )
  ) {
    return analyzeBooleanColumn(columnName, nonNullValues, nullCount)
  }

  // Check if values are dates
  if (nonNullValues.every((v) => isValidDate(v))) {
    return analyzeTemporalColumn(columnName, nonNullValues, nullCount)
  }

  // Check distinctness for categorical vs text
  const distinctCount = new Set(nonNullValues).size
  const distinctRatio = distinctCount / nonNullValues.length

  // If less than 30% distinct and ≤ 50 unique values, treat as categorical
  if (distinctRatio <= 0.3 && distinctCount <= 50) {
    return {
      name: columnName,
      type: 'categorical',
      distinctCount,
      nullCount,
      sampleValues: Array.from(new Set(nonNullValues)).slice(0, 10),
    }
  }

  // Otherwise, treat as text
  return {
    name: columnName,
    type: 'text',
    distinctCount,
    nullCount,
    avgLength:
      nonNullValues.reduce((sum, v) => sum + String(v).length, 0) /
      nonNullValues.length,
  }
}

/**
 * Analyzes a numeric column
 */
function analyzeNumericColumn(
  name: string,
  values: any[],
  nullCount: number
): ColumnMetadata {
  const numericValues = values.map((v) => Number(v))
  const distinctCount = new Set(numericValues).size

  return {
    name,
    type: 'numeric',
    distinctCount,
    nullCount,
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  }
}

/**
 * Analyzes a temporal (date/time) column
 */
function analyzeTemporalColumn(
  name: string,
  values: any[],
  nullCount: number
): ColumnMetadata {
  const dates = values.map((v) => new Date(v))
  const distinctCount = new Set(dates.map((d) => d.getTime())).size

  return {
    name,
    type: 'temporal',
    distinctCount,
    nullCount,
    min: new Date(Math.min(...dates.map((d) => d.getTime()))),
    max: new Date(Math.max(...dates.map((d) => d.getTime()))),
  }
}

/**
 * Analyzes a boolean column
 */
function analyzeBooleanColumn(
  name: string,
  values: any[],
  nullCount: number
): ColumnMetadata {
  return {
    name,
    type: 'boolean',
    distinctCount: new Set(values).size,
    nullCount,
  }
}

/**
 * Checks if a value can be parsed as a valid date
 */
function isValidDate(value: any): boolean {
  if (value instanceof Date) return !isNaN(value.getTime())

  const date = new Date(value)
  if (isNaN(date.getTime())) return false

  // Additional check: String must look like a date (not just a number)
  const str = String(value)
  return (
    str.includes('-') ||
    str.includes('/') ||
    str.includes('T') ||
    str.toLowerCase().includes('jan') ||
    str.toLowerCase().includes('feb') ||
    str.toLowerCase().includes('mar')
  )
}

/**
 * Analyzes SQL query to extract structural features
 */
export function analyzeSQLPattern(sql: string): SQLFeatures {
  const upperSQL = sql.toUpperCase()

  return {
    hasGroupBy: /GROUP\s+BY/i.test(sql),
    hasAggregation: /\b(COUNT|SUM|AVG|MAX|MIN|STDDEV|VARIANCE|STRING_AGG)\s*\(/i.test(
      sql
    ),
    hasOrderBy: /ORDER\s+BY/i.test(sql),
    hasJoin: /\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b/i.test(sql),
    hasLimit: /\bLIMIT\s+\d+/i.test(sql),
    aggregateFunctions: extractAggregateFunctions(sql),
    isTimeSeriesOrdered: isTimeSeriesQuery(sql),
  }
}

/**
 * Extracts aggregate functions from SQL
 */
function extractAggregateFunctions(sql: string): string[] {
  const regex = /\b(COUNT|SUM|AVG|MAX|MIN|STDDEV|VARIANCE|STRING_AGG)\s*\(/gi
  const matches = sql.match(regex) || []
  return matches.map((m) => m.replace(/\s*\(.*/, '').toUpperCase())
}

/**
 * Detects if query is ordered by a date/time column
 */
function isTimeSeriesQuery(sql: string): boolean {
  const orderByMatch = sql.match(/ORDER\s+BY\s+(\w+)/i)
  if (!orderByMatch) return false

  const orderColumn = orderByMatch[1].toLowerCase()

  // Common temporal column name patterns
  return (
    orderColumn.includes('date') ||
    orderColumn.includes('time') ||
    orderColumn.includes('created') ||
    orderColumn.includes('updated') ||
    orderColumn.includes('year') ||
    orderColumn.includes('month') ||
    orderColumn.includes('day')
  )
}

/**
 * Checks if results are chronologically ordered
 */
export function isChronologicallyOrdered(
  results: any[],
  columnName: string
): boolean {
  if (results.length < 2) return true

  const values = results.map((row) => new Date(row[columnName]).getTime())

  // Check if ascending or descending
  let isAscending = true
  let isDescending = true

  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) isAscending = false
    if (values[i] > values[i - 1]) isDescending = false
  }

  return isAscending || isDescending
}
