import { Receipt, ScanBarcode, ScanLine, Search, Star, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertBanner } from '@/components/AlertBanner'
import { RecallCardSkeleton } from '@/components/RecallCard'
import { RecallList } from '@/components/RecallList'
import { RowCard, RowMeta } from '@/components/RowCard'
import { IconTile, ReceiptRow } from '@/components/ScanRows'
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

const quickActions: { label: string; icon: LucideIcon; to: string; show: boolean }[] = [
  { label: 'Scan Receipt', icon: Receipt, to: '/scan?mode=receipt', show: features.receiptScan },
  { label: 'Scan Product', icon: ScanBarcode, to: '/scan?mode=product', show: features.barcodeScan },
  { label: 'Check Recalls', icon: Search, to: '/recalls', show: true },
]

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="text-xs normal-case tracking-normal text-foreground underline underline-offset-2">
      See all
    </Link>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
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
      <RowCard className="border-dashed">
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
      <RowCard onClick={() => navigate('/scan?mode=receipt')} className="border-dashed">
        <IconTile icon={Receipt} />
        <RowMeta title="Scan your first receipt">We’ll check every item for recalls.</RowMeta>
      </RowCard>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {query.data.slice(0, 3).map((scan) => (
        <ReceiptRow key={scan.id} scan={scan} onOpen={() => navigate(scanPath(scan))} />
      ))}
    </div>
  )
}

/** Shown while barcode/receipt scanning isn't available yet. */
function ScanningComingSoon() {
  return (
    <RowCard className="mt-1 border-dashed desktop:max-w-2xl">
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
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 desktop:max-w-2xl">
            {actions.map(({ label, icon: Icon, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] bg-card px-1 py-3.5 text-[11px] font-bold uppercase hover:bg-accent"
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <ScanningComingSoon />
      )}

      <div className="desktop:mt-4 desktop:grid desktop:grid-cols-2 desktop:gap-8">
        <section>
          <SectionTitle className="flex items-baseline justify-between">
            Latest Recalls
            <SeeAll to="/recalls" />
          </SectionTitle>
          <LatestRecalls />
        </section>

        {features.history && features.receiptScan ? (
          <section>
            <SectionTitle className="flex items-baseline justify-between">
              Recent Receipts
              <SeeAll to="/receipts" />
            </SectionTitle>
            <RecentReceipts />
          </section>
        ) : (
          <section>
            <SectionTitle className="flex items-baseline justify-between">
              Saved Recalls
              <SeeAll to="/recalls?tab=saved" />
            </SectionTitle>
            <SavedRecalls />
          </section>
        )}
      </div>
    </Screen>
  )
}
