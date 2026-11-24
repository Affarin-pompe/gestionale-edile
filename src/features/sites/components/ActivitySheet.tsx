import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { TextField } from '@/components/common/EntityForm'
import { SheetForm } from '@/components/common/SheetForm'
import { today } from '@/lib/days'
import { useSaveSiteActivity, type SiteActivity, type SiteActivityInput } from '../api'
import { activityFormValues, activitySchema, type ActivityFormValues } from '../schemas'
import { DependsOnField } from './DependsOnField'

const Text = TextField<ActivityFormValues>

/** A new activity, or the changes of `activity`, in a side panel. */
export function ActivitySheet({
  siteId,
  activity,
  etag,
  activities,
  onClose,
}: {
  siteId: string
  activity?: SiteActivity
  etag?: string
  /** All the site's activities, to choose the dependencies from. */
  activities: SiteActivity[]
  onClose: () => void
}) {
  const intl = useIntl()
  const company = useCompany()
  const save = useSaveSiteActivity(company.slug, siteId)
  const form = useForm<ActivityFormValues, unknown, SiteActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: activityFormValues(activity, today()),
  })
  // An activity cannot depend on itself; cycles through others only the backend sees
  const options = activities
    .filter((other) => other.id !== activity?.id)
    .map((other) => ({ value: other.id, text: other.name }))

  async function submit(input: SiteActivityInput) {
    await save.mutateAsync({ activity, etag, input })
    toast.success(
      intl.formatMessage({
        id: activity ? 'sites.schedule.updated' : 'sites.schedule.created',
      }),
    )
  }

  return (
    <SheetForm
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={activity ? 'sites.schedule.editTitle' : 'sites.schedule.newTitle'}
      description={activity?.name}
      form={form}
      onSubmit={submit}
    >
      <Text name="name" label="sites.schedule.name" maxLength={200} required />
      <Text name="start_on" label="sites.schedule.startOn" type="date" deps={['end_on']} required />
      <Text name="end_on" label="sites.schedule.endOn" type="date" required />
      <Text
        name="progress"
        label="sites.schedule.progress"
        hint="sites.schedule.progress.hint"
        inputMode="numeric"
        maxLength={3}
        required
      />
      <DependsOnField options={options} />
      <Text name="notes" label="sites.notes" multiline maxLength={2000} />
    </SheetForm>
  )
}
