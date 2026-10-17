// Saved recalls, kept on this device until accounts (Firebase) exist. This is the user's own data,
// not demo data: each entry is a snapshot of a real recall they starred.
import { readJson, storageAvailable, writeJson } from '@/lib/storage'
import { toRecallRef } from '@/lib/recall'
import type { SavedRecall } from '@/types'
import type { SavedService } from '../types'

const KEY = 'rg-saved-recalls-v1'

let saved: SavedRecall[] = readJson<SavedRecall[]>(KEY) ?? []
/** Whether storage holds what memory holds (false after a failed write, e.g. storage full). */
let persisted = true
const persist = () => {
  persisted = writeJson(KEY, saved)
}

export const localSaved: SavedService = {
  list: async () => saved,

  toggle: async (recall) => {
    const exists = saved.some((s) => s.recallNumber === recall.recallNumber)
    saved = exists
      ? saved.filter((s) => s.recallNumber !== recall.recallNumber)
      : [{ recallNumber: recall.recallNumber, savedAt: new Date().toISOString(), recall: toRecallRef(recall) }, ...saved]
    persist()
    return !exists
  },
}

/** The saved recalls on this device, newest first. */
export const listLocalSaved = (): SavedRecall[] => saved

/** Re-reads saved recalls from storage (another tab may have changed them). */
export function reloadLocalSaved(): void {
  // Not after a failed write: memory then holds recalls that storage doesn't
  if (storageAvailable() && persisted) saved = readJson<SavedRecall[]>(KEY) ?? []
}

/** Removes these saved recalls (by recall number), e.g. once they've moved into an account. */
export function removeLocalSaved(recallNumbers: Set<string>): void {
  reloadLocalSaved() // keep what another tab saved meanwhile
  saved = saved.filter((s) => !recallNumbers.has(s.recallNumber))
  persist()
}

/** Remove every saved recall from this device (Profile → Clear saved recalls). */
export function clearLocalSaved(): void {
  saved = []
  persist()
}
