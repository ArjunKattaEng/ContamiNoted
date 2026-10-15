// Keeps the synthetic data internally consistent: each scenario must produce the outcome it claims.
import { describe, expect, it } from 'vitest'
import { isValidGtin, upcAppearsIn } from '@/lib/barcode'
import { productFixtures, sampleBarcodes } from './data/products'
import { lateRecallNumbers, recallByKey, recallFixtures } from './data/recalls'
import { receiptFixtures } from './data/receipts'

describe('recall fixtures', () => {
  it('have unique recall numbers and event ids', () => {
    expect(new Set(recallFixtures.map((r) => r.recallNumber)).size).toBe(recallFixtures.length)
    expect(new Set(recallFixtures.map((r) => r.eventId)).size).toBe(recallFixtures.length)
  })

  it('are sorted newest report date first, with report on/after initiation', () => {
    for (let i = 1; i < recallFixtures.length; i++) {
      expect(recallFixtures[i - 1].reportDate >= recallFixtures[i].reportDate).toBe(true)
    }
    for (const r of recallFixtures) expect(r.reportDate >= r.recallInitiationDate).toBe(true)
  })

  it('cover both tabs and all three classes', () => {
    expect(recallFixtures.some((r) => r.status === 'Ongoing')).toBe(true)
    expect(recallFixtures.some((r) => r.status !== 'Ongoing')).toBe(true)
    expect(new Set(recallFixtures.map((r) => r.classification))).toEqual(new Set(['Class I', 'Class II', 'Class III']))
  })

  it('all have a short summary and every summary section', () => {
    for (const r of recallFixtures) {
      expect(r.summary?.shortSummary).toBeTruthy()
      const sections = r.summary?.sections
      expect(sections).toBeDefined()
      for (const value of Object.values(sections!)) expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('have exactly one late recall, reported most recently', () => {
    expect(lateRecallNumbers.size).toBe(1)
    expect(lateRecallNumbers.has(recallFixtures[0].recallNumber)).toBe(true)
  })
})

describe('product fixtures', () => {
  it('all have valid, unique UPCs', () => {
    for (const p of productFixtures) expect(isValidGtin(p.upc), p.upc).toBe(true)
    expect(new Set(productFixtures.map((p) => p.upc)).size).toBe(productFixtures.length)
  })

  it('confirmed products appear in their recall text; possible ones do not', () => {
    for (const p of productFixtures) {
      for (const key of p.recallKeys) {
        const recall = recallByKey[key]
        expect(recall, key).toBeDefined()
        expect(upcAppearsIn(recall.codeInfo ?? '', p.upc), `${p.name} vs ${key}`).toBe(p.status === 'confirmed')
      }
      expect(p.recallKeys.length > 0).toBe(p.status === 'confirmed' || p.status === 'possible')
    }
  })

  it('late-recall products appear in the late recall text', () => {
    for (const p of productFixtures.filter((x) => x.lateRecallKey)) {
      const recall = recallByKey[p.lateRecallKey!]
      expect(lateRecallNumbers.has(recall.recallNumber)).toBe(true)
      expect(upcAppearsIn(recall.codeInfo ?? '', p.upc)).toBe(true)
    }
  })

  it('sample barcodes behave as labelled', () => {
    const byUpc = new Map(productFixtures.map((p) => [p.upc, p]))
    expect(byUpc.get(sampleBarcodes.confirmed)?.status).toBe('confirmed')
    expect(byUpc.get(sampleBarcodes.possible)?.status).toBe('possible')
    expect(byUpc.get(sampleBarcodes.clear)?.status).toBe('clear')
    expect(isValidGtin(sampleBarcodes.unknown)).toBe(true)
    expect(byUpc.has(sampleBarcodes.unknown)).toBe(false)
    expect(isValidGtin(sampleBarcodes.invalid)).toBe(false)
  })
})

describe('receipt fixtures', () => {
  const lines = Object.values(receiptFixtures).flatMap((r) => r.lines)

  it('have the advertised scenario counts', () => {
    const count = (id: keyof typeof receiptFixtures, status: string) => receiptFixtures[id].lines.filter((l) => l.status === status).length
    expect(receiptFixtures.A.lines).toHaveLength(12)
    expect(count('A', 'clear')).toBe(12)
    expect(receiptFixtures.B.lines).toHaveLength(18)
    expect([count('B', 'confirmed'), count('B', 'possible')]).toEqual([1, 1])
    expect(receiptFixtures.C.lines).toHaveLength(9)
    expect(count('C', 'error')).toBe(2)
  })

  it('only reference existing recalls, consistent with printed UPCs', () => {
    for (const line of lines) {
      for (const key of line.recallKeys ?? []) {
        const recall = recallByKey[key]
        expect(recall, key).toBeDefined()
        if (line.upc) expect(upcAppearsIn(recall.codeInfo ?? '', line.upc)).toBe(line.status === 'confirmed')
      }
      if (line.upc) expect(isValidGtin(line.upc), line.raw).toBe(true)
    }
  })
})
