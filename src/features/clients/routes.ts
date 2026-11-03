import type { RouteObject } from 'react-router'
import { requirePermission } from '@/auth/session'
import { ClientListPage } from './pages/ClientListPage'

/** Paths relative to the company. */
export const clientRoutes: RouteObject[] = [
  {
    path: 'anagrafiche/clienti',
    loader: requirePermission('clients.view'),
    Component: ClientListPage,
  },
]
