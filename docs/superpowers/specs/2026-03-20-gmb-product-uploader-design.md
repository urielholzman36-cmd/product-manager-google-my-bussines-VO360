# GMB Product Uploader — Design Spec
**Date:** 2026-03-20
**Status:** Approved

---

## Overview

A hosted web application that lets a user upload products to their Google My Business listing from a CSV or Excel file, with AI-generated descriptions and a one-by-one approval flow before anything gets uploaded.

---

## Goals

- Read product data from a CSV or Excel file (columns: `name`, `description`, `price`, `image_filename`)
- Use Claude AI (with vision) to improve existing descriptions or generate new ones from scratch by analyzing the product image and name
- Present each product one by one for the user to review and approve before uploading
- Upload approved products (with images) to Google My Business via the GMB API
- Be shareable — hosted on the web, accessible from any browser

---

## Out of Scope

- Bulk approval (intentionally one-by-one)
- Persistent storage / database
- Multi-user accounts
- Editing any product data other than the description (name, price, and image are read-only during review)

---

## User Flow

1. User opens the hosted web app
2. On first visit: Google OAuth2 login — user grants access to their GMB account. Token is saved for future sessions.
3. **Upload Screen:** User selects a CSV/Excel file and an images folder via file inputs. The app parses the file, matches images by filename, and shows a count of products found.
4. User clicks "Start Reviewing"
5. **Review Screen:** For each product (one at a time):
   - Shows the product image, name, price (read-only), and original description
   - Claude analyzes the image + name and generates an improved description (loading spinner shown during API call)
   - User can: use the AI description, regenerate it, or edit manually
   - User clicks **Approve & Upload** (uploads immediately to GMB) or **Skip**
   - Progress bar tracks approved/skipped counts
6. After all products are reviewed, a summary screen shows what was uploaded

---

## Screens

### Upload Screen
- Top bar with app title and Google connection status badge
- Two file inputs: one for CSV/Excel (`<input type="file">`), one for images folder (`<input type="file" multiple webkitdirectory>`)
- After both are provided: shows product count and image match count
- "Start Reviewing" button activates only when both are present and parsed successfully
- CSV format hint shown at the bottom
- Validation: if any required column is missing from the CSV, show an error before allowing the user to proceed

### Review Screen
- **Top bar:** Progress ("Product 3 of 12"), approved count, skipped count
- **Progress bar:** Visual fill showing how far through the batch
- **Left panel:** Product image (full height), price below (read-only, no edit capability)
- **Right panel:**
  - Product name (large, read-only)
  - Original description tab / AI Improved tab toggle
  - AI description box with loading spinner while Claude generates; on success shows "Use this", "Regenerate", "Edit manually" actions
- **Bottom action bar:** Large "Approve & Upload to Google My Business" button + "Skip" button

### Summary Screen
- Shows total uploaded, total skipped
- Deep link to the GMB listing constructed as: `https://business.google.com/dashboard/l/{locationId}` using the location ID retrieved during OAuth (from `mybusinessaccountmanagement` API at session start)
- Button to start a new upload (resets all state)

---

## AI Agent Behavior

- Model: Claude claude-sonnet-4-6 with vision (multimodal)
- Triggered automatically when each product loads in the review screen
- Input: product image (base64-encoded) + product name
- Output: a compelling, professional product description (~50-80 words)
- Loading state: spinner replaces AI description box while the API call is in flight
- Timeout: 30 seconds — if Claude does not respond within 30 seconds, show an inline error with a "Try again" button
- On Claude API error (network failure, rate limit, etc.): show inline error "Could not generate description. You can still use the original or type one manually." — the user is never blocked from approving a product due to a Claude failure
- User can regenerate (calls Claude again) or edit the output manually
- If no image is found for a product: Claude uses only the name and original description (image input omitted)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React, App Router) |
| API layer | Next.js API routes (serverless functions on Vercel) |
| AI | Anthropic Claude API (claude-sonnet-4-6, vision) |
| Auth | Google OAuth2 (via `google-auth-library`) |
| GMB integration | Google Business Profile API (Products endpoint) |
| File parsing | `papaparse` (CSV), `xlsx` (Excel) |
| Hosting | Vercel |

---

## State Management Between Screens

Since there is no persistence layer and the app uses three separate Next.js routes (`/`, `/review`, `/summary`), state is managed as follows:

- Parsed product data and in-memory image `File` objects are stored in a **React context** (`ProductSessionContext`) that wraps the entire app in `layout.tsx`
- The context persists across client-side route navigations (Next.js App Router does not unmount the layout between navigations)
- If the user hard-refreshes on `/review` or `/summary`, they are redirected to `/` (the context will be empty)
- Image files are held as `File` objects in memory (no upload to server until GMB upload). Worst-case memory footprint: 20 products × 10MB max per image = 200MB raw, plus ~33% base64 encoding overhead when sending to Claude API ≈ 270MB peak. This is acceptable for a desktop browser session on modern hardware.
- A warning is shown if any single image exceeds **5MB** (the assumed average). Images over 10MB are blocked with an error ("Image too large — please compress it before uploading") since GMB also has upload size limits.

---

## Data Flow

