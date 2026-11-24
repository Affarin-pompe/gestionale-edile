import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { today } from '@/lib/days'
import { useCreateCost, type SiteCostInput } from '../api'
import { CostForm } from '../components/CostForm'
import { costPaths, FILTER } from '../paths'

/** A cost entered by hand; ?cantiere=<id> starts it on that site. */
export function CostNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = costPaths(company.slug)
  const [params] = useSearchParams()
  const create = useCreateCost(company.slug)

  async function save(input: SiteCostInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'costs.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="costs.title" /> }}
        title={<FormattedMessage id="costs.new" />}
      />
      <CostForm
        start={{ site: params.get(FILTER.site) ?? '', date: today() }}
        onSubmit={save}
        cancelTo={paths.list}
      />
    </div>
  )
}
