// The guest on this device (signed out, or accounts off). Kept apart from src/services/firebase/auth.ts so the
// main bundle can use it without loading Firebase.
import type { UserProfile } from '@/types'
import { devicePrefs } from './local/alerts'

/** The uid of the guest on this device. */
export const GUEST_UID = 'device'

export function guestProfile(): UserProfile {
  return { uid: GUEST_UID, isGuest: true, createdAt: new Date().toISOString(), prefs: devicePrefs() }
}
