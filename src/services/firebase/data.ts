// The signed-in user's own data in Firestore: users/{uid}/savedRecalls, /scans (one document per product,
// id = productKey) and /alerts, plus the last re-check time in the profile (lastWatchCheckAt). The rules for
// what to keep are shared with the device stores (src/services/user-data.ts); firestore.rules checks every
// write, and forStorage shapes each document to what the rules accept. Loaded on demand (see
// src/services/index.ts), so Firebase stays out of the main bundle.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore/lite'
import { getFirebase } from '@/lib/firebase'
import { toRecallRef } from '@/lib/recall'
import type { Alert, SavedRecall, Scan } from '@/types'
import { ApiError } from '../errors'
import { checkWatchlist } from '../http/watchlist'
import type { AlertsService, HistoryService, SavedService } from '../types'
import {
  alertsFromScan,
  mergeAlerts,
  productKey,
  productsFromScans,
  recheckWith,
  replaceScan,
  withAlertStatus,
  type MergePlan,
  type RecheckStore,
  type StoredScan,
  type UserDataSnapshot,
} from '../user-data'
import { firebaseErrorCode, withApiErrors } from './errors'

/** Newest scans read for the Products list and re-checks (one per product). */
export const MAX_ACCOUNT_SCANS = 200
/** Writes per batch (Firestore allows 500). */
const BATCH_SIZE = 400
const SUBCOLLECTIONS = ['savedRecalls', 'scans', 'alerts'] as const

const now = () => new Date().toISOString()

/** The signed-in user's uid, or null when signed out (a guest). */
export async function signedInUid(): Promise<string | null> {
  const { auth } = await getFirebase()
  await auth.authStateReady()
  return auth.currentUser?.uid ?? null
}

/** One document write, with the key it's reported under if it fails. */
interface Write {
  key: string
  apply: (batch: WriteBatch) => void
}

/**
 * Applies writes in batches (each all or nothing). If a batch is refused by the rules, its writes are retried
 * one by one so a single bad document can't block the rest. Returns the keys of the writes that failed.
 */
async function commitAll(db: Firestore, writes: Write[]): Promise<Set<string>> {
  const failed = new Set<string>()
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const w of chunk) w.apply(batch)
    try {
      await batch.commit()
    } catch (err) {
      if (firebaseErrorCode(err) !== 'permission-denied') throw err
      if (chunk.length === 1) {
        console.warn('A document was refused by the security rules; skipped', chunk[0].key, err)
        failed.add(chunk[0].key)
        continue
      }
      for (const w of chunk) for (const key of await commitAll(db, [w])) failed.add(key)
    }
  }
  return failed
}

/** Every write must succeed (scans and alerts the user is waiting for). */
async function commitOrThrow(db: Firestore, writes: Write[]): Promise<void> {
  const batch = writeBatch(db)
  if (writes.length > BATCH_SIZE) throw new Error('Too many writes for one batch')
  for (const w of writes) w.apply(batch)
  await batch.commit()
}

const SCAN_KEYS = [
  'id',
  'type',
  'createdAt',
  'store',
  'purchaseDate',
  'total',
  'product',
  'items',
  'matchedRecalls',
  'verdict',
  'counts',
  'previousIds',
] as const satisfies readonly (keyof StoredScan)[]

/** Documents shaped as firestore.rules accepts them: known keys only, no nulls, compact recall snapshots. */
export const forStorage = {
  scan: (scan: StoredScan): StoredScan => {
    const out: Record<string, unknown> = {}
    for (const key of SCAN_KEYS) {
      const value = scan[key]
      if (value !== undefined && (value !== null || key === 'verdict')) out[key] = value
    }
    return out as unknown as StoredScan
  },
  alert: (a: Alert): Alert => {
    const { id, recallNumber, itemId, itemName, source, store, confidence, recall, createdAt, dismissed } = a
    return {
      id,
      recallNumber,
      itemId,
      itemName: itemName.slice(0, 300) || itemId,
      source,
      ...(store && { store: store.slice(0, 300) }),
      confidence,
      recall: toRecallRef(recall),
      createdAt,
      dismissed,
    }
  },
  saved: (s: SavedRecall): SavedRecall => ({ recallNumber: s.recallNumber, savedAt: s.savedAt, recall: toRecallRef(s.recall) }),
}

