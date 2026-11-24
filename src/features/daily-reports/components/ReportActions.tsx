import { useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Send, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Day } from '@/components/common/Formats'
import { useActionError } from '@/components/common/use-action-error'
import { Button } from '@/components/ui/button'
import type { MessageId } from '@/i18n/it'
import {
  forgetReport,
  useChangeReportStatus,
  useDeleteReport,
  type DailyReport,
  type DailyReportStatus,
} from '../api'
import { reportPaths } from '../paths'

const DONE: Record<DailyReportStatus, MessageId> = {
  submitted: 'dailyReports.submitted',
  approved: 'dailyReports.approved',
  draft: 'dailyReports.backToDraft.done',
}

/**
 * What can be done with the report, as the contract allows: a draft is changed, sent
 * (reports.update) or deleted (reports.delete); a sent one is approved, and a sent or
 * approved one goes back to draft for corrections (reports.approve).
 */
export function ReportActions({ report, etag }: { report: DailyReport; etag: string }) {
  const intl = useIntl()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const canUpdate = useCan('reports.update')
  const canApprove = useCan('reports.approve')
  const canDelete = useCan('reports.delete')
  const status = useChangeReportStatus(company.slug)
  const remove = useDeleteReport(company.slug, report.id)
  const describeError = useActionError()
  const [confirming, setConfirming] = useState<'draft' | 'delete'>()

  function change(target: DailyReportStatus) {
    status.mutate(
      { id: report.id, status: target, etag },
      {
        onSuccess: () => toast.success(intl.formatMessage({ id: DONE[target] })),
        onError: (error) => toast.error(describeError(error)),
      },
    )
  }

  const draft = report.status === 'draft'
  const busy = status.isPending
  const date = <Day value={report.date} />

  return (
    <>
      {draft && canUpdate && (
        <>
          <Button asChild variant="outline">
            <Link to={paths.edit(report.id)}>
              <Pencil aria-hidden="true" />
              <FormattedMessage id="dailyReports.edit" />
            </Link>
          </Button>
          <Button disabled={busy} onClick={() => change('submitted')}>
            <Send aria-hidden="true" />
            <FormattedMessage id="dailyReports.submit" />
          </Button>
        </>
      )}
      {draft && canDelete && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirming('delete')}>
          <Trash2 aria-hidden="true" />
          <FormattedMessage id="dailyReports.delete" />
        </Button>
      )}
      {!draft && canApprove && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirming('draft')}>
          <Undo2 aria-hidden="true" />
          <FormattedMessage id="dailyReports.backToDraft" />
        </Button>
      )}
      {report.status === 'submitted' && canApprove && (
        <Button disabled={busy} onClick={() => change('approved')}>
          <Check aria-hidden="true" />
          <FormattedMessage id="dailyReports.approve" />
        </Button>
      )}
      <ConfirmDialog
        open={confirming === 'draft'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="dailyReports.backToDraft.title"
        text={<FormattedMessage id="dailyReports.backToDraft.text" />}
        confirm="dailyReports.backToDraft"
        onConfirm={async () => {
          await status.mutateAsync({ id: report.id, status: 'draft', etag })
          toast.success(intl.formatMessage({ id: DONE.draft }))
        }}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="dailyReports.delete.title"
        text={
          <FormattedMessage
            id="dailyReports.delete.text"
            values={{ date, site: report.site.name }}
          />
        }
        confirm="dailyReports.delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(etag)
          toast.success(intl.formatMessage({ id: 'dailyReports.deleted' }))
          await navigate(paths.list)
          forgetReport(queryClient, company.slug, report.id)
        }}
      />
    </>
  )
}
