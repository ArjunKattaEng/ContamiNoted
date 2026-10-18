import { Receipt, ScanBarcode, ScanLine, Search, Star, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertBanner } from '@/components/AlertBanner'
import { RecallCardSkeleton } from '@/components/RecallCard'
import { RecallList } from '@/components/RecallList'
import { RowCard, RowMeta } from '@/components/RowCard'
import { IconTile, ProductImage, ReceiptRow } from '@/components/ScanRows'
import { MatchStatusBadge } from '@/components/ScanStatus'
import { Screen, SectionTitle } from '@/components/Screen'
import { ErrorState } from '@/components/StateViews'
import { TopBar } from '@/components/TopBar'
import { useActiveAlerts } from '@/hooks/use-alerts'
import { useProducts } from '@/hooks/use-products'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useRecentRecalls } from '@/hooks/use-recalls'
import { useSavedRecalls } from '@/hooks/use-saved'
import { useScanHistory } from '@/hooks/use-scans'
import { canScan, features } from '@/lib/features'
import { scanPath } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { WatchItem } from '@/types'

const quickActions: { label: string; icon: LucideIcon; to: string; show: boolean }[] = [
  { label: 'Scan receipt', icon: Receipt, to: '/scan?mode=receipt', show: features.receiptScan },
  { label: 'Scan product', icon: ScanBarcode, to: '/scan?mode=product', show: features.barcodeScan },
  { label: 'Check recalls', icon: Search, to: '/recalls', show: true },
]

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-semibold text-primary hover:underline">
      See all
    </Link>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <RecallCardSkeleton key={i} />
      ))}
    </div>
  )
}

function LatestRecalls() {
  const query = useRecentRecalls('active')
  if (query.isPending) return <ListSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const latest = query.data.pages[0].items.slice(0, 3)
  if (latest.length === 0) return <p className="text-sm text-muted-foreground">No active food recalls right now.</p>
  return <RecallList recalls={latest} grid={false} />
}

function SavedRecalls() {
  const query = useSavedRecalls()
  if (query.isPending) return <ListSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.length === 0) {
    return (
      <RowCard variant="box" className="border-dashed">
        <IconTile icon={Star} />
        <RowMeta title="No saved recalls yet">Tap the star on a recall to keep it here.</RowMeta>
      </RowCard>
    )
  }
  return <RecallList recalls={query.data.slice(0, 3).map((s) => s.recall)} grid={false} />
}

function RecentReceipts() {
  const navigate = useNavigate()
  const query = useScanHistory('receipt')
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[66px] w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.length === 0) {
    return (
      <RowCard variant="box" onClick={() => navigate('/scan?mode=receipt')} className="border-dashed">
        <IconTile icon={Receipt} />
        <RowMeta title="Scan your first receipt">We’ll check every item for recalls.</RowMeta>
      </RowCard>
    )
  }
  return (
    <div className="flex flex-col">
      {query.data.slice(0, 3).map((scan) => (
        <ReceiptRow key={scan.id} scan={scan} onOpen={() => navigate(scanPath(scan))} />
      ))}
    </div>
  )
}

/** The newest scanned products with their photo and status, as Yuka's home shows your scan history. */
function YourProducts({ products }: { products: WatchItem[] }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col">
      {products.slice(0, 3).map((item) => (
        <RowCard key={item.id} onClick={() => navigate(scanPath({ type: item.source, id: item.scanId }))}>
          <ProductImage src={item.imageUrl} className="size-12" />
          <RowMeta title={<span className="line-clamp-1">{item.name}</span>}>
            {item.brand && <span className="block truncate text-xs">{item.brand}</span>}
            <span className="mt-1 block">
              <MatchStatusBadge status={item.status} />
            </span>
          </RowMeta>
        </RowCard>
      ))}
    </div>
  )
}

/** Shown while barcode/receipt scanning isn't available yet. */
function ScanningComingSoon() {
  return (
    <RowCard variant="box" className="mt-1 border-dashed desktop:max-w-2xl">
      <IconTile icon={ScanLine} />
      <RowMeta title="Scanning is coming soon">
        Scan a product’s barcode or a grocery receipt and we’ll check it against FDA recalls.
      </RowMeta>
    </RowCard>
  )
}

export default function Home() {
  useDocumentTitle()
  const navigate = useNavigate()
  const alerts = useActiveAlerts()
  const products = useProducts().data ?? []
  // The green all-clear needs scanned products and none flagged (a dismissed alert's product keeps its scan status)
  const showBanner =
    (alerts.data?.length ?? 0) > 0 || (products.length > 0 && products.every((p) => p.status === 'clear' || p.status === 'error'))
  const actions = quickActions.filter((a) => a.show)

  return (
    <Screen className="pt-safe-top desktop:pt-8">
      <TopBar />
      <h1 className="mb-4 hidden text-2xl font-bold desktop:block">Home</h1>
      {features.alerts && alerts.data && showBanner && <AlertBanner count={alerts.data.length} />}

      {canScan ? (
        <>
          <SectionTitle>Quick actions</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 desktop:max-w-2xl">
            {actions.map(({ label, icon: Icon, to }, i) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg px-1 py-3.5 text-[13px] font-semibold shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // The first action (scanning) is the main one, as the camera tab is in scanner apps
                  i === 0
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border/60 bg-card hover:bg-accent/60',
                )}
              >
                <span
                  className={cn('grid size-10 place-items-center rounded-full', i === 0 ? 'bg-primary-foreground/15' : 'bg-secondary text-secondary-foreground')}
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <ScanningComingSoon />
      )}

      {features.history && products.length > 0 && (
        <section className="desktop:max-w-2xl">
          <SectionTitle className="flex items-baseline justify-between">
            Your products
            <SeeAll to="/products" />
          </SectionTitle>
          <YourProducts products={products} />
        </section>
      )}

      <div className="desktop:mt-4 desktop:grid desktop:grid-cols-2 desktop:gap-8">
        <section>
          <SectionTitle className="flex items-baseline justify-between">
            Latest recalls
            <SeeAll to="/recalls" />
          </SectionTitle>
          <LatestRecalls />
        </section>

        {features.history && features.receiptScan ? (
          <section>
            <SectionTitle className="flex items-baseline justify-between">
              Recent receipts
              <SeeAll to="/receipts" />
            </SectionTitle>
            <RecentReceipts />
          </section>
        ) : (
          <section>
            <SectionTitle className="flex items-baseline justify-between">
              Saved recalls
              <SeeAll to="/recalls?tab=saved" />
            </SectionTitle>
            <SavedRecalls />
          </section>
        )}
      </div>
    </Screen>
  )
}
