import type { Alert } from '@/types'
import { upcAppearsIn } from '@/lib/barcode'
import { lateRecallNumbers, recallFixtures } from '@/mocks/data/recalls'
import { currentUserData, updateDb } from '@/mocks/db'
import { toRecallRef } from '@/lib/recall'
import { maybeEmpty, simulate } from '@/mocks/simulate'
import type { AlertsService } from '../types'
import { nowIso } from './util'

const lateRecalls = () => recallFixtures.filter((r) => lateRecallNumbers.has(r.recallNumber))

export const mockAlerts: AlertsService = {
  list: () => simulate('read', () => maybeEmpty(currentUserData().alerts)),

  dismiss: (id) =>
    simulate('write', () => {
      const user = currentUserData()
      updateDb(() => {
        user.alerts = user.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
      })
    }),

  /**
   * Demo of "a recall announced after you bought something": the late fixture recall is
   * revealed the first time a user with a matching saved item re-checks, and alerts them.
   */
  recheck: () =>
    simulate('read', () => {
      const user = currentUserData()
      const checkedAt = nowIso()
      const newAlerts: Alert[] = []
      updateDb((db) => {
        for (const recall of lateRecalls()) {
          const matches = user.items.filter((i) => i.upc && upcAppearsIn(recall.codeInfo ?? '', i.upc))
          if (matches.length === 0) continue
          db.lateRevealed = true
          for (const item of matches) {
            const id = `${recall.recallNumber}_${item.id}`
            if (user.alerts.some((a) => a.id === id)) continue
            item.status = 'confirmed'
            item.recallNumbers = [...new Set([...item.recallNumbers, recall.recallNumber])]
            newAlerts.push({
              id,
              recallNumber: recall.recallNumber,
              itemId: item.id,
              itemName: item.brand ? `${item.brand} ${item.name}` : item.name,
              source: item.source,
              store: item.store,
              confidence: 'confirmed',
              recall: toRecallRef(recall),
              createdAt: checkedAt,
              dismissed: false,
            })
          }
        }
        user.alerts.unshift(...newAlerts)
        user.lastWatchCheckAt = checkedAt
      })
      return { checkedAt, skipped: false, newAlerts }
    }),
}
