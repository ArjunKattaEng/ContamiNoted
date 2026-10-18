import type { ReactNode } from 'react'
import { FileQuestion, Search } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RecallList } from '@/components/RecallList'
import { ScanDisclaimer, ScanItemRow, VerdictCard } from '@/components/ScanParts'
import { ProductImage } from '@/components/ScanRows'
import { MatchStatusBadge } from '@/components/ScanStatus'
import { Screen, SectionTitle } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useGoBack } from '@/hooks/use-go-back'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useScan } from '@/hooks/use-scans'
import { formatUpc } from '@/lib/barcode'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { byAttention, formatPrice } from '@/lib/scan'
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(type === 'receipt' ? '/receipts' : '/products')}
          >
            {type === 'receipt' ? 'View receipts' : 'View products'}
          </Button>
        }
      >
        It may have been deleted, or it was made on another device.
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
    <div className="flex flex-none gap-2 border-t bg-card px-4 pb-[calc(12px+var(--safe-bottom))] pt-3 md:px-6">
      {buttons}
    </div>
  )
}

/** Desktop: main column + 360px side column. Phones/tablets: one column, actions pinned below. */
function ResultLayout({ type, main, side }: { type: ScanType; main: ReactNode; side: ReactNode }) {
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
          <ul className="rounded-lg border border-border/60 bg-card shadow-card px-3">
            {flagged.map((item) => (
              <ScanItemRow key={item.id} scanId={scan.id} item={item} />
            ))}
          </ul>
        </section>
      )}
      {clear.length > 0 && (
        <section>
          <SectionTitle className="mt-0">No recall found ({clear.length})</SectionTitle>
          <ul className="rounded-lg border border-border/60 bg-card shadow-card px-3">
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

const searchRecallsPath = (q: string | undefined) =>
  q && q !== 'Unknown product' ? `/recalls?q=${encodeURIComponent(q)}` : '/recalls'

export function BarcodeResult() {
  const navigate = useNavigate()
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
      {/* Product header in Yuka's layout: photo, name, brand, then the status as a big colored dot */}
      <section className="flex items-center gap-4 border-b pb-4">
        <ProductImage src={product?.imageUrl} className="size-24 [&_svg]:size-8" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-snug">{product?.name ?? item.name}</h2>
          {(product?.brand || product?.size) && (
            <p className="text-sm text-muted-foreground">{[product.brand, product.size].filter(Boolean).join(' · ')}</p>
          )}
          <div className="my-2">
            <MatchStatusBadge status={item.status} large />
          </div>
          {product?.upc && (
            <p className="font-mono text-xs text-muted-foreground">
              {product.upc.length === 12 ? `UPC ${formatUpc(product.upc)}` : `Barcode ${product.upc}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Scanned {formatTimestampDate(scan.createdAt)}</p>
        </div>
      </section>
      {item.note && <p className="text-sm">{item.note}</p>}
      <VerdictCard verdict={scan.verdict} counts={scan.counts} />
      {item.status === 'clear' && (
        // A search by brand or name can find a recall that doesn't print this barcode
        <Button variant="secondary" onClick={() => navigate(searchRecallsPath(product?.brand ?? product?.name))}>
          <Search /> Search recalls by name
        </Button>
      )}
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
