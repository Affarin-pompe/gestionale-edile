import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { Day } from '@/components/common/Formats'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  documentEtag,
  supplierDocumentsQuery,
  useDeleteSupplierDocument,
  type SupplierDocument,
} from '../api'
import { supplierPaths } from '../paths'
import { DocumentStatusBadge } from './SupplierBadges'

/** The documents of regularity of a supplier, the first to expire on top. */
export function SupplierDocuments({ supplierId }: { supplierId: string }) {
  const intl = useIntl()
  const company = useCompany()
  const paths = supplierPaths(company.slug)
  const query = useQuery(supplierDocumentsQuery(company.slug, supplierId))
  const remove = useDeleteSupplierDocument(company.slug, supplierId)
  const expired = query.data?.filter((d) => d.status === 'expired').length ?? 0

  async function onDelete(document: SupplierDocument, etag: string) {
    if (!window.confirm(intl.formatMessage({ id: 'suppliers.documents.deleteConfirm' }))) return
    try {
      await remove.mutateAsync({ id: document.id, etag })
      toast.success(intl.formatMessage({ id: 'suppliers.documents.deleted' }))
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      toast.error(
        intl.formatMessage({
          id: status === 412 ? 'form.stale' : status === 403 ? 'form.forbidden' : 'form.failed',
        }),
      )
    }
  }

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
        <p className="text-muted-foreground">
          <FormattedMessage id="list.loadFailed" />
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <FormattedMessage id="list.retry" />
        </Button>
      </div>
    )
  } else if (query.data.length === 0) {
    body = (
      <p className="p-5 text-muted-foreground">
        <FormattedMessage id="suppliers.documents.empty" />
      </p>
    )
  } else {
    body = (
      <ul className="divide-y">
        {query.data.map((document) => {
          const etag = documentEtag(document)
          const name =
            document.kind === 'other' && document.description ? (
              document.description
            ) : (
              <FormattedMessage id={`suppliers.documents.kind.${document.kind}`} />
            )
          return (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2.5 font-medium">
                  {name}
                  <DocumentStatusBadge status={document.status} />
                </p>
                <p
                  className={
                    document.status === 'expired'
                      ? 'text-sm text-destructive'
                      : 'text-sm text-muted-foreground'
                  }
                >
                  {document.expires_on ? (
                    <FormattedMessage
                      id="suppliers.documents.expiresOnValue"
                      values={{ date: <Day value={document.expires_on} /> }}
                    />
                  ) : (
                    <FormattedMessage id="suppliers.documents.noExpiry" />
                  )}
                  {document.issued_on && (
                    <>
                      {' · '}
                      <FormattedMessage
                        id="suppliers.documents.issuedOnValue"
                        values={{ date: <Day value={document.issued_on} /> }}
                      />
                    </>
                  )}
                </p>
                {document.notes && (
                  <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
                    {document.notes}
                  </p>
                )}
              </div>
              <PermissionGate permission="suppliers.update">
                {etag ? (
                  <span className="flex gap-1">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link
                        to={paths.editDocument(supplierId, document.id)}
                        aria-label={intl.formatMessage({ id: 'suppliers.documents.edit' })}
                      >
                        <Pencil aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={intl.formatMessage({ id: 'suppliers.documents.delete' })}
                      disabled={remove.isPending}
                      onClick={() => void onDelete(document, etag)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </span>
                ) : (
                  <span className="text-2sm text-muted-foreground">
                    <FormattedMessage id="suppliers.documents.versionUnknown" />
                  </span>
                )}
              </PermissionGate>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Card asChild>
      <section aria-labelledby="supplier-documents">
        <CardHeader>
          <h2 id="supplier-documents" className="font-heading text-base leading-none font-semibold">
            <FormattedMessage id="suppliers.documents.title" />
          </h2>
          {expired > 0 && (
            <p className="text-sm text-destructive">
              <FormattedMessage id="suppliers.documents.expiredCount" values={{ count: expired }} />
            </p>
          )}
          <PermissionGate permission="suppliers.update">
            <CardAction>
              <Button asChild variant="outline">
                <Link to={paths.newDocument(supplierId)}>
                  <Plus aria-hidden="true" />
                  <FormattedMessage id="suppliers.documents.new" />
                </Link>
              </Button>
            </CardAction>
          </PermissionGate>
        </CardHeader>
        {body}
      </section>
    </Card>
  )
}
