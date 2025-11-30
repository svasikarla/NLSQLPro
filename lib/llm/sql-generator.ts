/**
 * SQL Generation with automatic retry on validation failures
 */

import { validateSQL, validateAgainstSchema, type SchemaInfo } from '@/lib/validation/sql-validator'
import { createLLMProvider, type LLMProvider } from '@/lib/llm/llm-provider'

export interface GenerationOptions {
  query: string
  schema: SchemaInfo
  schemaText: string
  dbType?: string
  maxRetries?: number
  // Dialect-specific parameters (Phase 1 enhancement)
  sqlDialect?: string           // "PostgreSQL" | "MySQL" | "SQL Server" | "SQLite"
  dialectGuidelines?: string    // Adapter-specific SQL generation rules
  exampleQueries?: string[]     // Adapter-specific example queries for few-shot learning
  // Phase 2: Adapter-specific validator (optional)
  validator?: (sql: string) => Promise<import('@/lib/validation/sql-validator').ValidationResult>
  previousAttempts?: Array<{
    sql: string
    error: string
  }>
}

export interface GenerationResult {
  sql: string
  confidence: number
  attempts: number
  validation: {
    warnings: string[]
    complexity: number
  }
}

/**
 * Generate SQL with automatic retry on validation failures
 */
export async function generateSQLWithRetry(
  options: GenerationOptions,
  llmProvider?: LLMProvider
): Promise<GenerationResult> {
  const maxRetries = options.maxRetries || 3
  let attempts = 0
  const previousAttempts = options.previousAttempts || []

  while (attempts < maxRetries) {
    attempts++

    // Step 2: Fetch relevant golden queries (RAG)
    let examples: GoldenQuery[] = []
    try {
      // In a server-side context, we might call the DB directly, but here we'll use the API
      // Note: This requires the API to be accessible. If running on server, we could use a direct function.
      // For simplicity in this hybrid file, we'll skip if not in a browser-like env or mock it.
      // Actually, since this runs on the server (API route), we should ideally call a helper function.
      // But for now, let's assume we pass examples in, or fetch them here if possible.
      // To keep it clean, we'll add a 'findSimilarQueries' helper that uses the API URL.
      if (process.env.NEXT_PUBLIC_APP_URL) {
        examples = await findSimilarQueries(options.query)
      }
    } catch (e) {
      console.warn('[SQL Generator] Failed to fetch golden queries:', e)
    }

    // Step 3: Fetch glossary terms
    let glossaryTerms: GlossaryTerm[] = []
    try {
      if (process.env.NEXT_PUBLIC_APP_URL) {
        glossaryTerms = await findGlossaryTerms(options.query)
      }
    } catch (e) {
      console.warn('[SQL Generator] Failed to fetch glossary terms:', e)
    }

    // Build prompt with error feedback from previous attempts
    const prompt = buildPrompt(options.query, options.schemaText, examples, previousAttempts, glossaryTerms)

    // Call LLM (supports multiple providers)
    const sql = await callLLMAPI(prompt, llmProvider)

    // Log generated SQL for debugging
    console.log(`[SQL Generator] Attempt ${attempts} - Generated SQL:`, sql)

    // Validate syntax - use adapter validator if provided, otherwise use generic validator
    const syntaxValidation = options.validator
      ? await options.validator(sql)
      : validateSQL(sql, options.dbType || 'postgresql')

    if (!syntaxValidation.valid) {
      // Syntax error - retry with error feedback
      previousAttempts.push({
        sql,
        error: `Syntax error: ${syntaxValidation.errors.join(', ')}`,
      })

      if (attempts < maxRetries) {
        console.log(`Attempt ${attempts} failed (syntax): Retrying...`)
        continue
      } else {
        throw new Error(`Failed after ${attempts} attempts: ${syntaxValidation.errors.join(', ')}`)
      }
    }

    // Validate against schema
    const schemaValidation = validateAgainstSchema(syntaxValidation, options.schema)

    if (!schemaValidation.valid) {
      // DEBUG: Log schema structure to diagnose validation issues
      console.log('[SQL Generator] Schema validation failed')
      console.log('  Available tables in schema:', Object.keys(options.schema.tables || {}))
      console.log('  Tables extracted from SQL:', syntaxValidation.tables)
      console.log('  Validation errors:', schemaValidation.errors)

      // Schema validation error - retry
      previousAttempts.push({
        sql,
        error: `Schema error: ${schemaValidation.errors.join(', ')}`,
      })

      if (attempts < maxRetries) {
        console.log(`Attempt ${attempts} failed (schema): Retrying...`)
        continue
      } else {
        throw new Error(`Failed after ${attempts} attempts: ${schemaValidation.errors.join(', ')}`)
      }
    }

    // Success! Calculate confidence
    const confidence = calculateConfidence({
      attempts,
      hasWarnings: schemaValidation.warnings.length > 0,
      complexity: syntaxValidation.tables.length + (syntaxValidation.columns.length / 10),
    })

    return {
      sql,
      confidence,
      attempts,
      validation: {
        warnings: schemaValidation.warnings,
        complexity: syntaxValidation.tables.length,
      },
    }
  }

  // Should never reach here due to throw above, but TypeScript needs it
  throw new Error('Max retries exceeded')
}

