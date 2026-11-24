import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateSite, type SiteInput } from '../api'
import { SiteForm } from '../components/SiteForm'
import { sitePaths } from '../paths'

export function SiteNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = sitePaths(company.slug)
  const create = useCreateSite(company.slug)

  async function save(input: SiteInput) {
    const { record: site } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'sites.created' }))
    await navigate(paths.detail(site.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="sites.title" /> }}
        title={<FormattedMessage id="sites.new" />}
      />
      <SiteForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
