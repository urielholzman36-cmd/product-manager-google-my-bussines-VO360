import { NextRequest, NextResponse } from 'next/server'
import { generateDescription } from '@/lib/claudeClient'

export async function POST(req: NextRequest) {
  const { productName, imageBase64 } = await req.json()
  if (!productName) return NextResponse.json({ error: 'productName is required' }, { status: 400 })

  try {
    const description = await generateDescription(productName, imageBase64 ?? null)
    return NextResponse.json({ description })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 })
  }
}
