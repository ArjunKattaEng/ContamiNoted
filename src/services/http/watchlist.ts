import { apiFetch } from '@/lib/api'
import type { WatchCheckRequest, WatchCheckResult } from '@/types'

/**
 * POST /api/watchlist/check (guest mode): the backend matches these products against recalls reported
 * since `since` (YYYY-MM-DD, minus an overlap) and keeps nothing. src/services/local/watch.ts turns the
 * matches into alerts on the device.
 */
export function checkWatchlist(body: WatchCheckRequest): Promise<WatchCheckResult> {
  return apiFetch<WatchCheckResult>('/api/watchlist/check', { method: 'POST', body: JSON.stringify(body) })
}
