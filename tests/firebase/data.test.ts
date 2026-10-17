// The user's own data in a signed-in account, against the Auth and Firestore emulators (and firestore.rules):
// `npm run test:firebase`. Covers moving a guest's device data into the account on sign-in, the services
// switching between the device and the account, re-checks, removing a product and deleting the account.
import { getAuth, signOut } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFirebase } from '@/lib/firebase'
import { services } from '@/services'
import { firebaseAuth } from '@/services/firebase/auth'
import { accountStore } from '@/services/firebase/data'
import { clearLocalAlerts, listLocalAlerts } from '@/services/local/alerts'
import { clearLocalSaved, localSaved } from '@/services/local/saved'
import { clearLocalScans, listLocalScans } from '@/services/local/scans'
import { saveScanWithAlerts } from '@/services/local/watch'
import type { Recall, Scan, WatchCheckResult } from '@/types'
import { adminGetDoc, clearEmulators, newEmail, PASSWORD } from './helpers'

const checkWatchlist = vi.hoisted(() => vi.fn())
vi.mock('@/services/http/watchlist', () => ({ checkWatchlist }))

const recall = (recallNumber: string) => ({
  recallNumber,
  productDescription: `Oat Bites, UPC 012345678905 (${recallNumber})`,
  classification: 'Class II' as const,
  status: 'Ongoing' as const,
  reportDate: '2026-10-01',
})

function scan(upc: string, createdAt: string, id: string, matched?: string): Scan {
  return {
    id,
    type: 'barcode',
    createdAt,
    product: { upc, name: 'Oat Bites', brand: 'Acme' },
    items: [
      {
        id: `item-${id}`,
        name: 'Oat Bites',
        brand: 'Acme',
        upc,
        status: matched ? 'confirmed' : 'clear',
        recallNumbers: matched ? [matched] : [],
      },
    ],
    matchedRecalls: matched ? [recall(matched) as unknown as Recall] : [],
    verdict: null,
    counts: { total: 1, confirmed: matched ? 1 : 0, possible: 0, clear: matched ? 0 : 1, error: 0 },
  }
}

function clearDevice() {
  clearLocalSaved()
  clearLocalScans()
  clearLocalAlerts()
}

const signUp = () => firebaseAuth.signUp({ name: 'Test User', email: newEmail(), password: PASSWORD })

