import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { unwrapVersioned, type Versioned } from '@/api/etag'
import type { components } from '@/api/schema'
import { invalidateQuotes, quoteSaved } from '@/features/quotes/api'

export type Estimate = components['schemas']['Estimate']
export type EstimateInput = components['schemas']['EstimateInput']
export type EstimateStatus = components['schemas']['EstimateStatus']
export type EstimateStructure = components['schemas']['EstimateStructure']
export type EstimateChapter = components['schemas']['EstimateChapter']
export type EstimateChapterCreate = components['schemas']['EstimateChapterCreate']
export type EstimateChapterInput = components['schemas']['EstimateChapterInput']
export type EstimateItem = components['schemas']['EstimateItem']
export type EstimateItemInput = components['schemas']['EstimateItemInput']
export type EstimateMeasurement = components['schemas']['EstimateMeasurement']
export type EstimateMeasurementInput = components['schemas']['EstimateMeasurementInput']
export type EstimateArrangement = components['schemas']['EstimateArrangement']
export type QuoteFromEstimateInput = components['schemas']['QuoteFromEstimateInput']

// The contract's sort values; the first is the list's default
export const ESTIMATE_SORTS = [
  '-updated_at',
  'updated_at',
  'title',
  '-title',
  '-created_at',
  'created_at',
] as const
export const ESTIMATE_STATUSES = ['draft', 'final'] as const satisfies readonly EstimateStatus[]
/** Chapters nest at most 4 levels deep (the backend refuses a fifth). */
export const MAX_CHAPTER_DEPTH = 4

const keys = {
  lists: (company: string) => ['companies', company, 'estimates', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'estimates', 'detail', id] as const,
  structure: (company: string, id: string) =>
    ['companies', company, 'estimates', 'structure', id] as const,
}

export interface EstimateListParams {
  page: number
  perPage: number
  sort: (typeof ESTIMATE_SORTS)[number]
  search: string
  status: EstimateStatus | undefined
}

export function estimateListQuery(company: string, params: EstimateListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/estimates', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: params.status ? { status: params.status } : undefined,
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/** The estimate's header with its ETag. */
export function estimateQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/estimates/{estimate}', {
          params: { path: { company, estimate: id } },
          signal,
        }),
      ),
  })
}

/** Chapters, items and measurements as flat lists, with the tree's ETag and the totals. */
export function structureQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.structure(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/estimates/{estimate}/structure', {
          params: { path: { company, estimate: id } },
          signal,
        }),
      ),
  })
}

/** The building sites to choose from, by name (the contract pages at 100). */
export function siteOptionsQuery(company: string) {
  return queryOptions({
    queryKey: ['companies', company, 'sites', 'list', 'options'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites', {
          params: { path: { company }, query: { per_page: 100, sort: 'name' } },
          signal,
        }),
      ).data,
    staleTime: 60_000,
  })
}

function saved(queryClient: QueryClient, company: string, estimate: Versioned<Estimate>) {
  queryClient.setQueryData(keys.detail(company, estimate.data.id), estimate)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

function etagOf(queryClient: QueryClient, company: string, id: string) {
  return queryClient.getQueryData<Versioned<Estimate>>(keys.detail(company, id))?.etag ?? ''
}

export function useCreateEstimate(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: EstimateInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/estimates', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (estimate) => saved(queryClient, company, estimate),
  })
}

export function useUpdateEstimate(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: EstimateInput) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/estimates/{estimate}', {
          params: {
            path: { company, estimate: id },
            header: { 'If-Match': etagOf(queryClient, company, id) },
          },
          body: input,
        }),
      ),
    onSuccess: (estimate) => saved(queryClient, company, estimate),
  })
}

export function useDeleteEstimate(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(
        await api.DELETE('/api/companies/{company}/estimates/{estimate}', {
          params: {
            path: { company, estimate: id },
            header: { 'If-Match': etagOf(queryClient, company, id) },
          },
        }),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.lists(company) }),
  })
}

/** A new draft with the same header, chapters, items and measurements. */
export function useDuplicateEstimate(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/estimates/{estimate}/duplicate', {
          params: { path: { company, estimate: id } },
        }),
      ),
    onSuccess: (estimate) => saved(queryClient, company, estimate),
  })
}

/** A draft quote with the estimate's chapters as sections and its items as lines. */
export function useCreateQuoteFromEstimate(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuoteFromEstimateInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/estimates/{estimate}/quote', {
          params: { path: { company, estimate: id } },
          body: input,
        }),
      ),
    onSuccess: (quote) => {
      invalidateQuotes(queryClient, company)
      quoteSaved(queryClient, company, quote)
    },
  })
}

