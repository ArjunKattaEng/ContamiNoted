// Firebase errors → contract ApiErrors with messages people can act on. Kept free of Firebase imports so it
// can be unit-tested and loaded without the SDK.
import { ApiError } from '../errors'

const messages: Record<string, [ApiError['code'], string]> = {
  'auth/invalid-credential': ['unauthenticated', 'That email and password don’t match. Try again or reset your password.'],
  'auth/invalid-login-credentials': ['unauthenticated', 'That email and password don’t match. Try again or reset your password.'],
  'auth/wrong-password': ['unauthenticated', 'That email and password don’t match. Try again or reset your password.'],
  'auth/user-not-found': ['unauthenticated', 'That email and password don’t match. Try again or reset your password.'],
  'auth/user-disabled': ['unauthenticated', 'This account has been turned off.'],
  'auth/email-already-in-use': ['invalid_request', 'There’s already an account with that email. Log in instead.'],
  'auth/account-exists-with-different-credential': [
    'invalid_request',
    'There’s already an account with that email. Log in with your email and password.',
  ],
  'auth/credential-already-in-use': ['invalid_request', 'That Google account is already used by another account.'],
  'auth/weak-password': ['invalid_request', 'Use a stronger password, with at least 6 characters.'],
  'auth/invalid-email': ['invalid_request', 'Enter a valid email address.'],
  'auth/missing-password': ['invalid_request', 'Enter your password.'],
  'auth/too-many-requests': ['quota_exceeded', 'Too many attempts. Wait a few minutes, then try again.'],
  'auth/network-request-failed': ['upstream_error', 'Couldn’t reach the sign-in service. Check your connection.'],
  'auth/popup-blocked': [
    'popup_blocked',
    'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.',
  ],
  'auth/popup-closed-by-user': ['cancelled', 'Sign-in was cancelled.'],
  'auth/cancelled-popup-request': ['cancelled', 'Sign-in was cancelled.'],
  'auth/user-cancelled': ['cancelled', 'Sign-in was cancelled.'],
  'auth/user-mismatch': [
    'invalid_request',
    'That’s a different Google account. Choose the Google account you’re logged in with.',
  ],
  'auth/requires-recent-login': ['requires_recent_login', 'For your security, log in again, then try once more.'],
  'auth/operation-not-allowed': ['not_implemented', 'This way of signing in isn’t turned on yet.'],
  'auth/unauthorized-domain': ['not_implemented', 'Google sign-in isn’t set up for this website yet.'],
  'auth/operation-not-supported-in-this-environment': ['not_implemented', 'Google sign-in isn’t available in this app yet.'],
  'permission-denied': ['unauthenticated', 'Your account couldn’t be read. Log out, then log in again.'],
  unavailable: ['upstream_error', 'Couldn’t reach your account’s data. Check your connection.'],
  // Firestore Lite reports a failed network request as "unknown"
  unknown: ['upstream_error', 'Couldn’t reach your account’s data. Check your connection.'],
}

const fallback = 'Something went wrong with your account. Please try again.'

/** The Firebase error code ("auth/…" or a Firestore code), if any. */
export function firebaseErrorCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

/** Any error from Firebase as an ApiError (ApiErrors pass through unchanged). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const code = firebaseErrorCode(err)
  const [apiCode, message] = (code && messages[code]) || ['upstream_error', fallback]
  return new ApiError(apiCode, message, 0)
}

/** Runs a Firebase call, turning its errors into ApiErrors. */
export async function withApiErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    throw toApiError(err)
  }
}
