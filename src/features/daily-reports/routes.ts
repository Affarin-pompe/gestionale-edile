import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { reportQuery } from './api'
import { ReportCrumb } from './components/ReportCrumb'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { ReportEditPage } from './pages/ReportEditPage'
import { ReportListPage } from './pages/ReportListPage'
import { ReportNewPage } from './pages/ReportNewPage'
import { ReportTodayPage } from './pages/ReportTodayPage'
import { REPORT_PARAM, REPORTS_PATH, TODAY_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › report › edit. */
export function reportRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('reports.view')

  // Loaded before its pages open: one of another company, or missing, gets the 404 page
  async function loadReport(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [REPORT_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(reportQuery(azienda, id))
    return null
  }

  return [
    {
      path: REPORTS_PATH,
      handle: { crumb: 'dailyReports.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: ReportListPage },
        {
          // Also for who can only read: the day's report shows, without the form
          path: TODAY_PATH,
          handle: { crumb: 'dailyReports.today' } satisfies RouteHandle,
          loader: canView,
          Component: ReportTodayPage,
        },
        {
          path: 'nuovo',
          handle: { crumb: 'dailyReports.new' } satisfies RouteHandle,
          loader: requirePermission('reports.create'),
          Component: ReportNewPage,
        },
        {
          path: `:${REPORT_PARAM}`,
          handle: { crumb: ReportCrumb } satisfies RouteHandle,
          loader: loadReport,
          children: [
            { index: true, Component: ReportDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'dailyReports.edit' } satisfies RouteHandle,
              loader: requirePermission('reports.update'),
              Component: ReportEditPage,
            },
          ],
        },
      ],
    },
  ]
}
