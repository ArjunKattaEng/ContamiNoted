import { describe, expect, it, vi } from 'vitest'
import type { Alert, Recall, SavedRecall, Scan, WatchCheckResult } from '@/types'
import {
  MAX_PREVIOUS_IDS,
  alertsFromScan,
  makeAlert,
  mergeAlerts,
  planDeviceMerge,
  productKey,
  productsFromScans,
  recheckWith,
  replaceScan,
  withAlertStatus,
  type RecheckStore,
  type UserDataSnapshot,
} from './user-data'

const ref = (recallNumber: string, productDescription = `Recalled ${recallNumber}`) => ({
  recallNumber,
  productDescription,
  classification: 'Class II' as const,
  status: 'Ongoing' as const,
  reportDate: '2026-10-01',
})

function scan(upc: string, createdAt: string, id = `scan-${upc}-${createdAt}`, status: 'clear' | 'confirmed' | 'possible' = 'clear'): Scan {
  const recallNumbers = status === 'clear' ? [] : ['F-1-2026']
  return {
    id,
    type: 'barcode',
    createdAt,
    product: { upc, name: 'Oat Bites', brand: 'Acme' },
    items: [{ id: `item-${upc}`, name: 'Oat Bites', brand: 'Acme', upc, status, recallNumbers }],
    matchedRecalls: status === 'clear' ? [] : [{ ...ref('F-1-2026'), firm: 'Acme' } as unknown as Recall],
    verdict: null,
    counts: { total: 1, confirmed: status === 'confirmed' ? 1 : 0, possible: status === 'possible' ? 1 : 0, clear: status === 'clear' ? 1 : 0, error: 0 },
  }
}

const alert = (recallNumber: string, itemId: string, confidence: Alert['confidence'] = 'possible', dismissed = false): Alert => ({
  ...makeAlert({ recallNumber, itemId, itemName: 'Oat Bites', confidence, recall: ref(recallNumber), createdAt: '2026-10-02T00:00:00Z' }),
  dismissed,
})

const saved = (recallNumber: string): SavedRecall => ({ recallNumber, savedAt: '2026-10-03T00:00:00Z', recall: ref(recallNumber) })

const empty: UserDataSnapshot = { saved: [], scans: [], alerts: [], lastCheck: null }

describe('products and alerts', () => {
  it('keeps one product per barcode, from its newest scan', () => {
    const products = productsFromScans([scan('1', '2026-10-01T00:00:00Z'), scan('1', '2026-10-05T00:00:00Z'), scan('2', '2026-10-03T00:00:00Z')])
    expect(products.map((p) => [p.id, p.createdAt])).toEqual([
      ['barcode-1', '2026-10-05T00:00:00Z'],
      ['barcode-2', '2026-10-03T00:00:00Z'],
    ])
  })

  it('raises a product’s status from its active alerts only', () => {
    const [product] = productsFromScans([scan('1', '2026-10-01T00:00:00Z')])
    expect(withAlertStatus([product], [alert('F-2-2026', 'barcode-1', 'confirmed', true)])[0].status).toBe('clear')
    const [raised] = withAlertStatus([product], [alert('F-2-2026', 'barcode-1', 'possible')])
    expect(raised).toMatchObject({ status: 'possible', recallNumbers: ['F-2-2026'] })
  })

  it('upgrades a possible alert to confirmed and brings it back, but leaves dismissals alone otherwise', () => {
    const existing = [alert('F-1-2026', 'barcode-1', 'possible', true), alert('F-2-2026', 'barcode-1', 'possible', true)]
    const { fresh } = mergeAlerts(existing, [
      alert('F-1-2026', 'barcode-1', 'confirmed'),
      alert('F-2-2026', 'barcode-1', 'possible'),
      alert('F-3-2026', 'barcode-1'),
    ])
    expect(fresh.map((a) => [a.id, a.confidence, a.dismissed])).toEqual([
      ['F-1-2026_barcode-1', 'confirmed', false],
      ['F-3-2026_barcode-1', 'possible', false],
    ])
  })

  it('makes alerts from a scan’s matches with compact recall snapshots', () => {
    const [made] = alertsFromScan(scan('1', '2026-10-01T00:00:00Z', 's', 'confirmed'))
    expect(made).toMatchObject({ id: 'F-1-2026_barcode-1', itemId: 'barcode-1', confidence: 'confirmed', dismissed: false })
    expect(made.recall).not.toHaveProperty('firm')
    expect(alertsFromScan(scan('1', '2026-10-01T00:00:00Z'))).toEqual([])
  })
})

