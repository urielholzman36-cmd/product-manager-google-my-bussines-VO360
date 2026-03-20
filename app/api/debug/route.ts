import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies } from '@/lib/googleAuth'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('accountId')
  if (accountId) {
    const locRes = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const locData = await locRes.json()
    return NextResponse.json({ accountId, locations: locData })
  }

  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  })
  const accountsRaw = await accountsRes.json()

  if (!accountsRes.ok) {
    return NextResponse.json({ status: accountsRes.status, error: accountsRaw })
  }

  const results = []
  for (const account of accountsRaw.accounts ?? []) {
    const accountId = account.name?.split('/')[1]
    const locRes = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const locData = await locRes.json()
    results.push({ accountId, accountName: account.accountName, locations: locData })
  }

  return NextResponse.json({ accountsRaw, results })
}
