import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserConnections } from '@/lib/connection-manager'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's connections
    const connections = await getUserConnections(user.id)

    // Don't send passwords to the client
    const sanitizedConnections = connections.map((conn) => ({
      id: conn.id,
      name: conn.name,
      db_type: conn.db_type,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      is_active: conn.is_active,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
      // Omit password
    }))

    return NextResponse.json({ connections: sanitizedConnections })
  } catch (error) {
    console.error('Error listing connections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}
