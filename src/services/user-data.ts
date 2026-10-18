// The rules for the user's own data (saved recalls, scans, alerts), as pure functions shared by the device
// store (src/services/local/) and the account store (src/services/firebase/data.ts), so both behave the same
// and the logic is unit-tested without a browser or Firestore.
import { toRecallRef } from '@/lib/recall'
import { productTitle, statusRank } from '@/lib/scan'
import type {
  Alert,
  MatchStatus,
  RecheckResult,
  SavedRecall,
  Scan,
  WatchCheckRequest,
  WatchCheckResult,
  WatchItem,
} from '@/types'

/**
 * A scanned product's id (its WatchItem id, the itemId of its alerts, and its document id in the account): the
 * barcode, so rescanning updates the product instead of adding a duplicate.
 */
export const productKey = (scan: Scan) => `barcode-${scan.items[0]?.upc ?? scan.product?.upc ?? scan.id}`

/** Barcode scans as products: one per barcode, from its newest scan, newest first. */
export function productsFromScans(scans: Scan[]): WatchItem[] {
  const newestFirst = [...scans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const seen = new Set<string>()
  const products: WatchItem[] = []
  for (const scan of newestFirst) {
    const item = scan.items[0]
    const id = productKey(scan)
    if (scan.type !== 'barcode' || !item || seen.has(id)) continue
    seen.add(id)
    products.push({
      id,
      scanId: scan.id,
      scanItemId: item.id,
      source: 'barcode',
      name: item.name,
      brand: item.brand,
      upc: item.upc,
      size: scan.product?.size,
      imageUrl: scan.product?.imageUrl,
      createdAt: scan.createdAt,
      status: item.status,
      recallNumbers: item.recallNumbers,
    })
  }
  return products
}

/** Products with their status raised by any active alert (a re-check can find a recall after the scan). */
export function withAlertStatus(products: WatchItem[], alerts: Alert[]): WatchItem[] {
  const active = alerts.filter((a) => !a.dismissed)
  return products.map((product) => {
    const mine = active.filter((a) => a.itemId === product.id)
    if (mine.length === 0) return product
    const fromAlerts: MatchStatus = mine.some((a) => a.confidence === 'confirmed') ? 'confirmed' : 'possible'
    return {
      ...product,
      status: statusRank[fromAlerts] < statusRank[product.status] ? fromAlerts : product.status,
      recallNumbers: [...new Set([...product.recallNumbers, ...mine.map((a) => a.recallNumber)])],
    }
  })
}

/**
 * Which candidate alerts to write over the existing ones. New alerts are added. An existing alert is kept as
 * it is (a dismissed one stays dismissed), except that "possible" becomes "confirmed" when a later check
 * finds the barcode in the recall, which also brings back an alert dismissed as "probably not mine".
 * Returns `fresh`: the alerts that are new to the user, which are also the ones to save.
 */
export function mergeAlerts(existing: Alert[], candidates: Alert[]): { fresh: Alert[] } {
  const byId = new Map(existing.map((a) => [a.id, a]))
  const fresh: Alert[] = []
  for (const candidate of candidates) {
    const current = byId.get(candidate.id)
    if (!current) {
      byId.set(candidate.id, candidate)
      fresh.push(candidate)
    } else if (current.confidence === 'possible' && candidate.confidence === 'confirmed') {
      const upgraded: Alert = { ...current, confidence: 'confirmed', recall: candidate.recall, dismissed: false }
      byId.set(candidate.id, upgraded)
      fresh.push(upgraded)
    }
  }
  return { fresh }
}

export const alertId = (recallNumber: string, itemId: string) => `${recallNumber}_${itemId}`

export function makeAlert(a: {
  recallNumber: string
  itemId: string
  itemName: string
  confidence: 'confirmed' | 'possible'
  recall: Alert['recall']
  createdAt: string
}): Alert {
  return { ...a, id: alertId(a.recallNumber, a.itemId), source: 'barcode', dismissed: false }
}

/** Alerts for a barcode scan's matches, so the Alerts list and recall badges show them right away. */
export function alertsFromScan(scan: Scan, itemId = productKey(scan)): Alert[] {
  const item = scan.items[0]
  if (!item || (item.status !== 'confirmed' && item.status !== 'possible')) return []
  const confidence = item.status
  return scan.matchedRecalls
    .filter((r) => item.recallNumbers.includes(r.recallNumber))
    .map((recall) =>
      makeAlert({
        recallNumber: recall.recallNumber,
        itemId,
        itemName: productTitle(item),
        confidence,
        recall: toRecallRef(recall),
        createdAt: scan.createdAt,
      }),
    )
}

// ---- Merging a guest's device data into an account ---------------------------------------------------

/** A scan as stored in an account: one document per product, remembering the ids of the scans it replaced. */
export type StoredScan = Scan & { previousIds?: string[] }
/** Most replaced scan ids remembered per product (so an old result page still opens). */
export const MAX_PREVIOUS_IDS = 50

/** `scan` stored over `existing` (the same product): keeps the replaced scan's id findable. */
export function replaceScan(existing: StoredScan | undefined, scan: Scan): StoredScan {
  if (!existing || existing.id === scan.id) return { ...scan, ...(existing?.previousIds && { previousIds: existing.previousIds }) }
  return { ...scan, previousIds: [...(existing.previousIds ?? []), existing.id].slice(-MAX_PREVIOUS_IDS) }
}

export interface UserDataSnapshot {
  saved: SavedRecall[]
  scans: StoredScan[]
  alerts: Alert[]
  /** Last re-check (ISO), or null if never */
  lastCheck: string | null
}

export interface MergePlan {
  saved: SavedRecall[]
  scans: StoredScan[]
  alerts: Alert[]
  /** The account's new last check, or undefined to leave it */
  lastCheck?: string
}

/**
 * What to write into the account so it also holds the device's data. The account's own data wins where both
 * have something (a saved recall, a dismissed alert), except that a newer scan of the same barcode replaces
 * the older one and alerts follow mergeAlerts(). The last check moves back, never forward, so the next
 * re-check also covers recalls reported since the device's products were last checked.
 */
export function planDeviceMerge(device: UserDataSnapshot, account: UserDataSnapshot): MergePlan {
  const savedIds = new Set(account.saved.map((s) => s.recallNumber))
  const accountScans = new Map(account.scans.map((s) => [productKey(s), s]))
  const newestDeviceScans = new Map<string, Scan>()
  for (const scan of device.scans.filter((s) => s.type === 'barcode')) {
    const key = productKey(scan)
    const other = newestDeviceScans.get(key)
    if (!other || scan.createdAt > other.createdAt) newestDeviceScans.set(key, scan)
  }
  const scans: StoredScan[] = []
  for (const [key, scan] of newestDeviceScans) {
    const existing = accountScans.get(key)
    if (existing && existing.createdAt >= scan.createdAt) {
      // The account's scan is newer: keep it, but let the device scan's result page still open
      const known = existing.id === scan.id || existing.previousIds?.includes(scan.id)
      if (!known) scans.push({ ...existing, previousIds: [...(existing.previousIds ?? []), scan.id].slice(-MAX_PREVIOUS_IDS) })
      continue
    }
    scans.push(replaceScan(existing, scan))
  }
  // Alerts follow their product: drop device alerts whose product is on neither side (e.g. it dropped off)
  const productIds = new Set([...newestDeviceScans.keys(), ...accountScans.keys()])
  const deviceAlerts = device.alerts.filter((a) => productIds.has(a.itemId))

  let lastCheck: string | undefined
  if (account.lastCheck) {
    const deviceFrom = device.lastCheck ?? oldestProduct(productsFromScans(device.scans))
    if (deviceFrom && deviceFrom < account.lastCheck) lastCheck = deviceFrom
  }

  return {
    saved: device.saved.filter((s) => !savedIds.has(s.recallNumber)),
    scans,
    alerts: mergeAlerts(account.alerts, deviceAlerts).fresh,
    ...(lastCheck && { lastCheck }),
  }
}

/** The oldest createdAt among products, or null if there are none. */
export const oldestProduct = (products: WatchItem[]): string | null =>
  products.reduce<string | null>((min, p) => (min === null || p.createdAt < min ? p.createdAt : min), null)

// ---- Re-checking saved products ------------------------------------------------------------------------

export interface RecheckStore {
  products(): Promise<WatchItem[]>
  lastCheck(): Promise<string | null>
  /** Saves new and upgraded alerts; `saved` is false when they couldn't be stored (e.g. storage full) */
  addAlerts(candidates: Alert[]): Promise<{ fresh: Alert[]; saved: boolean }>
  setLastCheck(at: string): Promise<void>
}

/** YYYY-MM-DD of an ISO timestamp. */
const day = (iso: string) => iso.slice(0, 10)

/** Most products per POST /api/watchlist/check request, and the longest name or brand it accepts (api/models.py). */
export const CHECK_BATCH = 100
const MAX_CHECK_TEXT = 200

/**
 * Sends the products to POST /api/watchlist/check (recalls reported since the last check, or since the oldest
 * scan), in requests of CHECK_BATCH, and adds alerts for new matches. The last check moves forward only once
 * every request has answered and the alerts are saved (to the earliest answer's time, so nothing is skipped).
 */
export async function recheckWith(
  store: RecheckStore,
  check: (body: WatchCheckRequest) => Promise<WatchCheckResult>,
): Promise<RecheckResult> {
  const products = await store.products()
  if (products.length === 0) return { checkedAt: new Date().toISOString(), skipped: true, newAlerts: [] }
  // Recalls reported since the last check, or since the oldest scan (each scan already checked older ones).
  // The backend looks back a little further, since openFDA publishes records after their report date.
  const since = day((await store.lastCheck()) ?? oldestProduct(products)!)
  const items = products.map(({ id, upc, name, brand }) => ({
    id,
    upc,
    name: name.slice(0, MAX_CHECK_TEXT),
    ...(brand && { brand: brand.slice(0, MAX_CHECK_TEXT) }),
  }))
  const batches: (typeof items)[] = []
  for (let i = 0; i < items.length; i += CHECK_BATCH) batches.push(items.slice(i, i + CHECK_BATCH))
  const results = await Promise.all(batches.map((batch) => check({ items: batch, since })))
  const checkedAt = results.map((r) => r.checkedAt).sort()[0]

  const byId = new Map(products.map((p) => [p.id, p]))
  const { fresh, saved } = await store.addAlerts(
    results.flatMap((result) =>
      result.matches.flatMap((m) => {
        const product = byId.get(m.itemId)
        if (!product) return []
        return [
          makeAlert({
            recallNumber: m.recallNumber,
            itemId: m.itemId,
            itemName: productTitle(product),
            confidence: m.confidence,
            recall: toRecallRef(m.recall),
            createdAt: result.checkedAt,
          }),
        ]
      }),
    ),
  )
  if (saved) await store.setLastCheck(checkedAt)
  return { checkedAt, skipped: false, newAlerts: fresh }
}
