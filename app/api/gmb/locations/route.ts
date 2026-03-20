import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies, refreshAccessToken } from '@/lib/googleAuth'
import { getAllLocations } from '@/lib/gmbClient'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const locations = await getAllLocations(tokens.accessToken)
    return NextResponse.json({ locations })
  } catch {
    try {
      const newToken = await refreshAccessToken(tokens.refreshToken)
      const locations = await getAllLocations(newToken)
      return NextResponse.json({ locations })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }
  }
}
