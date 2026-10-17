// The account service end to end against the Auth and Firestore emulators: `npm run test:firebase`.
import { GoogleAuthProvider, getAuth, signInWithCredential, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore/lite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFirebase } from '@/lib/firebase'
import { firebaseAuth, GUEST_UID } from '@/services/firebase/auth'
import { setDevicePrefs } from '@/services/local/alerts'
import { adminGetDoc, clearEmulators, newEmail, PASSWORD } from './helpers'

async function profileDoc(uid: string) {
  const { db } = await getFirebase()
  return (await getDoc(doc(db, 'users', uid))).data()
}

describe('accounts (emulators)', () => {
  beforeEach(clearEmulators)
  afterEach(async () => {
    const { app } = await getFirebase()
    await signOut(getAuth(app))
  })

  it('signing up creates the profile with the device’s preferences', async () => {
    setDevicePrefs({ recheckOnOpen: false }) // not the default, so copying it is visible
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Alice Doe', email, password: PASSWORD })
    setDevicePrefs({ recheckOnOpen: true })
    expect(user).toMatchObject({ isGuest: false, email, displayName: 'Alice Doe', signInMethod: 'password' })
    expect(user.prefs.recheckOnOpen).toBe(false)
    expect(await profileDoc(user.uid)).toMatchObject({ uid: user.uid, email, displayName: 'Alice Doe' })
    expect(await firebaseAuth.current()).toMatchObject({ uid: user.uid, isGuest: false })
  })

  it('signs out to a guest and back in to the same account', async () => {
    const email = newEmail()
    const created = await firebaseAuth.signUp({ name: 'Bo', email, password: PASSWORD })
    expect(await firebaseAuth.signOut()).toMatchObject({ uid: GUEST_UID, isGuest: true })
    expect((await firebaseAuth.current()).isGuest).toBe(true)
    const again = await firebaseAuth.signIn(email, PASSWORD)
    expect(again.uid).toBe(created.uid)
  })

  it('a wrong password is a friendly error', async () => {
    const email = newEmail()
    await firebaseAuth.signUp({ name: 'Cy', email, password: PASSWORD })
    await firebaseAuth.signOut()
    await expect(firebaseAuth.signIn(email, 'not-the-password')).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('saves preferences in the account, and they survive signing out and back in', async () => {
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Di', email, password: PASSWORD })
    const updated = await firebaseAuth.updatePrefs({ recheckOnOpen: false }, user.uid)
    expect(updated.prefs.recheckOnOpen).toBe(false)
    expect((await profileDoc(user.uid))?.prefs).toEqual({ recheckOnOpen: false })
    await firebaseAuth.signOut()
    expect((await firebaseAuth.signIn(email, PASSWORD)).prefs.recheckOnOpen).toBe(false)
  })

  it('a Google sign-in gets a profile too', async () => {
    const { auth } = await getFirebase()
    const email = newEmail()
    // The Auth emulator accepts a made-up Google ID token
    const credential = GoogleAuthProvider.credential(JSON.stringify({ sub: `g-${email}`, email, email_verified: true }))
    const { user } = await signInWithCredential(auth, credential)
    const profile = await firebaseAuth.current() // creates the profile, as after the popup
    expect(profile).toMatchObject({ uid: user.uid, isGuest: false, email, signInMethod: 'google' })
    expect(await adminGetDoc(`users/${user.uid}`)).not.toBeNull()
  })

  it('a guest’s preferences stay on the device', async () => {
    const guest = await firebaseAuth.updatePrefs({ recheckOnOpen: false }, GUEST_UID)
    expect(guest).toMatchObject({ isGuest: true, prefs: { recheckOnOpen: false } })
    expect((await firebaseAuth.current()).prefs.recheckOnOpen).toBe(false)
    await firebaseAuth.updatePrefs({ recheckOnOpen: true }, GUEST_UID)
  })

  it('a screen showing someone else (another tab signed in or out) can’t change or delete anything', async () => {
    const user = await firebaseAuth.signUp({ name: 'Gil', email: newEmail(), password: PASSWORD })
    // The screen still shows the guest: "Clear my data" must not delete the account
    await expect(firebaseAuth.deleteAccount({ uid: GUEST_UID })).rejects.toMatchObject({ code: 'invalid_request' })
    await expect(firebaseAuth.updatePrefs({ recheckOnOpen: false }, GUEST_UID)).rejects.toMatchObject({
      code: 'invalid_request',
    })
    expect(await adminGetDoc(`users/${user.uid}`)).not.toBeNull()
    await firebaseAuth.signOut()
    // The screen still shows the account, but it signed out elsewhere
    await expect(firebaseAuth.deleteAccount({ uid: user.uid, password: PASSWORD })).rejects.toMatchObject({
      code: 'invalid_request',
    })
  })

  it('reports sign-in changes', async () => {
    const seen: string[] = []
    const stop = firebaseAuth.onChange((uid) => seen.push(uid))
    const user = await firebaseAuth.signUp({ name: 'Hal', email: newEmail(), password: PASSWORD })
    await firebaseAuth.signOut()
    stop()
    expect(seen).toContain(user.uid)
    expect(seen.at(-1)).toBe(GUEST_UID)
  })

  it('deleting a password account needs the password, and nothing is deleted without it', async () => {
    const user = await firebaseAuth.signUp({ name: 'Fi', email: newEmail(), password: PASSWORD })
    await expect(firebaseAuth.deleteAccount({ uid: user.uid })).rejects.toMatchObject({ code: 'requires_recent_login' })
    await expect(firebaseAuth.deleteAccount({ uid: user.uid, password: 'wrong-password-1' })).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    expect(await adminGetDoc(`users/${user.uid}`)).not.toBeNull()
  })

  it('a Google account confirms in a popup before deleting, and nothing is deleted first', async () => {
    const { auth } = await getFirebase()
    const email = newEmail()
    const credential = GoogleAuthProvider.credential(JSON.stringify({ sub: `g-${email}`, email, email_verified: true }))
    const { user } = await signInWithCredential(auth, credential)
    await firebaseAuth.current()
    // Node has no popup to confirm with, so this fails before anything is deleted
    await expect(firebaseAuth.deleteAccount({ uid: user.uid })).rejects.toMatchObject({
      code: expect.stringMatching(/^(not_implemented|upstream_error)$/),
    })
    expect(await adminGetDoc(`users/${user.uid}`)).not.toBeNull()
  })

  it('deleting the account removes the profile and the login', async () => {
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Ed', email, password: PASSWORD })
    expect(await adminGetDoc(`users/${user.uid}`)).not.toBeNull()
    expect(await firebaseAuth.deleteAccount({ uid: user.uid, password: PASSWORD })).toMatchObject({ isGuest: true })
    await expect(firebaseAuth.signIn(email, PASSWORD)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(await adminGetDoc(`users/${user.uid}`)).toBeNull()
  })
})
