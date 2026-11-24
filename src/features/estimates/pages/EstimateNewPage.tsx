import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateEstimate, type EstimateInput } from '../api'
import { EstimateForm } from '../components/EstimateForm'
import { estimatePaths } from '../paths'

export function EstimateNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = estimatePaths(company.slug)
  const create = useCreateEstimate(company.slug)

  async function save(input: EstimateInput) {
    const { data: estimate } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'estimates.created' }))
    // Chapters and items are added on the estimate's page
    await navigate(paths.detail(estimate.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="estimates.title" /> }}
        title={<FormattedMessage id="estimates.new" />}
      />
      <EstimateForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
