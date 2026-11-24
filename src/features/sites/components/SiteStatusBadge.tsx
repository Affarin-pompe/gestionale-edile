import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { SiteStatus } from '../api'

const VARIANTS = {
  planned: 'invert-light',
  active: 'success-light',
  suspended: 'warning-light',
  completed: 'info-light',
} as const satisfies Record<SiteStatus, BadgeProps['variant']>

/** The site's status, as a coloured label. */
export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return (
    <Badge variant={VARIANTS[status]} size="lg">
      <FormattedMessage id={`sites.status.${status}`} />
    </Badge>
  )
}
