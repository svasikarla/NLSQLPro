import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConnection, ConnectionConfig } from '@/lib/connection-manager'

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const config: ConnectionConfig = {
      name: body.name,
      db_type: body.db_type || 'postgresql',
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      password: body.password,
    }

    // Create connection
    const result = await createConnection(user.id, config)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Don't send password back to client
    const sanitizedConnection = {
      id: result.connection!.id,
      name: result.connection!.name,
      db_type: result.connection!.db_type,
      host: result.connection!.host,
      port: result.connection!.port,
      database: result.connection!.database,
      username: result.connection!.username,
      is_active: result.connection!.is_active,
      created_at: result.connection!.created_at,
      updated_at: result.connection!.updated_at,
    }

    return NextResponse.json({
      success: true,
      connection: sanitizedConnection,
    })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    )
  }
}
