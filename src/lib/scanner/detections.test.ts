import { describe, expect, it } from 'vitest'
import { createReadConfirmer, pickDetection, polygonArea, toDetection } from './detections'

const corners = (size: number) => [
  { x: 0, y: 0 },
  { x: size, y: 0 },
  { x: size, y: size },
  { x: 0, y: size },
]

describe('toDetection', () => {
  it('keeps product barcodes with a correct check digit, in canonical form', () => {
    expect(toDetection({ text: '3017620422003', format: 'EAN13', corners: [] })?.code).toBe('3017620422003')
    // EAN-13 with a leading zero is a UPC-A, as typed codes are
    expect(toDetection({ text: '0041570054529', format: 'EAN13', corners: [] })?.code).toBe('041570054529')
    // UPC-E is expanded to UPC-A (its check digit belongs to the expanded code)
    expect(toDetection({ text: '01234565', format: 'UPCE', corners: [] })?.code).toBe('012345000065')
    expect(toDetection({ text: '96385074', format: 'EAN8', corners: [] })?.code).toBe('96385074')
  })

  it('drops misreads and anything that is not a product number', () => {
    expect(toDetection({ text: '3017620422004', format: 'EAN13', corners: [] })).toBeNull() // check digit
    expect(toDetection({ text: '12345', format: 'EAN13', corners: [] })).toBeNull()
    expect(toDetection({ text: 'https://example.com', format: 'QRCode', corners: [] })).toBeNull()
    expect(toDetection({ text: '', format: 'EAN13', corners: [] })).toBeNull()
  })
})

describe('pickDetection', () => {
  it('picks the biggest barcode (the product held closest)', () => {
    const far = { code: '3017620422003', format: 'EAN13', corners: corners(10) }
    const near = { code: '041570054529', format: 'UPCA', corners: corners(50) }
    expect(pickDetection([far, near])).toBe(near)
    expect(pickDetection([])).toBeNull()
  })

  it('measures polygons', () => {
    expect(polygonArea(corners(4))).toBe(16)
    expect(polygonArea(corners(4).reverse())).toBe(16)
    expect(polygonArea([{ x: 0, y: 0 }])).toBe(0)
  })
})

describe('createReadConfirmer', () => {
  it('accepts a code once two reads agree within the window', () => {
    const confirmer = createReadConfirmer({ needed: 2, windowMs: 1000 })
    expect(confirmer.add('A', 0)).toBe(false)
    expect(confirmer.add('B', 100)).toBe(false) // a different (mis)read doesn't count towards A
    expect(confirmer.add('A', 200)).toBe(true)
  })

  it('forgets reads older than the window', () => {
    const confirmer = createReadConfirmer({ needed: 2, windowMs: 1000 })
    expect(confirmer.add('A', 0)).toBe(false)
    expect(confirmer.add('A', 1500)).toBe(false)
    expect(confirmer.add('A', 2000)).toBe(true)
  })

  it('starts over after reset', () => {
    const confirmer = createReadConfirmer()
    confirmer.add('A', 0)
    confirmer.reset()
    expect(confirmer.add('A', 10)).toBe(false)
  })
})
