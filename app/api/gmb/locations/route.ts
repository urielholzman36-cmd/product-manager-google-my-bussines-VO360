import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies, refreshAccessToken } from '@/lib/googleAuth'
import { getAllLocations } from '@/lib/gmbClient'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated — please click Connect with Google first' }, { status: 401 })

  try {
    const locations = await getAllLocations(tokens.accessToken)
    return NextResponse.json({ locations })
  } catch (err) {
    try {
      const newToken = await refreshAccessToken(tokens.refreshToken)
      const locations = await getAllLocations(newToken)
      return NextResponse.json({ locations })
    } catch (err2) {
      const message = err2 instanceof Error ? err2.message : String(err2)
      const original = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message, original }, { status: 500 })
    }
  }
}
