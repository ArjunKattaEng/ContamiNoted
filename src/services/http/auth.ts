import type { AuthService } from '../types'
import { notImplemented } from './notImplemented'

// Used only while accounts are off (features.accounts): hooks never call it then. With accounts on,
// src/services/index.ts uses the Firebase implementation in src/services/firebase/auth.ts.
export const httpAuth: AuthService = {
  current: () => notImplemented('accounts are off'),
  continueAsGuest: () => notImplemented('accounts are off'),
  signIn: () => notImplemented('accounts are off'),
  signUp: () => notImplemented('accounts are off'),
  signInWithApple: () => notImplemented('accounts are off'),
  signInWithGoogle: () => notImplemented('accounts are off'),
  resetPassword: () => notImplemented('accounts are off'),
  updatePrefs: () => notImplemented('accounts are off'),
  signOut: () => notImplemented('accounts are off'),
  deleteAccount: () => notImplemented('accounts are off'),
  onChange: () => () => {},
}
