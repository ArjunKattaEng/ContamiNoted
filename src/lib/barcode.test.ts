import { describe, expect, it } from 'vitest'
import { canonicalBarcode, formatUpc, isValidGtin, normalizeBarcode, toUpcA, upcAppearsIn } from './barcode'

describe('normalizeBarcode', () => {
  it('keeps only digits', () => {
    expect(normalizeBarcode(' 0-12345 67890-5 ')).toBe('012345678905')
  })
})

describe('isValidGtin', () => {
  it('accepts valid UPC-A, EAN-13, EAN-8 and GTIN-14 codes', () => {
    expect(isValidGtin('012345678905')).toBe(true) // UPC-A
    expect(isValidGtin('4006381333931')).toBe(true) // EAN-13
    expect(isValidGtin('96385074')).toBe(true) // EAN-8
    expect(isValidGtin('10012345678902')).toBe(true) // GTIN-14
  })

  it('rejects a wrong check digit, wrong length or non-digits', () => {
    expect(isValidGtin('012345678900')).toBe(false)
    expect(isValidGtin('12345')).toBe(false)
    expect(isValidGtin('01234567890a')).toBe(false)
    expect(isValidGtin('')).toBe(false)
  })
})

describe('toUpcA / canonicalBarcode', () => {
  it('turns EAN-13 with a leading 0 into UPC-A', () => {
    expect(toUpcA('0012345678905')).toBe('012345678905')
    expect(canonicalBarcode('0 012345 678905')).toBe('012345678905')
  })

  it('leaves other EAN-13 codes alone', () => {
    expect(toUpcA('4006381333931')).toBe('4006381333931')
  })
})

describe('upcAppearsIn', () => {
  it('matches UPCs printed with spaces or dashes', () => {
    expect(upcAppearsIn('UPC 0 84135 00101 9; lots BF2681', '084135001019')).toBe(true)
    expect(upcAppearsIn('UPC 0-86112-00412-9', '086112004129')).toBe(true)
  })

  it('does not match a UPC embedded in a longer number', () => {
    expect(upcAppearsIn('lot 9084135001019', '084135001019')).toBe(false)
    expect(upcAppearsIn('UPC 0 65734 00119 8', '065734001181')).toBe(false)
  })
})

describe('formatUpc', () => {
  it('groups a UPC-A as printed under the bars', () => {
    expect(formatUpc('012345678905')).toBe('0 12345 67890 5')
  })
})
