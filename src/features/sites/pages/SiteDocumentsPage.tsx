import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ItalianDate } from '@/components/common/ItalianDate'
import { useActionError } from '@/components/common/use-action-error'
import { Button } from '@/components/ui/button'
import {
  DOCUMENT_TYPES,
  DOCUMENTS_PER_PAGE,
  DocumentChanged,
  documentContentUrl,
  documentType,
  MAX_DOCUMENT_SIZE,
  PHOTO_TYPES,
  siteDocumentsQuery,
  useDeleteSiteDocument,
  useUploadSiteDocument,
  type SiteDocument,
  type SiteDocumentKind,
} from '../api'
import { QueryBody, TabSection } from '../components/TabSection'
import { useSiteId } from '../paths'

export function SiteDocumentsPage() {
  return <SiteFiles kind="document" />
}

export function SitePhotosPage() {
  return <SiteFiles kind="photo" />
}

/** The documents of the site in a list, or its photos in a grid; both can be uploaded. */
function SiteFiles({ kind }: { kind: SiteDocumentKind }) {
  const intl = useIntl()
  const company = useCompany()
  const siteId = useSiteId()
  const [page, setPage] = useState(1)
  const query = useQuery(siteDocumentsQuery(company.slug, siteId, kind, page))
  const remove = useDeleteSiteDocument(company.slug, siteId)
  const [deleting, setDeleting] = useState<SiteDocument>()
  const photos = kind === 'photo'
  const total = query.data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / DOCUMENTS_PER_PAGE))

  return (
    <TabSection
      title={photos ? 'sites.photos.title' : 'sites.documents.title'}
      description={
        query.data && (
          <FormattedMessage
            id={photos ? 'sites.photos.count' : 'sites.documents.count'}
            values={{ count: total }}
          />
        )
      }
      actions={<UploadButton siteId={siteId} photos={photos} />}
    >
      <QueryBody
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty={photos ? 'sites.photos.empty' : 'sites.documents.empty'}
      >
        {({ data }) =>
          photos ? (
            <PhotoGrid photos={data} siteId={siteId} onDelete={setDeleting} />
          ) : (
            <DocumentList documents={data} siteId={siteId} onDelete={setDeleting} />
          )
        }
      </QueryBody>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2.5 border-t px-5 py-3">
          <span className="text-sm text-muted-foreground">
            <FormattedMessage id="sites.documents.page" values={{ page, pages }} />
          </span>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <FormattedMessage id="list.previous" />
          </Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <FormattedMessage id="list.next" />
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={photos ? 'sites.photos.deleteTitle' : 'sites.documents.deleteTitle'}
        text={
          <FormattedMessage
            id="sites.documents.deleteText"
            values={{ title: deleting?.title ?? '' }}
          />
        }
        confirm="sites.documents.delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting)
          } catch (error) {
            if (error instanceof DocumentChanged) {
              throw new ApiError(412, {
                message: intl.formatMessage({ id: 'sites.documents.changed' }),
              })
            }
            throw error
          }
          toast.success(intl.formatMessage({ id: 'sites.documents.deleted' }))
          // The page may now be empty
          if (query.data?.data.length === 1 && page > 1) setPage(page - 1)
        }}
      />
    </TabSection>
  )
}

