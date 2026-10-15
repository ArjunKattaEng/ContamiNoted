import { Receipt, ScanBarcode, Search, type LucideIcon } from 'lucide-react'
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
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useRecentRecalls } from '@/hooks/use-recalls'
import { useScanHistory } from '@/hooks/use-scans'
import { scanPath } from '@/lib/scan'

const quickActions: { label: string; icon: LucideIcon; to: string }[] = [
  { label: 'Scan Receipt', icon: Receipt, to: '/scan?mode=receipt' },
  { label: 'Scan Product', icon: ScanBarcode, to: '/scan?mode=product' },
  { label: 'Check Recalls', icon: Search, to: '/recalls' },
]

function LatestRecalls() {
  const query = useRecentRecalls('active')

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <RecallCardSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const latest = query.data.pages[0].items.slice(0, 3)
  if (latest.length === 0) return <p className="text-sm text-muted-foreground">No active food recalls right now.</p>
  return <RecallList recalls={latest} grid={false} />
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

export default function Home() {
  useDocumentTitle()
  const navigate = useNavigate()
  const alerts = useActiveAlerts()

  return (
    <Screen className="pt-safe-top desktop:pt-8">
      <TopBar />
      <h1 className="mb-4 hidden text-2xl font-bold desktop:block">Home</h1>
      {alerts.data && <AlertBanner count={alerts.data.length} />}

      <SectionTitle>Quick Actions</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 desktop:max-w-2xl">
        {quickActions.map(({ label, icon: Icon, to }) => (
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

      <div className="desktop:mt-4 desktop:grid desktop:grid-cols-2 desktop:gap-8">
        <section>
          <SectionTitle className="flex items-baseline justify-between">
            Latest Recalls
            <Link to="/recalls" className="text-xs normal-case tracking-normal text-foreground underline underline-offset-2">
              See all
            </Link>
          </SectionTitle>
          <LatestRecalls />
        </section>

        <section>
          <SectionTitle className="flex items-baseline justify-between">
            Recent Receipts
            <Link to="/receipts" className="text-xs normal-case tracking-normal text-foreground underline underline-offset-2">
              See all
            </Link>
          </SectionTitle>
          <RecentReceipts />
        </section>
      </div>
    </Screen>
  )
}
