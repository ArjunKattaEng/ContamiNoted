# RecallGuard

Checks your groceries against FDA food recalls, on the web (phone, tablet and desktop) and as an iOS app (Capacitor).

- **Live:** recalls from openFDA, with plain-language Gemini summaries.
- **Coming soon:** barcode and receipt scanning, purchase history, alerts and accounts. Their screens are built and switched on in `src/lib/features.ts` as each backend lands.

Production: https://contami-noted.vercel.app

## Run

```bash
npm install
npm run setup:api          # once: Python venv (.venv) with the backend dependencies
cp api/.env.example api/.env   # add GEMINI_API_KEY for recall summaries (optional; root .env.local also works)
npm run dev                # Vite (:5173) + FastAPI (:8000) together; Vite proxies /api
```

Open the URL Vite prints. The layout adapts to phones, tablets and desktop (sidebar layout on wide screens with a mouse or trackpad).

Recalls come live from openFDA (with Gemini summaries) through the FastAPI backend in `api/`. The app uses real data only; there is no demo mode. Full setup and troubleshooting: `CLAUDE.md`. API: `docs/api-contract.md`.

```bash
npm run typecheck && npm run lint && npm test && npm run test:api && npm run build   # all must pass
npm run ios:run                                                  # build, sync and run on an iOS simulator/device
```

## Deploy (Vercel)

`vercel.json` sends `/api/*` to the Python function `api/index.py` (FastAPI, dependencies from `requirements.txt`) and every other path to `index.html`. Set these Vercel project environment variables:

- `GEMINI_API_KEY` (Secret), plus optionally `OPENFDA_API_KEY` (Secret), `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`

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
| 7.0 Profile (saved on this device, data & sources; account and alerts once live) | `/profile` | `screens/Profile.tsx` |

The Integrated POS (7.1), FDA Sync Status (7.2) and Notifications (7.3) wireframes were replaced by sections of the Profile screen.

## Next steps (TODOs)

- See "Next steps" in `CLAUDE.md`: live barcode scans, receipts (Document AI), then Firebase accounts, history and alerts.
- Camera and barcode scanning go through `src/lib/native.ts` (Capacitor).
- shadcn primitives are in `src/components/ui/` and app components in `src/components/`. Styling is Tailwind, with tokens in `src/index.css`.
