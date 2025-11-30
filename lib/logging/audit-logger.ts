import { createClient } from '@/lib/supabase/server'

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface SecurityEvent {
    userId: string
    eventType: string
    severity: SecurityEventSeverity
    details: Record<string, any>
    ipAddress?: string
    userAgent?: string
}

export interface QueryHistoryEntry {
    userId: string
    connectionId: string
    nlQuery: string
    generatedSql: string
    executed?: boolean
    executionTimeMs?: number
    rowCount?: number
    errorMessage?: string
    parentQueryId?: string
}

/**
 * Log a security incident to the database
 */
export async function logSecurityEvent(event: SecurityEvent) {
    try {
        const supabase = await createClient()

        const { error } = await supabase.from('security_logs').insert({
            user_id: event.userId,
            event_type: event.eventType,
            severity: event.severity,
            details: event.details,
            ip_address: event.ipAddress,
            user_agent: event.userAgent,
        })

        if (error) {
            console.error('Failed to log security event:', error)
        }
    } catch (error) {
        console.error('Error logging security event:', error)
    }
}

/**
 * Log a query generation or execution to history
 */
export async function logQueryHistory(entry: QueryHistoryEntry) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('query_history')
            .insert({
                user_id: entry.userId,
                connection_id: entry.connectionId,
                nl_query: entry.nlQuery,
                generated_sql: entry.generatedSql,
                executed: entry.executed ?? false,
                execution_time_ms: entry.executionTimeMs,
                row_count: entry.rowCount,
                error_message: entry.errorMessage,
                parent_query_id: entry.parentQueryId,
            })
            .select('id')
            .single()

        if (error) {
            console.error('Failed to log query history:', error)
            return null
        }

        return data.id
    } catch (error) {
        console.error('Error logging query history:', error)
        return null
    }
}

/**
 * Update an existing query history entry (e.g. after execution)
 */
export async function updateQueryHistory(
    id: string,
    updates: Partial<Omit<QueryHistoryEntry, 'userId' | 'connectionId'>>
) {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('query_history')
            .update({
                executed: updates.executed,
                execution_time_ms: updates.executionTimeMs,
                row_count: updates.rowCount,
                error_message: updates.errorMessage,
            })
            .eq('id', id)

        if (error) {
            console.error('Failed to update query history:', error)
        }
    } catch (error) {
        console.error('Error updating query history:', error)
    }
}

/**
 * Find the most recent unexecuted query history entry for a user and SQL
 */
export async function findPendingQuery(
    userId: string,
    sql: string
): Promise<string | null> {
    try {
        const supabase = await createClient()

        // Normalize SQL for comparison (basic trimming)
        const normalizedSql = sql.trim()

        const { data, error } = await supabase
            .from('query_history')
            .select('id')
            .eq('user_id', userId)
            .eq('generated_sql', normalizedSql)
            .eq('executed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error || !data) {
            return null
        }

        return data.id
    } catch (error) {
        return null
    }
}
