import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { EstimateStatus } from '../api'

const VARIANTS = {
  draft: 'invert-light',
  final: 'success-light',
} as const satisfies Record<EstimateStatus, BadgeProps['variant']>

/** Draft or final, as a coloured label. */
export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return (
    <Badge variant={VARIANTS[status]} size="lg">
      <FormattedMessage id={`estimates.status.${status}`} />
    </Badge>
  )
}
