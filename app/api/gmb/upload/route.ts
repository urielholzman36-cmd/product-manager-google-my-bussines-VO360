import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies } from '@/lib/googleAuth'
import { uploadProduct } from '@/lib/gmbClient'

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { product, imageBase64, accountId, locationId } = await req.json()
  if (!product || !accountId || !locationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await uploadProduct(tokens.accessToken, accountId, locationId, product.name, product.category ?? '', product.description ?? '', product.price ?? '', product.landing_page_url ?? '', imageBase64 ?? null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('GMB upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
