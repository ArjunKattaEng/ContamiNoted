const DAY = 24 * 60 * 60 * 1000

const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days between a YYYY-MM-DD date (local midnight) and `now`. */
export function ageInDays(ymd: string, now = new Date()): number {
  return Math.floor((now.getTime() - parseYmd(ymd).getTime()) / DAY)
}

/** "Oct 10, 2026" */
export function formatDate(ymd: string): string {
  return parseYmd(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Today", "Yesterday", "4 days ago", or a date for anything older than a week. */
export function formatRelativeDate(ymd: string, now = new Date()): string {
  const days = ageInDays(ymd, now)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(ymd)
}

/** "Reported today", "Reported 4 days ago", "Reported Oct 5, 2026" */
export function formatReported(ymd: string, now = new Date()): string {
  const relative = formatRelativeDate(ymd, now)
  return `Reported ${ageInDays(ymd, now) < 7 ? relative.toLowerCase() : relative}`
}

/** Date part of an ISO timestamp in local time: "Oct 5, 2026" */
export function formatTimestampDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", then a date. */
export function formatTimeAgo(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  if (hours < 48) return 'yesterday'
  return formatTimestampDate(iso)
}
