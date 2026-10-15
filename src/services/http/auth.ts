import type { AuthService } from '../types'
import { notImplemented } from './notImplemented'

// TODO(backend): Firebase Auth. Mapping per method: "Auth service → Firebase Auth" in docs/api-contract.md.
export const httpAuth: AuthService = {
  /** onAuthStateChanged + users/{uid} profile */
  current: () => notImplemented('Firebase Auth: current user'),
  /** signInAnonymously */
  continueAsGuest: () => notImplemented('Firebase Auth: signInAnonymously'),
  /** signInWithEmailAndPassword */
  signIn: () => notImplemented('Firebase Auth: signInWithEmailAndPassword'),
  /** linkWithCredential(EmailAuthProvider.credential) when guest, else createUserWithEmailAndPassword */
  signUp: () => notImplemented('Firebase Auth: link / createUserWithEmailAndPassword'),
  /** @capacitor-firebase/authentication on iOS, popup on web, then link to the guest */
  signInWithApple: () => notImplemented('Firebase Auth: Sign in with Apple'),
  signInWithGoogle: () => notImplemented('Firebase Auth: Google sign-in'),
  /** sendPasswordResetEmail */
  resetPassword: () => notImplemented('Firebase Auth: sendPasswordResetEmail'),
  /** update users/{uid} { prefs } */
  updatePrefs: () => notImplemented('Firestore update users/{uid}'),
  /** signOut, then signInAnonymously */
  signOut: () => notImplemented('Firebase Auth: signOut'),
  /** DELETE /api/account, then signInAnonymously */
  deleteAccount: () => notImplemented('DELETE /api/account'),
}
