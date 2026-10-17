// firestore.rules against the Firestore emulator: `npm run test:rules` (needs Java for the emulator).
import { readFileSync } from 'fs'
import path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT } from '@/lib/firebase'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: FIRESTORE_EMULATOR_PORT,
    },
  })
})
afterEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

const alice = () => env.authenticatedContext('alice', { email: 'alice@example.com' }).firestore()
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.com' }).firestore()
const nobody = () => env.unauthenticatedContext().firestore()

const profile = (uid = 'alice', email = 'alice@example.com') => ({
  uid,
  email,
  displayName: 'Alice',
  createdAt: '2026-10-17T12:00:00.000Z',
  updatedAt: '2026-10-17T12:00:00.000Z',
  prefs: { recheckOnOpen: true },
})

const recallRef = (recallNumber = 'F-0769-2025') => ({
  recallNumber,
  productDescription: 'Bonya Raspberry Yogurt Parfait, 8oz',
  classification: 'Class II',
  status: 'Ongoing',
  reportDate: '2025-05-21',
})

const scan = () => ({
  id: 'scan-1',
  type: 'barcode',
  createdAt: '2026-10-17T12:00:00Z',
  product: { upc: '012345678905', name: 'Parfait', brand: 'Bonya' },
  items: [{ id: 'i1', name: 'Parfait', upc: '012345678905', status: 'possible', recallNumbers: ['F-0769-2025'] }],
  matchedRecalls: [],
  verdict: { headline: 'Possible recall match', details: 'd', nextSteps: [] },
  counts: { total: 1, confirmed: 0, possible: 1, clear: 0, error: 0 },
})

const alert = (itemId = 'barcode-012345678905') => ({
  id: `F-0769-2025_${itemId}`,
  recallNumber: 'F-0769-2025',
  itemId,
  itemName: 'Bonya Parfait',
  source: 'barcode',
  confidence: 'possible',
  recall: recallRef(),
  createdAt: '2026-10-17T12:00:00Z',
  dismissed: false,
})

/** Writes as an admin (rules bypassed), to set up existing data. */
const seed = (path: string, data: object) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data))

describe('users/{uid}: profile', () => {
  it('the owner creates their own profile', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), profile()))
  })

  it('rejects someone else’s profile, a signed-out writer and a different email', async () => {
    await assertFails(setDoc(doc(bob(), 'users/alice'), profile()))
    await assertFails(setDoc(doc(nobody(), 'users/alice'), profile()))
    await assertFails(setDoc(doc(alice(), 'users/alice'), profile('alice', 'someone@else.com')))
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), uid: 'bob' }))
  })

  it('rejects unknown fields and bad values', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), isAdmin: true }))
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), prefs: { recheckOnOpen: 'yes' } }))
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), prefs: { recheckOnOpen: true, extra: 1 } }))
    const { prefs, ...noPrefs } = profile()
    void prefs
    await assertFails(setDoc(doc(alice(), 'users/alice'), noPrefs))
  })

  it('only the owner reads it, and nobody lists users', async () => {
    await seed('users/alice', profile())
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')))
    await assertFails(getDoc(doc(bob(), 'users/alice')))
    await assertFails(getDoc(doc(nobody(), 'users/alice')))
    await assertFails(getDocs(collection(alice(), 'users')))
  })

  it('accepts the app’s own preference write (setDoc with merge)', async () => {
    await seed('users/alice', profile())
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice'), { prefs: { recheckOnOpen: false }, updatedAt: '2026-10-18T00:00:00.000Z' }, { merge: true }),
    )
  })

  it('checks sizes, timestamps and the email claim', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { ...profile(), displayName: 'a'.repeat(100) }))
    await env.clearFirestore()
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), displayName: 'a'.repeat(101) }))
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...profile(), createdAt: 'yesterday at noon' }))
    const noEmail = env.authenticatedContext('carol').firestore()
    await assertFails(setDoc(doc(noEmail, 'users/carol'), { ...profile('carol', 'carol@example.com') }))
  })

  it('an update can’t add a field the profile doesn’t have', async () => {
    await seed('users/alice', profile())
    await assertFails(setDoc(doc(alice(), 'users/alice'), { isAdmin: true }, { merge: true }))
  })

  it('the owner updates prefs and last check, but not who they are', async () => {
    await seed('users/alice', profile())
    const ref = doc(alice(), 'users/alice')
    await assertSucceeds(updateDoc(ref, { prefs: { recheckOnOpen: false }, updatedAt: '2026-10-18T00:00:00Z' }))
    await assertSucceeds(updateDoc(ref, { lastWatchCheckAt: '2026-10-18T00:00:00Z' }))
    await assertFails(updateDoc(ref, { email: 'new@example.com' }))
    await assertFails(updateDoc(ref, { uid: 'bob' }))
    await assertFails(updateDoc(ref, { createdAt: '2020-01-01T00:00:00Z' }))
    await assertFails(updateDoc(doc(bob(), 'users/alice'), { prefs: { recheckOnOpen: false } }))
  })

  it('only the owner deletes it', async () => {
    await seed('users/alice', profile())
    await assertFails(deleteDoc(doc(bob(), 'users/alice')))
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice')))
  })
})

