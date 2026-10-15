// In-memory mock backend state, persisted to localStorage so history survives reloads.
// Mirrors the planned Firestore layout: one record per user (users/{uid} + subcollections).
import type { Alert, SavedRecall, Scan, UserProfile, WatchItem } from '@/types'
import { newId } from './scanBuilder'
import { readJson, writeJson } from '@/lib/storage'

export interface UserData {
  profile: UserProfile
  scans: Scan[]
  items: WatchItem[]
  alerts: Alert[]
  saved: SavedRecall[]
  lastWatchCheckAt?: string
}

export interface MockDb {
  /** Bump when the stored shape changes; older data is discarded. */
  version: 2
  currentUid: string | null
  users: Record<string, UserData>
  /** email → uid for signed-up / signed-in accounts */
  accounts: Record<string, string>
  /** The late recall becomes visible after the first re-check that finds it. */
  lateRevealed: boolean
  /** Position in the A → B → C receipt cycle. */
  receiptCursor: number
}

const KEY = 'rg-mock-db-v1'

function emptyDb(): MockDb {
  return { version: 2, currentUid: null, users: {}, accounts: {}, lateRevealed: false, receiptCursor: 0 }
}

function load(): MockDb {
  const stored = readJson<MockDb>(KEY)
  return stored?.version === 2 ? stored : emptyDb()
}

let state = load()

export function getDb(): MockDb {
  return state
}

/** Apply a change and persist it. */
export function updateDb<T>(change: (db: MockDb) => T): T {
  const result = change(state)
  writeJson(KEY, state)
  return result
}

/** Wipe all mock data (Developer panel → Reset). */
export function resetDb(): void {
  state = emptyDb()
  writeJson(KEY, state)
}

export function newUserData(profile: Omit<UserProfile, 'uid' | 'createdAt' | 'prefs'> & Partial<Pick<UserProfile, 'prefs'>>): UserData {
  return {
    profile: {
      uid: newId('uid'),
      createdAt: new Date().toISOString(),
      prefs: { recheckOnOpen: true },
      ...profile,
    },
    scans: [],
    items: [],
    alerts: [],
    saved: [],
  }
}

/** Current user's data, starting a guest session if there is none. */
export function currentUserData(): UserData {
  const uid = state.currentUid
  if (uid && state.users[uid]) return state.users[uid]
  return updateDb((db) => {
    const guest = newUserData({ isGuest: true })
    db.users[guest.profile.uid] = guest
    db.currentUid = guest.profile.uid
    return guest
  })
}
