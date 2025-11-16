import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection, getConnectionAdapter } from "@/lib/connection-manager"
import {
  getCachedSchema,
  setCachedSchema,
  deleteCachedSchema,
} from "@/lib/cache/schema-cache"
import {
  checkSchemaIntrospectionLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from "@/lib/ratelimit/rate-limiter"

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignKeyTo?: {
    table: string
    column: string
  }
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

interface SchemaInfo {
  tables: TableInfo[]
  relationships: {
    fromTable: string
    fromColumn: string
    toTable: string
    toColumn: string
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get active connection
    const activeConnection = await getActiveConnection(user.id)

    if (!activeConnection) {
      return NextResponse.json(
        { error: "No active database connection. Please activate a connection in Settings." },
        { status: 400 }
      )
    }

    // Check if force refresh is requested
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // RATE LIMITING: Only apply rate limit for force refresh (expensive operation)
    let rateLimitResult = null
    if (forceRefresh) {
      rateLimitResult = await checkSchemaIntrospectionLimit(user.id)
      logRateLimitEvent(user.id, "schema_introspection", rateLimitResult)

      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: rateLimitResult.message || "Rate limit exceeded for schema refresh",
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429, // Too Many Requests
            headers: getRateLimitHeaders(rateLimitResult),
          }
        )
      }
    }

    // Try to get cached schema (unless force refresh)
    if (!forceRefresh) {
      const cachedSchema = await getCachedSchema(activeConnection.id)
      if (cachedSchema) {
        console.log('[Schema API] Returning cached schema')
        return NextResponse.json(cachedSchema)
      }
      console.log('[Schema API] Cache miss - fetching fresh schema')
    } else {
      console.log('[Schema API] Force refresh requested - clearing cache')
      await deleteCachedSchema(activeConnection.id)
    }

    // Get database adapter for the active connection
    const adapter = await getConnectionAdapter(user.id, activeConnection.id)

    if (!adapter) {
      return NextResponse.json(
        { error: "Failed to establish database connection" },
        { status: 500 }
      )
    }

    try {
      // Get schema using adapter (supports all database types)
      console.log(`[Schema API] Fetching schema for ${activeConnection.db_type} database`)
      const adapterSchema = await adapter.getSchema()

      // Convert adapter schema format to API schema format
      const tables: TableInfo[] = []
      const relationships: SchemaInfo['relationships'] = []

      for (const [tableName, columns] of Object.entries(adapterSchema.tables)) {
        const apiColumns: ColumnInfo[] = columns.map((col) => {
          const foreignKeyTo = col.foreign_key
            ? {
                table: col.foreign_key.refTable,
                column: col.foreign_key.refColumn,
              }
            : undefined

          return {
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES' || col.is_nullable === true,
            isPrimaryKey: col.is_primary_key || false,
            isForeignKey: !!col.foreign_key,
            foreignKeyTo,
          }
        })

        tables.push({
          name: tableName,
          columns: apiColumns,
        })
      }

      // Convert relationships
      for (const rel of adapterSchema.relationships || []) {
        relationships.push({
          fromTable: rel.from,
          fromColumn: rel.fromCol,
          toTable: rel.to,
          toColumn: rel.toCol,
        })
      }

      const schemaInfo: SchemaInfo = {
        tables,
        relationships,
      }

      // Save to cache for future requests
      await setCachedSchema(activeConnection.id, schemaInfo)
      console.log('[Schema API] Schema cached successfully')

      return NextResponse.json(
        schemaInfo,
        rateLimitResult
          ? { headers: getRateLimitHeaders(rateLimitResult) }
          : undefined
      )
    } catch (error: any) {
      console.error("Schema introspection error:", error)

      // Provide helpful error messages based on database type
      let errorMessage = error.message || "Failed to fetch schema"

      if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
        errorMessage = `Permission denied. Ensure the database user has SELECT permissions on information_schema tables.`
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = `Database or schema not found. Please verify the connection settings.`
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Schema API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch schema" },
      { status: 500 }
    )
  }
}
