import type { RecallTab, ScanType } from '@/types'

/** Every React Query key in one place, so mutations can invalidate precisely. */
export const queryKeys = {
  user: ['auth', 'user'] as const,
  recalls: {
    all: ['recalls'] as const,
    list: (status: RecallTab, days: number | null) => ['recalls', 'list', status, days ?? 'all'] as const,
    search: (q: string, days: number | null) => ['recalls', 'search', q, days ?? 'all'] as const,
    detail: (recallNumber: string) => ['recalls', 'detail', recallNumber] as const,
    summaries: (recallNumbers: string[]) => ['recalls', 'summaries', recallNumbers.join(',')] as const,
    summary: (recallNumber: string) => ['recalls', 'summary', recallNumber] as const,
  },
  scans: {
    all: ['scans'] as const,
    list: (type: ScanType) => ['scans', 'list', type] as const,
    detail: (id: string) => ['scans', 'detail', id] as const,
  },
  products: ['products'] as const,
  alerts: ['alerts'] as const,
  saved: ['saved'] as const,
  dataSource: ['meta', 'dataSource'] as const,
  devicePrefs: ['prefs', 'device'] as const,
  lastWatchCheck: ['watch', 'lastCheck'] as const,
}

/** Queries whose data belongs to the signed-in user; reset whenever the account changes. */
export const userScopedKeys = [
  queryKeys.scans.all,
  queryKeys.products,
  queryKeys.alerts,
  queryKeys.saved,
  queryKeys.dataSource,
  queryKeys.devicePrefs,
  queryKeys.lastWatchCheck,
]
