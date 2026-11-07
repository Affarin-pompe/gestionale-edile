import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateDeadline, type DeadlineInput } from '../api'
import { DeadlineForm } from '../components/DeadlineForm'
import { deadlinePaths } from '../paths'

export function DeadlineNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = deadlinePaths(company.slug)
  const create = useCreateDeadline(company.slug)

  async function save(input: DeadlineInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'deadlines.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="deadlines.title" /> }}
        title={<FormattedMessage id="deadlines.new" />}
      />
      <DeadlineForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
