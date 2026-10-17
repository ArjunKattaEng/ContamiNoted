// The only import point for data access. Recalls and barcode checks come from the real backend (api/).
// The user's own data (saved recalls, scan history, alerts) lives on this device for a guest, and in their
// Firestore account when signed in (accounts only: features.accounts). Services for features that are still
// "Coming soon" (src/lib/features.ts) are HTTP placeholders that throw NotImplementedError; hooks keep them
// disabled until the feature flag is on.
import { httpServices } from './http'
import { httpScan } from './http/scan'
import { ApiError } from './errors'
import { GUEST_UID, guestProfile } from './guest'
import { localSaved } from './local/saved'
import { getLocalScan } from './local/scans'
import { localAlerts, localHistory, saveScanWithAlerts } from './local/watch'
import { features } from '@/lib/features'
import { withTimeout } from '@/lib/timeout'
import type { AlertsService, AuthService, HistoryService, SavedService, ScanService, Services } from './types'
import type { Scan } from '@/types'

/** Where the user's own data lives: this device (a guest) or their account. */
interface UserStore {
  saved: SavedService
  history: HistoryService
  alerts: AlertsService
  saveScan(scan: Scan): Promise<void>
  getScan(id: string): Promise<Scan>
}

const deviceStore: UserStore = {
  saved: localSaved,
  history: localHistory,
  alerts: localAlerts,
  saveScan: async (scan) => saveScanWithAlerts(scan),
  getScan: async (id) => getLocalScan(id),
}

/** The uid of the user the screens show (set by the hooks; null until known). */
let shownUid: string | null = null
export function setShownUser(uid: string | null): void {
  shownUid = uid
}

/** Longest wait for Firebase to say who is signed in before using the device. */
const STORE_TIMEOUT_MS = 10_000

/**
 * The signed-in account's store (Firestore, downloaded on first use), or the device's for a guest. Follows
 * the user the screens show: a screen showing the guest uses the device even if another tab signed in
 * (the next start merges it), and a screen showing an account that has since signed out gets an error
 * rather than another account's or the device's data. If Firebase can't load or answer (offline, a failed
 * chunk, a hang), data goes to the device and moves into the account on the next start.
 */
async function userStore({ deviceIfUnreachable = false } = {}): Promise<UserStore> {
  if (!features.accounts || shownUid === GUEST_UID) return deviceStore
  let account: Awaited<ReturnType<typeof import('./firebase/data').accountStore>>
  try {
    account = await withTimeout(
      import('./firebase/data').then((m) => m.accountStore()),
      STORE_TIMEOUT_MS,
      'Opening the account',
    )
  } catch (err) {
    // Reading the device instead would show a signed-in user empty lists (and lose their changes)
    if (!deviceIfUnreachable && shownUid !== null) {
      throw new ApiError('upstream_error', 'Couldn’t reach your account. Check your connection, then try again.', 0)
    }
    console.warn('Account data unavailable; using this device for now', err)
    return deviceStore
  }
  if (shownUid !== null && (account?.uid ?? GUEST_UID) !== shownUid) {
    throw new ApiError('invalid_request', 'You signed in or out in another window. Reload this page.', 0)
  }
  return account ?? deviceStore
}

const saved: SavedService = {
  list: async () => (await userStore()).saved.list(),
  toggle: async (recall) => (await userStore()).saved.toggle(recall),
}

const history: HistoryService = {
  listScans: async (type) => (await userStore()).history.listScans(type),
  listProducts: async () => (await userStore()).history.listProducts(),
  deleteProduct: async (id) => (await userStore()).history.deleteProduct(id),
}

const alerts: AlertsService = {
  list: async () => (await userStore()).alerts.list(),
  dismiss: async (id) => (await userStore()).alerts.dismiss(id),
  recheck: async () => (await userStore()).alerts.recheck(),
  lastCheck: async () => (await userStore()).alerts.lastCheck(),
}

const scan: ScanService = {
  ...httpScan,
  scanBarcode: async (code) => {
    const result = await httpScan.scanBarcode(code)
    let store: UserStore
    try {
      store = await userStore({ deviceIfUnreachable: true })
    } catch (err) {
      // Someone else signed in or out in another window: don't save it anywhere they'd find it
      console.warn('Scan not saved', err)
      return result
    }
    try {
      await store.saveScan(result)
    } catch (err) {
      // The check itself worked: keep it on the device (merged into the account on the next start)
      console.warn('Couldn’t save the scan in the account; saved on this device', err)
      await deviceStore.saveScan(result)
    }
    return result
  },
  getScan: async (id) => (await userStore()).getScan(id),
}

/** Firebase Auth, downloaded on first use (accounts only). */
const loadAuth = () => import('./firebase/auth').then((m) => m.firebaseAuth)
/** Longest wait for Firebase at start-up (e.g. storage that never opens in an app web view). */
const START_TIMEOUT_MS = 10_000
const lazyAuth: AuthService = {
  // If Firebase can't load or answer (offline, a failed chunk, a hang), the app still works as the guest on
  // this device; a later sign-in change (onChange) brings the account back
  current: () =>
    withTimeout(
      loadAuth().then((a) => a.current()),
      START_TIMEOUT_MS,
      'Loading the account',
    ).catch((err) => {
      console.warn('Accounts unavailable; continuing as a guest', err)
      return guestProfile()
    }),
  onChange: (listener) => {
    let unsubscribe: (() => void) | null = null
    let stopped = false
    loadAuth()
      .then((a) => {
        if (!stopped) unsubscribe = a.onChange(listener)
      })
      .catch(() => {})
    return () => {
      stopped = true
      unsubscribe?.()
    }
  },
  continueAsGuest: () => loadAuth().then((a) => a.continueAsGuest()),
  signIn: (email, password) => loadAuth().then((a) => a.signIn(email, password)),
  signUp: (input) => loadAuth().then((a) => a.signUp(input)),
  signInWithApple: () => loadAuth().then((a) => a.signInWithApple()),
  signInWithGoogle: () => loadAuth().then((a) => a.signInWithGoogle()),
  resetPassword: (email) => loadAuth().then((a) => a.resetPassword(email)),
  updatePrefs: (prefs, uid) => loadAuth().then((a) => a.updatePrefs(prefs, uid)),
  signOut: () => loadAuth().then((a) => a.signOut()),
  deleteAccount: (confirm) => loadAuth().then((a) => a.deleteAccount(confirm)),
}

export const services: Services = {
  ...httpServices,
  auth: features.accounts ? lazyAuth : httpServices.auth,
  scan,
  history,
  alerts,
  saved,
}

export * from './types'
export * from './errors'
