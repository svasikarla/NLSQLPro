/**
 * Rate Limiting System
 *
 * Multi-tier rate limiting to protect against abuse and control costs.
 * Uses Upstash Redis for distributed rate limiting.
 *
 * Limits:
 * - Query Generation: 10 requests/minute per user (LLM API calls)
 * - Query Execution: 20 requests/minute per user (database queries)
 * - Schema Introspection: 5 requests/hour per user (expensive operation)
 * - Connection Tests: 10 requests/hour per user (prevents spam)
 * - Global: 1000 requests/minute (DDoS protection)
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Feature flag: Only enable if Upstash is configured
const UPSTASH_ENABLED = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
)

// Redis client (only if enabled)
let redis: Redis | null = null

if (UPSTASH_ENABLED) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

/**
 * Rate limit tiers for different operations
 */
export const RateLimitTiers = {
  // LLM API calls (most expensive)
  QUERY_GENERATION: {
    limit: 10,
    window: "1 m" as const, // 10 requests per minute
    prefix: "ratelimit:generate",
  },

  // Database query execution
  QUERY_EXECUTION: {
    limit: 20,
    window: "1 m" as const, // 20 requests per minute
    prefix: "ratelimit:execute",
  },

  // Schema introspection (expensive database operation)
  SCHEMA_INTROSPECTION: {
    limit: 5,
    window: "1 h" as const, // 5 requests per hour
    prefix: "ratelimit:schema",
  },

  // Connection testing
  CONNECTION_TEST: {
    limit: 10,
    window: "1 h" as const, // 10 requests per hour
    prefix: "ratelimit:connection",
  },

  // Global rate limit (DDoS protection)
  GLOBAL: {
    limit: 1000,
    window: "1 m" as const, // 1000 requests per minute globally
    prefix: "ratelimit:global",
  },
}

/**
 * Rate limiter instances for each tier
 */
const rateLimiters = UPSTASH_ENABLED
  ? {
      queryGeneration: new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(
          RateLimitTiers.QUERY_GENERATION.limit,
          RateLimitTiers.QUERY_GENERATION.window
        ),
        prefix: RateLimitTiers.QUERY_GENERATION.prefix,
        analytics: true,
      }),

      queryExecution: new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(
          RateLimitTiers.QUERY_EXECUTION.limit,
          RateLimitTiers.QUERY_EXECUTION.window
        ),
        prefix: RateLimitTiers.QUERY_EXECUTION.prefix,
        analytics: true,
      }),

      schemaIntrospection: new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(
          RateLimitTiers.SCHEMA_INTROSPECTION.limit,
          RateLimitTiers.SCHEMA_INTROSPECTION.window
        ),
        prefix: RateLimitTiers.SCHEMA_INTROSPECTION.prefix,
        analytics: true,
      }),

      connectionTest: new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(
          RateLimitTiers.CONNECTION_TEST.limit,
          RateLimitTiers.CONNECTION_TEST.window
        ),
        prefix: RateLimitTiers.CONNECTION_TEST.prefix,
        analytics: true,
      }),

      global: new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(
          RateLimitTiers.GLOBAL.limit,
          RateLimitTiers.GLOBAL.window
        ),
        prefix: RateLimitTiers.GLOBAL.prefix,
        analytics: true,
      }),
    }
  : null

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp
  retryAfter?: number // Seconds until reset
  message?: string
}

/**
 * Check rate limit for query generation (LLM API calls)
 */
export async function checkQueryGenerationLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED || !rateLimiters) {
    // Rate limiting disabled - always allow
    return {
      success: true,
      limit: RateLimitTiers.QUERY_GENERATION.limit,
      remaining: RateLimitTiers.QUERY_GENERATION.limit,
      reset: Date.now() + 60000,
    }
  }

  const identifier = `user:${userId}`
  const result = await rateLimiters.queryGeneration.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    message: result.success
      ? undefined
      : `Rate limit exceeded. You can generate ${RateLimitTiers.QUERY_GENERATION.limit} queries per minute. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
  }
}

/**
 * Check rate limit for query execution
 */
export async function checkQueryExecutionLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED || !rateLimiters) {
    return {
      success: true,
      limit: RateLimitTiers.QUERY_EXECUTION.limit,
      remaining: RateLimitTiers.QUERY_EXECUTION.limit,
      reset: Date.now() + 60000,
    }
  }

  const identifier = `user:${userId}`
  const result = await rateLimiters.queryExecution.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    message: result.success
      ? undefined
      : `Rate limit exceeded. You can execute ${RateLimitTiers.QUERY_EXECUTION.limit} queries per minute. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
  }
}

