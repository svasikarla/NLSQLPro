"use client"

import { useState, useEffect } from "react"
import { Activity, TrendingUp, Clock, CheckCircle2, AlertCircle, XCircle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastCheck: string
  latency: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  uptime: number
  totalChecks: number
  successfulChecks: number
}

interface ConnectionMetrics {
  connectionId: string
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  avgConnectionTime: number
  lastConnectionTime: string | null
  health?: ConnectionHealth
}

interface DashboardProps {
  connectionId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function ConnectionHealthDashboard({
  connectionId,
  autoRefresh = true,
  refreshInterval = 30000
}: DashboardProps) {
  const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchMetrics = async () => {
    try {
      const url = connectionId
        ? `/api/connections/metrics?connectionId=${connectionId}`
        : '/api/connections/metrics'

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics')
      }

      setMetrics(data.metrics)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [connectionId, autoRefresh, refreshInterval])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Health</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No metrics available yet</p>
        </CardContent>
      </Card>
    )
  }

  const successRate = metrics.totalConnections > 0
    ? (metrics.successfulConnections / metrics.totalConnections) * 100
    : 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-600/10'
      case 'degraded': return 'text-yellow-600 bg-yellow-600/10'
      case 'down': return 'text-red-600 bg-red-600/10'
      default: return 'text-gray-600 bg-gray-600/10'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4" />
      case 'degraded': return <AlertCircle className="h-4 w-4" />
      case 'down': return <XCircle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Connection Health</CardTitle>
            <CardDescription>Real-time connection monitoring</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connection Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics.health ? (
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(metrics.health.status)}>
                  {getStatusIcon(metrics.health.status)}
                  <span className="ml-1 capitalize">{metrics.health.status}</span>
                </Badge>
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">Unknown</div>
            )}
            {metrics.health && (
              <p className="text-xs text-muted-foreground mt-1">
                Last check: {new Date(metrics.health.lastCheck).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <Progress value={successRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.successfulConnections} of {metrics.totalConnections} successful
            </p>
          </CardContent>
        </Card>

        {/* Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.health ? `${metrics.health.latency}ms` : `${metrics.avgConnectionTime.toFixed(0)}ms`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.health?.latency !== undefined && metrics.health.latency < 1000 ? '⚡ Fast' :
               metrics.health?.latency !== undefined && metrics.health.latency < 3000 ? '✅ Good' : '⚠️ Slow'}
            </p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.health?.uptime.toFixed(1) || successRate.toFixed(1)}%
            </div>
            <Progress
              value={metrics.health?.uptime || successRate}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.health?.successfulChecks || metrics.successfulConnections} successful checks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Statistics</CardTitle>
          <CardDescription>Detailed connection metrics and performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Attempts</span>
                <span className="font-medium">{metrics.totalConnections}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Successful</span>
                <span className="font-medium text-green-600">{metrics.successfulConnections}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="font-medium text-red-600">{metrics.failedConnections}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Connection Time</span>
                <span className="font-medium">{metrics.avgConnectionTime.toFixed(0)}ms</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {metrics.health && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Current Latency</span>
                    <span className="font-medium">{metrics.health.latency}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consecutive Successes</span>
                    <span className="font-medium text-green-600">{metrics.health.consecutiveSuccesses}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consecutive Failures</span>
                    <span className="font-medium text-red-600">{metrics.health.consecutiveFailures}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Health Checks</span>
                    <span className="font-medium">{metrics.health.totalChecks}</span>
                  </div>
                </>
              )}
              {metrics.lastConnectionTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Connection</span>
                  <span className="font-medium text-xs">
                    {new Date(metrics.lastConnectionTime).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
