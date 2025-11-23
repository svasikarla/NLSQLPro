/**
 * Insight Generator
 *
 * Automatically detects and generates insights from query results:
 * - Trends (increasing, decreasing, stable)
 * - Outliers and anomalies
 * - Data quality issues
 * - Statistical patterns
 * - Business recommendations
 *
 * Powered by schema-aware analysis for context-rich insights.
 */

import { DataStatisticsV2, ColumnMetadataV2 } from './data-analyzer-v2'
import { SemanticType } from './schema-knowledge'

export interface Insight {
  type: 'trend' | 'outlier' | 'quality' | 'distribution' | 'correlation' | 'recommendation'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedColumns: string[]
  suggestedAction?: string
  confidence: 'high' | 'medium' | 'low'
  details?: Record<string, any>
}

export interface InsightGenerationResult {
  insights: Insight[]
  summary: string
  hasIssues: boolean
  hasOpportunities: boolean
}

/**
 * Generate insights from query results and data statistics
 */
export function generateInsights(
  results: any[],
  dataStats: DataStatisticsV2
): InsightGenerationResult {
  const insights: Insight[] = []

  // 1. Data Quality Insights
  insights.push(...detectDataQualityIssues(results, dataStats))

  // 2. Distribution Insights (for categorical data)
  insights.push(...detectDistributionPatterns(results, dataStats))

  // 3. Trend Insights (for temporal data)
  insights.push(...detectTrends(results, dataStats))

  // 4. Outlier Detection (for numeric data)
  insights.push(...detectOutliers(results, dataStats))

  // 5. Correlation Insights (if multiple numeric columns)
  insights.push(...detectCorrelations(results, dataStats))

  // 6. Business Recommendations
  insights.push(...generateRecommendations(results, dataStats))

  // Summarize insights
  const hasIssues = insights.some(i => i.severity === 'warning' || i.severity === 'critical')
  const hasOpportunities = insights.some(i => i.type === 'recommendation')

  const summary = buildSummary(insights, hasIssues, hasOpportunities)

  return {
    insights,
    summary,
    hasIssues,
    hasOpportunities
  }
}

/**
 * Detect data quality issues (nulls, missing values, low completeness)
 */
function detectDataQualityIssues(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  const allColumns = [
    ...dataStats.numericColumns,
    ...dataStats.categoricalColumns,
    ...dataStats.temporalColumns,
    ...dataStats.booleanColumns,
    ...dataStats.textColumns
  ]

  for (const column of allColumns) {
    const nullRatio = column.nullCount / results.length

    if (nullRatio > 0.5) {
      // Critical: More than 50% nulls
      insights.push({
        type: 'quality',
        severity: 'critical',
        title: `High Missing Data: ${column.name}`,
        description: `${(nullRatio * 100).toFixed(1)}% of values are missing in column "${column.name}". This may indicate a data collection issue or incomplete records.`,
        affectedColumns: [column.name],
        suggestedAction: 'Consider filtering out null values or investigating the data source',
        confidence: 'high'
      })
    } else if (nullRatio > 0.2) {
      // Warning: 20-50% nulls
      insights.push({
        type: 'quality',
        severity: 'warning',
        title: `Moderate Missing Data: ${column.name}`,
        description: `${(nullRatio * 100).toFixed(1)}% of values are missing. Charts may have gaps or incomplete patterns.`,
        affectedColumns: [column.name],
        suggestedAction: 'Add WHERE clause to filter null values if needed',
        confidence: 'high'
      })
    }
  }

  // Check for low row count
  if (results.length < 5) {
    insights.push({
      type: 'quality',
      severity: 'warning',
      title: 'Very Few Data Points',
      description: `Only ${results.length} rows returned. Statistical insights and trends may not be reliable.`,
      affectedColumns: [],
      suggestedAction: 'Consider expanding the date range or removing filters',
      confidence: 'high'
    })
  }

  return insights
}

/**
 * Detect distribution patterns in categorical data
 */
