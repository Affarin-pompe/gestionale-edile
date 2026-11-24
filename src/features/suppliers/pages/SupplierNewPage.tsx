import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateSupplier, type SupplierInput } from '../api'
import { SupplierForm } from '../components/SupplierForm'
import { supplierPaths } from '../paths'

export function SupplierNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = supplierPaths(company.slug)
  const create = useCreateSupplier(company.slug)

  async function save(input: SupplierInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'suppliers.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="suppliers.title" /> }}
        title={<FormattedMessage id="suppliers.new" />}
      />
      <SupplierForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
