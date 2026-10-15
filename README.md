# RecallGuard (React + TypeScript skeleton)

Clickable front-end skeleton built from the RecallGuard wireframes. Mock data only — no backend yet.

## Run

```bash
npm install
npm run setup:api          # once: Python venv (.venv) with the backend dependencies
cp api/.env.example api/.env   # add GEMINI_API_KEY for recall summaries (optional; root .env.local also works)
cp .env.example .env.local     # VITE_LIVE_SERVICES=recalls uses the real backend for recalls
npm run dev                # Vite (:5173) + FastAPI (:8000) together; Vite proxies /api
```

Open the URL Vite prints. The layout adapts to phones, tablets and desktop (sidebar layout on wide screens with a mouse or trackpad).

Recalls can come live from openFDA (with Gemini summaries) through the FastAPI backend in `api/`. Scans, history and accounts still run on synthetic demo data. Switch services between the two with `VITE_LIVE_SERVICES` (see `.env.example`). See `docs/implementation-plan.md` and `docs/api-contract.md`.

```bash
npm run typecheck && npm run lint && npm test && npm run test:api && npm run build   # all must pass
npm run ios:run                                                  # build, sync and run on an iOS simulator/device
```

## Demo tips

- Any email and password log in as a "returning user" with sample history. The password `wrong` shows the error state. Sign up keeps your guest history.
- On the scan screen, **Samples** gives one-tap scans for each outcome (recalled, possible match, no recall, unknown product, invalid code, sample receipt).
- Logging in as a new user surfaces a "new recall" alert for a product in the seeded history (the re-check on open).
- **Profile → Developer** sets network speed, forces errors or empty lists, picks the next sample receipt, and resets all demo data.

## Deploy (Vercel)

`vercel.json` sends `/api/*` to the Python function `api/index.py` (FastAPI, dependencies from `requirements.txt`) and every other path to `index.html`. Set these Vercel project environment variables:

- `VITE_LIVE_SERVICES=recalls` (build time)
- `GEMINI_API_KEY`, plus optionally `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` and `OPENFDA_API_KEY`

```bash
vercel login
vercel deploy          # preview URL
vercel deploy --prod   # production
```

## Screens → files

| Wireframe | Route | File |
|---|---|---|
| 1.1 Splash | `/` | `screens/Onboarding.tsx` |
| 1.2–1.4 Walkthrough | `/walkthrough/:step` | `screens/Onboarding.tsx` |
| 2.1 Login / Sign Up / Reset password | `/login`, `/signup`, `/forgot-password` | `screens/Auth.tsx` |
| Home (alert banner, quick actions, latest recalls, recent receipts) | `/home` | `screens/Home.tsx` |
| Alerts (recall matches for your items) | `/alerts` | `screens/Alerts.tsx` |
| Camera scan | `/scan` | `screens/Scan.tsx` |
| Scan (Receipt) Result | `/scan/receipt/:scanId` | `screens/ScanResults.tsx` |
| Scan (Barcode) Result | `/scan/barcode/:scanId` | `screens/ScanResults.tsx` |
| Receipts (history) | `/receipts` | `screens/History.tsx` |
| Products (watchlist) | `/products` | `screens/History.tsx` |
| Recalls (Active / Resolved / Saved + search) | `/recalls` | `screens/Recalls.tsx` |
| Recall details (Summary / FDA details / Your items) | `/recalls/:recallNumber` | `screens/Recalls.tsx` |
| 7.0 Profile (account, recall alerts, data & sources, developer) | `/profile` | `screens/Profile.tsx` |

The Integrated POS (7.1), FDA Sync Status (7.2) and Notifications (7.3) wireframes were replaced by sections of the Profile screen.

## Next steps (TODOs)

- The app runs on synthetic data behind a typed service layer (`VITE_DATA_SOURCE=mock`). Next: Phase 6 polish and deploy (`docs/implementation-plan.md`), then implementing the backend in `docs/api-contract.md`.
- Demo tips: any email logs in with sample history (the password "wrong" fails); Profile → Developer controls latency, forced errors and empty states, and the receipt scenario.
- Camera and barcode scanning go through `src/lib/native.ts` (Capacitor).
- shadcn primitives are in `src/components/ui/` and app components in `src/components/`. Styling is Tailwind, with tokens in `src/index.css`.
