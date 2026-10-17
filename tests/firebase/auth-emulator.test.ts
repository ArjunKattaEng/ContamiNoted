// Firebase Auth against the Auth emulator only (no Java needed): `npm run test:auth`.
// Checks that the error codes the real SDK raises map to the messages the screens show.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getFirebase } from '@/lib/firebase'
import { firebaseAuth, GUEST_UID } from '@/services/firebase/auth'
import { toApiError } from '@/services/firebase/errors'
import { clearEmulators, newEmail, PASSWORD } from './helpers'

const attempt = async (run: () => Promise<unknown>) => {
  try {
    await run()
  } catch (err) {
    return toApiError(err)
  }
  throw new Error('expected the call to fail')
}

describe('Firebase Auth (emulator)', () => {
  beforeAll(clearEmulators)
  afterEach(async () => {
    const { auth } = await getFirebase()
    await signOut(auth)
  })

  it('signs up and signs back in with email and password', async () => {
    const { auth } = await getFirebase()
    const email = newEmail()
    const created = await createUserWithEmailAndPassword(auth, email, PASSWORD)
    await signOut(auth)
    const signedIn = await signInWithEmailAndPassword(auth, email, PASSWORD)
    expect(signedIn.user.uid).toBe(created.user.uid)
  })

  it('maps the real error codes to the messages on the screens', async () => {
    const { auth } = await getFirebase()
    const email = newEmail()
    await createUserWithEmailAndPassword(auth, email, PASSWORD)
    await signOut(auth)

    const duplicate = await attempt(() => createUserWithEmailAndPassword(auth, email, PASSWORD))
    expect(duplicate.message).toMatch(/already an account/)
    const wrong = await attempt(() => signInWithEmailAndPassword(auth, email, 'wrong-password-1'))
    expect(wrong.code).toBe('unauthenticated')
    const unknown = await attempt(() => signInWithEmailAndPassword(auth, newEmail(), PASSWORD))
    expect(unknown.message).toBe(wrong.message) // doesn't reveal whether the email has an account
    const weak = await attempt(() => createUserWithEmailAndPassword(auth, newEmail(), '123'))
    expect(weak.message).toMatch(/at least 6 characters/)
    const badEmail = await attempt(() => createUserWithEmailAndPassword(auth, 'not-an-email', PASSWORD))
    expect(badEmail.message).toMatch(/valid email/)
  })

  it('sends a password reset whether or not the account exists', async () => {
    const { auth } = await getFirebase()
    const email = newEmail()
    await createUserWithEmailAndPassword(auth, email, PASSWORD)
    await signOut(auth)
    await expect(firebaseAuth.resetPassword(email)).resolves.toBeUndefined()
    await expect(firebaseAuth.resetPassword(newEmail())).resolves.toBeUndefined()
  })

  it('signing out leaves a guest on this device', async () => {
    const { auth } = await getFirebase()
    await createUserWithEmailAndPassword(auth, newEmail(), PASSWORD)
    const guest = await firebaseAuth.signOut()
    expect(guest).toMatchObject({ uid: GUEST_UID, isGuest: true })
    expect(auth.currentUser).toBeNull()
  })
})