/**
 * Build prompt with error feedback and dialect-specific guidelines
 */
function buildPrompt(
  query: string,
  schemaText: string,
  examples: GoldenQuery[] = [],
  previousAttempts: Array<{ sql: string; error: string }> = [],
  glossaryTerms: GlossaryTerm[] = []
): string {
  let prompt = `You are an expert SQL query generator. Follow these rules strictly:

1. Generate ONLY valid SQL queries based on the provided schema
2. Use ONLY table names and column names that appear in the DATABASE SCHEMA section
3. DO NOT treat schema qualifiers (like "public") as table names
4. If you see "public.users", the table name is "users", NOT "public"
5. Return ONLY the SQL query without explanations, markdown formatting, or code blocks
6. Do not include semicolons at the end
7. Use proper JOIN syntax with explicit ON conditions
8. Reference foreign key relationships from the schema

CRITICAL: Only use tables and columns that are explicitly listed in the schema provided below.

DATABASE SCHEMA:
${schemaText}`

  if (glossaryTerms.length > 0) {
    prompt += `\n\nBUSINESS GLOSSARY (Use these definitions for specific terms):`
    glossaryTerms.forEach((term) => {
      prompt += `\n- **${term.term}**: ${term.definition}`
      if (term.sql_logic) {
        prompt += ` (SQL Logic: \`${term.sql_logic}\`)`
      }
    })
  }

  if (examples.length > 0) {
    prompt += `\n\nVERIFIED EXAMPLES (Use these as reference for similar queries):`
    examples.forEach((ex, i) => {
      prompt += `\n${i + 1}. Q: "${ex.natural_query}"\n   SQL: ${ex.sql_query}`
    })
  }

  // Add error feedback from previous attempts
  if (previousAttempts.length > 0) {
    prompt += `\n\n⚠️ PREVIOUS ATTEMPTS FAILED:\n`
    previousAttempts.forEach((attempt, idx) => {
      prompt += `\nAttempt ${idx + 1}:\n`
      prompt += `SQL: ${attempt.sql}\n`
      prompt += `Error: ${attempt.error}\n`
      prompt += `\nPlease fix the error and try again. Pay close attention to:\n`
      prompt += `- Table names (they are case-sensitive)\n`
      prompt += `- Column names (make sure they exist in the schema)\n`
      prompt += `- JOIN syntax (always use explicit ON clauses)\n`
    })
  }

  prompt += `\n\nUSER QUESTION: "${query}"\n\nSQL QUERY:`

  return prompt
}

/**
 * Call LLM API (supports multiple providers)
 */
async function callLLMAPI(prompt: string, llmProvider?: LLMProvider): Promise<string> {
  // Use provided provider or create a new one
  const provider = llmProvider || createLLMProvider()

  // Generate completion
  const response = await provider.generateCompletion(prompt)

  let sql = response.content

  // Clean up the SQL (remove code blocks, backticks, etc.)
  sql = sql
    .replace(/```sql\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/`/g, '')
    .trim()

  // Remove trailing semicolon if present
  if (sql.endsWith(';')) {
    sql = sql.slice(0, -1)
  }

  return sql
}

