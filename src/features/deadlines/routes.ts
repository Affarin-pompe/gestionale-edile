import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { deadlineQuery } from './api'
import { DeadlineCrumb } from './components/DeadlineCrumb'
import { DeadlineCalendarPage } from './pages/DeadlineCalendarPage'
import { DeadlineDetailPage } from './pages/DeadlineDetailPage'
import { DeadlineEditPage } from './pages/DeadlineEditPage'
import { DeadlineListPage } from './pages/DeadlineListPage'
import { DeadlineNewPage } from './pages/DeadlineNewPage'
import { CALENDAR_PATH, DEADLINE_PARAM, DEADLINES_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › deadline › edit. */
export function deadlineRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('deadlines.view')

  // Loaded before its pages open: one of another company, or missing, gets the 404 page
  async function loadDeadline(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [DEADLINE_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(deadlineQuery(azienda, id))
    return null
  }

  return [
    {
      path: DEADLINES_PATH,
      handle: { crumb: 'deadlines.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: DeadlineListPage },
        {
          path: CALENDAR_PATH,
          handle: { crumb: 'deadlines.calendar' } satisfies RouteHandle,
          loader: canView,
          Component: DeadlineCalendarPage,
        },
        {
          path: 'nuova',
          handle: { crumb: 'deadlines.new' } satisfies RouteHandle,
          loader: requirePermission('deadlines.create'),
          Component: DeadlineNewPage,
        },
        {
          path: `:${DEADLINE_PARAM}`,
          handle: { crumb: DeadlineCrumb } satisfies RouteHandle,
          loader: loadDeadline,
          children: [
            { index: true, Component: DeadlineDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'deadlines.edit' } satisfies RouteHandle,
              loader: requirePermission('deadlines.update'),
              Component: DeadlineEditPage,
            },
          ],
        },
      ],
    },
  ]
}
