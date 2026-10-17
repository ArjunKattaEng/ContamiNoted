import type { MatchStatus, Scan, ScanType } from '@/types'

/** Route of a scan's result page. */
export const scanPath = (scan: Pick<Scan, 'type' | 'id'>) => `/scan/${scan.type}/${scan.id}`

/** Worst status in a scan: confirmed > possible > error > clear. */
export function overallStatus(scan: Pick<Scan, 'counts'>): MatchStatus {
  const { confirmed, possible, error } = scan.counts
  if (confirmed > 0) return 'confirmed'
  if (possible > 0) return 'possible'
  if (error > 0) return 'error'
  return 'clear'
}

/** Most serious first: confirmed > possible > error > clear. */
export const statusRank: Record<MatchStatus, number> = { confirmed: 0, possible: 1, error: 2, clear: 3 }

/** Sort flagged items first, keeping the receipt order within each status. */
export function byAttention<T extends { status: MatchStatus }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => statusRank[a.item.status] - statusRank[b.item.status] || a.i - b.i)
    .map(({ item }) => item)
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatPrice = (amount: number) => usd.format(amount)

/** "Brand Name", without repeating a brand the name already starts with. */
export const productTitle = ({ brand, name }: { brand?: string; name: string }) =>
  brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name

/** Where a watched item came from: "Scanned product" or "Receipt · Valley Foods #0412". */
export function itemOrigin({ source, store }: { source: ScanType; store?: string }): string {
  if (source === 'barcode') return 'Scanned product'
  return store ? `Receipt · ${store}` : 'From a receipt'
}
