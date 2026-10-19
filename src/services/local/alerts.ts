// Recall alerts, the last re-check time and alert preferences, kept on this device in guest mode. Alerts
// come from barcode scans with a match and from re-checks (POST /api/watchlist/check, answered statelessly).
// Each value is kept in memory too, so the app works for the session when storage is unavailable.
import { readJson, storageAvailable, writeJson } from '@/lib/storage'
import { FOOD_CATEGORY_IDS } from '@/lib/categories'
import type { Alert, UserPrefs } from '@/types'
import { alertId, alertsFromScan, makeAlert, mergeAlerts } from '../user-data'

export { alertId, alertsFromScan, makeAlert }

const ALERTS_KEY = 'rg-alerts-v1'
const CHECK_KEY = 'rg-watch-check-v1'
const PREFS_KEY = 'rg-device-prefs-v1'
/** Newest alerts kept; older ones drop off. */
export const MAX_LOCAL_ALERTS = 200

const isAlert = (value: unknown): value is Alert =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Alert).id === 'string' &&
  typeof (value as Alert).recallNumber === 'string' &&
  typeof (value as Alert).itemId === 'string' &&
  typeof (value as Alert).recall === 'object' &&
  (value as Alert).recall !== null

const storedAlerts = readJson<unknown>(ALERTS_KEY)
/** False on a device that has never stored alerts (e.g. it has scans from before alerts existed). */
export const alertsStoreExisted = storedAlerts !== null
let alerts: Alert[] = Array.isArray(storedAlerts) ? storedAlerts.filter(isAlert) : []
/** Whether the last write of the alerts reached storage. */
let alertsSaved = alertsStoreExisted
let lastCheck: string | null = readJson<string>(CHECK_KEY)
/** Only known preferences, with valid values (anything else in storage is ignored). */
const cleanPrefs = (value: Partial<UserPrefs> | null | undefined): UserPrefs => ({
  recheckOnOpen: value?.recheckOnOpen !== false,
  ...(Array.isArray(value?.notifyCategories) && {
    notifyCategories: (value.notifyCategories as unknown[]).filter(
      (c): c is string => typeof c === 'string' && FOOD_CATEGORY_IDS.includes(c),
    ),
  }),
})
let prefs: UserPrefs = cleanPrefs(readJson<Partial<UserPrefs>>(PREFS_KEY))

/** Over the limit, drop the oldest dismissed alerts first, so active ones are never lost. */
function trim(list: Alert[]): Alert[] {
  if (list.length <= MAX_LOCAL_ALERTS) return list
  const keepDismissed = Math.max(0, MAX_LOCAL_ALERTS - list.filter((a) => !a.dismissed).length)
  let dismissedKept = 0
  return list
    .filter((a) => !a.dismissed || dismissedKept++ < keepDismissed)
    .slice(0, MAX_LOCAL_ALERTS)
}

const persistAlerts = () => {
  alertsSaved = writeJson(ALERTS_KEY, alerts)
}

/** Whether the alerts as they are now are saved on the device (false if storage is full or unavailable). */
export const localAlertsSaved = () => alertsSaved

export function listLocalAlerts(): Alert[] {
  return alerts
}

/**
 * Adds alerts that don't exist yet, newest first, and upgrades "possible" ones a later check confirmed (rules
 * in mergeAlerts, src/services/user-data.ts). Returns the alerts that are new to the user.
 */
export function addLocalAlerts(candidates: Alert[]): Alert[] {
  const { fresh } = mergeAlerts(alerts, candidates)
  if (fresh.length > 0) {
    const freshIds = new Set(fresh.map((a) => a.id))
    alerts = trim([...fresh, ...alerts.filter((a) => !freshIds.has(a.id))])
    persistAlerts()
  }
  return fresh
}

/** Keep only the alerts whose product is still on the device (scans drop off after 50 products). */
export function pruneLocalAlerts(productIds: Set<string>): void {
  const kept = alerts.filter((a) => productIds.has(a.itemId))
  if (kept.length !== alerts.length) {
    alerts = kept
    persistAlerts()
  }
}

/** Marks the alerts store as created, so the one-time import of older scans' matches doesn't repeat. */
export function markLocalAlertsCreated(): void {
  persistAlerts()
}

export function dismissLocalAlert(id: string): void {
  alerts = alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
  persistAlerts()
}

/** Forget the alerts of one watched product (when the user removes it). */
export function removeLocalAlertsFor(itemId: string): void {
  alerts = alerts.filter((a) => a.itemId !== itemId)
  persistAlerts()
}

/** Re-reads alerts and the last check from storage (another tab may have changed them). */
export function reloadLocalAlerts(): void {
  // Not when the last write failed (storage full): memory then holds alerts that storage doesn't
  if (!storageAvailable() || !alertsSaved) return
  const stored = readJson<unknown>(ALERTS_KEY)
  alerts = Array.isArray(stored) ? stored.filter(isAlert) : []
  lastCheck = readJson<string>(CHECK_KEY)
}

/** Removes these alerts (by id), e.g. once they've moved into an account. With none left, forgets the last check. */
export function removeLocalAlerts(ids: Set<string>): void {
  reloadLocalAlerts() // keep what another tab saved meanwhile
  alerts = alerts.filter((a) => !ids.has(a.id))
  persistAlerts()
  if (alerts.length === 0) {
    lastCheck = null
    writeJson(CHECK_KEY, null)
  }
}

/** Remove all alerts and the re-check time (Profile → Clear scan history). */
export function clearLocalAlerts(): void {
  alerts = []
  lastCheck = null
  persistAlerts()
  writeJson(CHECK_KEY, null)
}

/** When this device last re-checked its products (ISO timestamp), or null. */
export const lastWatchCheck = (): string | null => lastCheck

export function setLastWatchCheck(at: string): void {
  lastCheck = at
  writeJson(CHECK_KEY, at)
}

/** Alert preferences for guests, kept on this device. */
export const devicePrefs = (): UserPrefs => prefs

export function setDevicePrefs(patch: Partial<UserPrefs>): UserPrefs {
  prefs = cleanPrefs({ ...prefs, ...patch })
  writeJson(PREFS_KEY, prefs)
  return prefs
}