describe('users/{uid}/savedRecalls', () => {
  const saved = { recallNumber: 'F-0769-2025', savedAt: '2026-10-17T12:00:00Z', recall: recallRef() }

  it('the owner saves, lists and removes a recall', async () => {
    const ref = doc(alice(), 'users/alice/savedRecalls/F-0769-2025')
    await assertSucceeds(setDoc(ref, saved))
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/savedRecalls')))
    await assertSucceeds(deleteDoc(ref))
  })

  it('rejects a mismatched id, bad recall data and other users', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/savedRecalls/F-1-2026'), saved))
    await assertFails(
      setDoc(doc(alice(), 'users/alice/savedRecalls/F-0769-2025'), { ...saved, recall: recallRef('F-1-2026') }),
    )
    await assertFails(setDoc(doc(nobody(), 'users/alice/savedRecalls/F-0769-2025'), saved))
    await assertFails(
      setDoc(doc(alice(), 'users/alice/savedRecalls/F-0769-2025'), { ...saved, recall: { ...recallRef(), classification: 'Class IV' } }),
    )
    await assertFails(setDoc(doc(bob(), 'users/alice/savedRecalls/F-0769-2025'), saved))
    await seed('users/alice/savedRecalls/F-0769-2025', saved)
    await assertFails(getDocs(collection(bob(), 'users/alice/savedRecalls')))
    await assertFails(getDocs(collection(nobody(), 'users/alice/savedRecalls')))
    await assertFails(deleteDoc(doc(bob(), 'users/alice/savedRecalls/F-0769-2025')))
  })

  it('allows long recall descriptions in the snapshot', async () => {
    const long = { ...saved, recall: { ...recallRef(), productDescription: 'x'.repeat(5000) } }
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/savedRecalls/F-0769-2025'), long))
  })
})

