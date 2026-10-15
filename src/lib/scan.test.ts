import { describe, expect, it } from 'vitest'
import { byAttention, formatPrice, itemOrigin, overallStatus, scanPath } from './scan'

describe('scan helpers', () => {
  it('builds result routes', () => {
    expect(scanPath({ type: 'receipt', id: 'scan_1' })).toBe('/scan/receipt/scan_1')
  })

  it('picks the most serious status', () => {
    const counts = (c: Partial<Record<'confirmed' | 'possible' | 'error' | 'clear', number>>) => ({
      counts: { total: 0, confirmed: 0, possible: 0, clear: 0, error: 0, ...c },
    })
    expect(overallStatus(counts({ clear: 3, possible: 1, confirmed: 1 }))).toBe('confirmed')
    expect(overallStatus(counts({ clear: 3, error: 2, possible: 1 }))).toBe('possible')
    expect(overallStatus(counts({ clear: 3, error: 2 }))).toBe('error')
    expect(overallStatus(counts({ clear: 3 }))).toBe('clear')
  })

  it('orders flagged items first, stable within a status', () => {
    const items = [
      { id: 'a', status: 'clear' as const },
      { id: 'b', status: 'error' as const },
      { id: 'c', status: 'possible' as const },
      { id: 'd', status: 'clear' as const },
      { id: 'e', status: 'confirmed' as const },
    ]
    expect(byAttention(items).map((i) => i.id)).toEqual(['e', 'c', 'b', 'a', 'd'])
  })

  it('labels where an item came from', () => {
    expect(itemOrigin({ source: 'barcode' })).toBe('Scanned product')
    expect(itemOrigin({ source: 'receipt', store: 'Valley Foods #0412' })).toBe('Receipt · Valley Foods #0412')
    expect(itemOrigin({ source: 'receipt' })).toBe('From a receipt')
  })

  it('formats prices', () => {
    expect(formatPrice(3.5)).toBe('$3.50')
  })
})
