import { apiFetch } from '@/lib/api'
import type { Page, Recall, RecallSummary } from '@/types'
import type { RecallsService } from '../types'

const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))).toString()

/** api/routers/recalls.py: live openFDA data with OpenAI summaries. Public, CDN-cached reads (no auth header needed). */
export const httpRecalls: RecallsService = {
  listRecent: ({ status, days, page = 1, pageSize = 20 }) =>
    apiFetch<Page<Recall>>(`/api/recalls/recent?${query({ status, days, page, pageSize })}`),
  search: (q, { days, page = 1, pageSize = 20 } = {}) =>
    apiFetch<Page<Recall>>(`/api/recalls/search?${query({ q, days, page, pageSize })}`),
  get: (recallNumber) => apiFetch<Recall>(`/api/recalls/${encodeURIComponent(recallNumber)}`),
  summaries: async (recallNumbers) =>
    (
      await apiFetch<{ summaries: Record<string, RecallSummary> }>(
        `/api/recalls/summaries?${query({ numbers: recallNumbers.join(',') })}`,
      )
    ).summaries,
  summary: (recallNumber) => apiFetch<RecallSummary | null>(`/api/recalls/${encodeURIComponent(recallNumber)}/summary`),
}
