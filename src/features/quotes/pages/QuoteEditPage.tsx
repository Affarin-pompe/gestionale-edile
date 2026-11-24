import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { quoteQuery, useUpdateQuote, type QuoteInput } from '../api'
import { QuoteForm } from '../components/QuoteForm'
import { quotePaths, useQuoteId } from '../paths'

export function QuoteEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useQuoteId()
  const paths = quotePaths(company.slug)
  // Already loaded by the route's loader
  const { data: quote } = useSuspenseQuery(quoteQuery(company.slug, id)).data
  const update = useUpdateQuote(company.slug, id)

  async function save(input: QuoteInput) {
    await update.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'quotes.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: quote.subject }}
        title={<FormattedMessage id="quotes.editTitle" />}
      />
      {quote.status === 'draft' ? (
        <QuoteForm quote={quote} onSubmit={save} cancelTo={paths.detail(id)} />
      ) : (
        // Only a draft can change (the backend answers 409 otherwise)
        <p className="text-muted-foreground">
          <FormattedMessage id="quotes.notDraft" />
        </p>
      )}
    </div>
  )
}
