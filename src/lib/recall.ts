import type { RecallRef } from '@/types'

/** Compact recall snapshot stored with alerts and saved recalls (strips any extra fields). */
export function toRecallRef(recall: RecallRef): RecallRef {
  const { recallNumber, productDescription, classification, status, reportDate } = recall
  return { recallNumber, productDescription, classification, status, reportDate }
}

/** Route of a recall's detail page. */
export const recallPath = (recallNumber: string) => `/recalls/${encodeURIComponent(recallNumber)}`
