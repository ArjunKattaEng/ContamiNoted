# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RecallGuard is a clickable front-end skeleton built from wireframes for an app that matches a user's purchases (scanned receipts and product barcodes) against FDA recalls. It runs on mock data only: there is no backend, auth, camera or API integration yet.

Stack: React 18, react-router-dom v6, Vite 5, plain JSX (no TypeScript). Styling is one hand-written stylesheet (no CSS framework).

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the built dist/
```

There is no test runner, linter or formatter configured. `npm run build` is the only automated check. The UI is designed for a phone-sized viewport.

## Architecture

- `src/main.jsx` mounts `<App>` inside `BrowserRouter`. `src/App.jsx` is the only place routes are defined.
- Routes come in two groups. Tab screens (`/home`, `/receipts`, `/products`, `/profile`) are nested under the `WithNav` layout route, which renders an `<Outlet>` plus the `BottomNav`. Every other route (onboarding, auth, `/scan/*`, `/recalls/*`, `/profile/*` sub-pages) is full-screen with no tab bar and typically renders `ScreenHeader` (back button calls `navigate(-1)`). Unknown paths redirect to `/`.
- `src/screens/*.jsx` group related screens per file and use named exports (except `Home.jsx`, which has a default export). The README has the full wireframe → route → file table.
- `src/components/ui.jsx` holds all shared UI primitives (`Button`, `Badge`, `Toggle`, `ScreenHeader`, `TopBar`, `AlertBanner`, `Placeholder`, `BottomNav`, `WithNav`). Reuse these rather than adding one-off markup.
- `src/data/mock.js` is the single data source (`recalls`, `receipts`, `scannedItems`, `stores`, `walkthrough`). Screens import from it directly; there is no global state, context or data layer. All state is local `useState` and resets on navigation (e.g. starring a recall in `ActiveRecalls` does not persist).
- `src/styles.css` defines design tokens as CSS variables on `:root` (`--ink`, `--muted`, `--danger`, `--ok`, `--warn-bg`, etc.) and class-based styles (`.phone` frame, `.card`, `.tabs`, `.badge-*`, `.btn-*`). Components pick variants by class name, e.g. `Badge kind="alert"` → `.badge-alert`, `Button variant="secondary"` → `.btn-secondary`. Some screens also use inline `style` objects.

## Placeholder behavior to be aware of

- The Login/SignUp submit handlers in `screens/Auth.jsx` are marked `TODO` and just navigate.
- `screens/Scan.jsx` has no camera: the shutter button routes to a mock result screen depending on the Receipt/Product toggle.
- "Find Refund" and "Share Alert" buttons call `alert()` as stubs.
- `RecallDetail` falls back to the first mock recall when the `:id` is not found.

Planned integrations (from the README): replace `mock.js` with the openFDA enforcement API and a backend; use `navigator.mediaDevices.getUserMedia` with a barcode library (e.g. `@zxing/browser`) and OCR in `Scan.jsx`.
