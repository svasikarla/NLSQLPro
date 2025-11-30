
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { naturalQuery, sqlQuery, metadata } = body

        if (!naturalQuery || !sqlQuery) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('golden_queries')
            .insert({
                user_id: user.id,
                natural_query: naturalQuery,
                sql_query: sqlQuery,
                metadata: metadata || {}
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error('Error saving golden query:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('query')

        if (!query) {
            return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
        }

        // Simple full-text search using websearch_to_tsquery
        // In a real production app with pgvector, we would use embeddings here.
        const { data, error } = await supabase
            .from('golden_queries')
            .select('natural_query, sql_query')
            .textSearch('natural_query', query, {
                type: 'websearch',
                config: 'english'
            })
            .limit(3)

        if (error) throw error

        return NextResponse.json({ examples: data || [] })
    } catch (error: any) {
        console.error('Error searching golden queries:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
