import { beforeEach, describe, expect, it } from 'vitest'
import { defaultMockConfig, setMockConfig } from '@/mocks/config'
import { sampleBarcodes } from '@/mocks/data/products'
import { lateRecallNumbers } from '@/mocks/data/recalls'
import { resetDb } from '@/mocks/db'
import { isApiError } from '../errors'
import { mockServices as s } from './index'

const photo = () => new Blob(['fake-jpeg'], { type: 'image/jpeg' })
const lateNumber = [...lateRecallNumbers][0]

beforeEach(() => {
  resetDb()
  setMockConfig({ ...defaultMockConfig, latency: 'none' })
})

async function expectApiError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(isApiError(err) && err.code).toBe(code)
}

describe('barcode scans', () => {
  it.each([
    ['confirmed', sampleBarcodes.confirmed],
    ['possible', sampleBarcodes.possible],
    ['clear', sampleBarcodes.clear],
    ['clear', sampleBarcodes.unknown],
  ])('returns %s for %s', async (status, code) => {
    const scan = await s.scan.scanBarcode(code)
    expect(scan.type).toBe('barcode')
    expect(scan.items).toHaveLength(1)
    expect(scan.items[0].status).toBe(status)
    expect(scan.verdict?.headline).toBeTruthy()
    expect(scan.matchedRecalls.length > 0).toBe(status === 'confirmed' || status === 'possible')
  })

  it('identifies unknown products as such', async () => {
    const scan = await s.scan.scanBarcode(sampleBarcodes.unknown)
    expect(scan.product?.name).toBe('Unknown product')
  })

  it('accepts EAN-13 with a leading zero and spaces', async () => {
    const scan = await s.scan.scanBarcode(`0 ${sampleBarcodes.confirmed}`)
    expect(scan.product?.upc).toBe(sampleBarcodes.confirmed)
    expect(scan.items[0].status).toBe('confirmed')
  })

  it('rejects a bad check digit without saving anything', async () => {
    await expectApiError(s.scan.scanBarcode(sampleBarcodes.invalid), 'invalid_barcode')
    expect(await s.history.listScans('barcode')).toHaveLength(0)
  })

  it('saves the scan, a watch item and an alert for matches', async () => {
    const scan = await s.scan.scanBarcode(sampleBarcodes.confirmed)
    expect((await s.scan.getScan(scan.id)).id).toBe(scan.id)
    expect(await s.history.listScans('barcode')).toHaveLength(1)
    const products = await s.history.listProducts()
    expect(products).toHaveLength(1)
    const alerts = await s.alerts.list()
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ confidence: 'confirmed', itemId: products[0].id, dismissed: false, source: 'barcode' })
  })

  it('only returns recall summaries (no sections) in matchedRecalls', async () => {
    const scan = await s.scan.scanBarcode(sampleBarcodes.confirmed)
    expect(scan.matchedRecalls[0].summary?.sections).toBeUndefined()
  })
})

describe('receipt scans', () => {
  it('cycles through scenarios A, B, C', async () => {
    const a = await s.scan.scanReceipt(photo())
    const b = await s.scan.scanReceipt(photo())
    const c = await s.scan.scanReceipt(photo())
    expect(a.counts).toMatchObject({ total: 12, clear: 12 })
    expect(b.counts).toMatchObject({ total: 18, confirmed: 1, possible: 1 })
    expect(c.counts).toMatchObject({ total: 9, error: 2 })
    expect(b.verdict?.headline).toMatch(/matches a recall/)
    expect(b.total).toBeGreaterThan(0)
    expect((await s.history.listScans('receipt')).map((x) => x.id)).toEqual([c.id, b.id, a.id])
  })

  it('does not watch unreadable lines', async () => {
    setMockConfig({ receiptScenario: 'C' })
    await s.scan.scanReceipt(photo())
    expect(await s.history.listProducts()).toHaveLength(7)
  })

  it('uses a pinned scenario and the given purchase date', async () => {
    setMockConfig({ receiptScenario: 'B' })
    const scan = await s.scan.scanReceipt(photo(), { purchaseDate: '2026-01-02' })
    expect(scan.store).toBe('Valley Foods #0412')
    expect(scan.purchaseDate).toBe('2026-01-02')
  })

  it('reports unreadable and oversized receipts', async () => {
    setMockConfig({ receiptScenario: 'unreadable' })
    await expectApiError(s.scan.scanReceipt(photo()), 'receipt_unreadable')
    setMockConfig({ receiptScenario: 'A' })
    await expectApiError(s.scan.scanReceipt(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)])), 'image_too_large')
  })
})

