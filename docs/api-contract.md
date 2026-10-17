# RecallGuard — API Contract

This is the contract the frontend is built against. The HTTP adapters in `src/services/http/` call the endpoints below. Endpoints that aren't built yet throw `NotImplementedError` in their adapter, and their features show "Coming soon" (`src/lib/features.ts`). The TypeScript shapes live in `src/types/index.ts`, the service interfaces in `src/services/types.ts`, and `apiFetch()` in `src/lib/api.ts` already implements the conventions below (base URL, auth header, error mapping). When an endpoint is implemented, the backend must return exactly these shapes, and the only frontend change is the body of that adapter method.

See `docs/implementation-plan.md` for the overall plan.

## Conventions

- **Base URL:** relative `/api` on the web (Vite proxy in dev, Vercel rewrite in prod). On iOS it is the absolute `VITE_API_BASE_URL`, built by `apiUrl()` in `src/lib/api.ts`.
- **Auth:** every endpoint except `/api/health`, the public recall reads (`/api/recalls/*`), the guest-mode barcode check (`POST /api/scan/barcode`) and `/api/cron/*` requires `Authorization: Bearer <Firebase ID token>`. Anonymous (guest) tokens are accepted.
  - Recall reads carry no user data and must not need auth: an `Authorization` header would stop Vercel's CDN from caching them.
- **JSON:** request and response bodies use camelCase. The backend translates openFDA's snake_case.
- **Dates:** ISO 8601 strings. Calendar dates are `YYYY-MM-DD`, timestamps are full ISO. openFDA's `YYYYMMDD` is normalized on the server.
- **Pagination:** `?page=1&pageSize=20`, returning `Page<T>`.
- **Errors:** non-2xx responses return:

  ```json
  { "error": { "code": "invalid_barcode", "message": "That barcode's check digit is wrong." } }
  ```

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_request`, `invalid_barcode` | Bad input |
| 401 | `unauthenticated` | Missing or invalid ID token |
| 404 | `not_found` | Unknown recall number or scan id |
| 413 | `image_too_large` | Receipt image over 4 MB (the client resizes to ≤1600 px before upload) |
| 422 | `receipt_unreadable` | Document AI found no line items |
| 429 | `quota_exceeded` | Daily per-user scan quota hit; the response also includes `retryAfter` (seconds) |
| 502 | `upstream_error` | openFDA, Open Food Facts or Document AI failed (summary model failures never error; `summary` is omitted) |

- **AI degradation:** if the LLM call fails, the endpoint still succeeds. Each AI field is nullable, so `summary` or `verdict` comes back as `null` and the UI shows the raw FDA fields instead.
- **Match status comes from deterministic matching, not the LLM.** The LLM only writes explanatory text.

## Types

```ts
// Guest-mode re-check: POST /api/watchlist/check
interface WatchCheckItem { id: string; upc?: string; name: string; brand?: string }
interface WatchCheckMatch { itemId: string; recallNumber: string; confidence: 'confirmed' | 'possible'; recall: RecallRef }
interface WatchCheckResult { checkedAt: string; since: string; matches: WatchCheckMatch[] }

type RecallStatus = 'Ongoing' | 'Completed' | 'Terminated'   // UI: Active = Ongoing; Resolved = Completed | Terminated
type Classification = 'Class I' | 'Class II' | 'Class III'
type MatchStatus = 'confirmed' | 'possible' | 'clear' | 'error'
//  confirmed: the item's UPC appears in the recall's text
//  possible:  brand/name overlap only; user must verify lot/date
//  clear:     no recall found
//  error:     the item couldn't be read or checked

interface Recall {
  recallNumber: string            // openFDA recall_number, e.g. "F-0123-2026"; used as the id
  eventId: string
  status: RecallStatus
  classification: Classification
  productDescription: string
  reasonForRecall: string
  recallingFirm: string
  city?: string
  state?: string
  distributionPattern?: string
  productQuantity?: string
  codeInfo?: string               // lots / UPCs / best-by dates, free text
  recallInitiationDate: string    // YYYY-MM-DD
  reportDate: string              // YYYY-MM-DD
  voluntaryMandated?: string
  terminationDate?: string        // YYYY-MM-DD, when FDA closed the recall (Terminated recalls only)
  summary: RecallSummary | null   // list endpoints may return only shortSummary (see below)
}

