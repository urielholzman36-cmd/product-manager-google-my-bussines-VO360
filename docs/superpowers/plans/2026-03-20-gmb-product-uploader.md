# GMB Product Uploader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted Next.js web app that reads products from a CSV/Excel file, uses Claude AI to generate descriptions, and uploads approved products to Google My Business one at a time.

**Architecture:** Three-screen Next.js 14 App Router app (Upload → Review → Summary) with in-memory state via React context. API routes handle Google OAuth2, Claude description generation, and GMB uploads. No database — all data lives in the browser session.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Anthropic SDK, google-auth-library, papaparse, xlsx, Jest + React Testing Library, Vercel

**Spec:** `docs/superpowers/specs/2026-03-20-gmb-product-uploader-design.md`

---

## Pre-Implementation Check

Before starting Task 8 (GMB Integration), manually verify:
1. Open Google My Business dashboard → confirm "Products" tab is visible for your listing
2. Enable "Google My Business API" in Google Cloud Console
3. Note your account ID and location ID from the GMB dashboard URL

---

## File Map

```
gmb-product-uploader/
  app/
    layout.tsx                        # Root layout with ProductSessionContext
    page.tsx                          # Upload screen
    review/page.tsx                   # Review screen
    summary/page.tsx                  # Summary screen
    api/
      auth/
        login/route.ts                # Redirect to Google OAuth
        callback/route.ts             # Handle OAuth callback, set cookies
        refresh/route.ts              # Refresh access token
      claude/route.ts                 # Generate description via Claude
      gmb/
        upload/route.ts               # Upload product to GMB
        location/route.ts             # Get account + location ID
  context/
    ProductSessionContext.tsx         # In-memory session state
  lib/
    parseCSV.ts                       # CSV + Excel parsing + validation
    googleAuth.ts                     # OAuth2 token helpers
    claudeClient.ts                   # Claude API client
    gmbClient.ts                      # GMB API client
  __tests__/
    parseCSV.test.ts
    googleAuth.test.ts
    claudeClient.test.ts
    gmbClient.test.ts
    ProductSessionContext.test.tsx
    api/
      claude.test.ts
      gmb-upload.test.ts
      gmb-location.test.ts
  .env.local                          # API keys (never committed)
  .gitignore
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `jest.config.ts`, `jest.setup.ts`, `.gitignore`, `.env.local`

- [ ] **Step 1: Initialize Next.js app in existing directory**

```bash
cd /Users/urielholzman/gmb-product-uploader
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Expected: Next.js 14 project files created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk google-auth-library papaparse xlsx
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/papaparse ts-jest
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create .env.local**

```bash
cat > .env.local << 'EOF'
ANTHROPIC_API_KEY=your_key_here
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
EOF
```

- [ ] **Step 5: Update .gitignore**

Add to `.gitignore`:
```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 6: Verify setup**

```bash
npm run dev
```

Expected: Next.js dev server starts at http://localhost:3000 with no errors.

```bash
npx jest --passWithNoTests
```

Expected: "Test Suites: 0 passed"

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with dependencies"
```

---

## Task 2: ProductSessionContext

**Files:**
- Create: `context/ProductSessionContext.tsx`
- Create: `__tests__/ProductSessionContext.test.tsx`

**Responsibility:** Holds all in-memory state for a session — parsed products, image files, review progress, GMB location ID.

- [ ] **Step 1: Write the failing test**

Create `__tests__/ProductSessionContext.test.tsx`:
```typescript
import { render, screen, act } from '@testing-library/react'
import { ProductSessionProvider, useProductSession } from '@/context/ProductSessionContext'

const TestConsumer = () => {
  const { products, setProducts, approvedCount, skippedCount } = useProductSession()
  return (
    <div>
      <span data-testid="count">{products.length}</span>
      <span data-testid="approved">{approvedCount}</span>
      <span data-testid="skipped">{skippedCount}</span>
      <button onClick={() => setProducts([{ name: 'Test', description: '', price: '9.99', image_filename: 'test.jpg', imageFile: null }])}>
        Add
      </button>
    </div>
  )
}

describe('ProductSessionContext', () => {
  it('provides initial empty state', () => {
    render(<ProductSessionProvider><TestConsumer /></ProductSessionProvider>)
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('approved').textContent).toBe('0')
    expect(screen.getByTestId('skipped').textContent).toBe('0')
  })

  it('updates products when setProducts is called', async () => {
    render(<ProductSessionProvider><TestConsumer /></ProductSessionProvider>)
    await act(async () => { screen.getByText('Add').click() })
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest ProductSessionContext --no-coverage
```

