// Mock auth: any email/password signs in (password "wrong" fails, to demo the error state).
// A first sign-in with a new email creates a "returning user" with seeded history.
import type { UserProfile } from '@/types'
import { currentUserData, getDb, newUserData, updateDb, type MockDb, type UserData } from '@/mocks/db'
import { seedReturningUser } from '@/mocks/seed'
import { simulate } from '@/mocks/simulate'
import { ApiError } from '../errors'
import type { AuthService } from '../types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requireEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL.test(normalized)) throw new ApiError('invalid_request', 'Enter a valid email address.', 400)
  return normalized
}

const nameFromEmail = (email: string) =>
  email.split('@')[0].split(/[._-]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

/** Drop the current guest if it never did anything, so abandoned guests don't pile up. */
function discardEmptyGuest(db: MockDb) {
  const current = db.currentUid ? db.users[db.currentUid] : undefined
  if (current?.profile.isGuest && current.scans.length === 0 && current.saved.length === 0) delete db.users[current.profile.uid]
}

function switchTo(db: MockDb, user: UserData): UserProfile {
  discardEmptyGuest(db)
  db.users[user.profile.uid] = user
  db.currentUid = user.profile.uid
  return user.profile
}

function startGuest(): UserProfile {
  return updateDb((db) => switchTo(db, newUserData({ isGuest: true })))
}

/** Existing account → switch to it. Otherwise upgrade the guest (keeps history), or create a seeded demo user. */
function signInAs(email: string, displayName: string, { seedIfNew }: { seedIfNew: boolean }): UserProfile {
  const current = currentUserData()
  return updateDb((db) => {
    const existing = db.accounts[email]
    if (existing && db.users[existing]) return switchTo(db, db.users[existing])

    if (!seedIfNew && current.profile.isGuest) {
      current.profile = { ...current.profile, isGuest: false, email, displayName }
      db.accounts[email] = current.profile.uid
      return current.profile
    }

    const user = newUserData({ isGuest: false, email, displayName })
    if (seedIfNew) Object.assign(user, seedReturningUser(db.lateRevealed))
    db.accounts[email] = user.profile.uid
    return switchTo(db, user)
  })
}

export const mockAuth: AuthService = {
  current: () => simulate('auth', () => currentUserData().profile),

  continueAsGuest: () =>
    simulate('auth', () => {
      const current = currentUserData()
      return current.profile.isGuest ? current.profile : startGuest()
    }),

  signIn: (email, password) =>
    simulate('auth', () => {
      const normalized = requireEmail(email)
      if (!password || password === 'wrong') throw new ApiError('unauthenticated', 'Incorrect email or password.', 401)
      return signInAs(normalized, nameFromEmail(normalized), { seedIfNew: true })
    }),

  signUp: ({ name, email, password }) =>
    simulate('auth', () => {
      const normalized = requireEmail(email)
      if (password.length < 6) throw new ApiError('invalid_request', 'Use at least 6 characters for your password.', 400)
      if (getDb().accounts[normalized]) {
        throw new ApiError('invalid_request', 'An account with this email already exists. Log in instead.', 400)
      }
      return signInAs(normalized, name.trim() || nameFromEmail(normalized), { seedIfNew: false })
    }),

  signInWithApple: () => simulate('auth', () => signInAs('apple.user@privaterelay.example', 'Apple User', { seedIfNew: false })),

  signInWithGoogle: () => simulate('auth', () => signInAs('google.user@example.com', 'Google User', { seedIfNew: false })),

  resetPassword: (email) =>
    simulate('auth', () => {
      requireEmail(email)
    }),

  updatePrefs: (prefs) =>
    simulate('write', () => {
      const user = currentUserData()
      return updateDb(() => {
        user.profile = { ...user.profile, prefs: { ...user.profile.prefs, ...prefs } }
        return user.profile
      })
    }),

  signOut: () => simulate('auth', startGuest),

  deleteAccount: () =>
    simulate('auth', () => {
      const uid = currentUserData().profile.uid
      updateDb((db) => {
        delete db.users[uid]
        for (const [email, owner] of Object.entries(db.accounts)) if (owner === uid) delete db.accounts[email]
        db.currentUid = null
      })
      return startGuest()
    }),
}
