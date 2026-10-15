// Seeded history for the demo "returning user" (any email signed in on the Login screen).
import type { Alert, SavedRecall, Scan, WatchItem } from '@/types'
import { daysAgo, timestampDaysAgo } from './data/dates'
import { productByUpc } from './data/products'
import { receiptFixtures } from './data/receipts'
import { recallByKey } from './data/recalls'
import { toRecallRef } from '@/lib/recall'
import { alertsForItems, buildBarcodeScan, buildReceiptScan, watchItemsFromScan } from './scanBuilder'

export interface SeededHistory {
  scans: Scan[]
  items: WatchItem[]
  alerts: Alert[]
  saved: SavedRecall[]
}

export function seedReturningUser(lateRevealed: boolean): SeededHistory {
  const ctx = (days: number, hour: number) => ({ createdAt: timestampDaysAgo(days, hour), lateRevealed })

  const receipts: [keyof typeof receiptFixtures, number][] = [
    ['B', 3],
    ['A', 9],
    ['E', 16],
    ['D', 24],
    ['C', 38],
  ]
  const barcodes: [string, number][] = [
    ['072943002168', 2], // Golden Crest peanut butter: confirmed
    ['074522001272', 5], // Riverbend cheddar: possible
    ['088902004173', 7], // Meadowlark yogurt: clear until the late recall is revealed
    ['070391002044', 11],
    ['085667001287', 19],
    ['081773000114', 27],
  ]

  const scans = [
    ...receipts.map(([id, days]) => buildReceiptScan(receiptFixtures[id], daysAgo(days), ctx(days, 18))),
    ...barcodes.map(([upc, days]) => buildBarcodeScan(upc, productByUpc.get(upc), ctx(days, 10))),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const items = scans.flatMap(watchItemsFromScan)
  const allRecalls = Object.values(recallByKey)
  const alerts = scans
    .flatMap((scan) => alertsForItems(items.filter((i) => i.scanId === scan.id), allRecalls, scan.createdAt))
    // Older possible matches have already been reviewed
    .map((a) => (a.confidence === 'possible' && a.recall.recallNumber !== recallByKey.brie.recallNumber ? { ...a, dismissed: true } : a))

  const saved: SavedRecall[] = (['soup', 'berries', 'iceCream'] as const).map((key, i) => ({
    recallNumber: recallByKey[key].recallNumber,
    savedAt: timestampDaysAgo(i + 1, 20),
    recall: toRecallRef(recallByKey[key]),
  }))

  return { scans, items, alerts, saved }
}
