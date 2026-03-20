import { buildAuthUrl, parseTokenCookies } from '@/lib/googleAuth'

describe('googleAuth', () => {
  it('buildAuthUrl returns a Google OAuth URL', () => {
    const url = buildAuthUrl()
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth')
    expect(url).toContain('business.manage')
    expect(url).toContain('access_type=offline')
  })

  it('parseTokenCookies returns null when cookies are missing', () => {
    const result = parseTokenCookies('')
    expect(result).toBeNull()
  })

  it('parseTokenCookies returns tokens when cookies are present', () => {
    const cookieStr = 'gmb_access_token=abc123; gmb_refresh_token=refresh456'
    const result = parseTokenCookies(cookieStr)
    expect(result?.accessToken).toBe('abc123')
    expect(result?.refreshToken).toBe('refresh456')
  })
})
