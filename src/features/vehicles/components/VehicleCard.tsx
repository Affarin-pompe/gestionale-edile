import { useIntl } from 'react-intl'
import type { Vehicle } from '../api'
import { VehicleActiveBadge } from './VehicleBadges'
import { VehicleLink } from './VehicleLink'

/** A vehicle in the list on a phone, where a table does not fit. The whole card opens it. */
export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const intl = useIntl()
  return (
    <article className="relative flex flex-col gap-1 px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2 className="flex flex-wrap items-center gap-2.5">
        {/* The link's area covers the card, so the whole card can be tapped */}
        <VehicleLink vehicle={vehicle} className="outline-none after:absolute after:inset-0" />
        {!vehicle.active && <VehicleActiveBadge active={false} />}
      </h2>
      <p className="text-sm text-muted-foreground">
        {[intl.formatMessage({ id: `vehicles.kind.${vehicle.kind}` }), vehicle.plate, vehicle.model]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </article>
  )
}
