# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RecallGuard matches a user's purchases (scanned receipts and product barcodes) against FDA food recalls, on the web (phone, tablet and desktop layouts) and as an iOS app (Capacitor).

- **Live, real data only:**
  - Recalls come from openFDA through the FastAPI backend in `api/`, with Gemini summaries.
  - Barcode scans (guest mode): `POST /api/scan/barcode` checks a product against recalls (Open Food Facts + openFDA, deterministic matching). The backend is stateless; scan history (the Products tab) is stored on the device.
  - Saved recalls are stored on the device.
  - Alerts (guest mode): when the app opens, the products saved on the device are re-checked with `POST /api/watchlist/check` (stateless); matches become alerts on the device.
- **Coming soon:** receipt scan and receipt history (screens built, hidden behind `src/lib/features.ts`).
- **Accounts (built, switched off for real users):** Firebase Auth (email/password, Google) and Firestore keep a signed-in user's saved recalls, scans and alerts, and a guest's device data moves into the account on sign-in. They only turn on with `VITE_ACCOUNTS=true` plus a Firebase config, and Vercel has neither. See "Accounts (Firebase)".
- **No synthetic data:** the demo/mock layer was removed.
- **Native:** the camera and barcode scanner are wired through Capacitor.

Stack: React 18, react-router-dom v6, Vite 5, TypeScript, Tailwind CSS 3 + shadcn/ui (Radix), lucide-react icons, sonner toasts. Capacitor 8 wraps the same build as the iOS app. The `@/` import alias maps to `src/`.

The build plan is in `docs/implementation-plan.md`, and the backend contract the frontend targets is in `docs/api-contract.md`.

## Current focus: Congressional App Challenge

- **Deadline:** submission closes **October 26, 2026 at 12:00 p.m. ET** (code, demo video and written responses). The app is a middle-school team's entry, so the students must be able to explain and demo every part of it.
- **Scope decision: guest mode first.** What's deployed ships without accounts or a database: the backend is stateless, and the user's data (saved recalls, scans, alerts) lives in localStorage on the device. Accounts are built but stay off until they've been tested on the emulators and a real Firebase project is set up; receipt scanning (Document AI) and the App Store are out of scope until after the deadline. Describe them in the written responses as the roadmap.
- **Demo path:** the deployed web app on a phone browser (the barcode scanner works over HTTPS). The iOS build is optional, e.g. for the video.
- **Prefer robustness over features:** no AI in the scan verdict, an honest "No FDA recall found" (never "safe"), and errors instead of a "clear" result whenever openFDA couldn't be checked.

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the built dist/
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm test          # vitest run (src/**/*.test.ts)
npm run test:api  # pytest (api/tests), offline: openFDA, Open Food Facts and Gemini are faked
npm run setup:api # create .venv with backend deps (needed by npm run dev / test:api)
npm run ios:sync  # build + cap sync ios (ios:run / ios to launch)

