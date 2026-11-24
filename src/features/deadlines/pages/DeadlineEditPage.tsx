import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { deadlineQuery, useUpdateDeadline, type DeadlineInput } from '../api'
import { DeadlineForm } from '../components/DeadlineForm'
import { deadlinePaths, useDeadlineId } from '../paths'

export function DeadlineEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useDeadlineId()
  const paths = deadlinePaths(company.slug)
  // Already loaded by the route's loader
  const { data } = useSuspenseQuery(deadlineQuery(company.slug, id))
  // The version the form was opened on: if someone saves meanwhile, the backend answers 412
  const [etag] = useState(data.etag)
  const update = useUpdateDeadline(company.slug, id)

  async function save(input: DeadlineInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'deadlines.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: data.record.title }}
        title={<FormattedMessage id="deadlines.editTitle" />}
      />
      {data.record.supplier_document_id !== null && (
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id="deadlines.fromDocument.edit" />
        </p>
      )}
      <DeadlineForm deadline={data.record} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