```
User selects CSV + images folder
        |
        v
Client-side: papaparse / xlsx parses CSV
Matches image filenames to selected File objects
Stores all data in ProductSessionContext
        |
        v
Review loop (per product, client-side):
  1. Display product data + image (from context)
  2. POST /api/claude with image base64 + name → get AI description
  3. User reviews, edits if needed, approves or skips
  4. On approve: POST /api/gmb/upload with product data + image
        |
        v
Summary screen (from context: approved/skipped counts + location ID)
```

---

## CSV Validation Rules

- Required columns: `name`, `description`, `price`, `image_filename`
- Missing column: block upload, show error listing which columns are missing
- Missing `price` value on a row: that product's price displays as "Price not set" in the review screen and is uploaded to GMB without a price (GMB Products API allows optional price)
- Invalid `price` value (non-numeric): treat as missing (warn inline on that product)
- Missing `image_filename` or no matching file found: warn inline in review screen; allow upload without image
- Empty `description`: allowed — Claude will generate one from the name (and image if available)

---

## Google OAuth2 Flow

- First visit: redirect to Google consent screen, request `https://www.googleapis.com/auth/business.manage` scope
- On success: store access token and refresh token in **HTTP-only, Secure, SameSite=Lax cookies** with 30-day expiry
- Subsequent visits: use stored token silently via Next.js API route; refresh automatically when expired using the refresh token
- On refresh failure: clear cookies and redirect to login
- Token exchange and refresh happen server-side only (in Next.js API routes) — tokens are never exposed to client JavaScript

---

## Google My Business API Integration

- **API used:** Google Business Profile API — Products surface
  - **OPEN DEPENDENCY (must resolve before GMB integration work begins):** The exact endpoint for uploading products to a GMB listing depends on the listing type and whether the Products feature is enabled for the account. The `/products` endpoint under `mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}` is not universally available. Before implementation, the developer must:
    1. Confirm the target GMB listing has the Products feature enabled (visible in the GMB dashboard under "Products")
    2. Verify the exact endpoint against the current [Google Business Profile API reference](https://developers.google.com/my-business/reference/rest)
    3. Confirm the `business.manage` OAuth scope grants write access to products for this listing type
  - If the Products API is not available for the listing type, the upload mechanism must fall back to **Local Posts** with `topicType: PRODUCT` (`POST .../localPosts`) — this is the documented fallback and is available to all listing types
  - The implementation should abstract the upload call behind `gmbClient.ts` so the endpoint can be swapped without changing the rest of the app
- **Location ID retrieval:** On session start (after OAuth), call `mybusinessaccountmanagement.googleapis.com/v1/accounts` to get the account, then `mybusiness.googleapis.com/v4/accounts/{accountId}/locations` to get the location ID. Store location ID in a session cookie for use throughout the session.
- **Image upload:** Upload image as multipart to the GMB media endpoint before creating the product, get back a `mediaItemId`, include it in the product creation request.
- **Rate limiting:** Uploads are sequential (one at a time), not parallel, to avoid hitting GMB API quota limits.
- **Product payload:** `{ name, description, price: { currencyCode: "USD", units: <integer part>, nanos: <fractional part> }, media: [{ mediaFormat: "PHOTO", sourceUrl or mediaItemId }] }`

---

## Error Handling

| Error | Behavior |
|---|---|
| Missing CSV column | Block upload, show which columns are missing |
| Missing/invalid price in row | Warn inline; upload without price |
| Missing image file | Warn inline; allow upload without image |
| Image > 10MB | Block with error: "Image too large — please compress before uploading" |
| Claude API timeout (>30s) | Inline error with "Try again"; user can still approve with original/manual description |
| Claude API error | Inline error; user not blocked from approving |
| GMB upload failure | Inline error on that product with "Retry" button |
| Google token expired | Silent refresh via API route; if refresh fails, redirect to login |
| Hard refresh on /review or /summary | Redirect to / (session context is empty) |

---

## File Structure (proposed)

```
gmb-product-uploader/
  app/
    layout.tsx                  # ProductSessionContext provider
    page.tsx                    # Upload screen
    review/
      page.tsx                  # Review screen
    summary/
      page.tsx                  # Summary screen
    api/
      auth/
        login/route.ts          # Initiate Google OAuth
        callback/route.ts       # Handle OAuth callback, set cookies
        refresh/route.ts        # Refresh access token
      claude/
        route.ts                # Generate description via Claude API
      gmb/
        upload/route.ts         # Upload product to GMB
        location/route.ts       # Get account + location ID
  lib/
    parseCSV.ts                 # CSV + Excel parsing and validation
    googleAuth.ts               # OAuth2 helpers
    gmbClient.ts                # GMB API client
    claudeClient.ts             # Claude API client
  context/
    ProductSessionContext.tsx   # In-memory session state
  public/
  .env.local                    # API keys (not committed)
```

---

## Environment Variables

```
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

---

## MVP Constraints

- Max ~20 products per session (in-memory, no persistence)
- Single GMB listing per session (no multi-location support)
- Images selected via browser file input (no URL-based images)
- Desktop browser only (no mobile optimization in MVP)
- Price currency hardcoded to USD in MVP
