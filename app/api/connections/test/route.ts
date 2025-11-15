import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testConnection, ConnectionConfig } from '@/lib/connection-manager'
import {
  checkConnectionTestLimit,
  getRateLimitHeaders,
  logRateLimitEvent,
} from '@/lib/ratelimit/rate-limiter'

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

    // RATE LIMITING: Check connection test limit
    const rateLimitResult = await checkConnectionTestLimit(user.id)
    logRateLimitEvent(user.id, "connection_test", rateLimitResult)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: rateLimitResult.message || "Rate limit exceeded for connection testing",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429, // Too Many Requests
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const config: ConnectionConfig = {
      name: body.name || 'Test Connection',
      db_type: body.db_type || 'postgresql',
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      password: body.password,
    }

    // Test connection
    const result = await testConnection(config)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
      },
      {
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
