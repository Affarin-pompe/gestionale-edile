import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import {
  documentEtag,
  supplierDocumentsQuery,
  supplierQuery,
  useUpdateSupplierDocument,
  type SupplierDocumentInput,
} from '../api'
import { SupplierDocumentForm } from '../components/SupplierDocumentForm'
import { supplierPaths, useDocumentId, useSupplierId } from '../paths'

export function SupplierDocumentEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const supplierId = useSupplierId()
  const id = useDocumentId()
  const paths = supplierPaths(company.slug)
  const { data: supplier } = useSuspenseQuery(supplierQuery(company.slug, supplierId))
  // The route's loader has checked that the document is in the list
  const { data: documents } = useSuspenseQuery(supplierDocumentsQuery(company.slug, supplierId))
  const [document] = useState(() => documents.find((d) => d.id === id))
  const update = useUpdateSupplierDocument(company.slug, supplierId, id)
  if (!document) throw new Error(`Document ${id} is not in the list`)
  const etag = documentEtag(document)

  async function save(input: SupplierDocumentInput) {
    // Without a known version the backend would refuse the change: say so plainly
    if (!etag) throw new Error('Unknown document version')
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'suppliers.updated' }))
    await navigate(paths.detail(supplierId))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(supplierId), label: supplier.record.name }}
        title={<FormattedMessage id="suppliers.documents.editTitle" />}
      />
      {!etag && (
        <p role="alert" className="text-sm text-destructive">
          <FormattedMessage id="suppliers.documents.versionUnknown" />
        </p>
      )}
      <SupplierDocumentForm
        document={document}
        onSubmit={save}
        cancelTo={paths.detail(supplierId)}
      />
    </div>
  )
}
