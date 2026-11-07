import { useState, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { MessageId } from '@/i18n/it'
import { useActionError } from './use-action-error'

/**
 * Asks before an action that cannot be undone, such as deleting. It stays open while the
 * action runs and shows its error; it closes when the action succeeds.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  text,
  confirm,
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: MessageId
  /** What will happen, with the record's name where it helps. */
  text: ReactNode
  confirm: MessageId
  destructive?: boolean
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const describe = useActionError()

  async function run() {
    setBusy(true)
    setProblem(undefined)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      setProblem(describe(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setProblem(undefined)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <FormattedMessage id={title} />
          </AlertDialogTitle>
          <AlertDialogDescription className="break-words">{text}</AlertDialogDescription>
        </AlertDialogHeader>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            <FormattedMessage id="form.cancel" />
          </AlertDialogCancel>
          {/* A plain button: the dialog must not close before the action has worked */}
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void run()}
          >
            <FormattedMessage id={confirm} />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
