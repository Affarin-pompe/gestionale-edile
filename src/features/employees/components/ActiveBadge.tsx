import { FormattedMessage } from 'react-intl'
import { Badge } from '@/components/reui/badge'

/** Still working in the company, or left. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success-light' : 'secondary'} size="lg">
      <FormattedMessage id={active ? 'employees.active' : 'employees.inactive'} />
    </Badge>
  )
}
