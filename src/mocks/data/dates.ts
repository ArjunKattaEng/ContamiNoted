// Fixture dates are relative to "now" so the synthetic data always looks current.

const DAY = 24 * 60 * 60 * 1000

/** Calendar date `n` days ago, YYYY-MM-DD (local time). */
export function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from.getTime() - n * DAY)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO timestamp `n` days ago at the given local hour. */
export function timestampDaysAgo(n: number, hour = 12, from = new Date()): string {
  const d = new Date(from.getTime() - n * DAY)
  d.setHours(hour, (n * 7) % 60, 0, 0)
  return d.toISOString()
}
