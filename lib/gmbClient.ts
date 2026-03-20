interface Price {
  currencyCode: string
  units: string
  nanos: number
}

interface ProductPayload {
  name: string
  category: string
  description: string
  price?: Price
  url?: string
  languageCode: string
}

export function buildProductPayload(name: string, category: string, description: string, price: string, landingPageUrl: string): ProductPayload {
  const payload: ProductPayload = { name, category, description, languageCode: 'en' }
  if (price && !isNaN(parseFloat(price))) {
    const num = parseFloat(price)
    const units = Math.floor(num).toString()
    const nanos = Math.round((num - Math.floor(num)) * 1_000_000_000)
    payload.price = { currencyCode: 'USD', units, nanos }
  }
  if (landingPageUrl) payload.url = landingPageUrl
  return payload
}

async function uploadImageToGMB(accessToken: string, accountId: string, locationId: string, imageBase64: string): Promise<string | null> {
  // Upload image to GMB media endpoint via multipart upload, returns media resource name
  const mediaUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`

  // Convert base64 to binary
  const binaryStr = atob(imageBase64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  const imageBlob = new Blob([bytes], { type: 'image/jpeg' })

  // Build multipart body
  const formData = new FormData()
  formData.append('json', new Blob([JSON.stringify({ mediaFormat: 'PHOTO' })], { type: 'application/json' }))
  formData.append('file', imageBlob, 'product.jpg')

  const res = await fetch(mediaUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    // Do NOT set Content-Type manually — browser sets it with the multipart boundary automatically
    body: formData,
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.name ?? null // media resource name used as reference in product payload
}

export async function uploadProduct(
  accessToken: string,
  accountId: string,
  locationId: string,
  productName: string,
  category: string,
  description: string,
  price: string,
  landingPageUrl: string,
  imageBase64: string | null
): Promise<void> {
  const payload = buildProductPayload(productName, category, description, price, landingPageUrl)

  // Upload image first if provided, attach mediaItemId to payload
  if (imageBase64) {
    const mediaName = await uploadImageToGMB(accessToken, accountId, locationId, imageBase64)
    if (mediaName) {
      (payload as unknown as Record<string, unknown>).media = [{ mediaFormat: 'PHOTO', name: mediaName }]
    }
  }

  // Try Products API first; fall back to Local Posts if unavailable
  const productsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/products`
  const res = await fetch(productsUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (res.status === 404 || res.status === 403) {
    // Fallback: Local Posts with PRODUCT topic type
    const postsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`
    const postPayload = {
      topicType: 'PRODUCT',
      summary: description,
      offer: { couponCode: '', redeemOnlineUrl: '', termsConditions: '' },
    }
    const fallbackRes = await fetch(postsUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload),
    })
    if (!fallbackRes.ok) {
      const err = await fallbackRes.json()
      throw new Error(`GMB upload failed: ${JSON.stringify(err)}`)
    }
    return
  }

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`GMB upload failed: ${JSON.stringify(err)}`)
  }
}

export interface GmbLocation {
  accountId: string
  locationId: string
  locationName: string
  accountName: string
}

export async function getAllLocations(accessToken: string): Promise<GmbLocation[]> {
  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!accountsRes.ok) {
    const body = await accountsRes.text()
    throw new Error(`Failed to fetch GMB accounts (${accountsRes.status}): ${body}`)
  }
  const accountsData = await accountsRes.json()
  const accounts = accountsData.accounts ?? []

  const locations: GmbLocation[] = []

  for (const account of accounts) {
    const accountId = account.name?.split('/')[1]
    const accountName = account.accountName ?? account.name ?? accountId
    if (!accountId) continue

    const locRes = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!locRes.ok) continue

    const locData = await locRes.json()
    for (const loc of (locData.locations ?? [])) {
      const locationId = loc.name?.split('/')[1]
      const locationName = loc.locationName ?? loc.title ?? locationId
      if (locationId) {
        locations.push({ accountId, locationId, locationName, accountName })
      }
    }
  }

  return locations
}

export async function getLocationId(accessToken: string): Promise<{ accountId: string; locationId: string }> {
  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!accountsRes.ok) throw new Error('Failed to fetch GMB accounts')
  const accountsData = await accountsRes.json()
  const accountId = accountsData.accounts?.[0]?.name?.split('/')[1]
  if (!accountId) throw new Error('No GMB account found')

  const locationsRes = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!locationsRes.ok) throw new Error('Failed to fetch GMB locations')
  const locationsData = await locationsRes.json()
  const locationId = locationsData.locations?.[0]?.name?.split('/')[1]
  if (!locationId) throw new Error('No GMB location found')

  return { accountId, locationId }
}
