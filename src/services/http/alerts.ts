import type { AlertsService } from '../types'
import { notImplemented } from './notImplemented'

// TODO(backend): Firestore for list/dismiss, HTTP for recheck. Shapes: docs/api-contract.md.
export const httpAlerts: AlertsService = {
  /** users/{uid}/alerts order by createdAt desc */
  list: () => notImplemented('Firestore users/{uid}/alerts'),
  /** update users/{uid}/alerts/{id} { dismissed: true } */
  dismiss: () => notImplemented('Firestore update users/{uid}/alerts/{id}'),
  /** POST /api/watchlist/check → { checkedAt, skipped, newAlerts } */
  recheck: () => notImplemented('POST /api/watchlist/check'),
  lastCheck: () => notImplemented('last check'),
}
