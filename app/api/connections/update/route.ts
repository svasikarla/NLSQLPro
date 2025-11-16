import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateConnection } from '@/lib/connection-manager'

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

    if (!body.connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    if (!body.name) {
      return NextResponse.json(
        { error: 'Connection name is required' },
        { status: 400 }
      )
    }

    // Build config object with only provided fields
    const config: any = {
      name: body.name,
    }

    if (body.host !== undefined) config.host = body.host
    if (body.port !== undefined) config.port = body.port
    if (body.database !== undefined) config.database = body.database
    if (body.username !== undefined) config.username = body.username
    if (body.db_type !== undefined) config.db_type = body.db_type
    if (body.password) config.password = body.password

    // Update connection
    const result = await updateConnection(user.id, body.connectionId, config)

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
    console.error('Error updating connection:', error)
    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    )
  }
}
