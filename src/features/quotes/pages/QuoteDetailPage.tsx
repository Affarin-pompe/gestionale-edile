import { useSuspenseQuery } from '@tanstack/react-query'
import { EllipsisVertical, FileDown, Pencil, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCan } from '@/auth/permissions'
import { useCompany } from '@/auth/me'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clientPaths } from '@/features/clients/paths'
import type { MessageId } from '@/i18n/it'
import { formatEuro } from '@/lib/decimal'
import {
  quotePdfUrl,
  quoteQuery,
  useChangeQuoteStatus,
  useDeleteQuote,
  useReviseQuote,
  type Quote,
  type QuoteOutcome,
} from '../api'
import { QuoteLines } from '../components/QuoteLines'
import { QuoteName } from '../components/QuoteName'
import { QuoteStatusBadge } from '../components/QuoteStatusBadge'
import { quotePaths, useQuoteId } from '../paths'

/** The outcomes the contract allows from each status (changeQuoteStatus). */
const OUTCOMES: Record<Quote['status'], QuoteOutcome[]> = {
  draft: [],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['sent'],
  rejected: ['sent'],
  expired: ['sent'],
}
/** A sent, rejected or expired quote can be revised; a draft or an accepted one cannot. */
const REVISABLE: Quote['status'][] = ['sent', 'rejected', 'expired']

export function QuoteDetailPage() {
  const company = useCompany()
  const id = useQuoteId()
  const paths = quotePaths(company.slug)
  // Already loaded by the route's loader
  const { data: quote } = useSuspenseQuery(quoteQuery(company.slug, id)).data
  const canUpdate = useCan('quotes.update')
  const draft = quote.status === 'draft'

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="quotes.title" /> }}
        title={quote.subject}
        actions={<QuoteActions quote={quote} />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <QuoteData quote={quote} />
        <QuoteTotals quote={quote} />
      </div>
      <QuoteLines quoteId={quote.id} editable={draft && canUpdate} />
      {(quote.terms || quote.notes) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {quote.terms && <TextBlock title="quotes.terms">{quote.terms}</TextBlock>}
          {quote.notes && <TextBlock title="quotes.notes">{quote.notes}</TextBlock>}
        </div>
      )}
    </div>
  )
}