function detectDistributionPatterns(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  for (const column of dataStats.categoricalColumns) {
    // Extract values and count frequency
    const values = results.map(r => r[column.name]).filter(v => v !== null && v !== undefined)
    const frequency = new Map<any, number>()

    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1)
    }

    const sortedFreq = Array.from(frequency.entries()).sort((a, b) => b[1] - a[1])

    // Detect dominant category (>70% of data)
    if (sortedFreq.length > 0) {
      const topCategoryRatio = sortedFreq[0][1] / values.length

      if (topCategoryRatio > 0.7) {
        insights.push({
          type: 'distribution',
          severity: 'info',
          title: `Dominant Category: ${column.name}`,
          description: `"${sortedFreq[0][0]}" represents ${(topCategoryRatio * 100).toFixed(1)}% of all records. Other categories are underrepresented.`,
          affectedColumns: [column.name],
          suggestedAction: 'Consider filtering or highlighting this dominant category',
          confidence: 'high',
          details: {
            topCategory: sortedFreq[0][0],
            percentage: topCategoryRatio * 100
          }
        })
      }

      // Detect balanced distribution
      if (sortedFreq.length >= 3 && sortedFreq.length <= 10) {
        const avgRatio = 1 / sortedFreq.length
        const isBalanced = sortedFreq.every(([_, count]) => {
          const ratio = count / values.length
          return Math.abs(ratio - avgRatio) < 0.15 // Within 15% of average
        })

        if (isBalanced) {
          insights.push({
            type: 'distribution',
            severity: 'info',
            title: `Balanced Distribution: ${column.name}`,
            description: `Categories are evenly distributed across ${sortedFreq.length} values. Good for comparative analysis.`,
            affectedColumns: [column.name],
            confidence: 'medium'
          })
        }
      }
    }
  }

  return insights
}

/**
 * Detect trends in temporal data
 */
function detectTrends(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  // Need temporal + numeric columns for trend analysis
  if (dataStats.temporalColumns.length === 0 || dataStats.numericColumns.length === 0) {
    return insights
  }

  const timeCol = dataStats.temporalColumns[0]
  const numericCol = dataStats.numericColumns[0]

  // Extract time series data
  const timeSeries = results
    .map(r => ({
      time: new Date(r[timeCol.name]).getTime(),
      value: Number(r[numericCol.name])
    }))
    .filter(d => !isNaN(d.time) && !isNaN(d.value))
    .sort((a, b) => a.time - b.time)

  if (timeSeries.length < 3) {
    return insights
  }

  // Simple trend detection: compare first half vs second half
  const midPoint = Math.floor(timeSeries.length / 2)
  const firstHalf = timeSeries.slice(0, midPoint)
  const secondHalf = timeSeries.slice(midPoint)

  const avgFirst = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length

  const change = ((avgSecond - avgFirst) / avgFirst) * 100

  if (Math.abs(change) > 20) {
    const direction = change > 0 ? 'increasing' : 'decreasing'
    const severity: 'info' | 'warning' = Math.abs(change) > 50 ? 'warning' : 'info'

    insights.push({
      type: 'trend',
      severity,
      title: `${direction === 'increasing' ? 'Upward' : 'Downward'} Trend Detected`,
      description: `${numericCol.name} is ${direction} by ${Math.abs(change).toFixed(1)}% over the time period. ${
        change > 0 ? 'Growth is accelerating.' : 'Values are declining.'
      }`,
      affectedColumns: [timeCol.name, numericCol.name],
      confidence: Math.abs(change) > 50 ? 'high' : 'medium',
      details: {
        changePercent: change,
        direction
      }
    })
  } else if (Math.abs(change) < 5) {
    insights.push({
      type: 'trend',
      severity: 'info',
      title: 'Stable Trend',
      description: `${numericCol.name} remains relatively stable over time (${Math.abs(change).toFixed(1)}% change). No significant growth or decline.`,
      affectedColumns: [timeCol.name, numericCol.name],
      confidence: 'medium'
    })
  }

  return insights
}

/**
 * Detect outliers in numeric data using IQR method
 */
function detectOutliers(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  for (const column of dataStats.numericColumns) {
    const values = results
      .map(r => Number(r[column.name]))
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b)

    if (values.length < 10) continue

    // Calculate quartiles
    const q1Index = Math.floor(values.length * 0.25)
    const q3Index = Math.floor(values.length * 0.75)
    const q1 = values[q1Index]
    const q3 = values[q3Index]
    const iqr = q3 - q1

    // Outlier boundaries
    const lowerBound = q1 - 1.5 * iqr
    const upperBound = q3 + 1.5 * iqr

    const outliers = values.filter(v => v < lowerBound || v > upperBound)

    if (outliers.length > 0 && outliers.length / values.length < 0.1) {
      insights.push({
        type: 'outlier',
        severity: 'warning',
        title: `Outliers Detected: ${column.name}`,
        description: `Found ${outliers.length} outlier value(s) outside the normal range (${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}). These may be data errors or exceptional cases.`,
        affectedColumns: [column.name],
        suggestedAction: 'Review outlier values or add filters to exclude them',
        confidence: 'medium',
        details: {
          outlierCount: outliers.length,
          lowerBound,
          upperBound,
          examples: outliers.slice(0, 3)
        }
      })
    }
  }

  return insights
}

