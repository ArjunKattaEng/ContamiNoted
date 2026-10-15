import { Receipt, type LucideIcon } from 'lucide-react'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { formatPrice } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { Scan } from '@/types'
import { RowCard, RowMeta, RowTrailing } from './RowCard'
import { ScanStatusBadge } from './ScanStatus'

/** Square icon tile used instead of product photos. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={cn('grid size-10 flex-none place-items-center rounded-md bg-muted', className)} aria-hidden>
      <Icon className="size-5 text-muted-foreground" />
    </div>
  )
}

/** Receipt row for history lists and Home. */
export function ReceiptRow({ scan, onOpen }: { scan: Scan; onOpen: () => void }) {
  return (
    <RowCard onClick={onOpen}>
      <IconTile icon={Receipt} />
      <RowMeta title={scan.store ?? 'Receipt'}>
        {scan.purchaseDate ? formatDate(scan.purchaseDate) : formatTimestampDate(scan.createdAt)} · {scan.counts.total}{' '}
        {scan.counts.total === 1 ? 'item' : 'items'}
      </RowMeta>
      <RowTrailing>
        {scan.total !== undefined && <span className="text-sm tabular-nums">{formatPrice(scan.total)}</span>}
        <ScanStatusBadge scan={scan} />
      </RowTrailing>
    </RowCard>
  )
}
