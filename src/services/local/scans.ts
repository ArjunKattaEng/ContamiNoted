// Scan history kept on this device in guest mode: the backend is stateless (nothing is stored on the server)
// until accounts exist. Each entry is the user's own scan result, not demo data.
import { readJson, storageAvailable, writeJson } from '@/lib/storage'
import type { Scan, ScanType, WatchItem } from '@/types'
import { ApiError } from '../errors'
import type { HistoryService } from '../types'
import { productKey, productsFromScans } from '../user-data'

export { productKey }

const KEY = 'rg-scans-v1'
/** Newest scans kept; older ones drop off. */
export const MAX_LOCAL_SCANS = 50

const isScan = (value: unknown): value is Scan =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Scan).id === 'string' &&
  ((value as Scan).type === 'barcode' || (value as Scan).type === 'receipt') &&
  Array.isArray((value as Scan).items)

function load(): Scan[] {
  const stored = readJson<unknown>(KEY)
  return Array.isArray(stored) ? stored.filter(isScan) : []
}

let scans: Scan[] = load()

/**
 * Write through to storage. If it's full (the quota is shared with saved recalls), keep as many of the
 * newest scans as fit, found by binary search, and trim memory to match, so what the app shows now is what
 * it shows after a reload. If storage is unavailable (private mode, tests) or can't hold even one scan, the
 * app keeps working from memory for this session.
 */
/** Whether storage holds what memory holds (false when not even one scan fits, see persist). */
let persisted = true

function persist() {
  persisted = true
  if (writeJson(KEY, scans)) return
  let fits = 0 // the largest count known to fit
  let tooMany = scans.length // the smallest count known not to fit
  while (tooMany - fits > 1) {
    const mid = Math.floor((fits + tooMany) / 2)
    if (writeJson(KEY, scans.slice(0, mid))) fits = mid
    else tooMany = mid
  }
  if (fits > 0 && writeJson(KEY, scans.slice(0, fits))) scans = scans.slice(0, fits)
  else {
    writeJson(KEY, [])
    persisted = scans.length === 0
  }
}

/** Older scan id → the rescan that replaced it, so an earlier result page (e.g. via Back) still opens. */
const replacedBy = new Map<string, string>()

/** Saves a scan. A barcode scan replaces earlier scans of the same barcode (only the latest result matters). */
export function saveLocalScan(scan: Scan): void {
  const replaces = (s: Scan) =>
    s.id !== scan.id && scan.type === 'barcode' && s.type === 'barcode' && productKey(s) === productKey(scan)
  for (const old of scans.filter(replaces)) replacedBy.set(old.id, scan.id)
  scans = [scan, ...scans.filter((s) => s.id !== scan.id && !replaces(s))].slice(0, MAX_LOCAL_SCANS)
  persist()
}

export function getLocalScan(id: string): Scan {
  let current = id
  for (let hops = 0; replacedBy.has(current) && hops < MAX_LOCAL_SCANS; hops++) current = replacedBy.get(current)!
  const scan = scans.find((s) => s.id === current)
  if (!scan) throw new ApiError('not_found', 'We couldn’t find that scan on this device.', 404)
  return scan
}

/** The scans of one type kept on this device, newest first. */
export function listLocalScans(type: ScanType): Scan[] {
  return scans.filter((s) => s.type === type)
}

/** Barcode scans as watchlist products: one per barcode, from its latest scan, newest first. */
export function listLocalProducts(): WatchItem[] {
  return productsFromScans(scans)
}

/** Removing a product forgets every scan of that barcode. */
export function deleteLocalProduct(id: string): void {
  scans = scans.filter((s) => s.type !== 'barcode' || productKey(s) !== id)
  persist()
}

/** Re-reads the scans from storage (another tab may have changed them). Without storage, memory is all there is. */
export function reloadLocalScans(): void {
  // Not when memory holds scans that storage couldn't (storage full)
  if (storageAvailable() && persisted) scans = load()
}

/** Removes these scans (by scan id), e.g. once they've moved into an account. */
export function removeLocalScans(ids: Set<string>): void {
  reloadLocalScans() // keep what another tab saved meanwhile
  scans = scans.filter((s) => !ids.has(s.id))
  persist()
}

/** Remove all scans from this device (Profile → Clear scan history). */
export function clearLocalScans(): void {
  scans = []
  replacedBy.clear()
  persist()
}

/** History straight from the scans; src/services/local/watch.ts adds alert status on top. */
export const localScanHistory: HistoryService = {
  listScans: async (type: ScanType) => listLocalScans(type),
  listProducts: async () => listLocalProducts(),
  deleteProduct: async (id) => deleteLocalProduct(id),
}
