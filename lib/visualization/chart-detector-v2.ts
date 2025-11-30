/**
 * Chart Detection Logic V2 - Enhanced with Schema Awareness
 *
 * Replaces heuristic-based detection with a sophisticated 0-100 scoring system.
 * Leverages schema metadata, semantic types, and SQL pattern analysis.
 *
 * Key Improvements:
 * - Explainable scoring (0-100) instead of fixed confidence thresholds
 * - Schema-aware recommendations using semantic types
 * - Detailed reasoning for each recommendation
 * - Business context integration ready
 */

import { DataStatisticsV2, ColumnMetadataV2, analyzeSQLPattern, SQLFeatures } from './data-analyzer-v2'
import { FieldInfo } from '@/lib/database/types/database'
import { SchemaKnowledge } from './schema-knowledge'

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'table' | 'kpi'

/**
 * Enhanced chart recommendation with scoring breakdown
 */
export interface ChartRecommendationV2 {
  type: ChartType
  score: number // 0-100
  confidence: 'high' | 'medium' | 'low'
  reasoning: {
    positive: string[] // Why this chart is good
    negative: string[] // Potential issues
    alternatives: string[] // Other chart suggestions
  }
  config: ChartConfigV2
  insights?: {
    title: string
    description: string
    suggestedFilters?: string[]
  }
  scoreBreakdown: {
    dataFit: number // 0-40 points: How well data matches chart requirements
    semanticAlignment: number // 0-30 points: Semantic type suitability
    sqlContext: number // 0-20 points: SQL query pattern alignment
    dataQuality: number // 0-10 points: Completeness, no nulls, etc.
  }
}

export interface ChartConfigV2 {
  xAxis?: string
  yAxis?: string | string[]
  colorBy?: string
  orientation?: 'horizontal' | 'vertical'
  stacked?: boolean
  // NEW: Semantic hints
  xAxisSemanticType?: string
  yAxisSemanticType?: string
  // KPI specific
  title?: string
  metric?: string
  trend?: number
  semanticType?: string
}

export interface VisualizationAnalysisV2 {
  recommendations: ChartRecommendationV2[]
  dataStats: DataStatisticsV2
  sqlFeatures: SQLFeatures
  canVisualize: boolean
  hasSchemaContext: boolean
}

/**
 * Main function to analyze results and recommend visualizations (V2)
 */
export function detectBestVisualizationV2(
  results: any[],
  dataStats: DataStatisticsV2,
  sql?: string,
  schemaKnowledge?: SchemaKnowledge
): VisualizationAnalysisV2 {
  console.log('[ChartDetectorV2] Starting schema-aware analysis:', {
    resultsCount: results.length,
    hasSchema: !!schemaKnowledge,
    schemaConfidence: dataStats.schemaConfidence
  })

  const sqlFeatures = sql ? analyzeSQLPattern(sql) : getDefaultSQLFeatures()

  // Generate scored recommendations
  const recommendations = generateScoredRecommendations(results, dataStats, sqlFeatures)

  // Always add table as fallback
  recommendations.push({
    type: 'table',
    score: 10, // Low score so it's only picked if no other good visualizations exist
    confidence: 'high',
    reasoning: {
      positive: ['Always available for raw data inspection'],
      negative: [],
      alternatives: []
    },
    config: {},
    scoreBreakdown: {
      dataFit: 40,
      semanticAlignment: 30,
      sqlContext: 20,
      dataQuality: 10
    }
  })

  // Sort by score (highest first)
  recommendations.sort((a, b) => b.score - a.score)

  console.log('[ChartDetectorV2] Recommendations generated:', recommendations)

  return {
    recommendations,
    dataStats,
    sqlFeatures,
    canVisualize: recommendations.some((r) => r.type !== 'table'),
    hasSchemaContext: dataStats.hasSchemaContext
  }
}

/**
 * Generate scored recommendations using schema-aware analysis
 */
