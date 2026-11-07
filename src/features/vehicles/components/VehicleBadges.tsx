import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { VehicleKind } from '../api'

const KIND_VARIANTS = {
  vehicle: 'primary-light',
  machine: 'info-light',
  equipment: 'invert-light',
} as const satisfies Record<VehicleKind, BadgeProps['variant']>

export function VehicleKindBadge({ kind }: { kind: VehicleKind }) {
  return (
    <Badge variant={KIND_VARIANTS[kind]} size="lg">
      <FormattedMessage id={`vehicles.kind.${kind}`} />
    </Badge>
  )
}

/** In use, or sold or retired. */
export function VehicleActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success-light' : 'secondary'} size="lg">
      <FormattedMessage id={active ? 'vehicles.active' : 'vehicles.inactive'} />
    </Badge>
  )
}
