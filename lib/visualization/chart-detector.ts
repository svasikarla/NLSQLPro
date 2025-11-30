/**
 * Chart Detection Logic
 * Analyzes query results and recommends appropriate chart types
 */

import { DataStatistics, SQLFeatures, analyzeQueryResults, analyzeSQLPattern, isChronologicallyOrdered } from './data-analyzer'
import { FieldInfo } from '@/lib/database/types/database'

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'table' | 'kpi'

export interface ChartRecommendation {
  type: ChartType
  confidence: number // 0-1
  reason: string
  config: ChartConfig
}

export interface ChartConfig {
  xAxis?: string
  yAxis?: string | string[]
  colorBy?: string
  orientation?: 'horizontal' | 'vertical'
  stacked?: boolean
  // New fields for V2 compatibility
  title?: string
  metric?: string
  trend?: number
  semanticType?: string
  xAxisSemanticType?: string
  yAxisSemanticType?: string
}

export interface VisualizationAnalysis {
  recommendations: ChartRecommendation[]
  dataStats: DataStatistics
  sqlFeatures: SQLFeatures
  canVisualize: boolean
}

/**
 * Main function to analyze results and recommend visualizations
 */
export function detectBestVisualization(
  results: any[],
  sql?: string,
  fields?: FieldInfo[]
): VisualizationAnalysis {
  console.log('[ChartDetector] Starting analysis:', { resultsCount: results.length, sql, fieldsCount: fields?.length })

  // Analyze data
  const dataStats = analyzeQueryResults(results, sql, fields)
  console.log('[ChartDetector] Data stats:', dataStats)

  const sqlFeatures = sql ? analyzeSQLPattern(sql) : getDefaultSQLFeatures()
  console.log('[ChartDetector] SQL features:', sqlFeatures)

  // Generate recommendations
  const recommendations = generateRecommendations(results, dataStats, sqlFeatures)
  console.log('[ChartDetector] Initial recommendations:', recommendations)

  // Always add table as fallback
  recommendations.push({
    type: 'table',
    confidence: 1.0,
    reason: 'Raw data view',
    config: {},
  })

  // Sort by confidence (highest first)
  recommendations.sort((a, b) => b.confidence - a.confidence)

  const analysis = {
    recommendations,
    dataStats,
    sqlFeatures,
    canVisualize: recommendations.some((r) => r.type !== 'table'),
  }

  console.log('[ChartDetector] Final analysis:', analysis)

  return analysis
}

/**
 * Generates chart recommendations based on data patterns
 */
function generateRecommendations(
  results: any[],
  dataStats: DataStatistics,
  sqlFeatures: SQLFeatures
): ChartRecommendation[] {
  const recommendations: ChartRecommendation[] = []

  // Pattern 1: Time series (highest priority)
  const timeSeriesRec = detectTimeSeries(results, dataStats, sqlFeatures)
  if (timeSeriesRec) recommendations.push(timeSeriesRec)

  // Pattern 2: Categorical aggregation (bar chart)
  const barChartRec = detectCategoricalAggregation(results, dataStats, sqlFeatures)
  if (barChartRec) recommendations.push(barChartRec)

  // Pattern 3: Small categorical breakdown (pie chart)
  const pieChartRec = detectPieChart(results, dataStats, sqlFeatures)
  if (pieChartRec) recommendations.push(pieChartRec)

  // Pattern 4: Correlation analysis (scatter plot)
  const scatterRec = detectCorrelation(results, dataStats, sqlFeatures)
  if (scatterRec) recommendations.push(scatterRec)

  return recommendations
}

/**
 * Detects time series patterns
 */
function detectTimeSeries(
  results: any[],
  dataStats: DataStatistics,
  sqlFeatures: SQLFeatures
): ChartRecommendation | null {
  const { temporalColumns, numericColumns } = dataStats

  // Need at least one temporal column and one numeric column
  if (temporalColumns.length === 0 || numericColumns.length === 0) {
    return null
  }

  // Need at least 3 data points for a meaningful trend
  if (results.length < 3) {
    return null
  }

  const temporalCol = temporalColumns[0]

  // Check if data is chronologically ordered
  const isOrdered = isChronologicallyOrdered(results, temporalCol.name)

  // Calculate confidence
  let confidence = 0.85

  if (sqlFeatures.isTimeSeriesOrdered) confidence += 0.10
  if (sqlFeatures.hasOrderBy) confidence += 0.05
  if (isOrdered) confidence += 0.05
  if (results.length >= 10) confidence += 0.05

  confidence = Math.min(confidence, 0.98)

  // Determine which numeric columns to plot
  const yAxisColumns = numericColumns.slice(0, 3).map((c) => c.name) // Max 3 lines

  return {
    type: 'line',
    confidence,
    reason: `Time series data detected with ${numericColumns.length} metric${numericColumns.length > 1 ? 's' : ''}`,
    config: {
      xAxis: temporalCol.name,
      yAxis: yAxisColumns.length === 1 ? yAxisColumns[0] : yAxisColumns,
    },
  }
}

