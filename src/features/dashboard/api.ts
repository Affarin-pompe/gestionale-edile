import { queryOptions } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Dashboard = components['schemas']['Dashboard']
export type DashboardDeadline = components['schemas']['DashboardDeadline']
export type DashboardOverBudgetSite = components['schemas']['DashboardOverBudgetSite']

/** Each section is null when the user's role may not see it. */
export function dashboardQuery(company: string) {
  return queryOptions({
    queryKey: ['companies', company, 'dashboard'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/companies/{company}/dashboard', {
          params: { path: { company } },
          signal,
        }),
      ),
  })
}
