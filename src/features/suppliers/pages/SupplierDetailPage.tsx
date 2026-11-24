import { useSuspenseQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Pencil } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { supplierQuery, useArchiveSupplier } from '../api'
import { SupplierBadges } from '../components/SupplierBadges'
import { SupplierDocuments } from '../components/SupplierDocuments'
import { supplierPaths, useSupplierId } from '../paths'

export function SupplierDetailPage() {
  const intl = useIntl()
  const company = useCompany()
  const id = useSupplierId()
  const paths = supplierPaths(company.slug)
  // Already loaded by the route's loader
  const {
    data: { record: supplier, etag },
  } = useSuspenseQuery(supplierQuery(company.slug, id))
  const archive = useArchiveSupplier(company.slug, id)
  const archived = supplier.archived_at !== null
  const place = [supplier.postal_code, supplier.city, supplier.province && `(${supplier.province})`]
    .filter(Boolean)
    .join(' ')
  const categories = supplier.categories
    .map((category) => intl.formatMessage({ id: `suppliers.category.${category}` }))
    .join(', ')

  async function toggleArchive() {
    try {
      await archive.mutateAsync({ archive: !archived, etag })
      toast.success(
        intl.formatMessage({ id: archived ? 'suppliers.restored' : 'suppliers.archivedDone' }),
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
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="suppliers.title" /> }}
        title={supplier.name}
        actions={
          <PermissionGate permission="suppliers.update">
            <Button
              variant="outline"
              disabled={archive.isPending}
              onClick={() => void toggleArchive()}
            >
              {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
              <FormattedMessage id={archived ? 'suppliers.restore' : 'suppliers.archive'} />
            </Button>
            <Button asChild>
              <Link to={paths.edit(id)}>
                <Pencil aria-hidden="true" />
                <FormattedMessage id="suppliers.edit" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <p>
        <SupplierBadges subcontractor={supplier.subcontractor} archived={archived} />
      </p>
      <SupplierDocuments supplierId={id} />
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="suppliers.section.main">
          <Detail label="suppliers.vatNumber">{supplier.vat_number}</Detail>
          <Detail label="suppliers.taxCode">{supplier.tax_code}</Detail>
          <Detail label="suppliers.categories">{categories}</Detail>
        </DetailSection>
        <DetailSection title="suppliers.section.contacts">
          <Detail label="suppliers.email">
            {supplier.email && <a href={`mailto:${supplier.email}`}>{supplier.email}</a>}
          </Detail>
          <Detail label="suppliers.pec">{supplier.pec}</Detail>
          <Detail label="suppliers.phone">
            {supplier.phone && <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>}
          </Detail>
        </DetailSection>
        <DetailSection title="suppliers.section.address">
          <Detail label="suppliers.street">{supplier.street}</Detail>
          <Detail label="suppliers.city">{place}</Detail>
          <Detail label="suppliers.country">{supplier.country}</Detail>
        </DetailSection>
        <NotesSection title="suppliers.notes" notes={supplier.notes} />
      </div>
    </div>
  )
}
