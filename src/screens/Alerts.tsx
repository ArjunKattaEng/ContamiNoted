import { ScanLine, ShieldCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { ClassificationBadge } from '@/components/RecallBadges'
import { RowCard } from '@/components/RowCard'
import { Screen, SectionTitle } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useAlerts, useDismissAlert } from '@/hooks/use-alerts'
import { formatTimeAgo } from '@/lib/format'
import { recallPath } from '@/lib/recall'
import { itemOrigin } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { Alert } from '@/types'

function AlertCard({ alert }: { alert: Alert }) {
  const navigate = useNavigate()
  const dismiss = useDismissAlert()
  return (
    <RowCard onClick={() => navigate(recallPath(alert.recallNumber))} className={cn('items-start', alert.dismissed && 'opacity-70')}>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {alert.dismissed ? (
            <Badge variant="outline">Dismissed</Badge>
          ) : (
            <Badge variant={alert.confidence === 'confirmed' ? 'alert' : 'warn'}>
              {alert.confidence === 'confirmed' ? 'Confirmed match' : 'Possible match'}
            </Badge>
          )}
          <ClassificationBadge classification={alert.recall.classification} />
        </div>
        <strong className="block leading-snug">{alert.itemName}</strong>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">Recall: {alert.recall.productDescription}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {itemOrigin(alert)} · Found {formatTimeAgo(alert.createdAt)}
        </p>
      </div>
      {!alert.dismissed && (
        <button
          className="-m-1 flex-none p-2 text-muted-foreground hover:text-foreground"
          aria-label={`Dismiss alert for ${alert.itemName}`}
          disabled={dismiss.isPending}
          onClick={(e) => {
            e.stopPropagation()
            dismiss.mutate(alert.id, { onError: () => toast('Couldn’t dismiss this alert') })
          }}
        >
          <X className="size-5" />
        </button>
      )}
    </RowCard>
  )
}

/** Recall matches for the user's scanned items: active first, dismissed below. */
export function Alerts() {
  const navigate = useNavigate()
  const query = useAlerts()

  return (
    <>
      <ScreenHeader title="Alerts" />
      <Screen>
        {query.isPending ? (
          <div className="grid gap-3 md:grid-cols-2" aria-busy>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          (() => {
            const active = query.data.filter((a) => !a.dismissed)
            const dismissed = query.data.filter((a) => a.dismissed)
            return (
              <>
                {active.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No active alerts"
                    action={
                      <Button size="sm" onClick={() => navigate('/scan')}>
                        <ScanLine /> Scan something
                      </Button>
                    }
                  >
                    If a recall matches something you’ve scanned, it shows up here, including recalls announced after you
                    bought it.
                  </EmptyState>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Check the lot code and date on each item against the recall, then dismiss the alert once it’s handled.
                    </p>
                    <div className="grid md:grid-cols-2 md:gap-x-8">
                      {active.map((a) => (
                        <AlertCard key={a.id} alert={a} />
                      ))}
                    </div>
                  </>
                )}
                {dismissed.length > 0 && (
                  <section className="mt-6">
                    <SectionTitle>Dismissed ({dismissed.length})</SectionTitle>
                    <div className="grid md:grid-cols-2 md:gap-x-8">
                      {dismissed.map((a) => (
                        <AlertCard key={a.id} alert={a} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )
          })()
        )}
      </Screen>
    </>
  )
}
