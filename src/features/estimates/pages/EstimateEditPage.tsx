import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { estimateQuery, useUpdateEstimate, type EstimateInput } from '../api'
import { EstimateForm } from '../components/EstimateForm'
import { estimatePaths, useEstimateId } from '../paths'

export function EstimateEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useEstimateId()
  const paths = estimatePaths(company.slug)
  // Already loaded by the route's loader
  const { data: estimate } = useSuspenseQuery(estimateQuery(company.slug, id)).data
  const update = useUpdateEstimate(company.slug, id)

  async function save(input: EstimateInput) {
    await update.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'estimates.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: estimate.title }}
        title={<FormattedMessage id="estimates.editTitle" />}
      />
      <EstimateForm estimate={estimate} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
