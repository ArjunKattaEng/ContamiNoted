import { currentUserData, updateDb } from '@/mocks/db'
import { maybeEmpty, simulate } from '@/mocks/simulate'
import type { HistoryService } from '../types'

export const mockHistory: HistoryService = {
  listScans: (type) => simulate('read', () => maybeEmpty(currentUserData().scans.filter((s) => s.type === type))),

  listProducts: () => simulate('read', () => maybeEmpty(currentUserData().items)),

  deleteProduct: (id) =>
    simulate('write', () => {
      const user = currentUserData()
      updateDb(() => {
        user.items = user.items.filter((i) => i.id !== id)
        // An item that is no longer watched shouldn't keep raising alerts
        user.alerts = user.alerts.filter((a) => a.itemId !== id)
      })
    }),
}