describe('replaceScan', () => {
  it('remembers the ids of the scans it replaced, up to a limit', () => {
    const first = scan('1', '2026-10-01T00:00:00Z', 'a')
    const second = replaceScan(first, scan('1', '2026-10-02T00:00:00Z', 'b'))
    expect(second).toMatchObject({ id: 'b', previousIds: ['a'] })
    expect(replaceScan(second, scan('1', '2026-10-03T00:00:00Z', 'c')).previousIds).toEqual(['a', 'b'])
    expect(replaceScan(undefined, first)).not.toHaveProperty('previousIds')
    // Saving the same scan again doesn't list it as its own predecessor
    expect(replaceScan(second, scan('1', '2026-10-02T00:00:00Z', 'b')).previousIds).toEqual(['a'])
    const many = { ...second, previousIds: Array.from({ length: MAX_PREVIOUS_IDS }, (_, i) => `old-${i}`) }
    const next = replaceScan(many, scan('1', '2026-10-04T00:00:00Z', 'd')).previousIds!
    expect(next).toHaveLength(MAX_PREVIOUS_IDS)
    expect(next.at(-1)).toBe('b')
  })
})

describe('planDeviceMerge', () => {
  it('moves everything when the account is empty', () => {
    const device: UserDataSnapshot = {
      saved: [saved('F-1-2026')],
      scans: [scan('1', '2026-10-01T00:00:00Z')],
      alerts: [alert('F-1-2026', 'barcode-1')],
      lastCheck: '2026-10-04T00:00:00Z',
    }
    const plan = planDeviceMerge(device, empty)
    expect(plan.saved).toHaveLength(1)
    expect(plan.scans).toHaveLength(1)
    expect(plan.alerts).toHaveLength(1)
    // No account check yet: its first re-check starts from its oldest scan
    expect(plan.lastCheck).toBeUndefined()
  })

  it('keeps the account’s own data where both have something', () => {
    const account: UserDataSnapshot = {
      saved: [{ ...saved('F-1-2026'), savedAt: '2026-01-01T00:00:00Z' }],
      scans: [scan('1', '2026-10-09T00:00:00Z', 'account-scan')],
      alerts: [alert('F-1-2026', 'barcode-1', 'possible', true)],
      lastCheck: '2026-10-10T00:00:00Z',
    }
    const device: UserDataSnapshot = {
      saved: [saved('F-1-2026'), saved('F-2-2026')],
      scans: [scan('1', '2026-10-01T00:00:00Z', 'older-device-scan')],
      alerts: [alert('F-1-2026', 'barcode-1', 'possible', false)],
      lastCheck: null,
    }
    const plan = planDeviceMerge(device, account)
    expect(plan.saved.map((s) => s.recallNumber)).toEqual(['F-2-2026'])
    // The account's scan is newer and stays; the device scan's result page still opens through it
    expect(plan.scans.map((sc) => [sc.id, sc.previousIds])).toEqual([['account-scan', ['older-device-scan']]])
    expect(plan.alerts).toEqual([]) // the account's dismissal stands
    // The device's product was last checked on Oct 1 (its scan): check it again from there
    expect(plan.lastCheck).toBe('2026-10-01T00:00:00Z')
  })

  it('a newer device scan replaces the account’s, keeping the old id findable', () => {
    const account = { ...empty, scans: [scan('1', '2026-10-01T00:00:00Z', 'old')] }
    const device = { ...empty, scans: [scan('1', '2026-10-05T00:00:00Z', 'new'), scan('1', '2026-10-03T00:00:00Z', 'mid')] }
    const plan = planDeviceMerge(device, account)
    expect(plan.scans.map((s) => [s.id, s.previousIds])).toEqual([['new', ['old']]])
  })

  it('upgrades the account’s possible alert when the device confirmed it', () => {
    const account = {
      ...empty,
      scans: [scan('1', '2026-10-01T00:00:00Z')],
      alerts: [alert('F-1-2026', 'barcode-1', 'possible', true)],
    }
    const device = { ...empty, alerts: [alert('F-1-2026', 'barcode-1', 'confirmed')] }
    expect(planDeviceMerge(device, account).alerts).toMatchObject([{ confidence: 'confirmed', dismissed: false }])
  })

  it('drops device alerts whose product is on neither side', () => {
    const device = { ...empty, scans: [scan('1', '2026-10-01T00:00:00Z')], alerts: [alert('F-1-2026', 'barcode-1'), alert('F-2-2026', 'barcode-gone')] }
    expect(planDeviceMerge(device, empty).alerts.map((a) => a.itemId)).toEqual(['barcode-1'])
  })

  it('a device scan the account already knows changes nothing', () => {
    const account = { ...empty, scans: [{ ...scan('1', '2026-10-09T00:00:00Z', 'new'), previousIds: ['old'] }] }
    expect(planDeviceMerge({ ...empty, scans: [scan('1', '2026-10-01T00:00:00Z', 'old')] }, account).scans).toEqual([])
  })

  it('never moves the account’s last check forward', () => {
    const account = { ...empty, lastCheck: '2026-10-01T00:00:00Z' }
    expect(planDeviceMerge({ ...empty, lastCheck: '2026-10-09T00:00:00Z' }, account).lastCheck).toBeUndefined()
    expect(planDeviceMerge({ ...empty, lastCheck: '2026-09-20T00:00:00Z' }, account).lastCheck).toBe('2026-09-20T00:00:00Z')
  })
})