/**
 * Detects categorical aggregation patterns (bar chart)
 */
function detectCategoricalAggregation(
  results: any[],
  dataStats: DataStatistics,
  sqlFeatures: SQLFeatures
): ChartRecommendation | null {
  const { categoricalColumns, numericColumns } = dataStats

  // Need at least one categorical column and one numeric column
  if (categoricalColumns.length === 0 || numericColumns.length === 0) {
    return null
  }

  // Bar charts work best with ≤20 categories
  const categoricalCol = categoricalColumns[0]
  if (categoricalCol.distinctCount > 20) {
    return null
  }

  // Calculate confidence
  let confidence = 0.80

  if (sqlFeatures.hasGroupBy) confidence += 0.10
  if (sqlFeatures.hasAggregation) confidence += 0.05
  if (categoricalCol.distinctCount <= 10) confidence += 0.05
  if (numericColumns.length === 1) confidence += 0.05 // Simpler is better

  confidence = Math.min(confidence, 0.95)

  // Determine orientation
  const orientation = categoricalCol.distinctCount > 5 ? 'horizontal' : 'vertical'

  // Multiple numeric columns = grouped bars
  const yAxisColumns = numericColumns.slice(0, 5).map((c) => c.name)

  return {
    type: 'bar',
    confidence,
    reason: `Categorical data with ${categoricalCol.distinctCount} categories`,
    config: {
      xAxis: categoricalCol.name,
      yAxis: yAxisColumns.length === 1 ? yAxisColumns[0] : yAxisColumns,
      orientation,
    },
  }
}

/**
 * Detects pie chart suitability
 */
function detectPieChart(
  results: any[],
  dataStats: DataStatistics,
  sqlFeatures: SQLFeatures
): ChartRecommendation | null {
  const { categoricalColumns, numericColumns } = dataStats

  // Pie charts need exactly one categorical and one numeric column
  if (categoricalColumns.length === 0 || numericColumns.length === 0) {
    return null
  }

  const categoricalCol = categoricalColumns[0]

  // Pie charts only work well with ≤7 categories
  if (categoricalCol.distinctCount > 7 || categoricalCol.distinctCount < 2) {
    return null
  }

  // Calculate confidence
  let confidence = 0.70

  if (categoricalCol.distinctCount <= 5) confidence += 0.10
  if (sqlFeatures.hasGroupBy) confidence += 0.05
  if (numericColumns.length === 1) confidence += 0.05

  confidence = Math.min(confidence, 0.85)

  return {
    type: 'pie',
    confidence,
    reason: `Small categorical breakdown (${categoricalCol.distinctCount} categories)`,
    config: {
      colorBy: categoricalCol.name,
      yAxis: numericColumns[0].name,
    },
  }
}

/**
 * Detects correlation patterns (scatter plot)
 */
function detectCorrelation(
  results: any[],
  dataStats: DataStatistics,
  sqlFeatures: SQLFeatures
): ChartRecommendation | null {
  const { numericColumns } = dataStats

  // Need at least 2 numeric columns
  if (numericColumns.length < 2) {
    return null
  }

  // Need enough data points to show correlation
  if (results.length < 10) {
    return null
  }

  // Scatter plots don't work well with aggregated data
  if (sqlFeatures.hasGroupBy || sqlFeatures.hasAggregation) {
    return null
  }

  // Lower confidence - scatter plots are less common
  let confidence = 0.65

  if (numericColumns.length === 2) confidence += 0.10 // Perfect match
  if (results.length >= 30) confidence += 0.05
  if (results.length >= 100) confidence += 0.05

  confidence = Math.min(confidence, 0.80)

  return {
    type: 'scatter',
    confidence,
    reason: `Two numeric variables for correlation analysis`,
    config: {
      xAxis: numericColumns[0].name,
      yAxis: numericColumns[1].name,
    },
  }
}

/**
 * Returns default SQL features when SQL is not provided
 */
function getDefaultSQLFeatures(): SQLFeatures {
  return {
    hasGroupBy: false,
    hasAggregation: false,
    hasOrderBy: false,
    hasJoin: false,
    hasLimit: false,
    aggregateFunctions: [],
    isTimeSeriesOrdered: false,
  }
}

/**
 * Helper function to get the primary recommended chart
 */
export function getPrimaryRecommendation(
  analysis: VisualizationAnalysis
): ChartRecommendation {
  return analysis.recommendations[0]
}

/**
 * Helper function to check if a specific chart type is supported
 */
export function isChartTypeSupported(
  chartType: ChartType,
  analysis: VisualizationAnalysis
): boolean {
  return analysis.recommendations.some((r) => r.type === chartType)
}

/**
 * Helper function to get config for a specific chart type
 */
export function getChartConfig(
  chartType: ChartType,
  analysis: VisualizationAnalysis
): ChartConfig | null {
  const recommendation = analysis.recommendations.find((r) => r.type === chartType)
  return recommendation?.config || null
}
