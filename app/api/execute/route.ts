import { NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function POST(request: Request) {
  try {
    const { sql } = await request.json()

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "SQL query is required" },
        { status: 400 }
      )
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL not configured" },
        { status: 500 }
      )
    }

    // Security check - only allow SELECT queries
    const trimmedSQL = sql.trim().toLowerCase()
    if (!trimmedSQL.startsWith("select")) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed for security" },
        { status: 400 }
      )
    }

    // Additional security checks
    const dangerousKeywords = [
      "drop",
      "delete",
      "truncate",
      "insert",
      "update",
      "alter",
      "create",
      "grant",
      "revoke",
    ]

    for (const keyword of dangerousKeywords) {
      if (trimmedSQL.includes(keyword)) {
        return NextResponse.json(
          { error: `Dangerous keyword '${keyword}' detected. Only SELECT queries are allowed.` },
          { status: 400 }
        )
      }
    }

    // Execute the query with timeout
    const client = await pool.connect()

    try {
      // Set statement timeout to 30 seconds
      await client.query("SET statement_timeout = '30s'")

      const result = await client.query(sql)

      return NextResponse.json({
        results: result.rows,
        rowCount: result.rowCount || 0,
      })
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error("Execute API error:", error)

    // Parse PostgreSQL errors for better user messages
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
