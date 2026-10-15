# RecallGuard — API Contract

This is the contract the frontend is built against. The app currently runs on mock adapters (`VITE_DATA_SOURCE=mock`). The HTTP placeholder adapters in `src/services/http/` point at the endpoints below and throw `NotImplementedError` until the backend exists. The TypeScript shapes live in `src/types/index.ts`, the service interfaces in `src/services/types.ts`, and `apiFetch()` in `src/lib/api.ts` already implements the conventions below (base URL, auth header, error mapping). When an endpoint is implemented, the backend must return exactly these shapes, and the only frontend change is the body of that adapter method.

See `docs/implementation-plan.md` for the overall plan.

## Conventions

- **Base URL:** relative `/api` on the web (Vite proxy in dev, Vercel rewrite in prod). On iOS it is the absolute `VITE_API_BASE_URL`, built by `apiUrl()` in `src/lib/api.ts`.
- **Auth:** every endpoint except `/api/health`, the public recall reads (`/api/recalls/*`) and `/api/cron/*` requires `Authorization: Bearer <Firebase ID token>`. Anonymous (guest) tokens are accepted.
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
  note?: string                   // short LLM explanation for this item
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

Implemented so far (`api/`): `GET /api/health` and the five `/api/recalls/*` endpoints. The rest are placeholders.

### `GET /api/health`
No auth. Response: `{ "status": "ok" }`.

### `GET /api/recalls/recent`
Latest openFDA food recalls, newest `reportDate` first.

| Query | Default | Notes |
|---|---|---|
| `status` | `active` | `active` → Ongoing; `resolved` → Completed or Terminated |
| `page`, `pageSize` | `1`, `20` | `pageSize` ≤ 50 |

Response `Page<Recall>`. Returned as soon as openFDA answers: the AI never delays a list.
- `summary` (with only `shortSummary`, `generatedAt` and `model`) is present only when it is already cached. Otherwise it is absent, and the app fetches it from `GET /api/recalls/summaries`.
- Cacheable: `Cache-Control: s-maxage=900`.

Service method: `recalls.listRecent({ status, page })`.

### `GET /api/recalls/search`
| Query | Notes |
|---|---|
| `q` | Required, 2–100 chars. Searched across product description, firm and reason |
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
Request:
```json
{ "code": "012345678905" }
```
The server strips non-digits, validates the GTIN check digit (400 `invalid_barcode`), converts EAN-13 with a leading 0 to UPC-A, looks up the product (Open Food Facts), searches openFDA, matches, writes the verdict, and saves the scan plus a watchlist item for the user.

Response `Scan` (`type: "barcode"`, one item). Like the receipt endpoint, it also writes a `WatchItem` per readable item and an `Alert` for each confirmed/possible match. An unknown product still returns 200, with `product.name: "Unknown product"` and status `clear` unless the UPC itself appears in a recall.

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

### `POST /api/watchlist/check`
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

| Service method | Firestore | Notes |
|---|---|---|
| `history.listScans(type)` | `users/{uid}/scans` where `type == ?` order by `createdAt desc` | Server-written; client read-only |
| `history.listProducts()` | `users/{uid}/items` order by `createdAt desc` | Watchlist of scanned products |
| `history.deleteProduct(id)` | delete `users/{uid}/items/{id}` and its alerts | Client may delete own; an unwatched item shouldn't keep raising alerts |
| `alerts.list()` | `users/{uid}/alerts` order by `createdAt desc` | Server-written |
| `alerts.dismiss(id)` | update `users/{uid}/alerts/{id}` `{ dismissed: true }` | Rules allow only the `dismissed` field |
| `saved.list()` / `saved.toggle(recallRef)` | `users/{uid}/savedRecalls/{recallNumber}` | `SavedRecall`; `toggle` resolves to the new saved state |
| `auth.updatePrefs(prefs)` | update `users/{uid}` `{ prefs }` | Client may update `displayName`, `prefs` |
| summary cache | `recallSummaries/{recallNumber}` | Server-written; any signed-in user may read |

## Auth service → Firebase Auth

| Service method | Implementation |
|---|---|
| `auth.current()` | `onAuthStateChanged` and the `users/{uid}` profile |
| `auth.continueAsGuest()` | `signInAnonymously` (automatic on first launch) |
| `auth.signIn(email, password)` | `signInWithEmailAndPassword` |
| `auth.signUp({ name, email, password })` | `linkWithCredential(EmailAuthProvider.credential(...))` when the user is a guest, so the uid and history are kept; otherwise `createUserWithEmailAndPassword` |
| `auth.signInWithApple()` / `auth.signInWithGoogle()` | `@capacitor-firebase/authentication` on iOS, popup on web, then link to the anonymous account |
| `auth.resetPassword(email)` | `sendPasswordResetEmail` |
| `auth.signOut()` | `signOut`, then a new anonymous session |
| `auth.deleteAccount()` | `DELETE /api/account` |