interface RecallSummary {
  shortSummary: string            // one sentence, ~20–25 words
  sections?: {                    // present on GET /api/recalls/{recallNumber}
    overview: string              // each value is markdown
    productDetails: string
    reason: string
    healthRisks: string
    distribution: string
    actionRequired: string
    additionalInfo: string
    contact: string
  }
  generatedAt: string
  model: string
}

interface Product {
  upc: string                     // normalized UPC-A (12 digits) where possible
  name: string
  brand?: string
  size?: string
  category?: string
  imageUrl?: string
}

interface ScanItem {
  id: string
  raw?: string                    // receipt line as printed, e.g. "GV WHL MLK 1GAL"
  name: string                    // normalized, e.g. "Great Value Whole Milk, 1 gal"
  brand?: string
  upc?: string
  price?: number
  status: MatchStatus
  recallNumbers: string[]         // empty unless confirmed/possible
  note?: string                   // short explanation for this item (templated for barcode scans)
}

interface Scan {
  id: string
  type: 'receipt' | 'barcode'
  createdAt: string
  store?: string                  // receipt only
  purchaseDate?: string           // receipt only, YYYY-MM-DD
  total?: number                  // receipt only
  product?: Product               // barcode only
  items: ScanItem[]               // barcode scans have exactly one item
  matchedRecalls: Recall[]        // recalls referenced by items, with summary.shortSummary
  verdict: {
    headline: string              // e.g. "1 item on this receipt matches an active recall"
    details: string               // markdown
    nextSteps: string[]
  } | null
  counts: { total: number; confirmed: number; possible: number; clear: number; error: number }
}

interface WatchItem {             // users/{uid}/items: a scanned product that is re-checked for new recalls
  id: string
  scanId: string
  scanItemId: string              // the ScanItem it came from
  source: 'receipt' | 'barcode'
  store?: string                  // receipt store, for receipt items
  name: string
  brand?: string
  upc?: string
  size?: string
  purchaseDate?: string           // YYYY-MM-DD
  createdAt: string
  status: MatchStatus
  recallNumbers: string[]
}

interface SavedRecall {           // users/{uid}/savedRecalls/{recallNumber}
  recallNumber: string
  savedAt: string
  recall: Pick<Recall, 'recallNumber' | 'productDescription' | 'classification' | 'status' | 'reportDate'>
}

interface RecheckResult { checkedAt: string; skipped: boolean; newAlerts: Alert[] }

interface Alert {
  id: string                      // `${recallNumber}_${itemId}`
  recallNumber: string
  itemId: string
  itemName: string
  source: 'receipt' | 'barcode'   // copied from the WatchItem, so duplicate products can be told apart
  store?: string
  confidence: 'confirmed' | 'possible'
  recall: Pick<Recall, 'recallNumber' | 'productDescription' | 'classification' | 'status' | 'reportDate'>
  createdAt: string
  dismissed: boolean
}

interface UserProfile {
  uid: string
  isGuest: boolean
  displayName?: string
  email?: string
  createdAt: string
  prefs: { recheckOnOpen: boolean }
}

interface DataSourceStatus {
  source: 'openFDA food enforcement'
  openFdaLastUpdated: string      // openFDA meta.last_updated
  lastWatchCheckAt?: string
}

