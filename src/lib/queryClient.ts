import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/services/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Mobile app: refetching on every app switch is more noise than help
      refetchOnWindowFocus: false,
      // Retry network/server failures once; client errors (4xx) won't fix themselves
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
    },
  },
})