describe('recheckWith', () => {
  const result: WatchCheckResult = {
    checkedAt: '2026-10-16T12:00:00Z',
    since: '2026-09-20',
    matches: [{ itemId: 'barcode-1', recallNumber: 'F-9-2026', confidence: 'possible', recall: { ...ref('F-9-2026', 'x'.repeat(5000)) } }],
  }

  function store(overrides: Partial<RecheckStore> = {}): RecheckStore {
    return {
      products: async () => productsFromScans([scan('1', '2026-10-01T09:00:00Z')]),
      lastCheck: async () => null,
      addAlerts: async (candidates) => ({ fresh: candidates, saved: true }),
      setLastCheck: vi.fn(async () => {}),
      ...overrides,
    }
  }

  it('checks since the oldest scan, clips recall snapshots, then moves the last check', async () => {
    const s = store()
    const check = vi.fn(async () => result)
    const { newAlerts } = await recheckWith(s, check)
    expect(check).toHaveBeenCalledWith({ items: [{ id: 'barcode-1', upc: '1', name: 'Oat Bites', brand: 'Acme' }], since: '2026-10-01' })
    expect(newAlerts[0].recall.productDescription).toHaveLength(1000)
    expect(s.setLastCheck).toHaveBeenCalledWith('2026-10-16T12:00:00Z')
  })

  it('keeps the last check when the alerts weren’t saved, and skips with no products', async () => {
    const unsaved = store({ lastCheck: async () => '2026-10-10T00:00:00Z', addAlerts: async (c) => ({ fresh: c, saved: false }) })
    const check = vi.fn(async () => result)
    await recheckWith(unsaved, check)
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ since: '2026-10-10' }))
    expect(unsaved.setLastCheck).not.toHaveBeenCalled()
    const none = store({ products: async () => [] })
    expect((await recheckWith(none, check)).skipped).toBe(true)
  })

  it('sends at most 100 products per request, with names and brands the server accepts', async () => {
    const many = Array.from({ length: 230 }, (_, i) => ({
      ...scan(String(i).padStart(12, '0'), `2026-10-01T00:00:${String(i % 60).padStart(2, '0')}Z`),
    }))
    many[0] = { ...many[0], items: [{ ...many[0].items[0], name: 'n'.repeat(500), brand: 'b'.repeat(500) }] }
    const s = store({ products: async () => productsFromScans(many) })
    const check = vi.fn(async (body: { items: unknown[] }) => ({ ...result, checkedAt: `2026-10-16T12:00:0${body.items.length % 10}Z`, matches: [] }))
    await recheckWith(s, check)
    expect(check.mock.calls.map(([body]) => body.items.length)).toEqual([100, 100, 30])
    const sent = check.mock.calls.flatMap(([body]) => body.items) as { name: string; brand?: string }[]
    expect(Math.max(...sent.map((i) => i.name.length))).toBe(200)
    expect(Math.max(...sent.map((i) => i.brand?.length ?? 0))).toBe(200)
    // The last check moves to the earliest answer
    expect(s.setLastCheck).toHaveBeenCalledWith('2026-10-16T12:00:00Z')
  })

  it('ignores matches for products it didn’t send', async () => {
    const check = vi.fn(async () => ({ ...result, matches: [{ ...result.matches[0], itemId: 'barcode-404' }] }))
    expect((await recheckWith(store(), check)).newAlerts).toEqual([])
  })
})

it('productKey is the barcode', () => {
  expect(productKey(scan('012345678905', '2026-10-01T00:00:00Z'))).toBe('barcode-012345678905')
})
