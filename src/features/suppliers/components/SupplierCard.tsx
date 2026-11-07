import { useIntl } from 'react-intl'
import type { Supplier } from '../api'
import { SupplierBadges } from './SupplierBadges'
import { SupplierLink } from './SupplierLink'

/** A supplier in the list on a phone, where a table does not fit. The whole card opens it. */
export function SupplierCard({ supplier }: { supplier: Supplier }) {
  const intl = useIntl()
  const categories = supplier.categories
    .map((category) => intl.formatMessage({ id: `suppliers.category.${category}` }))
    .join(', ')
  return (
    <article className="relative flex flex-col gap-1 px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2>
        {/* The link's area covers the card, so the whole card can be tapped */}
        <SupplierLink supplier={supplier} className="outline-none after:absolute after:inset-0" />
      </h2>
      <p className="text-sm text-muted-foreground">
        {[categories, supplier.city].filter(Boolean).join(' · ')}
      </p>
      <SupplierBadges
        subcontractor={supplier.subcontractor}
        archived={supplier.archived_at !== null}
      />
    </article>
  )
}