/** Any change to the tree changes its ETag and the totals: tree and header load again. */
function treeChanged(queryClient: QueryClient, company: string, id: string) {
  void queryClient.invalidateQueries({ queryKey: keys.structure(company, id) })
  void queryClient.invalidateQueries({ queryKey: keys.detail(company, id) })
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

/** One change to the tree: a chapter, an item or a measurement created, changed or deleted. */
export type TreeChange =
  | { kind: 'chapter'; create: EstimateChapterCreate }
  | { kind: 'chapter'; update: EstimateChapter; input: EstimateChapterInput }
  | { kind: 'chapter'; remove: EstimateChapter }
  | { kind: 'item'; create: EstimateItemInput & { chapter_id: string } }
  | { kind: 'item'; update: EstimateItem; input: EstimateItemInput }
  | { kind: 'item'; remove: EstimateItem }
  | { kind: 'measurement'; create: EstimateMeasurementInput & { item_id: string } }
  | { kind: 'measurement'; update: EstimateMeasurement; input: EstimateMeasurementInput }
  | { kind: 'measurement'; remove: EstimateMeasurement }

async function applyChange(company: string, estimate: string, change: TreeChange) {
  const path = { company, estimate }
  // Each record sends back its own version: a 412 means someone else changed it
  const ifMatch = (record: { version: string }) => ({ 'If-Match': record.version })
  switch (change.kind) {
    case 'chapter':
      if ('create' in change) {
        return unwrap(
          await api.POST('/api/companies/{company}/estimates/{estimate}/chapters', {
            params: { path },
            body: change.create,
          }),
        )
      }
      if ('update' in change) {
        const { update } = change
        return unwrap(
          await api.PUT('/api/companies/{company}/estimates/{estimate}/chapters/{chapter}', {
            params: { path: { ...path, chapter: update.id }, header: ifMatch(update) },
            body: change.input,
          }),
        )
      }
      return unwrap(
        await api.DELETE('/api/companies/{company}/estimates/{estimate}/chapters/{chapter}', {
          params: { path: { ...path, chapter: change.remove.id }, header: ifMatch(change.remove) },
        }),
      )
    case 'item':
      if ('create' in change) {
        return unwrap(
          await api.POST('/api/companies/{company}/estimates/{estimate}/items', {
            params: { path },
            body: change.create,
          }),
        )
      }
      if ('update' in change) {
        const { update } = change
        return unwrap(
          await api.PUT('/api/companies/{company}/estimates/{estimate}/items/{item}', {
            params: { path: { ...path, item: update.id }, header: ifMatch(update) },
            body: change.input,
          }),
        )
      }
      return unwrap(
        await api.DELETE('/api/companies/{company}/estimates/{estimate}/items/{item}', {
          params: { path: { ...path, item: change.remove.id }, header: ifMatch(change.remove) },
        }),
      )
    case 'measurement':
      if ('create' in change) {
        return unwrap(
          await api.POST('/api/companies/{company}/estimates/{estimate}/measurements', {
            params: { path },
            body: change.create,
          }),
        )
      }
      if ('update' in change) {
        const { update } = change
        return unwrap(
          await api.PUT(
            '/api/companies/{company}/estimates/{estimate}/measurements/{measurement}',
            {
              params: { path: { ...path, measurement: update.id }, header: ifMatch(update) },
              body: change.input,
            },
          ),
        )
      }
      return unwrap(
        await api.DELETE(
          '/api/companies/{company}/estimates/{estimate}/measurements/{measurement}',
          {
            params: {
              path: { ...path, measurement: change.remove.id },
              header: ifMatch(change.remove),
            },
          },
        ),
      )
  }
}

export function useChangeTree(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (change: TreeChange) => {
      await applyChange(company, id, change)
    },
    // Also after a failure: a 412 means the tree on screen is old
    onSettled: () => treeChanged(queryClient, company, id),
  })
}

/** New places of chapters and items, sent all together with the tree's ETag. */
export function useArrangeTree(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ etag, arrangement }: { etag: string; arrangement: EstimateArrangement }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/estimates/{estimate}/structure', {
          params: { path: { company, estimate: id }, header: { 'If-Match': etag } },
          body: arrangement,
        }),
      ),
    onSuccess: (structure) => queryClient.setQueryData(keys.structure(company, id), structure),
    onSettled: () => treeChanged(queryClient, company, id),
  })
}
