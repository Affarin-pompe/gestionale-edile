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

export type DailyReport = components['schemas']['DailyReport']
export type DailyReportSummary = components['schemas']['DailyReportSummary']
export type DailyReportInput = components['schemas']['DailyReportInput']
export type DailyReportStatus = components['schemas']['DailyReportStatus']
export type DailyReportToday = components['schemas']['DailyReportToday']

// The contract's sort values; the first is the list's default
export const REPORT_SORTS = ['-date', 'date', '-updated_at', 'updated_at'] as const
export const REPORT_STATUSES = [
  'draft',
  'submitted',
  'approved',
] as const satisfies readonly DailyReportStatus[]
/** The most the contract gives in one page. */
const MAX_PER_PAGE = 100

const keys = {
  all: (company: string) => ['companies', company, 'daily-reports'] as const,
  lists: (company: string) => ['companies', company, 'daily-reports', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'daily-reports', 'detail', id] as const,
  today: (company: string) => ['companies', company, 'daily-reports', 'today'] as const,
  sites: (company: string) => ['companies', company, 'daily-reports', 'sites'] as const,
}

export interface ReportListParams {
  page: number
  perPage: number
  sort: (typeof REPORT_SORTS)[number]
  site: string | undefined
  status: DailyReportStatus | undefined
  from: string | undefined
  to: string | undefined
}

export function reportListQuery(company: string, params: ReportListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/daily-reports', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              filter: {
                site: params.site,
                status: params.status,
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

/** The report with its hours and its ETag, which changes send back in If-Match. */
export function reportQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/daily-reports/{report}', {
          params: { path: { company, report: id } },
          signal,
        }),
      ),
  })
}

/**
 * The report of a site on a day (today in Italy without `date`), or the backend's proposal
 * for it, with the active employees and vehicles to choose from. The names come even for
 * roles that cannot see the employees and the vehicles.
 */
export function todayQuery(company: string, site: string, date?: string) {
  return queryOptions({
    queryKey: [...keys.today(company), site, date ?? null],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/daily-reports/today', {
          params: { path: { company }, query: { site, date } },
          signal,
        }),
      ),
  })
}

export interface SiteOption {
  id: string
  name: string
  code: string | null
  status: components['schemas']['SiteStatus']
}

/** The sites by name: the first page the contract allows. Only with sites.view. */
function siteOptionsQuery(company: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...keys.sites(company), enabled],
    queryFn: async ({ signal }): Promise<SiteOption[]> => {
      if (!enabled) return []
      const { data } = unwrap(
        await api.GET('/api/companies/{company}/sites', {
          params: { path: { company }, query: { per_page: MAX_PER_PAGE, sort: 'name' } },
          signal,
        }),
      )
      return data.map(({ id, name, code, status }) => ({ id, name, code, status }))
    },
    staleTime: 60_000,
  })
}

/** The sites for the filters and the forms, as far as the user may see them. */
export function useSiteOptions() {
  const company = useCompany()
  return useQuery(siteOptionsQuery(company.slug, useCan('sites.view')))
}

/** "2026-01 · Rifacimento copertura": the code, when there is one, helps tell sites apart. */
export function siteLabel(site: { name: string; code: string | null }) {
  return site.code ? `${site.code} · ${site.name}` : site.name
}

/** Someone else changed the report after it was opened (412), or its version was missing (428). */
export function isStale(error: unknown) {
  return error instanceof ApiError && (error.status === 412 || error.status === 428)
}

/** After a save the detail is the backend's answer; lists and today's page load again. */
function saved(queryClient: QueryClient, company: string, report: Versioned<DailyReport>) {
  queryClient.setQueryData(keys.detail(company, report.record.id), report)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
  void queryClient.invalidateQueries({ queryKey: keys.today(company) })
}

export function useCreateReport(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DailyReportInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/daily-reports', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (report) => saved(queryClient, company, report),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateReport(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
      etag,
    }: {
      id: string
      input: DailyReportInput
      etag: string
    }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/daily-reports/{report}', {
          params: { path: { company, report: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (report) => saved(queryClient, company, report),
  })
}

/** Sending (draft → submitted), approving, or back to draft, over the version in `etag`. */
export function useChangeReportStatus(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      etag,
    }: {
      id: string
      status: DailyReportStatus
      etag: string
    }) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/daily-reports/{report}/status', {
          params: { path: { company, report: id }, header: { 'If-Match': etag } },
          body: { status },
        }),
      ),
    onSuccess: (report) => saved(queryClient, company, report),
    // Someone else may have changed it: the pages show the current state
    onError: () => void queryClient.invalidateQueries({ queryKey: keys.all(company) }),
  })
}

/**
 * Deletes a draft. The detail stays in the cache while its page is open; the caller leaves
 * the page, then calls forgetReport.
 */
export function useDeleteReport(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/daily-reports/{report}', {
          params: { path: { company, report: id }, header: { 'If-Match': etag } },
        }),
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
      void queryClient.invalidateQueries({ queryKey: keys.today(company) })
    },
  })
}

export function forgetReport(queryClient: QueryClient, company: string, id: string) {
  queryClient.removeQueries({ queryKey: keys.detail(company, id) })
}

/** Loads the report again, e.g. after a 412: the page then shows the newer version. */
export function useReloadReport(company: string, id: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.refetchQueries({ queryKey: keys.detail(company, id) }, { throwOnError: true })
}
