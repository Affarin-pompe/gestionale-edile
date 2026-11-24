import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateEmployee, type EmployeeInput } from '../api'
import { EmployeeForm } from '../components/EmployeeForm'
import { employeePaths } from '../paths'

export function EmployeeNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = employeePaths(company.slug)
  const create = useCreateEmployee(company.slug)

  async function save(input: EmployeeInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'employees.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="employees.title" /> }}
        title={<FormattedMessage id="employees.new" />}
      />
      <EmployeeForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
