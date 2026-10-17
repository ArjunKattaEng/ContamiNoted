// Moving a guest's device data into their account, and deleting an account's data. Used by
// src/services/firebase/auth.ts.
import { getFirebase } from '@/lib/firebase'
import { accountDataChanged } from '../events'
import { lastWatchCheck, listLocalAlerts, reloadLocalAlerts, removeLocalAlerts } from '../local/alerts'
import { listLocalSaved, reloadLocalSaved, removeLocalSaved } from '../local/saved'
import { listLocalScans, reloadLocalScans, removeLocalScans } from '../local/scans'
import { planDeviceMerge, productKey, type UserDataSnapshot } from '../user-data'
import { accountData } from './data'

/** What this device holds, re-read from storage (another tab may have added to it since this one loaded). */
function deviceSnapshot(): UserDataSnapshot {
  reloadLocalSaved()
  reloadLocalScans()
  reloadLocalAlerts()
  return { saved: listLocalSaved(), scans: listLocalScans('barcode'), alerts: listLocalAlerts(), lastCheck: lastWatchCheck() }
}

/**
 * Called after every sign-in (and on app start while signed in): moves anything saved on this device as a
 * guest into the account, then removes from the device exactly what was looked at, except documents the
 * account refused (kept for a later try, and logged). Safe to repeat: if a write fails, the device keeps
 * its data and the next start tries again (the plan is worked out afresh against the account each time).
 */
export async function afterSignIn(uid: string): Promise<void> {
  const device = deviceSnapshot()
  if (device.saved.length === 0 && device.scans.length === 0 && device.alerts.length === 0) return
  const { db } = await getFirebase()
  const account = accountData(db, uid)
  const failed = await account.write(planDeviceMerge(device, await account.snapshotFor(device)))
  removeLocalSaved(new Set(device.saved.map((s) => s.recallNumber).filter((n) => !failed.has(`saved:${n}`))))
  removeLocalScans(new Set(device.scans.filter((s) => !failed.has(`scan:${productKey(s)}`)).map((s) => s.id)))
  removeLocalAlerts(
    new Set(
      device.alerts
        .filter((a) => !failed.has(`alert:${a.id}`) && !failed.has(`scan:${a.itemId}`))
        .map((a) => a.id),
    ),
  )
  accountDataChanged()
}

/** Deletes the account's saved recalls, scans and alerts (not the profile document or the login). */
export async function deleteAccountData(uid: string): Promise<void> {
  const { db } = await getFirebase()
  await accountData(db, uid).deleteAll()
}
