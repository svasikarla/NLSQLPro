import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { Pool } from "pg"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function getSchemaInfo() {
  try {
    const client = await pool.connect()

    // Get all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `
    const tables = await client.query(tablesQuery)

    // Get columns for each table
    const schema: any = {}
    for (const table of tables.rows) {
      const tableName = table.table_name
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
      const columns = await client.query(columnsQuery, [tableName])
      schema[tableName] = columns.rows
    }

    client.release()
    return schema
  } catch (error) {
    console.error("Schema introspection error:", error)
    return {}
  }
}

function formatSchemaForPrompt(schema: any): string {
  let formatted = ""
  for (const [tableName, columns] of Object.entries(schema as Record<string, any[]>)) {
    formatted += `\nTable: ${tableName}\n`
    formatted += `Columns:\n`
    for (const col of columns) {
      formatted += `  - ${col.column_name} (${col.data_type})${col.is_nullable === 'NO' ? ' NOT NULL' : ''}\n`
    }
  }
  return formatted
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      )
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL not configured" },
        { status: 500 }
      )
    }

    // Get database schema
    const schema = await getSchemaInfo()
    const schemaText = formatSchemaForPrompt(schema)

    // Create prompt for Claude
    const prompt = `You are an expert SQL query generator. Convert the natural language query to PostgreSQL SQL.

DATABASE SCHEMA:
${schemaText}

RULES:
- Only generate SELECT queries (read-only)
- Use proper PostgreSQL syntax
- Include LIMIT clause for safety (max 100 rows unless specified)
- Return ONLY the SQL query, no explanations or markdown
- Do not include semicolon at the end

USER QUERY:
"${query}"

SQL Query:`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    // Extract SQL from response
    let sql = ""
    for (const block of message.content) {
      if (block.type === "text") {
        sql = block.text.trim()
        break
      }
    }

    // Clean up the SQL
    sql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim()

    // Remove trailing semicolon if present
    if (sql.endsWith(";")) {
      sql = sql.slice(0, -1)
    }

    // Basic validation - ensure it's a SELECT query
    if (!sql.toLowerCase().startsWith("select")) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed for security" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      sql,
      confidence: 0.95,
    })
  } catch (error: any) {
    console.error("Generate API error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate SQL" },
      { status: 500 }
    )
  }
}
