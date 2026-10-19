// Firebase Auth behind the AuthService interface (src/services/types.ts). Loaded on demand (see
// src/services/index.ts), so the Firebase SDK stays out of the main bundle.
//
// Signed out, the app is a guest on this device, exactly as without accounts: no anonymous Firebase user.
// Signing in or up keeps a profile document at users/{uid} (prefs, last check) and merges the device's data
// into the account (src/services/firebase/account.ts).
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore/lite'
import { getFirebase } from '@/lib/firebase'
import { isNative } from '@/lib/native'
import { withTimeout } from '@/lib/timeout'
import type { UserPrefs, UserProfile } from '@/types'
import { ApiError, NotImplementedError } from '../errors'
import { GUEST_UID, guestProfile } from '../guest'
import { clearLocalAlerts, devicePrefs, setDevicePrefs } from '../local/alerts'
import { clearLocalSaved } from '../local/saved'
import { clearLocalScans } from '../local/scans'
import type { AuthService } from '../types'
import { afterSignIn, deleteAccountData } from './account'
import { firebaseErrorCode, toApiError, withApiErrors } from './errors'

export { GUEST_UID, guestProfile }

/** How long opening the account (profile and merge) may take at start-up before the app goes on without it. */
export const OPEN_TIMEOUT_MS = 8_000

/** users/{uid} in Firestore (see firestore.rules) */
export interface ProfileDoc {
  uid: string
  email: string | null
  displayName?: string
  createdAt: string
  updatedAt: string
  prefs: UserPrefs
  lastWatchCheckAt?: string
}

const now = () => new Date().toISOString()

type SignInMethod = UserProfile['signInMethod']

const asMethod = (providerId: string | null | undefined): SignInMethod =>
  providerId === 'password' ? 'password' : providerId === 'google.com' ? 'google' : undefined

/**
 * How this session signed in (an account can have both a password and Google linked; deleting it is
 * confirmed the way it signed in). Falls back to the linked providers if the token can't be read.
 */
async function signInMethod(user: User): Promise<SignInMethod> {
  try {
    const method = asMethod((await user.getIdTokenResult()).signInProvider)
    if (method) return method
  } catch {
    // offline: decide from the linked providers below
  }
  const providers = user.providerData.map((p) => p.providerId)
  return asMethod(providers.find((p) => p === 'password') ?? providers.find((p) => p === 'google.com'))
}

function toProfile(data: ProfileDoc, method: SignInMethod): UserProfile {
  return {
    uid: data.uid,
    isGuest: false,
    ...(data.displayName && { displayName: data.displayName }),
    ...(data.email && { email: data.email }),
    ...(method && { signInMethod: method }),
    createdAt: data.createdAt,
    prefs: {
      recheckOnOpen: data.prefs?.recheckOnOpen ?? true,
      ...(Array.isArray(data.prefs?.notifyCategories) && { notifyCategories: data.prefs.notifyCategories }),
    },
  }
}

/** A signed-in profile without its Firestore document (used when Firestore can't be reached). */
function fallbackProfile(user: User, method: SignInMethod): UserProfile {
  return {
    uid: user.uid,
    isGuest: false,
    ...(user.displayName && { displayName: user.displayName }),
    ...(user.email && { email: user.email }),
    ...(method && { signInMethod: method }),
    createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : now(),
    prefs: devicePrefs(),
  }
}

/** The signed-in user's profile document, created on first sign-in (with this device's preferences). */
async function ensureProfile(user: User): Promise<ProfileDoc> {
  const { db } = await getFirebase()
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as ProfileDoc
  // A session cached on this device for an account deleted elsewhere: this fails (user-not-found) rather
  // than recreating its profile
  await user.reload()
  const created = now()
  const profile: ProfileDoc = {
    uid: user.uid,
    email: user.email,
    ...(user.displayName && { displayName: user.displayName.slice(0, 100) }),
    createdAt: created,
    updatedAt: created,
    prefs: (() => {
      const d = devicePrefs()
      return {
        recheckOnOpen: d.recheckOnOpen !== false,
        ...(Array.isArray(d.notifyCategories) && d.notifyCategories.length > 0 && { notifyCategories: d.notifyCategories }),
      }
    })(),
  }
  try {
    await setDoc(ref, profile)
    return profile
  } catch (err) {
    // Another tab or call created it first (our write then counts as a disallowed update): use theirs
    const again = await getDoc(ref)
    if (again.exists()) return again.data() as ProfileDoc
    throw err
  }
}

