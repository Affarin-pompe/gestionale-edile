import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { employeeQuery, useUpdateEmployee, type EmployeeInput } from '../api'
import { EmployeeForm } from '../components/EmployeeForm'
import { employeePaths, useEmployeeId } from '../paths'
import { employeeName } from '../schemas'

export function EmployeeEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useEmployeeId()
  const paths = employeePaths(company.slug)
  // Already loaded by the route's loader
  const { data } = useSuspenseQuery(employeeQuery(company.slug, id))
  // The version the form was opened on: if someone saves meanwhile, the backend answers 412
  const [etag] = useState(data.etag)
  const update = useUpdateEmployee(company.slug, id)

  async function save(input: EmployeeInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'employees.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: employeeName(data.record) }}
        title={<FormattedMessage id="employees.editTitle" />}
      />
      <EmployeeForm employee={data.record} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
