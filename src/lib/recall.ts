import type { RecallRef } from '@/types'

/** Compact recall snapshot stored with alerts and saved recalls (strips any extra fields). */
export function toRecallRef(recall: RecallRef): RecallRef {
  const { recallNumber, productDescription, classification, status, reportDate, terminationDate } = recall
  return {
    recallNumber,
    productDescription,
    classification,
    status,
    reportDate,
    ...(terminationDate && { terminationDate }),
  }
}

/** Route of a recall's detail page. */
export const recallPath = (recallNumber: string) => `/recalls/${encodeURIComponent(recallNumber)}`

/** Time windows for recall lists. `null` = all time. */
export const RECALL_WINDOWS: { days: number | null; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
  { days: null, label: 'All time' },
]
export const DEFAULT_RECALL_WINDOW = 30

/** URL `?days=` → window: a listed number, `all` → null (all time), anything else → the 30-day default. */
export function parseRecallWindow(param: string | null): number | null {
  if (param === 'all') return null
  const days = Number(param)
  return RECALL_WINDOWS.some((w) => w.days === days) ? days : DEFAULT_RECALL_WINDOW
}

/** "last 30 days" / "all time", for sentences. */
export function recallWindowLabel(days: number | null): string {
  return (RECALL_WINDOWS.find((w) => w.days === days)?.label ?? 'All time').toLowerCase()
}
