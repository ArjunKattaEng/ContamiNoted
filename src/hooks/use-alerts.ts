import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services'
import type { Alert } from '@/types'
import { queryKeys } from './queryKeys'

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => services.alerts.list(),
  })
}

/** Undismissed alerts (drives the Home banner and "Matches your items" badges). */
export function useActiveAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => services.alerts.list(),
    select: (alerts) => alerts.filter((a) => !a.dismissed),
  })
}

export function useDismissAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.alerts.dismiss(id),
    // Optimistic: hide the alert immediately, roll back on failure
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alerts })
      const previous = queryClient.getQueryData<Alert[]>(queryKeys.alerts)
      queryClient.setQueryData<Alert[]>(queryKeys.alerts, (alerts) => alerts?.map((a) => (a.id === id ? { ...a, dismissed: true } : a)))
      return { previous }
    },
    onError: (_err, _id, context) => queryClient.setQueryData(queryKeys.alerts, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
  })
}

/** Re-check saved items for new recalls (called on app open/resume). */
export function useRecheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => services.alerts.recheck(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataSource })
      if (result.newAlerts.length === 0) return
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
      // A re-check can surface recalls that weren't in the lists before
      queryClient.invalidateQueries({ queryKey: queryKeys.recalls.all })
    },
  })
}