describe('editing a scan item', () => {
  it('re-checks an unreadable receipt line by name', async () => {
    setMockConfig({ receiptScenario: 'C' })
    const scan = await s.scan.scanReceipt(photo())
    const unreadable = scan.items.find((i) => i.status === 'error')!
    expect(await s.history.listProducts()).toHaveLength(7)

    const updated = await s.scan.updateItem(scan.id, unreadable.id, 'Harbor Bay smoked salmon')
    const item = updated.items.find((i) => i.id === unreadable.id)!
    expect(item).toMatchObject({ name: 'Harbor Bay smoked salmon', status: 'possible' })
    expect(updated.counts).toMatchObject({ error: 1, possible: 1 })
    expect(updated.matchedRecalls).toHaveLength(1)
    expect(updated.verdict?.headline).toMatch(/may be affected/)

    // Persisted, watched and alerted
    expect((await s.scan.getScan(scan.id)).counts.possible).toBe(1)
    const products = await s.history.listProducts()
    expect(products).toHaveLength(8)
    const alerts = await s.alerts.list()
    expect(alerts).toHaveLength(1)
    expect(alerts[0].itemId).toBe(products.find((p) => p.scanItemId === unreadable.id)!.id)
    expect(alerts[0]).toMatchObject({ source: 'receipt', store: 'Corner Grocer #214' })
  })

  it('replaces the watch item and its alerts when an item is edited again', async () => {
    setMockConfig({ receiptScenario: 'C' })
    const scan = await s.scan.scanReceipt(photo())
    const line = scan.items.find((i) => i.status === 'error')!
    await s.scan.updateItem(scan.id, line.id, 'Harbor Bay smoked salmon')
    const cleared = await s.scan.updateItem(scan.id, line.id, 'Paper towels')
    expect(cleared.items.find((i) => i.id === line.id)?.status).toBe('clear')
    expect(await s.history.listProducts()).toHaveLength(8)
    expect(await s.alerts.list()).toHaveLength(0)
  })

  it('validates the name and ids', async () => {
    const scan = await s.scan.scanBarcode(sampleBarcodes.clear)
    await expectApiError(s.scan.updateItem(scan.id, scan.items[0].id, 'x'), 'invalid_request')
    await expectApiError(s.scan.updateItem(scan.id, 'nope', 'Baby spinach'), 'not_found')
  })
})

