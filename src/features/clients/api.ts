import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Client = components['schemas']['Client']
export type ClientInput = components['schemas']['ClientInput']
export type ClientKind = components['schemas']['ClientKind']

// The contract's sort values; the first is the list's default
export const CLIENT_SORTS = ['name', '-name', '-created_at', 'created_at'] as const
export const CLIENT_KINDS = ['company', 'person'] as const satisfies readonly ClientKind[]
const PER_PAGE = 25

const keys = {
  lists: (company: string) => ['companies', company, 'clients', 'list'] as const,
  detail: (company: string, id: string) => ['companies', company, 'clients', 'detail', id] as const,
}

export interface ClientListParams {
  page: number
  sort: (typeof CLIENT_SORTS)[number]
  search: string
  kind: ClientKind | undefined
}

export function clientListQuery(company: string, params: ClientListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
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

export function clientQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/clients/{client}', {
          params: { path: { company, client: id } },
          signal,
        }),
      ),
  })
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, client: Client) {
  queryClient.setQueryData(keys.detail(company, client.id), client)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateClient(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput) =>
      unwrap(
        await api.POST('/api/companies/{company}/clients', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (client) => saved(queryClient, company, client),
  })
}

export function useUpdateClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput) =>
      unwrap(
        await api.PUT('/api/companies/{company}/clients/{client}', {
          params: { path: { company, client: id } },
          body: input,
        }),
      ),
    onSuccess: (client) => saved(queryClient, company, client),
  })
}