Expected: FAIL — "Cannot find module '@/context/ProductSessionContext'"

- [ ] **Step 3: Implement ProductSessionContext**

Create `context/ProductSessionContext.tsx`:
```typescript
'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export interface Product {
  name: string
  description: string
  price: string
  image_filename: string
  imageFile: File | null
}

export interface ReviewResult {
  product: Product
  approved: boolean
  finalDescription: string
}

interface ProductSessionState {
  products: Product[]
  setProducts: (products: Product[]) => void
  results: ReviewResult[]
  addResult: (result: ReviewResult) => void
  approvedCount: number
  skippedCount: number
  locationId: string
  setLocationId: (id: string) => void
  reset: () => void
}

const ProductSessionContext = createContext<ProductSessionState | null>(null)

export function ProductSessionProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [results, setResults] = useState<ReviewResult[]>([])
  const [locationId, setLocationId] = useState('')

  const addResult = (result: ReviewResult) => {
    setResults(prev => [...prev, result])
  }

  const approvedCount = results.filter(r => r.approved).length
  const skippedCount = results.filter(r => !r.approved).length

  const reset = () => {
    setProducts([])
    setResults([])
    setLocationId('')
  }

  return (
    <ProductSessionContext.Provider value={{
      products, setProducts,
      results, addResult,
      approvedCount, skippedCount,
      locationId, setLocationId,
      reset,
    }}>
      {children}
    </ProductSessionContext.Provider>
  )
}

export function useProductSession() {
  const ctx = useContext(ProductSessionContext)
  if (!ctx) throw new Error('useProductSession must be used within ProductSessionProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest ProductSessionContext --no-coverage
```

Expected: PASS

- [ ] **Step 5: Wrap app in provider**

Edit `app/layout.tsx` — add `ProductSessionProvider` wrapping `{children}`:
```typescript
import { ProductSessionProvider } from '@/context/ProductSessionContext'
// ... existing imports

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProductSessionProvider>
          {children}
        </ProductSessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add context/ __tests__/ProductSessionContext.test.tsx app/layout.tsx
git commit -m "feat: add ProductSessionContext for in-memory session state"
```

---

## Task 3: CSV/Excel Parser

**Files:**
- Create: `lib/parseCSV.ts`
- Create: `__tests__/parseCSV.test.ts`

**Responsibility:** Parse CSV or Excel file, validate required columns, return structured product list with warnings.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/parseCSV.test.ts`:
```typescript
import { parseFile, ParseResult } from '@/lib/parseCSV'

const makeCSV = (rows: string) =>
  new File([`name,description,price,image_filename\n${rows}`], 'products.csv', { type: 'text/csv' })

