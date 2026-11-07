import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import {
  ChoiceField,
  EntityForm,
  FormSection,
  SelectField,
  TextField,
} from '@/components/common/EntityForm'
import { clientOptionsQuery, SITE_STATUSES, type Site, type SiteInput } from '../api'
import { siteFormValues, siteSchema, type SiteFormValues } from '../schemas'

const Text = TextField<SiteFormValues>
const Select = SelectField<SiteFormValues>
const Choice = ChoiceField<SiteFormValues>

const STATUS_OPTIONS = SITE_STATUSES.map((value) => ({
  value,
  label: `sites.status.${value}` as const,
}))

/** A new site when `site` is missing, otherwise its changes. */
export function SiteForm({
  site,
  onSubmit,
  onReload,
  cancelTo,
}: {
  site?: Site
  onSubmit: (input: SiteInput) => Promise<void>
  /** Loads the site again after someone else changed it (see EntityForm). */
  onReload?: () => Promise<void>
  cancelTo: string
}) {
  const form = useForm<SiteFormValues, unknown, SiteInput>({
    resolver: zodResolver(siteSchema),
    defaultValues: siteFormValues(site),
  })

  return (
    <EntityForm form={form} onSubmit={onSubmit} onReload={onReload} cancelTo={cancelTo}>
      <FormSection legend="sites.section.main">
        <Text name="name" label="sites.name" maxLength={200} required />
        <Text name="code" label="sites.code" hint="sites.code.hint" maxLength={50} />
        <ClientChoice current={site?.client ?? undefined} />
        <Select name="status" label="sites.status" options={STATUS_OPTIONS} required />
        <Text name="address" label="sites.address" maxLength={300} />
      </FormSection>
      <FormSection legend="sites.section.planning">
        <Text name="start_on" label="sites.startOn" type="date" deps={['end_on']} />
        <Text name="end_on" label="sites.endOn" type="date" />
        <Text
          name="budget"
          label="sites.budget"
          hint="sites.budget.hint"
          inputMode="decimal"
          maxLength={17}
        />
      </FormSection>
      <FormSection legend="sites.notes">
        <Text name="notes" label="sites.notes" multiline maxLength={2000} />
      </FormSection>
    </EntityForm>
  )
}

/** The clients by name; the site's own client stays in the list even if it is not loaded. */
function ClientChoice({ current }: { current?: { id: string; name: string } }) {
  const company = useCompany()
  const canSeeClients = useCan('clients.view')
  const clients =
    useQuery({ ...clientOptionsQuery(company.slug), enabled: canSeeClients }).data ?? []
  const options = clients.map((client) => ({ value: client.id, text: client.name }))
  if (current && !options.some((option) => option.value === current.id)) {
    options.unshift({ value: current.id, text: current.name })
  }
  return (
    <Choice name="client_id" label="sites.client" empty="sites.client.none" options={options} />
  )
}