function generateScoredRecommendations(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2[] {
  const recommendations: ChartRecommendationV2[] = []

  // Pattern 1: Time Series (Line/Area chart)
  const timeSeriesRec = scoreTimeSeriesChart(results, dataStats, sqlFeatures)
  if (timeSeriesRec && timeSeriesRec.score >= 40) recommendations.push(timeSeriesRec)

  // Pattern 2: Categorical Aggregation (Bar chart)
  const barChartRec = scoreBarChart(results, dataStats, sqlFeatures)
  if (barChartRec && barChartRec.score >= 40) recommendations.push(barChartRec)

  // Pattern 3: Part-to-Whole (Pie chart)
  const pieChartRec = scorePieChart(results, dataStats, sqlFeatures)
  if (pieChartRec && pieChartRec.score >= 40) recommendations.push(pieChartRec)

  // Pattern 4: Correlation (Scatter plot)
  const scatterRec = scoreScatterPlot(results, dataStats, sqlFeatures)
  if (scatterRec && scatterRec.score >= 40) recommendations.push(scatterRec)

  // Pattern 5: Single Value (KPI)
  const kpiRec = scoreKpiView(results, dataStats, sqlFeatures)
  if (kpiRec && kpiRec.score >= 50) recommendations.push(kpiRec)

  return recommendations
}

/**
 * Score Time Series Chart (Line/Area)
 * Best for: Temporal data with trends over time
 */
function scoreTimeSeriesChart(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2 | null {
  const positive: string[] = []
  const negative: string[] = []
  const alternatives: string[] = []

  let dataFit = 0
  let semanticAlignment = 0
  let sqlContext = 0
  let dataQuality = 0

  // Requirement: At least 1 temporal column and 1 numeric column
  if (dataStats.temporalColumns.length === 0 || dataStats.numericColumns.length === 0) {
    return null
  }

  // DATA FIT (0-40 points)
  if (dataStats.temporalColumns.length >= 1) {
    dataFit += 20
    positive.push(`Found ${dataStats.temporalColumns.length} temporal column(s)`)
  }

  if (dataStats.numericColumns.length >= 1) {
    dataFit += 15
    positive.push(`Found ${dataStats.numericColumns.length} numeric series`)
  }

  // Bonus: Multiple time series (overlay)
  if (dataStats.numericColumns.length > 1) {
    dataFit += 5
    positive.push('Multiple metrics can be overlaid for comparison')
  }

  // SEMANTIC ALIGNMENT (0-30 points)
  const temporalCol = dataStats.temporalColumns[0]
  if (temporalCol.semanticType === 'temporal') {
    semanticAlignment += 15
    positive.push(`Time column detected as '${temporalCol.semanticType}' (${temporalCol.confidence} confidence)`)
  }

  const numericCol = dataStats.numericColumns[0]
  if (numericCol.semanticType === 'currency' || numericCol.semanticType === 'numeric_continuous') {
    semanticAlignment += 10
    positive.push(`Metric is ${numericCol.semanticType} - suitable for trends`)
  }

  // Bonus: Schema-aware detection
  if (temporalCol.detectionSource === 'schema') {
    semanticAlignment += 5
    positive.push('Type detected from database schema (highly accurate)')
  }

  // SQL CONTEXT (0-20 points)
  if (sqlFeatures.hasOrderBy && sqlFeatures.isTimeSeriesOrdered) {
    sqlContext += 15
    positive.push('Query is ordered by time column - data is ready for time series')
  } else if (sqlFeatures.hasOrderBy) {
    sqlContext += 5
    negative.push('Query is ordered, but not by time column - may need sorting')
  } else {
    sqlContext += 0
    negative.push('No ORDER BY - chart may show unordered time series')
  }

  if (sqlFeatures.hasAggregation) {
    sqlContext += 5
    positive.push('Query uses aggregation - likely summarized time series')
  }

  // DATA QUALITY (0-10 points)
  const nullRatio = temporalCol.nullCount / results.length
  if (nullRatio === 0) {
    dataQuality += 10
    positive.push('No missing time values')
  } else if (nullRatio < 0.1) {
    dataQuality += 7
    negative.push(`${(nullRatio * 100).toFixed(1)}% missing time values`)
  } else {
    dataQuality += 3
    negative.push(`${(nullRatio * 100).toFixed(1)}% missing time values - chart may have gaps`)
  }

  // TOTAL SCORE
  const score = dataFit + semanticAlignment + sqlContext + dataQuality

  // CONFIDENCE LEVEL
  const confidence: 'high' | 'medium' | 'low' =
    score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low'

  // ALTERNATIVES
  if (dataStats.categoricalColumns.length > 0) {
    alternatives.push('Bar chart could show time periods as categories')
  }

  // CONFIG
  const config: ChartConfigV2 = {
    xAxis: temporalCol.name,
    yAxis: dataStats.numericColumns.map(c => c.name),
    xAxisSemanticType: temporalCol.semanticType,
    yAxisSemanticType: numericCol.semanticType
  }

  // INSIGHTS
  const insights = {
    title: 'Time Series Trend Analysis',
    description: `Shows how ${numericCol.name} changes over ${temporalCol.name}. Look for trends, seasonality, and outliers.`,
    suggestedFilters: dataStats.categoricalColumns.length > 0
      ? [`Filter by ${dataStats.categoricalColumns[0].name}`]
      : undefined
  }

  return {
    type: 'line',
    score,
    confidence,
    reasoning: { positive, negative, alternatives },
    config,
    insights,
    scoreBreakdown: { dataFit, semanticAlignment, sqlContext, dataQuality }
  }
}

/**
 * Score Bar Chart
 * Best for: Categorical comparisons with numeric values
 */
function scoreBarChart(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2 | null {
  const positive: string[] = []
  const negative: string[] = []
  const alternatives: string[] = []

  let dataFit = 0
  let semanticAlignment = 0
  let sqlContext = 0
  let dataQuality = 0

  // Requirement: At least 1 categorical and 1 numeric column
  if (dataStats.categoricalColumns.length === 0 || dataStats.numericColumns.length === 0) {
    return null
  }

  const categoricalCol = dataStats.categoricalColumns[0]
  const numericCol = dataStats.numericColumns[0]

  // DATA FIT (0-40 points)
  const categoryCount = categoricalCol.distinctCount

  if (categoryCount >= 2 && categoryCount <= 30) {
    dataFit += 25
    positive.push(`Ideal category count: ${categoryCount} categories`)
  } else if (categoryCount > 30 && categoryCount <= 50) {
    dataFit += 15
    negative.push(`Many categories (${categoryCount}) - chart may be crowded`)
  } else if (categoryCount > 50) {
    dataFit += 5
    negative.push(`Too many categories (${categoryCount}) - consider filtering or grouping`)
  } else {
    dataFit += 10
    negative.push('Only 1 category - not ideal for comparison')
  }

  if (dataStats.numericColumns.length >= 1) {
    dataFit += 15
    positive.push(`Found ${dataStats.numericColumns.length} metric(s) for comparison`)
  }

  // SEMANTIC ALIGNMENT (0-30 points)
  if (categoricalCol.semanticType === 'categorical') {
    semanticAlignment += 15
    positive.push(`Category detected as '${categoricalCol.semanticType}' (${categoricalCol.confidence} confidence)`)
  }

  if (categoricalCol.cardinality === 'low' || categoricalCol.cardinality === 'medium') {
    semanticAlignment += 10
    positive.push(`${categoricalCol.cardinality} cardinality - perfect for bar chart`)
  } else if (categoricalCol.cardinality === 'high' || categoricalCol.cardinality === 'very_high') {
    semanticAlignment += 3
    negative.push(`${categoricalCol.cardinality} cardinality - may need grouping`)
  }

  if (categoricalCol.detectionSource === 'schema') {
    semanticAlignment += 5
    positive.push('Category type from schema metadata')
  }

  // SQL CONTEXT (0-20 points)
  if (sqlFeatures.hasGroupBy) {
    sqlContext += 10
    positive.push('Query uses GROUP BY - data is already aggregated')
  }

  if (sqlFeatures.hasAggregation) {
    sqlContext += 7
    positive.push(`Uses ${sqlFeatures.aggregateFunctions.join(', ')} aggregation`)
  }

  if (sqlFeatures.hasOrderBy) {
    sqlContext += 3
    positive.push('Results are ordered - bars will follow query order')
  }

  // DATA QUALITY (0-10 points)
  const nullRatio = categoricalCol.nullCount / results.length
  if (nullRatio === 0) {
    dataQuality += 10
  } else if (nullRatio < 0.1) {
    dataQuality += 6
    negative.push(`${(nullRatio * 100).toFixed(1)}% null categories`)
  } else {
    dataQuality += 2
    negative.push(`${(nullRatio * 100).toFixed(1)}% null categories - may need filtering`)
  }

  // TOTAL SCORE
  const score = dataFit + semanticAlignment + sqlContext + dataQuality

  const confidence: 'high' | 'medium' | 'low' =
    score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low'

  // ALTERNATIVES
  if (categoryCount <= 7) {
    alternatives.push('Pie chart could show proportions')
  }
  if (dataStats.temporalColumns.length > 0) {
    alternatives.push('Line chart could show trend over time')
  }

  const config: ChartConfigV2 = {
    xAxis: categoricalCol.name,
    yAxis: numericCol.name,
    orientation: categoryCount > 10 ? 'horizontal' : 'vertical',
    xAxisSemanticType: categoricalCol.semanticType,
    yAxisSemanticType: numericCol.semanticType
  }

  const insights = {
    title: 'Categorical Comparison',
    description: `Compare ${numericCol.name} across different ${categoricalCol.name} values.`,
    suggestedFilters: categoryCount > 30 ? [`Top 10 ${categoricalCol.name}`] : undefined
  }

  return {
    type: 'bar',
    score,
    confidence,
    reasoning: { positive, negative, alternatives },
    config,
    insights,
    scoreBreakdown: { dataFit, semanticAlignment, sqlContext, dataQuality }
  }
}

/**
 * Score Pie Chart
 * Best for: Small categorical breakdown showing parts of a whole
 */
function scorePieChart(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2 | null {
  const positive: string[] = []
  const negative: string[] = []
  const alternatives: string[] = []

  let dataFit = 0
  let semanticAlignment = 0
  let sqlContext = 0
  let dataQuality = 0

  // Requirement: 1 categorical, 1 numeric
  if (dataStats.categoricalColumns.length === 0 || dataStats.numericColumns.length === 0) {
    return null
  }

  const categoricalCol = dataStats.categoricalColumns[0]
  const numericCol = dataStats.numericColumns[0]
  const categoryCount = categoricalCol.distinctCount

  // DATA FIT (0-40 points)
  // Pie charts work best with 2-7 categories
  if (categoryCount >= 2 && categoryCount <= 5) {
    dataFit += 30
    positive.push(`Perfect category count: ${categoryCount} slices`)
  } else if (categoryCount > 5 && categoryCount <= 7) {
    dataFit += 20
    positive.push(`Good category count: ${categoryCount} slices`)
  } else if (categoryCount > 7 && categoryCount <= 12) {
    dataFit += 10
    negative.push(`Many slices (${categoryCount}) - labels may overlap`)
  } else {
    dataFit += 0
    negative.push(`Too many categories (${categoryCount}) - pie chart not recommended`)
    alternatives.push('Bar chart better for many categories')
  }

  if (dataStats.numericColumns.length === 1) {
    dataFit += 10
    positive.push('Single metric - ideal for pie chart')
  } else {
    dataFit += 5
    negative.push('Multiple metrics - pie chart can only show one')
  }

  // SEMANTIC ALIGNMENT (0-30 points)
  if (categoricalCol.semanticType === 'categorical') {
    semanticAlignment += 12
    positive.push('Categorical data detected')
  }

  if (categoricalCol.cardinality === 'very_low' || categoricalCol.cardinality === 'low') {
    semanticAlignment += 15
    positive.push(`${categoricalCol.cardinality} cardinality - excellent for pie chart`)
  } else {
    semanticAlignment += 3
    negative.push(`${categoricalCol.cardinality} cardinality - too many slices`)
  }

  if (numericCol.semanticType === 'percentage' || numericCol.semanticType === 'currency') {
    semanticAlignment += 3
    positive.push(`${numericCol.semanticType} values work well in pie chart`)
  }

  // SQL CONTEXT (0-20 points)
  if (sqlFeatures.hasGroupBy && sqlFeatures.hasAggregation) {
    sqlContext += 15
    positive.push('Aggregated data - shows parts of a whole')
  } else if (sqlFeatures.hasGroupBy) {
    sqlContext += 10
    positive.push('Grouped data')
  }

  if (sqlFeatures.aggregateFunctions.includes('COUNT') || sqlFeatures.aggregateFunctions.includes('SUM')) {
    sqlContext += 5
    positive.push('COUNT/SUM aggregation - natural fit for proportions')
  }

  // DATA QUALITY (0-10 points)
  const nullRatio = categoricalCol.nullCount / results.length
  if (nullRatio === 0) {
    dataQuality += 10
  } else {
    dataQuality += 3
    negative.push(`${(nullRatio * 100).toFixed(1)}% null values`)
  }

  const score = dataFit + semanticAlignment + sqlContext + dataQuality

  const confidence: 'high' | 'medium' | 'low' =
    score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low'

  // Only recommend pie if score is decent
  if (score < 50) {
    alternatives.push('Bar chart recommended instead due to category count')
    return null
  }

  alternatives.push('Bar chart shows exact values more clearly')

  const config: ChartConfigV2 = {
    xAxis: categoricalCol.name,
    yAxis: numericCol.name,
    xAxisSemanticType: categoricalCol.semanticType,
    yAxisSemanticType: numericCol.semanticType
  }

  const insights = {
    title: 'Proportional Breakdown',
    description: `Shows how ${numericCol.name} is distributed across ${categoricalCol.name}.`
  }

  return {
    type: 'pie',
    score,
    confidence,
    reasoning: { positive, negative, alternatives },
    config,
    insights,
    scoreBreakdown: { dataFit, semanticAlignment, sqlContext, dataQuality }
  }
}

/**
 * Score Scatter Plot
 * Best for: Correlation between two numeric variables
 */
function scoreScatterPlot(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2 | null {
  const positive: string[] = []
  const negative: string[] = []
  const alternatives: string[] = []

  let dataFit = 0
  let semanticAlignment = 0
  let sqlContext = 0
  let dataQuality = 0

  // Requirement: At least 2 numeric columns
  if (dataStats.numericColumns.length < 2) {
    return null
  }

  const xCol = dataStats.numericColumns[0]
  const yCol = dataStats.numericColumns[1]

  // DATA FIT (0-40 points)
  if (dataStats.numericColumns.length >= 2) {
    dataFit += 30
    positive.push('Two numeric variables for correlation analysis')
  }

  // Need enough points for meaningful scatter
  if (results.length >= 10) {
    dataFit += 10
    positive.push(`${results.length} data points - good for scatter plot`)
  } else {
    dataFit += 3
    negative.push(`Only ${results.length} points - limited scatter`)
  }

  // SEMANTIC ALIGNMENT (0-30 points)
  if (xCol.semanticType === 'numeric_continuous' && yCol.semanticType === 'numeric_continuous') {
    semanticAlignment += 20
    positive.push('Both variables are continuous - ideal for correlation')
  } else if (xCol.semanticType && yCol.semanticType) {
    semanticAlignment += 10
    positive.push(`X: ${xCol.semanticType}, Y: ${yCol.semanticType}`)
  }

  if (xCol.detectionSource === 'schema' && yCol.detectionSource === 'schema') {
    semanticAlignment += 10
    positive.push('Types from schema metadata')
  }

  // SQL CONTEXT (0-20 points)
  if (!sqlFeatures.hasAggregation) {
    sqlContext += 15
    positive.push('Raw data (no aggregation) - shows individual points')
  } else {
    sqlContext -= 20 // Penalize aggregation for scatter
    negative.push('Aggregated data may hide correlation patterns')
  }

  if (sqlFeatures.hasGroupBy) {
    sqlContext -= 10 // Penalize Group By for scatter
    negative.push('Grouped data is usually better for bar charts')
  }

  // DATA QUALITY (0-10 points)
  const xNullRatio = xCol.nullCount / results.length
  const yNullRatio = yCol.nullCount / results.length

  if (xNullRatio === 0 && yNullRatio === 0) {
    dataQuality += 10
  } else if (xNullRatio < 0.1 && yNullRatio < 0.1) {
    dataQuality += 5
    negative.push('Some null values - will skip incomplete points')
  } else {
    dataQuality += 1
    negative.push('Many null values - correlation may be unreliable')
  }

  const score = dataFit + semanticAlignment + sqlContext + dataQuality

  const confidence: 'high' | 'medium' | 'low' =
    score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low'

  alternatives.push('Line chart if there\'s a natural ordering')
  alternatives.push('Bar chart for categorical comparison')

  const config: ChartConfigV2 = {
    xAxis: xCol.name,
    yAxis: yCol.name,
    colorBy: dataStats.categoricalColumns.length > 0 ? dataStats.categoricalColumns[0].name : undefined,
    xAxisSemanticType: xCol.semanticType,
    yAxisSemanticType: yCol.semanticType
  }

  const insights = {
    title: 'Correlation Analysis',
    description: `Examine relationship between ${xCol.name} and ${yCol.name}. Look for patterns, clusters, and outliers.`
  }

  return {
    type: 'scatter',
    score,
    confidence,
    reasoning: { positive, negative, alternatives },
    config,
    insights,
    scoreBreakdown: { dataFit, semanticAlignment, sqlContext, dataQuality }
  }
}

/**
 * Score KPI View
 * Best for: Single value metrics (e.g. Total Revenue, Count)
 */
function scoreKpiView(
  results: any[],
  dataStats: DataStatisticsV2,
  sqlFeatures: SQLFeatures
): ChartRecommendationV2 | null {
  const positive: string[] = []
  const negative: string[] = []
  const alternatives: string[] = []

  let dataFit = 0
  let semanticAlignment = 0
  let sqlContext = 0
  let dataQuality = 0

  // Requirement: 1 row, 1 numeric column (or just 1 column total)
  if (results.length !== 1) {
    return null
  }

  const numericCol = dataStats.numericColumns[0]
  const anyCol = dataStats.numericColumns[0] || dataStats.textColumns[0] || dataStats.temporalColumns[0]

  if (!anyCol) return null

  // DATA FIT (0-40 points)
  if (results.length === 1 && dataStats.totalColumns === 1) {
    dataFit += 100 // Boost to ensure it beats table view (usually 100)
    positive.push('Single value result - perfect for KPI card')
  } else if (results.length === 1 && dataStats.numericColumns.length === 1) {
    dataFit += 80
    positive.push('Single row with one metric')
  } else {
    return null
  }

  // SEMANTIC ALIGNMENT (0-30 points)
  if (numericCol?.semanticType === 'currency' || numericCol?.semanticType === 'percentage') {
    semanticAlignment += 30
    positive.push(`Metric is ${numericCol.semanticType}`)
  } else if (numericCol) {
    semanticAlignment += 20
    positive.push('Numeric metric')
  }

  // SQL CONTEXT (0-20 points)
  if (sqlFeatures.hasAggregation && !sqlFeatures.hasGroupBy) {
    sqlContext += 20
    positive.push('Aggregation without grouping - returns single summary value')
  }

  // DATA QUALITY (0-10 points)
  if (anyCol.nullCount === 0) {
    dataQuality += 10
  }

  const score = dataFit + semanticAlignment + sqlContext + dataQuality
  const confidence = score >= 80 ? 'high' : 'medium'

  const config: ChartConfigV2 = {
    title: anyCol.name,
    metric: anyCol.name,
    semanticType: anyCol.semanticType
  }

  const insights = {
    title: 'Key Performance Indicator',
    description: `Summary metric for ${anyCol.name}`
  }

  return {
    type: 'kpi',
    score,
    confidence,
    reasoning: { positive, negative, alternatives },
    config,
    insights,
    scoreBreakdown: { dataFit, semanticAlignment, sqlContext, dataQuality }
  }
}

function getDefaultSQLFeatures(): SQLFeatures {
  return {
    hasGroupBy: false,
    hasAggregation: false,
    hasOrderBy: false,
    hasJoin: false,
    hasLimit: false,
    aggregateFunctions: [],
    isTimeSeriesOrdered: false
  }
}
