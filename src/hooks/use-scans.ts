import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { canScan, features } from '@/lib/features'
import { services } from '@/services'
import type { Scan, ScanType } from '@/types'
import { queryKeys } from './queryKeys'

export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scans.detail(id ?? ''),
    queryFn: () => services.scan.getScan(id!),
    enabled: canScan && !!id,
  })
}

export function useScanHistory(type: ScanType) {
  return useQuery({
    queryKey: queryKeys.scans.list(type),
    queryFn: () => services.history.listScans(type),
    enabled: features.history,
  })
}

/** A new scan also adds watchlist items and may raise alerts. */
function useOnScanned() {
  const queryClient = useQueryClient()
  return (scan: Scan) => {
    queryClient.setQueryData(queryKeys.scans.detail(scan.id), scan)
    queryClient.invalidateQueries({ queryKey: queryKeys.scans.list(scan.type) })
    queryClient.invalidateQueries({ queryKey: queryKeys.products })
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
  }
}

export function useScanBarcode() {
  const onScanned = useOnScanned()
  return useMutation({
    mutationFn: (code: string) => services.scan.scanBarcode(code),
    onSuccess: onScanned,
  })
}

export function useScanReceipt() {
  const onScanned = useOnScanned()
  return useMutation({
    mutationFn: ({ image, purchaseDate }: { image: Blob; purchaseDate?: string }) =>
      services.scan.scanReceipt(image, { purchaseDate }),
    onSuccess: onScanned,
  })
}

/** Fix an item's name (e.g. an unreadable receipt line) and re-check it. */
export function useUpdateScanItem() {
  const onScanned = useOnScanned()
  return useMutation({
    mutationFn: ({ scanId, itemId, name }: { scanId: string; itemId: string; name: string }) =>
      services.scan.updateItem(scanId, itemId, name),
    onSuccess: onScanned,
  })
}
