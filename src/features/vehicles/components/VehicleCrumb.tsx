import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { vehicleQuery } from '../api'
import { useVehicleId } from '../paths'

/** The vehicle's name in the breadcrumbs. It follows the cache, so a rename shows at once. */
export function VehicleCrumb() {
  const company = useCompany()
  const id = useVehicleId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...vehicleQuery(company.slug, id), enabled: false })
  if (data) return data.record.name
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'vehicles.one'} />
}
