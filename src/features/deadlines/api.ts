import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { components } from '@/api/schema'
import { unwrapVersioned, type Versioned } from '@/api/versioned'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { today } from '@/lib/days'

export type Deadline = components['schemas']['Deadline']
export type DeadlineInput = components['schemas']['DeadlineInput']
export type DeadlineKind = components['schemas']['DeadlineKind']
export type DeadlineStatus = components['schemas']['DeadlineStatus']
export type DeadlineRecurrence = components['schemas']['DeadlineRecurrence']

// The contract's sort values; the first is the list's default
export const DEADLINE_SORTS = ['due_on', '-due_on'] as const
export const DEADLINE_KINDS = [
  'durc',
  'insurance',
  'tax',
  'invoice_in',
  'invoice_out',
  'contract',
  'vehicle',
  'other',
] as const satisfies readonly DeadlineKind[]
export const DEADLINE_STATUSES = ['open', 'done'] as const satisfies readonly DeadlineStatus[]
export const DEADLINE_RECURRENCES = [
  'monthly',
  'quarterly',
  'yearly',
] as const satisfies readonly DeadlineRecurrence[]
/** The most the contract gives in one page: the calendar asks for a month at once. */
export const MAX_PER_PAGE = 100

const keys = {
  all: (company: string) => ['companies', company, 'deadlines'] as const,
  lists: (company: string) => ['companies', company, 'deadlines', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'deadlines', 'detail', id] as const,
  subjects: (company: string) => ['companies', company, 'deadlines', 'subjects'] as const,
}

/** Open and past its day, in Italy. Dates are AAAA-MM-GG: as text they sort like dates. */
export function isOverdue(deadline: Pick<Deadline, 'status' | 'due_on'>, on = today()) {
  return deadline.status === 'open' && deadline.due_on < on
}

/** The client or the supplier a deadline is about, as the list filters take it. */
export type Subject = { client: string } | { supplier: string }

export interface DeadlineListParams {
  page: number
  perPage: number
  sort: (typeof DEADLINE_SORTS)[number]
  search: string
  from: string | undefined
  to: string | undefined
  kind: DeadlineKind | undefined
  status: DeadlineStatus | undefined
  subject: Subject | undefined
}

export function deadlineListQuery(company: string, params: DeadlineListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/deadlines', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: {
                from: params.from,
                to: params.to,
                kind: params.kind,
                status: params.status,
                ...params.subject,
              },
            },
          },
          signal,
        }),
      ),
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

/** The deadline with its ETag, which changes send back in If-Match. */
export function deadlineQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/deadlines/{deadline}', {
          params: { path: { company, deadline: id } },
          signal,
        }),
      ),
  })
}

export interface SubjectOption {
  id: string
  name: string
}

/**
 * The active clients and suppliers a deadline can be linked to, by name: the first page the
 * contract allows of each. Each list is asked only with the permission to see it.
 */
export function subjectsQuery(company: string, can: { clients: boolean; suppliers: boolean }) {
  return queryOptions({
    queryKey: [...keys.subjects(company), can],
    queryFn: async ({ signal }) => {
      const query = { per_page: MAX_PER_PAGE, sort: 'name' as const }
      const [clients, suppliers] = await Promise.all([
        can.clients
          ? api
              .GET('/api/companies/{company}/clients', {
                params: { path: { company }, query },
                signal,
              })
              .then(unwrap)
          : undefined,
        can.suppliers
          ? api
              .GET('/api/companies/{company}/suppliers', {
                params: { path: { company }, query },
                signal,
              })
              .then(unwrap)
          : undefined,
      ])
      const pick = (row: SubjectOption) => ({ id: row.id, name: row.name })
      return {
        clients: clients?.data.map(pick) ?? [],
        suppliers: suppliers?.data.map(pick) ?? [],
      }
    },
    staleTime: 60_000,
  })
}

/** The subjects for the filters and the form, as far as the user may see them. */
export function useSubjects() {
  const company = useCompany()
  const can = { clients: useCan('clients.view'), suppliers: useCan('suppliers.view') }
  return useQuery(subjectsQuery(company.slug, can))
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, deadline: Versioned<Deadline>) {
  queryClient.setQueryData(keys.detail(company, deadline.record.id), deadline)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateDeadline(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DeadlineInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/deadlines', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (deadline) => saved(queryClient, company, deadline),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateDeadline(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: DeadlineInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/deadlines/{deadline}', {
          params: { path: { company, deadline: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (deadline) => saved(queryClient, company, deadline),
  })
}

/**
 * Marks a deadline as done, or opens it again. The list has no ETags, so the deadline is
 * asked again first: if it is no longer the one the user sees, the change stops with a 412,
 * as the backend would do.
 */
export function useSetDeadlineDone(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ deadline, done }: { deadline: Deadline; done: boolean }) => {
      const current = await queryClient.fetchQuery({
        ...deadlineQuery(company, deadline.id),
        staleTime: 0,
      })
      if (current.record.updated_at !== deadline.updated_at) {
        throw new ApiError(412, { message: 'stale', code: 'stale_record' })
      }
      const options = {
        params: {
          path: { company, deadline: deadline.id },
          header: { 'If-Match': current.etag },
        },
      }
      return unwrapVersioned(
        done
          ? await api.POST('/api/companies/{company}/deadlines/{deadline}/complete', options)
          : await api.POST('/api/companies/{company}/deadlines/{deadline}/reopen', options),
      )
    },
    onSuccess: (deadline) => saved(queryClient, company, deadline),
    // After a 412 the lists show the version saved by the other person
    onError: () => queryClient.invalidateQueries({ queryKey: keys.all(company) }),
  })
}
