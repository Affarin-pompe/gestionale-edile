import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { supplierQuery, useUpdateSupplier, type SupplierInput } from '../api'
import { SupplierForm } from '../components/SupplierForm'
import { supplierPaths, useSupplierId } from '../paths'

export function SupplierEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useSupplierId()
  const paths = supplierPaths(company.slug)
  // Already loaded by the route's loader. The form keeps the version it was opened on:
  // if someone saves in the meantime, the backend answers 412 and nothing is overwritten.
  const { data } = useSuspenseQuery(supplierQuery(company.slug, id))
  // A refetch while the user types must not move the version under the form
  const [etag] = useState(data.etag)
  const update = useUpdateSupplier(company.slug, id)

  async function save(input: SupplierInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'suppliers.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: data.record.name }}
        title={<FormattedMessage id="suppliers.editTitle" />}
      />
      <SupplierForm supplier={data.record} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
