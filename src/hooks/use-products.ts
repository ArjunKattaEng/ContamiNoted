import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { features } from '@/lib/features'
import { services } from '@/services'
import { queryKeys } from './queryKeys'

/** Watchlist items from all scans (filter on `source` for barcode-only lists). */
export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => services.history.listProducts(),
    enabled: features.history,
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.history.deleteProduct(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
    },
  })
}
