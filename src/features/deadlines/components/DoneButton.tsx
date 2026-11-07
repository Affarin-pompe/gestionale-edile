import { Check, RotateCcw } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { useSetDeadlineDone, type Deadline } from '../api'

/** Marks the deadline as done, or opens it again. Only for roles that may change deadlines. */
export function DoneButton({
  deadline,
  compact = false,
}: {
  deadline: Deadline
  compact?: boolean
}) {
  return (
    <PermissionGate permission="deadlines.update">
      <Toggle deadline={deadline} compact={compact} />
    </PermissionGate>
  )
}

function Toggle({ deadline, compact }: { deadline: Deadline; compact: boolean }) {
  const intl = useIntl()
  const company = useCompany()
  const setDone = useSetDeadlineDone(company.slug)
  const done = deadline.status === 'done'

  async function toggle() {
    try {
      const saved = await setDone.mutateAsync({ deadline, done: !done })
      toast.success(
        intl.formatMessage({
          id: done
            ? 'deadlines.reopened'
            : saved.record.next_deadline_id
              ? 'deadlines.doneWithNext'
              : 'deadlines.doneDone',
        }),
      )
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      toast.error(
        intl.formatMessage({
          id: status === 412 ? 'form.stale' : status === 403 ? 'form.forbidden' : 'form.failed',
        }),
      )
    }
  }

  return (
    <Button
      variant="outline"
      size={compact ? 'sm' : 'default'}
      disabled={setDone.isPending}
      onClick={() => void toggle()}
    >
      {done ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}
      <FormattedMessage id={done ? 'deadlines.reopen' : 'deadlines.markDone'} />
    </Button>
  )
}
