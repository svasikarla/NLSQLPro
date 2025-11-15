/**
 * Environment Variables Validation
 * Ensures all required environment variables are set before app starts
 */

interface EnvConfig {
  // Required for core functionality
  ANTHROPIC_API_KEY: string
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  ENCRYPTION_KEY: string

  // Optional
  OPENAI_API_KEY?: string
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
  SENTRY_DSN?: string
}

/**
 * Validate that all required environment variables are set
 * Throws an error if any required variable is missing
 */
export function validateEnv(): void {
  const requiredEnvVars: Array<keyof EnvConfig> = [
    'ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'ENCRYPTION_KEY',
  ]

  const missing: string[] = []
  const invalid: string[] = []

  // Check for missing variables
  for (const key of requiredEnvVars) {
    const value = process.env[key]
    if (!value || value.trim().length === 0) {
      missing.push(key)
    }
  }

  // Validate ENCRYPTION_KEY format (should be 64 hex characters)
  if (process.env.ENCRYPTION_KEY) {
    const key = process.env.ENCRYPTION_KEY
    if (key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
      invalid.push(
        'ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      )
    }
  }

  // Validate Supabase URL format
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      invalid.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL starting with http:// or https://')
    }
  }

  // Validate Anthropic API Key format
  if (process.env.ANTHROPIC_API_KEY) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key.startsWith('sk-ant-')) {
      invalid.push('ANTHROPIC_API_KEY should start with "sk-ant-"')
    }
  }

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    let errorMessage = '❌ Environment Configuration Error:\n\n'

    if (missing.length > 0) {
      errorMessage += `Missing required environment variables:\n`
      missing.forEach(key => {
        errorMessage += `  - ${key}\n`
      })
      errorMessage += '\n'
    }

    if (invalid.length > 0) {
      errorMessage += `Invalid environment variables:\n`
      invalid.forEach(msg => {
        errorMessage += `  - ${msg}\n`
      })
      errorMessage += '\n'
    }

    errorMessage += 'Please check your .env.local file.\n'
    errorMessage += 'See .env.example for reference.\n'

    throw new Error(errorMessage)
  }
}

/**
 * Get validated environment configuration
 * Only call this after validateEnv() has been called
 */
export function getEnv(): EnvConfig {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
  }
}

/**
 * Check if optional features are enabled based on env vars
 */
export function getFeatureFlags() {
  return {
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasRateLimiting: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    hasErrorTracking: !!process.env.SENTRY_DSN,
  }
}

/**
 * Validate environment on module import (server-side only)
 */
if (typeof window === 'undefined') {
  try {
    validateEnv()
    console.log('✅ Environment variables validated successfully')

    const features = getFeatureFlags()
    console.log('📊 Feature flags:', {
      'Multi-LLM (OpenAI)': features.hasOpenAI ? '✅' : '❌',
      'Rate Limiting': features.hasRateLimiting ? '✅' : '❌',
      'Error Tracking': features.hasErrorTracking ? '✅' : '❌',
    })
  } catch (error) {
    console.error(error)
    // Don't throw in production build, just log
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️ Environment validation failed but continuing in production mode')
    }
  }
}
