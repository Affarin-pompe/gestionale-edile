import type { QueryClient } from '@tanstack/react-query'
import { data, redirect, type RouteObject } from 'react-router'
import { LoginPage } from '@/auth/LoginPage'
import { NoCompanyPage } from '@/auth/NoCompanyPage'
import { homeLoader, loginAction, logoutAction, requireAuth, requireCompany } from '@/auth/session'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { HomePage } from './HomePage'
import { LoadingScreen } from './LoadingScreen'
import { PageError, RouteError } from './RouteError'

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
              Component: AppLayout,
              children: [
                {
                  // Errors of a page show inside the layout
                  ErrorBoundary: PageError,
                  children: [
                    { index: true, Component: HomePage },
                    {
                      path: '*',
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