/** One user's data in Firestore. */
export function accountData(db: Firestore, uid: string) {
  const profileRef = doc(db, 'users', uid)
  const col = (name: (typeof SUBCOLLECTIONS)[number]) => collection(db, 'users', uid, name)
  const scanRef = (key: string) => doc(col('scans'), key)
  const alertRef = (id: string) => doc(col('alerts'), id)
  const savedRef = (recallNumber: string) => doc(col('savedRecalls'), recallNumber)

  const set = <T extends object>(key: string, ref: DocumentReference, data: T): Write => ({
    key,
    apply: (batch) => batch.set(ref, data),
  })
  const scanWrite = (scan: StoredScan) => set(`scan:${productKey(scan)}`, scanRef(productKey(scan)), forStorage.scan(scan))
  const alertWrite = (a: Alert) => set(`alert:${a.id}`, alertRef(a.id), forStorage.alert(a))
  const savedWrite = (s: SavedRecall) => set(`saved:${s.recallNumber}`, savedRef(s.recallNumber), forStorage.saved(s))

  /** The documents that exist among these refs. */
  const readMany = async <T>(refs: DocumentReference[]): Promise<T[]> =>
    (await Promise.all(refs.map((ref) => getDoc(ref)))).filter((snap) => snap.exists()).map((snap) => snap.data() as T)

  const readSaved = async () =>
    (await getDocs(query(col('savedRecalls'), orderBy('savedAt', 'desc')))).docs.map((d) => d.data() as SavedRecall)
  const readScans = async () =>
    (await getDocs(query(col('scans'), orderBy('createdAt', 'desc'), limit(MAX_ACCOUNT_SCANS)))).docs.map(
      (d) => d.data() as StoredScan,
    )
  const readAlerts = async () =>
    (await getDocs(query(col('alerts'), orderBy('createdAt', 'desc')))).docs.map((d) => d.data() as Alert)
  const readLastCheck = async () => {
    const snap = await getDoc(profileRef)
    return (snap.data()?.lastWatchCheckAt as string | undefined) ?? null
  }
  const setLastCheck = (at: string) => setDoc(profileRef, { lastWatchCheckAt: at, updatedAt: now() }, { merge: true })

  /**
   * New and upgraded alerts (mergeAlerts) as writes, reading only the alerts concerned. If another writer
   * (a second tab, a scan during a re-check) creates one of them in between, the write is refused as an
   * update; one retry re-reads and settles it.
   */
  async function saveAlerts(candidates: Alert[], extra: Write[] = []): Promise<Alert[]> {
    for (let attempt = 0; ; attempt++) {
      const ids = [...new Set(candidates.map((a) => a.id))]
      const { fresh } = mergeAlerts(await readMany<Alert>(ids.map(alertRef)), candidates)
      try {
        await commitOrThrow(db, [...extra, ...fresh.map(alertWrite)])
        return fresh
      } catch (err) {
        if (attempt > 0 || firebaseErrorCode(err) !== 'permission-denied') throw err
      }
    }
  }

  const recheckStore: RecheckStore = {
    products: async () => productsFromScans(await readScans()),
    lastCheck: readLastCheck,
    // A failed write rejects, so the last check stays where it was and the next check finds them again
    addAlerts: async (candidates) => ({
      fresh: candidates.length === 0 ? [] : await saveAlerts(candidates),
      saved: true,
    }),
    setLastCheck,
  }

  const saved: SavedService = {
    list: () => withApiErrors(readSaved),
    toggle: (recall) =>
      withApiErrors(async () => {
        const ref = savedRef(recall.recallNumber)
        if ((await getDoc(ref)).exists()) {
          await deleteDoc(ref)
          return false
        }
        await setDoc(ref, forStorage.saved({ recallNumber: recall.recallNumber, savedAt: now(), recall }))
        return true
      }),
  }

  const history: HistoryService = {
    listScans: (type) => withApiErrors(async () => (await readScans()).filter((s) => s.type === type)),
    listProducts: () =>
      withApiErrors(async () => {
        const [scans, alerts] = await Promise.all([readScans(), readAlerts()])
        return withAlertStatus(productsFromScans(scans), alerts)
      }),
    deleteProduct: (id) =>
      withApiErrors(async () => {
        const alerts = await getDocs(query(col('alerts'), where('itemId', '==', id)))
        await commitAll(db, [
          { key: id, apply: (batch) => batch.delete(scanRef(id)) },
          ...alerts.docs.map((d) => ({ key: d.id, apply: (batch: WriteBatch) => batch.delete(d.ref) })),
        ])
      }),
  }

  const alerts: AlertsService = {
    list: () => withApiErrors(readAlerts),
    dismiss: (id) => withApiErrors(() => updateDoc(alertRef(id), { dismissed: true })),
    lastCheck: () => withApiErrors(readLastCheck),
    recheck: () => withApiErrors(() => recheckWith(recheckStore, checkWatchlist)),
  }

  return {
    uid,
    saved,
    history,
    alerts,

    /**
     * Saves a barcode scan over the product's earlier scan, with an alert for each recall it matched, in one
     * batch (a product never shows "confirmed" without its alert).
     */
    saveScan: (scan: Scan) =>
      withApiErrors(async () => {
        const existing = await getDoc(scanRef(productKey(scan)))
        const stored = replaceScan(existing.exists() ? (existing.data() as StoredScan) : undefined, scan)
        await saveAlerts(alertsFromScan(scan), [scanWrite(stored)])
      }),

    /** A scan by id, or the newer scan of the same product that replaced it. */
    getScan: (id: string) =>
      withApiErrors(async () => {
        for (const match of [where('id', '==', id), where('previousIds', 'array-contains', id)]) {
          const found = await getDocs(query(col('scans'), match, limit(1)))
          if (!found.empty) return found.docs[0].data() as Scan
        }
        throw new ApiError('not_found', 'We couldn’t find that scan in your account.', 404)
      }),

    /**
     * What the account holds of the device's data (the same saved recalls, products and alerts), for merging
     * the device into it: a few hundred reads at most, however big the account is.
     */
    snapshotFor: async (device: UserDataSnapshot): Promise<UserDataSnapshot> => {
      // Products of the device's scans and of its alerts (an alert's product may be only in the account)
      const productKeys = [...new Set([...device.scans.map(productKey), ...device.alerts.map((a) => a.itemId)])]
      const [savedList, scans, alertList, lastCheck] = await Promise.all([
        readMany<SavedRecall>(device.saved.map((s) => savedRef(s.recallNumber))),
        readMany<StoredScan>(productKeys.map(scanRef)),
        readMany<Alert>(device.alerts.map((a) => alertRef(a.id))),
        readLastCheck(),
      ])
      return { saved: savedList, scans, alerts: alertList, lastCheck }
    },

    /**
     * Writes a merge plan (see planDeviceMerge). Documents the rules refuse are skipped and reported, so one
     * bad document can't block the rest; returns their keys ("scan:<productKey>", "alert:<id>",
     * "saved:<recallNumber>").
     */
    write: async (plan: MergePlan): Promise<Set<string>> => {
      const failed = await commitAll(db, [...plan.saved.map(savedWrite), ...plan.scans.map(scanWrite)])
      // An alert waits for its product: if the product's scan was refused, both stay on the device
      const alertWrites = plan.alerts.map((a) =>
        failed.has(`scan:${a.itemId}`) ? null : alertWrite(a),
      )
      for (const [i, a] of plan.alerts.entries()) if (!alertWrites[i]) failed.add(`alert:${a.id}`)
      for (const key of await commitAll(db, alertWrites.filter((w): w is Write => w !== null))) failed.add(key)
      if (plan.lastCheck) await setLastCheck(plan.lastCheck)
      return failed
    },

    /** Deletes every saved recall, scan and alert (not the profile), page by page until none are left. */
    deleteAll: async () => {
      for (const name of SUBCOLLECTIONS) {
        for (;;) {
          const page = await getDocs(query(col(name), limit(BATCH_SIZE)))
          if (page.empty) break
          await commitOrThrow(
            db,
            page.docs.map((d) => ({ key: d.id, apply: (batch: WriteBatch) => batch.delete(d.ref) })),
          )
        }
      }
    },
  }
}

export type AccountData = ReturnType<typeof accountData>

/** The signed-in user's data, or null for a guest. */
export async function accountStore(): Promise<AccountData | null> {
  const uid = await signedInUid()
  if (!uid) return null
  const { db } = await getFirebase()
  return accountData(db, uid)
}
