import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scan, WatchCheckResult } from '@/types'
import { clearLocalAlerts, lastWatchCheck, listLocalAlerts, setLastWatchCheck } from './alerts'
import { clearLocalScans } from './scans'
import { localAlerts, localHistory, saveScanWithAlerts } from './watch'

const checkWatchlist = vi.hoisted(() => vi.fn())
vi.mock('../http/watchlist', () => ({ checkWatchlist }))

const recallRef = {
  recallNumber: 'F-7-2026',
  productDescription: 'Raspberry Yogurt Parfait',
  classification: 'Class I' as const,
  status: 'Ongoing' as const,
  reportDate: '2026-10-10',
}

function scan(upc: string, createdAt: string): Scan {
  return {
    id: `scan-${upc}`,
    type: 'barcode',
    createdAt,
    product: { upc, name: 'Raspberry Yogurt Parfait', brand: 'Bonya' },
    items: [{ id: `item-${upc}`, name: 'Raspberry Yogurt Parfait', brand: 'Bonya', upc, status: 'clear', recallNumbers: [] }],
    matchedRecalls: [],
    verdict: null,
    counts: { total: 1, confirmed: 0, possible: 0, clear: 1, error: 0 },
  }
}

const result = (matches: WatchCheckResult['matches']): WatchCheckResult => ({
  checkedAt: '2026-10-16T12:00:00Z',
  since: '2026-09-26',
  matches,
})

describe('guest re-check', () => {
  beforeEach(() => {
    clearLocalScans()
    clearLocalAlerts()
    checkWatchlist.mockReset()
  })

  it('skips the server when there are no products', async () => {
    expect((await localAlerts.recheck()).skipped).toBe(true)
    expect(checkWatchlist).not.toHaveBeenCalled()
  })

  it('sends products since the oldest scan, then since the last check', async () => {
    saveScanWithAlerts(scan('012345678905', '2026-10-01T09:00:00Z'))
    saveScanWithAlerts(scan('4006381333931', '2026-10-05T09:00:00Z'))
    checkWatchlist.mockResolvedValue(result([]))
    await localAlerts.recheck()
    expect(checkWatchlist).toHaveBeenLastCalledWith({
      items: [
        { id: 'barcode-4006381333931', upc: '4006381333931', name: 'Raspberry Yogurt Parfait', brand: 'Bonya' },
        { id: 'barcode-012345678905', upc: '012345678905', name: 'Raspberry Yogurt Parfait', brand: 'Bonya' },
      ],
      since: '2026-10-01',
    })
    expect(lastWatchCheck()).toBe('2026-10-16T12:00:00Z')
    await localAlerts.recheck()
    expect(checkWatchlist.mock.lastCall?.[0].since).toBe('2026-10-16')
  })

  it('turns matches into alerts once and raises the product status', async () => {
    saveScanWithAlerts(scan('012345678905', '2026-10-01T09:00:00Z'))
    const match = { itemId: 'barcode-012345678905', recallNumber: 'F-7-2026', confidence: 'possible' as const, recall: recallRef }
    checkWatchlist.mockResolvedValue(result([match, { ...match, itemId: 'barcode-deleted' }]))
    const first = await localAlerts.recheck()
    expect(first.newAlerts.map((a) => [a.id, a.itemName])).toEqual([['F-7-2026_barcode-012345678905', 'Bonya Raspberry Yogurt Parfait']])
    expect((await localAlerts.recheck()).newAlerts).toEqual([]) // already known
    const [product] = await localHistory.listProducts()
    expect(product).toMatchObject({ status: 'possible', recallNumbers: ['F-7-2026'] })
    // Dismissing the alert puts the product back to its scan status
    await localAlerts.dismiss('F-7-2026_barcode-012345678905')
    expect((await localHistory.listProducts())[0].status).toBe('clear')
  })

  it('lists only alerts whose product is still on the device', async () => {
    saveScanWithAlerts(scan('012345678905', '2026-10-01T09:00:00Z'))
    const match = { itemId: 'barcode-012345678905', recallNumber: 'F-7-2026', confidence: 'possible' as const, recall: recallRef }
    checkWatchlist.mockResolvedValue(result([match]))
    await localAlerts.recheck()
    clearLocalScans() // the product drops off (e.g. after 50 newer products)
    expect(await localAlerts.list()).toEqual([])
  })

  it('does not move the window forward when new alerts could not be saved', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === 'rg-alerts-v1' && v.length > 2) throw new Error('QuotaExceededError') // alerts don't fit
        store.set(k, v)
      },
    })
    try {
      saveScanWithAlerts(scan('012345678905', '2026-10-01T09:00:00Z'))
      setLastWatchCheck('2026-10-10T00:00:00Z')
      const match = { itemId: 'barcode-012345678905', recallNumber: 'F-7-2026', confidence: 'possible' as const, recall: recallRef }
      checkWatchlist.mockResolvedValue(result([match]))
      expect((await localAlerts.recheck()).newAlerts).toHaveLength(1)
      expect(lastWatchCheck()).toBe('2026-10-10T00:00:00Z')
      // The next check finds them as known, but they still aren't saved: the window stays put
      expect((await localAlerts.recheck()).newAlerts).toHaveLength(0)
      expect(lastWatchCheck()).toBe('2026-10-10T00:00:00Z')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a failed check keeps the last check time', async () => {
    saveScanWithAlerts(scan('012345678905', '2026-10-01T09:00:00Z'))
    setLastWatchCheck('2026-10-10T00:00:00Z')
    checkWatchlist.mockRejectedValue(new Error('offline'))
    await expect(localAlerts.recheck()).rejects.toThrow('offline')
    expect(lastWatchCheck()).toBe('2026-10-10T00:00:00Z')
  })

  it('a scan with a match creates its alert; deleting the product removes it', async () => {
    const s = scan('012345678905', '2026-10-01T09:00:00Z')
    saveScanWithAlerts({
      ...s,
      items: [{ ...s.items[0], status: 'confirmed', recallNumbers: ['F-7-2026'] }],
      matchedRecalls: [{ ...recallRef, eventId: '1', reasonForRecall: 'r', recallingFirm: 'f', recallInitiationDate: '2026-10-01', summary: null }],
      counts: { total: 1, confirmed: 1, possible: 0, clear: 0, error: 0 },
    })
    expect(listLocalAlerts().map((a) => a.confidence)).toEqual(['confirmed'])
    await localHistory.deleteProduct('barcode-012345678905')
    expect(listLocalAlerts()).toEqual([])
    expect(await localHistory.listProducts()).toEqual([])
  })
})
