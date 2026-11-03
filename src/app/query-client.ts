import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A 4xx answer will not change on its own: only network errors and 5xx are retried
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status < 500),
        staleTime: 30_000,
      },
    },
  })
}
