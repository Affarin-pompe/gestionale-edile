import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { supplierQuery } from '../api'
import { useSupplierId } from '../paths'

/** The supplier's name in the breadcrumbs. It follows the cache, so a rename shows at once. */
export function SupplierCrumb() {
  const company = useCompany()
  const id = useSupplierId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...supplierQuery(company.slug, id), enabled: false })
  if (data) return data.record.name
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'suppliers.one'} />
}
