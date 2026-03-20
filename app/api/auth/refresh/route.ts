import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies, refreshAccessToken, makeTokenCookies } from '@/lib/googleAuth'

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'No token' }, { status: 401 })

  try {
    const newAccessToken = await refreshAccessToken(tokens.refreshToken)
    const res = NextResponse.json({ ok: true })
    const cookies = makeTokenCookies(newAccessToken, tokens.refreshToken)
    cookies.forEach(c => res.headers.append('Set-Cookie', c))
    return res
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
  }
}
