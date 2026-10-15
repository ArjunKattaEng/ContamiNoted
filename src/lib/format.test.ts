import { describe, expect, it } from 'vitest'
import { ageInDays, formatDate, formatRelativeDate, formatReported, formatTimeAgo } from './format'

const now = new Date(2026, 9, 14, 15, 30) // Oct 14, 2026, 3:30 pm local

describe('date formatting', () => {
  it('counts whole days from local midnight', () => {
    expect(ageInDays('2026-10-14', now)).toBe(0)
    expect(ageInDays('2026-10-13', now)).toBe(1)
    expect(ageInDays('2026-10-01', now)).toBe(13)
  })

  it('formats calendar dates', () => {
    expect(formatDate('2026-10-05')).toBe('Oct 5, 2026')
  })

  it('uses relative wording for the last week only', () => {
    expect(formatRelativeDate('2026-10-14', now)).toBe('Today')
    expect(formatRelativeDate('2026-10-13', now)).toBe('Yesterday')
    expect(formatRelativeDate('2026-10-10', now)).toBe('4 days ago')
    expect(formatRelativeDate('2026-10-05', now)).toBe('Oct 5, 2026')
  })

  it('builds the "Reported …" line without lowercasing month names', () => {
    expect(formatReported('2026-10-10', now)).toBe('Reported 4 days ago')
    expect(formatReported('2026-10-14', now)).toBe('Reported today')
    expect(formatReported('2026-10-05', now)).toBe('Reported Oct 5, 2026')
  })
})

describe('formatTimeAgo', () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  it('describes recent timestamps', () => {
    expect(formatTimeAgo(ago(20_000), now)).toBe('just now')
    expect(formatTimeAgo(ago(60_000), now)).toBe('1 minute ago')
    expect(formatTimeAgo(ago(5 * 60_000), now)).toBe('5 minutes ago')
    expect(formatTimeAgo(ago(3 * 3_600_000), now)).toBe('3 hours ago')
    expect(formatTimeAgo(ago(30 * 3_600_000), now)).toBe('yesterday')
    expect(formatTimeAgo(ago(5 * 86_400_000), now)).toBe('Oct 9, 2026')
  })
})
