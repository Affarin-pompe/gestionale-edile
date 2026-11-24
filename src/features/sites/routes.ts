import type { QueryClient } from '@tanstack/react-query'
import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { siteQuery } from './api'
import { SiteCrumb } from './components/SiteCrumb'
import { SiteCostsPage } from './pages/SiteCostsPage'
import { SiteDetailLayout } from './pages/SiteDetailLayout'
import { SiteDocumentsPage, SitePhotosPage } from './pages/SiteDocumentsPage'
import { SiteEditPage } from './pages/SiteEditPage'
import { SiteListPage } from './pages/SiteListPage'
import { SiteNewPage } from './pages/SiteNewPage'
import { SiteOverviewPage } from './pages/SiteOverviewPage'
import { SiteReportsPage } from './pages/SiteReportsPage'
import { SiteSchedulePage } from './pages/SiteSchedulePage'
import { SiteTeamPage } from './pages/SiteTeamPage'
import { SITE_PARAM, SITE_TABS, SITES_PATH, TAB_PERMISSIONS, type SiteTab } from './paths'

/**
 * Paths relative to the company, nested like the breadcrumbs: list › site › tab, and
 * list › site › edit. The tabs share the frame with the site's name and actions.
 */
export function siteRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('sites.view')

  // The site is loaded before its pages open: one of another company, or one that does
  // not exist, gets the 404 page (the API answers 404)
  async function loadSite(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [SITE_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(siteQuery(azienda, id))
    return null
  }

  const tab = (name: SiteTab, Component: RouteObject['Component']): RouteObject => ({
    path: SITE_TABS[name],
    handle: { crumb: `sites.tab.${name}` } satisfies RouteHandle,
    loader: requirePermission(TAB_PERMISSIONS[name]),
    Component,
  })

  return [
    {
      path: SITES_PATH,
      handle: { crumb: 'sites.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: SiteListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'sites.new' } satisfies RouteHandle,
          loader: requirePermission('sites.create'),
          Component: SiteNewPage,
        },
        {
          path: `:${SITE_PARAM}`,
          handle: { crumb: SiteCrumb } satisfies RouteHandle,
          loader: loadSite,
          children: [
            {
              // The site opens on its overview
              index: true,
              loader: ({ request }: LoaderFunctionArgs) => {
                const path = new URL(request.url).pathname.replace(/\/+$/, '')
                return redirect(`${path}/${SITE_TABS.overview}`)
              },
            },
            {
              Component: SiteDetailLayout,
              children: [
                tab('overview', SiteOverviewPage),
                tab('reports', SiteReportsPage),
                tab('documents', SiteDocumentsPage),
                tab('costs', SiteCostsPage),
                tab('photos', SitePhotosPage),
                tab('team', SiteTeamPage),
                tab('schedule', SiteSchedulePage),
              ],
            },
            {
              path: 'modifica',
              handle: { crumb: 'sites.edit' } satisfies RouteHandle,
              loader: requirePermission('sites.update'),
              Component: SiteEditPage,
            },
          ],
        },
      ],
    },
  ]
}
