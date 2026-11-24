import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { QuoteStatus } from '../api'

const VARIANTS = {
  draft: 'invert-light',
  sent: 'info-light',
  accepted: 'success-light',
  rejected: 'destructive-light',
  expired: 'warning-light',
} as const satisfies Record<QuoteStatus, BadgeProps['variant']>

/** The quote's status, as a coloured label. */
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant={VARIANTS[status]} size="lg">
      <FormattedMessage id={`quotes.status.${status}`} />
    </Badge>
  )
}
