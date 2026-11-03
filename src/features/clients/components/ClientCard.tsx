import { FormattedMessage } from 'react-intl'
import type { Client } from '../api'

/** A client in the list on a phone, where a table does not fit. */
export function ClientCard({ client }: { client: Client }) {
  const taxId = client.vat_number ?? client.tax_code
  return (
    <article className="rounded-lg border p-3">
      <h2 className="font-medium">{client.name}</h2>
      <p className="text-sm text-muted-foreground">
        <FormattedMessage id={`clients.kind.${client.kind}`} />
        {taxId && ` · ${taxId}`}
        {client.city && ` · ${client.city}`}
      </p>
    </article>
  )
}
