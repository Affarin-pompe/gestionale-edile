import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { costQuery, useUpdateCost, type SiteCostInput } from '../api'
import { CostForm } from '../components/CostForm'
import { costPaths, useCostId } from '../paths'

export function CostEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useCostId()
  const paths = costPaths(company.slug)
  // Already loaded by the route's loader, with the version the changes apply to
  const { data, refetch } = useSuspenseQuery(costQuery(company.slug, id))
  const { record: cost, etag } = data
  const update = useUpdateCost(company.slug, id)

  async function save(input: SiteCostInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'costs.updated' }))
    await navigate(paths.detail(id))
  }

  // After a 412: the newer version replaces the form (its key is the version)
  async function reload() {
    const result = await refetch()
    if (result.isError) throw result.error
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: cost.description }}
        title={<FormattedMessage id="costs.editTitle" />}
      />
      <CostForm
        key={etag}
        cost={cost}
        start={{ site: cost.site_id, date: cost.date }}
        onSubmit={save}
        onReload={reload}
        cancelTo={paths.detail(id)}
      />
    </div>
  )
}
