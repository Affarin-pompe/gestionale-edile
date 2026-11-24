import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { costQuery } from './api'
import { CostCrumb } from './components/CostCrumb'
import { CostDetailPage } from './pages/CostDetailPage'
import { CostEditPage } from './pages/CostEditPage'
import { CostListPage } from './pages/CostListPage'
import { CostNewPage } from './pages/CostNewPage'
import { COST_PARAM, COSTS_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › cost › edit. */
export function costRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('costs.view')

  // Loaded before its pages open: one of another company, or missing, gets the 404 page
  async function loadCost(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [COST_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(costQuery(azienda, id))
    return null
  }

  return [
    {
      path: COSTS_PATH,
      handle: { crumb: 'costs.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: CostListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'costs.new' } satisfies RouteHandle,
          loader: requirePermission('costs.create'),
          Component: CostNewPage,
        },
        {
          path: `:${COST_PARAM}`,
          handle: { crumb: CostCrumb } satisfies RouteHandle,
          loader: loadCost,
          children: [
            { index: true, Component: CostDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'costs.edit' } satisfies RouteHandle,
              loader: requirePermission('costs.update'),
              Component: CostEditPage,
            },
          ],
        },
      ],
    },
  ]
}
