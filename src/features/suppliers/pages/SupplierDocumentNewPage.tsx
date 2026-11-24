import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { supplierQuery, useCreateSupplierDocument, type SupplierDocumentInput } from '../api'
import { SupplierDocumentForm } from '../components/SupplierDocumentForm'
import { supplierPaths, useSupplierId } from '../paths'

export function SupplierDocumentNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useSupplierId()
  const paths = supplierPaths(company.slug)
  const { data } = useSuspenseQuery(supplierQuery(company.slug, id))
  const create = useCreateSupplierDocument(company.slug, id)

  async function save(input: SupplierDocumentInput) {
    await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'suppliers.documents.created' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: data.record.name }}
        title={<FormattedMessage id="suppliers.documents.new" />}
      />
      <SupplierDocumentForm onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
