import type { ReactNode } from 'react'
import { FileQuestion, Package } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RecallList } from '@/components/RecallList'
import { ScanDisclaimer, ScanItemRow, VerdictCard } from '@/components/ScanParts'
import { IconTile } from '@/components/ScanRows'
import { MatchStatusBadge, StatusIcon } from '@/components/ScanStatus'
import { Screen, SectionTitle } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useGoBack } from '@/hooks/use-go-back'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useScan } from '@/hooks/use-scans'
import { formatUpc } from '@/lib/barcode'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { byAttention, formatPrice } from '@/lib/scan'
import { isLive } from '@/services'
import { isApiError } from '@/services/errors'
import type { Scan, ScanType } from '@/types'

/** Loading / not found / error handling shared by both result pages. */
function ScanQueryState({ query, type }: { query: UseQueryResult<Scan>; type: ScanType }) {
  const navigate = useNavigate()
  if (query.isPending) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (isApiError(query.error, 'not_found')) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Scan not found"
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate(type === 'receipt' ? '/receipts' : '/products')}>
            {type === 'receipt' ? 'View receipts' : 'View products'}
          </Button>
        }
      >
        It may have been deleted, or it belongs to another account.
      </EmptyState>
    )
  }
  return <ErrorState error={query.error} onRetry={() => query.refetch()} />
}

/** Scan another / Done. A bottom bar on phones and tablets; inline in the side column on desktop. */
function ResultActions({ type, isDesktop }: { type: ScanType; isDesktop: boolean }) {
  const navigate = useNavigate()
  const goBack = useGoBack(type === 'receipt' ? '/receipts' : '/products')
  const buttons = (
    <>
      <Button variant="secondary" onClick={() => navigate(`/scan?mode=${type === 'receipt' ? 'receipt' : 'product'}`)}>
        Scan another
      </Button>
      <Button onClick={goBack}>Done</Button>
    </>
  )
  if (isDesktop) return <div className="grid grid-cols-2 gap-2">{buttons}</div>
  return (
    <div className="flex flex-none gap-2 border-t bg-card px-4 pb-[calc(12px+var(--safe-bottom))] pt-3 md:px-6">{buttons}</div>
  )
}

/** Desktop: main column + 360px side column. Phones/tablets: one column, actions pinned below. */
function ResultLayout({
  type,
  main,
  side,
}: {
  type: ScanType
  main: ReactNode
  side: ReactNode
}) {
  const isDesktop = useIsDesktop()
  if (isDesktop) {
    return (
      <Screen>
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
          <div className="space-y-4">{main}</div>
          <aside className="sticky top-0 space-y-4">
            <ResultActions type={type} isDesktop />
            {side}
          </aside>
        </div>
      </Screen>
    )
  }
  return (
    <>
      <Screen>
        <div className="space-y-4">
          {main}
          {side}
        </div>
      </Screen>
      <ResultActions type={type} isDesktop={false} />
    </>
  )
}

function MatchingRecalls({ scan }: { scan: Scan }) {
  if (scan.matchedRecalls.length === 0) return null
  return (
    <section>
      <SectionTitle className="mt-0">Matching recalls</SectionTitle>
      <RecallList recalls={scan.matchedRecalls} grid={false} />
    </section>
  )
}

export function ReceiptResult() {
  const { scanId } = useParams()
  const query = useScan(scanId)
  const header = <ScreenHeader title="Receipt check" backOnDesktop />

  if (!query.data) {
    return (
      <>
        {header}
        <Screen>
          <ScanQueryState query={query} type="receipt" />
        </Screen>
      </>
    )
  }

  const scan = query.data
  const items = byAttention(scan.items)
  const flagged = items.filter((i) => i.status !== 'clear')
  const clear = items.filter((i) => i.status === 'clear')
  const date = scan.purchaseDate ? formatDate(scan.purchaseDate) : formatTimestampDate(scan.createdAt)

  const main = (
    <>
      <div>
        <h2 className="text-lg font-bold desktop:text-xl">{scan.store ?? 'Receipt'}</h2>
        <p className="text-sm text-muted-foreground">
          Purchased {date} · {scan.counts.total} {scan.counts.total === 1 ? 'item' : 'items'}
          {scan.total !== undefined && ` · ${formatPrice(scan.total)}`}
        </p>
      </div>
      <div className="desktop:hidden">
        <VerdictCard verdict={scan.verdict} counts={scan.counts} />
      </div>
      {flagged.length > 0 && (
        <section>
          <SectionTitle className="mt-0">Needs attention ({flagged.length})</SectionTitle>
          <ul className="rounded-lg border bg-card px-3">
            {flagged.map((item) => (
              <ScanItemRow key={item.id} scanId={scan.id} item={item} />
            ))}
          </ul>
        </section>
      )}
      {clear.length > 0 && (
        <section>
          <SectionTitle className="mt-0">No recall found ({clear.length})</SectionTitle>
          <ul className="rounded-lg border bg-card px-3">
            {clear.map((item) => (
              <ScanItemRow key={item.id} scanId={scan.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </>
  )

  const side = (
    <>
      <div className="hidden desktop:block">
        <VerdictCard verdict={scan.verdict} counts={scan.counts} />
      </div>
      <MatchingRecalls scan={scan} />
      <ScanDisclaimer />
    </>
  )

  return (
    <>
      {header}
      <ResultLayout type="receipt" main={main} side={side} />
    </>
  )
}

export function BarcodeResult() {
  const { scanId } = useParams()
  const query = useScan(scanId)
  const header = <ScreenHeader title="Product check" backOnDesktop />

  if (!query.data) {
    return (
      <>
        {header}
        <Screen>
          <ScanQueryState query={query} type="barcode" />
        </Screen>
      </>
    )
  }

  const scan = query.data
  const item = scan.items[0]
  const product = scan.product

  const main = (
    <>
      <section className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <IconTile icon={Package} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="mb-1">
            <MatchStatusBadge status={item.status} />
          </div>
          <h2 className="font-bold leading-snug">{product?.name ?? item.name}</h2>
          {(product?.brand || product?.size) && (
            <p className="text-sm text-muted-foreground">{[product.brand, product.size].filter(Boolean).join(' · ')}</p>
          )}
          {product?.upc && <p className="mt-1 font-mono text-xs text-muted-foreground">UPC {formatUpc(product.upc)}</p>}
          <p className="text-xs text-muted-foreground">Scanned {formatTimestampDate(scan.createdAt)}</p>
        </div>
        <StatusIcon status={item.status} />
      </section>
      {item.note && <p className="text-sm">{item.note}</p>}
      {!isLive('scan') && product?.name === 'Unknown product' && (
        <p className="rounded-md border border-dashed bg-card p-3 text-sm text-muted-foreground">
          Demo mode: barcode scans are checked against a small catalog of fictional products, so real products show as
          unknown. Use <strong>Samples</strong> on the scan screen to try each result.
        </p>
      )}
      <VerdictCard verdict={scan.verdict} counts={scan.counts} />
    </>
  )

  const side = (
    <>
      <MatchingRecalls scan={scan} />
      <ScanDisclaimer />
    </>
  )

  return (
    <>
      {header}
      <ResultLayout type="barcode" main={main} side={side} />
    </>
  )
}
