'use client'

/**
 * Chart Error Boundary
 *
 * React error boundary specifically for chart rendering failures.
 * Gracefully falls back to table view when charts fail to render.
 */

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
  chartType?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('[ChartErrorBoundary] Chart rendering error:', {
      chartType: this.props.chartType,
      error,
      errorInfo,
      componentStack: errorInfo.componentStack
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })

    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-destructive">
                Chart Rendering Failed
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {this.props.chartType
                  ? `Unable to render ${this.props.chartType} chart. `
                  : 'Unable to render chart. '}
                The data structure may not be compatible with this visualization type.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-3 bg-muted rounded-md text-left text-xs max-w-2xl">
                <summary className="cursor-pointer font-medium text-destructive mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="space-y-2 text-muted-foreground">
                  <div>
                    <Badge variant="destructive" className="mb-1">Error Message</Badge>
                    <pre className="whitespace-pre-wrap break-words">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <Badge variant="outline" className="mb-1">Stack Trace</Badge>
                      <pre className="whitespace-pre-wrap break-words overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <Badge variant="outline" className="mb-1">Component Stack</Badge>
                      <pre className="whitespace-pre-wrap break-words overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: Try switching to table view or selecting a different chart type
            </p>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * Functional wrapper for easier usage with hooks
 */
export function withChartErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  chartType?: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ChartErrorBoundary chartType={chartType}>
        <Component {...props} />
      </ChartErrorBoundary>
    )
  }
}
