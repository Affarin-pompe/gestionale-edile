import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { Day, Money } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { employeeQuery } from '../api'
import { ActiveBadge } from '../components/ActiveBadge'
import { employeePaths, useEmployeeId } from '../paths'
import { employeeName } from '../schemas'

export function EmployeeDetailPage() {
  const company = useCompany()
  const id = useEmployeeId()
  const paths = employeePaths(company.slug)
  // Already loaded by the route's loader
  const {
    data: { record: employee },
  } = useSuspenseQuery(employeeQuery(company.slug, id))

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="employees.title" /> }}
        title={employeeName(employee)}
        actions={
          <PermissionGate permission="employees.update">
            <Button asChild>
              <Link to={paths.edit(id)}>
                <Pencil aria-hidden="true" />
                <FormattedMessage id="employees.edit" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <p>
        <ActiveBadge active={employee.active} />
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="employees.section.main">
          <Detail label="employees.jobTitle">{employee.job_title}</Detail>
          <Detail label="employees.taxCode">{employee.tax_code}</Detail>
        </DetailSection>
        <DetailSection title="employees.section.work">
          <Detail label="employees.hiredOn">
            {employee.hired_on && <Day value={employee.hired_on} />}
          </Detail>
          <Detail label="employees.hourlyCost">
            {employee.hourly_cost && <Money value={employee.hourly_cost} />}
          </Detail>
        </DetailSection>
        <DetailSection title="employees.section.contacts">
          <Detail label="employees.phone">
            {employee.phone && <a href={`tel:${employee.phone}`}>{employee.phone}</a>}
          </Detail>
          <Detail label="employees.email">
            {employee.email && <a href={`mailto:${employee.email}`}>{employee.email}</a>}
          </Detail>
        </DetailSection>
        <NotesSection title="employees.notes" notes={employee.notes} />
      </div>
    </div>
  )
}
