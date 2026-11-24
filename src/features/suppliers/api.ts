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
import { unwrapVersioned, type Versioned } from '@/api/versioned'

export type Supplier = components['schemas']['Supplier']
export type SupplierInput = components['schemas']['SupplierInput']
export type SupplierCategory = components['schemas']['SupplierCategory']
export type SupplierDocument = components['schemas']['SupplierDocument']
export type SupplierDocumentInput = components['schemas']['SupplierDocumentInput']
export type SupplierDocumentKind = components['schemas']['SupplierDocumentKind']
export type SupplierDocumentStatus = SupplierDocument['status']

// The contract's sort values; the first is the list's default
export const SUPPLIER_SORTS = ['name', '-name', '-created_at', 'created_at'] as const
export const SUPPLIER_CATEGORIES = [
  'materials',
  'rentals',
  'subcontracting',
  'services',
  'other',
] as const satisfies readonly SupplierCategory[]
export const SUPPLIER_DOCUMENT_KINDS = [
  'durc',
  'chamber_extract',
  'insurance',
  'other',
] as const satisfies readonly SupplierDocumentKind[]

const keys = {
  all: (company: string) => ['companies', company, 'suppliers'] as const,
  lists: (company: string) => ['companies', company, 'suppliers', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'suppliers', 'detail', id] as const,
  documents: (company: string, id: string) =>
    ['companies', company, 'suppliers', 'documents', id] as const,
}
// The deadlines of a document follow it on the backend: their lists change with it
const deadlineKeys = (company: string) => ['companies', company, 'deadlines'] as const

export interface SupplierListParams {
  page: number
  perPage: number
  sort: (typeof SUPPLIER_SORTS)[number]
  search: string
  category: SupplierCategory | undefined
  subcontractor: boolean | undefined
  archived: boolean
}

export function supplierListQuery(company: string, params: SupplierListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/suppliers', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: {
                category: params.category,
                subcontractor: params.subcontractor,
                archived: params.archived || undefined,
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

/** The supplier with its ETag, which changes and archiving send back in If-Match. */
export function supplierQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/suppliers/{supplier}', {
          params: { path: { company, supplier: id } },
          signal,
        }),
      ),
  })
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, supplier: Versioned<Supplier>) {
  queryClient.setQueryData(keys.detail(company, supplier.record.id), supplier)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
  // Deadlines show the supplier's name
  void queryClient.invalidateQueries({ queryKey: deadlineKeys(company) })
}

export function useCreateSupplier(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SupplierInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/suppliers', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (supplier) => saved(queryClient, company, supplier),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateSupplier(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: SupplierInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/suppliers/{supplier}', {
          params: { path: { company, supplier: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (supplier) => saved(queryClient, company, supplier),
  })
}

/** Archives the supplier, or brings it back among the active ones. */
export function useArchiveSupplier(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ archive, etag }: { archive: boolean; etag: string }) => {
      const options = {
        params: { path: { company, supplier: id }, header: { 'If-Match': etag } },
      }
      return unwrapVersioned(
        archive
          ? await api.POST('/api/companies/{company}/suppliers/{supplier}/archive', options)
          : await api.POST('/api/companies/{company}/suppliers/{supplier}/restore', options),
      )
    },
    onSuccess: (supplier) => saved(queryClient, company, supplier),
    // After a 412 the page shows the version saved by the other person
    onError: () => queryClient.invalidateQueries({ queryKey: keys.detail(company, id) }),
  })
}

// --- Documents of regularity (DURC, chamber extract, insurance) ---

// The contract gives a document's ETag only with the answers to its creation and change, not
// in the list, and has no request for a single document. The ETags received are kept here,
// by id and time of the last change, so a document changed by someone else is not matched.
const documentEtags = new Map<string, string>()
const versionKey = (document: SupplierDocument) => `${document.id}@${document.updated_at}`

/**
 * The ETag to send to change or delete the document, if known.
 *
 * TODO(contract): until the list carries the documents' versions, a document never changed
 * (updated_at equal to created_at) is taken to be at the backend's first version, "1".
 * A document changed in another session cannot be changed here.
 */
export function documentEtag(document: SupplierDocument): string | undefined {
  return (
    documentEtags.get(versionKey(document)) ??
    (document.updated_at === document.created_at ? '"1"' : undefined)
  )
}

function remember({ record, etag }: Versioned<SupplierDocument>) {
  documentEtags.set(versionKey(record), etag)
  return record
}

export function supplierDocumentsQuery(company: string, supplierId: string) {
  return queryOptions({
    queryKey: keys.documents(company, supplierId),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/suppliers/{supplier}/documents', {
          params: { path: { company, supplier: supplierId } },
          signal,
        }),
      ).data,
  })
}

function documentsChanged(queryClient: QueryClient, company: string, supplierId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.documents(company, supplierId) }),
    queryClient.invalidateQueries({ queryKey: deadlineKeys(company) }),
  ])
}

export function useCreateSupplierDocument(company: string, supplierId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SupplierDocumentInput) =>
      remember(
        unwrapVersioned(
          await api.POST('/api/companies/{company}/suppliers/{supplier}/documents', {
            params: { path: { company, supplier: supplierId } },
            body: input,
          }),
        ),
      ),
    onSuccess: () => documentsChanged(queryClient, company, supplierId),
  })
}

export function useUpdateSupplierDocument(company: string, supplierId: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: SupplierDocumentInput; etag: string }) =>
      remember(
        unwrapVersioned(
          await api.PUT('/api/companies/{company}/suppliers/{supplier}/documents/{document}', {
            params: {
              path: { company, supplier: supplierId, document: id },
              header: { 'If-Match': etag },
            },
            body: input,
          }),
        ),
      ),
    onSuccess: () => documentsChanged(queryClient, company, supplierId),
  })
}

export function useDeleteSupplierDocument(company: string, supplierId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      unwrap(
        await api.DELETE('/api/companies/{company}/suppliers/{supplier}/documents/{document}', {
          params: {
            path: { company, supplier: supplierId, document: id },
            header: { 'If-Match': etag },
          },
        }),
      )
    },
    // Also after a 412: the list shows the version saved by the other person
    onSettled: () => documentsChanged(queryClient, company, supplierId),
  })
}
