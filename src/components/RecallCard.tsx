import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatReported } from '@/lib/format'
import { hazardOf } from '@/lib/hazard'
import { tap } from '@/lib/native'
import { cn } from '@/lib/utils'
import type { Recall, RecallRef } from '@/types'
import { ClassificationBadge, HazardTile, MatchBadge, RecallStatusBadge } from './RecallBadges'
import { RowCard } from './RowCard'

interface RecallCardProps {
  /** Saved recalls only carry a RecallRef; list results carry firm and short summary too. */
  recall: RecallRef & Partial<Pick<Recall, 'recallingFirm' | 'summary' | 'reasonForRecall'>>
  saved: boolean
  matched: boolean
  /** The short summary is still being generated. */
  summaryLoading?: boolean
  onOpen: () => void
  onToggleSaved: () => void
}

export function RecallCard({ recall, saved, matched, summaryLoading, onOpen, onToggleSaved }: RecallCardProps) {
  const hazard = recall.reasonForRecall ? hazardOf(recall.reasonForRecall) : undefined
  return (
    <RowCard onClick={onOpen} className="items-start">
      <HazardTile kind={hazard?.kind} />
      <div className="min-w-0 flex-1">
        <strong className="line-clamp-2 font-semibold leading-snug">{recall.productDescription}</strong>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {recall.recallingFirm ? `${recall.recallingFirm} · ` : ''}
          {recall.status !== 'Ongoing' && recall.terminationDate
            ? `Closed ${formatDate(recall.terminationDate)}`
            : formatReported(recall.reportDate)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ClassificationBadge classification={recall.classification} />
          {hazard && <span className="text-xs font-medium text-foreground/80">{hazard.label}</span>}
          <RecallStatusBadge status={recall.status} />
          {matched && <MatchBadge />}
        </div>
        {recall.summary?.shortSummary ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{recall.summary.shortSummary}</p>
        ) : (
          summaryLoading && (
            <div className="mt-2 space-y-1.5" aria-label="Writing summary">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )
        )}
      </div>
      <button
        className="-m-2 flex-none p-2"
        onClick={(e) => {
          e.stopPropagation()
          tap()
          onToggleSaved()
        }}
        aria-label={saved ? 'Remove from saved' : 'Save recall'}
        aria-pressed={saved}
      >
        <Star className={cn('size-5', saved ? 'fill-current text-primary' : 'text-muted-foreground')} />
      </button>
    </RowCard>
  )
}

export function RecallCardSkeleton() {
  return (
    <div className="flex gap-3 border-b py-3.5" aria-hidden>
      <Skeleton className="size-12 flex-none rounded-xl" />
      <div className="flex-1">
        <Skeleton className="mb-1.5 h-4 w-11/12" />
        <Skeleton className="mb-2 h-3 w-1/2" />
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

/** Responsive list: one column on phones, two on tablets and desktop. */
export function RecallGrid({ children }: { children: ReactNode }) {
  return <div className="grid md:grid-cols-2 md:gap-x-8">{children}</div>
}
