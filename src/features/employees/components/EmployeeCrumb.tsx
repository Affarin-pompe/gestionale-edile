import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { employeeQuery } from '../api'
import { useEmployeeId } from '../paths'
import { employeeName } from '../schemas'

/** The employee's name in the breadcrumbs. It follows the cache, so a rename shows at once. */
export function EmployeeCrumb() {
  const company = useCompany()
  const id = useEmployeeId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...employeeQuery(company.slug, id), enabled: false })
  if (data) return employeeName(data.record)
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'employees.one'} />
}
