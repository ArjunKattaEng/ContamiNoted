import { readJson, writeJson } from '@/lib/storage'
import type { MatchStatus } from '@/types'

const KEY = 'rg-expiry-dates-v1'

function load(): Record<string, string> {
  return readJson<Record<string, string>>(KEY) ?? {}
}

export function getExpiryDate(productId: string): string | undefined {
  return load()[productId]
}

export function setExpiryDate(productId: string, date: string | null): void {
  const all = load()
  if (date) {
    all[productId] = date
  } else {
    delete all[productId]
  }
  writeJson(KEY, all)
}

/** Whether a YYYY-MM-DD date is before today (expired). Today is still good. */
export function isExpired(date: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return date < today
}

export type ProductSafety = 'good' | 'not_good'

/**
 * 'not_good' if the product has an active recall (confirmed/possible) OR is past its expiry date.
 * 'good' otherwise — no recall and not expired (or no expiry date set).
 */
export function productSafety(matchStatus: MatchStatus, expiryDate: string | undefined): ProductSafety {
  const hasRecall = matchStatus === 'confirmed' || matchStatus === 'possible'
  const expired = expiryDate ? isExpired(expiryDate) : false
  return hasRecall || expired ? 'not_good' : 'good'
}

export function safetyReason(matchStatus: MatchStatus, expiryDate: string | undefined): string {
  const hasRecall = matchStatus === 'confirmed' || matchStatus === 'possible'
  const expired = expiryDate ? isExpired(expiryDate) : false
  if (hasRecall && expired) return 'This product has an active FDA recall and has passed its expiry date.'
  if (hasRecall)
    return matchStatus === 'confirmed'
      ? 'This product is listed in an active FDA recall.'
      : 'This product may be affected by an active FDA recall — check the lot code and dates.'
  if (expired) return 'This product has passed its expiry date.'
  return expiryDate
    ? "No active recalls found, and the product hasn't expired yet."
    : 'No active FDA recalls found for this product.'
}
