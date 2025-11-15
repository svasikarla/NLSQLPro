/**
 * Connection Pool Cache
 * Manages a cache of database adapter instances to reuse connections across requests
 */

import type { BaseDatabaseAdapter } from './adapters/base-adapter'
import type { ConnectionConfig } from './types/database'
import { createDatabaseAdapter } from './adapters/adapter-factory'

interface CachedAdapter {
  adapter: BaseDatabaseAdapter
  lastUsed: number
  useCount: number
  connectionId: string
}

interface PoolCacheOptions {
  maxCacheSize?: number
  idleTimeoutMs?: number
  cleanupIntervalMs?: number
}

/**
 * Pool Cache Manager
 * Singleton class that manages adapter instances with LRU eviction
 */
export class PoolCacheManager {
  private static instance: PoolCacheManager | null = null
  private cache: Map<string, CachedAdapter>
  private maxCacheSize: number
  private idleTimeoutMs: number
  private cleanupTimer: NodeJS.Timeout | null = null

  private constructor(options: PoolCacheOptions = {}) {
    this.cache = new Map()
    this.maxCacheSize = options.maxCacheSize || 10
    this.idleTimeoutMs = options.idleTimeoutMs || 5 * 60 * 1000 // 5 minutes default

    // Start cleanup interval
    const cleanupInterval = options.cleanupIntervalMs || 60 * 1000 // 1 minute
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections()
    }, cleanupInterval)
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: PoolCacheOptions): PoolCacheManager {
    if (!PoolCacheManager.instance) {
      PoolCacheManager.instance = new PoolCacheManager(options)
    }
    return PoolCacheManager.instance
  }

  /**
   * Reset singleton (useful for testing)
   */
  static reset(): void {
    if (PoolCacheManager.instance) {
      PoolCacheManager.instance.clearAll()
      PoolCacheManager.instance = null
    }
  }

  /**
   * Generate cache key from connection config
   */
  private generateCacheKey(config: ConnectionConfig): string {
    // Use connection ID if available, otherwise generate from config
    if (config.id) {
      return `conn_${config.id}`
    }

    // Generate key from config properties
    const parts = [
      config.db_type,
      config.host || 'localhost',
      config.port || 'default',
      config.database,
      config.username || 'default',
    ]

    return parts.join(':')
  }

  /**
   * Get adapter from cache or create new one
   */
  async getAdapter(config: ConnectionConfig): Promise<BaseDatabaseAdapter> {
    const cacheKey = this.generateCacheKey(config)

    // Check if adapter exists in cache
    const cached = this.cache.get(cacheKey)
    if (cached) {
      // Update last used time and increment use count
      cached.lastUsed = Date.now()
      cached.useCount++

      // Verify connection is still alive
      if (cached.adapter.isPoolConnected()) {
        return cached.adapter
      } else {
        // Connection is dead, remove from cache
        await this.removeAdapter(cacheKey)
      }
    }

    // Create new adapter
    const adapter = createDatabaseAdapter(config)
    await adapter.createPool()

    // Add to cache
    this.cache.set(cacheKey, {
      adapter,
      lastUsed: Date.now(),
      useCount: 1,
      connectionId: config.id || cacheKey,
    })

    // Evict oldest if cache is full
    if (this.cache.size > this.maxCacheSize) {
      await this.evictOldest()
    }

    return adapter
  }

  /**
   * Remove adapter from cache and close its pool
   */
  async removeAdapter(cacheKey: string): Promise<void> {
    const cached = this.cache.get(cacheKey)
    if (cached) {
      try {
        await cached.adapter.closePool()
      } catch (error) {
        console.error(`Error closing pool for ${cacheKey}:`, error)
      }
      this.cache.delete(cacheKey)
    }
  }

  /**
   * Evict least recently used adapter
   */
  private async evictOldest(): Promise<void> {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed
        oldestKey = key
      }
    }

    if (oldestKey) {
      console.log(`[PoolCache] Evicting oldest adapter: ${oldestKey}`)
      await this.removeAdapter(oldestKey)
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now()
    const keysToRemove: string[] = []

    for (const [key, cached] of this.cache.entries()) {
      const idleTime = now - cached.lastUsed
      if (idleTime > this.idleTimeoutMs) {
        keysToRemove.push(key)
      }
    }

    if (keysToRemove.length > 0) {
      console.log(`[PoolCache] Cleaning up ${keysToRemove.length} idle connections`)
      for (const key of keysToRemove) {
        await this.removeAdapter(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalAdapters: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      adapters: [] as Array<{
        connectionId: string
        lastUsed: Date
        useCount: number
        idleSeconds: number
        isConnected: boolean
      }>,
    }

    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      stats.adapters.push({
        connectionId: cached.connectionId,
        lastUsed: new Date(cached.lastUsed),
        useCount: cached.useCount,
        idleSeconds: Math.floor((now - cached.lastUsed) / 1000),
        isConnected: cached.adapter.isPoolConnected(),
      })
    }

    return stats
  }

  /**
   * Clear all cached adapters
   */
  async clearAll(): Promise<void> {
    console.log(`[PoolCache] Clearing all ${this.cache.size} cached adapters`)

    const closePromises: Promise<void>[] = []
    for (const [key, cached] of this.cache.entries()) {
      closePromises.push(
        cached.adapter.closePool().catch(error => {
          console.error(`Error closing pool for ${key}:`, error)
        })
      )
    }

    await Promise.all(closePromises)
    this.cache.clear()

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Invalidate cache for specific connection
   */
  async invalidate(config: ConnectionConfig): Promise<void> {
    const cacheKey = this.generateCacheKey(config)
    await this.removeAdapter(cacheKey)
  }

  /**
   * Warmup cache with connections
   */
  async warmup(configs: ConnectionConfig[]): Promise<void> {
    console.log(`[PoolCache] Warming up ${configs.length} connections`)

    const promises = configs.map(config =>
      this.getAdapter(config).catch(error => {
        console.error(`Failed to warmup connection for ${config.name}:`, error)
      })
    )

    await Promise.all(promises)
  }
}

/**
 * Get cached adapter (convenience function)
 */
export async function getCachedAdapter(config: ConnectionConfig): Promise<BaseDatabaseAdapter> {
  const cache = PoolCacheManager.getInstance()
  return cache.getAdapter(config)
}

/**
 * Clear specific adapter from cache
 */
export async function invalidateCache(config: ConnectionConfig): Promise<void> {
  const cache = PoolCacheManager.getInstance()
  await cache.invalidate(config)
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const cache = PoolCacheManager.getInstance()
  return cache.getCacheStats()
}

/**
 * Clear all cached connections
 */
export async function clearCache(): Promise<void> {
  const cache = PoolCacheManager.getInstance()
  await cache.clearAll()
}
