// Saved recalls, kept on this device until accounts (Firebase) exist. This is the user's own data,
// not demo data: each entry is a snapshot of a real recall they starred.
import { readJson, writeJson } from '@/lib/storage'
import { toRecallRef } from '@/lib/recall'
import type { SavedRecall } from '@/types'
import type { SavedService } from '../types'

const KEY = 'rg-saved-recalls-v1'

let saved: SavedRecall[] = readJson<SavedRecall[]>(KEY) ?? []

export const localSaved: SavedService = {
  list: async () => saved,

  toggle: async (recall) => {
    const exists = saved.some((s) => s.recallNumber === recall.recallNumber)
    saved = exists
      ? saved.filter((s) => s.recallNumber !== recall.recallNumber)
      : [{ recallNumber: recall.recallNumber, savedAt: new Date().toISOString(), recall: toRecallRef(recall) }, ...saved]
    writeJson(KEY, saved)
    return !exists
  },
}

/** Remove every saved recall from this device (Profile → Clear saved recalls). */
export function clearLocalSaved(): void {
  saved = []
  writeJson(KEY, saved)
}
