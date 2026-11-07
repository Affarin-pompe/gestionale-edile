import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Client = components['schemas']['Client']
export type ClientInput = components['schemas']['ClientInput']
export type ClientKind = components['schemas']['ClientKind']

/** A client with the version the backend gave with it (ETag), to send back in If-Match. */
export interface VersionedClient {
  client: Client
  etag: string
}

// The contract's sort values; the first is the list's default
export const CLIENT_SORTS = ['name', '-name', '-created_at', 'created_at'] as const
export const CLIENT_KINDS = [
  'company',
  'public_body',
  'person',
] as const satisfies readonly ClientKind[]
/** The country a new client starts with, as in the contract. */
export const DEFAULT_COUNTRY = 'IT'

const keys = {
  lists: (company: string) => ['companies', company, 'clients', 'list'] as const,
  detail: (company: string, id: string) => ['companies', company, 'clients', 'detail', id] as const,
}

export interface ClientListParams {
  page: number
  perPage: number
  sort: (typeof CLIENT_SORTS)[number]
  search: string
  kind: ClientKind | undefined
  /** Only the archived clients; otherwise only the active ones. */
  archived: boolean
}

export function clientListQuery(company: string, params: ClientListParams) {
  const filter = {
    ...(params.kind && { kind: params.kind }),
    ...(params.archived && { archived: true }),
  }
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/clients', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: Object.keys(filter).length > 0 ? filter : undefined,
            },
          },
          signal,
        }),
      ),
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

/** The client and its ETag, from an answer that carries both (GET, POST, PUT, archive, restore). */
function versioned(result: {
  data?: Client
  error?: unknown
  response: Response
}): VersionedClient {
  const client = unwrap(result)
  // Without it no change could be saved: the backend would answer 428
  return { client, etag: result.response.headers.get('ETag') ?? '' }
}

export function clientQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      versioned(
        await api.GET('/api/companies/{company}/clients/{client}', {
          params: { path: { company, client: id } },
          signal,
        }),
      ),
  })
}

/** Someone else changed the client after it was opened (412), or its version was missing (428). */
export function isStale(error: unknown) {
  return error instanceof ApiError && (error.status === 412 || error.status === 428)
}

/** The client has quotes, estimates or deadlines: it can be archived, not deleted. */
export function hasDocuments(error: unknown) {
  return error instanceof ApiError && error.status === 409
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, result: VersionedClient) {
  queryClient.setQueryData(keys.detail(company, result.client.id), result)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateClient(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput) =>
      versioned(
        await api.POST('/api/companies/{company}/clients', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (result) => saved(queryClient, company, result),
  })
}

/** Saves the changes over the version in `etag`; a newer one on the server gives 412. */
export function useUpdateClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: ClientInput; etag: string }) =>
      versioned(
        await api.PUT('/api/companies/{company}/clients/{client}', {
          params: { path: { company, client: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (result) => saved(queryClient, company, result),
  })
}

export function useArchiveClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) =>
      versioned(
        await api.POST('/api/companies/{company}/clients/{client}/archive', {
          params: { path: { company, client: id }, header: { 'If-Match': etag } },
        }),
      ),
    onSuccess: (result) => saved(queryClient, company, result),
  })
}

export function useRestoreClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) =>
      versioned(
        await api.POST('/api/companies/{company}/clients/{client}/restore', {
          params: { path: { company, client: id }, header: { 'If-Match': etag } },
        }),
      ),
    onSuccess: (result) => saved(queryClient, company, result),
  })
}

/**
 * Deletes the client. The detail stays in the cache: the page that shows it is still open
 * until the caller leaves it, then calls forgetClient.
 */
export function useDeleteClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/clients/{client}', {
          params: { path: { company, client: id }, header: { 'If-Match': etag } },
        }),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.lists(company) }),
  })
}

/** Drops a deleted client from the cache, once no page shows it any more. */
export function forgetClient(queryClient: QueryClient, company: string, id: string) {
  queryClient.removeQueries({ queryKey: keys.detail(company, id) })
}

/** Loads the client again, e.g. after a 412: the page then shows the newer version. */
export function useReloadClient(company: string, id: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.refetchQueries({ queryKey: keys.detail(company, id) }, { throwOnError: true })
}
