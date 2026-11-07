import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { Money } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/reui/badge'
import { deadlineQuery } from '../api'
import { DeadlineStatusBadge } from '../components/DeadlineStatusBadge'
import { DoneButton } from '../components/DoneButton'
import { DueDate } from '../components/DueDate'
import { deadlinePaths, useDeadlineId } from '../paths'

export function DeadlineDetailPage() {
  const company = useCompany()
  const id = useDeadlineId()
  const paths = deadlinePaths(company.slug)
  // Already loaded by the route's loader
  const {
    data: { record: deadline },
  } = useSuspenseQuery(deadlineQuery(company.slug, id))
  // A deadline born from a supplier's document follows the document: it changes from there
  const fromDocument = deadline.supplier_document_id !== null

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="deadlines.title" /> }}
        title={deadline.title}
        actions={
          <>
            <DoneButton deadline={deadline} />
            {!fromDocument && (
              <PermissionGate permission="deadlines.update">
                <Button asChild>
                  <Link to={paths.edit(id)}>
                    <Pencil aria-hidden="true" />
                    <FormattedMessage id="deadlines.edit" />
                  </Link>
                </Button>
              </PermissionGate>
            )}
          </>
        }
      />
      <p className="flex flex-wrap gap-1.5">
        <DeadlineStatusBadge deadline={deadline} />
        <Badge variant="secondary" size="lg">
          <FormattedMessage id={`deadlines.kind.${deadline.kind}`} />
        </Badge>
      </p>
      {fromDocument && deadline.supplier && (
        <p className="text-sm text-muted-foreground">
          <FormattedMessage
            id="deadlines.fromDocument"
            values={{
              supplier: (
                <Link
                  to={paths.supplier(deadline.supplier.id)}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {deadline.supplier.name}
                </Link>
              ),
            }}
          />
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="deadlines.section.main">
          <Detail label="deadlines.dueOn">
            <DueDate deadline={deadline} />
          </Detail>
          <Detail label="deadlines.amount">
            {deadline.amount && <Money value={deadline.amount} />}
          </Detail>
          <Detail label="deadlines.recurrence">
            {deadline.recurrence && (
              <FormattedMessage id={`deadlines.recurrence.${deadline.recurrence}`} />
            )}
          </Detail>
          <Detail label="deadlines.subject">
            {deadline.client?.name ?? deadline.supplier?.name}
          </Detail>
          {deadline.next_deadline_id && (
            <Detail label="deadlines.next">
              <Link
                to={paths.detail(deadline.next_deadline_id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                <FormattedMessage id="deadlines.next.open" />
              </Link>
            </Detail>
          )}
        </DetailSection>
        <NotesSection title="deadlines.notes" notes={deadline.notes} />
      </div>
    </div>
  )
}
