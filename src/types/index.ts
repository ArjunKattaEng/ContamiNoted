// Domain types shared by the service layer and the screens.
// They mirror docs/api-contract.md: keep the two in sync.

export type RecallStatus = 'Ongoing' | 'Completed' | 'Terminated'
export type Classification = 'Class I' | 'Class II' | 'Class III'

/** UI grouping of RecallStatus: active = Ongoing, resolved = Completed | Terminated. */
export type RecallTab = 'active' | 'resolved'

/**
 * confirmed: the item's UPC appears in the recall's text
 * possible:  brand/name overlap only; the user must verify lot/date
 * clear:     no recall found
 * error:     the item couldn't be read or checked
 */
export type MatchStatus = 'confirmed' | 'possible' | 'clear' | 'error'

export interface RecallSummarySections {
  overview: string
  productDetails: string
  reason: string
  healthRisks: string
  distribution: string
  actionRequired: string
  additionalInfo: string
  contact: string
}

export interface RecallSummary {
  /** One sentence, ~20–25 words. */
  shortSummary: string
  /** Markdown per section. Present on single-recall responses only. */
  sections?: RecallSummarySections
  generatedAt: string
  model: string
}

export interface Recall {
  /** openFDA recall_number, e.g. "F-0123-2026"; used as the id. */
  recallNumber: string
  eventId: string
  status: RecallStatus
  classification: Classification
  productDescription: string
  reasonForRecall: string
  recallingFirm: string
  city?: string
  state?: string
  distributionPattern?: string
  productQuantity?: string
  /** Lots / UPCs / best-by dates, free text. */
  codeInfo?: string
  /** YYYY-MM-DD */
  recallInitiationDate: string
  /** YYYY-MM-DD */
  reportDate: string
  voluntaryMandated?: string
  /** YYYY-MM-DD, when FDA closed the recall (Terminated recalls only) */
  terminationDate?: string
  summary: RecallSummary | null
}

/** Compact recall snapshot embedded in alerts and saved recalls. */
export type RecallRef = Pick<Recall, 'recallNumber' | 'productDescription' | 'classification' | 'status' | 'reportDate'> &
  Partial<Pick<Recall, 'terminationDate'>>

export interface Product {
  /** Normalized UPC-A (12 digits) where possible. */
  upc: string
  name: string
  brand?: string
  size?: string
  category?: string
  imageUrl?: string
  /** YYYY-MM-DD expiry date from Open Food Facts, when available. */
  expiryDate?: string
}

export interface ScanItem {
  id: string
  /** Receipt line as printed, e.g. "GV WHL MLK 1GAL". */
  raw?: string
  /** Normalized name, e.g. "Great Value Whole Milk, 1 gal". */
  name: string
  brand?: string
  upc?: string
  price?: number
  status: MatchStatus
  /** Empty unless confirmed/possible. */
  recallNumbers: string[]
  /** Short explanation for this item. */
  note?: string
}

export type ScanType = 'receipt' | 'barcode'

export interface ScanVerdict {
  headline: string
  /** Markdown */
  details: string
  nextSteps: string[]
}

export interface ScanCounts {
  total: number
  confirmed: number
  possible: number
  clear: number
  error: number
}

export interface Scan {
  id: string
  type: ScanType
  createdAt: string
  /** Receipt only */
  store?: string
  /** Receipt only, YYYY-MM-DD */
  purchaseDate?: string
  /** Receipt only */
  total?: number
  /** Barcode only */
  product?: Product
  /** Barcode scans have exactly one item. */
  items: ScanItem[]
  /** Recalls referenced by items, with summary.shortSummary. */
  matchedRecalls: Recall[]
  verdict: ScanVerdict | null
  counts: ScanCounts
}

/** A scanned product kept on the user's watchlist and re-checked for new recalls. */
export interface WatchItem {
  id: string
  scanId: string
  /** The ScanItem this was created from. */
  scanItemId: string
  source: ScanType
  /** Receipt store, for receipt items. */
  store?: string
  name: string
  brand?: string
  upc?: string
  size?: string
  /** Product photo (Open Food Facts), for barcode items. */
  imageUrl?: string
  /** YYYY-MM-DD */
  purchaseDate?: string
  createdAt: string
  status: MatchStatus
  recallNumbers: string[]
}

export interface Alert {
  /** `${recallNumber}_${itemId}` */
  id: string
  recallNumber: string
  itemId: string
  itemName: string
  /** Where the matched item came from, so two alerts for the same product can be told apart. */
  source: ScanType
  /** Receipt store, for receipt items. */
  store?: string
  confidence: 'confirmed' | 'possible'
  recall: RecallRef
  createdAt: string
  dismissed: boolean
}

export interface SavedRecall {
  recallNumber: string
  savedAt: string
  recall: RecallRef
}

/** POST /api/watchlist/check request (guest mode). */
export interface WatchCheckRequest {
  items: WatchCheckItem[]
  /** Last check (or oldest scan), YYYY-MM-DD */
  since?: string
}

/** One product sent to POST /api/watchlist/check (guest mode). */
export interface WatchCheckItem {
  id: string
  upc?: string
  name: string
  brand?: string
}

export interface WatchCheckMatch {
  itemId: string
  recallNumber: string
  confidence: 'confirmed' | 'possible'
  recall: RecallRef
}

/** POST /api/watchlist/check (guest mode): matches between the sent products and recent recalls. */
export interface WatchCheckResult {
  checkedAt: string
  /** First report date checked, YYYY-MM-DD */
  since: string
  matches: WatchCheckMatch[]
}

export interface RecheckResult {
  checkedAt: string
  skipped: boolean
  newAlerts: Alert[]
}

export interface UserPrefs {
  recheckOnOpen: boolean
}

export interface UserProfile {
  uid: string
  isGuest: boolean
  displayName?: string
  email?: string
  /** How the account signs in (decides how deleting it is confirmed). Absent for guests. */
  signInMethod?: 'password' | 'google'
  createdAt: string
  prefs: UserPrefs
}

export interface DataSourceStatus {
  source: 'openFDA food enforcement'
  openFdaLastUpdated: string
  lastWatchCheckAt?: string
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}
