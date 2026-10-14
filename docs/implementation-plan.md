# RecallGuard — Frontend Build Plan (synthetic data, backend placeholders)

## Context

RecallGuard (`/Users/rameshkatta/recallguard`) is a clickable wireframe skeleton:
- React 18 + Vite 5 + plain JSX with hand-written CSS.
- BrowserRouter routing.
- A Capacitor 8 iOS shell, with native camera, barcode and share already wired in `src/lib/native.js`.

Data comes from a thin `src/data/mock.js` full of placeholders ("Product Name", "Store", "$."). Several screens show hardcoded or contradictory content.

The product has three use cases:
1. **Recent recalls:** data from openFDA, with summaries from OpenAI.
2. **Barcode scan:** identify the product, search openFDA, then summarize with an LLM.
3. **Receipt scan:** Google Document AI extracts the items, then openFDA search, then an LLM summary.

**This phase builds the complete frontend for web and iPhone using realistic synthetic data on every screen. There is no backend integration.**
- Every data access goes through a typed service layer.
- Today that layer uses mock adapters.
- Each service also has an HTTP placeholder adapter carrying the exact endpoint contract.
- Later backend work then only fills in the HTTP adapters, one service at a time. The screens don't change.

Decisions carried forward:
- Migrate to **TypeScript + Tailwind + shadcn/ui** (the ArchePal stack).
- **Guest-first** with optional sign-in (mocked for now).
- **Re-check saved items on app open** (mocked).
- **FDA food recalls only.**

## Approach

### 1. Data-source switch
- `VITE_DATA_SOURCE=mock | api` (default `mock`) picks the adapter set in `src/services/index.ts`.
- Screens import only from `@/services` and from React Query hooks in `src/hooks/`. They never touch fixtures directly.

### 2. Domain types (`src/types/`) — mirror the future API responses
- `Recall`: field names modelled on openFDA food enforcement:
  - `recallNumber`, `eventId`, `status` (Ongoing/Completed/Terminated), `classification` (Class I/II/III)
  - `productDescription`, `reasonForRecall`, `recallingFirm`, `city`, `state`
  - `distributionPattern`, `productQuantity`, `codeInfo`
  - `recallInitiationDate`, `reportDate`, `voluntaryMandated`
  - `summary?: RecallSummary`
- `RecallSummary`: `shortSummary` plus sections (overview, productDetails, reason, healthRisks, distribution, actionRequired, additionalInfo, contact). This matches the section list in the old `prompt_builder.py` so the real LLM output drops in later.
- `Product`: upc, name, brand, size, category.
- `ScanItem`: raw line, normalized name, brand, upc, price, `status: confirmed | possible | clear | error`, recallNumbers.
- `Scan`: type receipt|barcode, createdAt, store, purchaseDate, total, items, verdict {headline, details, nextSteps[]}.
- `Alert`, `UserProfile` (isGuest, prefs.recheckOnOpen), `DataSourceStatus`.

### 3. Service interfaces (`src/services/types.ts`) with two adapters each
| Service | Methods | Future endpoint (documented in the HTTP stub) |
|---|---|---|
| `recalls` | `listRecent({status, page})`, `search(q)`, `get(recallNumber)` | `GET /api/recalls/recent`, `/api/recalls/search`, `/api/recalls/{n}` |
| `scan` | `scanBarcode(code)`, `scanReceipt(image: Blob)`, `getScan(id)` | `POST /api/scan/barcode`, `POST /api/scan/receipt` |
| `history` | `listScans(type)`, `listProducts()`, `deleteProduct(id)` | Firestore `users/{uid}/scans`, `/items` |
| `alerts` | `list()`, `dismiss(id)`, `recheck()` | `POST /api/watchlist/check`, Firestore `alerts` |
| `saved` | `list()`, `toggle(recallNumber)` | Firestore `savedRecalls` |
| `auth` | `current()`, `continueAsGuest()`, `signIn(email,pw)`, `signUp(...)`, `signInWithApple()`, `signInWithGoogle()`, `resetPassword()`, `signOut()`, `deleteAccount()` | Firebase Auth + `DELETE /api/account` |
| `meta` | `dataSourceStatus()` | openFDA `meta.last_updated` |

- **Mock adapters (`src/services/mock/`):**
  - Backed by `src/mocks/db.ts`, an in-memory store seeded from fixtures and persisted to localStorage (`rg-mock-db-v1`, wrapped in try/catch).
  - Scans therefore show up in history, stars persist, and alerts dismiss.
  - Every call goes through `delay()` (300–900 ms) and honours `mockConfig` (latency, force error, force empty) so loading, empty and error states can be reviewed.
