import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { ItalianDate } from '@/components/common/ItalianDate'
import { clientPaths } from '@/features/clients/paths'
import { formatEuro } from '@/lib/money'
import { siteQuery } from '../api'
import { SiteStatusBadge } from '../components/SiteStatusBadge'
import { useSiteId } from '../paths'

export function SiteOverviewPage() {
  const company = useCompany()
  const id = useSiteId()
  const canSeeClients = useCan('clients.view')
  const { record: site } = useSuspenseQuery(siteQuery(company.slug, id)).data

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <DetailSection title="sites.section.main">
        <Detail label="sites.status">
          <SiteStatusBadge status={site.status} />
        </Detail>
        <Detail label="sites.code">{site.code}</Detail>
        <Detail label="sites.client">
          {site.client &&
            (canSeeClients ? (
              <Link
                to={clientPaths(company.slug).detail(site.client.id)}
                className="underline-offset-4 hover:underline"
              >
                {site.client.name}
              </Link>
            ) : (
              site.client.name
            ))}
        </Detail>
        <Detail label="sites.address">{site.address}</Detail>
      </DetailSection>
      <DetailSection title="sites.section.planning">
        <Detail label="sites.startOn">
          {site.start_on && <ItalianDate value={site.start_on} />}
        </Detail>
        <Detail label="sites.endOn">{site.end_on && <ItalianDate value={site.end_on} />}</Detail>
        <Detail label="sites.budget">
          {site.budget && <span className="tabular-nums">{formatEuro(site.budget)}</span>}
        </Detail>
        <Detail label="sites.updatedAt">
          <ItalianDate value={site.updated_at} />
        </Detail>
      </DetailSection>
      <div className="lg:col-span-2">
        <NotesSection title="sites.notes" notes={site.notes} />
      </div>
    </div>
  )
}
