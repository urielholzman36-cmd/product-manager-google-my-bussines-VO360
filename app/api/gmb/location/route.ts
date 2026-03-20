import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies, refreshAccessToken } from '@/lib/googleAuth'
import { getLocationId } from '@/lib/gmbClient'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const result = await getLocationId(tokens.accessToken)
    return NextResponse.json(result)
  } catch {
    // Try refreshing token once
    try {
      const newToken = await refreshAccessToken(tokens.refreshToken)
      const result = await getLocationId(newToken)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Failed to get location' }, { status: 500 })
    }
  }
}
