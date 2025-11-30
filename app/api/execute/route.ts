import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection, getConnectionAdapter } from "@/lib/connection-manager"
import { makeSafeQuery } from "@/lib/security/query-safety"
import {
  checkQueryExecutionLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from "@/lib/ratelimit/rate-limiter"
import {
  logQueryHistory,
  updateQueryHistory,
  findPendingQuery
} from "@/lib/logging/audit-logger"
import { getOrBuildSchemaKnowledge } from "@/lib/visualization/schema-knowledge-manager"
import { parseSQL } from "@/lib/visualization/sql-parser-integration"

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

    // AUDIT LOGGING: Find pending query or create new entry
    let historyId = await findPendingQuery(user.id, sql)

    if (!historyId) {
      // Create a new entry for direct execution
      historyId = await logQueryHistory({
        userId: user.id,
        connectionId: activeConnection.id,
        nlQuery: "Direct Execution", // We don't have the original NL query here
        generatedSql: sql,
        executed: false
      })
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
      // Apply safety checks (read-only enforcement, etc.)
      const safeQuery = makeSafeQuery(sql, activeConnection.db_type)

      // Execute query using adapter
      const startTime = Date.now()
      const result = await adapter.executeWithTimeout(
        safeQuery.sql,
        safeQuery.validation.recommendedTimeout || 30
      )
      const executionTimeMs = Date.now() - startTime

      // Update history with success
      if (historyId) {
        await updateQueryHistory(historyId, {
          executed: true,
          executionTimeMs,
          rowCount: result.rows.length,
        })
      }

      // NEW: Fetch schema knowledge for enhanced visualizations
      let schemaKnowledge = null
      let primaryTable = null

      try {
        // Parse SQL to identify tables
        const parsed = parseSQL(sql)
        primaryTable = parsed.primaryTable

        if (primaryTable) {
          schemaKnowledge = await getOrBuildSchemaKnowledge(
            user.id,
            activeConnection.id,
            primaryTable
          )
        }
      } catch (e) {
        console.warn('Failed to get schema knowledge:', e)
      }

      return NextResponse.json(
        {
          results: result.rows, // Frontend expects 'results'
          rows: result.rows,    // Keep 'rows' for backward compatibility if needed
          executionTime: executionTimeMs, // Frontend expects 'executionTime'
          rowCount: result.rows.length,
          fields: result.fields,
          // Include schema knowledge if available
          schemaKnowledge: schemaKnowledge ? {
            connectionId: schemaKnowledge.connectionId,
            tables: Array.from(schemaKnowledge.tables.entries()).map(([tableName, columns]) => ({
              name: tableName,
              columns: columns.map(col => ({
                columnName: col.columnName,
                dbType: col.dbType,
                semanticType: col.semanticType,
                cardinality: col.cardinality,
                isPrimaryKey: col.isPrimaryKey,
                isForeignKey: col.isForeignKey,
                foreignKeyTo: col.foreignKeyTo,
                isNullable: col.isNullable,
                confidence: col.confidence,
                reasoning: col.reasoning
              }))
            })),
            relationships: schemaKnowledge.relationships,
            lastUpdated: schemaKnowledge.lastUpdated
          } : null,
          primaryTable,
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
    } catch (queryError: any) {
      // Handle query execution errors
      console.error("Query execution error:", queryError)

      let errorMessage = "Failed to execute query"

      // Use adapter's error detection if available
      if (adapter.isSyntaxError && adapter.isSyntaxError(queryError)) {
        errorMessage = "Syntax error in SQL query"
      } else if (adapter.isTimeoutError && adapter.isTimeoutError(queryError)) {
        errorMessage = "Query timeout (exceeded 30 seconds)"
      } else if (queryError.message) {
        errorMessage = queryError.message
      }

      // Update history with error
      if (historyId) {
        await updateQueryHistory(historyId, {
          executed: false, // Failed execution
          errorMessage
        })
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Execute API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to execute query" },
      { status: 500 }
    )
  }
}
