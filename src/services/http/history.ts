import type { HistoryService } from '../types'
import { notImplemented } from './notImplemented'

// TODO(backend): Firestore client SDK reads. See "Firestore-backed operations" in docs/api-contract.md.
export const httpHistory: HistoryService = {
  /** users/{uid}/scans where type == ? order by createdAt desc */
  listScans: () => notImplemented('Firestore users/{uid}/scans'),
  /** users/{uid}/items order by createdAt desc */
  listProducts: () => notImplemented('Firestore users/{uid}/items'),
  /** delete users/{uid}/items/{id} */
  deleteProduct: () => notImplemented('Firestore delete users/{uid}/items/{id}'),
}
