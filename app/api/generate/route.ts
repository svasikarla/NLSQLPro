import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection, getConnectionAdapter } from "@/lib/connection-manager"
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
import { logQueryHistory } from "@/lib/logging/audit-logger"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
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

    // SECURITY: Detect prompt injection attempts
    const injectionDetection = detectPromptInjection(query)

    if (!injectionDetection.isSafe) {
      const errorMessage = getSecurityErrorMessage(injectionDetection)

      // Log security incident
      await logSecurityIncident(user.id, query, injectionDetection)

      return NextResponse.json(
        {
          error: errorMessage,
          securityThreat: true,
          riskLevel: injectionDetection.riskLevel,
        },
        { status: 403 }  // 403 Forbidden
      )
    }

    // Validate LLM provider configuration
    const llmProvider = process.env.LLM_PROVIDER || 'anthropic'

    if (llmProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured. Please check your environment variables." },
        { status: 500 }
      )
    }

    if (llmProvider === 'azure-openai') {
      const missingVars = []
      if (!process.env.AZURE_OPENAI_API_KEY) missingVars.push('AZURE_OPENAI_API_KEY')
      if (!process.env.AZURE_OPENAI_ENDPOINT) missingVars.push('AZURE_OPENAI_ENDPOINT')
      if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME) missingVars.push('AZURE_OPENAI_DEPLOYMENT_NAME')

      if (missingVars.length > 0) {
        return NextResponse.json(
          { error: `Azure OpenAI configuration incomplete. Missing: ${missingVars.join(', ')}` },
          { status: 500 }
        )
      }
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



    // Get active connection
    const activeConnection = await getActiveConnection(user.id)

    if (!activeConnection) {
      return NextResponse.json(
        { error: "No active database connection. Please activate a connection in Settings." },
        { status: 400 }
      )
    }

    // Get database adapter (uses cached adapter if available)
    const adapter = await getConnectionAdapter(user.id, activeConnection.id)

    if (!adapter) {
      return NextResponse.json(
        { error: "Failed to establish database connection" },
        { status: 500 }
      )
    }

    try {
      // Get database schema using adapter
      const schema = await adapter.getSchema()

      // Format schema for LLM prompt
      const promptContext = adapter.formatSchemaForPrompt(schema)

      // Get dialect-specific guidelines and examples from adapter
      const sqlDialect = adapter.getSQLDialect()
      const dialectGuidelines = adapter.getSQLGenerationGuidelines()
      const exampleQueries = adapter.getExampleQueries()

      // Generate SQL with automatic retry on validation failures
      const { generateSQLWithRetry, detectAmbiguity, generateExplanation } = await import('@/lib/llm/sql-generator')

      // STEP 1: Check for Ambiguity (unless user provided a clarification context)
      // We assume if the query is long or has specific structure, it might be a clarification.
      // For now, let's run it for every new query.
      // Optimization: Pass a flag from frontend if it's a "clarified" query to skip this.

      // Only check ambiguity if the query is short (< 10 words) or contains vague keywords
      // For this MVP, we'll check it if it's not explicitly skipped (TODO: Add skip flag)
      const ambiguityResult = await detectAmbiguity(query, promptContext.schemaText)

      if (ambiguityResult.isAmbiguous && ambiguityResult.options && ambiguityResult.options.length > 0) {
        return NextResponse.json({
          status: 'clarification_needed',
          options: ambiguityResult.options,
          reasoning: ambiguityResult.reasoning
        })
      }

      const result = await generateSQLWithRetry({
        query,
        schema,
        schemaText: promptContext.schemaText,
        dbType: activeConnection.db_type,
        maxRetries: 3,
        // Pass adapter-specific context for dialect-aware generation
        sqlDialect,
        dialectGuidelines,
        exampleQueries,
        // Use adapter's dialect-specific validator
        validator: (sql: string) => adapter.validateQuery(sql),
      })

      // Log successful generation
      await logQueryHistory({
        userId: user.id,
        connectionId: activeConnection.id,
        nlQuery: query,
        generatedSql: result.sql,
        executed: false,
      })

      return NextResponse.json(
        {
          sql: result.sql,
          confidence: result.confidence,
          attempts: result.attempts,
          warnings: result.validation.warnings,
          explanation: await generateExplanation(result.sql, query)
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
    }
  } catch (error: any) {
    console.error("Generate API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate SQL" },
      { status: 500 }
    )
  }
}
