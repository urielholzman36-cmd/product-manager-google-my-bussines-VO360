import { NextRequest, NextResponse } from 'next/server'
import { getOAuthClient, makeTokenCookies } from '@/lib/googleAuth'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/?error=no_code', req.url))

  try {
    const client = getOAuthClient()
    const { tokens } = await client.getToken(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/?error=no_tokens', req.url))
    }
    const res = NextResponse.redirect(new URL('/', req.url))
    const cookies = makeTokenCookies(tokens.access_token, tokens.refresh_token)
    cookies.forEach(c => res.headers.append('Set-Cookie', c))
    return res
  } catch {
    return NextResponse.redirect(new URL('/?error=oauth_failed', req.url))
  }
}
