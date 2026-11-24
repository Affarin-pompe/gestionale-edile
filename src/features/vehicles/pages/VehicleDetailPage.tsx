import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { Money } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { vehicleQuery } from '../api'
import { VehicleActiveBadge, VehicleKindBadge } from '../components/VehicleBadges'
import { vehiclePaths, useVehicleId } from '../paths'

export function VehicleDetailPage() {
  const company = useCompany()
  const id = useVehicleId()
  const paths = vehiclePaths(company.slug)
  // Already loaded by the route's loader
  const {
    data: { record: vehicle },
  } = useSuspenseQuery(vehicleQuery(company.slug, id))

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="vehicles.title" /> }}
        title={vehicle.name}
        actions={
          <PermissionGate permission="vehicles.update">
            <Button asChild>
              <Link to={paths.edit(id)}>
                <Pencil aria-hidden="true" />
                <FormattedMessage id="vehicles.edit" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <p className="flex flex-wrap gap-1.5">
        <VehicleKindBadge kind={vehicle.kind} />
        <VehicleActiveBadge active={vehicle.active} />
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="vehicles.section.main">
          <Detail label="vehicles.plate">{vehicle.plate}</Detail>
          <Detail label="vehicles.model">{vehicle.model}</Detail>
          <Detail label="vehicles.hourlyCost">
            {vehicle.hourly_cost && <Money value={vehicle.hourly_cost} />}
          </Detail>
        </DetailSection>
        <NotesSection title="vehicles.notes" notes={vehicle.notes} />
      </div>
    </div>
  )
}
