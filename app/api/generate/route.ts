import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection } from "@/lib/connection-manager"
import { createDatabaseAdapter, DatabaseType } from "@/lib/database"
import {
  detectPromptInjection,
  getSecurityErrorMessage,
  logSecurityIncident,
} from "@/lib/security/prompt-injection-detector"
import {
  checkQueryGenerationLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from "@/lib/ratelimit/rate-limiter"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      )
    }

    // SECURITY: Detect prompt injection attempts
    const injectionDetection = detectPromptInjection(query)

    if (!injectionDetection.isSafe) {
      const errorMessage = getSecurityErrorMessage(injectionDetection)

      // Log security incident (will include user ID after auth check)
      console.error('[Security] Prompt injection blocked:', {
        riskLevel: injectionDetection.riskLevel,
        threats: injectionDetection.threats,
        queryPreview: query.substring(0, 100),
      })

      return NextResponse.json(
        {
          error: errorMessage,
          securityThreat: true,
          riskLevel: injectionDetection.riskLevel,
        },
        { status: 403 }  // 403 Forbidden
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // RATE LIMITING: Check query generation limit (LLM API calls)
    const rateLimitResult = await checkQueryGenerationLimit(user.id)
    logRateLimitEvent(user.id, "query_generation", rateLimitResult)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: rateLimitResult.message || "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429, // Too Many Requests
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Log security incident with user context
    if (!injectionDetection.isSafe) {
      logSecurityIncident(user.id, query, injectionDetection)
    }

    // Get active connection
    const activeConnection = await getActiveConnection(user.id)

    if (!activeConnection) {
      return NextResponse.json(
        { error: "No active database connection. Please activate a connection in Settings." },
        { status: 400 }
      )
    }

    // Create database adapter
    const adapter = createDatabaseAdapter({
      id: activeConnection.id,
      name: activeConnection.name,
      db_type: activeConnection.db_type as DatabaseType,
      host: activeConnection.host,
      port: activeConnection.port,
      database: activeConnection.database,
      username: activeConnection.username,
      password_encrypted: activeConnection.password_encrypted,
      password: activeConnection.password, // Legacy fallback
    })

    try {
      // Initialize adapter pool
      await adapter.createPool()

      // Get database schema using adapter
      const schema = await adapter.getSchema()

      // Format schema for LLM prompt
      const promptContext = adapter.formatSchemaForPrompt(schema)

      // Generate SQL with automatic retry on validation failures
      const { generateSQLWithRetry } = await import('@/lib/llm/sql-generator')

      const result = await generateSQLWithRetry({
        query,
        schema,
        schemaText: promptContext.schemaText,
        dbType: activeConnection.db_type,
        maxRetries: 3,
      })

      return NextResponse.json(
        {
          sql: result.sql,
          confidence: result.confidence,
          attempts: result.attempts,
          warnings: result.validation.warnings,
        },
        {
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    } catch (error: any) {
      // All retries failed
      return NextResponse.json(
        { error: `Failed to generate valid SQL: ${error.message}` },
        { status: 400 }
      )
    } finally {
      // Clean up adapter pool
      await adapter.closePool()
    }
  } catch (error: any) {
    console.error("Generate API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate SQL" },
      { status: 500 }
    )
  }
}
