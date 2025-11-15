import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection } from "@/lib/connection-manager"
import { makeSafeQuery } from "@/lib/security/query-safety"
import { createDatabaseAdapter, DatabaseType } from "@/lib/database"
import {
  checkQueryExecutionLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from "@/lib/ratelimit/rate-limiter"

export async function POST(request: Request) {
  try {
    const { sql } = await request.json()

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "SQL query is required" },
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

    // RATE LIMITING: Check query execution limit
    const rateLimitResult = await checkQueryExecutionLimit(user.id)
    logRateLimitEvent(user.id, "query_execution", rateLimitResult)

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

      // Apply comprehensive security checks and safety measures
      let safeQuery
      try {
        safeQuery = makeSafeQuery(sql, activeConnection.db_type, {
          maxRows: 1000,      // Limit to 1000 rows
          timeoutSeconds: 30, // 30 second timeout
        })
      } catch (securityError: any) {
        return NextResponse.json(
          { error: securityError.message },
          { status: 400 }
        )
      }

      // Log warnings if any
      if (safeQuery.validation.warnings.length > 0) {
        console.warn('Query warnings:', safeQuery.validation.warnings)
      }

      // Execute query using adapter
      const result = await adapter.executeWithTimeout(
        safeQuery.sql,
        safeQuery.validation.recommendedTimeout || 30
      )

      return NextResponse.json(
        {
          results: result.rows,
          rowCount: result.rowCount || 0,
          executionTime: result.executionTime,
          // Include safety metadata for transparency
          safety: {
            limitApplied: safeQuery.sql !== sql,
            maxRows: 1000,
            timeoutSeconds: safeQuery.validation.recommendedTimeout,
            complexity: safeQuery.validation.complexity,
            warnings: safeQuery.validation.warnings,
          }
        },
        {
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    } finally {
      // Clean up adapter pool
      await adapter.closePool()
    }
  } catch (error: any) {
    console.error("Execute API error:", error)

    // Use adapter error mapping if available
    let errorMessage = "Failed to execute query"

    if (error.code) {
      switch (error.code) {
        case "42P01":
          errorMessage = "Table does not exist"
          break
        case "42703":
          errorMessage = "Column does not exist"
          break
        case "42601":
          errorMessage = "Syntax error in SQL query"
          break
        case "57014":
          errorMessage = "Query timeout (exceeded 30 seconds)"
          break
        default:
          errorMessage = error.message || "Database query failed"
      }
    } else {
      errorMessage = error.message || "Failed to execute query"
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
