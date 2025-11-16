/**
 * SQL Generation with automatic retry on validation failures
 */

import Anthropic from '@anthropic-ai/sdk'
import { validateSQL, validateAgainstSchema, type SchemaInfo } from '@/lib/validation/sql-validator'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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
  options: GenerationOptions
): Promise<GenerationResult> {
  const maxRetries = options.maxRetries || 3
  let attempts = 0
  const previousAttempts = options.previousAttempts || []

  while (attempts < maxRetries) {
    attempts++

    // Build prompt with error feedback from previous attempts
    const prompt = buildPrompt(options, previousAttempts)

    // Call LLM
    const sql = await callClaudeAPI(prompt)

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
  options: GenerationOptions,
  previousAttempts: Array<{ sql: string; error: string }>
): string {
  // Determine SQL dialect (default to PostgreSQL for backward compatibility)
  const dialect = options.sqlDialect || 'PostgreSQL'

  let prompt = `You are an expert ${dialect} query generator with deep understanding of database relationships.

DATABASE SCHEMA:
${options.schemaText}
`

  // Add dialect-specific guidelines if provided, otherwise use default rules
  if (options.dialectGuidelines) {
    prompt += `\n${options.dialectGuidelines}\n`
  } else {
    // Fallback to generic rules if adapter guidelines not provided
    prompt += `
CRITICAL RULES:
1. Only generate SELECT queries (read-only)
2. Use proper ${dialect} syntax
3. Use the relationships shown above to write correct JOINs
4. Include appropriate row limit for safety (max 100 rows unless user specifies otherwise)
5. Return ONLY the SQL query, no explanations, no markdown formatting, no code blocks
6. Do not include semicolon at the end
7. When joining tables, ALWAYS use the foreign key relationships shown above
8. Use table aliases for clarity (e.g., u for users, o for orders)
9. If the query involves multiple tables, use explicit JOIN conditions based on the relationships

IMPORTANT JOIN INSTRUCTIONS:
- NEVER create joins without looking at the relationships section
- Use INNER JOIN for required relationships
- Use LEFT JOIN when the relationship is optional
- ALWAYS specify the ON condition explicitly
`
  }

  // Add example queries if provided (few-shot learning)
  if (options.exampleQueries && options.exampleQueries.length > 0) {
    prompt += `\n📚 EXAMPLE ${dialect.toUpperCase()} QUERIES:\n`
    options.exampleQueries.forEach((example, idx) => {
      prompt += `${idx + 1}. ${example}\n`
    })
    prompt += '\n'
  }

  // Add error feedback from previous attempts
  if (previousAttempts.length > 0) {
    prompt += `\n⚠️ PREVIOUS ATTEMPTS FAILED:\n`
    previousAttempts.forEach((attempt, idx) => {
      prompt += `\nAttempt ${idx + 1}:\n`
      prompt += `SQL: ${attempt.sql}\n`
      prompt += `Error: ${attempt.error}\n`
      prompt += `\nPlease fix the error and try again. Pay close attention to:\n`
      prompt += `- Table names (they are case-sensitive)\n`
      prompt += `- Column names (make sure they exist in the schema)\n`
      prompt += `- ${dialect}-specific syntax (refer to the guidelines above)\n`
      prompt += `- JOIN syntax (always use explicit ON clauses)\n`
    })
  }

  prompt += `\nUSER QUERY:\n"${options.query}"\n\nGenerate the ${dialect} SQL query now:`

  return prompt
}

/**
 * Call Claude API
 */
async function callClaudeAPI(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract SQL from response
  let sql = ''
  for (const block of message.content) {
    if (block.type === 'text') {
      sql = block.text.trim()
      break
    }
  }

  // Clean up the SQL
  sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim()

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