/** Merges this device's guest data into the account. Never fails a sign-in: retried on the next start. */
async function mergeDeviceData(uid: string): Promise<void> {
  try {
    await afterSignIn(uid)
  } catch (err) {
    console.warn('Couldn’t move this device’s data into the account yet; will retry', err)
  }
}

/**
 * After a successful Firebase sign-in: the profile, then the merge. If the profile can't be read or created,
 * sign back out, so Firebase and the app agree that nobody is signed in.
 */
async function finishSignIn(user: User): Promise<UserProfile> {
  let profile: ProfileDoc
  try {
    profile = await ensureProfile(user)
  } catch (err) {
    const { auth } = await getFirebase()
    await firebaseSignOut(auth).catch(() => {})
    const { code } = toApiError(err)
    throw new ApiError(
      code,
      code === 'upstream_error'
        ? 'Your account couldn’t be opened. Check your connection, then log in again.'
        : 'Your account couldn’t be opened right now. Please log in again.',
      0,
    )
  }
  await mergeDeviceData(user.uid)
  return toProfile(profile, await signInMethod(user))
}

/** The Firebase codes for a session whose account no longer exists or was turned off. */
const GONE = ['auth/user-not-found', 'auth/user-token-expired', 'auth/user-disabled']

async function signedInUser(): Promise<User | null> {
  const { auth } = await getFirebase()
  await auth.authStateReady()
  return auth.currentUser
}

/** Everything a guest keeps on this device. */
function clearDeviceData() {
  clearLocalSaved()
  clearLocalScans()
  clearLocalAlerts()
}

const googleProvider = () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

/**
 * Firebase needs a recent sign-in to delete an account, so confirm it before anything is deleted: password
 * users type their password, Google users pick their account again (always, rather than trusting this
 * device's clock to judge "recent").
 */
async function confirmRecentSignIn(user: User, password?: string): Promise<void> {
  const method = await signInMethod(user)
  if (method === 'password') {
    if (!password) throw new ApiError('requires_recent_login', 'Enter your password to delete your account.', 0)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password))
    } catch (err) {
      if (toApiError(err).code === 'unauthenticated') throw new ApiError('unauthenticated', 'That password isn’t right.', 0)
      throw err
    }
    return
  }
  if (method === 'google' && !isNative) {
    await reauthenticateWithPopup(user, googleProvider())
    return
  }
  throw new ApiError('requires_recent_login', 'For your security, log out, log in again, then delete your account.', 0)
}

/**
 * The screen acts for the user it shows. If another tab signed in or out since, refuse rather than act on
 * a different account (e.g. "Clear my data" deleting an account signed in elsewhere).
 */
async function assertShownUser(uid: string): Promise<User | null> {
  const user = await signedInUser()
  if ((user?.uid ?? GUEST_UID) !== uid) {
    throw new ApiError('invalid_request', 'You signed in or out in another window. Reload this page, then try again.', 0)
  }
  return user
}

