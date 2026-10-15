import type { Recall } from '@/types'
import { lateRecallNumbers, recallFixtures, toListRecall } from '@/mocks/data/recalls'
import { getDb } from '@/mocks/db'
import { maybeEmpty, simulate } from '@/mocks/simulate'
import { ApiError } from '../errors'
import type { RecallsService } from '../types'
import { paginate } from './util'

/** Fixture recalls, minus the "late" one until a re-check has revealed it. */
export function visibleRecalls(): Recall[] {
  return getDb().lateRevealed ? recallFixtures : recallFixtures.filter((r) => !lateRecallNumbers.has(r.recallNumber))
}

export const mockRecalls: RecallsService = {
  listRecent: ({ status, ...pageParams }) =>
    simulate('read', () => {
      const rows = visibleRecalls().filter((r) => (status === 'active' ? r.status === 'Ongoing' : r.status !== 'Ongoing'))
      return paginate(maybeEmpty(rows).map(toListRecall), pageParams)
    }),

  search: (q, pageParams) =>
    simulate('read', () => {
      const query = q.trim().toLowerCase()
      if (query.length < 2 || query.length > 100) {
        throw new ApiError('invalid_request', 'Search for 2 to 100 characters.', 400)
      }
      const terms = query.split(/\s+/)
      const rows = visibleRecalls().filter((r) => {
        const haystack = `${r.productDescription} ${r.recallingFirm} ${r.reasonForRecall}`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
      return paginate(maybeEmpty(rows).map(toListRecall), pageParams)
    }),

  get: (recallNumber) =>
    simulate('read', () => {
      const recall = visibleRecalls().find((r) => r.recallNumber === recallNumber)
      if (!recall) throw new ApiError('not_found', 'We couldn’t find that recall.', 404)
      return recall
    }),

  summaries: (recallNumbers) =>
    simulate('read', () => {
      const wanted = new Set(recallNumbers)
      return Object.fromEntries(
        visibleRecalls()
          .filter((r) => wanted.has(r.recallNumber) && r.summary)
          .map((r) => [r.recallNumber, toListRecall(r).summary!]),
      )
    }),

  summary: (recallNumber) =>
    simulate('read', () => {
      const recall = visibleRecalls().find((r) => r.recallNumber === recallNumber)
      if (!recall) throw new ApiError('not_found', 'We couldn’t find that recall.', 404)
      return recall.summary
    }),
}
