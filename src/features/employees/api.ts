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

export type Employee = components['schemas']['Employee']
export type EmployeeInput = components['schemas']['EmployeeInput']

// The contract's sort values; the first is the list's default
export const EMPLOYEE_SORTS = [
  'last_name',
  '-last_name',
  'hired_on',
  '-hired_on',
  '-updated_at',
  'updated_at',
] as const

const keys = {
  lists: (company: string) => ['companies', company, 'employees', 'list'] as const,
  detail: (company: string, id: string) =>
    ['companies', company, 'employees', 'detail', id] as const,
}

export interface EmployeeListParams {
  page: number
  perPage: number
  sort: (typeof EMPLOYEE_SORTS)[number]
  search: string
  /** true: only those still working; false: only those who left; undefined: everyone. */
  active: boolean | undefined
}

export function employeeListQuery(company: string, params: EmployeeListParams) {
  return queryOptions({
    queryKey: [...keys.lists(company), params],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/employees', {
          params: {
            path: { company },
            query: {
              page: params.page,
              per_page: params.perPage,
              sort: params.sort,
              search: params.search.trim() || undefined,
              filter: params.active === undefined ? undefined : { active: params.active },
            },
          },
          signal,
        }),
      ),
    // The previous page stays on screen while the next one loads
    placeholderData: keepPreviousData,
  })
}

/** The employee with its ETag, which a change sends back in If-Match. */
export function employeeQuery(company: string, id: string) {
  return queryOptions({
    queryKey: keys.detail(company, id),
    queryFn: async ({ signal }) =>
      unwrapVersioned(
        await api.GET('/api/companies/{company}/employees/{employee}', {
          params: { path: { company, employee: id } },
          signal,
        }),
      ),
  })
}

/** After a save the detail is the backend's answer, and the lists are loaded again. */
function saved(queryClient: QueryClient, company: string, employee: Versioned<Employee>) {
  queryClient.setQueryData(keys.detail(company, employee.record.id), employee)
  void queryClient.invalidateQueries({ queryKey: keys.lists(company) })
}

export function useCreateEmployee(company: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: EmployeeInput) =>
      unwrapVersioned(
        await api.POST('/api/companies/{company}/employees', {
          params: { path: { company } },
          body: input,
        }),
      ),
    onSuccess: (employee) => saved(queryClient, company, employee),
  })
}

/** A change of the version the user has in front: a 412 if someone saved it meanwhile. */
export function useUpdateEmployee(company: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, etag }: { input: EmployeeInput; etag: string }) =>
      unwrapVersioned(
        await api.PUT('/api/companies/{company}/employees/{employee}', {
          params: { path: { company, employee: id }, header: { 'If-Match': etag } },
          body: input,
        }),
      ),
    onSuccess: (employee) => saved(queryClient, company, employee),
  })
}
