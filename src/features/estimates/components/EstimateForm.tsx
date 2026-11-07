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
import { clientOptionsQuery } from '@/features/quotes/api'
import { siteOptionsQuery, type Estimate, type EstimateInput } from '../api'
import { estimateFormValues, estimateSchema, type EstimateFormValues } from '../schemas'

const Text = TextField<EstimateFormValues>
const Select = SelectField<EstimateFormValues>
const Choice = ChoiceField<EstimateFormValues>

const STATUS_OPTIONS = [
  { value: 'draft', label: 'estimates.status.draft' },
  { value: 'final', label: 'estimates.status.final' },
] as const

/** The header of a new estimate when `estimate` is missing, otherwise its changes. */
export function EstimateForm({
  estimate,
  onSubmit,
  cancelTo,
}: {
  estimate?: Estimate
  onSubmit: (input: EstimateInput) => Promise<void>
  cancelTo: string
}) {
  const company = useCompany()
  const form = useForm<EstimateFormValues, unknown, EstimateInput>({
    resolver: zodResolver(estimateSchema),
    defaultValues: estimateFormValues(estimate),
  })
  // Without the permission to see them the lists stay empty, and the backend would refuse
  const canSeeClients = useCan('clients.view')
  const canSeeSites = useCan('sites.view')
  const clients =
    useQuery({ ...clientOptionsQuery(company.slug), enabled: canSeeClients }).data ?? []
  const sites = useQuery({ ...siteOptionsQuery(company.slug), enabled: canSeeSites }).data ?? []

  // The estimate's own client and site stay in the lists even if they are not loaded
  const clientOptions = withCurrent(
    clients.map((client) => ({ value: client.id, text: client.name })),
    estimate?.client && { value: estimate.client.id, text: estimate.client.name },
  )
  const siteOptions = withCurrent(
    sites.map((site) => ({ value: site.id, text: site.name })),
    estimate?.site && { value: estimate.site.id, text: estimate.site.name },
  )

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="estimates.section.main">
        <Text name="title" label="estimates.titleField" maxLength={200} required />
        <Select name="status" label="estimates.status" options={STATUS_OPTIONS} required />
        <Choice
          name="client_id"
          label="estimates.client"
          empty="estimates.none"
          options={clientOptions}
        />
        <Choice
          name="site_id"
          label="estimates.site"
          empty="estimates.none"
          options={siteOptions}
        />
        <Text
          name="site_address"
          label="estimates.siteAddress"
          hint="estimates.siteAddress.hint"
          maxLength={300}
        />
      </FormSection>
      <Text name="notes" label="estimates.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}

function withCurrent(
  options: { value: string; text: string }[],
  current: { value: string; text: string } | null | undefined,
) {
  if (current && !options.some((option) => option.value === current.value)) {
    return [current, ...options]
  }
  return options
}
