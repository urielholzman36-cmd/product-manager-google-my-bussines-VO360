import { buildProductPayload } from '@/lib/gmbClient'

describe('gmbClient', () => {
  it('builds product payload with price', () => {
    const payload = buildProductPayload('Wallet', 'Great wallet', '49.99')
    expect(payload.name).toBe('Wallet')
    expect(payload.description).toBe('Great wallet')
    expect(payload.price?.units).toBe('49')
    expect(payload.price?.nanos).toBe(990000000)
  })

  it('builds product payload without price when empty', () => {
    const payload = buildProductPayload('Wallet', 'Great wallet', '')
    expect(payload.price).toBeUndefined()
  })
})