# Accounts (Firebase emulators; firebase-tools runs through npx, the Firestore emulator needs Java 11+)
npm run emulators      # Auth :9099, Firestore :8080, Emulator UI http://127.0.0.1:4000 (data kept in .emulator-data/)
npm run test:auth      # Auth emulator tests (no Java needed)
npm run test:rules     # firestore.rules tests (Firestore emulator)
npm run test:firebase  # everything in tests/firebase: rules, accounts, account data and merging
```

`npm run dev` starts Vite and uvicorn (`api.index:app` on :8000) together; Vite proxies `/api`. `typecheck`, `lint`, `test`, `test:api` and `build` must all pass.

## Run the app end to end

### 1. Prerequisites

- **Node** 18+ (developed on Node 25 / npm 11).
- **Python** 3.10+ (developed on 3.12) for the backend.
- **Optional:**
  - A **Gemini API key** for recall summaries (aistudio.google.com/apikey).
  - An **openFDA API key** (open.fda.gov/apis/authentication) for higher rate limits. Optional locally, but set it in Vercel: every scan and re-check calls openFDA.
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
| `OPENFDA_API_KEY` | backend | Raises openFDA's ~1,000/day keyless limit (shared by all of Vercel's IPs). Optional locally; set it in production |
| `ALLOWED_ORIGINS` | backend | Extra CORS origins (localhost and `capacitor://localhost` are always allowed) |
| `VITE_ACCOUNTS` | Vite | `true` turns accounts on (needs a Firebase config or the emulators). Unset in production |
| `VITE_USE_FIREBASE_EMULATORS` | Vite | `true` (development builds only): use the local emulators and a demo project. Put it in `.env.development.local` |
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Vite | The real Firebase project's web config (see "Accounts (Firebase)") |

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
curl -s -X POST localhost:5173/api/scan/barcode -H 'Content-Type: application/json' \
  -d '{"code":"3017620422003"}'                                        # barcode check (Open Food Facts + openFDA)
curl -s -X POST localhost:5173/api/watchlist/check -H 'Content-Type: application/json' \
  -d '{"items":[{"id":"barcode-3017620422003","upc":"3017620422003","name":"Nutella","brand":"Ferrero"}]}'  # re-check
