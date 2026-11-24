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

export type Vehicle = components['schemas']['Vehicle']
export type VehicleInput = components['schemas']['VehicleInput']
export type VehicleKind = components['schemas']['VehicleKind']

// The contract's sort values; the first is the list's default
export const VEHICLE_SORTS = ['name', '-name', '-updated_at', 'updated_at'] as const
export const VEHICLE_KINDS = [
  'vehicle',
  'machine',
  'equipment',
] as const satisfies readonly VehicleKind[]

const keys = {
  lists: (company: string) => ['companies', company, 'vehicles', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'vehicles', 'detail', id] as const,
}

export interface VehicleListParams {
  page: number
  perPage: number
  sort: (typeof VEHICLE_SORTS)[number]
  search: string
  kind: VehicleKind | undefined
  /** true: only those in use; false: only those sold or retired; undefined: all. */
  active: boolean | undefined
}

export function vehicleListQuery(company: string, params: VehicleListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/vehicles', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: { kind: params.kind, active: params.active },
            },
          },
          signal,
        }),
      ),
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

/** The vehicle with its ETag, which a change sends back in If-Match. */
export function vehicleQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/vehicles/{vehicle}', {
          params: { path: { company, vehicle: id } },
          signal,
        }),
      ),
  })
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, vehicle: Versioned<Vehicle>) {
  queryClient.setQueryData(keys.detail(company, vehicle.record.id), vehicle)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateVehicle(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: VehicleInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/vehicles', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (vehicle) => saved(queryClient, company, vehicle),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateVehicle(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: VehicleInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/vehicles/{vehicle}', {
          params: { path: { company, vehicle: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (vehicle) => saved(queryClient, company, vehicle),
  })
}
