
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('query')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let dbQuery = supabase
            .from('business_glossary')
            .select('*')
            .eq('user_id', user.id)
            .order('term', { ascending: true })

        if (query) {
            // Simple text search
            dbQuery = dbQuery.textSearch('term', query, {
                type: 'websearch',
                config: 'english'
            })
        }

        const { data, error } = await dbQuery

        if (error) throw error

        return NextResponse.json({ terms: data || [] })
    } catch (error: any) {
        console.error('Error fetching glossary:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { term, definition, sqlLogic } = body

        if (!term || !definition) {
            return NextResponse.json({ error: 'Term and definition are required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('business_glossary')
            .insert({
                user_id: user.id,
                term,
                definition,
                sql_logic: sqlLogic
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, term: data })
    } catch (error: any) {
        console.error('Error creating glossary term:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { id, term, definition, sqlLogic } = body

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const { data, error } = await supabase
            .from('business_glossary')
            .update({
                term,
                definition,
                sql_logic: sqlLogic
            })
            .eq('id', id)
            .eq('user_id', user.id) // Security check
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, term: data })
    } catch (error: any) {
        console.error('Error updating glossary term:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const { error } = await supabase
            .from('business_glossary')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id) // Security check

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting glossary term:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
