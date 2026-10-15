import { useMemo } from 'react'
import { toast } from '@/components/ui/sonner'
import type { RecallRef } from '@/types'
import { useActiveAlerts } from './use-alerts'
import { useSavedRecalls, useToggleSaved } from './use-saved'

/** Per-recall "starred" and "matches your items" state for recall lists and detail. */
export function useRecallFlags() {
  const saved = useSavedRecalls()
  const alerts = useActiveAlerts()
  const { mutate: toggle } = useToggleSaved()

  return useMemo(() => {
    const savedNumbers = new Set(saved.data?.map((s) => s.recallNumber))
    const matchedNumbers = new Set(alerts.data?.map((a) => a.recallNumber))
    return {
      isSaved: (recallNumber: string) => savedNumbers.has(recallNumber),
      isMatched: (recallNumber: string) => matchedNumbers.has(recallNumber),
      toggleSaved: (recall: RecallRef) =>
        toggle(recall, { onError: () => toast('Couldn’t update saved recalls') }),
    }
  }, [saved.data, alerts.data, toggle])
}
