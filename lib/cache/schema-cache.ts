/**
 * Schema Caching Module
 * Implements 24-hour TTL cache for database schema metadata
 * Reduces database introspection overhead and improves performance
 */

import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export interface CachedSchema {
  id: string
  connection_id: string
  schema_data: any  // The actual schema object
  schema_hash: string
  table_count: number
  total_columns: number
  cached_at: string
  expires_at: string
  last_accessed_at: string
}

/**
 * Generate hash of schema for staleness detection
 * Hash is based on table names and column names (sorted)
 */
export function generateSchemaHash(schema: any): string {
  const fingerprint: string[] = []

  // Extract table names and column names
  if (schema.tables) {
    for (const table of schema.tables) {
      fingerprint.push(`table:${table.name}`)

      if (table.columns) {
        for (const column of table.columns) {
          fingerprint.push(`column:${table.name}.${column.name}:${column.type}`)
        }
      }
    }
  }

  // Sort for consistent hashing
  fingerprint.sort()

  // Create MD5 hash
  return crypto
    .createHash('md5')
    .update(fingerprint.join('|'))
    .digest('hex')
}

/**
 * Calculate schema statistics
 */
function calculateSchemaStats(schema: any): { tableCount: number; totalColumns: number } {
  let tableCount = 0
  let totalColumns = 0

  if (schema.tables) {
    tableCount = schema.tables.length
    for (const table of schema.tables) {
      if (table.columns) {
        totalColumns += table.columns.length
      }
    }
  }

  return { tableCount, totalColumns }
}

/**
 * Get cached schema for a connection
 * Returns null if cache miss or expired
 */
export async function getCachedSchema(connectionId: string): Promise<any | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('schema_cache')
      .select('*')
      .eq('connection_id', connectionId)
      .single()

    if (error || !data) {
      return null
    }

    const cache = data as CachedSchema

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(cache.expires_at)

    if (now > expiresAt) {
      console.log(`[Schema Cache] Expired for connection ${connectionId}`)
      // Clean up expired cache
      await deleteCachedSchema(connectionId)
      return null
    }

    console.log(`[Schema Cache] HIT for connection ${connectionId}`)
    console.log(`  Tables: ${cache.table_count}, Columns: ${cache.total_columns}`)
    console.log(`  Cached at: ${new Date(cache.cached_at).toLocaleString()}`)
    console.log(`  Expires at: ${new Date(cache.expires_at).toLocaleString()}`)

    // Update last accessed time
    await supabase
      .from('schema_cache')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('connection_id', connectionId)

    return cache.schema_data
  } catch (error) {
    console.error('[Schema Cache] Error retrieving cache:', error)
    return null
  }
}

/**
 * Save schema to cache
 * Creates new cache entry or updates existing one
 */
export async function setCachedSchema(
  connectionId: string,
  schema: any
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const schemaHash = generateSchemaHash(schema)
    const { tableCount, totalColumns } = calculateSchemaStats(schema)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    const cacheData = {
      connection_id: connectionId,
      schema_data: schema,
      schema_hash: schemaHash,
      table_count: tableCount,
      total_columns: totalColumns,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_accessed_at: now.toISOString(),
    }

    // Upsert (insert or update)
    const { error } = await supabase
      .from('schema_cache')
      .upsert(cacheData, {
        onConflict: 'connection_id',
      })

    if (error) {
      console.error('[Schema Cache] Error saving cache:', error)
      return false
    }

    console.log(`[Schema Cache] SAVED for connection ${connectionId}`)
    console.log(`  Hash: ${schemaHash}`)
    console.log(`  Tables: ${tableCount}, Columns: ${totalColumns}`)
    console.log(`  Expires: ${expiresAt.toLocaleString()}`)

    return true
  } catch (error) {
    console.error('[Schema Cache] Error saving cache:', error)
    return false
  }
}

/**
 * Delete cached schema for a connection
 */
export async function deleteCachedSchema(connectionId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('schema_cache')
      .delete()
      .eq('connection_id', connectionId)

    if (error) {
      console.error('[Schema Cache] Error deleting cache:', error)
      return false
    }

    console.log(`[Schema Cache] DELETED for connection ${connectionId}`)
    return true
  } catch (error) {
    console.error('[Schema Cache] Error deleting cache:', error)
    return false
  }
}

/**
 * Validate cached schema against current database schema
 * Returns true if cache is still valid (no schema changes)
 */
export async function validateCachedSchema(
  connectionId: string,
  currentSchema: any
): Promise<boolean> {
  try {
    const cachedSchema = await getCachedSchema(connectionId)

    if (!cachedSchema) {
      return false
    }

    // Generate hash of current schema
    const currentHash = generateSchemaHash(currentSchema)

    // Get cached hash
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('schema_cache')
      .select('schema_hash')
      .eq('connection_id', connectionId)
      .single()

    if (error || !data) {
      return false
    }

    const cachedHash = data.schema_hash

    // Compare hashes
    const isValid = currentHash === cachedHash

    if (!isValid) {
      console.log(`[Schema Cache] INVALIDATED - Schema changed for connection ${connectionId}`)
      console.log(`  Cached hash: ${cachedHash}`)
      console.log(`  Current hash: ${currentHash}`)
      // Delete stale cache
      await deleteCachedSchema(connectionId)
    }

    return isValid
  } catch (error) {
    console.error('[Schema Cache] Error validating cache:', error)
    return false
  }
}

/**
 * Clean up expired caches (run periodically)
 */
export async function cleanupExpiredCaches(): Promise<number> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('schema_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select()

    if (error) {
      console.error('[Schema Cache] Error cleaning up expired caches:', error)
      return 0
    }

    const count = data?.length || 0
    if (count > 0) {
      console.log(`[Schema Cache] Cleaned up ${count} expired cache(s)`)
    }

    return count
  } catch (error) {
    console.error('[Schema Cache] Error cleaning up expired caches:', error)
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalCaches: number
  expiredCaches: number
  activeCaches: number
  avgTableCount: number
  avgColumnCount: number
}> {
  try {
    const supabase = await createClient()

    const { data: allCaches, error } = await supabase
      .from('schema_cache')
      .select('*')

    if (error || !allCaches) {
      return {
        totalCaches: 0,
        expiredCaches: 0,
        activeCaches: 0,
        avgTableCount: 0,
        avgColumnCount: 0,
      }
    }

    const now = new Date()
    const expired = allCaches.filter(c => new Date(c.expires_at) < now)
    const active = allCaches.filter(c => new Date(c.expires_at) >= now)

    const avgTableCount = active.length > 0
      ? active.reduce((sum, c) => sum + c.table_count, 0) / active.length
      : 0

    const avgColumnCount = active.length > 0
      ? active.reduce((sum, c) => sum + c.total_columns, 0) / active.length
      : 0

    return {
      totalCaches: allCaches.length,
      expiredCaches: expired.length,
      activeCaches: active.length,
      avgTableCount: Math.round(avgTableCount),
      avgColumnCount: Math.round(avgColumnCount),
    }
  } catch (error) {
    console.error('[Schema Cache] Error getting stats:', error)
    return {
      totalCaches: 0,
      expiredCaches: 0,
      activeCaches: 0,
      avgTableCount: 0,
      avgColumnCount: 0,
    }
  }
}
