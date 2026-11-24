import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ItalianDate } from '@/components/common/ItalianDate'
import { Button } from '@/components/ui/button'
import { dayToDate, today } from '@/lib/days'
import { activityEtag, siteActivitiesQuery, useDeleteSiteActivity, type SiteActivity } from '../api'
import { ActivitySheet } from '../components/ActivitySheet'
import { QueryBody, TabSection } from '../components/TabSection'
import { useSiteId } from '../paths'
import { monthStarts, placement, scaleOf, type Scale } from '../schedule'

type Editing = { activity?: SiteActivity; etag?: string }

/** The site's activities on a scale of days, with their dependencies. */
export function SiteSchedulePage() {
  const intl = useIntl()
  const company = useCompany()
  const siteId = useSiteId()
  const canUpdate = useCan('sites.update')
  const query = useQuery(siteActivitiesQuery(company.slug, siteId))
  const remove = useDeleteSiteActivity(company.slug, siteId)
  const [editing, setEditing] = useState<Editing>()
  const [deleting, setDeleting] = useState<{ activity: SiteActivity; etag: string }>()
  const activities = query.data ?? []

  return (
    <TabSection
      title="sites.schedule.title"
      description={
        query.data && (
          <FormattedMessage id="sites.schedule.count" values={{ count: activities.length }} />
        )
      }
      actions={
        canUpdate &&
        query.data && (
          <Button variant="outline" onClick={() => setEditing({})}>
            <Plus aria-hidden="true" />
            <FormattedMessage id="sites.schedule.new" />
          </Button>
        )
      }
    >
      <QueryBody query={query} isEmpty={(data) => data.length === 0} empty="sites.schedule.empty">
        {(data) => (
          <Chart
            activities={data}
            canUpdate={canUpdate}
            onEdit={(activity, etag) => setEditing({ activity, etag })}
            onDelete={(activity, etag) => setDeleting({ activity, etag })}
          />
        )}
      </QueryBody>
      {editing && (
        <ActivitySheet
          siteId={siteId}
          activity={editing.activity}
          etag={editing.etag}
          activities={activities}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="sites.schedule.deleteTitle"
        text={
          <FormattedMessage
            id="sites.schedule.deleteText"
            values={{ name: deleting?.activity.name ?? '' }}
          />
        }
        confirm="sites.schedule.delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          await remove.mutateAsync(deleting)
          toast.success(intl.formatMessage({ id: 'sites.schedule.deleted' }))
        }}
      />
    </TabSection>
  )
}

function Chart({
  activities,
  canUpdate,
  onEdit,
  onDelete,
}: {
  activities: SiteActivity[]
  canUpdate: boolean
  onEdit: (activity: SiteActivity, etag: string) => void
  onDelete: (activity: SiteActivity, etag: string) => void
}) {
  const scale = scaleOf(activities)
  if (!scale) return null
  const byId = new Map(activities.map((activity) => [activity.id, activity]))
  const now = today()
  const showToday = now >= scale.from && now <= scale.to

  return (
    <div className="flex flex-col">
      {/* The months over the bars; on a phone the bars take the whole width */}
      <div className="grid border-b px-5 py-2 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-5">
        <span className="hidden text-sm text-muted-foreground md:block">
          <FormattedMessage id="sites.schedule.name" />
        </span>
        <Months scale={scale} />
      </div>
      <ol className="divide-y">
        {activities.map((activity) => {
          const etag = activityEtag(activity)
          const dependencies = activity.depends_on
            .map((id) => byId.get(id))
            .filter((other): other is SiteActivity => other !== undefined)
          // Finish-to-start: a dependency ending on or after this start is a clash
          const clashes = dependencies.filter((other) => other.end_on >= activity.start_on)
          return (
            <li
              key={activity.id}
              className="grid gap-2 px-5 py-3 md:grid-cols-[18rem_minmax(0,1fr)] md:items-center md:gap-5"
            >
              <div className="flex min-w-0 items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="font-medium break-words">{activity.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <ItalianDate value={activity.start_on} />
                    {' – '}
                    <ItalianDate value={activity.end_on} />
                    {' · '}
                    <FormattedMessage
                      id="sites.schedule.progressValue"
                      values={{ progress: activity.progress }}
                    />
                  </p>
                  {dependencies.length > 0 && (
                    <p className="text-sm break-words text-muted-foreground">
                      <FormattedMessage
                        id="sites.schedule.after"
                        values={{ names: dependencies.map((other) => other.name).join(', ') }}
                      />
                    </p>
                  )}
                  {clashes.length > 0 && (
                    <p className="text-sm break-words text-destructive">
                      <FormattedMessage
                        id="sites.schedule.clash"
                        values={{ names: clashes.map((other) => other.name).join(', ') }}
                      />
                    </p>
                  )}
                </div>
                {canUpdate && (
                  <RowActions activity={activity} etag={etag} onEdit={onEdit} onDelete={onDelete} />
                )}
              </div>
              <Bar scale={scale} activity={activity} today={showToday ? now : undefined} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function RowActions({
  activity,
  etag,
  onEdit,
  onDelete,
}: {
  activity: SiteActivity
  etag: string | undefined
  onEdit: (activity: SiteActivity, etag: string) => void
  onDelete: (activity: SiteActivity, etag: string) => void
}) {
  const intl = useIntl()
  if (!etag) {
    // TODO(contract): the list has no versions; see activityEtag
    return (
      <span className="shrink-0 text-2sm text-muted-foreground">
        <FormattedMessage id="sites.schedule.versionUnknown" />
      </span>
    )
  }
  return (
    <span className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={intl.formatMessage({ id: 'sites.schedule.editOne' }, { name: activity.name })}
        onClick={() => onEdit(activity, etag)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={intl.formatMessage({ id: 'sites.schedule.deleteOne' }, { name: activity.name })}
        onClick={() => onDelete(activity, etag)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </span>
  )
}

function Months({ scale }: { scale: Scale }) {
  return (
    <div className="relative h-5 overflow-hidden" aria-hidden="true">
      {monthStarts(scale).map((day) => (
        <span
          key={day}
          className="absolute top-0 border-l pl-1 text-sm whitespace-nowrap text-muted-foreground"
          style={{ left: placement(scale, day, day).left }}
        >
          <FormattedDate value={dayToDate(day)} timeZone="UTC" month="short" year="2-digit" />
        </span>
      ))}
    </div>
  )
}

/** The activity's days as a bar, filled as far as its progress; a line marks today. */
function Bar({ scale, activity, today }: { scale: Scale; activity: SiteActivity; today?: string }) {
  const { left, width } = placement(scale, activity.start_on, activity.end_on)
  return (
    <div className="relative h-6 rounded-sm bg-muted" aria-hidden="true">
      {today && (
        <span
          className="absolute inset-y-0 w-px bg-destructive"
          style={{ left: placement(scale, today, today).left }}
        />
      )}
      <span
        className="absolute inset-y-1 overflow-hidden rounded-sm bg-primary/25"
        style={{ left, width, minWidth: '0.25rem' }}
      >
        <span className="block h-full bg-primary" style={{ width: `${activity.progress}%` }} />
      </span>
    </div>
  )
}