/**
 * Detect correlations between numeric columns
 */
function detectCorrelations(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  // Need at least 2 numeric columns
  if (dataStats.numericColumns.length < 2) {
    return insights
  }

  // Simple pairwise correlation (Pearson)
  for (let i = 0; i < dataStats.numericColumns.length - 1; i++) {
    for (let j = i + 1; j < dataStats.numericColumns.length; j++) {
      const col1 = dataStats.numericColumns[i]
      const col2 = dataStats.numericColumns[j]

      const pairs = results
        .map(r => [Number(r[col1.name]), Number(r[col2.name])])
        .filter(([a, b]) => !isNaN(a) && !isNaN(b))

      if (pairs.length < 10) continue

      const correlation = calculatePearsonCorrelation(pairs)

      if (Math.abs(correlation) > 0.7) {
        const type = correlation > 0 ? 'positive' : 'negative'
        insights.push({
          type: 'correlation',
          severity: 'info',
          title: `Strong ${type} Correlation`,
          description: `${col1.name} and ${col2.name} are ${type}ly correlated (r=${correlation.toFixed(2)}). ${
            correlation > 0
              ? 'When one increases, the other tends to increase.'
              : 'When one increases, the other tends to decrease.'
          }`,
          affectedColumns: [col1.name, col2.name],
          suggestedAction: 'Consider scatter plot to visualize relationship',
          confidence: Math.abs(correlation) > 0.85 ? 'high' : 'medium',
          details: {
            correlation
          }
        })
      }
    }
  }

  return insights
}

/**
 * Generate business recommendations based on data patterns
 */
function generateRecommendations(
  results: any[],
  dataStats: DataStatisticsV2
): Insight[] {
  const insights: Insight[] = []

  // Recommendation: Add filters if too many rows
  if (results.length > 500 && dataStats.categoricalColumns.length > 0) {
    insights.push({
      type: 'recommendation',
      severity: 'info',
      title: 'Consider Adding Filters',
      description: `You have ${results.length} rows. Adding a WHERE clause to filter by ${dataStats.categoricalColumns[0].name} could make charts more focused and faster.`,
      affectedColumns: [],
      suggestedAction: `Add: WHERE ${dataStats.categoricalColumns[0].name} = '...'`,
      confidence: 'medium'
    })
  }

  // Recommendation: Use aggregation if raw data
  if (results.length > 100 && dataStats.temporalColumns.length > 0 && !dataStats.categoricalColumns.some(c => c.name.toLowerCase().includes('group'))) {
    insights.push({
      type: 'recommendation',
      severity: 'info',
      title: 'Consider Aggregating Data',
      description: 'For clearer trends, try grouping by time periods (day, week, month) using DATE_TRUNC or similar.',
      affectedColumns: [dataStats.temporalColumns[0].name],
      suggestedAction: `Use: GROUP BY DATE_TRUNC('day', ${dataStats.temporalColumns[0].name})`,
      confidence: 'low'
    })
  }

  return insights
}

/**
 * Build summary text from insights
 */
function buildSummary(insights: Insight[], hasIssues: boolean, hasOpportunities: boolean): string {
  if (insights.length === 0) {
    return 'No significant insights detected.'
  }

  const parts: string[] = []

  const criticalCount = insights.filter(i => i.severity === 'critical').length
  const warningCount = insights.filter(i => i.severity === 'warning').length

  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}`)
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`)
  }

  const trendInsights = insights.filter(i => i.type === 'trend')
  if (trendInsights.length > 0) {
    parts.push(`${trendInsights.length} trend${trendInsights.length > 1 ? 's' : ''} detected`)
  }

  if (hasOpportunities) {
    parts.push('recommendations available')
  }

  return parts.length > 0
    ? `Found: ${parts.join(', ')}.`
    : `${insights.length} insight${insights.length > 1 ? 's' : ''} generated.`
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePearsonCorrelation(pairs: number[][]): number {
  const n = pairs.length
  if (n === 0) return 0

  const sumX = pairs.reduce((sum, [x, _]) => sum + x, 0)
  const sumY = pairs.reduce((sum, [_, y]) => sum + y, 0)
  const sumXY = pairs.reduce((sum, [x, y]) => sum + x * y, 0)
  const sumX2 = pairs.reduce((sum, [x, _]) => sum + x * x, 0)
  const sumY2 = pairs.reduce((sum, [_, y]) => sum + y * y, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? 0 : numerator / denominator
}
