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

export type Quote = components['schemas']['Quote']
export type QuoteInput = components['schemas']['QuoteInput']
export type QuoteStatus = components['schemas']['QuoteStatus']
export type QuoteLine = components['schemas']['QuoteLine']
export type QuoteLineInput = components['schemas']['QuoteLineInput']
export type QuoteLineKind = components['schemas']['QuoteLineKind']
export type VatRate = components['schemas']['VatRate']
/** The outcomes changeQuoteStatus accepts. */
export type QuoteOutcome = 'sent' | 'accepted' | 'rejected' | 'expired'

// The contract's sort values; the first is the list's default
export const QUOTE_SORTS = [
  '-updated_at',
  'updated_at',
  'number',
  '-number',
  'issue_date',
  '-issue_date',
] as const
export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
] as const satisfies readonly QuoteStatus[]
export const VAT_RATES = [22, 10, 5, 4, 0] as const satisfies readonly VatRate[]
export const LINE_KINDS = ['item', 'text', 'section'] as const satisfies readonly QuoteLineKind[]

const keys = {
  all: (company: string) => ['companies', company, 'quotes'] as const,
  lists: (company: string) => ['companies', company, 'quotes', 'list'] as const,
  detail: (company: string, id: string) => ['companies', company, 'quotes', 'detail', id] as const,
  lines: (company: string, id: string) => ['companies', company, 'quotes', 'lines', id] as const,
}

export interface QuoteListParams {
  page: number
  perPage: number
  sort: (typeof QUOTE_SORTS)[number]
  search: string
  status: QuoteStatus | undefined
}

export function quoteListQuery(company: string, params: QuoteListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/quotes', {
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

/** The quote's header with its ETag, which every change sends back. */
export function quoteQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/quotes/{quote}', {
          params: { path: { company, quote: id } },
          signal,
        }),
      ),
  })
}

export function quoteLinesQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.lines(company, id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/quotes/{quote}/lines', {
          params: { path: { company, quote: id } },
          signal,
        }),
      ).data,
  })
}

/** The PDF, served by the backend on the same domain; the session cookie goes with it. */
export function quotePdfUrl(company: string, id: string) {
  return `/api/companies/${encodeURIComponent(company)}/quotes/${encodeURIComponent(id)}/pdf`
}

/** The clients to choose from, by name. The contract pages at 100: enough for a choice list. */
export function clientOptionsQuery(company: string) {
  return queryOptions({
    queryKey: ['companies', company, 'clients', 'list', 'options'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/clients', {
          params: { path: { company }, query: { per_page: 100, sort: 'name' } },
          signal,
        }),
      ).data,
    staleTime: 60_000,
  })
}

/** After a change the detail is the backend's answer, and the lists are loaded again. */
export function quoteSaved(queryClient: QueryClient, company: string, saved: Versioned<Quote>) {
  queryClient.setQueryData(keys.detail(company, saved.data.id), saved)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

/** The ETag of the quote as the user sees it. */
function etagOf(queryClient: QueryClient, company: string, id: string) {
  return queryClient.getQueryData<Versioned<Quote>>(keys.detail(company, id))?.etag ?? ''
}

export function useCreateQuote(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuoteInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/quotes', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (saved) => quoteSaved(queryClient, company, saved),
  })
}

export function useUpdateQuote(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuoteInput) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/quotes/{quote}', {
          params: {
            path: { company, quote: id },
            header: { 'If-Match': etagOf(queryClient, company, id) },
          },
          body: input,
        }),
      ),
    onSuccess: (saved) => quoteSaved(queryClient, company, saved),
  })
}

export function useDeleteQuote(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(
        await api.DELETE('/api/companies/{company}/quotes/{quote}', {
          params: {
            path: { company, quote: id },
            header: { 'If-Match': etagOf(queryClient, company, id) },
          },
        }),
      )
    },
    // The page still shows the quote until it leaves: its cache stays, the lists reload
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.lists(company) }),
  })
}

/** Sending a draft ('send'), or the outcome of a sent quote. */
export function useChangeQuoteStatus(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (target: 'send' | QuoteOutcome) => {
      const params = {
        path: { company, quote: id },
        header: { 'If-Match': etagOf(queryClient, company, id) },
      }
      return target === 'send'
        ? unwrapVersioned(
            await api.POST('/api/companies/{company}/quotes/{quote}/send', { params }),
          )
        : unwrapVersioned(
            await api.POST('/api/companies/{company}/quotes/{quote}/status', {
              params,
              body: { status: target },
            }),
          )
    },
    onSuccess: (saved) => quoteSaved(queryClient, company, saved),
    // Someone else may have changed it: the page shows the current state
    onError: () => void queryClient.invalidateQueries({ queryKey: keys.detail(company, id) }),
  })
}

/** A new draft with the same header and lines; the original stays as it is. */
export function useReviseQuote(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/quotes/{quote}/revisions', {
          params: { path: { company, quote: id } },
        }),
      ),
    onSuccess: (saved) => quoteSaved(queryClient, company, saved),
  })
}

/** Lines change the totals: the header is loaded again with the lines. */
function linesChanged(queryClient: QueryClient, company: string, id: string) {
  void queryClient.invalidateQueries({ queryKey: keys.lines(company, id) })
  void queryClient.invalidateQueries({ queryKey: keys.detail(company, id) })
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

async function putLine(company: string, quote: string, line: QuoteLine, input: QuoteLineInput) {
  return unwrap(
    await api.PUT('/api/companies/{company}/quotes/{quote}/lines/{line}', {
      params: {
        path: { company, quote, line: line.id },
        header: { 'If-Match': line.version },
      },
      body: input,
    }),
  )
}

/** A new line at the end (without `line`), or the changes of `line`. */
export function useSaveQuoteLine(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ line, input }: { line?: QuoteLine; input: QuoteLineInput }) =>
      line
        ? putLine(company, id, line, input)
        : unwrap(
            await api.POST('/api/companies/{company}/quotes/{quote}/lines', {
              params: { path: { company, quote: id } },
              body: input,
            }),
          ),
    onSettled: () => linesChanged(queryClient, company, id),
  })
}

export function useDeleteQuoteLine(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (line: QuoteLine) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/quotes/{quote}/lines/{line}', {
          params: {
            path: { company, quote: id, line: line.id },
            header: { 'If-Match': line.version },
          },
        }),
      )
    },
    onSettled: () => linesChanged(queryClient, company, id),
  })
}

/** What a line says, without its identity: what an exchange of places moves. */
export function lineInput(line: QuoteLine): QuoteLineInput {
  return {
    kind: line.kind,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_percent: line.discount_percent,
    vat_rate: line.vat_rate,
  }
}

/**
 * Moves a line one place up or down. The contract has no operation to reorder lines, so the
 * two neighbours exchange their contents with two saves. If the second fails, the first is
 * put back, so no line is lost or doubled.
 */
export function useSwapQuoteLines(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ first, second }: { first: QuoteLine; second: QuoteLine }) => {
      const changed = await putLine(company, id, first, lineInput(second))
      try {
        await putLine(company, id, second, lineInput(first))
      } catch (error) {
        await putLine(company, id, changed, lineInput(first))
        throw error
      }
    },
    onSettled: () => linesChanged(queryClient, company, id),
  })
}

/** Everything about quotes is loaded again, e.g. after one is made from an estimate. */
export function invalidateQuotes(queryClient: QueryClient, company: string) {
  void queryClient.invalidateQueries({ queryKey: keys.all(company) })
}
