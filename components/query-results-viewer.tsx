'use client'

/**
 * Query Results Viewer Component
 * Main component for displaying query results with charts and tables
 *
 * ENHANCED VERSION: Now supports schema-aware visualization with RAG pipeline
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, BarChart3, LineChart, PieChart as PieChartIcon, Table as TableIcon, Loader2, Info, ScatterChart as ScatterChartIcon } from 'lucide-react'
import { FieldInfo } from '@/lib/database/types/database'
import { ChartType } from '@/lib/visualization/chart-detector'
import { detectBestVisualizationV2, VisualizationAnalysisV2, ChartRecommendationV2 } from '@/lib/visualization/chart-detector-v2'
import { BarChartView } from '@/components/charts/bar-chart-view'
import { LineChartView } from '@/components/charts/line-chart-view'
import { PieChartView } from '@/components/charts/pie-chart-view'
import { ScatterChartView } from '@/components/charts/scatter-chart-view'
import { TableView } from '@/components/charts/table-view'
import { SchemaKnowledge } from '@/lib/visualization/schema-knowledge'
import { analyzeQueryResultsV2, DataStatisticsV2 } from '@/lib/visualization/data-analyzer-v2'
import { ChartRecommendationExplainer, ChartRecommendationExplanation } from '@/components/chart-recommendation-explainer'
import { ChartErrorBoundary } from '@/components/chart-error-boundary'
import { generateInsights, InsightGenerationResult } from '@/lib/visualization/insight-generator'

interface QueryResultsViewerProps {
  results: any[]
  sql?: string
  fields?: FieldInfo[]
  rowCount?: number
  executionTime?: number
  onExportCSV?: () => void
  onExportJSON?: () => void
  // NEW: Schema knowledge for enhanced analysis
  schemaKnowledge?: SchemaKnowledge
  tableName?: string
  // NEW: Enable/disable schema-aware features
  useSchemaAwareness?: boolean
}

export function QueryResultsViewer({
  results,
  sql,
  fields,
  rowCount,
  executionTime,
  onExportCSV,
  onExportJSON,
  schemaKnowledge,
  tableName,
  useSchemaAwareness = true, // Default to true for enhanced features
}: QueryResultsViewerProps) {
  const [analysisV2, setAnalysisV2] = useState<VisualizationAnalysisV2 | null>(null)
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('table')
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [dataStatsV2, setDataStatsV2] = useState<DataStatisticsV2 | null>(null)
  const [insights, setInsights] = useState<InsightGenerationResult | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showInsights, setShowInsights] = useState(false)

  // Analyze results when data changes
  useEffect(() => {
    if (results && results.length > 0) {
      setIsAnalyzing(true)
      // Simulate async analysis (in case we want to move this to a worker later)
      setTimeout(() => {
        console.log('[QueryResultsViewer] Analyzing results with V2 detector:', {
          results: results.length,
          sql,
          fields,
          schemaAware: !!schemaKnowledge
        })

        // Step 1: Enhanced data analysis with schema awareness
        const statsV2 = analyzeQueryResultsV2(
          results,
          sql,
          fields,
          schemaKnowledge,
          tableName
        )
        setDataStatsV2(statsV2)
        console.log('[QueryResultsViewer] Schema-aware analysis:', statsV2)

        // Step 2: V2 Visualization detection with scoring system
        const vizAnalysisV2 = detectBestVisualizationV2(
          results,
          statsV2,
          sql,
          schemaKnowledge
        )
        console.log('[QueryResultsViewer] V2 Analysis complete:', vizAnalysisV2)
        setAnalysisV2(vizAnalysisV2)

        // Step 3: Generate insights
        const generatedInsights = generateInsights(results, statsV2)
        console.log('[QueryResultsViewer] Insights generated:', generatedInsights)
        setInsights(generatedInsights)

        // Auto-select the best chart type
        const primaryRec = vizAnalysisV2.recommendations[0]
        console.log('[QueryResultsViewer] Primary recommendation:', primaryRec)
        setSelectedChartType(primaryRec?.type || 'table')

        setIsAnalyzing(false)
      }, 100)
    }
  }, [results, sql, fields, schemaKnowledge, tableName, useSchemaAwareness])

  if (!results || results.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No results to display
        </div>
      </Card>
    )
  }

  const displayRowCount = rowCount || results.length

  // Get icon for chart type
  const getChartIcon = (type: ChartType) => {
    switch (type) {
      case 'bar':
        return <BarChart3 className="h-4 w-4" />
      case 'line':
      case 'area':
        return <LineChart className="h-4 w-4" />
      case 'pie':
        return <PieChartIcon className="h-4 w-4" />
      case 'scatter':
        return <ScatterChartIcon className="h-4 w-4" />
      case 'table':
        return <TableIcon className="h-4 w-4" />
      default:
        return <BarChart3 className="h-4 w-4" />
    }
  }

  // Get available chart types from V2 analysis
  const availableCharts = analysisV2?.recommendations || []

  // Get chart config for selected type
  const getChartConfig = () => {
    const rec = availableCharts.find((r) => r.type === selectedChartType)
    return rec?.config || {}
  }

  // Render the selected chart with error boundary
  const renderChart = () => {
    if (isAnalyzing) {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    const config = getChartConfig()

    // Wrap charts in error boundary (table doesn't need it)
    const chartContent = (() => {
      switch (selectedChartType) {
        case 'bar':
          return <BarChartView data={results} config={config} />
        case 'line':
        case 'area':
          return <LineChartView data={results} config={config} />
        case 'pie':
          return <PieChartView data={results} config={config} />
        case 'scatter':
          return <ScatterChartView data={results} config={config} />
        case 'table':
          return <TableView data={results} />
        default:
          return <TableView data={results} />
      }
    })()

    // Only wrap non-table views in error boundary
    if (selectedChartType === 'table') {
      return chartContent
    }

    return (
      <ChartErrorBoundary
        chartType={selectedChartType}
        onError={(error, errorInfo) => {
          console.error('[QueryResultsViewer] Chart error:', {
            chartType: selectedChartType,
            error,
            errorInfo,
            resultsLength: results.length,
            config
          })
        }}
        onReset={() => {
          console.log('[QueryResultsViewer] Resetting chart after error')
          // Optionally switch to table view on error
          setSelectedChartType('table')
        }}
        fallback={
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              Chart rendering failed. Falling back to table view.
            </p>
            <TableView data={results} />
          </div>
        }
      >
        {chartContent}
      </ChartErrorBoundary>
    )
  }

  // Build explanation for the recommendation explainer (V2)
  const buildExplanation = (): ChartRecommendationExplanation => {
    const currentRec = availableCharts.find((r) => r.type === selectedChartType) as ChartRecommendationV2 | undefined

    if (!currentRec) {
      // Fallback for table view
      return {
        chartType: 'Table',
        score: 100,
        confidence: 'high',
        reasoning: {
          positive: ['Raw data view always available'],
          negative: [],
          alternatives: []
        }
      }
    }

    // V2 recommendations already have full reasoning
    return {
      chartType: selectedChartType.charAt(0).toUpperCase() + selectedChartType.slice(1),
      score: currentRec.score,
      confidence: currentRec.confidence,
      reasoning: currentRec.reasoning,
      insights: currentRec.insights,
      schemaContext: dataStatsV2 ? {
        hasSchemaMetadata: dataStatsV2.hasSchemaContext,
        semanticTypes: [
          ...dataStatsV2.numericColumns.map(c => c.semanticType || 'numeric'),
          ...dataStatsV2.categoricalColumns.map(c => c.semanticType || 'categorical'),
          ...dataStatsV2.temporalColumns.map(c => c.semanticType || 'temporal')
        ].filter((v, i, a) => a.indexOf(v) === i), // unique values
        detectionSource: dataStatsV2.numericColumns[0]?.detectionSource || 'value_inference'
      } : undefined,
      dataQuality: {
        hasNulls: dataStatsV2 ? [...dataStatsV2.numericColumns, ...dataStatsV2.categoricalColumns, ...dataStatsV2.temporalColumns].some(c => c.nullCount > 0) : false,
        hasMissingValues: dataStatsV2 ? [...dataStatsV2.numericColumns, ...dataStatsV2.categoricalColumns, ...dataStatsV2.temporalColumns].some(c => c.nullCount > 0) : false,
        dataCompleteness: dataStatsV2 ? Math.round((1 - Math.max(...[...dataStatsV2.numericColumns, ...dataStatsV2.categoricalColumns, ...dataStatsV2.temporalColumns].map(c => c.nullCount / results.length))) * 100) : 100
      }
    }
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Query Results ({displayRowCount} rows)</h3>
          {executionTime && (
            <Badge variant="outline" className="text-xs">
              {executionTime}ms
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV} className="gap-2">
              <Download size={16} />
              CSV
            </Button>
          )}
          {onExportJSON && (
            <Button variant="outline" size="sm" onClick={onExportJSON} className="gap-2">
              <Download size={16} />
              JSON
            </Button>
          )}
        </div>
      </div>

      {/* Chart Type Selector - V2 with scoring */}
      {analysisV2 && analysisV2.canVisualize && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Visualizations:</span>
          {availableCharts
            .filter((rec) => rec.type !== 'table')
            .map((rec) => {
              const v2Rec = rec as ChartRecommendationV2
              return (
                <Button
                  key={v2Rec.type}
                  variant={selectedChartType === v2Rec.type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedChartType(v2Rec.type)}
                  className="gap-2"
                >
                  {getChartIcon(v2Rec.type)}
                  {v2Rec.type.charAt(0).toUpperCase() + v2Rec.type.slice(1)}
                  <Badge
                    variant={v2Rec.confidence === 'high' ? 'default' : v2Rec.confidence === 'medium' ? 'secondary' : 'outline'}
                    className="ml-1 text-xs"
                  >
                    {v2Rec.score}/100
                  </Badge>
                </Button>
              )
            })}
          <Button
            variant={selectedChartType === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedChartType('table')}
            className="gap-2"
          >
            {getChartIcon('table')}
            Table
          </Button>
        </div>
      )}

      {/* Visualization Insight - Enhanced with V2 explanation */}
      {analysisV2 && !isAnalyzing && selectedChartType !== 'table' && (
        <>
          {!showExplanation ? (
            <div className="mb-4 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground flex items-center justify-between">
              <span>
                {(availableCharts.find((r) => r.type === selectedChartType) as ChartRecommendationV2)?.reasoning.positive[0] || 'Chart recommended'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(true)}
                className="gap-1 text-xs"
              >
                <Info className="h-3 w-3" />
                Why this chart?
              </Button>
            </div>
          ) : (
            <div className="mb-4">
              <ChartRecommendationExplainer
                explanation={buildExplanation()}
                compact={false}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(false)}
                className="mt-2 text-xs"
              >
                Hide details
              </Button>
            </div>
          )}
        </>
      )}

      {/* Chart/Table Display */}
      <div className="mt-4">{renderChart()}</div>

      {/* Data Statistics - V2 with schema context */}
      {dataStatsV2 && !isAnalyzing && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Data Summary</h4>
            {insights && insights.insights.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInsights(!showInsights)}
                className="gap-1 text-xs"
              >
                <Info className="h-3 w-3" />
                {showInsights ? 'Hide' : 'Show'} Insights ({insights.insights.length})
                {insights.hasIssues && (
                  <Badge variant="destructive" className="ml-1">!</Badge>
                )}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Rows</div>
              <div className="text-lg font-semibold">{displayRowCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Columns</div>
              <div className="text-lg font-semibold">{dataStatsV2.totalColumns}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Numeric Columns</div>
              <div className="text-lg font-semibold">
                {dataStatsV2.numericColumns.length}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Schema Context</div>
              <div className="text-lg font-semibold">
                <Badge variant={dataStatsV2.schemaConfidence === 'high' ? 'default' : 'secondary'}>
                  {dataStatsV2.schemaConfidence}
                </Badge>
              </div>
            </div>
          </div>

          {/* Insights Display - will be moved to separate component */}
          {showInsights && insights && insights.insights.length > 0 && (
            <div className="mt-4 space-y-2">
              {insights.insights.slice(0, 5).map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-sm ${
                    insight.severity === 'critical'
                      ? 'border-destructive/50 bg-destructive/5'
                      : insight.severity === 'warning'
                      ? 'border-yellow-500/50 bg-yellow-500/5'
                      : 'border-blue-500/50 bg-blue-500/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={
                        insight.severity === 'critical'
                          ? 'destructive'
                          : insight.severity === 'warning'
                          ? 'outline'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {insight.type}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-semibold">{insight.title}</div>
                      <div className="text-muted-foreground mt-1">{insight.description}</div>
                      {insight.suggestedAction && (
                        <div className="text-xs mt-2 text-blue-600 dark:text-blue-400">
                          💡 {insight.suggestedAction}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {insights.insights.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  and {insights.insights.length - 5} more insights...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
