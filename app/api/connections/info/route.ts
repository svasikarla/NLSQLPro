import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConnectionRegistry, getProviderInfo } from '@/lib/connection-manager/connection-registry'
import { getActiveConnection, getUserConnections } from '@/lib/connection-manager'

/**
 * GET /api/connections/info
 * Get detailed connection information including provider hints and recommendations
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

    let connection

    if (connectionId) {
      // Get specific connection
      const connections = await getUserConnections(user.id)
      connection = connections.find(c => c.id === connectionId)

      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        )
      }
    } else {
      // Get active connection
      connection = await getActiveConnection(user.id)

      if (!connection) {
        return NextResponse.json(
          { error: 'No active connection' },
          { status: 400 }
        )
      }
    }

    // Get provider information
    const providerInfo = getProviderInfo(connection)

    // Get recommended settings
    const recommendedTimeout = ConnectionRegistry.getRecommendedTimeout(connection)
    const sslConfig = ConnectionRegistry.getSSLConfig(connection)

    // Get manager for additional info
    const manager = ConnectionRegistry.getManagerForConnection(connection) as any

    // Get validation
    const validation = ConnectionRegistry.validateConnection(connection)

    // Get metrics if available
    const metrics = ConnectionRegistry.getMetrics(connection.db_type, connection.id)

    // Build response
    const response: any = {
      connection: {
        id: connection.id,
        name: connection.name,
        db_type: connection.db_type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        is_active: connection.is_active,
      },
      provider: {
        name: providerInfo.provider,
        isCloud: providerInfo.isCloud,
        hints: providerInfo.hints,
      },
      settings: {
        defaultPort: manager.getDefaultPort(),
        recommendedTimeout,
        sslRequired: !!sslConfig,
        sslConfig: sslConfig ? 'Configured' : 'Not required',
      },
      validation: {
        isValid: validation.valid,
        errors: validation.errors,
      },
    }

    // Add metrics if available
    if (metrics) {
      response.metrics = {
        successRate: ((metrics.successfulConnections / metrics.totalConnections) * 100).toFixed(1) + '%',
        totalAttempts: metrics.totalConnections,
        successful: metrics.successfulConnections,
        failed: metrics.failedConnections,
        avgConnectionTime: metrics.avgConnectionTime.toFixed(0) + 'ms',
        lastConnection: metrics.lastConnectionTime,
        health: metrics.health,
      }
    }

    // Add database-specific helpers if available
    if (manager.getProvider) {
      response.databaseInfo = {
        type: manager.getDatabaseType(),
        defaultPort: manager.getDefaultPort(),
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching connection info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connection information' },
      { status: 500 }
    )
  }
}
