import type { Scan, ScanItem } from '@/types'
import { canonicalBarcode, isValidGtin } from '@/lib/barcode'
import { getMockConfig } from '@/mocks/config'
import { productByUpc } from '@/mocks/data/products'
import { recallFixtures } from '@/mocks/data/recalls'
import { receiptFixtures, scannerReceiptCycle } from '@/mocks/data/receipts'
import { currentUserData, getDb, updateDb } from '@/mocks/db'
import { matchItemName } from '@/mocks/matching'
import { alertsForItems, buildBarcodeScan, buildReceiptScan, rebuildScan, watchItemsFromScan } from '@/mocks/scanBuilder'
import { simulate } from '@/mocks/simulate'
import { ApiError } from '../errors'
import type { ScanService } from '../types'
import { visibleRecalls } from './recalls'
import { nowIso, today } from './util'

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024

/** Save a scan with its watchlist items and any alerts, as the backend would. */
function persist(scan: Scan): Scan {
  const user = currentUserData()
  updateDb(() => {
    const items = watchItemsFromScan(scan)
    const known = new Set(user.alerts.map((a) => a.id))
    const alerts = alertsForItems(items, recallFixtures, scan.createdAt).filter((a) => !known.has(a.id))
    user.scans.unshift(scan)
    user.items.unshift(...items)
    user.alerts.unshift(...alerts)
  })
  return scan
}

export const mockScan: ScanService = {
  scanBarcode: (code) =>
    simulate('scan', () => {
      const upc = canonicalBarcode(code)
      if (!isValidGtin(upc)) {
        throw new ApiError('invalid_barcode', 'That doesn’t look like a valid product barcode. Check the digits and try again.', 400)
      }
      const scan = buildBarcodeScan(upc, productByUpc.get(upc), { createdAt: nowIso(), lateRevealed: getDb().lateRevealed })
      return persist(scan)
    }),

  scanReceipt: (image, options) =>
    simulate('scan', () => {
      if (image.size > MAX_RECEIPT_BYTES) {
        throw new ApiError('image_too_large', 'That photo is too large. Please use an image under 4 MB.', 413)
      }
      const { receiptScenario } = getMockConfig()
      if (receiptScenario === 'unreadable') {
        throw new ApiError('receipt_unreadable', 'We couldn’t find any items on that receipt. Try a flatter, well-lit photo.', 422)
      }
      const id =
        receiptScenario === 'cycle'
          ? updateDb((db) => scannerReceiptCycle[db.receiptCursor++ % scannerReceiptCycle.length])
          : receiptScenario
      const scan = buildReceiptScan(receiptFixtures[id], options?.purchaseDate ?? today(), {
        createdAt: nowIso(),
        lateRevealed: getDb().lateRevealed,
      })
      return persist(scan)
    }),

  getScan: (id) =>
    simulate('read', () => {
      const scan = currentUserData().scans.find((s) => s.id === id)
      if (!scan) throw new ApiError('not_found', 'We couldn’t find that scan.', 404)
      return scan
    }),

  updateItem: (scanId, itemId, name) =>
    simulate('scan', () => {
      const trimmed = name.trim()
      if (trimmed.length < 2 || trimmed.length > 100) {
        throw new ApiError('invalid_request', 'Enter an item name of 2 to 100 characters.', 400)
      }
      const user = currentUserData()
      const scan = user.scans.find((s) => s.id === scanId)
      const item = scan?.items.find((i) => i.id === itemId)
      if (!scan || !item) throw new ApiError('not_found', 'We couldn’t find that item.', 404)

      // No UPC to go on, so a name match is only ever "possible"
      const matches = matchItemName(trimmed, visibleRecalls())
      const updatedItem: ScanItem = {
        ...item,
        name: trimmed,
        status: matches.length > 0 ? 'possible' : 'clear',
        recallNumbers: matches.map((r) => r.recallNumber),
        note:
          matches.length > 0
            ? 'Matched by name only. Compare the brand, size and lot code on your package with the recall notice.'
            : undefined,
      }
      const updated = rebuildScan(scan, scan.items.map((i) => (i.id === itemId ? updatedItem : i)))

      updateDb(() => {
        user.scans = user.scans.map((s) => (s.id === scanId ? updated : s))
        const [watch] = watchItemsFromScan({ ...updated, items: [updatedItem] })
        const previous = user.items.find((w) => w.scanItemId === itemId)
        const watchItem = previous ? { ...watch, id: previous.id, createdAt: previous.createdAt } : watch
        user.items = previous ? user.items.map((w) => (w.id === previous.id ? watchItem : w)) : [watchItem, ...user.items]
        user.alerts = user.alerts.filter((a) => a.itemId !== watchItem.id)
        user.alerts.unshift(...alertsForItems([watchItem], visibleRecalls(), nowIso()))
      })
      return updated
    }),
}
