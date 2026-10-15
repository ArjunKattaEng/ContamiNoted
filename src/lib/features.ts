/**
 * Features whose backend isn't built yet. Their screens stay in the codebase but show "Coming soon"
 * and are hidden from navigation. Flip a flag to true once its endpoints are live (see "Next steps"
 * in CLAUDE.md and the backend table in docs/implementation-plan.md).
 */
export const features = {
  /** Barcode scan: POST /api/scan/barcode (Open Food Facts + openFDA) */
  barcodeScan: false,
  /** Receipt scan: POST /api/scan/receipt (Document AI) */
  receiptScan: false,
  /** Receipt and product history: Firestore */
  history: false,
  /** Recall alerts for scanned items and the re-check on open: POST /api/watchlist/check */
  alerts: false,
  /** Sign-in and accounts: Firebase Auth */
  accounts: false,
} as const

/** Any kind of scanning is available. */
export const canScan = features.barcodeScan || features.receiptScan