interface Page<T> { items: T[]; page: number; pageSize: number; total: number; hasMore: boolean }
```

## HTTP endpoints

Implemented so far (`api/`): `GET /api/health`, the five `/api/recalls/*` endpoints, `GET /api/meta/data-source` (without `lastWatchCheckAt` until accounts exist) and `POST /api/scan/barcode` (guest mode). The rest are placeholders.

### `GET /api/health`
No auth. Response: `{ "status": "ok" }`.

### `GET /api/recalls/recent`
Latest openFDA food recalls, newest `reportDate` first.

| Query | Default | Notes |
|---|---|---|
| `status` | `active` | `active` → Ongoing; `resolved` → Completed or Terminated |
| `days` | all time | 1–3650. Active: reported in the last N days (by `report_date`). Resolved: **closed** in the last N days (by `termination_date`, newest closed first), since most resolved recalls were reported long ago. With a window, Completed recalls without a termination date are left out |
| `page`, `pageSize` | `1`, `20` | `pageSize` ≤ 50 |

Response `Page<Recall>`. Returned as soon as openFDA answers: the AI never delays a list.
- `summary` (with only `shortSummary`, `generatedAt` and `model`) is present only when it is already cached. Otherwise it is absent, and the app fetches it from `GET /api/recalls/summaries`.
- Cacheable: `Cache-Control: s-maxage=900`.

Service method: `recalls.listRecent({ status, page })`.

### `GET /api/recalls/search`
| Query | Notes |
|---|---|
| `q` | Required, 2–100 chars. Searched across product description, firm and reason |
| `days` | Optional, 1–3650: only recalls reported in the last N days. Omit for all time |
| `page`, `pageSize` | as above |

Response `Page<Recall>` (cached short summaries only, as above). Service method: `recalls.search(q)`.

### `GET /api/recalls/summaries`
| Query | Notes |
|---|---|
| `numbers` | Required. 1–25 comma-separated recall numbers |

Response `{ "summaries": { "<recallNumber>": RecallSummary } }`, with short summaries only (no `sections`).
- Recalls without a summary are absent from the map: unknown number, model failure, or summaries switched off.
- Generated in one batched model call, with the fast model first.
- `s-maxage=900` when complete; `s-maxage=30` when some failed, so a retry can fill them in.

Service method: `recalls.summaries(recallNumbers)`.

### `GET /api/recalls/{recallNumber}`
Response `Recall`, returned as soon as openFDA answers. It includes a `summary` only when one is already cached (with `sections` if the full summary was generated before). Returns 404 `not_found` for an unknown recall number.

Service method: `recalls.get(recallNumber)`.

### `GET /api/recalls/{recallNumber}/summary`
Response `RecallSummary` with all `sections`, or `null` when summaries are unavailable (no model key, or the model failed). The app then shows the FDA text.
- The stronger model goes first, falling back to the fast one on 503, 429 or timeout.
- Cached for 15 minutes, or 30 seconds when `null`.
- Returns 404 for an unknown recall number.

Service method: `recalls.summary(recallNumber)`.

### `POST /api/scan/barcode`
**Live (guest mode).** No auth, and nothing is stored on the server: the app saves the returned `Scan` on the device (`src/services/local/scans.ts`), and `scan.getScan(id)` reads it from there. `Cache-Control: no-store`.

Request:
```json
{ "code": "012345678905" }
```
1. Strip non-digits and normalize: UPC-E (8 digits starting with 0/1) is expanded to UPC-A, and EAN-13 / GTIN-14 codes with leading zeros are shortened to UPC-A. An invalid check digit or length is 400 `invalid_barcode`.
2. In parallel: look the product up in Open Food Facts (name, brand, size, image), and search openFDA for recalls that print the barcode (`product_description`, `code_info`, `more_code_info`, in the groupings recalls use: `040264101280`, `0 40264 10128`, `040264 10128`, `40264 10128`, `040264 101280`, the EAN-13 form, the form without the leading zero, and the UPC-E form when there is one). Open Food Facts being down doesn't fail the scan: only the barcode is checked, and the verdict says so.
3. If the product has a brand and a name of its own, also search openFDA for recalls that mention every brand word (each word as printed, without accents, without apostrophes and without a possessive "'s"; up to 300, newest first, and the verdict says when a brand had more). If that search fails after a confirmed match, the confirmed result is returned; otherwise 502. Accents are folded for matching ("Nestlé" = "Nestle").
4. Match each candidate locally (`api/services/matching.py`):
   - `confirmed`: the barcode is printed in the recall. Grouping with spaces or dashes and extra leading zeros (EAN-13/GTIN-14) count anywhere in a printed number. Shorter forms (dropped leading zero, UPC-E, no check digit) count only as a whole printed number grouped like a barcode, so lot codes and dates can't match.
   - `possible`: every brand word appears in the recall's description or firm, and the product name's words appear in the description (all of them for 1–2 word names, at least half for longer ones). Needs both a brand and a name beyond the brand. A recall that lists other UPCs can still be `possible` (the verdict then asks the user to compare barcodes).
   - otherwise `clear`.
5. Candidates are recalls still `Ongoing`, or reported in the last 2 years.
6. The verdict is written from templates (no AI), so it is never `null` here.

Response `Scan` (`type: "barcode"`, one item). `matchedRecalls` holds only the recalls behind the item's status (confirmed ones when there are any), with a cached `summary.shortSummary` when available.
- An unknown product (not in Open Food Facts, or Open Food Facts down) still returns 200, with `product.name: "Unknown product"`. Only the barcode is checked, and the verdict says so.
- If openFDA fails: 502 `upstream_error`. The endpoint never answers "no recall found" without having checked.
- Complete results are cached per barcode for 15 minutes in the serverless instance; every response gets a new scan id.
- Text from Open Food Facts is markdown-escaped in the verdict.

Once accounts exist, it will also save the scan, a `WatchItem` and `Alert`s for the user.

Service method: `scan.scanBarcode(code)`.

### `POST /api/scan/receipt`
Request: `multipart/form-data` with a field `image` (JPEG/PNG/HEIC, ≤ 4 MB).
Optional fields: `purchaseDate` (YYYY-MM-DD) overrides the date read from the receipt.

The image goes to Document AI Expense Parser for line items, store and date. An LLM normalizes the names and drops non-food lines, then the items are batched into openFDA queries (window: purchase date − 12 months to now), matched per item, summarized, and saved. Saving writes the scan, a `WatchItem` per readable line (unreadable `error` lines are skipped), and an `Alert` for each confirmed/possible match. The image is not stored.

Response `Scan` (`type: "receipt"`). Errors: 413 `image_too_large`, 422 `receipt_unreadable`, 429 `quota_exceeded`.

Service method: `scan.scanReceipt(image)`.

### `GET /api/scans/{scanId}`
Response `Scan` for the calling user. Returns 404 if the scan belongs to someone else. This is a thin read of `users/{uid}/scans/{scanId}`. The frontend may instead read Firestore directly, and the adapter decides.

Service method: `scan.getScan(id)`.

### `PATCH /api/scans/{scanId}/items/{itemId}`
Request:
```json
{ "name": "Brightfield Farms Organic Baby Spinach" }
```
Corrects an item's name (typically an unreadable `error` receipt line, 2–100 chars) and re-checks it by name. Without a UPC, a match is at most `possible`. The server recomputes the scan's counts, verdict and `matchedRecalls`, creates or updates the item's `WatchItem`, and writes alerts for any match.

Response `Scan`. Returns 404 for an unknown scan or item. Service method: `scan.updateItem(scanId, itemId, name)`.

### `POST /api/watchlist/check` (guest mode, live)
**Live.** No auth, nothing stored. The app sends the products it keeps on the device; the backend matches them against recalls reported since `since` and returns the matches. The app turns them into alerts on the device (`src/services/local/watch.ts`). `Cache-Control: no-store`.

Request:
```json
{ "items": [{ "id": "barcode-012345678905", "upc": "012345678905", "name": "Raspberry Yogurt Parfait", "brand": "Bonya" }], "since": "2026-10-10" }
```
- `items`: up to 100; `id` (1–100 chars) and `name` (1–200 chars) required. An invalid `upc` is ignored (the item is matched by brand + name only).
- `since`: the device's last check (or its oldest scan). The backend checks recalls reported from `since − 14 days` (openFDA publishes records days after their report date), at most 90 days back (the endpoint needs no login; each scan already checks the full 2 years) and never after today. Omitted: the last 30 days.
- Recalls are fetched per calendar month in parallel (paged within a month only if it holds over 1,000; over 25,000 is a 502) and cached per month in the serverless instance, shared by every device: past months for 6 hours, the current month for 10 minutes. Recalls before the window's first day are filtered out, and the rest are matched with the same rules as a barcode scan. Each recall's words and printed numbers are worked out once per window, so 100 products × a few thousand recalls stays well under a second of matching.

Response `WatchCheckResult`:
```json
{ "checkedAt": "2026-10-16T12:00:00Z", "since": "2026-09-26",
  "matches": [{ "itemId": "barcode-012345678905", "recallNumber": "F-0769-2025", "confidence": "possible",
                "recall": { "recallNumber": "F-0769-2025", "productDescription": "…", "classification": "Class II", "status": "Ongoing", "reportDate": "2025-05-21" } }] }
```
On the device, an alert's id is `${recallNumber}_${itemId}`: a known alert is not added again (a dismissed one stays dismissed), and `possible` is upgraded to `confirmed` when a later check confirms it. openFDA failing is a 502, and the device keeps its last check time.

Service method: `alerts.recheck()` (returns `RecheckResult` built on the device).

### `POST /api/watchlist/check` (with accounts, planned)
Called on app open and resume when `prefs.recheckOnOpen` is true. The server matches the user's saved items against recalls reported since `lastWatchCheckAt`, writes new alerts, and updates `lastWatchCheckAt`. It skips the check if the last one was under 6 hours ago.

Request: empty body. Response `RecheckResult`:
```json
{ "checkedAt": "2026-10-14T18:02:11Z", "skipped": false, "newAlerts": [ /* Alert[] */ ] }
```
Matched watch items are updated to the new `status` and `recallNumbers`.
Service method: `alerts.recheck()`.

### `GET /api/meta/data-source`
Response `DataSourceStatus`. Service method: `meta.dataSourceStatus()`.

### `DELETE /api/account`
Recursively deletes `users/{uid}` and the Firebase Auth user. Response `204`. Service method: `auth.deleteAccount()`, which also signs out locally.

### `GET /api/cron/warm-summaries` (internal)
A daily Vercel Cron job calls this with `Authorization: Bearer ${CRON_SECRET}`. It pre-generates summaries for the newest ~50 recalls. It is never called by the app.

## Firestore-backed operations (client SDK, no HTTP endpoint)

**Built, behind `features.accounts` (off in production).** Signed in, the app reads and writes these with the Firestore Lite client SDK (`src/services/firebase/data.ts`); signed out, the same services use the device (`src/services/local/`). `firestore.rules` allows each user only their own `users/{uid}` tree and checks every field. The backend stays stateless: re-checks still go through `POST /api/watchlist/check`, with the products read from the account.

| Service method | Firestore | Notes |
|---|---|---|
| `history.listScans(type)` | `users/{uid}/scans` order by `createdAt desc` (newest 200) | One document per product, id `barcode-<upc>` (`productKey`); a rescan replaces it and keeps the old scan ids in `previousIds` |
| `history.listProducts()` | the same scans, as products (`productsFromScans`), raised by active alerts | |
| `history.deleteProduct(id)` | delete `users/{uid}/scans/{id}` and its alerts | |
| `scan.getScan(id)` | `scans` where `id == ?`, else where `previousIds array-contains ?` | |
| `alerts.list()` | `users/{uid}/alerts` order by `createdAt desc` | Id `<recallNumber>_<itemId>` |
| `alerts.dismiss(id)` | update `{ dismissed: true }` | Updates may change only `dismissed`, `confidence`, `recall`, `itemName` |
| `alerts.recheck()` / `lastCheck()` | products from `scans`, `lastWatchCheckAt` in `users/{uid}` | Batches of 100 products per request |
| `saved.list()` / `saved.toggle(recallRef)` | `users/{uid}/savedRecalls/{recallNumber}` | |
| `auth.updatePrefs(prefs, uid)` | merge `users/{uid}` `{ prefs, updatedAt }` | |
| summary cache (planned) | `recallSummaries/{recallNumber}` | Server-written |

On every sign-in (and app start while signed in) the device's guest data is merged into the account (`planDeviceMerge` in `src/services/user-data.ts`) and then removed from the device.

## Auth service → Firebase Auth

Built in `src/services/firebase/auth.ts` (email/password and Google; no anonymous users: signed out is the guest on the device).

| Service method | Implementation |
|---|---|
| `auth.current()` | `authStateReady`, then the `users/{uid}` profile (created on first sign-in) and the device merge |
| `auth.continueAsGuest()` | `signOut` if signed in |
| `auth.signIn(email, password)` | `signInWithEmailAndPassword` |
| `auth.signUp({ name, email, password })` | `createUserWithEmailAndPassword`, `updateProfile`, `sendEmailVerification` |
| `auth.signInWithGoogle()` | `signInWithPopup` on the web; not available in the iOS app yet (needs `@capacitor-firebase/authentication`) |
| `auth.signInWithApple()` | Not built (throws `NotImplementedError`); needed alongside Google in the iOS app |
| `auth.resetPassword(email)` | `sendPasswordResetEmail` (no account enumeration) |
| `auth.signOut()` | `signOut` |
| `auth.deleteAccount({ uid, password? })` | Re-authenticates (password, or a Google popup), deletes the subcollections, the profile and the Firebase user, all from the client. `DELETE /api/account` isn't needed |
| `auth.onChange(listener)` | `onAuthStateChanged` (also follows other tabs) |
