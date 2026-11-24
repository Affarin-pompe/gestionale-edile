import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { DailyReportStatus } from '../api'

const VARIANTS = {
  draft: 'invert-light',
  submitted: 'info-light',
  approved: 'success-light',
} as const satisfies Record<DailyReportStatus, BadgeProps['variant']>

/** The report's status, as a coloured label. */
export function ReportStatusBadge({ status }: { status: DailyReportStatus }) {
  return (
    <Badge variant={VARIANTS[status]} size="lg">
      <FormattedMessage id={`dailyReports.status.${status}`} />
    </Badge>
  )
}
