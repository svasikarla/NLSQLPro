'use client'

/**
 * Chart Recommendation Explainer
 *
 * Displays why a specific chart type was recommended with transparency
 * and actionable insights for users to understand AI decision-making.
 */

import { Info, CheckCircle2, AlertCircle, XCircle, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState } from 'react'

export interface ChartRecommendationExplanation {
  chartType: string
  score: number // 0-100
  confidence: 'high' | 'medium' | 'low'
  reasoning: {
    positive: string[]
    negative: string[]
    alternatives: string[]
  }
  insights?: {
    title: string
    description: string
    suggestedFilters?: string[]
  }
  dataQuality?: {
    hasNulls: boolean
    hasMissingValues: boolean
    dataCompleteness: number // 0-100
  }
  schemaContext?: {
    hasSchemaMetadata: boolean
    semanticTypes: string[]
    detectionSource: 'schema' | 'value_inference' | 'fallback'
  }
}

interface ChartRecommendationExplainerProps {
  explanation: ChartRecommendationExplanation
  compact?: boolean
}

export function ChartRecommendationExplainer({
  explanation,
  compact = false
}: ChartRecommendationExplainerProps) {
  const [isOpen, setIsOpen] = useState(!compact)

  const { chartType, score, confidence, reasoning, insights, dataQuality, schemaContext } = explanation

  // Determine overall status
  const getStatusIcon = () => {
    if (confidence === 'high' && score >= 80) return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (confidence === 'medium' || (score >= 50 && score < 80)) return <AlertCircle className="h-4 w-4 text-yellow-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getConfidenceBadge = () => {
    const variants = {
      high: 'default' as const,
      medium: 'secondary' as const,
      low: 'outline' as const
    }
    return (
      <Badge variant={variants[confidence]} className="ml-2">
        {confidence} confidence
      </Badge>
    )
  }

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Compact view - just a single line with expandable details
  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="p-3 bg-muted/30 border-muted">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm font-medium">
                  {chartType} Chart Recommended
                </span>
                {getConfidenceBadge()}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${getScoreColor()}`}>
                  {score}/100
                </span>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <ExplanationDetails explanation={explanation} />
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )
  }

  // Full view - always expanded
  return (
    <Card className="p-4 bg-muted/30 border-muted">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <h3 className="text-sm font-semibold">
              Why {chartType} Chart?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-powered visualization recommendation
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-lg font-bold ${getScoreColor()}`}>
            {score}/100
          </span>
          {getConfidenceBadge()}
        </div>
      </div>

      <ExplanationDetails explanation={explanation} />
    </Card>
  )
}

function ExplanationDetails({ explanation }: { explanation: ChartRecommendationExplanation }) {
  const { reasoning, insights, dataQuality, schemaContext } = explanation

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-muted">
      {/* Positive Reasons */}
      {reasoning.positive.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Why This Works
          </h4>
          <ul className="space-y-1">
            {reasoning.positive.map((reason, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negative Reasons / Caveats */}
      {reasoning.negative.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Potential Issues
          </h4>
          <ul className="space-y-1">
            {reasoning.negative.map((reason, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternative Charts */}
      {reasoning.alternatives.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Alternative Charts to Consider
          </h4>
          <ul className="space-y-1">
            {reasoning.alternatives.map((alt, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{alt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                {insights.title}
              </h4>
              <p className="text-xs text-muted-foreground">
                {insights.description}
              </p>
              {insights.suggestedFilters && insights.suggestedFilters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {insights.suggestedFilters.map((filter, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {filter}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schema Context (for debugging/transparency) */}
      {schemaContext && (
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-muted/50">
          <div className="flex items-center gap-2">
            <span className="font-medium">Data Source:</span>
            {schemaContext.hasSchemaMetadata ? (
              <Badge variant="outline" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                Schema-aware ({schemaContext.detectionSource})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                Value inference only
              </Badge>
            )}
          </div>
          {schemaContext.semanticTypes.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="font-medium">Semantic Types:</span>
              <div className="flex flex-wrap gap-1">
                {schemaContext.semanticTypes.map((type, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Quality */}
      {dataQuality && (
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-muted/50">
          <div className="flex items-center gap-2">
            <span className="font-medium">Data Quality:</span>
            <Badge variant={dataQuality.dataCompleteness >= 90 ? 'default' : 'secondary'} className="text-xs">
              {dataQuality.dataCompleteness}% complete
            </Badge>
          </div>
          {(dataQuality.hasNulls || dataQuality.hasMissingValues) && (
            <p className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Dataset contains null or missing values
            </p>
          )}
        </div>
      )}
    </div>
  )
}
