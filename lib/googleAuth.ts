import { OAuth2Client } from 'google-auth-library'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!
const SCOPES = ['https://www.googleapis.com/auth/business.manage']

export function getOAuthClient() {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export function buildAuthUrl(): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export function parseTokenCookies(cookieHeader: string): TokenPair | null {
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=')
    if (k && v) cookies[k.trim()] = v.trim()
  })
  const accessToken = cookies['gmb_access_token']
  const refreshToken = cookies['gmb_refresh_token']
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

export function makeTokenCookies(accessToken: string, refreshToken: string): string[] {
  const opts = 'HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/'
  return [
    `gmb_access_token=${accessToken}; ${opts}`,
    `gmb_refresh_token=${refreshToken}; ${opts}`,
  ]
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const client = getOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  if (!credentials.access_token) throw new Error('Failed to refresh access token')
  return credentials.access_token
}
