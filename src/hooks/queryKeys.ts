import type { RecallTab, ScanType } from '@/types'

/** Every React Query key in one place, so mutations can invalidate precisely. */
export const queryKeys = {
  user: ['auth', 'user'] as const,
  recalls: {
    all: ['recalls'] as const,
    list: (status: RecallTab) => ['recalls', 'list', status] as const,
    search: (q: string) => ['recalls', 'search', q] as const,
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
}

/** Queries whose data belongs to the signed-in user; reset whenever the account changes. */
export const userScopedKeys = [queryKeys.scans.all, queryKeys.products, queryKeys.alerts, queryKeys.saved, queryKeys.dataSource]