/**
 * Calculate confidence score
 */
function calculateConfidence(factors: {
  attempts: number
  hasWarnings: boolean
  complexity: number
}): number {
  let score = 1.0

  // Penalty for retries
  score -= (factors.attempts - 1) * 0.15 // -15% per retry

  // Penalty for warnings
  if (factors.hasWarnings) {
    score -= 0.05
  }

  // Slight penalty for complex queries
  if (factors.complexity > 5) {
    score -= 0.05
  }

  // Clamp between 0.5 and 1.0
  return Math.max(0.5, Math.min(1.0, score))
}

/**
 * Ambiguity detection result
 */
export interface AmbiguityResult {
  isAmbiguous: boolean
  options?: string[]
  reasoning?: string
}

export interface GoldenQuery {
  natural_query: string
  sql_query: string
}

export interface GlossaryTerm {
  term: string
  definition: string
  sql_logic?: string
}

/**
 * Detect if a user query is ambiguous given the schema
 */
export async function detectAmbiguity(
  query: string,
  schemaText: string,
  llmProvider?: LLMProvider
): Promise<AmbiguityResult> {
  const prompt = `You are an expert data analyst. Your goal is to determine if the user's question is ambiguous and requires clarification before writing a SQL query.

DATABASE SCHEMA:
${schemaText}

USER QUESTION: "${query}"

INSTRUCTIONS:
1. Analyze the question for vague terms (e.g., "best", "top", "recent", "high value") that could have multiple interpretations in the schema.
2. If the question is clear and specific, return { "isAmbiguous": false }.
3. If the question is ambiguous, return { "isAmbiguous": true, "options": ["Option 1", "Option 2"], "reasoning": "Explanation" }.
4. Provide 2-3 distinct, valid options for clarification based on the schema columns.
5. Return ONLY valid JSON.

EXAMPLES:
Q: "Show me top products"
A: { "isAmbiguous": true, "options": ["Top products by Sales Volume", "Top products by Revenue", "Top products by Rating"], "reasoning": "'Top' is vague." }

Q: "Show me users created yesterday"
A: { "isAmbiguous": false }

JSON RESPONSE:`

  const response = await callLLMAPI(prompt, llmProvider)

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : response
    return JSON.parse(jsonStr) as AmbiguityResult
  } catch (e) {
    console.warn('[Ambiguity Detection] Failed to parse JSON:', e)
    return { isAmbiguous: false } // Fail safe
  }
}

/**
 * Generate a natural language explanation of the SQL query
 */
export async function generateExplanation(
  sql: string,
  query: string,
  llmProvider?: LLMProvider
): Promise<string> {
  const prompt = `You are a helpful data assistant. Explain the following SQL query in simple, plain English for a non-technical user.

USER QUESTION: "${query}"

SQL QUERY:
${sql}

INSTRUCTIONS:
1. Start with "I calculated..." or "I retrieved...".
2. Explain the logic: what tables were used, how data was grouped, filtered, or sorted.
3. Do NOT mention specific table names like "t1" or "users_table" unless necessary for clarity. Use business terms (e.g., "users", "orders").
4. Keep it concise (1-2 sentences).

EXAMPLE:
SQL: SELECT product_name, SUM(amount) FROM orders GROUP BY product_name ORDER BY 2 DESC LIMIT 5
Explanation: "I calculated the total sales amount for each product and listed the top 5 products with the highest sales."

EXPLANATION:`

  return await callLLMAPI(prompt, llmProvider)
}

// Helper to fetch similar queries
async function findSimilarQueries(query: string): Promise<GoldenQuery[]> {
  try {
    // We need an absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/golden-queries?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) return []

    const data = await response.json()
    return data.examples || []
  } catch (e) {
    console.warn('Error fetching similar queries:', e)
    return []
  }
}

// Helper to fetch glossary terms
async function findGlossaryTerms(query: string): Promise<GlossaryTerm[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/glossary?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) return []

    const data = await response.json()
    return data.terms || []
  } catch (e) {
    console.warn('Error fetching glossary terms:', e)
    return []
  }
}