function DocumentList({
  documents,
  siteId,
  onDelete,
}: {
  documents: SiteDocument[]
  siteId: string
  onDelete: (document: SiteDocument) => void
}) {
  const intl = useIntl()
  const company = useCompany()
  const canDelete = useCan('documents.delete')
  return (
    <ul className="divide-y">
      {documents.map((document) => (
        <li key={document.id} className="flex items-center gap-2.5 px-5 py-3">
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{document.title}</p>
            <FileFacts document={document} />
            {document.notes && (
              <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
                {document.notes}
              </p>
            )}
          </div>
          <Button asChild variant="ghost" size="icon-sm">
            <a
              href={documentContentUrl(company.slug, siteId, document.id)}
              download={document.file_name}
              aria-label={intl.formatMessage(
                { id: 'sites.documents.download' },
                { title: document.title },
              )}
            >
              <Download aria-hidden="true" />
            </a>
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={intl.formatMessage(
                { id: 'sites.documents.deleteOne' },
                { title: document.title },
              )}
              onClick={() => onDelete(document)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function PhotoGrid({
  photos,
  siteId,
  onDelete,
}: {
  photos: SiteDocument[]
  siteId: string
  onDelete: (photo: SiteDocument) => void
}) {
  const intl = useIntl()
  const company = useCompany()
  const canDelete = useCan('documents.delete')
  return (
    <ul className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => {
        const url = documentContentUrl(company.slug, siteId, photo.id)
        return (
          <li key={photo.id} className="flex min-w-0 flex-col gap-2">
            <a
              href={url}
              download={photo.file_name}
              className="block overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={intl.formatMessage(
                { id: 'sites.documents.download' },
                { title: photo.title },
              )}
            >
              <img
                src={url}
                alt={photo.title}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </a>
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="truncate font-medium" title={photo.title}>
                  {photo.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  <ItalianDate value={photo.created_at} />
                </p>
              </div>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={intl.formatMessage(
                    { id: 'sites.documents.deleteOne' },
                    { title: photo.title },
                  )}
                  onClick={() => onDelete(photo)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** File name, size, date and who uploaded it. */
function FileFacts({ document }: { document: SiteDocument }) {
  const megabytes = document.size >= 1024 * 1024
  return (
    <p className="text-sm break-words text-muted-foreground">
      {document.file_name}
      {' · '}
      <FormattedNumber
        value={megabytes ? document.size / (1024 * 1024) : Math.max(1, document.size / 1024)}
        style="unit"
        unit={megabytes ? 'megabyte' : 'kilobyte'}
        maximumFractionDigits={megabytes ? 1 : 0}
      />
      {' · '}
      <ItalianDate value={document.created_at} />
      {document.uploaded_by && ` · ${document.uploaded_by.name}`}
    </p>
  )
}

/**
 * Picks one or more files and uploads them one after the other. Size and type are checked
 * here first, for a clear message; the backend checks again (413, 415, 422).
 */
function UploadButton({ siteId, photos }: { siteId: string; photos: boolean }) {
  const intl = useIntl()
  const company = useCompany()
  const canCreate = useCan('documents.create')
  const upload = useUploadSiteDocument(company.slug, siteId)
  const describeError = useActionError()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (!canCreate) return null

  const accepted = photos ? PHOTO_TYPES : [...new Set(Object.values(DOCUMENT_TYPES))]

  function problem(file: File) {
    if (file.size > MAX_DOCUMENT_SIZE) return 'sites.documents.tooBig' as const
    if (!accepted.includes(documentType(file))) {
      return photos ? ('sites.photos.wrongType' as const) : ('sites.documents.wrongType' as const)
    }
    return undefined
  }

  function uploadError(error: unknown) {
    if (error instanceof ApiError && error.status === 413) {
      return intl.formatMessage({ id: 'sites.documents.tooBig' })
    }
    if (error instanceof ApiError && error.status === 415) {
      return intl.formatMessage({ id: 'sites.documents.wrongType' })
    }
    return describeError(error)
  }

  async function send(files: File[]) {
    setBusy(true)
    let uploaded = 0
    for (const file of files) {
      const wrong = problem(file)
      if (wrong) {
        toast.error(`${file.name}: ${intl.formatMessage({ id: wrong })}`)
        continue
      }
      try {
        await upload.mutateAsync(file)
        uploaded += 1
      } catch (error) {
        toast.error(`${file.name}: ${uploadError(error)}`)
      }
    }
    setBusy(false)
    if (uploaded > 0) {
      toast.success(intl.formatMessage({ id: 'sites.documents.uploaded' }, { count: uploaded }))
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={accepted.join(',')}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // The same file can be chosen again after a failure
          event.target.value = ''
          if (files.length > 0) void send(files)
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        <FormattedMessage
          id={
            busy
              ? 'sites.documents.uploading'
              : photos
                ? 'sites.photos.upload'
                : 'sites.documents.upload'
          }
        />
      </Button>
    </>
  )
}
