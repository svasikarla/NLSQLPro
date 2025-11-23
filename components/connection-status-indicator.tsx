"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, XCircle, Activity, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ConnectionStatus = "healthy" | "degraded" | "down" | "unknown" | "checking"

interface ConnectionStatusIndicatorProps {
  connectionId?: string
  status?: ConnectionStatus
  latency?: number
  autoRefresh?: boolean
  refreshInterval?: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  onStatusChange?: (status: ConnectionStatus) => void
}

export function ConnectionStatusIndicator({
  connectionId,
  status: initialStatus,
  latency: initialLatency,
  autoRefresh = false,
  refreshInterval = 60000, // 1 minute default
  showLabel = true,
  size = "md",
  className,
  onStatusChange,
}: ConnectionStatusIndicatorProps) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus || "unknown")
  const [latency, setLatency] = useState<number | undefined>(initialLatency)
  const [isChecking, setIsChecking] = useState(false)

  const checkConnectionStatus = async () => {
    if (!connectionId) return

    setIsChecking(true)
    try {
      const response = await fetch(`/api/connections/info?connectionId=${connectionId}`)
      const data = await response.json()

      if (response.ok && data.metrics?.health) {
        const newStatus = data.metrics.health.status
        const newLatency = data.metrics.health.latency

        setStatus(newStatus)
        setLatency(newLatency)

        if (onStatusChange && newStatus !== status) {
          onStatusChange(newStatus)
        }
      } else {
        setStatus("unknown")
      }
    } catch (error) {
      console.error("Failed to check connection status:", error)
      setStatus("unknown")
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    if (autoRefresh && connectionId) {
      // Initial check
      checkConnectionStatus()

      // Set up interval
      const interval = setInterval(checkConnectionStatus, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [connectionId, autoRefresh, refreshInterval])

  const getStatusConfig = (currentStatus: ConnectionStatus) => {
    switch (currentStatus) {
      case "healthy":
        return {
          icon: CheckCircle2,
          label: "Healthy",
          color: "text-green-600",
          bgColor: "bg-green-600/10",
          dotColor: "bg-green-600",
          description: latency ? `Connection is stable (${latency}ms)` : "Connection is stable",
        }
      case "degraded":
        return {
          icon: AlertCircle,
          label: "Degraded",
          color: "text-yellow-600",
          bgColor: "bg-yellow-600/10",
          dotColor: "bg-yellow-600",
          description: latency ? `Slow connection detected (${latency}ms)` : "Slow connection detected",
        }
      case "down":
        return {
          icon: XCircle,
          label: "Down",
          color: "text-red-600",
          bgColor: "bg-red-600/10",
          dotColor: "bg-red-600",
          description: "Connection failed",
        }
      case "checking":
        return {
          icon: Loader2,
          label: "Checking",
          color: "text-blue-600",
          bgColor: "bg-blue-600/10",
          dotColor: "bg-blue-600",
          description: "Checking connection status...",
        }
      default:
        return {
          icon: Activity,
          label: "Unknown",
          color: "text-gray-600",
          bgColor: "bg-gray-600/10",
          dotColor: "bg-gray-600",
          description: "Connection status unknown",
        }
    }
  }

  const currentStatus = isChecking ? "checking" : status
  const config = getStatusConfig(currentStatus)
  const Icon = config.icon

  const iconSizeClass = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }[size]

  const dotSizeClass = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  }[size]

  const textSizeClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size]

  if (showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-2 cursor-help",
                config.bgColor,
                config.color,
                className
              )}
            >
              <Icon
                className={cn(iconSizeClass, isChecking && "animate-spin")}
              />
              <span className={textSizeClass}>{config.label}</span>
              {latency !== undefined && status === "healthy" && (
                <span className={cn(textSizeClass, "text-muted-foreground")}>
                  ({latency}ms)
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Icon-only mode with animated dot
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative inline-flex", className)}>
            <Icon
              className={cn(
                iconSizeClass,
                config.color,
                isChecking && "animate-spin"
              )}
            />
            {!isChecking && (
              <span
                className={cn(
                  "absolute -top-0.5 -right-0.5 rounded-full",
                  dotSizeClass,
                  config.dotColor,
                  status === "healthy" && "animate-pulse"
                )}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact inline status indicator for use in tables/lists
 */
export function CompactConnectionStatus({
  status,
  latency,
  className,
}: {
  status: ConnectionStatus
  latency?: number
  className?: string
}) {
  const config = {
    healthy: {
      color: "bg-green-600",
      label: "Healthy",
    },
    degraded: {
      color: "bg-yellow-600",
      label: "Degraded",
    },
    down: {
      color: "bg-red-600",
      label: "Down",
    },
    unknown: {
      color: "bg-gray-600",
      label: "Unknown",
    },
    checking: {
      color: "bg-blue-600",
      label: "Checking",
    },
  }[status]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                config.color,
                status === "healthy" && "animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {latency !== undefined ? `${latency}ms` : config.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.label}</p>
          {latency !== undefined && <p className="text-xs">Latency: {latency}ms</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Connection status list item with full details
 */
export function ConnectionStatusListItem({
  connectionId,
  connectionName,
  dbType,
  host,
  autoRefresh = true,
}: {
  connectionId: string
  connectionName: string
  dbType: string
  host: string
  autoRefresh?: boolean
}) {
  const [status, setStatus] = useState<ConnectionStatus>("unknown")
  const [latency, setLatency] = useState<number>()
  const [lastChecked, setLastChecked] = useState<Date>()

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/connections/info?connectionId=${connectionId}`)
        const data = await response.json()

        if (response.ok && data.metrics?.health) {
          setStatus(data.metrics.health.status)
          setLatency(data.metrics.health.latency)
          setLastChecked(new Date(data.metrics.health.lastCheck))
        }
      } catch (error) {
        setStatus("unknown")
      }
    }

    checkStatus()

    if (autoRefresh) {
      const interval = setInterval(checkStatus, 60000)
      return () => clearInterval(interval)
    }
  }, [connectionId, autoRefresh])

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <ConnectionStatusIndicator
          status={status}
          latency={latency}
          showLabel={false}
          size="lg"
        />
        <div>
          <h4 className="font-medium">{connectionName}</h4>
          <p className="text-sm text-muted-foreground">
            {dbType} • {host}
          </p>
          {lastChecked && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
      <ConnectionStatusIndicator
        status={status}
        latency={latency}
        showLabel={true}
        size="md"
      />
    </div>
  )
}
