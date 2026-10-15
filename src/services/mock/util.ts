import type { Page } from '@/types'
import type { PageParams } from '../types'

export function paginate<T>(rows: T[], { page = 1, pageSize = 20 }: PageParams = {}): Page<T> {
  const size = Math.min(Math.max(pageSize, 1), 50)
  const start = (Math.max(page, 1) - 1) * size
  return { items: rows.slice(start, start + size), page, pageSize: size, total: rows.length, hasMore: start + size < rows.length }
}

export const nowIso = () => new Date().toISOString()

/** Today as YYYY-MM-DD in local time. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