describe('recalls', () => {
  it('splits active and resolved and hides the late recall', async () => {
    const active = await s.recalls.listRecent({ status: 'active', pageSize: 50 })
    const resolved = await s.recalls.listRecent({ status: 'resolved', pageSize: 50 })
    expect(active.items.every((r) => r.status === 'Ongoing')).toBe(true)
    expect(resolved.items.every((r) => r.status !== 'Ongoing')).toBe(true)
    expect(active.items.some((r) => r.recallNumber === lateNumber)).toBe(false)
    expect(active.items[0].summary?.sections).toBeUndefined()
    await expectApiError(s.recalls.get(lateNumber), 'not_found')
  })

  it('pages results', async () => {
    const first = await s.recalls.listRecent({ status: 'active', pageSize: 5 })
    expect(first.items).toHaveLength(5)
    expect(first.hasMore).toBe(true)
    const second = await s.recalls.listRecent({ status: 'active', page: 2, pageSize: 5 })
    expect(second.items[0].recallNumber).not.toBe(first.items[0].recallNumber)
  })

  it('searches across product, firm and reason', async () => {
    const result = await s.recalls.search('listeria creamery')
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((r) => /listeria/i.test(r.reasonForRecall) && /creamery/i.test(r.recallingFirm))).toBe(true)
    await expectApiError(s.recalls.search('x'), 'invalid_request')
  })

  it('serves short summaries by recall number, skipping unknown ones', async () => {
    const [a, b] = (await s.recalls.listRecent({ status: 'active' })).items
    const map = await s.recalls.summaries([a.recallNumber, b.recallNumber, 'H-0000-2026', lateNumber])
    expect(Object.keys(map).sort()).toEqual([a.recallNumber, b.recallNumber].sort())
    expect(map[a.recallNumber].shortSummary).toBeTruthy()
    expect(map[a.recallNumber].sections).toBeUndefined()
  })

  it('serves the full summary separately', async () => {
    const [first] = (await s.recalls.listRecent({ status: 'active' })).items
    expect((await s.recalls.summary(first.recallNumber))?.sections?.actionRequired).toBeTruthy()
    await expectApiError(s.recalls.summary(lateNumber), 'not_found')
  })

  it('returns full summary sections for a single recall', async () => {
    const [first] = (await s.recalls.listRecent({ status: 'active' })).items
    const full = await s.recalls.get(first.recallNumber)
    expect(full.summary?.sections?.actionRequired).toBeTruthy()
  })
})

describe('watchlist re-check', () => {
  it('reveals the late recall once for a user who bought the product', async () => {
    const scan = await s.scan.scanBarcode('088902004173') // Meadowlark yogurt
    expect(scan.items[0].status).toBe('clear')
    expect(await s.alerts.list()).toHaveLength(0)

    const first = await s.alerts.recheck()
    expect(first.newAlerts).toHaveLength(1)
    expect(first.newAlerts[0].recallNumber).toBe(lateNumber)
    expect((await s.history.listProducts())[0].status).toBe('confirmed')
    expect(first.newAlerts[0].source).toBe('barcode')
    expect((await s.recalls.get(lateNumber)).recallNumber).toBe(lateNumber)
    expect((await s.meta.dataSourceStatus()).lastWatchCheckAt).toBe(first.checkedAt)

    expect((await s.alerts.recheck()).newAlerts).toHaveLength(0)
    // New scans of the product now match too
    expect((await s.scan.scanBarcode('088902004173')).items[0].status).toBe('confirmed')
  })

  it('finds nothing for users without the product', async () => {
    await s.scan.scanBarcode(sampleBarcodes.clear)
    expect((await s.alerts.recheck()).newAlerts).toHaveLength(0)
    await expectApiError(s.recalls.get(lateNumber), 'not_found')
  })

  it('dismisses alerts', async () => {
    await s.scan.scanBarcode(sampleBarcodes.confirmed)
    const [alert] = await s.alerts.list()
    await s.alerts.dismiss(alert.id)
    expect((await s.alerts.list())[0].dismissed).toBe(true)
  })
})

describe('saved recalls and products', () => {
  it('toggles saved recalls', async () => {
    const [recall] = (await s.recalls.listRecent({ status: 'active' })).items
    expect(await s.saved.toggle(recall)).toBe(true)
    expect((await s.saved.list())[0].recallNumber).toBe(recall.recallNumber)
    expect(await s.saved.toggle(recall)).toBe(false)
    expect(await s.saved.list()).toHaveLength(0)
  })

  it('deleting a product removes its alerts', async () => {
    await s.scan.scanBarcode(sampleBarcodes.confirmed)
    const [product] = await s.history.listProducts()
    await s.history.deleteProduct(product.id)
    expect(await s.history.listProducts()).toHaveLength(0)
    expect(await s.alerts.list()).toHaveLength(0)
  })
})

