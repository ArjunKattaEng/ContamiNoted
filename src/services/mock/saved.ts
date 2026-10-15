import { currentUserData, updateDb } from '@/mocks/db'
import { toRecallRef } from '@/lib/recall'
import { maybeEmpty, simulate } from '@/mocks/simulate'
import type { SavedService } from '../types'
import { nowIso } from './util'

export const mockSaved: SavedService = {
  list: () => simulate('read', () => maybeEmpty(currentUserData().saved)),

  toggle: (recall) =>
    simulate('write', () => {
      const user = currentUserData()
      return updateDb(() => {
        const exists = user.saved.some((s) => s.recallNumber === recall.recallNumber)
        user.saved = exists
          ? user.saved.filter((s) => s.recallNumber !== recall.recallNumber)
          : [{ recallNumber: recall.recallNumber, savedAt: nowIso(), recall: toRecallRef(recall) }, ...user.saved]
        return !exists
      })
    }),
}
