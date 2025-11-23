/**
 * Base Connection Manager
 * Abstract base class for database-specific connection managers
 */

import type { BaseDatabaseAdapter } from '@/lib/database/adapters/base-adapter'
import type { DatabaseConnection } from '@/lib/connection-manager'
import { ConnectionRetryService } from '../connection-retry'
import { checkConnectionHealth, type ConnectionHealth } from '../connection-health'

export interface ConnectionManagerConfig {
  maxRetries: number
  healthCheckInterval: number // ms
  cacheTTL: number // ms
  idleTimeout: number // ms
}

export interface ConnectionMetrics {
  connectionId: string
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  avgConnectionTime: number
  lastConnectionTime: Date | null
  health?: ConnectionHealth
}

/**
 * Abstract base class for database-specific connection managers
 * Each database type should extend this with specific logic
 */
export abstract class BaseConnectionManager {
  protected config: ConnectionManagerConfig
  protected metrics = new Map<string, ConnectionMetrics>()

  constructor(config?: Partial<ConnectionManagerConfig>) {
    this.config = {
      maxRetries: 3,
      healthCheckInterval: 60000, // 1 minute
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      idleTimeout: 10 * 60 * 1000, // 10 minutes
      ...config,
    }
  }

  // ==================== ABSTRACT METHODS ====================

  /**
   * Get database type identifier
   */
  abstract getDatabaseType(): string

  /**
   * Get default port for this database type
   */
  abstract getDefaultPort(): number

  /**
   * Get recommended timeout for this database type
   */
  abstract getRecommendedTimeout(connection: DatabaseConnection): number

  /**
   * Get SSL configuration for this database type
   */
  abstract getSSLConfig(connection: DatabaseConnection): any

  /**
   * Validate connection configuration
   */
  abstract validateConnection(connection: DatabaseConnection): { valid: boolean; errors: string[] }

  /**
   * Get connection string format help
   */
  abstract getConnectionHelp(): string

  // ==================== COMMON METHODS ====================

  /**
   * Test connection with retry logic
   */
  async testConnection(
    adapter: BaseDatabaseAdapter,
    connectionId: string
  ): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()

    try {
      const retryConfig = ConnectionRetryService.getTestConnectionConfig()
      const result = await ConnectionRetryService.withRetry(
        () => adapter.testConnection(),
        retryConfig
      )

      const latency = Date.now() - startTime

      if (!result.success || !result.data?.success) {
        this.recordConnectionMetric(connectionId, false, latency)
        return {
          success: false,
          error: result.error?.message || result.data?.error || 'Connection test failed',
          latency,
        }
      }

      this.recordConnectionMetric(connectionId, true, latency)
      return {
        success: true,
        latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordConnectionMetric(connectionId, false, latency)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency,
      }
    }
  }

  /**
   * Create connection pool with retry logic
   */
  async createPool(adapter: BaseDatabaseAdapter, connectionId: string): Promise<void> {
    const startTime = Date.now()

    try {
      const retryConfig = ConnectionRetryService.getPoolCreationConfig()
      await ConnectionRetryService.withRetry(
        () => adapter.createPool(),
        retryConfig
      )

      const latency = Date.now() - startTime
      this.recordConnectionMetric(connectionId, true, latency)
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordConnectionMetric(connectionId, false, latency)
      throw error
    }
  }

  /**
   * Check connection health
   */
  async checkHealth(
    adapter: BaseDatabaseAdapter,
    connectionId: string
  ): Promise<ConnectionHealth> {
    const health = await checkConnectionHealth(connectionId, adapter)

    // Update metrics with health status
    const metric = this.metrics.get(connectionId)
    if (metric) {
      metric.health = health
      this.metrics.set(connectionId, metric)
    }

    return health
  }

  /**
   * Record connection metric
   */
  protected recordConnectionMetric(
    connectionId: string,
    success: boolean,
    latency: number
  ): void {
    const existing = this.metrics.get(connectionId) || this.createInitialMetric(connectionId)

    existing.totalConnections++
    if (success) existing.successfulConnections++
    else existing.failedConnections++

    existing.lastConnectionTime = new Date()
    existing.avgConnectionTime =
      (existing.avgConnectionTime * (existing.totalConnections - 1) + latency) /
      existing.totalConnections

    this.metrics.set(connectionId, existing)
  }

  /**
   * Create initial metric object
   */
  protected createInitialMetric(connectionId: string): ConnectionMetrics {
    return {
      connectionId,
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      avgConnectionTime: 0,
      lastConnectionTime: null,
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(connectionId: string): ConnectionMetrics | undefined {
    return this.metrics.get(connectionId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, ConnectionMetrics> {
    return new Map(this.metrics)
  }

  /**
   * Clear metrics for a connection
   */
  clearMetrics(connectionId: string): void {
    this.metrics.delete(connectionId)
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear()
  }

  /**
   * Get success rate for a connection
   */
  getSuccessRate(connectionId: string): number {
    const metric = this.metrics.get(connectionId)
    if (!metric || metric.totalConnections === 0) return 0
    return (metric.successfulConnections / metric.totalConnections) * 100
  }

  /**
   * Check if connection is reliable (>90% success rate with at least 5 attempts)
   */
  isReliable(connectionId: string): boolean {
    const metric = this.metrics.get(connectionId)
    if (!metric || metric.totalConnections < 5) return false
    return this.getSuccessRate(connectionId) >= 90
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<ConnectionManagerConfig> {
    return Object.freeze({ ...this.config })
  }

  /**
   * Format error message with database-specific context
   */
  protected formatError(error: Error, connection: DatabaseConnection): string {
    const dbType = this.getDatabaseType()
    const defaultPort = this.getDefaultPort()

    let message = `${dbType} Connection Error: ${error.message}\n\n`

    if (connection.port !== defaultPort) {
      message += `⚠️ Using non-standard port ${connection.port} (default: ${defaultPort})\n`
    }

    return message
  }
}
