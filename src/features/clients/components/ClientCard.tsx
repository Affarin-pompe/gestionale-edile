import { FormattedMessage } from 'react-intl'
import type { Client } from '../api'
import { ClientLink } from './ClientLink'

/** A client in the list on a phone, where a table does not fit. The whole card opens it. */
export function ClientCard({ client }: { client: Client }) {
  const taxId = client.vat_number ?? client.tax_code
  return (
    <article className="relative rounded-lg border p-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <h2>
        {/* The link's area covers the card, so the whole card can be tapped */}
        <ClientLink client={client} className="outline-none after:absolute after:inset-0" />
      </h2>
      <p className="text-sm text-muted-foreground">
        <FormattedMessage id={`clients.kind.${client.kind}`} />
        {taxId && ` · ${taxId}`}
        {client.city && ` · ${client.city}`}
      </p>
    </article>
  )
}
