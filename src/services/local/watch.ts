// Guest mode: scan history (./scans) and alerts (./alerts) on the device, with re-checks answered by the
// stateless backend (POST /api/watchlist/check). Composed here so ./scans and ./alerts stay independent.
import { storageAvailable } from '@/lib/storage'
import type { Scan, WatchItem } from '@/types'
import { checkWatchlist } from '../http/watchlist'
import type { AlertsService, HistoryService } from '../types'
import { alertsFromScan, recheckWith, withAlertStatus, type RecheckStore } from '../user-data'
import {
  addLocalAlerts,
  alertsStoreExisted,
  dismissLocalAlert,
  lastWatchCheck,
  listLocalAlerts,
  localAlertsSaved,
  markLocalAlertsCreated,
  pruneLocalAlerts,
  removeLocalAlertsFor,
  setLastWatchCheck,
} from './alerts'
import { deleteLocalProduct, listLocalProducts, listLocalScans, localScanHistory, saveLocalScan } from './scans'

// One-time import: a device with scans from before alerts existed gets alerts for their matches, so the
// Home banner and the Alerts list agree with the Products list.
if (!alertsStoreExisted) {
  for (const scan of listLocalScans('barcode')) addLocalAlerts(alertsFromScan(scan))
  markLocalAlertsCreated()
}

/** Alerts whose product is still on the device; alerts of products that dropped off are removed. */
function currentAlerts() {
  pruneLocalAlerts(new Set(listLocalProducts().map((p) => p.id)))
  return listLocalAlerts()
}

/** Products with their status raised by any active alert (a re-check can find a recall after the scan). */
function productsWithAlerts(): WatchItem[] {
  return withAlertStatus(listLocalProducts(), currentAlerts())
}

/** Save a barcode scan on the device, with an alert for each recall it matched. */
export function saveScanWithAlerts(scan: Scan): void {
  saveLocalScan(scan)
  addLocalAlerts(alertsFromScan(scan))
}

export const localHistory: HistoryService = {
  ...localScanHistory,
  listProducts: async () => productsWithAlerts(),
  deleteProduct: async (id) => {
    deleteLocalProduct(id)
    removeLocalAlertsFor(id)
  },
}

/** The device as a re-check store (the shared steps are recheckWith in src/services/user-data.ts). */
const deviceRecheckStore: RecheckStore = {
  products: async () => listLocalProducts(),
  lastCheck: async () => lastWatchCheck(),
  addAlerts: async (candidates) => {
    const fresh = addLocalAlerts(candidates)
    // Move the window forward only while the alerts are saved (storage full: the next check, with the same
    // window, finds them again and retries the save). Without any storage, the app works from memory.
    return { fresh, saved: localAlertsSaved() || !storageAvailable() }
  },
  setLastCheck: async (at) => setLastWatchCheck(at),
}

export const localAlerts: AlertsService = {
  list: async () => currentAlerts(),
  lastCheck: async () => lastWatchCheck(),
  dismiss: async (id) => dismissLocalAlert(id),
  recheck: () => recheckWith(deviceRecheckStore, checkWatchlist),
}
