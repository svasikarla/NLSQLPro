/**
 * Connection Health Monitoring
 * Tracks connection health and provides automatic health checks
 */

import type { BaseDatabaseAdapter } from '@/lib/database/adapters/base-adapter'

export interface ConnectionHealth {
  connectionId: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastCheck: Date
  latency: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  lastError?: string
  uptime: number // Percentage (0-100)
  totalChecks: number
  successfulChecks: number
}

/**
 * Connection Health Monitor
 * Manages health checks for database connections
 */
export class ConnectionHealthMonitor {
  private healthMap = new Map<string, ConnectionHealth>()
  private readonly HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds
  private readonly MAX_LATENCY_HEALTHY = 1000 // 1 second
  private readonly MAX_LATENCY_DEGRADED = 3000 // 3 seconds

  /**
   * Perform health check on a connection
   */
  async checkHealth(
    connectionId: string,
    adapter: BaseDatabaseAdapter
  ): Promise<ConnectionHealth> {
    const startTime = Date.now()
    const existing = this.healthMap.get(connectionId)

    try {
      // Simple ping query with timeout
      await Promise.race([
        adapter.executeQuery('SELECT 1', { timeout: this.HEALTH_CHECK_TIMEOUT / 1000 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), this.HEALTH_CHECK_TIMEOUT)
        ),
      ])

      const latency = Date.now() - startTime
      const status = this.determineStatus(latency)

      const totalChecks = (existing?.totalChecks || 0) + 1
      const successfulChecks = (existing?.successfulChecks || 0) + 1
      const uptime = (successfulChecks / totalChecks) * 100

      const health: ConnectionHealth = {
        connectionId,
        status,
        lastCheck: new Date(),
        latency,
        consecutiveFailures: 0,
        consecutiveSuccesses: (existing?.consecutiveSuccesses || 0) + 1,
        uptime,
        totalChecks,
        successfulChecks,
      }

      this.healthMap.set(connectionId, health)
      return health
    } catch (error) {
      const latency = Date.now() - startTime
      const totalChecks = (existing?.totalChecks || 0) + 1
      const successfulChecks = existing?.successfulChecks || 0
      const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0

      const health: ConnectionHealth = {
        connectionId,
        status: 'down',
        lastCheck: new Date(),
        latency,
        consecutiveFailures: (existing?.consecutiveFailures || 0) + 1,
        consecutiveSuccesses: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        uptime,
        totalChecks,
        successfulChecks,
      }

      this.healthMap.set(connectionId, health)
      return health
    }
  }

  /**
   * Get cached health status without running check
   */
  getHealth(connectionId: string): ConnectionHealth | undefined {
    return this.healthMap.get(connectionId)
  }

  /**
   * Check if connection is healthy (last check within threshold)
   */
  isHealthy(connectionId: string, maxAge: number = 60000): boolean {
    const health = this.healthMap.get(connectionId)
    if (!health) return false

    const age = Date.now() - health.lastCheck.getTime()
    if (age > maxAge) return false // Stale health data

    return health.status === 'healthy' || health.status === 'degraded'
  }

  /**
   * Determine status based on latency
   */
  private determineStatus(latency: number): 'healthy' | 'degraded' | 'down' {
    if (latency < this.MAX_LATENCY_HEALTHY) return 'healthy'
    if (latency < this.MAX_LATENCY_DEGRADED) return 'degraded'
    return 'down'
  }

  /**
   * Clear health data for a connection
   */
  clearHealth(connectionId: string): void {
    this.healthMap.delete(connectionId)
  }

  /**
   * Get all health statuses
   */
  getAllHealth(): Map<string, ConnectionHealth> {
    return new Map(this.healthMap)
  }

  /**
   * Reset health monitor (clear all data)
   */
  reset(): void {
    this.healthMap.clear()
  }
}

// Singleton instance
let globalHealthMonitor: ConnectionHealthMonitor | null = null

/**
 * Get global health monitor instance
 */
export function getHealthMonitor(): ConnectionHealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new ConnectionHealthMonitor()
  }
  return globalHealthMonitor
}

/**
 * Quick health check for a connection
 */
export async function checkConnectionHealth(
  connectionId: string,
  adapter: BaseDatabaseAdapter
): Promise<ConnectionHealth> {
  const monitor = getHealthMonitor()
  return monitor.checkHealth(connectionId, adapter)
}

/**
 * Check if connection needs health verification
 */
export function needsHealthCheck(connectionId: string, maxAge: number = 60000): boolean {
  const monitor = getHealthMonitor()
  const health = monitor.getHealth(connectionId)

  if (!health) return true // No health data, need check

  const age = Date.now() - health.lastCheck.getTime()
  return age > maxAge
}
