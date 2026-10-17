// localStorage access that never throws (private mode, blocked storage, tests without a DOM).

export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Returns whether the value was stored (false when storage is full or unavailable). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    if (!globalThis.localStorage) return false
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Storage full or unavailable: callers keep working from memory for this session.
    return false
  }
}

/**
 * Whether there is a localStorage at all (false in tests without a DOM, or when blocked and access throws).
 * A full quota still counts as available: no write is attempted here.
 */
export function storageAvailable(): boolean {
  try {
    const storage = globalThis.localStorage
    if (!storage) return false
    storage.getItem('rg-onboarded-v1')
    return true
  } catch {
    return false
  }
}

const ONBOARDED_KEY = 'rg-onboarded-v1'

/** Whether the first-launch walkthrough has been completed or skipped. */
export const hasOnboarded = () => readJson<boolean>(ONBOARDED_KEY) === true
export const markOnboarded = () => writeJson(ONBOARDED_KEY, true)

/** localStorage keys left behind by the removed demo mode (mock accounts, scans, settings). */
const RETIRED_KEYS = ['rg-mock-db-v1', 'rg-mock-config-v1']

/** Delete data from the removed demo mode, so no fictional accounts or scans linger in the browser. */
export function removeRetiredData(): void {
  for (const key of RETIRED_KEYS) {
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      // Storage unavailable: nothing to clean up
    }
  }
}
