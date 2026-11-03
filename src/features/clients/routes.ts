import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { Permission } from '@/auth/permissions'
import { requirePermission } from '@/auth/session'
import { clientQuery } from './api'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientEditPage } from './pages/ClientEditPage'
import { ClientListPage } from './pages/ClientListPage'
import { ClientNewPage } from './pages/ClientNewPage'
import { CLIENT_PARAM, CLIENTS_PATH } from './paths'

/** Paths relative to the company. */
export function clientRoutes(queryClient: QueryClient): RouteObject[] {
  // The client is loaded before its pages open: one of another company,
  // or one that does not exist, gets the 404 page (the API answers 404)
  function loadClient(permission: Permission) {
    const allowed = requirePermission(permission)
    return async (args: LoaderFunctionArgs) => {
      allowed(args)
      const { azienda = '', [CLIENT_PARAM]: id = '' } = args.params
      await queryClient.ensureQueryData(clientQuery(azienda, id))
      return null
    }
  }

  return [
    {
      path: CLIENTS_PATH,
      loader: requirePermission('clients.view'),
      Component: ClientListPage,
    },
    {
      path: `${CLIENTS_PATH}/nuovo`,
      loader: requirePermission('clients.create'),
      Component: ClientNewPage,
    },
    {
      path: `${CLIENTS_PATH}/:${CLIENT_PARAM}`,
      loader: loadClient('clients.view'),
      Component: ClientDetailPage,
    },
    {
      path: `${CLIENTS_PATH}/:${CLIENT_PARAM}/modifica`,
      loader: loadClient('clients.update'),
      Component: ClientEditPage,
    },
  ]
}
