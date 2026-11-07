import type { QueryClient } from '@tanstack/react-query'
import { data, redirect, type RouteObject } from 'react-router'
import { LoginPage } from '@/auth/LoginPage'
import { NoCompanyPage } from '@/auth/NoCompanyPage'
import { homeLoader, loginAction, logoutAction, requireAuth, requireCompany } from '@/auth/session'
import { AppLayout } from '@/layouts/AppLayout'
import { clientRoutes } from '@/features/clients/routes'
import { dashboardRoutes } from '@/features/dashboard/routes'
import { estimateRoutes } from '@/features/estimates/routes'
import { quoteRoutes } from '@/features/quotes/routes'
import { siteRoutes } from '@/features/sites/routes'
import { deadlineRoutes } from '@/features/deadlines/routes'
import { employeeRoutes } from '@/features/employees/routes'
import { supplierRoutes } from '@/features/suppliers/routes'
import { vehicleRoutes } from '@/features/vehicles/routes'
import { AuthLayout } from '@/layouts/AuthLayout'
import { LoadingScreen } from './LoadingScreen'
import { PageError, RouteError } from './RouteError'
import type { RouteHandle } from './route-handle'

export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/',
      ErrorBoundary: RouteError,
      HydrateFallback: LoadingScreen,
      children: [
        {
          Component: AuthLayout,
          children: [{ path: 'accedi', action: loginAction, Component: LoginPage }],
        },
        // Only for the logout form: opened from the address bar, it goes home
        { path: 'esci', action: logoutAction, loader: () => redirect('/') },
        {
          middleware: [requireAuth(queryClient)],
          children: [
            // Redirects to the first company; the page shows only to users without one
            { index: true, loader: homeLoader, Component: NoCompanyPage },
            {
              // Every other path lands here, so a wrong URL also needs a signed-in user
              path: ':azienda',
              middleware: [requireCompany],
              handle: { crumb: 'menu.dashboard' } satisfies RouteHandle,
              Component: AppLayout,
              children: [
                {
                  // Errors of a page show inside the layout
                  ErrorBoundary: PageError,
                  children: [
                    ...dashboardRoutes(),
                    ...clientRoutes(queryClient),
                    ...quoteRoutes(queryClient),
                    ...estimateRoutes(queryClient),
                    ...siteRoutes(queryClient),
                    ...deadlineRoutes(queryClient),
                    ...supplierRoutes(queryClient),
                    ...employeeRoutes(queryClient),
                    ...vehicleRoutes(queryClient),
                    {
                      path: '*',
                      handle: { crumb: 'crumb.notFound' } satisfies RouteHandle,
                      loader: () => {
                        throw data(null, { status: 404 })
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}
