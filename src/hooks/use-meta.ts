import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'
import { queryKeys } from './queryKeys'

export function useDataSourceStatus() {
  return useQuery({
    queryKey: queryKeys.dataSource,
    queryFn: () => services.meta.dataSourceStatus(),
  })
}
