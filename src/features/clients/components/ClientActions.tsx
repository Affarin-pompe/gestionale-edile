import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { listHref } from '@/hooks/use-list-params'
import type { MessageId } from '@/i18n/it'
import {
  forgetClient,
  hasDocuments,
  isStale,
  useArchiveClient,
  useDeleteClient,
  useReloadClient,
  useRestoreClient,
  type VersionedClient,
} from '../api'
import { clientPaths } from '../paths'

/** What a failed archive, restore or delete tells the user. */
function failure(error: unknown): MessageId {
  if (isStale(error)) return 'clients.stale'
  if (error instanceof ApiError && error.status === 403) return 'action.forbidden'
  if (hasDocuments(error)) return 'clients.delete.hasDocuments'
  return 'clients.actionFailed'
}

/**
 * Archive or restore, and delete, on the client's page. Each one is shown only to roles that
 * may do it; every change carries the version the user is looking at.
 */
export function ClientActions({ data }: { data: VersionedClient }) {
  const intl = useIntl()
  const company = useCompany()
  const { client, etag } = data
  const canUpdate = useCan('clients.update')
  const canDelete = useCan('clients.delete')
  const archive = useArchiveClient(company.slug, client.id)
  const restore = useRestoreClient(company.slug, client.id)
  const reload = useReloadClient(company.slug, client.id)
  const [deleting, setDeleting] = useState(false)
  const archived = client.archived_at !== null
  const busy = archive.isPending || restore.isPending

  /** A 412 offers to load the newer version, so the user sees what changed. */
  function report(error: unknown) {
    const id = failure(error)
    toast.error(intl.formatMessage({ id }), {
      action: isStale(error)
        ? { label: intl.formatMessage({ id: 'action.reload' }), onClick: () => void reload() }
        : undefined,
    })
  }

  async function toggleArchived() {
    try {
      if (archived) {
        await restore.mutateAsync(etag)
        toast.success(intl.formatMessage({ id: 'clients.restoredDone' }))
      } else {
        await archive.mutateAsync(etag)
        toast.success(intl.formatMessage({ id: 'clients.archivedDone' }))
      }
    } catch (error) {
      report(error)
    }
  }

  if (!canUpdate && !canDelete) return null
  return (
    <>
      {canUpdate && (
        <Button variant="outline" disabled={busy} onClick={() => void toggleArchived()}>
          {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
          <FormattedMessage id={archived ? 'clients.restore' : 'clients.archive'} />
        </Button>
      )}
      {canDelete && (
        <>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" />
            <FormattedMessage id="clients.delete" />
          </Button>
          <DeleteDialog
            data={data}
            open={deleting}
            onOpenChange={setDeleting}
            onArchive={canUpdate && !archived ? toggleArchived : undefined}
          />
        </>
      )}
    </>
  )
}

/**
 * Asks before deleting. It stays open with the reason when the backend refuses: a client with
 * documents (409) can be archived instead, right from here.
 */
function DeleteDialog({
  data,
  open,
  onOpenChange,
  onArchive,
}: {
  data: VersionedClient
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Offered after a 409, when the role may archive and the client is not archived yet. */
  onArchive?: () => Promise<void>
}) {
  const intl = useIntl()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCompany()
  const { client, etag } = data
  const remove = useDeleteClient(company.slug, client.id)
  const reload = useReloadClient(company.slug, client.id)
  const [problem, setProblem] = useState<unknown>()

  function change(next: boolean) {
    if (remove.isPending) return
    if (!next) setProblem(undefined)
    onOpenChange(next)
  }

  async function confirm() {
    setProblem(undefined)
    try {
      await remove.mutateAsync(etag)
    } catch (error) {
      setProblem(error)
      return
    }
    toast.success(intl.formatMessage({ id: 'clients.deletedDone' }))
    // Away from the page first: the page would load the deleted client again
    await navigate(listHref(clientPaths(company.slug).list))
    forgetClient(queryClient, company.slug, client.id)
  }

  async function archiveInstead() {
    change(false)
    await onArchive?.()
  }

  async function reloadAndClose() {
    change(false)
    await reload().catch(() => undefined)
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <FormattedMessage id="clients.delete.title" values={{ name: client.name }} />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <FormattedMessage id="clients.delete.text" />
          </AlertDialogDescription>
        </AlertDialogHeader>
        {problem !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            <FormattedMessage id={failure(problem)} />
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            <FormattedMessage id="action.cancel" />
          </AlertDialogCancel>
          {hasDocuments(problem) ? (
            onArchive && (
              <Button onClick={() => void archiveInstead()}>
                <FormattedMessage id="clients.archive" />
              </Button>
            )
          ) : isStale(problem) ? (
            <Button onClick={() => void reloadAndClose()}>
              <FormattedMessage id="action.reload" />
            </Button>
          ) : (
            // Not an AlertDialogAction: that would close the dialog before the answer arrives
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void confirm()}
            >
              <FormattedMessage
                id={remove.isPending ? 'clients.delete.deleting' : 'clients.delete.confirm'}
              />
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
