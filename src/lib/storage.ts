// localStorage access that never throws (private mode, blocked storage, tests without a DOM).

export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable: callers keep working from memory for this session.
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
