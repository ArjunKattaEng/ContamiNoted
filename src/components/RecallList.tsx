import { useNavigate } from 'react-router-dom'
import { useRecallFlags } from '@/hooks/use-recall-flags'
import { useRecallSummaries } from '@/hooks/use-recalls'
import { recallPath } from '@/lib/recall'
import { cn } from '@/lib/utils'
import type { Recall, RecallRef } from '@/types'
import { RecallCard } from './RecallCard'

interface RecallListProps {
  /** Saved recalls only carry a RecallRef; list results carry firm and short summary too. */
  recalls: (RecallRef & Partial<Pick<Recall, 'recallingFirm' | 'summary'>>)[]
  /** Two columns from tablet width up (main lists); off for narrow side columns. */
  grid?: boolean
}

/** Recall cards wired to navigation, saved state and "matches your items". */
export function RecallList({ recalls, grid = true }: RecallListProps) {
  const navigate = useNavigate()
  const flags = useRecallFlags()
  // Live lists arrive before their AI summaries; fetch those for the cards that lack one
  const { summaries, loading } = useRecallSummaries(recalls.filter((r) => !r.summary).map((r) => r.recallNumber))
  return (
    <div className={cn('grid gap-3', grid && 'md:grid-cols-2')}>
      {recalls.map((r) => (
        <RecallCard
          key={r.recallNumber}
          recall={r.summary || !summaries[r.recallNumber] ? r : { ...r, summary: summaries[r.recallNumber] }}
          summaryLoading={loading.has(r.recallNumber)}
          saved={flags.isSaved(r.recallNumber)}
          matched={flags.isMatched(r.recallNumber)}
          onOpen={() => navigate(recallPath(r.recallNumber))}
          onToggleSaved={() => flags.toggleSaved(r)}
        />
      ))}
    </div>
  )
}
