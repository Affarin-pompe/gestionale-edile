import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { useCompany } from '@/auth/me'
import { supplierDocumentsQuery } from '../api'
import { useDocumentId, useSupplierId } from '../paths'

/** The kind of the document in the breadcrumbs, or its description for "other". */
export function DocumentCrumb() {
  const company = useCompany()
  const supplierId = useSupplierId()
  const id = useDocumentId()
  const { data } = useQuery({ ...supplierDocumentsQuery(company.slug, supplierId), enabled: false })
  const document = data?.find((d) => d.id === id)
  if (!document) return <FormattedMessage id="crumb.notFound" />
  if (document.kind === 'other' && document.description) return document.description
  return <FormattedMessage id={`suppliers.documents.kind.${document.kind}`} />
}
