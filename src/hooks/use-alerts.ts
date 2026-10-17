import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { features } from '@/lib/features'
import { services } from '@/services'
import type { Alert } from '@/types'
import { queryKeys } from './queryKeys'

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => services.alerts.list(),
    enabled: features.alerts,
  })
}

/** Undismissed alerts (drives the Home banner and "Matches your items" badges). */
export function useActiveAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => services.alerts.list(),
    enabled: features.alerts,
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      queryClient.invalidateQueries({ queryKey: queryKeys.products }) // product status follows active alerts
    },
  })
}

/** Re-check saved items for new recalls (called on app open/resume). */
export function useRecheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => services.alerts.recheck(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataSource })
      queryClient.invalidateQueries({ queryKey: queryKeys.lastWatchCheck })
      if (result.newAlerts.length === 0) return
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
      // A re-check can surface recalls that weren't in the lists before
      queryClient.invalidateQueries({ queryKey: queryKeys.recalls.all })
    },
  })
}

/**
 * When saved items were last re-checked (ISO timestamp, or null): this device's for a guest, the account's
 * when signed in. Read on its own, so it shows even when the openFDA status request fails.
 */
export function useLastWatchCheck() {
  return useQuery({
    queryKey: queryKeys.lastWatchCheck,
    queryFn: () => services.alerts.lastCheck(),
    enabled: features.alerts,
  })
}
