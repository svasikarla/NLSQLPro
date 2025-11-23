import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConnectionRegistry } from '@/lib/connection-manager/connection-registry'
import { getActiveConnection } from '@/lib/connection-manager'

/**
 * GET /api/connections/metrics
 * Get connection metrics for active connection or specific connection
 */
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

    // Get connection ID from query params (optional)
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const dbType = searchParams.get('dbType')

    // If specific connection requested
    if (connectionId && dbType) {
      const metrics = ConnectionRegistry.getMetrics(dbType, connectionId)

      if (!metrics) {
        return NextResponse.json(
          { error: 'No metrics found for this connection' },
          { status: 404 }
        )
      }

      return NextResponse.json({ metrics })
    }

    // Get active connection metrics
    const activeConnection = await getActiveConnection(user.id)

    if (!activeConnection) {
      return NextResponse.json(
        { error: 'No active connection' },
        { status: 400 }
      )
    }

    const metrics = ConnectionRegistry.getMetrics(
      activeConnection.db_type,
      activeConnection.id
    )

    if (!metrics) {
      return NextResponse.json(
        {
          message: 'No metrics recorded yet',
          connectionId: activeConnection.id,
          dbType: activeConnection.db_type,
        },
        { status: 200 }
      )
    }

    // Get provider info
    const providerInfo = ConnectionRegistry.getProviderInfo(activeConnection)

    return NextResponse.json({
      metrics,
      provider: providerInfo.provider,
      isCloud: providerInfo.isCloud,
      connection: {
        id: activeConnection.id,
        name: activeConnection.name,
        db_type: activeConnection.db_type,
        host: activeConnection.host,
        port: activeConnection.port,
      },
    })
  } catch (error) {
    console.error('Error fetching connection metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connection metrics' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/connections/metrics
 * Reset metrics for a connection
 */
export async function DELETE(request: NextRequest) {
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

    // Get parameters
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const dbType = searchParams.get('dbType')

    if (!dbType) {
      return NextResponse.json(
        { error: 'dbType is required' },
        { status: 400 }
      )
    }

    // Reset metrics
    ConnectionRegistry.resetMetrics(dbType, connectionId || undefined)

    return NextResponse.json({
      success: true,
      message: connectionId
        ? `Metrics reset for connection ${connectionId}`
        : `All metrics reset for ${dbType}`,
    })
  } catch (error) {
    console.error('Error resetting connection metrics:', error)
    return NextResponse.json(
      { error: 'Failed to reset connection metrics' },
      { status: 500 }
    )
  }
}