/**
 * Check rate limit for schema introspection
 */
export async function checkSchemaIntrospectionLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED || !rateLimiters) {
    return {
      success: true,
      limit: RateLimitTiers.SCHEMA_INTROSPECTION.limit,
      remaining: RateLimitTiers.SCHEMA_INTROSPECTION.limit,
      reset: Date.now() + 3600000,
    }
  }

  const identifier = `user:${userId}`
  const result = await rateLimiters.schemaIntrospection.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    message: result.success
      ? undefined
      : `Rate limit exceeded. You can refresh schema ${RateLimitTiers.SCHEMA_INTROSPECTION.limit} times per hour. Please try again in ${Math.ceil((result.reset - Date.now()) / 60000)} minutes.`,
  }
}

/**
 * Check rate limit for connection testing
 */
export async function checkConnectionTestLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED || !rateLimiters) {
    return {
      success: true,
      limit: RateLimitTiers.CONNECTION_TEST.limit,
      remaining: RateLimitTiers.CONNECTION_TEST.limit,
      reset: Date.now() + 3600000,
    }
  }

  const identifier = `user:${userId}`
  const result = await rateLimiters.connectionTest.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    message: result.success
      ? undefined
      : `Rate limit exceeded. You can test ${RateLimitTiers.CONNECTION_TEST.limit} connections per hour. Please try again in ${Math.ceil((result.reset - Date.now()) / 60000)} minutes.`,
  }
}

/**
 * Check global rate limit (IP-based DDoS protection)
 */
export async function checkGlobalLimit(identifier: string): Promise<RateLimitResult> {
  if (!UPSTASH_ENABLED || !rateLimiters) {
    return {
      success: true,
      limit: RateLimitTiers.GLOBAL.limit,
      remaining: RateLimitTiers.GLOBAL.limit,
      reset: Date.now() + 60000,
    }
  }

  const result = await rateLimiters.global.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    message: result.success
      ? undefined
      : `Global rate limit exceeded. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
  }
}

/**
 * Get rate limit headers for API responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.reset).toISOString(),
    ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
  }
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  return UPSTASH_ENABLED
}

/**
 * Get rate limit configuration info
 */
export function getRateLimitConfig() {
  return {
    enabled: UPSTASH_ENABLED,
    tiers: {
      queryGeneration: {
        limit: RateLimitTiers.QUERY_GENERATION.limit,
        window: RateLimitTiers.QUERY_GENERATION.window,
      },
      queryExecution: {
        limit: RateLimitTiers.QUERY_EXECUTION.limit,
        window: RateLimitTiers.QUERY_EXECUTION.window,
      },
      schemaIntrospection: {
        limit: RateLimitTiers.SCHEMA_INTROSPECTION.limit,
        window: RateLimitTiers.SCHEMA_INTROSPECTION.window,
      },
      connectionTest: {
        limit: RateLimitTiers.CONNECTION_TEST.limit,
        window: RateLimitTiers.CONNECTION_TEST.window,
      },
      global: {
        limit: RateLimitTiers.GLOBAL.limit,
        window: RateLimitTiers.GLOBAL.window,
      },
    },
  }
}

/**
 * Log rate limit event for monitoring
 */
export function logRateLimitEvent(
  userId: string,
  operation: string,
  result: RateLimitResult
) {
  if (!result.success) {
    console.warn(`[Rate Limit] User ${userId} exceeded limit for ${operation}:`, {
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset).toISOString(),
      retryAfter: result.retryAfter,
    })
  }
}
