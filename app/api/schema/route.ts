import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveConnection, getConnectionPool } from "@/lib/connection-manager"
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

    // Get connection pool
    const pool = await getConnectionPool(user.id, activeConnection.id)

    if (!pool) {
      return NextResponse.json(
        { error: "Failed to establish database connection" },
        { status: 500 }
      )
    }

    const client = await pool.connect()

    try {
      // Get all tables
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `
      const tablesResult = await client.query(tablesQuery)

      // Get primary keys
      const primaryKeysQuery = `
        SELECT
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public';
      `
      const primaryKeysResult = await client.query(primaryKeysQuery)
      const primaryKeys = new Map<string, Set<string>>()

      for (const row of primaryKeysResult.rows) {
        if (!primaryKeys.has(row.table_name)) {
          primaryKeys.set(row.table_name, new Set())
        }
        primaryKeys.get(row.table_name)!.add(row.column_name)
      }

      // Get foreign keys
      const foreignKeysQuery = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
      `
      const foreignKeysResult = await client.query(foreignKeysQuery)
      const foreignKeys = new Map<string, Map<string, { table: string; column: string }>>()

      for (const row of foreignKeysResult.rows) {
        if (!foreignKeys.has(row.table_name)) {
          foreignKeys.set(row.table_name, new Map())
        }
        foreignKeys.get(row.table_name)!.set(row.column_name, {
          table: row.foreign_table_name,
          column: row.foreign_column_name,
        })
      }

      // Build schema info
      const tables: TableInfo[] = []
      const relationships: SchemaInfo['relationships'] = []

      for (const table of tablesResult.rows) {
        const tableName = table.table_name

        // Get columns for this table
        const columnsQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position;
        `
        const columnsResult = await client.query(columnsQuery, [tableName])

        const columns: ColumnInfo[] = columnsResult.rows.map((col) => {
          const isPrimaryKey = primaryKeys.get(tableName)?.has(col.column_name) || false
          const foreignKeyInfo = foreignKeys.get(tableName)?.get(col.column_name)
          const isForeignKey = !!foreignKeyInfo

          // Add to relationships if foreign key
          if (foreignKeyInfo) {
            relationships.push({
              fromTable: tableName,
              fromColumn: col.column_name,
              toTable: foreignKeyInfo.table,
              toColumn: foreignKeyInfo.column,
            })
          }

          return {
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            isPrimaryKey,
            isForeignKey,
            foreignKeyTo: foreignKeyInfo,
          }
        })

        tables.push({
          name: tableName,
          columns,
        })
      }

      const schemaInfo: SchemaInfo = {
        tables,
        relationships,
      }

      client.release()

      // Save to cache for future requests
      await setCachedSchema(activeConnection.id, schemaInfo)
      console.log('[Schema API] Schema cached successfully')

      return NextResponse.json(
        schemaInfo,
        rateLimitResult
          ? { headers: getRateLimitHeaders(rateLimitResult) }
          : undefined
      )
    } catch (error) {
      client.release()
      throw error
    }
  } catch (error: any) {
    console.error("Schema API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch schema" },
      { status: 500 }
    )
  }
}
