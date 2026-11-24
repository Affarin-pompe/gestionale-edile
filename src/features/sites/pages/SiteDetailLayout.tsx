import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { forgetSite, siteQuery, useDeleteSite } from '../api'
import { SiteStatusBadge } from '../components/SiteStatusBadge'
import { SiteTabs } from '../components/SiteTabs'
import { sitePaths, useSiteId } from '../paths'

/** The frame of a site's tabs: its name, status and actions, the tabs, then the tab's page. */
export function SiteDetailLayout() {
  const intl = useIntl()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCompany()
  const id = useSiteId()
  const paths = sitePaths(company.slug)
  // Already loaded by the route's loader
  const {
    data: { record: site, etag },
  } = useSuspenseQuery(siteQuery(company.slug, id))
  const remove = useDeleteSite(company.slug, id)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="sites.title" /> }}
        title={site.name}
        actions={
          <>
            <PermissionGate permission="sites.update">
              <Button asChild variant="outline">
                <Link to={paths.edit(id)}>
                  <Pencil aria-hidden="true" />
                  <FormattedMessage id="sites.edit" />
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate permission="sites.delete">
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" />
                <FormattedMessage id="sites.delete" />
              </Button>
            </PermissionGate>
          </>
        }
      />
      <p className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
        <SiteStatusBadge status={site.status} />
        {site.code && <span>{site.code}</span>}
        {site.client && <span>{site.client.name}</span>}
      </p>
      <SiteTabs siteId={id} />
      <Outlet />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="sites.deleteTitle"
        text={<FormattedMessage id="sites.deleteText" values={{ name: site.name }} />}
        confirm="sites.delete"
        destructive
        onConfirm={async () => {
          // A 409 (reports, costs, documents linked) shows the backend's message in the dialog
          await remove.mutateAsync(etag)
          toast.success(intl.formatMessage({ id: 'sites.deleted' }))
          await navigate(paths.list)
          forgetSite(queryClient, company.slug, id)
        }}
      />
    </div>
  )
}
