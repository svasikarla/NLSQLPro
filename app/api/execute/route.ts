import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection, getConnectionAdapter } from "@/lib/connection-manager"
import { makeSafeQuery } from "@/lib/security/query-safety"
import {
  checkQueryExecutionLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from "@/lib/ratelimit/rate-limiter"
import { getCachedSchema } from "@/lib/cache/schema-cache"
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

    // Get database adapter (uses cached adapter if available)
    const adapter = await getConnectionAdapter(user.id, activeConnection.id)

    if (!adapter) {
      return NextResponse.json(
        { error: "Failed to establish database connection" },
        { status: 500 }
      )
    }

    try {
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

      // NEW: Fetch schema knowledge for enhanced visualizations
      let schemaKnowledge = null
      let primaryTable = null

      try {
        // Parse SQL to extract primary table
        const parsedSQL = parseSQL(sql)
        if (parsedSQL.isValid && parsedSQL.tables.length > 0) {
          primaryTable = parsedSQL.tables[0]
        }

        // Get cached schema for the connection
        const cachedSchema = await getCachedSchema(activeConnection.id)

        if (cachedSchema) {
          // Build or retrieve schema knowledge
          schemaKnowledge = await getOrBuildSchemaKnowledge(
            activeConnection.id,
            cachedSchema
          )
          console.log('[Execute API] Schema knowledge loaded for visualizations')
        } else {
          console.log('[Execute API] No cached schema available - visualizations will use value inference')
        }
      } catch (schemaError) {
        console.error('[Execute API] Error loading schema knowledge:', schemaError)
        // Don't fail the query execution - just log the error
      }

      return NextResponse.json(
        {
          results: result.rows,
          rowCount: result.rowCount || 0,
          executionTime: result.executionTime,
          fields: result.fields || [], // Include field metadata for visualizations
          // NEW: Include schema knowledge for V2 visualizations
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
