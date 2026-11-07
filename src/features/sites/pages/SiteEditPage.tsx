import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { siteQuery, useUpdateSite, type SiteInput } from '../api'
import { SiteForm } from '../components/SiteForm'
import { sitePaths, useSiteId } from '../paths'

export function SiteEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useSiteId()
  const paths = sitePaths(company.slug)
  // Already loaded by the route's loader, with the version the changes apply to
  const { data, refetch } = useSuspenseQuery(siteQuery(company.slug, id))
  const { record: site, etag } = data
  const update = useUpdateSite(company.slug, id)

  async function save(input: SiteInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'sites.updated' }))
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
        back={{ to: paths.detail(id), label: site.name }}
        title={<FormattedMessage id="sites.editTitle" />}
      />
      <SiteForm
        key={etag}
        site={site}
        onSubmit={save}
        onReload={reload}
        cancelTo={paths.detail(id)}
      />
    </div>
  )
}
