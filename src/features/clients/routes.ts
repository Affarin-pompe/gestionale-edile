import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { clientQuery } from './api'
import { ClientCrumb } from './components/ClientCrumb'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientEditPage } from './pages/ClientEditPage'
import { ClientListPage } from './pages/ClientListPage'
import { ClientNewPage } from './pages/ClientNewPage'
import { CLIENT_PARAM, CLIENTS_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › client › edit. */
export function clientRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('clients.view')

  // The client is loaded before its pages open: one of another company,
  // or one that does not exist, gets the 404 page (the API answers 404)
  async function loadClient(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [CLIENT_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(clientQuery(azienda, id))
    return null
  }

  return [
    {
      path: CLIENTS_PATH,
      handle: { crumb: 'clients.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: ClientListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'clients.new' } satisfies RouteHandle,
          loader: requirePermission('clients.create'),
          Component: ClientNewPage,
        },
        {
          path: `:${CLIENT_PARAM}`,
          handle: { crumb: ClientCrumb } satisfies RouteHandle,
          loader: loadClient,
          children: [
            { index: true, Component: ClientDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'clients.edit' } satisfies RouteHandle,
              loader: requirePermission('clients.update'),
              Component: ClientEditPage,
            },
          ],
        },
      ],
    },
  ]
}