```

For a confirmed match, search the Recalls tab for "UPC", open an active recall that prints one, and scan or type that barcode.

### 6. Walk through the app

1. **First launch.** `/` shows onboarding and ends on Home. To see onboarding again, clear the site's storage (the flag is `rg-onboarded-v1`).
2. **Home.** Quick actions (Scan Product, Check Recalls), latest recalls (live) and your saved recalls.
3. **Recalls** (tab on phones, sidebar on desktop):
   - Active, Resolved and Saved tabs, plus search by product, brand or hazard (e.g. "listeria cheese").
   - A time-window filter defaults to the **last 30 days**; the options are 7 days, 30 days, 90 days, a year and all time. It's kept in the URL as `?days=7|90|365|all`.
   - Active and search filter by report date. Resolved filters and sorts by **closing date** (`termination_date`), and its cards show "Closed <date>". Saved is not filtered.
   - Lists appear in about a second, and one-line summaries fill in a few seconds later.
   - Open a recall: the FDA record shows immediately, then the full summary. Find refund, Share and Save are available.
4. **Saved recalls.** Star a recall: it is stored on this device (`rg-saved-recalls-v1`). Profile → Saved on this device shows the count and can clear them.
5. **Profile.** Saved on this device (saved recalls, scanned products, and clearing each), Recall alerts (on/off, last checked, Check now), and Data & sources with openFDA's real last-updated date.
6. **Scan a product.** Scan or type a barcode on `/scan`; the result opens at `/scan/barcode/:scanId` and the product joins **Products**. Scans are stored on this device (`rg-scans-v1`, one per barcode, newest 50); Profile → Saved on this device can clear them. Try a UPC from a live recall's text for a confirmed match.
7. **Alerts.** A scan with a match creates an alert right away. When the app opens or comes back to the foreground (at most every 5 minutes), saved products are re-checked against recalls reported since the last check (at most 90 days back; the backend caches recalls per calendar month), and new matches raise a toast with "View". `/alerts` lists them (dismiss when handled); the bell, Home banner, Products badges and the recall page's "Your items" tab use them too. Profile → Recall alerts has the on/off preference (on by default) and "Check now". Stored on this device: `rg-alerts-v1`, `rg-watch-check-v1`, `rg-device-prefs-v1`.
8. **Coming soon.** `/receipts` shows a "Coming soon" screen and is hidden from navigation.
9. **Sign-up placeholder (accounts off).** Profile shows a guest card with Sign up / Log in. `/signup`, `/login` and `/forgot-password` show the real forms under a "Coming soon" notice. Validation works, but submitting (or Google) only shows a toast: nothing is created or stored. To try real accounts locally, see "Accounts (Firebase)". `/privacy` ("What we store") is linked from Profile and sign-up.
10. **Layouts.** Desktop layout (sidebar, multi-column) needs a window at least 1024px wide *and* a mouse or trackpad. Narrower windows and touch devices get the phone/tablet layout.

### 7. Tests and checks

```bash
npm run typecheck && npm run lint && npm test && npm run test:api && npm run build
```

Backend tests are offline: openFDA, Open Food Facts and Gemini are faked, and fixtures are real openFDA records in `api/tests/fixtures`. The barcode and matching tests (`api/tests/test_barcode.py`, `test_matching.py`) encode the printed-UPC forms found in real recalls; add a case there for any form a live recall turns up that doesn't match.

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
| `npm run emulators` / `test:rules`: "Could not spawn `java -version`" | Install a Java JDK 11+ (e.g. `brew install openjdk@21` and follow its PATH note) |
| Accounts don't appear locally | `VITE_ACCOUNTS=true` and `VITE_USE_FIREBASE_EMULATORS=true` in `.env.development.local`, the emulators running, and the dev server restarted |
| Scan says "That doesn't look like a valid barcode" | The check digit or length is wrong (8, 12, 13 or 14 digits). Retype it; the scanner sometimes misreads |
| Scan shows "Unknown product" / "No recall lists this barcode" | Open Food Facts doesn't know the product, or was down (the verdict says which); only the barcode was checked. Search Recalls by brand or name |
| Scan or re-check fails with "The FDA recall service isn't responding" | openFDA is down or rate-limited (set `OPENFDA_API_KEY`). By design the app never shows "no recall found" without checking |
| A recall that prints the product's UPC isn't matched | Look at how the UPC is printed in `product_description` / `code_info` and add it as a case in `api/tests/test_barcode.py`; forms live in `_forms` in `api/services/barcode.py` |
| New alerts don't appear | Re-checks run at most every 5 minutes on open/resume, and only if Profile → Recall alerts is on. Use Profile → Check now |
| Start over with scans and alerts | Profile → Clear scan history and alerts (or clear the site's storage) |

## Backend (`api/`)

FastAPI, deployed as a Vercel Python function: `vercel.json` rewrites `/api/(.*)` to `api/index.py`, and dependencies live in the root `requirements.txt`. Settings come from env vars (`api/config.py`; locally `api/.env`, see `api/.env.example`).

- **Live so far:**
  - `/api/recalls/recent|search|summaries|{recallNumber}|{recallNumber}/summary` (`api/routers/recalls.py`). `recent` and `search` take `?days=N` (`within_days` in `api/services/openfda.py`); resolved windows use `termination_date`.
  - `/api/meta/data-source` (`api/routers/meta.py`): openFDA's `meta.last_updated`.
  - `POST /api/scan/barcode` (`api/routers/scan.py`, guest mode, stateless): `BarcodeChecker` in `api/services/barcode_check.py` runs Open Food Facts (`openfoodfacts.py`) and openFDA in parallel, matches locally (`matching.py`; barcode helpers in `barcode.py`, whose validation and normalization match `src/lib/barcode.ts`), and writes a templated verdict. Window: ongoing recalls plus those reported in the last 2 years. Complete results are cached per barcode for 15 minutes in-process (not after an Open Food Facts outage or a failed brand search). Finding a barcode in recall text happens only on the server.
  - `POST /api/watchlist/check` (`api/routers/watchlist.py`, guest mode, stateless): `WatchlistChecker` in `api/services/watchlist.py` fetches recalls reported since the device's last check (minus 14 days of overlap, at most 90 days back, 30 by default), per calendar month in parallel, and matches every product with the same rules as a scan. Months are cached in-process and shared by all devices (past months 6 h, current month 10 min), which also keeps this login-free endpoint off the shared openFDA quota.
  - **Matching rules** (`api/services/matching.py`, `api/services/barcode.py`; documented in `docs/api-contract.md`):
    - `confirmed`: the barcode is printed in the recall. 12–14-digit forms (spaced or dashed, EAN-13/GTIN-14) may appear anywhere in a printed number. Shorter forms (dropped leading zero, no check digit, UPC-E) must be a whole, barcode-like number, and 8-digit ones (UPC-E, EAN-8) also need a label such as "UPC" before them, so lot codes and dates can't match.
    - `possible`: every brand word is in the recall's description or firm and the name words are in the description (all for 1–2 words, half for longer). Needs a brand and a name of its own. Accents are folded and possessives handled for brand searches.
    - Never decided by the AI. `PreparedRecall` (`prepare()`) works out each recall's words and printed numbers once, so matching many products stays fast.

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
- `src/components/ui/` holds the shadcn primitives (`button`, `badge`, `input`, `tabs`, `switch`, `sonner`, `card`, `label`, `separator`, `skeleton`, plus `native-select`). These are restyled to the wireframe look: the `Button` variants are `default`/`secondary`/`destructive`/`ghost`/`link`/`social` (third-party sign-in), and the `Badge` variants are `alert`/`safe`/`warn`/`outline`. Add new ones in shadcn style.
- `src/components/*.tsx` holds the app components:
  - layout: `Screen`/`SectionTitle`/`PageTitle`, `ScreenHeader`, `TopBar`, `BottomNav`, `Sidebar`, `AppShell`, `WithNav`;
  - rows and controls: `RowCard`/`RowMeta`/`RowTrailing`, `ToggleRow`, `MenuRow`, `AlertBanner`;
  - recalls: `RecallCard`, `RecallList`, `RecallBadges`, `Markdown`;
  - scans: `ScanParts`/`ScanRows`/`ScanStatus`;
  - states and misc: `StateViews`, `SearchInput`, `FormField`, `Logo`, `ErrorBoundary`, `PageLoader`.

  Reuse these rather than adding one-off markup.
- `src/lib/native.ts` wraps the Capacitor plugins (haptics, status bar, camera, barcode scanner, share) with web fallbacks. `src/lib/utils.ts` has `cn()`.
- **Data layer.** `src/types/index.ts` has the domain types, which mirror `docs/api-contract.md` and `api/models.py` (keep all three in sync). `src/services/types.ts` defines the service interfaces (`recalls`, `scan`, `history`, `alerts`, `saved`, `auth`, `meta`), and `src/services/index.ts` exports `services`:
  - Every service is the HTTP adapter in `src/services/http/` (`apiFetch` in `src/lib/api.ts`), except the user's own data (`saved`, `history`, `alerts`, `scan.getScan`, and saving a scan). `userStore()` in `src/services/index.ts` routes those to the device for a guest (`src/services/local/`: `saved.ts`, `scans.ts`, `alerts.ts`, composed in `watch.ts`; all localStorage) or to the account when signed in (`src/services/firebase/data.ts`, Firestore). `scan.scanBarcode` calls the API, then saves the result and its alerts (on the device if the account can't be reached).
  - The rules for the user's data (one product per barcode, when an alert is new or upgraded, re-checks in batches of 100, merging a device into an account) are pure functions in `src/services/user-data.ts`, shared by both stores and unit-tested.
  - Implemented today: `httpRecalls`, `httpMeta`, `httpScan.scanBarcode` and `checkWatchlist` (`http/watchlist.ts`). Receipt scans throw `NotImplementedError`; `auth` is `httpAuth` (placeholders) with accounts off and the lazily loaded Firebase service with them on.
  - Their hooks are disabled (`enabled: features.x`) while the matching flag is off, so nothing calls a placeholder.
  - Services throw `ApiError` with contract error codes (`src/services/errors.ts`).
- **Hooks.** Screens use the React Query hooks in `src/hooks/use-*.ts` and never call services directly. Query keys live in `src/hooks/queryKeys.ts`, and `QueryClientProvider` is set up in `main.tsx`.
- **No synthetic data.** Don't add fixtures or fake data to the app. Tests use real openFDA records (`api/tests/fixtures`) or small inline values.
- **Auth (`features.accounts`, off in production).**
  - While the flag is off, `screens/Auth.tsx` is a placeholder: `ComingSoonNotice`, and submit or Google call `showComingSoon()` instead of the auth hooks. Profile shows `GuestCard` (Sign up / Log in).
  - With it on, `useCurrentUser()` (`src/hooks/use-auth.ts`) is the signed-in user, or the guest (uid `GUEST_UID` = `'device'`, `src/services/guest.ts`) when signed out. There are no anonymous Firebase users.
  - Sign-in, sign-up, Google, sign-out and delete-account mutations (`mutationKey: ['auth']`) go through `useAccountSwitch`: it stores the new user, tells the services which user the screens show (`setShownUser`), and resets every `userScopedKeys` query so the previous account's data never shows. `useAuthSync` (mounted in `App`) follows sign-ins and sign-outs from other tabs, and refreshes the data after a background merge.
  - Account actions take the uid the screen shows (`deleteAccount({ uid, password })`, `updatePrefs(prefs, uid)`) and refuse if someone else is signed in by then, so a stale tab can't delete the wrong account.
  - Signing in or up merges the device's guest data into the account (`afterSignIn` in `src/services/firebase/account.ts`), then removes what it merged from the device. Documents the rules refuse (and their product's alerts) stay on the device, are logged, and are retried on the next start.
  - Signed in, if the account can't be reached the data screens show their error state; only a new scan falls back to the device (and merges later).
  - Google sign-in is a popup on the web and is hidden in the iOS app (needs a native plugin). Sign in with Apple isn't built and isn't offered. Sign-up asks "I'm 13 or older".
  - Deleting an account asks for the password (email accounts) or a Google popup, then deletes everything under `users/{uid}` and the login, from the client.
  - Firebase is loaded on demand (`getFirebase()` in `src/lib/firebase.ts`, Firestore Lite); with the flag off it isn't in the build at all.
  - Auth forms use react-hook-form + zod with `FormField`. Service errors show via `form.setError('root')`; Firebase errors become `ApiError`s with readable messages in `src/services/firebase/errors.ts`.
  - The onboarding walkthrough shows on first launch only (`hasOnboarded`/`markOnboarded` in `src/lib/storage.ts`).
- **Alerts (`features.alerts`, live in guest mode).** `useRecheckOnOpen` (mounted in `AppShell`) calls `alerts.recheck()` on open, then again on app resume (Capacitor `App` resume / `visibilitychange`). It's throttled to 5 minutes and only runs when the "re-check on open" preference is on (`useRecheckOnOpenPref` in `src/hooks/use-prefs.ts`: the device's preference with accounts off, otherwise the user's, which for a signed-in user is stored in their profile). New alerts raise a toast with a "View" action to `/alerts`.
  - Guest mode: `src/services/local/watch.ts` composes scan history (`local/scans.ts`) and alerts (`local/alerts.ts`). A barcode scan with a match adds alerts; `recheck()` sends the device's products to `POST /api/watchlist/check` and adds new matches. Products show the most serious status from their scan and active alerts. Removing a product removes its alerts; Profile → "Clear scan history and alerts" clears both.
- **Profile** (`screens/Profile.tsx`):
  - Always: Data & sources (openFDA last updated, link to `/privacy`) and the app version.
  - A guest sees "Saved on this device" (counts and clear); a signed-in user sees "Saved in your account" (counts).
  - With `features.accounts`: the account card, log out, delete account (or "Clear my data" for a guest), and a loading state until the user is known.
  - With `features.alerts`: alert settings (works for guests) and "Check now".
- `src/index.css` defines the design tokens as HSL CSS variables (shadcn names plus `--destructive-soft`, `--success`/`--success-soft`, `--warning`/`--warning-soft`, `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right`). `tailwind.config.ts` maps them to colors and adds the `pt-safe-top`/`pb-safe-bottom` spacing and the `native:`/`web:` variants. Style with Tailwind classes; avoid inline `style` and new global CSS.

## Placeholder behavior to be aware of

- Recalls, the data-source date, barcode scans and alerts are live. Receipt scans show "Coming soon" (`src/lib/features.ts`) and their HTTP adapter throws `NotImplementedError`. Accounts are built but show "Coming soon" while `features.accounts` is off.
- With accounts off, saved recalls, scan history and alerts live in localStorage on each device.
- `features.history` covers Products; the Receipts tab and Home's "Recent Receipts" also need `features.receiptScan`.
- The Google button shows Google's "G" only once the official file is added at `public/brand/google-g.svg` (download it from Google's sign-in branding guidelines; don't redraw it). Until then it's text-only.
- "Find refund" on a recall jumps to its "What to do" section; there is no refund integration. Share uses the native share sheet (or the clipboard on desktop).

Backend status per service: see the backend table in `docs/implementation-plan.md` (recalls, guest-mode barcode scans and guest-mode alerts are live; accounts are built behind the flag; receipts are next).

## Accounts (Firebase)

Built and tested against the Firebase emulators, and **switched off for real users**: `features.accounts` is `VITE_ACCOUNTS === 'true'` plus a complete Firebase config, and Vercel sets neither. Don't set them in Vercel until the steps below are done.

**Files:** `src/lib/firebase.ts` (config, lazy init, emulators), `src/services/firebase/auth.ts` (AuthService), `data.ts` (the account's data in Firestore), `account.ts` (merge and delete), `errors.ts` (Firebase errors → `ApiError`), `src/services/user-data.ts` (shared rules), `src/services/guest.ts` (the guest user, without Firebase), `src/services/events.ts` (account data changed in the background), `src/lib/timeout.ts`, `src/screens/Privacy.tsx` ("What we store": keep it true to the code), `firestore.rules`, `firebase.json` / `.firebaserc` (demo project `demo-recallguard`), `tests/firebase/` (emulator tests, `vitest.firebase.config.ts`).

**Firestore layout** (enforced by `firestore.rules`; each user can read and write only their own tree, and only known fields):
- `users/{uid}`: `uid`, `email`, `displayName?`, `createdAt`, `updatedAt`, `prefs { recheckOnOpen }`, `lastWatchCheckAt?`
- `users/{uid}/scans/{productKey}`: the newest `Scan` of a product (`barcode-<upc>`), plus `previousIds`
- `users/{uid}/alerts/{recallNumber}_{itemId}`: `Alert`
- `users/{uid}/savedRecalls/{recallNumber}`: `SavedRecall`

**Try it locally (Mac):**
1. Install a Java JDK 11+ (the Firestore emulator needs it): `brew install openjdk@21`.
2. `npm run emulators` (first run downloads the emulators). The Emulator UI at http://127.0.0.1:4000 shows users and documents.
3. Create `.env.development.local` (git-ignored) with:
   ```bash
   VITE_ACCOUNTS=true
   VITE_USE_FIREBASE_EMULATORS=true
   ```
   The emulators only connect in development builds (`import.meta.env.DEV`), never in a production build.
4. `npm run dev`, then sign up, scan, save recalls, log out and in, use Google sign-in (the Auth emulator shows a fake Google account picker), delete the account. Check the documents in the Emulator UI.
5. `npm run test:firebase` runs the rules, account and account-data tests (all 44 pass against the Auth and Firestore emulators as of 2026-10-17). It starts its own emulators, so stop `npm run emulators` first.

**Real project:** `recallguard-2724` (display name "recallGuard", alias `prod` in `.firebaserc`), web app "recallGuard" (`1:270044328388:web:246a65d2789abe72fd3491`), Firestore `(default)` in `us-east1`. Done so far: steps 1 (web app; config and `VITE_ACCOUNTS=true` set in Vercel **Preview** only, 2026-10-17), 2 (sign-in providers and the production domain) and 3 (rules and indexes deployed; `npm run test:firebase` passes, 44 tests). The Vercel CLI must be signed in as the `arjunkattaeng` account (team "thundered") to reach the project. Print the web config with `npx --yes firebase-tools@15 apps:sdkconfig WEB --project prod`; redeploy rules with `npx --yes firebase-tools@15 deploy --only firestore --project prod`.

**Set up the real project (before turning accounts on):**
1. Create a Firebase project; add a Web app and copy its config into Vercel env vars `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (these are public identifiers, not secrets; the rules protect the data).
2. Authentication → Sign-in method: enable Email/Password and Google. Authentication → Settings → Authorized domains: add `contami-noted.vercel.app` (localhost is there already).
3. Create a Firestore database (production mode), then deploy the rules: `npx --yes firebase-tools@15 deploy --only firestore:rules --project <project-id>` (after `npx --yes firebase-tools@15 login`).
4. Optional: a custom `authDomain`, so the Google window doesn't say "<project>.firebaseapp.com".
5. Set `VITE_ACCOUNTS=true` in Vercel (Preview first), redeploy, and run the walkthrough above against the real project.

## Deployment

- **Production:** https://contami-noted.vercel.app (Vercel account "thundered"). It deploys from GitHub `ArjunKattaEng/ContamiNoted`, branch `main`, on every push.
- **Vercel env vars:** `GEMINI_API_KEY` (Secret) and `OPENFDA_API_KEY` (Secret; needed now that scans and re-checks call openFDA), optionally `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`. `VITE_LIVE_SERVICES` is no longer used and can be deleted.
- **Pushing:** only the `ArjunKattaEng` GitHub account can push. Run `gh auth switch --user ArjunKattaEng`, then `git push`, then switch back.
- **Checks after a deploy:**
  - `/api/health` → `"summaries": true`
  - `/api/recalls/recent` → live recalls
  - `/api/meta/data-source` → openFDA last-updated date
  - `POST /api/scan/barcode` with a known product → a `Scan`, and a scan of a recalled product's UPC → `confirmed`

## Next steps

Roughly in priority order. When you finish one, update the status tables in `docs/implementation-plan.md` and the endpoint notes in `docs/api-contract.md`.

### Before the competition deadline (October 26)

1. **Set `OPENFDA_API_KEY` in Vercel** (open.fda.gov/apis/authentication) and redeploy. Every scan and re-check calls openFDA, and the keyless limit (~1,000/day) is shared by all of Vercel's IPs. Confirm the CDN caches recall lists (`x-vercel-cache: HIT` on repeat requests).
2. **Check the barcode search against live data.** It was built and tested offline only. On the deployed app:
   - Scan or type the UPCs of 3–4 active recalls that print one (search Recalls for "UPC"), in different printed forms if possible (spaced, dashed, without the leading zero). Each should be `confirmed`.
   - Scan a few ordinary groceries: expect the product name from Open Food Facts and "No FDA recall found".
   - If a printed form is missed, add it as a test case in `api/tests/test_barcode.py`, then fix `_forms` / `upc_search_terms` in `api/services/barcode.py`.
3. **Pick the demo products** (a confirmed match, a possible match, a clear one) and rehearse the video: scan → result → Products → Alerts → recall details.
4. **Commit and push** (only the `ArjunKattaEng` account can push; see "Deployment"), then run the post-deploy checks.
5. **Remove the unused `VITE_LIVE_SERVICES`** variable from Vercel and from the local `.env.local`.

### Known limitations (say so in the written responses)

- USDA-regulated meat, poultry and egg products aren't covered: their recalls come from the USDA FSIS recall API, not openFDA. The scan verdict says so.
- Re-checks look back at most 90 days, so a device that doesn't open the app for longer misses recalls in between (a new scan still checks the full 2 years).
- Data stays on one device and browser until accounts exist.
- An EAN-8 code listed after another code ("UPC codes 012345678905, 37484774") isn't matched, because 8-digit codes need their own label. Rare in US stores.
- Rescanning a product that now comes back clear keeps its earlier, still-active alert (and status) until the alert is dismissed.

### After the competition: backend integration (see the backend table in `docs/implementation-plan.md`)

6. **USDA FSIS recalls:** add the FSIS recall API as a second source for scans and re-checks.
7. **Abuse controls for the login-free endpoints** (`/api/scan/barcode`, `/api/watchlist/check`): per-IP rate limiting (Vercel firewall rules), then per-user daily quotas once accounts exist (Firestore counters, 429 `quota_exceeded`). A daily Vercel Cron (`/api/cron/warm-summaries`, protected by `CRON_SECRET`) could pre-generate summaries for the newest recalls.
8. **Receipt scans.** `POST /api/scan/receipt`:
   - Read the receipt with a Google Document AI Expense Parser processor (GCP project, `DOCAI_PROJECT_ID`/`DOCAI_LOCATION`/`DOCAI_PROCESSOR_ID`, service-account credentials). A lighter option: one Gemini multimodal call that returns the food items as JSON.
   - One Gemini call normalizes abbreviated item names and drops non-food lines.
   - Batch the openFDA queries (window: purchase date − 12 months to now), then match per item with `classify()`.
   - Also `PATCH /api/scans/{scanId}/items/{itemId}` for naming unreadable lines. Then set `features.receiptScan = true` (it also shows the Receipts tab and Home's "Recent Receipts").
9. **Accounts: finish and turn on.** Built behind `features.accounts` (see "Accounts (Firebase)").
   - Walk through accounts locally on the emulators (sign up with device data, Google, log out and in, two tabs, delete).
   - Before showing accounts to anyone: add a contact address to `/privacy` (`src/screens/Privacy.tsx`, with its "Last updated" date), add Google's official "G" at `public/brand/google-g.svg`, and decide how to handle under-13 users (sign-up asks "I'm 13 or older"; Google sign-in from the Log in page skips that question).
   - Set up the real Firebase project and deploy `firestore.rules`, then turn the flag on in Vercel Preview, then production.
   - Later: Sign in with Apple and Google in the iOS app (`@capacitor-firebase/authentication`), per-user quotas on the backend (verify the Firebase ID token in FastAPI), the summary cache in Firestore (`recallSummaries/{recallNumber}`), and a lighter Products list for large accounts (it reads up to 200 full scan documents; a compact product document per scan would cut that).

### Frontend

10. With barcode scans and alerts now live, re-check their screens against real data (loading, error and empty states were built against the removed mock layer).
11. The sidebar highlights nothing on scan result pages (`/scan/receipt|barcode/:scanId`). Highlight Receipts or Products.
12. Add Google's official "G" asset (`public/brand/google-g.svg`); add a Sign in with Apple button following Apple's guidelines once Apple sign-in is built (both needed for App Store review).

### iOS release

13. Native builds need `VITE_API_BASE_URL=https://contami-noted.vercel.app` (then `npm run ios:sync`); CORS already allows `capacitor://localhost`.
14. Test on a simulator or device beyond the splash screen (`npm run ios:run`, Xcode 27): live recalls and summaries, saving, safe areas in landscape, the native barcode scanner, and alerts on resume. Later, receipt upload.
15. App Store prep: app icon and splash, the Sign in with Apple capability, privacy manifest and App Privacy labels (camera, account data), in-app account deletion (already in Profile), then TestFlight.
