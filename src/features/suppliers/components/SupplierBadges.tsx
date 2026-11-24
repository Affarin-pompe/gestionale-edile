import { FormattedMessage } from 'react-intl'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import type { SupplierDocumentStatus } from '../api'

/** Subcontractor and archived, the two things that change how a supplier is handled. */
export function SupplierBadges({
  subcontractor,
  archived,
}: {
  subcontractor: boolean
  archived: boolean
}) {
  if (!subcontractor && !archived) return null
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {subcontractor && (
        <Badge variant="primary-light" size="lg">
          <FormattedMessage id="suppliers.subcontractor" />
        </Badge>
      )}
      {archived && (
        <Badge variant="secondary" size="lg">
          <FormattedMessage id="suppliers.archived" />
        </Badge>
      )}
    </span>
  )
}

const STATUS_VARIANTS = {
  valid: 'success-light',
  expiring: 'warning-light',
  expired: 'destructive-light',
  no_expiry: 'secondary',
} as const satisfies Record<SupplierDocumentStatus, BadgeProps['variant']>

/** Valid, expiring, expired or without expiry, as the backend works it out today. */
export function DocumentStatusBadge({ status }: { status: SupplierDocumentStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} size="lg">
      <FormattedMessage id={`suppliers.documents.status.${status}`} />
    </Badge>
  )
}
