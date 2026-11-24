import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { employeeQuery } from './api'
import { EmployeeCrumb } from './components/EmployeeCrumb'
import { EmployeeDetailPage } from './pages/EmployeeDetailPage'
import { EmployeeEditPage } from './pages/EmployeeEditPage'
import { EmployeeListPage } from './pages/EmployeeListPage'
import { EmployeeNewPage } from './pages/EmployeeNewPage'
import { EMPLOYEE_PARAM, EMPLOYEES_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › employee › edit. */
export function employeeRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('employees.view')

  // Loaded before its pages open: one of another company, or missing, gets the 404 page
  async function loadEmployee(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [EMPLOYEE_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(employeeQuery(azienda, id))
    return null
  }

  return [
    {
      path: EMPLOYEES_PATH,
      handle: { crumb: 'employees.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: EmployeeListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'employees.new' } satisfies RouteHandle,
          loader: requirePermission('employees.create'),
          Component: EmployeeNewPage,
        },
        {
          path: `:${EMPLOYEE_PARAM}`,
          handle: { crumb: EmployeeCrumb } satisfies RouteHandle,
          loader: loadEmployee,
          children: [
            { index: true, Component: EmployeeDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'employees.edit' } satisfies RouteHandle,
              loader: requirePermission('employees.update'),
              Component: EmployeeEditPage,
            },
          ],
        },
      ],
    },
  ]
}
