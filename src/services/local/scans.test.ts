import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchStatus, Scan } from '@/types'
import { ApiError } from '../errors'
import { MAX_LOCAL_SCANS, clearLocalScans, deleteLocalProduct, getLocalScan, listLocalProducts, localScanHistory, saveLocalScan } from './scans'

let n = 0
function barcodeScan(upc: string, status: MatchStatus = 'clear'): Scan {
  n += 1
  return {
    id: `scan-${n}`,
    type: 'barcode',
    createdAt: `2026-10-16T12:00:${String(n % 60).padStart(2, '0')}Z`,
    product: { upc, name: `Product ${upc}`, brand: 'Brand', size: '8 oz' },
    items: [{ id: `item-${n}`, name: `Product ${upc}`, brand: 'Brand', upc, status, recallNumbers: status === 'clear' ? [] : ['F-0001-2026'] }],
    matchedRecalls: [],
    verdict: { headline: 'h', details: 'd', nextSteps: [] },
    counts: { total: 1, confirmed: 0, possible: 0, clear: 1, error: 0 },
  }
}

describe('local scans', () => {
  beforeEach(() => clearLocalScans())
  afterEach(() => vi.unstubAllGlobals())

  it('saves and reads back a scan', () => {
    const scan = barcodeScan('012345678905')
    saveLocalScan(scan)
    expect(getLocalScan(scan.id)).toEqual(scan)
  })

  it('throws not_found for an unknown scan', () => {
    expect(() => getLocalScan('nope')).toThrow(ApiError)
    try {
      getLocalScan('nope')
    } catch (err) {
      expect((err as ApiError).code).toBe('not_found')
    }
  })

  it('lists one product per barcode, from the latest scan, newest first', async () => {
    const first = barcodeScan('012345678905', 'clear')
    saveLocalScan(first)
    saveLocalScan(barcodeScan('4006381333931'))
    const rescan = barcodeScan('012345678905', 'confirmed')
    saveLocalScan(rescan)
    const products = listLocalProducts()
    expect(products.map((p) => p.upc)).toEqual(['012345678905', '4006381333931'])
    expect(products[0]).toMatchObject({ scanId: rescan.id, status: 'confirmed', source: 'barcode', size: '8 oz' })
    // A rescan replaces the earlier scan of that barcode; the earlier id still opens the latest result
    expect(await localScanHistory.listScans('barcode')).toHaveLength(2)
    expect(getLocalScan(first.id).id).toBe(rescan.id)
    expect(await localScanHistory.listScans('receipt')).toHaveLength(0)
  })

  it('deleting a product forgets its scans', () => {
    saveLocalScan(barcodeScan('012345678905'))
    const other = barcodeScan('4006381333931')
    saveLocalScan(other)
    deleteLocalProduct('barcode-012345678905')
    expect(listLocalProducts().map((p) => p.upc)).toEqual(['4006381333931'])
    expect(getLocalScan(other.id)).toEqual(other)
  })

  it(`keeps the newest ${MAX_LOCAL_SCANS} scans`, async () => {
    for (let i = 0; i < MAX_LOCAL_SCANS + 5; i++) saveLocalScan(barcodeScan(String(i)))
    expect(await localScanHistory.listScans('barcode')).toHaveLength(MAX_LOCAL_SCANS)
  })

  it('keeps scans in memory when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('SecurityError')
      },
    })
    const scan = barcodeScan('012345678905')
    saveLocalScan(scan)
    expect(getLocalScan(scan.id)).toEqual(scan)
  })

  it('writes through to storage and trims old scans when storage is full', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > 1500) throw new Error('QuotaExceededError')
        store.set(k, v)
      },
    })
    for (let i = 0; i < 6; i++) saveLocalScan(barcodeScan(`10000000000${i}`))
    const stored = JSON.parse(store.get('rg-scans-v1') ?? '[]') as Scan[]
    expect(stored).toHaveLength(3) // as many as fit (each scan is ~430 characters), not just half
    expect(stored[0].items[0].upc).toBe('100000000005') // newest kept
    // Memory matches storage, so nothing silently disappears on the next reload
    expect(listLocalProducts()).toHaveLength(stored.length)
  })
})
