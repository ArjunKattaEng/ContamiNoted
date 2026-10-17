// Service interfaces. Screens and hooks depend only on these; `src/services/index.ts`
// wires the implementations (HTTP backend, plus on-device saved recalls). Endpoint contracts: docs/api-contract.md.
import type {
  Alert,
  DataSourceStatus,
  Page,
  Recall,
  RecallRef,
  RecallSummary,
  RecallTab,
  RecheckResult,
  SavedRecall,
  Scan,
  ScanType,
  UserPrefs,
  UserProfile,
  WatchItem,
} from '@/types'

export interface PageParams {
  page?: number
  pageSize?: number
}

export interface RecallsService {
  /**
   * Latest recalls, newest report date first. Summaries (short only) are included when already cached.
   * `days` limits to the last N days: by report date for active, by closing date for resolved.
   */
  listRecent(params: { status: RecallTab; days?: number } & PageParams): Promise<Page<Recall>>
  /** `days` limits to recalls reported in the last N days. */
  search(q: string, params?: { days?: number } & PageParams): Promise<Page<Recall>>
  /** One recall, returned as soon as the FDA data is in (summary only if already cached). Throws ApiError `not_found`. */
  get(recallNumber: string): Promise<Recall>
  /** Short summaries for up to 25 recalls (recalls without one are absent from the map). */
  summaries(recallNumbers: string[]): Promise<Record<string, RecallSummary>>
  /** Full sectioned summary, or null when summaries are unavailable (the UI shows the FDA text). */
  summary(recallNumber: string): Promise<RecallSummary | null>
}

export interface ScanService {
  /** Throws ApiError `invalid_barcode` for a bad check digit. */
  scanBarcode(code: string): Promise<Scan>
  /** Throws ApiError `image_too_large` / `receipt_unreadable`. */
  scanReceipt(image: Blob, options?: { purchaseDate?: string }): Promise<Scan>
  getScan(id: string): Promise<Scan>
  /**
   * Correct an item's name (e.g. an unreadable receipt line) and re-check it against recalls.
   * Returns the updated scan; the item's watchlist entry and alerts are updated too.
   */
  updateItem(scanId: string, itemId: string, name: string): Promise<Scan>
}

export interface HistoryService {
  listScans(type: ScanType): Promise<Scan[]>
  listProducts(): Promise<WatchItem[]>
  deleteProduct(id: string): Promise<void>
}

export interface AlertsService {
  list(): Promise<Alert[]>
  dismiss(id: string): Promise<void>
  /** Match saved items against recalls reported since the last check. */
  recheck(): Promise<RecheckResult>
  /** When saved items were last re-checked (ISO timestamp), or null if never. */
  lastCheck(): Promise<string | null>
}

export interface SavedService {
  list(): Promise<SavedRecall[]>
  /** Returns the new saved state. */
  toggle(recall: RecallRef): Promise<boolean>
}

export interface SignUpInput {
  name: string
  email: string
  password: string
}

export interface AuthService {
  /** The signed-in user, or the guest on this device when signed out (never rejects for a guest). */
  current(): Promise<UserProfile>
  /** Signs out if needed; returns the guest on this device. */
  continueAsGuest(): Promise<UserProfile>
  /** Signing in or up merges this device's guest data (scans, saved recalls, alerts) into the account. */
  signIn(email: string, password: string): Promise<UserProfile>
  signUp(input: SignUpInput): Promise<UserProfile>
  signInWithApple(): Promise<UserProfile>
  signInWithGoogle(): Promise<UserProfile>
  /** Resolves whether or not the email has an account (no account enumeration). */
  resetPassword(email: string): Promise<void>
  /** `uid` is the user the screen shows; the call fails if someone else is signed in now (another tab). */
  updatePrefs(prefs: Partial<UserPrefs>, uid: string): Promise<UserProfile>
  /** Signs out; returns the guest on this device. */
  signOut(): Promise<UserProfile>
  /**
   * Deletes the account and its data (or, for a guest, the data on this device). Firebase needs a recent
   * sign-in: password users pass their password, Google users confirm in a popup. Throws ApiError
   * `requires_recent_login` when neither is possible. `uid` is the user the screen shows: the call fails
   * if someone else is signed in now (another tab), so it never deletes an account the screen didn't show.
   */
  deleteAccount(confirm: { uid: string; password?: string }): Promise<UserProfile>
  /** Calls `listener` with the uid (GUEST_UID when signed out) whenever sign-in changes, also in other tabs. */
  onChange(listener: (uid: string) => void): () => void
}

export interface MetaService {
  dataSourceStatus(): Promise<DataSourceStatus>
}

export interface Services {
  recalls: RecallsService
  scan: ScanService
  history: HistoryService
  alerts: AlertsService
  saved: SavedService
  auth: AuthService
  meta: MetaService
}
