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
import { unwrapVersioned, type Versioned } from '@/api/versioned'

export type Site = components['schemas']['Site']
export type SiteInput = components['schemas']['SiteInput']
export type SiteStatus = components['schemas']['SiteStatus']
export type SiteTeamMember = components['schemas']['SiteTeamMember']
export type SiteCostSummary = components['schemas']['SiteCostSummary']
export type SiteDocument = components['schemas']['SiteDocument']
export type SiteDocumentKind = components['schemas']['SiteDocumentKind']
export type SiteActivity = components['schemas']['SiteActivity']
export type SiteActivityInput = components['schemas']['SiteActivityInput']
export type SiteReport = components['schemas']['DailyReportSummary']
export type SiteReportStatus = components['schemas']['DailyReportStatus']
export type SiteCost = components['schemas']['SiteCost']
export type SiteCostCategory = components['schemas']['CostCategory']

// The contract's sort values; the first is the list's default
export const SITE_SORTS = [
  '-updated_at',
  'updated_at',
  'name',
  '-name',
  'code',
  '-code',
  'start_on',
  '-start_on',
] as const
export const SITE_STATUSES = [
  'planned',
  'active',
  'suspended',
  'completed',
] as const satisfies readonly SiteStatus[]

/** The file types the backend takes (uploadSiteDocument), by extension for files without one. */
export const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** 20 MB, as in the contract. */
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024

const keys = {
  all: (company: string) => ['companies', company, 'sites'] as const,
  lists: (company: string) => ['companies', company, 'sites', 'list'] as const,
  detail: (company: string, id: string) => ['companies', company, 'sites', 'detail', id] as const,
  team: (company: string, id: string) => ['companies', company, 'sites', 'team', id] as const,
  documents: (company: string, id: string) =>
    ['companies', company, 'sites', 'documents', id] as const,
  activities: (company: string, id: string) =>
    ['companies', company, 'sites', 'activities', id] as const,
  costSummary: (company: string, id: string) =>
    ['companies', company, 'sites', 'cost-summary', id] as const,
}

const enc = encodeURIComponent

export interface SiteListParams {
  page: number
  perPage: number
  sort: (typeof SITE_SORTS)[number]
  search: string
  status: SiteStatus | undefined
}

export function siteListQuery(company: string, params: SiteListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites', {
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
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

/**
 * The CSV of the list as filtered on screen, without pages. A plain link: the backend
 * serves it on the same domain, with the session cookie, as an attachment.
 */
export function siteExportUrl(
  company: string,
  params: Pick<SiteListParams, 'sort' | 'search' | 'status'>,
) {
  const query = new URLSearchParams({ sort: params.sort })
  const search = params.search.trim()
  if (search) query.set('search', search)
  if (params.status) query.set('filter[status]', params.status)
  return `/api/companies/${enc(company)}/sites/export?${query.toString()}`
}

/** The site with its ETag, which changes and deletion send back in If-Match. */
export function siteQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/sites/{site}', {
          params: { path: { company, site: id } },
          signal,
        }),
      ),
  })
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

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, site: Versioned<Site>) {
  queryClient.setQueryData(keys.detail(company, site.record.id), site)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateSite(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SiteInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/sites', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (site) => saved(queryClient, company, site),
  })
}

/** Saves over the version in `etag`; a newer one on the server gives 412. */
export function useUpdateSite(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: SiteInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/sites/{site}', {
          params: { path: { company, site: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (site) => saved(queryClient, company, site),
  })
}

/**
 * Deletes the site. The detail stays in the cache while its page is open: the caller
 * leaves it, then calls forgetSite.
 */
export function useDeleteSite(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (etag: string) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/sites/{site}', {
          params: { path: { company, site: id }, header: { 'If-Match': etag } },
        }),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.lists(company) }),
    // After a 412 the page shows the version saved by the other person
    onError: () => void queryClient.invalidateQueries({ queryKey: keys.detail(company, id) }),
  })
}

/** Drops a deleted site from the cache, once no page shows it any more. */
export function forgetSite(queryClient: QueryClient, company: string, id: string) {
  queryClient.removeQueries({ queryKey: keys.detail(company, id) })
}

/** The site has reports, costs, documents or estimates: it can be closed, not deleted. */
export function hasDocuments(error: unknown) {
  return error instanceof ApiError && error.status === 409
}

// --- Team ---

export function siteTeamQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.team(company, id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites/{site}/team', {
          params: { path: { company, site: id } },
          signal,
        }),
      ).data,
  })
}

/** The active employees to add, by surname. 100 is the contract's largest page. */
export function employeeOptionsQuery(company: string) {
  return queryOptions({
    queryKey: ['companies', company, 'employees', 'list', 'options'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/employees', {
          params: {
            path: { company },
            query: { per_page: 100, sort: 'last_name', filter: { active: true } },
          },
          signal,
        }),
      ).data,
    staleTime: 60_000,
  })
}

/** The whole team is sent each time: the contract replaces it, without If-Match. */
export function useReplaceSiteTeam(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (employeeIds: string[]) =>
      unwrap(
        await api.PUT('/api/companies/{company}/sites/{site}/team', {
          params: { path: { company, site: id } },
          body: { employee_ids: employeeIds },
        }),
      ).data,
    onSuccess: (team) => queryClient.setQueryData(keys.team(company, id), team),
    onError: () => void queryClient.invalidateQueries({ queryKey: keys.team(company, id) }),
  })
}

