import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { ClientKind } from '../api'

const VARIANTS = {
  company: 'primary-light',
  person: 'info-light',
} as const satisfies Record<ClientKind, BadgeProps['variant']>

/** Company or person, as a coloured label. */
export function ClientKindBadge({ kind }: { kind: ClientKind }) {
  return (
    <Badge variant={VARIANTS[kind]} size="lg">
      <FormattedMessage id={`clients.kind.${kind}`} />
    </Badge>
  )
}
