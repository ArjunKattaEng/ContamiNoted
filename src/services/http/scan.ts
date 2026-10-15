import type { ScanService } from '../types'
import { notImplemented } from './notImplemented'

// TODO(backend): implement with apiFetch from '@/lib/api'. Shapes: docs/api-contract.md.
export const httpScan: ScanService = {
  /** POST /api/scan/barcode { code } → Scan */
  scanBarcode: () => notImplemented('POST /api/scan/barcode'),
  /** POST /api/scan/receipt multipart { image, purchaseDate? } → Scan (client resizes to ≤1600 px first) */
  scanReceipt: () => notImplemented('POST /api/scan/receipt'),
  /** GET /api/scans/{scanId} → Scan (or read Firestore users/{uid}/scans/{scanId} directly) */
  getScan: () => notImplemented('GET /api/scans/{scanId}'),
  /** PATCH /api/scans/{scanId}/items/{itemId} { name } → Scan */
  updateItem: () => notImplemented('PATCH /api/scans/{scanId}/items/{itemId}'),
}
