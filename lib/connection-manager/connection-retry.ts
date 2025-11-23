/**
 * Connection Retry Utility
 * Provides exponential backoff retry logic for transient connection failures
 */

export interface RetryConfig {
  maxRetries: number
  baseDelay: number // Base delay in milliseconds
  maxDelay: number // Maximum delay in milliseconds
  backoffMultiplier: number // Exponential backoff multiplier
  retryableErrors: string[] // Error patterns that should trigger retry
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTime: number
}

/**
 * Connection Retry Service
 * Handles retry logic with exponential backoff for transient errors
 */
export class ConnectionRetryService {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'socket hang up',
      'network error',
      'connection timeout',
      'Connection lost',
      'EPIPE',
    ],
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config }
    const startTime = Date.now()
    let lastError: Error | null = null
    let attempts = 0

    for (let attempt = 1; attempt <= fullConfig.maxRetries; attempt++) {
      attempts = attempt
      try {
        console.log(`[Retry] Attempt ${attempt}/${fullConfig.maxRetries}`)
        const result = await operation()
        const totalTime = Date.now() - startTime

        console.log(`[Retry] ✅ Success on attempt ${attempt} (${totalTime}ms)`)
        return {
          success: true,
          data: result,
          attempts,
          totalTime,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.log(`[Retry] ❌ Attempt ${attempt} failed:`, lastError.message)

        // Check if this is a retryable error
        if (!this.isRetryableError(lastError, fullConfig.retryableErrors)) {
          console.log(`[Retry] Non-retryable error, aborting`)
          return {
            success: false,
            error: lastError,
            attempts,
            totalTime: Date.now() - startTime,
          }
        }

        // Don't delay after the last attempt
        if (attempt < fullConfig.maxRetries) {
          const delay = this.calculateDelay(attempt, fullConfig)
          console.log(`[Retry] Waiting ${delay}ms before retry...`)
          await this.sleep(delay)
        }
      }
    }

    // All retries exhausted
    const totalTime = Date.now() - startTime
    console.log(`[Retry] ❌ All ${attempts} attempts failed (${totalTime}ms)`)

    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
      attempts,
      totalTime,
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const message = error.message.toLowerCase()
    const errorCode = (error as any).code?.toLowerCase() || ''

    for (const pattern of retryableErrors) {
      const patternLower = pattern.toLowerCase()
      if (message.includes(patternLower) || errorCode.includes(patternLower)) {
        return true
      }
    }

    return false
  }

  /**
   * Calculate delay with exponential backoff
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    return Math.min(delay, config.maxDelay)
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get recommended retry config for connection testing
   */
  static getTestConnectionConfig(): Partial<RetryConfig> {
    return {
      maxRetries: 2, // Fewer retries for interactive testing
      baseDelay: 2000, // 2 seconds
      maxDelay: 5000, // 5 seconds max
    }
  }

  /**
   * Get recommended retry config for pool creation
   */
  static getPoolCreationConfig(): Partial<RetryConfig> {
    return {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 8000, // 8 seconds max
    }
  }

  /**
   * Get recommended retry config for query execution
   */
  static getQueryExecutionConfig(): Partial<RetryConfig> {
    return {
      maxRetries: 2,
      baseDelay: 500, // 500ms
      maxDelay: 2000, // 2 seconds max
    }
  }
}

/**
 * Convenience wrapper for retrying async operations
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const result = await ConnectionRetryService.withRetry(operation, config)

  if (!result.success) {
    throw result.error || new Error('Operation failed after retries')
  }

  return result.data as T
}

/**
 * Type guard for connection errors
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const connectionErrorPatterns = [
    'connection',
    'connect',
    'econnrefused',
    'etimedout',
    'enotfound',
    'socket',
    'network',
  ]

  return connectionErrorPatterns.some(pattern => message.includes(pattern))
}