// --- Documents and photos ---

export const DOCUMENTS_PER_PAGE = 50

export function siteDocumentsQuery(
  company: string,
  id: string,
  kind: SiteDocumentKind,
  page: number,
) {
  return queryOptions({
    queryKey: [...keys.documents(company, id), kind, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites/{site}/documents', {
          params: {
            path: { company, site: id },
            query: { page, per_page: DOCUMENTS_PER_PAGE, filter: { kind } },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/** The file, served on the same domain as an attachment; also the source of a photo's preview. */
export function documentContentUrl(company: string, site: string, document: string) {
  return `/api/companies/${enc(company)}/sites/${enc(site)}/documents/${enc(document)}/content`
}

/** The content type to declare: the browser's, or the one of the extension when it gives none. */
export function documentType(file: File) {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return DOCUMENT_TYPES[extension] ?? ''
}

export function useUploadSiteDocument(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST('/api/companies/{company}/sites/{site}/documents', {
          params: { path: { company, site: id }, query: { file_name: file.name } },
          // The body is the file itself, with its own type (not JSON, not multipart)
          body: file as unknown as string,
          bodySerializer: (body: unknown) => body as BodyInit,
          headers: { 'Content-Type': documentType(file) },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.documents(company, id) }),
  })
}

/** The document changed since the list was loaded: nothing was deleted. */
export class DocumentChanged extends Error {}

/**
 * Deletes a document. The list has no versions: the document is read first, and if it
 * changed since the list was loaded nothing is deleted.
 */
export function useDeleteSiteDocument(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (document: SiteDocument) => {
      const path = { company, site: id, document: document.id }
      const current = unwrapVersioned(
        await api.GET('/api/companies/{company}/sites/{site}/documents/{document}', {
          params: { path },
        }),
      )
      if (current.record.updated_at !== document.updated_at) throw new DocumentChanged()
      unwrap(
        await api.DELETE('/api/companies/{company}/sites/{site}/documents/{document}', {
          params: { path, header: { 'If-Match': current.etag } },
        }),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.documents(company, id) }),
  })
}

// --- Schedule ---

export function siteActivitiesQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.activities(company, id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites/{site}/activities', {
          params: { path: { company, site: id } },
          signal,
        }),
      ).data,
  })
}

// The contract gives an activity's ETag only with the answers to its creation and change,
// not in the list, and has no request for a single activity. The ETags received are kept
// here, by id and time of the last change, so one changed by someone else is not matched.
const activityEtags = new Map<string, string>()
const versionKey = (activity: SiteActivity) => `${activity.id}@${activity.updated_at}`

/**
 * The ETag to send to change or delete the activity, if known.
 *
 * TODO(contract): until the list carries the versions, an activity never changed
 * (updated_at equal to created_at) is taken to be at the backend's first version, "1".
 * One changed in another session cannot be changed here.
 */
export function activityEtag(activity: SiteActivity): string | undefined {
  return (
    activityEtags.get(versionKey(activity)) ??
    (activity.updated_at === activity.created_at ? '"1"' : undefined)
  )
}

function remember({ record, etag }: Versioned<SiteActivity>) {
  activityEtags.set(versionKey(record), etag)
  return record
}

/** A new activity (without `activity`), or the changes of `activity`. */
export function useSaveSiteActivity(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      activity,
      etag,
      input,
    }: {
      activity?: SiteActivity
      etag?: string
      input: SiteActivityInput
    }) =>
      remember(
        activity
          ? unwrapVersioned(
              await api.PUT('/api/companies/{company}/sites/{site}/activities/{activity}', {
                params: {
                  path: { company, site: id, activity: activity.id },
                  header: { 'If-Match': etag ?? '' },
                },
                body: input,
              }),
            )
          : unwrapVersioned(
              await api.POST('/api/companies/{company}/sites/{site}/activities', {
                params: { path: { company, site: id } },
                body: input,
              }),
            ),
      ),
    // Also after a 412: the list shows the version saved by the other person
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.activities(company, id) }),
  })
}

export function useDeleteSiteActivity(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activity, etag }: { activity: SiteActivity; etag: string }) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/sites/{site}/activities/{activity}', {
          params: {
            path: { company, site: id, activity: activity.id },
            header: { 'If-Match': etag },
          },
        }),
      )
    },
    // The activities that depended on it lose the dependency: the whole list reloads
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.activities(company, id) }),
  })
}

// --- Costs and reports of the site (their own modules list them all) ---

export function siteCostSummaryQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.costSummary(company, id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/sites/{site}/cost-summary', {
          params: { path: { company, site: id } },
          signal,
        }),
      ),
  })
}

/** How many of the latest costs and reports the site's tabs show. */
export const LATEST = 10

export function latestSiteCostsQuery(company: string, id: string) {
  return queryOptions({
    queryKey: ['companies', company, 'sites', 'costs', id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/costs', {
          params: {
            path: { company },
            query: { per_page: LATEST, sort: '-date', filter: { site: id } },
          },
          signal,
        }),
      ),
  })
}

export function latestSiteReportsQuery(company: string, id: string) {
  return queryOptions({
    queryKey: ['companies', company, 'sites', 'reports', id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/daily-reports', {
          params: {
            path: { company },
            query: { per_page: LATEST, sort: '-date', filter: { site: id } },
          },
          signal,
        }),
      ),
  })
}
