"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Activity, Clock, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface MetricsData {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  avgConnectionTime: number
  health?: {
    status: string
    latency: number
    uptime: number
    consecutiveSuccesses: number
    consecutiveFailures: number
  }
}

interface ConnectionMetricsChartProps {
  metrics: MetricsData
  title?: string
  showTrend?: boolean
}

export function ConnectionMetricsChart({
  metrics,
  title = "Connection Performance",
  showTrend = true,
}: ConnectionMetricsChartProps) {
  const successRate = useMemo(() => {
    if (metrics.totalConnections === 0) return 0
    return (metrics.successfulConnections / metrics.totalConnections) * 100
  }, [metrics])

  const failureRate = useMemo(() => {
    if (metrics.totalConnections === 0) return 0
    return (metrics.failedConnections / metrics.totalConnections) * 100
  }, [metrics])

  const performanceScore = useMemo(() => {
    // Calculate overall performance score (0-100)
    const uptimeScore = metrics.health?.uptime || successRate
    const latencyScore = metrics.health?.latency
      ? Math.max(0, 100 - (metrics.health.latency / 50)) // 50ms = 0 points, 0ms = 100 points
      : 50

    return Math.round((uptimeScore * 0.7 + latencyScore * 0.3))
  }, [metrics, successRate])

  const getPerformanceRating = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-green-600" }
    if (score >= 75) return { label: "Good", color: "text-blue-600" }
    if (score >= 60) return { label: "Fair", color: "text-yellow-600" }
    return { label: "Poor", color: "text-red-600" }
  }

  const rating = getPerformanceRating(performanceScore)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Overall connection performance metrics</CardDescription>
          </div>
          <Badge variant="outline" className={rating.color}>
            {rating.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance Score Circle */}
        <div className="flex items-center justify-center">
          <div className="relative">
            {/* Outer circle */}
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - performanceScore / 100)}`}
                className={
                  performanceScore >= 90
                    ? "text-green-600"
                    : performanceScore >= 75
                    ? "text-blue-600"
                    : performanceScore >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
                }
                strokeLinecap="round"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{performanceScore}</span>
              <span className="text-sm text-muted-foreground">Score</span>
            </div>
          </div>
        </div>

        {/* Success/Failure Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Success Rate</span>
            </div>
            <span className="text-sm font-bold text-green-600">{successRate.toFixed(1)}%</span>
          </div>
          <Progress value={successRate} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{metrics.successfulConnections} successful</span>
            <span>{metrics.failedConnections} failed</span>
          </div>
        </div>

        {/* Average Connection Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Avg Connection Time</span>
            </div>
            <span className="text-sm font-bold">{metrics.avgConnectionTime.toFixed(0)}ms</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-8 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-md relative">
              <div
                className="absolute top-0 bottom-0 w-1 bg-white"
                style={{
                  left: `${Math.min(100, (metrics.avgConnectionTime / 5000) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Fast (&lt;1s)</span>
            <span>Slow (&gt;5s)</span>
          </div>
        </div>

        {/* Health Metrics */}
        {metrics.health && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {/* Current Latency */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Current Latency</span>
                </div>
                <div className="text-2xl font-bold">{metrics.health.latency}ms</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.health.latency < 1000
                    ? "⚡ Very Fast"
                    : metrics.health.latency < 3000
                    ? "✅ Good"
                    : "⚠️ Slow"}
                </p>
              </div>

              {/* Uptime */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Uptime</span>
                </div>
                <div className="text-2xl font-bold">{metrics.health.uptime.toFixed(1)}%</div>
                <Progress value={metrics.health.uptime} className="h-1" />
              </div>
            </div>

            {/* Consecutive Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Consecutive Successes</span>
                <Badge variant="outline" className="text-green-600 bg-green-600/10">
                  {metrics.health.consecutiveSuccesses}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Consecutive Failures</span>
                <Badge variant="outline" className="text-red-600 bg-red-600/10">
                  {metrics.health.consecutiveFailures}
                </Badge>
              </div>
            </div>
          </>
        )}

        {/* Total Attempts */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Connection Attempts</span>
            <span className="text-lg font-bold">{metrics.totalConnections}</span>
          </div>
        </div>

        {/* Trend Indicator */}
        {showTrend && metrics.health && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status Trend</span>
              {metrics.health.consecutiveSuccesses > 5 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Improving</span>
                </div>
              ) : metrics.health.consecutiveFailures > 2 ? (
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-medium">Degrading</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-blue-600">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Stable</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact metrics summary for use in lists
 */
export function CompactMetricsSummary({ metrics }: { metrics: MetricsData }) {
  const successRate = metrics.totalConnections > 0
    ? (metrics.successfulConnections / metrics.totalConnections) * 100
    : 0

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-green-600" />
        <span className="font-medium">{successRate.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3 text-blue-600" />
        <span>{metrics.avgConnectionTime.toFixed(0)}ms</span>
      </div>
      {metrics.health && (
        <Badge
          variant="outline"
          className={
            metrics.health.status === "healthy"
              ? "text-green-600 bg-green-600/10"
              : metrics.health.status === "degraded"
              ? "text-yellow-600 bg-yellow-600/10"
              : "text-red-600 bg-red-600/10"
          }
        >
          {metrics.health.status}
        </Badge>
      )}
    </div>
  )
}
