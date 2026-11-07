import { useSuspenseQuery } from '@tanstack/react-query'
import { Copy, EllipsisVertical, FileText, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ItalianDate } from '@/components/common/ItalianDate'
import { PageHeader } from '@/components/common/PageHeader'
import { useActionError } from '@/components/common/use-action-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clientPaths } from '@/features/clients/paths'
import type { MessageId } from '@/i18n/it'
import { formatEuro } from '@/lib/decimal'
import { estimateQuery, useDeleteEstimate, useDuplicateEstimate, type Estimate } from '../api'
import { EstimateStatusBadge } from '../components/EstimateStatusBadge'
import { EstimateTree } from '../components/EstimateTree'
import { QuoteFromEstimateSheet } from '../components/QuoteFromEstimateSheet'
import { estimatePaths, useEstimateId } from '../paths'

export function EstimateDetailPage() {
  const company = useCompany()
  const id = useEstimateId()
  const paths = estimatePaths(company.slug)
  // Already loaded by the route's loader
  const { data: estimate } = useSuspenseQuery(estimateQuery(company.slug, id)).data
  const canUpdate = useCan('estimates.update')

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="estimates.title" /> }}
        title={estimate.title}
        actions={<EstimateActions estimate={estimate} />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <EstimateData estimate={estimate} />
        <Section title="estimates.total">
          <p className="text-xl font-semibold tabular-nums">{formatEuro(estimate.total)}</p>
        </Section>
      </div>
      <EstimateTree estimateId={estimate.id} editable={canUpdate} />
      {estimate.notes && (
        <Section title="estimates.notes">
          <p className="break-words whitespace-pre-line">{estimate.notes}</p>
        </Section>
      )}
    </div>
  )
}

function EstimateActions({ estimate }: { estimate: Estimate }) {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = estimatePaths(company.slug)
  const canUpdate = useCan('estimates.update')
  const canCreate = useCan('estimates.create')
  const canDelete = useCan('estimates.delete')
  const canQuote = useCan('quotes.create')
  const duplicate = useDuplicateEstimate(company.slug, estimate.id)
  const remove = useDeleteEstimate(company.slug, estimate.id)
  const describeError = useActionError()
  const [open, setOpen] = useState<'quote' | 'delete'>()

  function makeCopy() {
    duplicate.mutate(undefined, {
      onSuccess: ({ data }) => {
        toast.success(intl.formatMessage({ id: 'estimates.duplicated' }))
        void navigate(paths.detail(data.id))
      },
      onError: (error) => toast.error(describeError(error)),
    })
  }

  return (
    <>
      {canQuote && (
        <Button variant="outline" onClick={() => setOpen('quote')}>
          <FileText aria-hidden="true" />
          <FormattedMessage id="estimates.toQuote" />
        </Button>
      )}
      {canUpdate && (
        <Button asChild variant="outline">
          <Link to={paths.edit(estimate.id)}>
            <Pencil aria-hidden="true" />
            <FormattedMessage id="estimates.edit" />
          </Link>
        </Button>
      )}
      {(canCreate || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={duplicate.isPending}>
              <EllipsisVertical aria-hidden="true" />
              <FormattedMessage id="estimates.more" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canCreate && (
              <DropdownMenuItem onSelect={makeCopy}>
                <Copy aria-hidden="true" />
                <FormattedMessage id="estimates.duplicate" />
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onSelect={() => setOpen('delete')}>
                <FormattedMessage id="estimates.delete" />
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {open === 'quote' && (
        <QuoteFromEstimateSheet estimate={estimate} onClose={() => setOpen(undefined)} />
      )}
      <ConfirmDialog
        open={open === 'delete'}
        onOpenChange={(next) => !next && setOpen(undefined)}
        title="estimates.deleteTitle"
        text={<FormattedMessage id="estimates.deleteText" values={{ title: estimate.title }} />}
        confirm="estimates.delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync()
          toast.success(intl.formatMessage({ id: 'estimates.deleted' }))
          await navigate(paths.list)
        }}
      />
    </>
  )
}

function EstimateData({ estimate }: { estimate: Estimate }) {
  const company = useCompany()
  const canSeeClients = useCan('clients.view')
  return (
    <Section title="estimates.section.main">
      <dl className="flex flex-col gap-4">
        <Detail label="estimates.status">
          <EstimateStatusBadge status={estimate.status} />
        </Detail>
        <Detail label="estimates.client">
          {estimate.client &&
            (canSeeClients ? (
              <Link
                to={clientPaths(company.slug).detail(estimate.client.id)}
                className="underline-offset-4 hover:underline"
              >
                {estimate.client.name}
              </Link>
            ) : (
              estimate.client.name
            ))}
        </Detail>
        <Detail label="estimates.site">
          {estimate.site && [estimate.site.code, estimate.site.name].filter(Boolean).join(' · ')}
        </Detail>
        <Detail label="estimates.siteAddress">{estimate.site_address}</Detail>
        <Detail label="estimates.updatedAt">
          <ItalianDate value={estimate.updated_at} />
        </Detail>
      </dl>
    </Section>
  )
}

function Section({ title, children }: { title: MessageId; children: ReactNode }) {
  return (
    <Card asChild>
      <section>
        <CardHeader>
          <h2 className="font-heading text-base leading-none font-semibold">
            <FormattedMessage id={title} />
          </h2>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </section>
    </Card>
  )
}

function Detail({ label, children }: { label: MessageId; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-2.5">
      <dt className="text-muted-foreground">
        <FormattedMessage id={label} />
      </dt>
      <dd className="break-words">
        {children || (
          <span className="text-muted-foreground">
            <FormattedMessage id="detail.empty" />
          </span>
        )}
      </dd>
    </div>
  )
}
