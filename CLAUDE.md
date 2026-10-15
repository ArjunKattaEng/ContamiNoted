# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RecallGuard matches a user's purchases (scanned receipts and product barcodes) against FDA food recalls, on the web (phone, tablet and desktop layouts) and as an iOS app (Capacitor).

- **Live:** recalls come from openFDA through the FastAPI backend in `api/`, with Gemini summaries.
- **Demo data:** scans, history, alerts and accounts are still synthetic, behind the same typed service layer; see "Next steps".
- **Native:** the camera and barcode scanner are wired through Capacitor.

Stack: React 18, react-router-dom v6, Vite 5, TypeScript, Tailwind CSS 3 + shadcn/ui (Radix), lucide-react icons, sonner toasts. Capacitor 8 wraps the same build as the iOS app. The `@/` import alias maps to `src/`.

The build plan is in `docs/implementation-plan.md`, and the backend contract the frontend targets is in `docs/api-contract.md`.

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the built dist/
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm test          # vitest run (src/**/*.test.ts)
npm run test:api  # pytest (api/tests), offline: openFDA and Gemini are faked
npm run setup:api # create .venv with backend deps (needed by npm run dev / test:api)
npm run ios:sync  # build + cap sync ios (ios:run / ios to launch)
```

`npm run dev` starts Vite and uvicorn (`api.index:app` on :8000) together; Vite proxies `/api`. `typecheck`, `lint`, `test`, `test:api` and `build` must all pass.

## Run the app end to end

### 1. Prerequisites

- **Node** 18+ (developed on Node 25 / npm 11).
- **Python** 3.10+ (developed on 3.12) for the backend.
- **Optional:**
  - A **Gemini API key** for recall summaries (aistudio.google.com/apikey).
  - An **openFDA API key** (open.fda.gov/apis/authentication) for higher rate limits.
  - **Xcode** (developed on Xcode 27) for the iOS app. iOS dependencies come through Swift Package Manager, so no CocoaPods is needed.

### 2. Install (once)

```bash
npm install
npm run setup:api        # creates .venv and installs requirements-dev.txt (FastAPI, google-genai, pytest…)
```

### 3. Configure

Create the repo root `.env.local` (git-ignored). Both Vite and the backend read it:

```bash
VITE_LIVE_SERVICES=recalls   # recalls from the real backend; everything else stays demo data
GEMINI_API_KEY=…             # optional: AI summaries. Without it recalls still work and show the FDA text
```

- Vite only exposes `VITE_*` variables to the browser, so `GEMINI_API_KEY` never reaches the bundle.
- Backend settings can go in `api/.env` instead (copy `api/.env.example`), which takes precedence. `api/config.py` loads `api/.env`, then the root `.env.local`/`.env`, and never overrides real environment variables.

| Variable | Read by | Purpose |
|---|---|---|
| `VITE_LIVE_SERVICES` | Vite (build time) | Comma-separated services that use the backend. Live today: `recalls` |
| `VITE_DATA_SOURCE` | Vite | `mock` (default) or `api` (every service uses the backend; only for when all are implemented) |
| `VITE_API_BASE_URL` | Vite | Absolute API origin for the **iOS app** (the web app uses relative `/api`) |
| `GEMINI_API_KEY` | backend | Recall summaries. Omit to run without them |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | backend | Defaults `gemini-flash-latest` / `gemini-flash-lite-latest`; fallback on 503, 429 or timeout |
| `OPENFDA_API_KEY` | backend | Optional; raises openFDA's ~1,000/day keyless limit |
| `ALLOWED_ORIGINS` | backend | Extra CORS origins (localhost and `capacitor://localhost` are always allowed) |

### 4. Start

```bash
npm run dev
```

- Web: http://localhost:5173. API: http://localhost:8000, also reachable through the Vite proxy at http://localhost:5173/api. Interactive API docs at `/api/docs`.
- Logs are prefixed `[web]` and `[api]`; the API logs every openFDA and Gemini call, fallbacks and failures.
- Env files are read at startup: after changing `.env.local` or `api/.env`, restart `npm run dev`. uvicorn's auto-reload only watches `.py` files.

