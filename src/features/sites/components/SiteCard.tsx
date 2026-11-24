import { FormattedMessage } from 'react-intl'
import type { Site } from '../api'
import { SiteLink } from './SiteLink'

/** A site in the list on a phone, where a table does not fit. The whole card opens it. */
export function SiteCard({ site }: { site: Site }) {
  return (
    <article className="relative px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2>
        {/* The link's area covers the card, so the whole card can be tapped */}
        <SiteLink site={site} className="outline-none after:absolute after:inset-0" />
      </h2>
      <p className="text-sm text-muted-foreground">
        {site.code && `${site.code} · `}
        <FormattedMessage id={`sites.status.${site.status}`} />
        {site.client && ` · ${site.client.name}`}
      </p>
      {site.address && <p className="text-sm text-muted-foreground">{site.address}</p>}
    </article>
  )
}
