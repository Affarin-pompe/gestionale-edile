import type { RouteObject } from 'react-router'
import { DashboardPage } from './pages/DashboardPage'

/** The company's home page. Its crumb is the company route's own ("Dashboard"). */
export function dashboardRoutes(): RouteObject[] {
  return [{ index: true, Component: DashboardPage }]
}