describe('parseFile', () => {
  it('parses valid CSV with all columns', async () => {
    const file = makeCSV('Wallet,Nice wallet,49.99,wallet.jpg')
    const result = await parseFile(file)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Wallet')
    expect(result.products[0].price).toBe('49.99')
    expect(result.errors).toHaveLength(0)
  })

  it('returns error if required column is missing', async () => {
    const file = new File(['name,description,price\nWallet,desc,9.99'], 'p.csv', { type: 'text/csv' })
    const result = await parseFile(file)
    expect(result.errors).toContain('Missing required columns: image_filename')
    expect(result.products).toHaveLength(0)
  })

  it('marks row with missing price as warning', async () => {
    const file = makeCSV('Wallet,desc,,wallet.jpg')
    const result = await parseFile(file)
    expect(result.products[0].price).toBe('')
    expect(result.warnings).toContain('Row 1: price is missing or invalid')
  })

  it('marks row with non-numeric price as warning', async () => {
    const file = makeCSV('Wallet,desc,abc,wallet.jpg')
    const result = await parseFile(file)
    expect(result.warnings).toContain('Row 1: price is missing or invalid')
    expect(result.products[0].price).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest parseCSV --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/parseCSV'"

- [ ] **Step 3: Implement parseCSV**

Create `lib/parseCSV.ts`:
```typescript
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Product } from '@/context/ProductSessionContext'

export interface ParseResult {
  products: Omit<Product, 'imageFile'>[]
  errors: string[]
  warnings: string[]
}

const REQUIRED_COLUMNS = ['name', 'description', 'price', 'image_filename']

function validatePrice(val: string): string {
  const num = parseFloat(val)
  return isNaN(num) || val.trim() === '' ? '' : val.trim()
}

function processRows(rows: Record<string, string>[]): ParseResult {
  const products: Omit<Product, 'imageFile'>[] = []
  const warnings: string[] = []

  rows.forEach((row, i) => {
    const price = validatePrice(row.price ?? '')
    if (!price && (row.price ?? '').trim() !== '') {
      warnings.push(`Row ${i + 1}: price is missing or invalid`)
    } else if ((row.price ?? '').trim() === '') {
      warnings.push(`Row ${i + 1}: price is missing or invalid`)
    }
    products.push({
      name: (row.name ?? '').trim(),
      description: (row.description ?? '').trim(),
      price,
      image_filename: (row.image_filename ?? '').trim(),
    })
  })

  return { products, errors: [], warnings }
}

async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? []
        const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
        if (missing.length > 0) {
          resolve({ products: [], errors: [`Missing required columns: ${missing.join(', ')}`], warnings: [] })
          return
        }
        resolve(processRows(result.data as Record<string, string>[]))
      },
    })
  })
}

async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  if (rows.length === 0) return { products: [], errors: ['Excel file is empty'], warnings: [] }
  const cols = Object.keys(rows[0])
  const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
  if (missing.length > 0) {
    return { products: [], errors: [`Missing required columns: ${missing.join(', ')}`], warnings: [] }
  }
  return processRows(rows)
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCSV(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file)
  return { products: [], errors: ['Unsupported file type. Use CSV or Excel (.xlsx, .xls)'], warnings: [] }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest parseCSV --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/parseCSV.ts __tests__/parseCSV.test.ts
git commit -m "feat: add CSV/Excel parser with column validation"
```

---

## Task 4: Google OAuth2

**Files:**
- Create: `lib/googleAuth.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/callback/route.ts`
- Create: `app/api/auth/refresh/route.ts`
- Create: `__tests__/googleAuth.test.ts`

**Responsibility:** Handle Google OAuth2 login flow. Store tokens in HTTP-only cookies. Provide helper to get a valid access token for API calls.

**Before coding:** Get Google OAuth credentials:
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web Application
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback` (dev) and your Vercel URL (prod)
4. Copy Client ID and Client Secret to `.env.local`
5. Enable "Google My Business API" and "My Business Account Management API" in Library

- [ ] **Step 1: Write the failing test**

Create `__tests__/googleAuth.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest googleAuth --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement googleAuth helpers**

Create `lib/googleAuth.ts`:
```typescript
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
```

- [ ] **Step 4: Implement login route**

Create `app/api/auth/login/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/googleAuth'

export function GET() {
  const url = buildAuthUrl()
  return NextResponse.redirect(url)
}
```

- [ ] **Step 5: Implement callback route**

Create `app/api/auth/callback/route.ts`:
```typescript
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
```

- [ ] **Step 6: Implement refresh route**

Create `app/api/auth/refresh/route.ts`:
```typescript
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
```

- [ ] **Step 7: Run tests**

```bash
npx jest googleAuth --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add lib/googleAuth.ts app/api/auth/ __tests__/googleAuth.test.ts
git commit -m "feat: add Google OAuth2 login, callback, and token refresh"
```

---

## Task 5: Claude API Client

**Files:**
- Create: `lib/claudeClient.ts`
- Create: `app/api/claude/route.ts`
- Create: `__tests__/claudeClient.test.ts`

**Responsibility:** Send product image + name to Claude claude-sonnet-4-6 with vision. Return a generated product description.

- [ ] **Step 1: Write the failing test**

Create `__tests__/claudeClient.test.ts`:
```typescript
import { buildClaudePrompt } from '@/lib/claudeClient'

describe('claudeClient', () => {
  it('builds prompt with image and name', () => {
    const prompt = buildClaudePrompt('Leather Wallet', 'base64imagedata')
    expect(prompt.messages[0].content).toContain('Leather Wallet')
    expect(JSON.stringify(prompt.messages[0].content)).toContain('base64imagedata')
  })

  it('builds prompt without image when imageBase64 is null', () => {
    const prompt = buildClaudePrompt('Leather Wallet', null)
    expect(JSON.stringify(prompt.messages[0].content)).not.toContain('image')
    expect(JSON.stringify(prompt.messages[0].content)).toContain('Leather Wallet')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest claudeClient --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement claudeClient**

Create `lib/claudeClient.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

export function buildClaudePrompt(productName: string, imageBase64: string | null) {
  const textContent = {
    type: 'text' as const,
    text: `Write a compelling, professional product description for this item.
Product name: "${productName}"
Requirements: 50-80 words, focus on benefits and quality, no bullet points, no markdown.
Return ONLY the description text, nothing else.`,
  }

  const content = imageBase64
    ? [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: imageBase64 } },
        textContent,
      ]
    : [textContent]

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user' as const, content }],
  }
}

export async function generateDescription(productName: string, imageBase64: string | null): Promise<string> {
  const client = new Anthropic()
  const params = buildClaudePrompt(productName, imageBase64)
  const response = await client.messages.create(params)
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}
```

- [ ] **Step 4: Implement the API route**

Create `app/api/claude/route.ts`:
```typescript
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
```

- [ ] **Step 5: Run tests**

```bash
npx jest claudeClient --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/claudeClient.ts app/api/claude/ __tests__/claudeClient.test.ts
git commit -m "feat: add Claude API client for description generation"
```

---

## Task 6: Upload Screen

**Files:**
- Modify: `app/page.tsx`
- Create: `__tests__/UploadScreen.test.tsx`

**Responsibility:** File picker for CSV and images folder. Parses CSV, matches image files by filename. On success, navigates to `/review`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/UploadScreen.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import UploadPage from '@/app/page'

const renderPage = () =>
  render(<ProductSessionProvider><UploadPage /></ProductSessionProvider>)

describe('Upload Screen', () => {
  it('renders upload screen with title', () => {
    renderPage()
    expect(screen.getByText('Upload Your Products')).toBeInTheDocument()
  })

  it('shows Start Reviewing button as disabled initially', () => {
    renderPage()
    const btn = screen.getByText(/Start Reviewing/i)
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows CSV format hint', () => {
    renderPage()
    expect(screen.getByText(/name.*description.*price.*image_filename/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest UploadScreen --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement Upload Screen**

Replace `app/page.tsx`:
```typescript
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useProductSession } from '@/context/ProductSessionContext'
import { parseFile } from '@/lib/parseCSV'
import type { Product } from '@/context/ProductSessionContext'

