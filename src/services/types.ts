// Service interfaces. Screens and hooks depend only on these; `src/services/index.ts`
// picks the mock or HTTP implementation. Endpoint contracts: docs/api-contract.md.
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
  /** Latest recalls, newest report date first. Summaries (short only) are included when already cached. */
  listRecent(params: { status: RecallTab } & PageParams): Promise<Page<Recall>>
  search(q: string, params?: PageParams): Promise<Page<Recall>>
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
  /** Current user; starts a guest session if there is none. */
  current(): Promise<UserProfile>
  continueAsGuest(): Promise<UserProfile>
  signIn(email: string, password: string): Promise<UserProfile>
  /** Upgrades a guest in place, so their history is kept. */
  signUp(input: SignUpInput): Promise<UserProfile>
  signInWithApple(): Promise<UserProfile>
  signInWithGoogle(): Promise<UserProfile>
  resetPassword(email: string): Promise<void>
  updatePrefs(prefs: Partial<UserPrefs>): Promise<UserProfile>
  /** Signs out and starts a fresh guest session. */
  signOut(): Promise<UserProfile>
  /** Deletes the account and its data, then starts a fresh guest session. */
  deleteAccount(): Promise<UserProfile>
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
