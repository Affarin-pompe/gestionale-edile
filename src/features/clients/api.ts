import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Client = components['schemas']['Client']
export type ClientKind = components['schemas']['ClientKind']

// The contract's sort values; the first is the list's default
export const CLIENT_SORTS = ['name', '-name', '-created_at', 'created_at'] as const
export const CLIENT_KINDS = ['company', 'person'] as const satisfies readonly ClientKind[]
const PER_PAGE = 25

export interface ClientListParams {
  page: number
  sort: (typeof CLIENT_SORTS)[number]
  search: string
  kind: ClientKind | undefined
}

export function clientListQuery(company: string, params: ClientListParams) {
  return queryOptions({
    queryKey: ['companies', company, 'clients', 'list', params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/clients', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: PER_PAGE,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: params.kind ? { kind: params.kind } : undefined,
            },
          },
          signal,
        }),
      ),
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}
