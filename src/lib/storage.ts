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
    // Storage full or unavailable: the mock keeps working in memory for this session.
  }
}

const ONBOARDED_KEY = 'rg-onboarded-v1'

/** Whether the first-launch walkthrough has been completed or skipped. */
export const hasOnboarded = () => readJson<boolean>(ONBOARDED_KEY) === true
export const markOnboarded = () => writeJson(ONBOARDED_KEY, true)