describe('users/{uid}/scans', () => {
  it('the owner writes and reads scans', async () => {
    const ref = doc(alice(), 'users/alice/scans/barcode-012345678905')
    await assertSucceeds(setDoc(ref, scan()))
    await assertSucceeds(setDoc(ref, { ...scan(), id: 'scan-2', previousIds: ['scan-1'] }))
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/scans')))
    await assertSucceeds(deleteDoc(ref))
  })

  it('rejects unknown fields, bad types and other users', async () => {
    const ref = doc(alice(), 'users/alice/scans/barcode-012345678905')
    await assertFails(setDoc(ref, { ...scan(), type: 'photo' }))
    await assertFails(setDoc(ref, { ...scan(), owner: 'alice' }))
    await assertFails(setDoc(ref, { ...scan(), items: 'none' }))
    await assertFails(setDoc(ref, { ...scan(), items: Array.from({ length: 201 }, () => ({})) }))
    await assertFails(setDoc(ref, { ...scan(), counts: { ...scan().counts, hacked: 1 } }))
    await assertFails(setDoc(ref, { ...scan(), total: 'lots' }))
    await assertFails(setDoc(doc(alice(), `users/alice/scans/${'x'.repeat(121)}`), scan()))
    await assertFails(setDoc(doc(bob(), 'users/alice/scans/barcode-012345678905'), scan()))
    await assertFails(setDoc(doc(nobody(), 'users/alice/scans/barcode-012345678905'), scan()))
    await seed('users/alice/scans/barcode-012345678905', scan())
    await assertFails(getDoc(doc(bob(), 'users/alice/scans/barcode-012345678905')))
    await assertFails(getDocs(collection(bob(), 'users/alice/scans')))
    await assertFails(deleteDoc(doc(bob(), 'users/alice/scans/barcode-012345678905')))
  })

  it('accepts a scan with a null verdict and optional fields left out', async () => {
    const { product, ...withoutProduct } = scan()
    void product
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/scans/barcode-1'), { ...withoutProduct, verdict: null }))
  })
})

describe('users/{uid}/alerts', () => {
  const path = 'users/alice/alerts/F-0769-2025_barcode-012345678905'

  it('the owner creates, dismisses, upgrades and deletes an alert', async () => {
    await assertSucceeds(setDoc(doc(alice(), path), alert()))
    await assertSucceeds(updateDoc(doc(alice(), path), { dismissed: true }))
    await assertSucceeds(updateDoc(doc(alice(), path), { confidence: 'confirmed', dismissed: false }))
    await assertSucceeds(deleteDoc(doc(alice(), path)))
  })

  it('rejects an id that doesn’t match, a bad confidence, and changing what it is about', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/alerts/wrong-id'), alert()))
    await assertFails(setDoc(doc(alice(), path), { ...alert(), confidence: 'certain' }))
    await seed(path, alert())
    await assertFails(updateDoc(doc(alice(), path), { itemId: 'barcode-1', id: 'F-0769-2025_barcode-1' }))
    await assertFails(updateDoc(doc(alice(), path), { dismissed: 'yes' }))
    await assertFails(getDoc(doc(bob(), path)))
    await assertFails(getDocs(collection(bob(), 'users/alice/alerts')))
    await assertFails(deleteDoc(doc(bob(), path)))
  })

  it('the app’s upgrade (setDoc over the whole alert) is allowed; a rewrite of its date is not', async () => {
    await seed(path, alert())
    // What the app writes when a possible alert is confirmed (src/services/firebase/data.ts)
    await assertSucceeds(setDoc(doc(alice(), path), { ...alert(), confidence: 'confirmed', dismissed: false }))
    await assertFails(setDoc(doc(alice(), path), { ...alert(), createdAt: '2026-10-18T00:00:00Z' }))
  })

  it('an update may not touch when or where the alert came from', async () => {
    await seed(path, alert())
    // Valid values, but these keys aren't in the update allowlist: only the affectedKeys guard stops them
    await assertFails(updateDoc(doc(alice(), path), { createdAt: '2026-10-18T00:00:00Z' }))
    await assertFails(updateDoc(doc(alice(), path), { source: 'receipt' }))
    await assertFails(updateDoc(doc(alice(), path), { store: 'Valley Foods' }))
  })
})

describe('everything else', () => {
  it('is closed', async () => {
    await assertFails(setDoc(doc(alice(), 'recalls/F-1'), { x: 1 }))
    await assertFails(getDoc(doc(alice(), 'admin/config')))
    await assertFails(setDoc(doc(alice(), 'users/alice/other/x'), { x: 1 }))
  })
})