- **HTTP placeholders (`src/services/http/`):**
  - Each method's JSDoc gives the endpoint, request and response.
  - Each method throws `NotImplementedError('POST /api/scan/receipt')`.
  - `src/lib/api.ts` is ported from ArchePal: `apiUrl()` uses an absolute `VITE_API_BASE_URL` on native, and `authHeader()` is a stub for now.
  - `docs/api-contract.md` lists every endpoint and its JSON shape, with example payloads taken from the fixtures.

### 4. Synthetic data (`src/mocks/data/`)
All brands and firms are fictional, to avoid implying that real companies issued recalls. Text follows real openFDA style.

- `recalls.ts`: ~24 recalls.
  - Mix of Class I/II/III and Ongoing/Completed/Terminated.
  - Report dates span the last 6 months.
  - Realistic reasons: Listeria, undeclared allergens, Salmonella, foreign material, mislabeling.
  - `codeInfo` with lot numbers and UPCs, some formatted with spaces (`0 12345 67890 5`), as real notices are.
  - Each recall has a hand-written `summary` (short plus all sections).
- `products.ts`: ~15 products keyed by valid UPC-A, in four groups:
  - 3 **confirmed** (UPC appears in a recall's `codeInfo`).
  - 3 **possible** (brand/name overlap only).
  - 9 **clear**.
- `receipts.ts`: 3 sample receipts.
  - Raw abbreviated lines (`GV WHL MLK 1GAL`), each paired with a normalized name.
  - Scenario A: all clear (12 items).
  - Scenario B: 1 confirmed + 1 possible (18 items).
  - Scenario C: a crumpled receipt with 2 unreadable lines (`error`) and the rest clear.
- `history.ts`: pre-seeded history for a returning user, plus an empty state for a fresh guest:
  - 5 past receipt scans.
  - 6 scanned products.
  - 2 alerts, one of them dismissed.
  - 3 saved recalls.
- `user.ts`: a guest profile and a signed-in profile.

**Mock scan rules:**
- **Barcode:**
  1. Validate the check digit, using `isValidGtin`/`toUpcA` ported from the old app's `food-recall-alert-ui/lib/scan.ts` into `src/lib/barcode.ts`. This stays useful once the real backend exists.
  2. A known UPC returns its scenario.
  3. An unknown valid UPC returns "Unknown product · no recalls found".
  4. An invalid code shows a validation error.
- **Receipt:** cycles A→B→C. The Developer panel can pin a scenario.
- **`recheck()`:** the first call after seeding "discovers" one new recall matching a saved product. This demonstrates the Home alert banner.

### 5. Frontend migration (TS + Tailwind 3 + shadcn)
- **Config:** copy ArchePal's `tailwind.config.ts`, `components.json`, `@/` alias, `eslint.config.js`, `typecheck` script.
- **Libraries:**
  - lucide-react replaces the emoji icons.
  - sonner replaces `useToast`.
  - TanStack Query handles data fetching, with hooks in `src/hooks/`.
  - react-hook-form + zod handle the auth forms.
  - react-markdown + rehype-sanitize render summaries.
- **Components:**
  - Port `ui.jsx` into `src/components/` (`ScreenHeader`, `TopBar`, `BottomNav`, `WithNav`, `AlertBanner`).
  - Add `RecallCard`, `ClassificationBadge`, `ScanItemRow`, `VerdictCard`, `SummarySections`, `EmptyState`, `ErrorState`, and Skeleton variants.
  - shadcn primitives live in `src/components/ui/`.
- **Native:** `src/lib/native.js` becomes `native.ts`, behavior unchanged.
- **Routing and layout:** keep BrowserRouter and the phone-frame layout. Add `vercel.json` with an SPA fallback rewrite so the static build deploys.

### 6. Screens and the synthetic data each one shows (bugs found in review fixed here)
| Route | Shows |
|---|---|
| `/`, `/walkthrough/:step` | Only on first launch (flag stored). Ends in Home as a guest, with "Sign in" as the secondary action |
| `/login`, `/signup`, `/forgot-password` | Mock auth. Any email/password works and a signed-in profile is seeded. Apple/Google buttons are mocked. zod validation. "Forgot password?" goes to a real reset screen (today it links to itself) |
| `/home` | Alert banner from undismissed alerts (today hardcoded). Quick actions open `/scan?mode=receipt` and `/scan?mode=product` (today both open receipt). Latest 3 recalls with short summaries. Recent scans. Calls `alerts.recheck()` on mount |
| `/recalls` | Active (Ongoing) and Resolved tabs. Search. Classification badges. Star saves. "Matches your items" badge from alerts |
| `/recalls/:recallNumber` | Summary tab with all AI sections. FDA details tab with raw fields. "Your items" tab with matched scan items (replaces the hardcoded "Batch found" and "Active Alerts (3)"). "Find Refund" opens the Action Required and contact sections. Share stays native |
| `/scan` | Native camera and barcode as today. Adds manual barcode entry and image upload for desktop. On error or with no camera: "Use sample" buttons for each scenario |
| `/scan/barcode/:scanId` | Product card, verdict, matching recalls with confidence, disclaimer. Removes the contradictory "Batch matched" + "Safe" badges and the hardcoded EXP |
| `/scan/receipt/:scanId` | Store/date/total header, verdict, items with flagged ones first, raw vs normalized names, error rows with "edit item". Loaded by scan id rather than router state, so results survive reload |
| `/receipts` | Receipt scans with an All/Alert/Clear filter (today the filter isn't wired), search, empty state for a new guest |
| `/products` | Scanned products with status and a delete action (today the screen lists stores) |
| `/profile` | Guest/sign-in card, "Re-check my items on open" toggle (replaces Notifications), "Data & sources" (mock openFDA last-updated plus disclaimer; replaces FDA Sync), Developer panel (latency, force error/empty, receipt scenario, reset mock data; hidden when `import.meta.env.PROD`), Log out, Delete account. **Integrated POS removed** |

## Phases

0. **Repo setup:** `git init`, `.gitignore`, add `docs/implementation-plan.md` (this plan) and `docs/api-contract.md`.
1. **TS + Tailwind/shadcn migration** with no behavior change. All routes are ported and the build, typecheck and `ios:sync` pass.
2. **Types, service interfaces, mock db, fixtures, React Query hooks,** plus HTTP placeholder adapters and the env switch.
3. **Recalls screens:** Home latest, `/recalls`, detail, saved.
4. **Scan flows:** barcode and receipt results, history lists.
5. **Auth (mock), profile, alerts/recheck, Developer panel.**
6. **Polish:** loading, empty and error states on every screen; iOS safe areas; delete `src/data/mock.js`; update README and CLAUDE.md. Deploy a static Vercel preview with `VITE_DATA_SOURCE=mock`.

## Later: backend integration (out of scope now, one service at a time)
- Fill in `src/services/http/*` against a FastAPI `/api` on Vercel, reusing ArchePal's `api/index.py`, `fb_admin.py` and upload/auth checks.
- Data sources:
  - openFDA, using the old pipeline's `data_fetcher.py`.
  - OpenAI summaries, using the old `prompt_builder.py` with Structured Outputs.
  - Open Food Facts for barcodes.
  - Document AI Expense Parser for receipts.
- Accounts and storage: Firebase anonymous → linked auth, and Firestore for history, alerts and the summary cache.
- Switch `VITE_DATA_SOURCE=api` per environment once all adapters are done.

## Verification
- After every phase: `npm run build`, `npm run typecheck` and `npm run lint` pass.
- Vitest for `src/lib/barcode.ts` (check digits, EAN-13→UPC-A) and the mock scan rules: confirmed, possible, clear, unknown and invalid.
- Manual walkthrough on desktop Chrome at phone width (`npm run dev`):
  1. Fresh guest: onboarding → Home shows the empty history state.
  2. Scan a confirmed UPC: the result shows a confirmed match, and the product appears in `/products`.
  3. Receipt scenario B shows 1 confirmed + 1 possible, and the receipt appears in `/receipts`.
  4. Return to Home: recheck adds the alert banner. Dismiss it.
  5. Star a recall, reload, and it's still starred.
  6. The Developer panel's force-error and force-empty settings show the error and empty states on every list.
  7. Sign up keeps the history. Delete account resets the mock data.
- iOS: `npm run ios:run` on a simulator and an iPhone. Native camera and barcode feed the mock scan, and layouts respect safe areas.
- Vercel preview: deep-linking to `/recalls/F-0123-2026` loads (SPA rewrite), and the bundle contains no secrets.