export default function UploadPage() {
  const router = useRouter()
  const { setProducts } = useProductSession()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<Omit<Product, 'imageFile'>[]>([])
  const csvRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const handleCSV = async (file: File) => {
    setCsvFile(file)
    setStatus({ message: 'Parsing file...', type: 'info' })
    const result = await parseFile(file)
    if (result.errors.length > 0) {
      setStatus({ message: result.errors[0], type: 'error' })
      setIsReady(false)
      return
    }
    setParsedProducts(result.products)
    setProductCount(result.products.length)
    setStatus({ message: `Found ${result.products.length} products`, type: 'success' })
    setIsReady(imageFiles.length > 0)
  }

  const handleImages = (files: FileList) => {
    const arr = Array.from(files).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
    const oversized = arr.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length > 0) {
      setStatus({ message: `Images too large (>10MB): ${oversized.map(f => f.name).join(', ')}. Please compress them.`, type: 'error' })
      return
    }
    const largeWarnings = arr.filter(f => f.size > 5 * 1024 * 1024)
    if (largeWarnings.length > 0) {
      setStatus({ message: `Warning: ${largeWarnings.length} image(s) are over 5MB. Consider compressing for faster uploads.`, type: 'info' })
    }
    setImageFiles(arr)
    setIsReady(parsedProducts.length > 0)
  }

  const handleStart = () => {
    const imageMap = new Map(imageFiles.map(f => [f.name, f]))
    const products: Product[] = parsedProducts.map(p => ({
      ...p,
      imageFile: imageMap.get(p.image_filename) ?? null,
    }))
    setProducts(products)
    router.push('/review')
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-4 flex justify-between items-center">
        <h1 className="text-[#4ecca3] font-bold text-xl">GMB Product Uploader</h1>
        <a href="/api/auth/login" className="border border-[#4ecca3] text-[#4ecca3] text-sm px-4 py-2 rounded-full">
          Connect with Google
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Upload Your Products</h2>
            <p className="text-gray-400 mt-2">Drop your CSV and images folder to get started</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => csvRef.current?.click()}
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-[#4ecca3] transition-colors bg-[#16213e]"
            >
              <div className="text-4xl mb-2">📊</div>
              <div className="font-bold">{csvFile ? csvFile.name : 'Select CSV or Excel'}</div>
              <div className="text-gray-400 text-sm mt-1">{productCount != null ? `${productCount} products found` : 'CSV or Excel file'}</div>
            </button>
            <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} />

            <button
              onClick={() => imgRef.current?.click()}
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-[#4ecca3] transition-colors bg-[#16213e]"
            >
              <div className="text-4xl mb-2">🖼️</div>
              <div className="font-bold">{imageFiles.length > 0 ? 'Images selected' : 'Select Images Folder'}</div>
              <div className="text-gray-400 text-sm mt-1">{imageFiles.length > 0 ? `${imageFiles.length} images` : 'JPG, PNG, WEBP'}</div>
            </button>
            <input ref={imgRef} type="file" multiple className="hidden"
              // @ts-expect-error webkitdirectory not in types
              webkitdirectory=""
              onChange={e => e.target.files && handleImages(e.target.files)} />
          </div>

          {status && (
            <div className={`text-sm text-center ${status.type === 'error' ? 'text-red-400' : status.type === 'success' ? 'text-[#4ecca3]' : 'text-gray-400'}`}>
              {status.message}
            </div>
          )}

          <button
            onClick={isReady ? handleStart : undefined}
            aria-disabled={!isReady}
            className={`w-full py-5 rounded-xl font-bold text-lg transition-opacity ${isReady ? 'bg-[#4ecca3] text-[#1a1a2e] cursor-pointer' : 'bg-[#4ecca3] text-[#1a1a2e] opacity-40 cursor-not-allowed'}`}
          >
            Start Reviewing Products →
          </button>

          <p className="text-center text-xs text-gray-500">
            CSV columns expected: <span className="text-gray-400">name, description, price, image_filename</span>
          </p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest UploadScreen --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx __tests__/UploadScreen.test.tsx
git commit -m "feat: implement upload screen with CSV parsing and image folder selection"
```

---

## Task 7: Review Screen

**Files:**
- Create: `app/review/page.tsx`
- Create: `__tests__/ReviewScreen.test.tsx`

**Responsibility:** Show each product one at a time. Call Claude API for description. Allow approve/skip. On approve, call GMB upload API.

- [ ] **Step 1: Write the failing test**

Create `__tests__/ReviewScreen.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import ReviewPage from '@/app/review/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ description: 'AI description' }) })
) as jest.Mock