### 5. Check the backend

```bash
curl -s localhost:5173/api/health                                  # {"status":"ok","summaries":true}; false means no GEMINI_API_KEY
curl -s "localhost:5173/api/recalls/recent?status=active&pageSize=2"   # real openFDA recalls
curl -s "localhost:5173/api/recalls/summaries?numbers=<recallNumber>"  # Gemini one-line summary
curl -s localhost:5173/api/recalls/<recallNumber>/summary              # full sectioned summary
```

### 6. Walk through the app

1. **First launch.** `/` shows onboarding and ends on Home as a guest. To see onboarding again, clear the site's storage (the flag is `rg-onboarded-v1`).
2. **Recalls (live).** Home → Check Recalls, or the sidebar.
   - Lists appear in about a second, and one-line summaries fill in a few seconds later.
   - Open a recall: the FDA record shows immediately, then the full summary.
   - Search by product, brand or hazard (e.g. "listeria cheese"). Star a recall to save it.
3. **Scans (demo).** Scan → **Samples** gives one-tap outcomes: recalled, possible match, no recall, unknown product, invalid code, sample receipt.
   - **Type code** and **Upload** work on desktop.
   - Real barcodes show "Unknown product" (they're not in the demo catalog), and receipt photos are not read: the mock cycles sample receipts A → B → C.
   - On receipt C, name an unreadable line (e.g. "Harbor Bay smoked salmon") to see it re-checked.
4. **Accounts (demo).** Log in with any email to get a "returning user" with sample history.
   - The password `wrong` shows the error state.
   - Signing up from guest keeps your history.
5. **Alerts.** Logging in as a new demo user triggers the re-check, which "discovers" the hidden Meadowlark yogurt recall and shows a toast. See them under Alerts (bell or sidebar), and dismiss them there.
6. **Profile → Developer** (shown while any service is on demo data): network speed, force errors, force empty lists, next sample receipt, and **Reset demo data**.
7. **Layouts.** Desktop layout (sidebar, multi-column) needs a window at least 1024px wide *and* a mouse or trackpad. Narrower windows and touch devices get the phone/tablet layout.

To run **demo data only** (no backend): set `VITE_LIVE_SERVICES=` (empty) and run `npm run dev:web`.

### 7. Tests and checks

```bash
npm run typecheck && npm run lint && npm test && npm run test:api && npm run build
```

Backend tests are offline: openFDA and Gemini are faked, and fixtures are real openFDA records in `api/tests/fixtures`.

For a production-like run, use `npm run build && npm run preview`, with `npm run dev:api` running in another terminal. `vite preview` reuses the `/api` proxy.

### 8. iOS app

```bash
npm run ios:run      # build, sync and launch in a simulator/device (or `npm run ios` to open Xcode)
```

- The native app has no Vite proxy, so live recalls need `VITE_API_BASE_URL` set before building.
  - Simulator: `http://localhost:8000`, with `npm run dev:api` running.
  - Physical device: the deployed HTTPS URL (iOS blocks plain HTTP to other hosts).
- Without `VITE_API_BASE_URL`, live recalls show the error state on iOS.
- `VITE_*` values are baked in at build time: re-run `npm run ios:sync` after changing them.

### 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `.venv/bin/uvicorn: not found` | `npm run setup:api` |
| Port 5173 or 8000 already in use | `lsof -ti tcp:5173 \| xargs kill` (same for 8000) |
| `/api/health` shows `"summaries": false` | `GEMINI_API_KEY` isn't set in `.env.local` / `api/.env`; restart `npm run dev` |
| Summaries never fill in (shimmer, then nothing) | Read the `[api]` log. `503 UNAVAILABLE` (high demand) falls back to Flash-Lite automatically. `403 PERMISSION_DENIED` means a brand-new key still propagating, the Generative Language API not enabled, or key API restrictions. `429` means quota |
| Recalls error: "The FDA recall service is busy" | openFDA rate limit; set `OPENFDA_API_KEY` |
| Demo data looks inconsistent after an update | Profile → Developer → Reset demo data (or clear site storage) |
| A demo alert opens "Recall not found" | That fictional recall stays hidden until the re-check reveals it (log in as a new demo user) |
| Changed a `VITE_*` value but nothing changed | Restart the dev server (web) or rebuild (`npm run ios:sync`) |

## Backend (`api/`)

FastAPI, deployed as a Vercel Python function: `vercel.json` rewrites `/api/(.*)` to `api/index.py`, and dependencies live in the root `requirements.txt`. Settings come from env vars (`api/config.py`; locally `api/.env`, see `api/.env.example`).

- **Live so far:** `/api/recalls/recent|search|summaries|{recallNumber}|{recallNumber}/summary` (`api/routers/recalls.py`). Lists and detail never wait for the AI: they return FDA data plus any cached summary.
  - The frontend fills summaries in afterwards: `RecallList` uses `useRecallSummaries` (batches of 20), and `RecallDetail` uses `useRecallSummary`, showing skeletons meanwhile.
  - One-line summaries use the fast model first (`gemini-flash-lite-latest`), full summaries the stronger one first. It calls openFDA food enforcement (`api/services/openfda.py`) and summarizes with Gemini structured output (`api/services/summarizer.py`, prompt ported from the old food-recall pipeline).
  - The provider sits behind `StructuredLLM` in `api/services/llm.py` (`GeminiLLM`, `google-genai` SDK).
  - `GEMINI_MODEL` (default `gemini-flash-latest`) falls back to `GEMINI_FALLBACK_MODEL` (default `gemini-flash-lite-latest`) on 503, 429 or a per-model timeout.
  - `summary.model` records the model that actually answered.
- **Summaries are optional.** With no `GEMINI_API_KEY`, or on a model error or timeout, `summary` is omitted and the UI shows the FDA text.
  - Summaries are cached in-process (`TTLCache`) and at the CDN via `Cache-Control` (15 min, or 1 min when summaries are missing). Firestore replaces the in-process cache later.
- **Conventions:**
  - Response models in `api/models.py` are snake_case in Python and camelCase in JSON.
  - Errors are `ApiError` → `{"error": {"code", "message"}}`, and validation errors map to 400 `invalid_request`.
  - Services are injected with `Depends` (`api/deps.py`) so tests can override them.
  - httpx and Gemini clients are created per event loop (`PerLoop`).
  - `api/config.py` loads `api/.env`, then the root `.env.local` / `.env` (never overriding real env vars).

## Responsive layout

There are two formats:

- **Phone/tablet** (the default; all touch devices, including the iOS app on iPad):
  - full-width pages, a `ScreenHeader` with a back button, and the bottom tab bar on tab screens;
  - `md:` (≥768px) widens the column and switches lists to two columns.
- **Desktop**, via Tailwind's custom `desktop:` screen (≥1024px *and* hover + fine pointer; `useIsDesktop()` in `src/hooks/use-media-query.ts` uses the same query, so keep them in sync):
  - the `Sidebar` replaces the bottom nav and `TopBar`;
  - `ScreenHeader` becomes a large left-aligned title, with a back button only when `backOnDesktop` is set (detail pages);
  - pages can use multi-column layouts.

Prefer CSS (`desktop:` classes). Branch in JS with `useIsDesktop()` only when the structure differs (e.g. `RecallDetail` swaps tabs for a two-column layout). Every page is an optional `ScreenHeader` followed by a scrollable `Screen`. Both use the shared `pageColumn` width classes, so they line up.

## Architecture

- `src/main.tsx` mounts `<App>` inside `BrowserRouter` and adds `html.native` inside Capacitor. `src/App.tsx` is the only place routes are defined, and it also renders the full-screen app shell and the sonner `<Toaster>`.
- Routes come in three groups:
  - Onboarding, auth and the `/scan` camera stand alone.
  - Everything else sits under the `AppShell` layout route (desktop sidebar).
  - Within `AppShell`, tab screens (`/home`, `/receipts`, `/products`, `/profile`) are nested under `WithNav` (bottom tab bar on phones/tablets). The rest (`/recalls`, `/recalls/:recallNumber`, scan results, `/profile/*` sub-pages) are full-screen on phones with a back button.

  Unknown paths redirect to `/`. Use `recallPath()` from `src/lib/recall.ts` for recall links and `scanPath()` from `src/lib/scan.ts` for scan results (`/scan/receipt/:scanId`, `/scan/barcode/:scanId`).
- Scan flow (`screens/Scan.tsx` → `screens/ScanResults.tsx`):
  - The camera screen captures a photo or barcode, or takes an upload or typed code. Receipt images go through `prepareReceiptImage` (≤1600px JPEG) before `useScanReceipt`.
  - On success it navigates to the result page with `replace`, so Back skips the camera.
  - In mock mode a "Samples" panel uses `src/mocks/demo.ts`, the only `src/mocks` module UI code may import.
- `src/screens/*.tsx` group related screens per file and use named exports (except `Home.tsx`, which has a default export). The README has the full wireframe → route → file table.
- **Code splitting.** Every screen except Home is `React.lazy`-loaded in `App.tsx`. Add new screens the same way. `AppShell` and `WithNav` wrap their `<Outlet>` in `Suspense` (`PageLoader`), so navigation chrome stays visible.
  - Keep heavy dependencies off Home and the list screens. `ScanParts.tsx` (verdict, item rows) pulls in the markdown renderer; list rows and badges live in `ScanRows.tsx` / `ScanStatus.tsx`.
  - `vite.config.ts` splits `react` and `markdown` vendor chunks. Check `dist/index.html` after builds: only the app entry and `react` should preload.
- `ErrorBoundary` around the routes shows a Reload/Go home screen instead of a blank page.
- `ScreenHeader` and `PageTitle` set the browser tab title via `useDocumentTitle`. Pages without either call it directly (Home, Scan, onboarding).
- `src/components/ui/` holds the shadcn primitives (`button`, `badge`, `input`, `tabs`, `switch`, `sonner`, `card`, `label`, `separator`, `skeleton`, plus `native-select`). These are restyled to the wireframe look: the `Button` variants are `default`/`secondary`/`destructive`/`ghost`/`link`, and the `Badge` variants are `alert`/`safe`/`warn`/`outline`. Add new ones in shadcn style.
- `src/components/*.tsx` holds the app components (`Screen`/`SectionTitle`/`PageTitle`, `ScreenHeader`, `TopBar`, `RowCard`/`RowMeta`/`RowTrailing`, `ToggleRow`, `MenuRow`, `AlertBanner`/`AlertNotice`, `Placeholder`, `Logo`, `BottomNav`, `WithNav`). Reuse these rather than adding one-off markup.
- `src/lib/native.ts` wraps the Capacitor plugins (haptics, status bar, camera, barcode scanner, share) with web fallbacks. `src/lib/utils.ts` has `cn()`.
- **Data layer.** `src/types/index.ts` has the domain types, which mirror `docs/api-contract.md` and `api/models.py` (keep all three in sync). `src/services/types.ts` defines the service interfaces (`recalls`, `scan`, `history`, `alerts`, `saved`, `auth`, `meta`), and `src/services/index.ts` exports `services`:
  - With `VITE_DATA_SOURCE=mock` (default), each service uses `src/services/mock/` unless it is listed in `VITE_LIVE_SERVICES` (e.g. `recalls`), in which case it uses `src/services/http/`. `VITE_DATA_SOURCE=api` makes every service live.
  - `httpRecalls` is implemented with `apiFetch`. The other HTTP adapters still throw `NotImplementedError`.
  - Use `isLive(name)`, `usesDemoData` and `isDemoRecall(recall)` from `@/services` to keep labels honest: the demo badges, the Developer panel, scan samples and the recall disclaimer depend on them.
  - With live recalls but demo scans, `recalls.get` falls back to the fixture recalls, so demo alerts still open.
  - Services throw `ApiError` with contract error codes (`src/services/errors.ts`).
- **Hooks.** Screens use the React Query hooks in `src/hooks/use-*.ts` and never call services or fixtures directly (the one exception: `src/mocks/demo.ts`). Query keys live in `src/hooks/queryKeys.ts`, and `QueryClientProvider` is set up in `main.tsx`.
- **Mock backend (`src/mocks/`).**
  - `data/` holds the synthetic fixtures: recalls with summaries, the barcode product catalog, and receipts A–E. All brands are fictional, and dates are relative to today.
  - `scanBuilder.ts` assembles `Scan`/`WatchItem`/`Alert` objects from fixtures.
  - `db.ts` holds per-user state, persisted to localStorage (`rg-mock-db-v1`). Bump `MockDb.version` whenever stored types change, so stale demo data is discarded instead of breaking screens. `config.ts` holds the Developer controls (latency, force error/empty, receipt scenario), and `seed.ts` holds the seeded "returning user" history.
  - Demo rules: sample barcodes are in `mocks/data/products.ts` (`sampleBarcodes`). Receipt scans cycle through A→B→C. Logging in with a new email seeds history, and the password "wrong" fails. The Meadowlark yogurt recall stays hidden until the first `alerts.recheck()` finds a user who bought it.
- **Auth.** There is always a user: `useCurrentUser()` (`src/hooks/use-auth.ts`) starts a guest session automatically.
  - Sign-in, sign-up, social, sign-out and delete-account mutations go through `useAccountSwitch`. It stores the new user and resets every `userScopedKeys` query, so the previous account's data never shows.
  - Sign-up upgrades a guest in place (history kept).
  - Auth forms use react-hook-form + zod with `FormField`. Service errors show via `form.setError('root')`.
  - The onboarding walkthrough shows on first launch only (`hasOnboarded`/`markOnboarded` in `src/lib/storage.ts`).
- **Alerts.** `useRecheckOnOpen` (mounted in `AppShell`) calls `alerts.recheck()` once per account per session, then again on app resume (Capacitor `App` resume / `visibilitychange`). It's throttled to 5 minutes and only runs when `prefs.recheckOnOpen` is on. New alerts raise a toast with a "View" action to `/alerts`.
- **Profile** (`screens/Profile.tsx`): account card (guest vs signed in), recall-alert settings with "Check now", Data & sources, log out, and delete account or clear guest data with confirmation. In mock mode it also has the Developer panel (latency, force error/empty, receipt scenario, reset demo data).
- `src/index.css` defines the design tokens as HSL CSS variables (shadcn names plus `--destructive-soft`, `--success`/`--success-soft`, `--warning`/`--warning-soft`, `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right`). `tailwind.config.ts` maps them to colors and adds the `pt-safe-top`/`pb-safe-bottom` spacing and the `native:`/`web:` variants. Style with Tailwind classes; avoid inline `style` and new global CSS.

## Placeholder behavior to be aware of

- Recalls are live (with `VITE_LIVE_SERVICES=recalls`). Auth, scans, history, alerts and saved recalls run on the mock backend; their HTTP adapters throw `NotImplementedError`.
- The Apple/Google buttons are text-only. Real Sign in with Apple must follow Apple's button and logo guidelines.
- "Find refund" on a recall jumps to its "What to do" section; there is no refund integration. Share uses the native share sheet (or the clipboard on desktop).

Backend status per service: see the backend table in `docs/implementation-plan.md` (recalls are live; scans, receipts and Firebase are next).

## Next steps

Roughly in priority order. When you finish one, update the status tables in `docs/implementation-plan.md` and the endpoint notes in `docs/api-contract.md`.

### Housekeeping

1. **Commit and push.** Nothing has been committed since the initial commit (`86acefd`). Suggested: one commit per frontend phase (1–6), then one for the live-recalls backend. Then push to a new GitHub repo, so Vercel can deploy every push.
2. **Deploy to Vercel.** Run `vercel login`, then `vercel deploy` for a preview.
   - Set project env vars: `VITE_LIVE_SERVICES=recalls` (build time), `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `OPENFDA_API_KEY`, `ALLOWED_ORIGINS`.
   - Verify that `/api/*` reaches `api/index.py`, the 60-second `maxDuration` holds, and the `Cache-Control` headers are honored by the CDN.
3. **Get an openFDA API key** (open.fda.gov/apis/authentication). Without one, shared Vercel IPs can hit openFDA's ~1,000 requests/day limit.

### Backend integration (see the backend table in `docs/implementation-plan.md`)

4. **Step 2: live barcode scans.** `POST /api/scan/barcode`:
   - Validate the GTIN (port `src/lib/barcode.ts`).
   - Look up the product in Open Food Facts (name, brand, size).
   - Query openFDA by UPC variants plus brand/name terms.
   - Match locally: a UPC in `code_info`/`product_description` is `confirmed`, name overlap is `possible`. Port `upcAppearsIn` and `src/mocks/matching.ts` to Python.
   - Write the verdict with the `StructuredLLM` (`api/services/llm.py`).
   - Then implement `httpScan.scanBarcode`/`getScan` and add `scan` to `VITE_LIVE_SERVICES`.
   - Saving scans needs step 4; until then the endpoint can return the `Scan` unsaved.
5. **Step 3: live receipt scans.** `POST /api/scan/receipt`:
   - Read the receipt with a Google Document AI Expense Parser processor (GCP project, `DOCAI_PROJECT_ID`/`DOCAI_LOCATION`/`DOCAI_PROCESSOR_ID`, service-account credentials).
   - One Gemini call normalizes abbreviated item names and drops non-food lines.
   - Batch the openFDA queries (window: purchase date − 12 months to now), then match per item.
   - Also `PATCH /api/scans/{scanId}/items/{itemId}` for naming unreadable lines.
6. **Step 4: Firebase.**
   - Auth: anonymous guest, upgraded via `linkWithCredential` for email/Apple/Google (`@capacitor-firebase/authentication` on iOS).
   - Firestore: `users/{uid}` plus `scans`, `items`, `alerts` and `savedRecalls` subcollections; `recallSummaries/{recallNumber}` replaces the in-process `TTLCache`.
   - Security rules and indexes.
   - FastAPI verifies the Firebase ID token on everything except the public recall reads.
   - Then build `DELETE /api/account`, `POST /api/watchlist/check` (the re-check) and `GET /api/meta/data-source` (openFDA `meta.last_updated`).
   - Flip the remaining services live, and finally `VITE_DATA_SOURCE=api`.
7. **Cost and abuse controls:** per-user daily quotas on the scan endpoints (Firestore counters, 429 `quota_exceeded`), plus a daily Vercel Cron (`/api/cron/warm-summaries`, protected by `CRON_SECRET`) that pre-generates summaries for the newest recalls.

### Frontend

8. Once every service is live, load `src/services/mock` only in mock mode (dynamic import), so the fixtures don't ship in production. Retire the demo-only UI (`usesDemoData` paths, scan Samples, Developer panel) or keep it behind a flag.
9. The sidebar highlights nothing on scan result pages (`/scan/receipt|barcode/:scanId`). Highlight Receipts or Products.
10. Replace the text-only Apple/Google buttons with ones that follow Apple's and Google's sign-in brand guidelines (needed for App Store review).

### iOS release

11. Test on a simulator or device beyond the splash screen (`npm run ios:run`, Xcode 27): native camera and barcode scanner, receipt upload and resize, the re-check on app resume, safe areas in landscape.
12. Native builds need `VITE_API_BASE_URL` set to the deployed origin; CORS already allows `capacitor://localhost`.
13. App Store prep: app icon and splash, the Sign in with Apple capability, privacy manifest and App Privacy labels (camera, account data), in-app account deletion (already in Profile), then TestFlight.