function QuoteActions({ quote }: { quote: Quote }) {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = quotePaths(company.slug)
  const canUpdate = useCan('quotes.update')
  const canCreate = useCan('quotes.create')
  const canDelete = useCan('quotes.delete')
  const status = useChangeQuoteStatus(company.slug, quote.id)
  const revise = useReviseQuote(company.slug, quote.id)
  const remove = useDeleteQuote(company.slug, quote.id)
  const describeError = useActionError()
  const [confirming, setConfirming] = useState<'send' | 'delete'>()

  const draft = quote.status === 'draft'
  const outcomes = canUpdate ? OUTCOMES[quote.status] : []
  const revisable = canCreate && REVISABLE.includes(quote.status)
  const busy = status.isPending || revise.isPending

  function changeStatus(target: QuoteOutcome) {
    status.mutate(target, {
      onSuccess: () => toast.success(intl.formatMessage({ id: 'quotes.statusChanged' })),
      onError: (error) => toast.error(describeError(error)),
    })
  }

  function makeRevision() {
    revise.mutate(undefined, {
      onSuccess: ({ data }) => {
        toast.success(intl.formatMessage({ id: 'quotes.revised' }))
        void navigate(paths.detail(data.id))
      },
      onError: (error) => toast.error(describeError(error)),
    })
  }

  const more = outcomes.length > 0 || revisable || (draft && canDelete)

  return (
    <>
      <Button asChild variant="outline">
        <a href={quotePdfUrl(company.slug, quote.id)} target="_blank" rel="noopener">
          <FileDown aria-hidden="true" />
          <FormattedMessage id="quotes.pdf" />
        </a>
      </Button>
      {draft && canUpdate && (
        <>
          <Button asChild variant="outline">
            <Link to={paths.edit(quote.id)}>
              <Pencil aria-hidden="true" />
              <FormattedMessage id="quotes.edit" />
            </Link>
          </Button>
          <Button disabled={busy} onClick={() => setConfirming('send')}>
            <Send aria-hidden="true" />
            <FormattedMessage id="quotes.send" />
          </Button>
        </>
      )}
      {more && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={busy}>
              <EllipsisVertical aria-hidden="true" />
              <FormattedMessage id="quotes.more" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {outcomes.map((target) => (
              <DropdownMenuItem key={target} onSelect={() => changeStatus(target)}>
                <FormattedMessage id={`quotes.mark.${target}`} />
              </DropdownMenuItem>
            ))}
            {revisable && (
              <DropdownMenuItem onSelect={makeRevision}>
                <FormattedMessage id="quotes.revise" />
              </DropdownMenuItem>
            )}
            {draft && canDelete && (
              <>
                {(outcomes.length > 0 || revisable) && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirming('delete')}>
                  <FormattedMessage id="quotes.delete" />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog
        open={confirming === 'send'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="quotes.sendTitle"
        text={<FormattedMessage id="quotes.sendText" />}
        confirm="quotes.send"
        onConfirm={async () => {
          await status.mutateAsync('send')
          toast.success(intl.formatMessage({ id: 'quotes.sent' }))
        }}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="quotes.deleteTitle"
        text={<FormattedMessage id="quotes.deleteText" values={{ subject: quote.subject }} />}
        confirm="quotes.delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync()
          toast.success(intl.formatMessage({ id: 'quotes.deleted' }))
          await navigate(paths.list)
        }}
      />
    </>
  )
}

function QuoteData({ quote }: { quote: Quote }) {
  const company = useCompany()
  const canSeeClients = useCan('clients.view')
  const paths = quotePaths(company.slug)
  return (
    <Section title="quotes.section.main">
      <dl className="flex flex-col gap-4">
        <Detail label="quotes.status">
          <QuoteStatusBadge status={quote.status} />
        </Detail>
        <Detail label="quotes.number">
          <QuoteName quote={quote} />
        </Detail>
        <Detail label="quotes.client">
          {canSeeClients ? (
            <Link
              to={clientPaths(company.slug).detail(quote.client.id)}
              className="underline-offset-4 hover:underline"
            >
              {quote.client.name}
            </Link>
          ) : (
            quote.client.name
          )}
        </Detail>
        <Detail label="quotes.issueDate">
          {quote.issue_date && <ItalianDate value={quote.issue_date} />}
        </Detail>
        <Detail label="quotes.validUntil">
          {quote.valid_until ? (
            <ItalianDate value={quote.valid_until} />
          ) : (
            <FormattedMessage
              id="quotes.validityDays.value"
              values={{ days: quote.validity_days }}
            />
          )}
        </Detail>
        {quote.revision_of && (
          <Detail label="quotes.revisionOf">
            <Link
              to={paths.detail(quote.revision_of.id)}
              className="underline-offset-4 hover:underline"
            >
              <QuoteName quote={quote.revision_of} />
            </Link>
          </Detail>
        )}
      </dl>
    </Section>
  )
}

/** The totals by VAT rate, as the backend computed them. */
function QuoteTotals({ quote }: { quote: Quote }) {
  const { totals } = quote
  return (
    <Section title="quotes.totals">
      <dl className="flex flex-col gap-2.5 tabular-nums">
        <TotalRow label={<FormattedMessage id="quotes.taxable" />} value={totals.taxable} />
        {totals.vat.map((rate) => (
          <TotalRow
            key={rate.rate}
            label={
              <FormattedMessage
                id="quotes.vatOn"
                values={{ rate: rate.rate, taxable: formatEuro(rate.taxable) }}
              />
            }
            value={rate.vat}
          />
        ))}
        <TotalRow label={<FormattedMessage id="quotes.vatTotal" />} value={totals.vat_total} />
        <div className="flex items-baseline justify-between gap-2.5 border-t pt-2.5 text-base font-semibold">
          <dt>
            <FormattedMessage id="quotes.total" />
          </dt>
          <dd className="whitespace-nowrap">{formatEuro(totals.total)}</dd>
        </div>
      </dl>
    </Section>
  )
}

function TotalRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-nowrap">{formatEuro(value)}</dd>
    </div>
  )
}

function TextBlock({ title, children }: { title: MessageId; children: string }) {
  return (
    <Section title={title}>
      <p className="break-words whitespace-pre-line">{children}</p>
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