describe('auth', () => {
  it('starts as an empty guest', async () => {
    const user = await s.auth.current()
    expect(user.isGuest).toBe(true)
    expect(await s.history.listScans('receipt')).toHaveLength(0)
  })

  it('signs a new email in as a returning user with seeded history', async () => {
    const user = await s.auth.signIn('sam.lee@example.com', 'pw123456')
    expect(user).toMatchObject({ isGuest: false, email: 'sam.lee@example.com', displayName: 'Sam Lee' })
    expect(await s.history.listScans('receipt')).toHaveLength(5)
    expect(await s.history.listScans('barcode')).toHaveLength(6)
    const alerts = await s.alerts.list()
    expect(alerts.some((a) => a.dismissed)).toBe(true)
    expect(alerts.some((a) => !a.dismissed)).toBe(true)
    expect(await s.saved.list()).toHaveLength(3)
  })

  it('rejects a wrong password and bad email', async () => {
    await expectApiError(s.auth.signIn('sam@example.com', 'wrong'), 'unauthenticated')
    await expectApiError(s.auth.signIn('not-an-email', 'pw123456'), 'invalid_request')
  })

  it('sign-up upgrades the guest and keeps their history', async () => {
    const guest = await s.auth.current()
    await s.scan.scanBarcode(sampleBarcodes.confirmed)
    const user = await s.auth.signUp({ name: 'Ana Ruiz', email: 'ana@example.com', password: 'secret1' })
    expect(user).toMatchObject({ uid: guest.uid, isGuest: false, displayName: 'Ana Ruiz' })
    expect(await s.history.listScans('barcode')).toHaveLength(1)
    await expectApiError(s.auth.signUp({ name: 'Ana', email: 'ana@example.com', password: 'secret1' }), 'invalid_request')
  })

  it('sign-out starts a fresh guest; signing back in restores the account', async () => {
    await s.auth.signUp({ name: 'Ana', email: 'ana@example.com', password: 'secret1' })
    await s.scan.scanBarcode(sampleBarcodes.clear)
    const guest = await s.auth.signOut()
    expect(guest.isGuest).toBe(true)
    expect(await s.history.listScans('barcode')).toHaveLength(0)
    await s.auth.signIn('ana@example.com', 'secret1')
    expect(await s.history.listScans('barcode')).toHaveLength(1)
  })

  it('delete account removes the data and the email', async () => {
    await s.auth.signUp({ name: 'Ana', email: 'ana@example.com', password: 'secret1' })
    await s.scan.scanBarcode(sampleBarcodes.clear)
    expect((await s.auth.deleteAccount()).isGuest).toBe(true)
    expect(await s.history.listScans('barcode')).toHaveLength(0)
    // The email is free again: signing in now creates a new (seeded) user
    await s.auth.signIn('ana@example.com', 'secret1')
    expect(await s.history.listScans('barcode')).toHaveLength(6)
  })

  it('updates prefs', async () => {
    const user = await s.auth.updatePrefs({ recheckOnOpen: false })
    expect(user.prefs.recheckOnOpen).toBe(false)
    expect((await s.auth.current()).prefs.recheckOnOpen).toBe(false)
  })
})

describe('developer controls', () => {
  it('forceError fails data calls but not auth', async () => {
    setMockConfig({ forceError: true })
    await expectApiError(s.recalls.listRecent({ status: 'active' }), 'upstream_error')
    await expectApiError(s.scan.scanBarcode(sampleBarcodes.clear), 'upstream_error')
    expect((await s.auth.current()).isGuest).toBe(true)
  })

  it('forceEmpty empties lists', async () => {
    await s.scan.scanBarcode(sampleBarcodes.confirmed)
    setMockConfig({ forceEmpty: true })
    expect((await s.recalls.listRecent({ status: 'active' })).items).toHaveLength(0)
    expect(await s.history.listProducts()).toHaveLength(0)
    expect(await s.alerts.list()).toHaveLength(0)
  })
})
