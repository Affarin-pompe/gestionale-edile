import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { vehicleQuery } from './api'
import { VehicleCrumb } from './components/VehicleCrumb'
import { VehicleDetailPage } from './pages/VehicleDetailPage'
import { VehicleEditPage } from './pages/VehicleEditPage'
import { VehicleListPage } from './pages/VehicleListPage'
import { VehicleNewPage } from './pages/VehicleNewPage'
import { VEHICLE_PARAM, VEHICLES_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › vehicle › edit. */
export function vehicleRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('vehicles.view')

  // Loaded before its pages open: one of another company, or missing, gets the 404 page
  async function loadVehicle(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [VEHICLE_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(vehicleQuery(azienda, id))
    return null
  }

  return [
    {
      path: VEHICLES_PATH,
      handle: { crumb: 'vehicles.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: VehicleListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'vehicles.new' } satisfies RouteHandle,
          loader: requirePermission('vehicles.create'),
          Component: VehicleNewPage,
        },
        {
          path: `:${VEHICLE_PARAM}`,
          handle: { crumb: VehicleCrumb } satisfies RouteHandle,
          loader: loadVehicle,
          children: [
            { index: true, Component: VehicleDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'vehicles.edit' } satisfies RouteHandle,
              loader: requirePermission('vehicles.update'),
              Component: VehicleEditPage,
            },
          ],
        },
      ],
    },
  ]
}
