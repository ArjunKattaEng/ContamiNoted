# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RecallGuard matches a user's purchases (scanned receipts and product barcodes) against FDA food recalls, on the web (phone, tablet and desktop layouts) and as an iOS app (Capacitor).

- **Live, real data only:**
  - Recalls come from openFDA through the FastAPI backend in `api/`, with Gemini summaries.
  - Saved recalls are stored on the device.
- **Coming soon:** barcode scan, receipt scan, product and receipt history, alerts and accounts. Their screens are built but hidden behind `src/lib/features.ts` until each backend exists; see "Next steps".
- **No synthetic data:** the demo/mock layer was removed.
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
GEMINI_API_KEY=…             # optional: AI summaries. Without it recalls still work and show the FDA text
```

- Vite only exposes `VITE_*` variables to the browser, so `GEMINI_API_KEY` never reaches the bundle.
- Backend settings can go in `api/.env` instead (copy `api/.env.example`), which takes precedence. `api/config.py` loads `api/.env`, then the root `.env.local`/`.env`, and never overrides real environment variables.

| Variable | Read by | Purpose |
|---|---|---|
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

1. **First launch.** `/` shows onboarding and ends on Home. To see onboarding again, clear the site's storage (the flag is `rg-onboarded-v1`).
2. **Home.** Latest recalls (live) and your saved recalls, plus a "Scanning is coming soon" card.
3. **Recalls** (tab on phones, sidebar on desktop):
   - Active, Resolved and Saved tabs, plus search by product, brand or hazard (e.g. "listeria cheese").
   - Lists appear in about a second, and one-line summaries fill in a few seconds later.
   - Open a recall: the FDA record shows immediately, then the full summary. Find refund, Share and Save are available.
4. **Saved recalls.** Star a recall: it is stored on this device (`rg-saved-recalls-v1`). Profile → Saved on this device shows the count and can clear them.
5. **Profile.** Saved-on-device summary, and Data & sources with openFDA's real last-updated date.
6. **Coming soon.** `/scan`, `/receipts`, `/products`, `/alerts`, `/login` and `/signup` show a "Coming soon" screen and are hidden from navigation.
7. **Layouts.** Desktop layout (sidebar, multi-column) needs a window at least 1024px wide *and* a mouse or trackpad. Narrower windows and touch devices get the phone/tablet layout.

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
| A saved recall opens "Recall not found" | openFDA no longer returns that recall number; remove it from Saved |
| Changed a `VITE_*` value but nothing changed | Restart the dev server (web) or rebuild (`npm run ios:sync`) |

## Backend (`api/`)

FastAPI, deployed as a Vercel Python function: `vercel.json` rewrites `/api/(.*)` to `api/index.py`, and dependencies live in the root `requirements.txt`. Settings come from env vars (`api/config.py`; locally `api/.env`, see `api/.env.example`).

- **Live so far:**
  - `/api/recalls/recent|search|summaries|{recallNumber}|{recallNumber}/summary` (`api/routers/recalls.py`).
  - `/api/meta/data-source` (`api/routers/meta.py`): openFDA's `meta.last_updated`.

  Recall details: Lists and detail never wait for the AI: they return FDA data plus any cached summary.
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
  - Within `AppShell`, tab screens (`/home`, `/recalls`, `/receipts`, `/products`, `/profile`) are nested under `WithNav` (bottom tab bar on phones/tablets). The rest (`/recalls/:recallNumber`, `/alerts`, scan results) are full-screen on phones with a back button.
  - Routes for unbuilt features are wrapped in `FeatureGate` (`screens/ComingSoon.tsx`), which renders "Coming soon" while the flag in `src/lib/features.ts` is off. `BottomNav`, `Sidebar`, `TopBar`, Home, Profile, onboarding and recall detail ("Your items") also check those flags.

  Unknown paths redirect to `/`. Use `recallPath()` from `src/lib/recall.ts` for recall links and `scanPath()` from `src/lib/scan.ts` for scan results (`/scan/receipt/:scanId`, `/scan/barcode/:scanId`).
- Scan flow (`screens/Scan.tsx` → `screens/ScanResults.tsx`):
  - The camera screen captures a photo or barcode, or takes an upload or typed code. Receipt images go through `prepareReceiptImage` (≤1600px JPEG) before `useScanReceipt`.
  - On success it navigates to the result page with `replace`, so Back skips the camera.
  - The camera screen only offers modes whose flag is on (`features.receiptScan` / `features.barcodeScan`).
- `src/screens/*.tsx` group related screens per file and use named exports (except `Home.tsx`, which has a default export). The README has the full wireframe → route → file table.
- **Code splitting.** Every screen except Home is `React.lazy`-loaded in `App.tsx`. Add new screens the same way. `AppShell` and `WithNav` wrap their `<Outlet>` in `Suspense` (`PageLoader`), so navigation chrome stays visible.
  - Keep heavy dependencies off Home and the list screens. `ScanParts.tsx` (verdict, item rows) pulls in the markdown renderer; list rows and badges live in `ScanRows.tsx` / `ScanStatus.tsx`.
  - `vite.config.ts` splits `react` and `markdown` vendor chunks. Check `dist/index.html` after builds: only the app entry and `react` should preload.
- `ErrorBoundary` around the routes shows a Reload/Go home screen instead of a blank page.
- `ScreenHeader` and `PageTitle` set the browser tab title via `useDocumentTitle`. Pages without either call it directly (Home, Scan, onboarding).
- `src/components/ui/` holds the shadcn primitives (`button`, `badge`, `input`, `tabs`, `switch`, `sonner`, `card`, `label`, `separator`, `skeleton`, plus `native-select`). These are restyled to the wireframe look: the `Button` variants are `default`/`secondary`/`destructive`/`ghost`/`link`, and the `Badge` variants are `alert`/`safe`/`warn`/`outline`. Add new ones in shadcn style.
- `src/components/*.tsx` holds the app components:
  - layout: `Screen`/`SectionTitle`/`PageTitle`, `ScreenHeader`, `TopBar`, `BottomNav`, `Sidebar`, `AppShell`, `WithNav`;
  - rows and controls: `RowCard`/`RowMeta`/`RowTrailing`, `ToggleRow`, `MenuRow`, `AlertBanner`;
  - recalls: `RecallCard`, `RecallList`, `RecallBadges`, `Markdown`;
  - scans: `ScanParts`/`ScanRows`/`ScanStatus`;
  - states and misc: `StateViews`, `SearchInput`, `FormField`, `Logo`, `ErrorBoundary`, `PageLoader`.

  Reuse these rather than adding one-off markup.
- `src/lib/native.ts` wraps the Capacitor plugins (haptics, status bar, camera, barcode scanner, share) with web fallbacks. `src/lib/utils.ts` has `cn()`.
- **Data layer.** `src/types/index.ts` has the domain types, which mirror `docs/api-contract.md` and `api/models.py` (keep all three in sync). `src/services/types.ts` defines the service interfaces (`recalls`, `scan`, `history`, `alerts`, `saved`, `auth`, `meta`), and `src/services/index.ts` exports `services`:
  - Every service is the HTTP adapter in `src/services/http/` (`apiFetch` in `src/lib/api.ts`), except `saved`, which is `src/services/local/saved.ts` (localStorage) until accounts exist.
  - Implemented today: `httpRecalls` and `httpMeta`. The scan, history, alerts and auth adapters still throw `NotImplementedError`.
  - Their hooks are disabled (`enabled: features.x`) while the matching flag is off, so nothing calls a placeholder.
  - Services throw `ApiError` with contract error codes (`src/services/errors.ts`).
- **Hooks.** Screens use the React Query hooks in `src/hooks/use-*.ts` and never call services directly. Query keys live in `src/hooks/queryKeys.ts`, and `QueryClientProvider` is set up in `main.tsx`.
- **No synthetic data.** Don't add fixtures or fake data to the app. Tests use real openFDA records (`api/tests/fixtures`) or small inline values.
- **Auth (coming soon; `features.accounts`).** Once on, there is always a user: `useCurrentUser()` (`src/hooks/use-auth.ts`) starts a guest session automatically.
  - Sign-in, sign-up, social, sign-out and delete-account mutations go through `useAccountSwitch`. It stores the new user and resets every `userScopedKeys` query, so the previous account's data never shows.
  - Sign-up upgrades a guest in place (history kept).
  - Auth forms use react-hook-form + zod with `FormField`. Service errors show via `form.setError('root')`.
  - The onboarding walkthrough shows on first launch only (`hasOnboarded`/`markOnboarded` in `src/lib/storage.ts`).
- **Alerts (coming soon; `features.alerts`).** `useRecheckOnOpen` (mounted in `AppShell`, inert while accounts and alerts are off) calls `alerts.recheck()` once per account per session, then again on app resume (Capacitor `App` resume / `visibilitychange`). It's throttled to 5 minutes and only runs when `prefs.recheckOnOpen` is on. New alerts raise a toast with a "View" action to `/alerts`.
- **Profile** (`screens/Profile.tsx`):
  - Always: "Saved on this device" (count and clear), Data & sources (openFDA last updated) and the app version.
  - With `features.accounts`: the account card, log out, and delete account.
  - With `features.alerts`: alert settings and "Check now".
- `src/index.css` defines the design tokens as HSL CSS variables (shadcn names plus `--destructive-soft`, `--success`/`--success-soft`, `--warning`/`--warning-soft`, `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right`). `tailwind.config.ts` maps them to colors and adds the `pt-safe-top`/`pb-safe-bottom` spacing and the `native:`/`web:` variants. Style with Tailwind classes; avoid inline `style` and new global CSS.

## Placeholder behavior to be aware of

- Only recalls (and the data-source date) are live. Scan, history, alerts and auth show "Coming soon" (`src/lib/features.ts`), and their HTTP adapters throw `NotImplementedError` until built.
- Saved recalls live in localStorage on each device; they move to Firestore with accounts.
- The Apple/Google buttons are text-only. Real Sign in with Apple must follow Apple's button and logo guidelines.
- "Find refund" on a recall jumps to its "What to do" section; there is no refund integration. Share uses the native share sheet (or the clipboard on desktop).

Backend status per service: see the backend table in `docs/implementation-plan.md` (recalls are live; scans, receipts and Firebase are next).

## Deployment

- **Production:** https://contami-noted.vercel.app (Vercel account "thundered"). It deploys from GitHub `ArjunKattaEng/ContamiNoted`, branch `main`, on every push.
- **Vercel env vars:** `GEMINI_API_KEY` (Secret), optionally `OPENFDA_API_KEY` (Secret), `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`. `VITE_LIVE_SERVICES` is no longer used and can be deleted.
- **Pushing:** only the `ArjunKattaEng` GitHub account can push. Run `gh auth switch --user ArjunKattaEng`, then `git push`, then switch back.
- **Checks after a deploy:**
  - `/api/health` → `"summaries": true`
  - `/api/recalls/recent` → live recalls
  - `/api/meta/data-source` → openFDA last-updated date

## Next steps

Roughly in priority order. When you finish one, update the status tables in `docs/implementation-plan.md` and the endpoint notes in `docs/api-contract.md`.

### Housekeeping

1. ~~Commit and push~~ and ~~deploy to Vercel~~: done (see "Deployment").
2. **Remove the unused `VITE_LIVE_SERVICES`** variable from Vercel and from the local `.env.local`.
3. **Get an openFDA API key** (open.fda.gov/apis/authentication). Without one, shared Vercel IPs can hit openFDA's ~1,000 requests/day limit. Confirm the CDN caches recall lists (`x-vercel-cache: HIT` on repeat requests).

### Backend integration (see the backend table in `docs/implementation-plan.md`)

4. **Step 2: live barcode scans.** `POST /api/scan/barcode`:
   - Validate the GTIN (port `src/lib/barcode.ts`).
   - Look up the product in Open Food Facts (name, brand, size).
   - Query openFDA by UPC variants plus brand/name terms.
   - Match locally: a UPC in `code_info`/`product_description` is `confirmed`, name overlap is `possible`. Port `upcAppearsIn` (`src/lib/barcode.ts`) and the name-matching rule to Python. The rule is in the removed mock layer, `src/mocks/matching.ts` in git history: every word for names of 1–2 words, at least half for longer names.
   - Write the verdict with the `StructuredLLM` (`api/services/llm.py`).
   - Then implement `httpScan.scanBarcode`/`getScan` and set `features.barcodeScan = true`.
   - Saving scans needs step 4; until then the endpoint can return the `Scan` unsaved.
5. **Step 3: live receipt scans.** `POST /api/scan/receipt`:
   - Read the receipt with a Google Document AI Expense Parser processor (GCP project, `DOCAI_PROJECT_ID`/`DOCAI_LOCATION`/`DOCAI_PROCESSOR_ID`, service-account credentials).
   - One Gemini call normalizes abbreviated item names and drops non-food lines.
   - Batch the openFDA queries (window: purchase date − 12 months to now), then match per item.
   - Also `PATCH /api/scans/{scanId}/items/{itemId}` for naming unreadable lines. Then set `features.receiptScan = true`.
6. **Step 4: Firebase.**
   - Auth: anonymous guest, upgraded via `linkWithCredential` for email/Apple/Google (`@capacitor-firebase/authentication` on iOS).
   - Firestore: `users/{uid}` plus `scans`, `items`, `alerts` and `savedRecalls` subcollections; `recallSummaries/{recallNumber}` replaces the in-process `TTLCache`.
   - Security rules and indexes.
   - FastAPI verifies the Firebase ID token on everything except the public recall reads.
   - Then build `DELETE /api/account` and `POST /api/watchlist/check` (the re-check), and add `lastWatchCheckAt` to `/api/meta/data-source`.
   - Move saved recalls from `src/services/local/saved.ts` to Firestore (migrate each device's local list on first sign-in).
   - Set `features.accounts`, `features.history` and `features.alerts` to true.
7. **Cost and abuse controls:** per-user daily quotas on the scan endpoints (Firestore counters, 429 `quota_exceeded`), plus a daily Vercel Cron (`/api/cron/warm-summaries`, protected by `CRON_SECRET`) that pre-generates summaries for the newest recalls.

### Frontend

8. When a feature flag turns on, re-check its screens against the real API. They were last exercised with the removed mock layer, so loading and error states are built, but real data may surface new cases.
9. The sidebar highlights nothing on scan result pages (`/scan/receipt|barcode/:scanId`). Highlight Receipts or Products.
10. Replace the text-only Apple/Google buttons with ones that follow Apple's and Google's sign-in brand guidelines (needed for App Store review).

### iOS release

11. Native builds need `VITE_API_BASE_URL=https://contami-noted.vercel.app` (then `npm run ios:sync`); CORS already allows `capacitor://localhost`.
12. Test on a simulator or device beyond the splash screen (`npm run ios:run`, Xcode 27): live recalls and summaries, saving, safe areas in landscape. Once scanning is live, also test the native camera and barcode scanner and receipt upload.
13. App Store prep: app icon and splash, the Sign in with Apple capability, privacy manifest and App Privacy labels (camera, account data), in-app account deletion (already in Profile), then TestFlight.

