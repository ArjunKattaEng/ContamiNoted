import { useState } from 'react'
import { Package, Receipt, type LucideIcon } from 'lucide-react'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { formatPrice } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { Scan } from '@/types'
import { RowCard, RowMeta, RowTrailing } from './RowCard'
import { ScanStatusBadge } from './ScanStatus'

/** Square icon tile used instead of product photos. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={cn('grid size-10 flex-none place-items-center rounded-md bg-secondary', className)} aria-hidden>
      <Icon className="size-5 text-secondary-foreground" />
    </div>
  )
}

/**
 * The product's photo from Open Food Facts (as in scanner apps like Yuka), or a package icon when there is
 * none or it doesn't load. No referrer, so Open Food Facts doesn't learn which page showed it.
 */
export function ProductImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <IconTile icon={Package} className={className} />
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('flex-none rounded-md bg-white object-contain', className)}
    />
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
