import { apiFetch } from '@/lib/api'
import type { Scan } from '@/types'
import type { ScanService } from '../types'
import { notImplemented } from './notImplemented'

// Shapes: docs/api-contract.md. Guest mode: the backend doesn't store scans, so src/services/index.ts saves
// barcode results on the device and reads them back from there (getScan).
export const httpScan: ScanService = {
  /** POST /api/scan/barcode { code } → Scan */
  scanBarcode: (code) => apiFetch<Scan>('/api/scan/barcode', { method: 'POST', body: JSON.stringify({ code }) }),
  /** POST /api/scan/receipt multipart { image, purchaseDate? } → Scan (client resizes to ≤1600 px first) */
  scanReceipt: () => notImplemented('POST /api/scan/receipt'),
  /** GET /api/scans/{scanId} → Scan (needs accounts; guests read scans from the device) */
  getScan: () => notImplemented('GET /api/scans/{scanId}'),
  /** PATCH /api/scans/{scanId}/items/{itemId} { name } → Scan */
  updateItem: () => notImplemented('PATCH /api/scans/{scanId}/items/{itemId}'),
}
