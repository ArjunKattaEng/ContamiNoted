# RecallGuard (React skeleton)

Clickable front-end skeleton built from the RecallGuard wireframes. Mock data only — no backend yet.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (best viewed in a phone-sized window).

## Screens → files

| Wireframe | Route | File |
|---|---|---|
| 1.1 Splash | `/` | `screens/Onboarding.jsx` |
| 1.2–1.4 Walkthrough | `/walkthrough/:step` | `screens/Onboarding.jsx` |
| 2.1 Login / Sign Up | `/login`, `/signup` | `screens/Auth.jsx` |
| Home (alerts, quick actions, recent receipts) | `/home` | `screens/Home.jsx` |
| Camera scan | `/scan` | `screens/Scan.jsx` |
| Scan (Receipt) Result | `/scan/receipt-result` | `screens/Scan.jsx` |
| Scan (Barcode) Result | `/scan/barcode-result` | `screens/Scan.jsx` |
| Receipt History | `/receipts` | `screens/History.jsx` |
| Scanned Products List | `/products` | `screens/History.jsx` |
| Active Recalls (Active / Resolved) | `/recalls` | `screens/Recalls.jsx` |
| Recall details (Recall Info / Batch Match) | `/recalls/:id` | `screens/Recalls.jsx` |
| 7.0 Profile, Integrated POS | `/profile`, `/profile/pos` | `screens/Settings.jsx` |
| 7.2 FDA Sync Status | `/profile/fda-sync` | `screens/Settings.jsx` |
| 7.3 Notifications | `/profile/notifications` | `screens/Settings.jsx` |

## Next steps (TODOs)

- Replace `src/data/mock.js` with real calls (FDA openFDA enforcement API, your backend).
- Auth: wire `Login` / `SignUp` submit handlers (marked `TODO`).
- Camera: use `navigator.mediaDevices.getUserMedia` plus a barcode lib (e.g. `@zxing/browser`) and OCR for receipts in `screens/Scan.jsx`.
- Shared UI lives in `src/components/ui.jsx`; styles in `src/styles.css`.
