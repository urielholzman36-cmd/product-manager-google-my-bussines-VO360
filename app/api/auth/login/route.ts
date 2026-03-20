import { NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/googleAuth'

export function GET() {
  const url = buildAuthUrl()
  return NextResponse.redirect(url)
}
