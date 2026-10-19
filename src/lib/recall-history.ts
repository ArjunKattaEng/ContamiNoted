// Recalls the user has opened, stored on device for the history tab.
import { readJson, writeJson } from './storage'
import type { Classification, RecallStatus } from '@/types'

export interface ViewedRecall {
  recallNumber: string
  productDescription: string
  recallingFirm: string
  classification: Classification
  status: RecallStatus
  reportDate: string
  viewedAt: string
}

const KEY = 'rg-recall-history-v1'
const MAX_ENTRIES = 50

function load(): ViewedRecall[] {
  return readJson<ViewedRecall[]>(KEY) ?? []
}

export function getRecallHistory(): ViewedRecall[] {
  return load()
}

export function saveRecallView(recall: ViewedRecall): void {
  const existing = load().filter((r) => r.recallNumber !== recall.recallNumber)
  writeJson(KEY, [recall, ...existing].slice(0, MAX_ENTRIES))
}

export function removeRecallView(recallNumber: string): void {
  writeJson(KEY, load().filter((r) => r.recallNumber !== recallNumber))
}

export function clearRecallHistory(): void {
  writeJson(KEY, [])
}
