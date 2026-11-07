import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { estimateQuery, structureQuery } from './api'
import { EstimateCrumb } from './components/EstimateCrumb'
import { EstimateDetailPage } from './pages/EstimateDetailPage'
import { EstimateEditPage } from './pages/EstimateEditPage'
import { EstimateListPage } from './pages/EstimateListPage'
import { EstimateNewPage } from './pages/EstimateNewPage'
import { ESTIMATE_PARAM, ESTIMATES_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › estimate › edit. */
export function estimateRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('estimates.view')

  // The estimate is loaded before its pages open: one of another company, or one that does
  // not exist, gets the 404 page. The tree starts loading at the same time.
  async function loadEstimate(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [ESTIMATE_PARAM]: id = '' } = args.params
    void queryClient.prefetchQuery(structureQuery(azienda, id))
    await queryClient.ensureQueryData(estimateQuery(azienda, id))
    return null
  }

  return [
    {
      path: ESTIMATES_PATH,
      handle: { crumb: 'estimates.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: EstimateListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'estimates.new' } satisfies RouteHandle,
          loader: requirePermission('estimates.create'),
          Component: EstimateNewPage,
        },
        {
          path: `:${ESTIMATE_PARAM}`,
          handle: { crumb: EstimateCrumb } satisfies RouteHandle,
          loader: loadEstimate,
          children: [
            { index: true, Component: EstimateDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'estimates.edit' } satisfies RouteHandle,
              loader: requirePermission('estimates.update'),
              Component: EstimateEditPage,
            },
          ],
        },
      ],
    },
  ]
}
