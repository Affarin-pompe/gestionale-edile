import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'
import { unwrapVersioned, type Versioned } from '@/api/versioned'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'

export type SiteCost = components['schemas']['SiteCost']
export type SiteCostInput = components['schemas']['SiteCostInput']
export type CostCategory = components['schemas']['CostCategory']

// The contract's sort values; the first is the list's default
export const COST_SORTS = ['-date', 'date', '-amount', 'amount'] as const
export const COST_CATEGORIES = [
  'materials',
  'rentals',
  'subcontract',
  'other',
] as const satisfies readonly CostCategory[]
/** The most the contract gives in one page. */
const MAX_PER_PAGE = 100

const keys = {
  lists: (company: string) => ['companies', company, 'costs', 'list'] as const,
  detail: (company: string, id: string) => ['companies', company, 'costs', 'detail', id] as const,
  choices: (company: string) => ['companies', company, 'costs', 'choices'] as const,
}

export interface CostListParams {
  page: number
  perPage: number
  sort: (typeof COST_SORTS)[number]
  site: string | undefined
  supplier: string | undefined
  category: CostCategory | undefined
  from: string | undefined
  to: string | undefined
}

/** A page of costs, and the total of every cost the filters keep (total_amount). */
export function costListQuery(company: string, params: CostListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/costs', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              filter: {
                site: params.site,
                supplier: params.supplier,
                category: params.category,
                from: params.from,
                to: params.to,
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

/** The cost with its ETag, which changes send back in If-Match. */
export function costQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/costs/{cost}', {
          params: { path: { company, cost: id } },
          signal,
        }),
      ),
  })
}

export interface Choice {
  id: string
  name: string
}

/**
 * The sites and the active suppliers a cost can be linked to, by name: the first page the
 * contract allows of each. Each list is asked only with the permission to see it.
 */
function choicesQuery(company: string, can: { sites: boolean; suppliers: boolean }) {
  return queryOptions({
    queryKey: [...keys.choices(company), can],
    queryFn: async ({ signal }) => {
      const [sites, suppliers] = await Promise.all([
        can.sites
          ? api
              .GET('/api/companies/{company}/sites', {
                params: { path: { company }, query: { per_page: MAX_PER_PAGE, sort: 'name' } },
                signal,
              })
              .then(unwrap)
          : undefined,
        can.suppliers
          ? api
              .GET('/api/companies/{company}/suppliers', {
                params: { path: { company }, query: { per_page: MAX_PER_PAGE, sort: 'name' } },
                signal,
              })
              .then(unwrap)
          : undefined,
      ])
      return {
        sites: sites?.data.map((s) => ({ id: s.id, name: siteLabel(s) })) ?? [],
        suppliers: suppliers?.data.map((s) => ({ id: s.id, name: s.name })) ?? [],
      }
    },
    staleTime: 60_000,
  })
}

/** The sites and suppliers for the filters and the form, as far as the user may see them. */
export function useChoices() {
  const company = useCompany()
  const can = { sites: useCan('sites.view'), suppliers: useCan('suppliers.view') }
  return useQuery(choicesQuery(company.slug, can))
}

/** "2026-01 · Rifacimento copertura": the code, when there is one, helps tell sites apart. */
export function siteLabel(site: { name: string; code: string | null }) {
  return site.code ? `${site.code} · ${site.name}` : site.name
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, cost: Versioned<SiteCost>) {
  queryClient.setQueryData(keys.detail(company, cost.record.id), cost)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateCost(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SiteCostInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/costs', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (cost) => saved(queryClient, company, cost),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateCost(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: SiteCostInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/costs/{cost}', {
          params: { path: { company, cost: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (cost) => saved(queryClient, company, cost),
  })
}

/**
 * Deletes the cost. The detail stays in the cache while its page is open; the caller leaves
 * the page, then calls forgetCost.
 */
export function useDeleteCost(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/costs/{cost}', {
          params: { path: { company, cost: id }, header: { 'If-Match': etag } },
        }),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.lists(company) }),
  })
}

export function forgetCost(queryClient: QueryClient, company: string, id: string) {
  queryClient.removeQueries({ queryKey: keys.detail(company, id) })
}
