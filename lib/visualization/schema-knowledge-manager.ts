/**
 * Schema Knowledge Manager
 *
 * Manages persistence of schema knowledge base in Supabase.
 * Provides CRUD operations for enriched schema metadata.
 */

import { createClient } from '@/lib/supabase/server'
import { SchemaInfo } from '@/lib/database/types/schema'
import { buildSchemaKnowledge, SchemaKnowledge, EnrichedColumnMetadata } from './schema-knowledge'

/**
 * Get schema knowledge for a database connection
 * Returns cached knowledge from database or builds fresh if not available
 */
export async function getSchemaKnowledge(
  connectionId: string
): Promise<SchemaKnowledge | null> {
  try {
    const supabase = await createClient()

    // Try to fetch from database
    const { data, error } = await supabase
      .from('schema_knowledge_base')
      .select('*')
      .eq('connection_id', connectionId)

    if (error) {
      console.error('[Schema Knowledge] Error fetching:', error)
      return null
    }

    if (!data || data.length === 0) {
      console.log('[Schema Knowledge] No cached knowledge found for connection:', connectionId)
      return null
    }

    // Reconstruct SchemaKnowledge from database rows
    const tables = new Map<string, EnrichedColumnMetadata[]>()

    for (const row of data) {
      const tableName = row.table_name
      if (!tables.has(tableName)) {
        tables.set(tableName, [])
      }

      const enrichedColumn: EnrichedColumnMetadata = {
        columnName: row.column_name,
        dbType: row.db_type,
        semanticType: row.semantic_type,
        cardinality: row.cardinality_estimate,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        foreignKeyTo: row.fk_table && row.fk_column ? {
          table: row.fk_table,
          column: row.fk_column
        } : undefined,
        isNullable: row.is_nullable,
        isUnique: row.is_unique,
        isAutoIncrement: row.is_auto_increment,
        hasDefault: row.has_default,
        confidence: row.confidence,
        reasoning: Array.isArray(row.reasoning) ? row.reasoning : []
      }

      tables.get(tableName)!.push(enrichedColumn)
    }

    console.log(`[Schema Knowledge] Loaded knowledge for ${tables.size} tables`)

    return {
      connectionId,
      tables,
      relationships: [], // Will be populated from schema_cache if needed
      lastUpdated: new Date(data[0].created_at)
    }
  } catch (error) {
    console.error('[Schema Knowledge] Error loading:', error)
    return null
  }
}

/**
 * Save schema knowledge to database
 * Builds knowledge from SchemaInfo and persists to Supabase
 */
export async function saveSchemaKnowledge(
  connectionId: string,
  schemaInfo: SchemaInfo
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Build enriched schema knowledge
    const schemaKnowledge = buildSchemaKnowledge(connectionId, schemaInfo)

    // Convert to database rows
    const rows: any[] = []
    for (const [tableName, columns] of schemaKnowledge.tables.entries()) {
      for (const column of columns) {
        rows.push({
          connection_id: connectionId,
          table_name: tableName,
          column_name: column.columnName,
          db_type: column.dbType,
          is_nullable: column.isNullable,
          is_primary_key: column.isPrimaryKey,
          is_foreign_key: column.isForeignKey,
          is_unique: column.isUnique ?? false,
          is_auto_increment: column.isAutoIncrement ?? false,
          has_default: column.hasDefault ?? false,
          fk_table: column.foreignKeyTo?.table ?? null,
          fk_column: column.foreignKeyTo?.column ?? null,
          semantic_type: column.semanticType,
          cardinality_estimate: column.cardinality,
          confidence: column.confidence,
          reasoning: column.reasoning
        })
      }
    }

    console.log(`[Schema Knowledge] Saving ${rows.length} columns for connection ${connectionId}`)

    // Delete existing knowledge for this connection
    const { error: deleteError } = await supabase
      .from('schema_knowledge_base')
      .delete()
      .eq('connection_id', connectionId)

    if (deleteError) {
      console.error('[Schema Knowledge] Error deleting old knowledge:', deleteError)
      return false
    }

    // Insert new knowledge
    const { error: insertError } = await supabase
      .from('schema_knowledge_base')
      .insert(rows)

    if (insertError) {
      console.error('[Schema Knowledge] Error inserting knowledge:', insertError)
      return false
    }

    console.log(`[Schema Knowledge] Successfully saved knowledge for connection ${connectionId}`)
    return true
  } catch (error) {
    console.error('[Schema Knowledge] Error saving:', error)
    return false
  }
}

/**
 * Delete schema knowledge for a connection
 */
export async function deleteSchemaKnowledge(connectionId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('schema_knowledge_base')
      .delete()
      .eq('connection_id', connectionId)

    if (error) {
      console.error('[Schema Knowledge] Error deleting:', error)
      return false
    }

    console.log(`[Schema Knowledge] Deleted knowledge for connection ${connectionId}`)
    return true
  } catch (error) {
    console.error('[Schema Knowledge] Error deleting:', error)
    return false
  }
}

/**
 * Get or build schema knowledge
 * First tries to load from database, falls back to building from SchemaInfo
 */
export async function getOrBuildSchemaKnowledge(
  connectionId: string,
  schemaInfo?: SchemaInfo
): Promise<SchemaKnowledge | null> {
  // Try to load cached knowledge
  const cachedKnowledge = await getSchemaKnowledge(connectionId)
  if (cachedKnowledge) {
    return cachedKnowledge
  }

  // If no cache and schemaInfo provided, build and save
  if (schemaInfo) {
    console.log('[Schema Knowledge] Building fresh knowledge from schema')
    const newKnowledge = buildSchemaKnowledge(connectionId, schemaInfo)

    // Save to database for future use
    await saveSchemaKnowledge(connectionId, schemaInfo)

    return newKnowledge
  }

  console.log('[Schema Knowledge] No cached knowledge and no schema provided')
  return null
}

/**
 * Invalidate schema knowledge when schema changes
 * Should be called when schema cache is refreshed
 */
export async function invalidateSchemaKnowledge(connectionId: string): Promise<boolean> {
  console.log(`[Schema Knowledge] Invalidating knowledge for connection ${connectionId}`)
  return deleteSchemaKnowledge(connectionId)
}

/**
 * Get statistics about schema knowledge coverage
 */
export async function getSchemaKnowledgeStats(connectionId: string): Promise<{
  totalTables: number
  totalColumns: number
  semanticTypeBreakdown: Record<string, number>
  confidenceBreakdown: Record<string, number>
} | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('schema_knowledge_base')
      .select('semantic_type, confidence')
      .eq('connection_id', connectionId)

    if (error || !data) {
      return null
    }

    // Count unique tables
    const { data: tableData, error: tableError } = await supabase
      .from('schema_knowledge_base')
      .select('table_name')
      .eq('connection_id', connectionId)

    const totalTables = tableData ? new Set(tableData.map(r => r.table_name)).size : 0

    // Build breakdowns
    const semanticTypeBreakdown: Record<string, number> = {}
    const confidenceBreakdown: Record<string, number> = {}

    for (const row of data) {
      semanticTypeBreakdown[row.semantic_type] = (semanticTypeBreakdown[row.semantic_type] || 0) + 1
      confidenceBreakdown[row.confidence] = (confidenceBreakdown[row.confidence] || 0) + 1
    }

    return {
      totalTables,
      totalColumns: data.length,
      semanticTypeBreakdown,
      confidenceBreakdown
    }
  } catch (error) {
    console.error('[Schema Knowledge] Error getting stats:', error)
    return null
  }
}