export const firebaseAuth: AuthService = {
  current: async () => {
    const user = await signedInUser()
    if (!user) return guestProfile()
    const { auth } = await getFirebase()
    const method = await signInMethod(user)
    let profile: UserProfile
    try {
      const open = async () => {
        const data = await ensureProfile(user)
        await mergeDeviceData(user.uid)
        return toProfile(data, method)
      }
      profile = await withTimeout(open(), OPEN_TIMEOUT_MS, 'Opening the account')
    } catch (err) {
      if (GONE.includes(firebaseErrorCode(err) ?? '')) {
        // The account was deleted or turned off on another device
        await firebaseSignOut(auth).catch(() => {})
        return guestProfile()
      }
      // Still signed in; the profile and the merge are retried on the next start
      console.warn('Couldn’t read the account profile; using this device’s settings for now', err)
      profile = fallbackProfile(user, method)
    }
    // Someone signed in or out while this was loading: answer for whoever is signed in now
    return auth.currentUser?.uid === user.uid ? profile : firebaseAuth.current()
  },

  onChange: (listener) => {
    let unsubscribe: (() => void) | null = null
    let stopped = false
    void getFirebase().then(({ auth }) => {
      if (stopped) return
      unsubscribe = onAuthStateChanged(auth, (user) => listener(user?.uid ?? GUEST_UID))
    })
    return () => {
      stopped = true
      unsubscribe?.()
    }
  },

  continueAsGuest: async () => {
    const { auth } = await getFirebase()
    if (auth.currentUser) await withApiErrors(() => firebaseSignOut(auth))
    return guestProfile()
  },

  signIn: async (email, password) => {
    const { auth } = await getFirebase()
    const { user } = await withApiErrors(() => signInWithEmailAndPassword(auth, email.trim(), password))
    return finishSignIn(user)
  },

  signUp: async ({ name, email, password }) => {
    const { auth } = await getFirebase()
    const { user } = await withApiErrors(() => createUserWithEmailAndPassword(auth, email.trim(), password))
    await updateProfile(user, { displayName: name.trim() }).catch(() => {}) // the profile document has it too
    // A verified email keeps the password if the same address later signs in with Google (Firebase drops the
    // password of an unverified account then). Not required to use the app.
    void sendEmailVerification(user).catch(() => {})
    return finishSignIn(user)
  },

  signInWithGoogle: async () => {
    // Google blocks its sign-in page inside app web views; the iOS app needs a native plugin for this
    if (isNative) throw new ApiError('not_implemented', 'Google sign-in isn’t available in the iOS app yet.', 0)
    const { auth } = await getFirebase()
    // A popup, not a redirect: redirect sign-in breaks in browsers that block third-party storage for
    // apps hosted outside Firebase Hosting (https://firebase.google.com/docs/auth/web/redirect-best-practices)
    const { user } = await withApiErrors(() => signInWithPopup(auth, googleProvider()))
    return finishSignIn(user)
  },

  signInWithApple: () => Promise.reject(new NotImplementedError('Sign in with Apple')),

  resetPassword: (email) =>
    withApiErrors(async () => {
      const { auth } = await getFirebase()
      try {
        await sendPasswordResetEmail(auth, email.trim())
      } catch (err) {
        // Don't reveal whether an account exists: the screen says "if an account exists…"
        if (firebaseErrorCode(err) !== 'auth/user-not-found') throw err
      }
    }),

  updatePrefs: async (prefs, uid) => {
    const user = await assertShownUser(uid)
    if (!user) return { ...guestProfile(), prefs: setDevicePrefs(prefs) }
    return withApiErrors(async () => {
      const { db } = await getFirebase()
      const current = await ensureProfile(user)
      const merged = { ...current.prefs, ...prefs }
      const nextPrefs: UserPrefs = {
        recheckOnOpen: merged.recheckOnOpen !== false,
        ...(Array.isArray(merged.notifyCategories) && { notifyCategories: merged.notifyCategories }),
      }
      const next: ProfileDoc = { ...current, prefs: nextPrefs, updatedAt: now() }
      await setDoc(doc(db, 'users', user.uid), { prefs: next.prefs, updatedAt: next.updatedAt }, { merge: true })
      return toProfile(next, await signInMethod(user))
    })
  },

  signOut: async () => {
    const { auth } = await getFirebase()
    await withApiErrors(() => firebaseSignOut(auth))
    return guestProfile()
  },

  deleteAccount: async (confirm) => {
    const user = await assertShownUser(confirm.uid)
    if (!user) {
      clearDeviceData()
      return guestProfile()
    }
    await withApiErrors(async () => {
      // Before anything is deleted: Firebase refuses deleteUser() without a recent sign-in
      await confirmRecentSignIn(user, confirm.password)
      const { auth, db } = await getFirebase()
      await deleteAccountData(user.uid)
      await deleteDoc(doc(db, 'users', user.uid))
      await deleteUser(user)
      if (auth.currentUser) await firebaseSignOut(auth)
    })
    clearDeviceData()
    return guestProfile()
  },
}
