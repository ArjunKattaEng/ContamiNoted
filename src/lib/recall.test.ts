import { describe, expect, it } from 'vitest'
import { DEFAULT_RECALL_WINDOW, parseRecallWindow, recallPath, recallWindowLabel, toRecallRef } from './recall'

describe('recall time windows', () => {
  it('defaults to 30 days', () => {
    expect(DEFAULT_RECALL_WINDOW).toBe(30)
    expect(parseRecallWindow(null)).toBe(30)
    expect(parseRecallWindow('')).toBe(30)
  })

  it('accepts listed windows and "all"', () => {
    expect(parseRecallWindow('7')).toBe(7)
    expect(parseRecallWindow('365')).toBe(365)
    expect(parseRecallWindow('all')).toBeNull()
  })

  it('falls back to the default for anything else', () => {
    expect(parseRecallWindow('12')).toBe(30)
    expect(parseRecallWindow('abc')).toBe(30)
  })

  it('labels windows for sentences', () => {
    expect(recallWindowLabel(30)).toBe('last 30 days')
    expect(recallWindowLabel(null)).toBe('all time')
  })
})

describe('recall refs', () => {
  it('keeps the closing date only when present', () => {
    const base = {
      recallNumber: 'H-1-2026',
      productDescription: 'P',
      classification: 'Class I',
      status: 'Terminated',
      reportDate: '2026-01-01',
    } as const
    expect(toRecallRef({ ...base, terminationDate: '2026-09-30' }).terminationDate).toBe('2026-09-30')
    expect('terminationDate' in toRecallRef(base)).toBe(false)
  })

  it('builds detail paths', () => {
    expect(recallPath('H-1407-2026')).toBe('/recalls/H-1407-2026')
  })
})
