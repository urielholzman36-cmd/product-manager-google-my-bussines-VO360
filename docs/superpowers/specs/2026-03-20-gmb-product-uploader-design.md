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
- Editing product data other than the description

---

## User Flow

1. User opens the hosted web app
2. On first visit: Google OAuth2 login — user grants access to their GMB account. Token is saved for future sessions.
3. **Upload Screen:** User drops a CSV/Excel file and an images folder. The app parses the file, matches images by filename, and shows a count of products found.
4. User clicks "Start Reviewing"
5. **Review Screen:** For each product (one at a time):
   - Shows the product image, name, price, and original description
   - Claude analyzes the image + name and generates an improved description
   - User can: use the AI description, regenerate it, or edit manually
   - User clicks **Approve & Upload** (uploads immediately to GMB) or **Skip**
   - Progress bar tracks approved/skipped counts
6. After all products are reviewed, a summary screen shows what was uploaded

---

## Screens

### Upload Screen
- Top bar with app title and Google connection status badge
- Two drop zones: one for CSV/Excel, one for the images folder
- After both are uploaded: shows product count and image match count
- "Start Reviewing" button activates only when both files are present
- CSV format hint shown at the bottom

### Review Screen
- **Top bar:** Progress ("Product 3 of 12"), approved count, skipped count
- **Progress bar:** Visual fill showing how far through the batch
- **Left panel:** Product image (full height), price below
- **Right panel:**
  - Product name (large)
  - Original description tab / AI Improved tab toggle
  - AI description box with "Use this", "Regenerate", "Edit manually" actions
- **Bottom action bar:** Large "Approve & Upload to Google My Business" button + "Skip" button

### Summary Screen
- Shows total uploaded, total skipped
- Link to view the GMB listing
- Button to start a new upload

---

## AI Agent Behavior

- Model: Claude claude-sonnet-4-6 with vision (multimodal)
- Triggered automatically when each product loads in the review screen
- Input: product image (base64) + product name
- Output: a compelling, professional product description (~50-80 words)
- User can regenerate (calls Claude again) or edit the output manually
- If no image is found for a product, Claude uses only the name and original description

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React, App Router) |
| API layer | Next.js API routes |
| AI | Anthropic Claude API (claude-sonnet-4-6, vision) |
| Auth | Google OAuth2 (via `google-auth-library`) |
| GMB integration | Google My Business API v4 |
| File parsing | `papaparse` (CSV), `xlsx` (Excel) |
| Hosting | Vercel |

---

## Data Flow

```
User uploads CSV + images
        |
        v
Next.js parses CSV (papaparse / xlsx)
Matches image filenames to uploaded files
        |
        v
Review loop (per product):
  1. Display product data + image
  2. Call Claude API with image + name → get AI description
  3. User reviews, edits if needed, approves or skips
  4. On approve: call GMB API to create product with image
        |
        v
Summary screen
```

---

## Google OAuth2 Flow

- First visit: redirect to Google consent screen, request `https://www.googleapis.com/auth/business.manage` scope
- On success: store access token + refresh token in a secure HTTP-only cookie
- Subsequent visits: use stored token silently; refresh automatically when expired
- Token stored client-side in secure cookie (no server-side session storage needed for MVP)

---

## Google My Business API Integration

- API: `mybusinessbusinessinformation` + `mybusinessaccountmanagement`
- Products are uploaded as **local posts** with `PRODUCT` call-to-action type (GMB Products API)
- Each product upload includes: name, description, price, and image (uploaded via GMB media endpoint)
- Rate limit: uploads are sequential, not parallel, to avoid hitting GMB API limits

---

## Error Handling

- Missing image for a product: warn the user in the review screen, allow uploading without image
- GMB API failure on upload: show inline error on that product, allow retry
- CSV parse error: show which rows failed and why, skip bad rows
- Google token expired: silently refresh; if refresh fails, prompt re-login

---

## File Structure (proposed)

```
gmb-product-uploader/
  app/
    page.tsx              # Upload screen
    review/
      page.tsx            # Review screen
    summary/
      page.tsx            # Summary screen
    api/
      auth/               # Google OAuth handlers
      claude/             # Claude description generation
      gmb/                # GMB upload endpoint
  lib/
    parseCSV.ts           # CSV + Excel parsing
    googleAuth.ts         # OAuth2 helpers
    gmbClient.ts          # GMB API client
    claudeClient.ts       # Claude API client
  public/
  .env.local              # API keys (not committed)
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
- Images uploaded as files (no URL-based images)