describe('account data (emulators)', () => {
  beforeEach(async () => {
    await clearEmulators()
    clearDevice()
    checkWatchlist.mockReset()
  })
  afterEach(async () => {
    const { app } = await getFirebase()
    await signOut(getAuth(app))
    clearDevice()
  })

  it('signing up moves the guest’s data into the account and off the device', async () => {
    saveScanWithAlerts(scan('012345678905', '2026-10-05T10:00:00Z', 'guest-scan', 'F-1-2026'))
    await localSaved.toggle(recall('F-2-2026'))

    const user = await signUp()

    expect(await adminGetDoc(`users/${user.uid}/scans/barcode-012345678905`)).not.toBeNull()
    expect(await adminGetDoc(`users/${user.uid}/alerts/F-1-2026_barcode-012345678905`)).not.toBeNull()
    expect(await adminGetDoc(`users/${user.uid}/savedRecalls/F-2-2026`)).not.toBeNull()
    expect(listLocalScans('barcode')).toEqual([])
    expect(listLocalAlerts()).toEqual([])
    expect(await localSaved.list()).toEqual([])

    // And the app now reads it from the account
    expect((await services.history.listProducts()).map((p) => [p.id, p.status])).toEqual([['barcode-012345678905', 'confirmed']])
    expect((await services.saved.list()).map((s) => s.recallNumber)).toEqual(['F-2-2026'])
    expect((await services.scan.getScan('guest-scan')).id).toBe('guest-scan')
  })

  it('signed in, everything is saved in the account; signed out, the device is empty', async () => {
    await signUp()
    const store = (await accountStore())!
    await store.saveScan(scan('012345678905', '2026-10-05T10:00:00Z', 'first', 'F-1-2026'))
    await store.saveScan(scan('012345678905', '2026-10-06T10:00:00Z', 'second'))
    // One product; the older scan's result page still opens (as the newer scan)
    expect(await services.history.listProducts()).toHaveLength(1)
    expect((await services.scan.getScan('first')).id).toBe('second')
    await expect(services.scan.getScan('nope')).rejects.toMatchObject({ code: 'not_found' })

    // The alert from the first scan still raises the product until it's dismissed
    expect((await services.history.listProducts())[0].status).toBe('confirmed')
    await services.alerts.dismiss('F-1-2026_barcode-012345678905')
    expect((await services.alerts.list())[0].dismissed).toBe(true)
    expect((await services.history.listProducts())[0].status).toBe('clear')

    expect(await services.saved.toggle(recall('F-3-2026'))).toBe(true)
    expect(await services.saved.toggle(recall('F-3-2026'))).toBe(false)
    expect(await services.saved.list()).toEqual([])

    await firebaseAuth.signOut()
    expect(await services.history.listProducts()).toEqual([])
    expect(await services.alerts.list()).toEqual([])
  })

  it('a re-check adds alerts in the account and moves its last check', async () => {
    const user = await signUp()
    const store = (await accountStore())!
    await store.saveScan(scan('012345678905', '2026-10-05T10:00:00Z', 'first'))
    const result: WatchCheckResult = {
      checkedAt: '2026-10-16T12:00:00.000Z',
      since: '2026-09-21',
      matches: [{ itemId: 'barcode-012345678905', recallNumber: 'F-9-2026', confidence: 'possible', recall: recall('F-9-2026') }],
    }
    checkWatchlist.mockResolvedValue(result)

    expect(await services.alerts.lastCheck()).toBeNull()
    const { newAlerts } = await services.alerts.recheck()
    expect(newAlerts.map((a) => a.id)).toEqual(['F-9-2026_barcode-012345678905'])
    expect(checkWatchlist).toHaveBeenCalledWith(expect.objectContaining({ since: '2026-10-05' }))
    expect(await services.alerts.lastCheck()).toBe('2026-10-16T12:00:00.000Z')

    // The same match again is nothing new; a confirmation upgrades it
    expect((await services.alerts.recheck()).newAlerts).toEqual([])
    checkWatchlist.mockResolvedValue({ ...result, matches: [{ ...result.matches[0], confidence: 'confirmed' }] })
    expect((await services.alerts.recheck()).newAlerts).toMatchObject([{ confidence: 'confirmed' }])
    expect(await adminGetDoc(`users/${user.uid}/alerts/F-9-2026_barcode-012345678905`)).not.toBeNull()
  })

  it('removing a product removes its scans and alerts', async () => {
    const user = await signUp()
    const store = (await accountStore())!
    await store.saveScan(scan('012345678905', '2026-10-05T10:00:00Z', 'first', 'F-1-2026'))
    await store.saveScan(scan('3017620422003', '2026-10-05T11:00:00Z', 'other', 'F-2-2026'))
    await services.history.deleteProduct('barcode-012345678905')
    expect((await services.history.listProducts()).map((p) => p.id)).toEqual(['barcode-3017620422003'])
    expect((await services.alerts.list()).map((a) => a.itemId)).toEqual(['barcode-3017620422003'])
    expect(await adminGetDoc(`users/${user.uid}/scans/barcode-012345678905`)).toBeNull()
  })

  it('merging again is harmless, and a newer account scan wins over an older device one', async () => {
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Mo', email, password: PASSWORD })
    await (await accountStore())!.saveScan(scan('012345678905', '2026-10-09T10:00:00Z', 'account-scan'))
    await firebaseAuth.signOut()

    saveScanWithAlerts(scan('012345678905', '2026-10-01T10:00:00Z', 'device-scan'))
    await firebaseAuth.signIn(email, PASSWORD)
    expect((await services.history.listProducts()).map((p) => p.scanId)).toEqual(['account-scan'])
    expect(listLocalScans('barcode')).toEqual([])
    // The device scan's result page still opens, as the account's newer scan
    expect((await services.scan.getScan('device-scan')).id).toBe('account-scan')
    // The account's last check isn't set, so nothing to move back
    expect((await adminGetDoc(`users/${user.uid}`))?.fields).not.toHaveProperty('lastWatchCheckAt')
    await firebaseAuth.current() // runs the merge again with an empty device: nothing changes
    expect(await services.history.listProducts()).toHaveLength(1)
  })

  it('a second merge of the same data changes nothing; a confirmation upgrades the account’s alert', async () => {
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Ny', email, password: PASSWORD })
    const store = (await accountStore())!
    const possible = scan('012345678905', '2026-10-05T10:00:00Z', 'acct', 'F-1-2026')
    possible.items[0].status = 'possible'
    await store.saveScan(possible)
    await services.alerts.dismiss('F-1-2026_barcode-012345678905')
    await firebaseAuth.signOut()

    // The same product on the device, confirmed this time (older scan, so the account's scan stays)
    saveScanWithAlerts(scan('012345678905', '2026-10-01T10:00:00Z', 'dev', 'F-1-2026'))
    await firebaseAuth.signIn(email, PASSWORD)
    const [upgraded] = await services.alerts.list()
    expect(upgraded).toMatchObject({ confidence: 'confirmed', dismissed: false })

    // Same data on the device again: the merge finds nothing new
    await firebaseAuth.signOut()
    saveScanWithAlerts(scan('012345678905', '2026-10-01T10:00:00Z', 'dev', 'F-1-2026'))
    await firebaseAuth.signIn(email, PASSWORD)
    expect(await services.alerts.list()).toHaveLength(1)
    expect(await services.history.listProducts()).toHaveLength(1)
    expect(listLocalScans('barcode')).toEqual([])
    void user
  })

  it('merging moves the account’s last check back to cover the device’s products', async () => {
    const email = newEmail()
    const user = await firebaseAuth.signUp({ name: 'Oz', email, password: PASSWORD })
    const store = (await accountStore())!
    await store.saveScan(scan('3017620422003', '2026-10-10T10:00:00Z', 'acct'))
    checkWatchlist.mockResolvedValue({ checkedAt: '2026-10-12T00:00:00.000Z', since: '2026-10-10', matches: [] })
    await services.alerts.recheck()
    await firebaseAuth.signOut()

    saveScanWithAlerts(scan('012345678905', '2026-10-02T10:00:00Z', 'dev'))
    await firebaseAuth.signIn(email, PASSWORD)
    expect(await services.alerts.lastCheck()).toBe('2026-10-02T10:00:00Z')
    void user
  })

  it('stores a scan as the API returns it, dropping fields the rules don’t allow', async () => {
    const user = await signUp()
    const store = (await accountStore())!
    const fromApi = {
      ...scan('012345678905', '2026-10-05T10:00:00Z', 'api-scan', 'F-1-2026'),
      matchedRecalls: [
        {
          ...recall('F-1-2026'),
          eventId: '98765',
          firm: 'Acme Foods',
          codeInfo: 'UPC 012345678905, lots 1-9',
          summary: { shortSummary: 'Oat bites may contain metal', sections: [{ title: 'What to do', bullets: ['Return it'] }] },
        } as unknown as Recall,
      ],
      somethingNew: 'from a newer backend',
      store: null,
    } as unknown as Scan
    await store.saveScan(fromApi)
    const saved = await adminGetDoc(`users/${user.uid}/scans/barcode-012345678905`)
    expect(saved?.fields).not.toHaveProperty('somethingNew')
    expect(saved?.fields).not.toHaveProperty('store')
    expect((await services.scan.getScan('api-scan')).matchedRecalls[0]).toMatchObject({ eventId: '98765' })
  })

  it('deleting the account deletes its data', async () => {
    const user = await signUp()
    const store = (await accountStore())!
    await store.saveScan(scan('012345678905', '2026-10-05T10:00:00Z', 'first', 'F-1-2026'))
    await services.saved.toggle(recall('F-3-2026'))
    await firebaseAuth.deleteAccount({ uid: user.uid, password: PASSWORD })
    for (const path of ['scans/barcode-012345678905', 'alerts/F-1-2026_barcode-012345678905', 'savedRecalls/F-3-2026', '']) {
      expect(await adminGetDoc(`users/${user.uid}${path && `/${path}`}`)).toBeNull()
    }
  })
})
