import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createContext, useParams } from 'react-router'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { components } from '@/api/schema'

export type Me = components['schemas']['Me']

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async ({ signal }) => unwrap(await api.GET('/api/me', { signal })),
  // Roles change rarely: refreshed when the user comes back to the tab, not on every page
  staleTime: 5 * 60_000,
})

/** The signed-in user, for the middleware and loaders below requireAuth. */
export const meContext = createContext<Me>()

/** The signed-in user. Only for pages below requireAuth, which has already loaded it. */
export function useMe() {
  return useSuspenseQuery(meQuery).data
}

/** The company in the URL, with the user's role and permissions in it. */
export function useCompany() {
  const { azienda } = useParams()
  const company = useMe().companies.find((c) => c.slug === azienda)
  // requireCompany has already checked the membership
  if (!company) throw new Error(`useCompany used outside a company route (${azienda})`)
  return company
}