describe('Review Screen', () => {
  it('redirects to / when no products in context', () => {
    const push = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push })
    render(<ProductSessionProvider><ReviewPage /></ProductSessionProvider>)
    expect(push).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest ReviewScreen --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement Review Screen**

Create `app/review/page.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProductSession, Product } from '@/context/ProductSessionContext'

type DescriptionState = 'loading' | 'ready' | 'error'

export default function ReviewPage() {
  const router = useRouter()
  const { products, addResult, approvedCount, skippedCount, reset, setLocationId } = useProductSession()
  const [index, setIndex] = useState(0)
  const [aiDescription, setAiDescription] = useState('')
  const [descState, setDescState] = useState<DescriptionState>('loading')
  const [activeTab, setActiveTab] = useState<'original' | 'ai'>('ai')
  const [editedDescription, setEditedDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [gmbIds, setGmbIds] = useState<{ accountId: string; locationId: string }>({ accountId: '', locationId: '' })

  const product = products[index]

  useEffect(() => {
    if (products.length === 0) { router.push('/'); return }
    generateDescription()
  }, [index, products])

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const generateDescription = async () => {
    if (!product) return
    setDescState('loading')
    setAiDescription('')
    setIsEditing(false)
    try {
      const imageBase64 = product.imageFile ? await toBase64(product.imageFile) : null
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: product.name, imageBase64 }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiDescription(data.description)
      setEditedDescription(data.description)
      setDescState('ready')
    } catch {
      setDescState('error')
    }
  }

  const getFinalDescription = () => isEditing ? editedDescription : (activeTab === 'ai' ? aiDescription : product.description)

  const handleApprove = async () => {
    const finalDescription = getFinalDescription()
    addResult({ product, approved: true, finalDescription })

    try {
      const imageBase64 = product.imageFile ? await toBase64(product.imageFile) : null
      // Fetch accountId/locationId from API (cached in context after first call)
      let { accountId, locationId: locId } = gmbIds
      if (!accountId || !locId) {
        const res = await fetch('/api/gmb/location')
        if (res.ok) {
          const data = await res.json()
          accountId = data.accountId
          locId = data.locationId
          setGmbIds({ accountId, locationId: locId })
          setLocationId(locId) // also store in session context for summary screen
        }
      }
      await fetch('/api/gmb/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: { ...product, description: finalDescription },
          imageBase64,
          accountId,
          locationId: locId,
        }),
      })
    } catch { /* error shown in future enhancement */ }

    advance()
  }

  const handleSkip = () => {
    addResult({ product, approved: false, finalDescription: product.description })
    advance()
  }

  const advance = () => {
    if (index + 1 >= products.length) { router.push('/summary'); return }
    setIndex(i => i + 1)
    setActiveTab('ai')
  }

  if (!product) return null

  const progress = Math.round(((index) / products.length) * 100)
  const imageUrl = product.imageFile ? URL.createObjectURL(product.imageFile) : null

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-3 flex justify-between items-center">
        <h1 className="text-[#4ecca3] font-bold">GMB Product Uploader</h1>
        <div className="flex gap-6 text-sm">
          <span>Product <b>{index + 1}</b> of <b>{products.length}</b></span>
          <span className="text-[#4ecca3]">✓ {approvedCount} approved</span>
          <span className="text-gray-400">— {skippedCount} skipped</span>
        </div>
      </header>

      <div className="h-1.5 bg-[#16213e]">
        <div className="h-1.5 bg-[#4ecca3] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-80 bg-[#16213e] flex flex-col items-center justify-center p-8 gap-6 border-r border-gray-800 flex-shrink-0">
          <div className="w-full aspect-square bg-[#1a1a2e] rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden">
            {imageUrl
              ? <img src={imageUrl} alt={product.name} className="w-full h-full object-cover rounded-2xl" />
              : <div className="text-center text-gray-500"><div className="text-5xl">🖼️</div><div className="text-xs mt-2">{product.image_filename || 'No image'}</div></div>
            }
          </div>
          <div className="w-full bg-[#0f3460] rounded-xl p-4 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Price</div>
            <div className="text-2xl font-bold text-[#4ecca3]">{product.price ? `$${product.price}` : 'Price not set'}</div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Product Name</div>
              <h2 className="text-3xl font-bold">{product.name}</h2>
            </div>

            <div>
              <div className="flex mb-3">
                <button onClick={() => setActiveTab('original')}
                  className={`px-4 py-2 text-sm font-bold rounded-l-lg ${activeTab === 'original' ? 'bg-[#e94560] text-white' : 'bg-[#0f3460] text-[#4ecca3]'}`}>
                  Original
                </button>
                <button onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 text-sm font-bold rounded-r-lg ${activeTab === 'ai' ? 'bg-[#e94560] text-white' : 'bg-[#0f3460] text-[#4ecca3]'}`}>
                  AI Improved
                </button>
              </div>
              <div className="bg-[#16213e] rounded-xl p-4 text-gray-300 text-sm leading-relaxed border border-gray-800">
                {activeTab === 'original' ? (product.description || <span className="text-gray-500 italic">No description provided</span>) : (
                  descState === 'loading' ? <span className="text-gray-500 animate-pulse">Generating description...</span>
                  : descState === 'error' ? <span className="text-red-400">Could not generate description. You can still use the original or type one manually.</span>
                  : aiDescription
                )}
              </div>
            </div>

            {descState === 'ready' && (
              <div className="bg-[#0a1628] border border-[#4ecca3] rounded-xl p-5">
                <div className="text-[#4ecca3] text-xs font-bold mb-3">AI-Generated Description</div>
                {isEditing
                  ? <textarea
                      className="w-full bg-[#16213e] text-white text-sm rounded-lg p-3 border border-gray-700 resize-none"
                      rows={4}
                      value={editedDescription}
                      onChange={e => setEditedDescription(e.target.value)}
                    />
                  : <p className="text-gray-200 text-sm leading-relaxed">{aiDescription}</p>
                }
                <div className="flex gap-3 mt-3">
                  <button onClick={() => { setActiveTab('ai'); setIsEditing(false) }} className="text-xs px-3 py-1.5 bg-[#16213e] border border-[#4ecca3] text-[#4ecca3] rounded-lg">Use this</button>
                  <button onClick={generateDescription} className="text-xs px-3 py-1.5 bg-[#16213e] border border-gray-700 text-gray-400 rounded-lg">Regenerate</button>
                  <button onClick={() => setIsEditing(e => !e)} className="text-xs px-3 py-1.5 bg-[#16213e] border border-gray-700 text-gray-400 rounded-lg">{isEditing ? 'Done editing' : 'Edit manually'}</button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#16213e] border-t border-gray-800 flex gap-4">
            <button onClick={handleApprove}
              className="flex-[3] bg-[#4ecca3] text-[#1a1a2e] font-bold text-lg py-5 rounded-xl hover:opacity-90 transition-opacity">
              ✓ Approve &amp; Upload to Google My Business
            </button>
            <button onClick={handleSkip}
              className="flex-1 bg-[#1a1a2e] text-gray-400 py-5 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors">
              Skip
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest ReviewScreen --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/review/page.tsx __tests__/ReviewScreen.test.tsx
git commit -m "feat: implement review screen with Claude AI description and approve/skip flow"
```

---

## Task 8: GMB API Integration

> **Pre-condition:** Complete the "Pre-Implementation Check" at the top of this document before this task.

**Files:**
- Create: `lib/gmbClient.ts`
- Create: `app/api/gmb/location/route.ts`
- Create: `app/api/gmb/upload/route.ts`
- Create: `__tests__/gmbClient.test.ts`

**Responsibility:** Retrieve GMB location ID and upload products. Abstracted so the endpoint can be swapped if the Products API is unavailable (falls back to Local Posts).

- [ ] **Step 1: Write the failing test**

Create `__tests__/gmbClient.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest gmbClient --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement gmbClient**

Create `lib/gmbClient.ts`:
```typescript
interface Price {
  currencyCode: string
  units: string
  nanos: number
}

interface ProductPayload {
  name: string
  description: string
  price?: Price
  languageCode: string
}

export function buildProductPayload(name: string, description: string, price: string): ProductPayload {
  const payload: ProductPayload = { name, description, languageCode: 'en' }
  if (price && !isNaN(parseFloat(price))) {
    const num = parseFloat(price)
    const units = Math.floor(num).toString()
    const nanos = Math.round((num - Math.floor(num)) * 1_000_000_000)
    payload.price = { currencyCode: 'USD', units, nanos }
  }
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
  description: string,
  price: string,
  imageBase64: string | null
): Promise<void> {
  const payload = buildProductPayload(productName, description, price)

  // Upload image first if provided, attach mediaItemId to payload
  if (imageBase64) {
    const mediaName = await uploadImageToGMB(accessToken, accountId, locationId, imageBase64)
    if (mediaName) {
      (payload as Record<string, unknown>).media = [{ mediaFormat: 'PHOTO', name: mediaName }]
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
```

- [ ] **Step 4: Implement location route**

Create `app/api/gmb/location/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { parseTokenCookies, refreshAccessToken } from '@/lib/googleAuth'
import { getLocationId } from '@/lib/gmbClient'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const tokens = parseTokenCookies(cookieHeader)
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const result = await getLocationId(tokens.accessToken)
    return NextResponse.json(result)
  } catch {
    // Try refreshing token once
    try {
      const newToken = await refreshAccessToken(tokens.refreshToken)
      const result = await getLocationId(newToken)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Failed to get location' }, { status: 500 })
    }
  }
}
```

- [ ] **Step 5: Implement upload route**

Create `app/api/gmb/upload/route.ts`:
```typescript
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
    await uploadProduct(tokens.accessToken, accountId, locationId, product.name, product.description, product.price, imageBase64 ?? null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('GMB upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run tests**

```bash
npx jest gmbClient --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/gmbClient.ts app/api/gmb/ __tests__/gmbClient.test.ts
git commit -m "feat: add GMB API client with Products API + Local Posts fallback"
```

---

## Task 9: Summary Screen

**Files:**
- Create: `app/summary/page.tsx`
- Create: `__tests__/SummaryScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/SummaryScreen.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { ProductSessionProvider } from '@/context/ProductSessionContext'
import SummaryPage from '@/app/summary/page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('Summary Screen', () => {
  it('renders summary with zero counts', () => {
    render(<ProductSessionProvider><SummaryPage /></ProductSessionProvider>)
    expect(screen.getByText(/upload complete/i)).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows Upload More button', () => {
    render(<ProductSessionProvider><SummaryPage /></ProductSessionProvider>)
    expect(screen.getByText(/upload more/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest SummaryScreen --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement Summary Screen**

Create `app/summary/page.tsx`:
```typescript
'use client'
import { useProductSession } from '@/context/ProductSessionContext'
import { useRouter } from 'next/navigation'

export default function SummaryPage() {
  const { approvedCount, skippedCount, locationId, reset } = useProductSession()
  const router = useRouter()

  const handleUploadMore = () => {
    reset()
    router.push('/')
  }

  const gmbUrl = locationId
    ? `https://business.google.com/dashboard/l/${locationId}`
    : 'https://business.google.com'

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <header className="bg-[#0f3460] px-8 py-4">
        <h1 className="text-[#4ecca3] font-bold text-xl">GMB Product Uploader</h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-10">
        <div className="text-center flex flex-col gap-8 max-w-md w-full">
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold">Upload Complete</h2>
            <p className="text-gray-400 mt-2">Here's a summary of what happened</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#16213e] rounded-xl p-6">
              <div className="text-4xl font-bold text-[#4ecca3]">{approvedCount}</div>
              <div className="text-gray-400 mt-1">Uploaded</div>
            </div>
            <div className="bg-[#16213e] rounded-xl p-6">
              <div className="text-4xl font-bold text-gray-400">{skippedCount}</div>
              <div className="text-gray-400 mt-1">Skipped</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={gmbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-xl border border-[#4ecca3] text-[#4ecca3] text-center font-bold hover:bg-[#4ecca3] hover:text-[#1a1a2e] transition-colors"
            >
              View My GMB Listing →
            </a>
            <button
              onClick={handleUploadMore}
              className="w-full py-4 rounded-xl bg-[#16213e] text-gray-400 border border-gray-700 hover:border-gray-500 transition-colors"
            >
              Upload More Products
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest SummaryScreen --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All test suites pass.

- [ ] **Step 6: Commit**

```bash
git add app/summary/page.tsx __tests__/SummaryScreen.test.tsx
git commit -m "feat: implement summary screen with upload counts and GMB link"
```

---

## Task 10: Deploy to Vercel

**Files:**
- No new files — deploy existing project

- [ ] **Step 1: Install Vercel CLI and login**

```bash
npm install -g vercel
vercel login
```

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel
```

Follow the prompts: link to existing project or create new, use default settings.

- [ ] **Step 3: Set environment variables in Vercel**

```bash
vercel env add ANTHROPIC_API_KEY
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI
```

For `GOOGLE_REDIRECT_URI`, use your Vercel deployment URL: `https://your-app.vercel.app/api/auth/callback`

- [ ] **Step 4: Update Google OAuth authorized redirect URIs**

In Google Cloud Console → Credentials → your OAuth Client:
- Add `https://your-app.vercel.app/api/auth/callback` to authorized redirect URIs

- [ ] **Step 5: Redeploy with env vars**

```bash
vercel --prod
```

- [ ] **Step 6: Smoke test**

Open your Vercel URL in browser:
1. Click "Connect with Google" → Google login → redirects back to app
2. Upload a small CSV (1-2 products) + images folder
3. Verify review screen loads and Claude generates a description
4. Approve one product — verify no errors

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: add deployment notes and final cleanup"
git push origin main
```
