import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toRecallRef } from '@/lib/recall'
import { services } from '@/services'
import type { RecallRef, SavedRecall } from '@/types'
import { queryKeys } from './queryKeys'

export function useSavedRecalls() {
  return useQuery({
    queryKey: queryKeys.saved,
    queryFn: () => services.saved.list(),
  })
}

/** Star / unstar a recall, optimistically. */
export function useToggleSaved() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recall: RecallRef) => services.saved.toggle(recall),
    onMutate: async (recall) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.saved })
      const previous = queryClient.getQueryData<SavedRecall[]>(queryKeys.saved)
      queryClient.setQueryData<SavedRecall[]>(queryKeys.saved, (saved = []) =>
        saved.some((s) => s.recallNumber === recall.recallNumber)
          ? saved.filter((s) => s.recallNumber !== recall.recallNumber)
          : [
              {
                recallNumber: recall.recallNumber,
                savedAt: new Date().toISOString(),
                recall: toRecallRef(recall),
              },
              ...saved,
            ],
      )
      return { previous }
    },
    onError: (_err, _recall, context) => queryClient.setQueryData(queryKeys.saved, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.saved }),
  })
}
