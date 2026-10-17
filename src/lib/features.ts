import { firebaseConfig } from './firebase'

/**
 * Features whose backend isn't built yet. Their screens stay in the codebase but show "Coming soon"
 * and are hidden from navigation. Flip a flag to true once its endpoints are live (see "Next steps"
 * in CLAUDE.md and the backend table in docs/implementation-plan.md).
 */
export const features = {
  /** Barcode scan: POST /api/scan/barcode (Open Food Facts + openFDA). Live in guest mode. */
  barcodeScan: true,
  /** Receipt scan: POST /api/scan/receipt (Document AI) */
  receiptScan: false,
  /**
   * Scan history (Products, and Receipts once receipt scans exist). Kept on this device in guest mode
   * (src/services/local/scans.ts); moves to Firestore with accounts.
   */
  history: true,
  /**
   * Recall alerts for scanned items and the re-check on open: POST /api/watchlist/check. Live in guest mode
   * (alerts kept on this device, src/services/local/alerts.ts).
   */
  alerts: true,
  /**
   * Sign-up, log-in and data in Firestore (src/services/firebase/). Off for real users until the Firebase
   * project is set up: on only with VITE_ACCOUNTS=true and a Firebase config (or the local emulators).
   */
  accounts: import.meta.env.VITE_ACCOUNTS === 'true' && firebaseConfig() !== null,
} as const

/** Any kind of scanning is available. */
export const canScan = features.barcodeScan || features.receiptScan
