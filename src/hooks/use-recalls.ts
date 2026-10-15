import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { services } from '@/services'
import type { RecallSummary, RecallTab } from '@/types'
import { queryKeys } from './queryKeys'

/** Recent recalls for a tab, paged ("load more"). `days` = time window, null = all time. */
export function useRecentRecalls(status: RecallTab, days: number | null = null) {
  return useInfiniteQuery({
    queryKey: queryKeys.recalls.list(status, days),
    queryFn: ({ pageParam }) => services.recalls.listRecent({ status, days: days ?? undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}

/** Recall search; idle until the query has 2+ characters. Keeps the previous results while typing. */
export function useRecallSearch(q: string, days: number | null = null) {
  const query = q.trim()
  return useQuery({
    queryKey: queryKeys.recalls.search(query, days),
    queryFn: () => services.recalls.search(query, { days: days ?? undefined }),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  })
}

export function useRecall(recallNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recalls.detail(recallNumber ?? ''),
    queryFn: () => services.recalls.get(recallNumber!),
    enabled: !!recallNumber,
  })
}

const SUMMARY_BATCH = 20 // one list page; the API takes up to 25

/**
 * Short summaries for recalls shown without one (live lists return FDA data first). Fetched in
 * batches of one page, so "Load more" only asks for the new page. `loading` holds numbers still pending.
 */
export function useRecallSummaries(recallNumbers: string[]) {
  const batches: string[][] = []
  for (let i = 0; i < recallNumbers.length; i += SUMMARY_BATCH) batches.push(recallNumbers.slice(i, i + SUMMARY_BATCH))
  return useQueries({
    queries: batches.map((batch) => ({
      queryKey: queryKeys.recalls.summaries(batch),
      queryFn: () => services.recalls.summaries(batch),
      staleTime: 60 * 60_000,
    })),
    combine: (results) => {
      const summaries: Record<string, RecallSummary> = {}
      const loading = new Set<string>()
      results.forEach((result, i) => {
        Object.assign(summaries, result.data)
        if (result.isPending) batches[i].forEach((n) => loading.add(n))
      })
      return { summaries, loading }
    },
  })
}

/** Full sectioned summary for a recall detail page (only when the recall didn't come with one). */
export function useRecallSummary(recallNumber: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.recalls.summary(recallNumber ?? ''),
    queryFn: () => services.recalls.summary(recallNumber!),
    enabled: enabled && !!recallNumber,
    staleTime: 60 * 60_000,
  })
}
