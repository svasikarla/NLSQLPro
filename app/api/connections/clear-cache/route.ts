import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearAdapterCache } from '@/lib/connection-manager'

/**
 * Clear connection adapter cache
 * Forces reconnection with fresh SSL settings
 */
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
    const connectionId = body.connectionId

    // Clear cache
    await clearAdapterCache(user.id, connectionId)

    console.log(`[Cache] Cleared adapter cache for connection ${connectionId}`)

    return NextResponse.json({
      success: true,
      message: 'Connection cache cleared successfully',
    })
  } catch (error) {
    console.error('Error clearing adapter cache:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
