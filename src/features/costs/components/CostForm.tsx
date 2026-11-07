import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  EntityForm,
  FormSection,
  OptionsField,
  SelectField,
  TextField,
} from '@/components/common/EntityForm'
import { COST_CATEGORIES, siteLabel, useChoices, type SiteCost, type SiteCostInput } from '../api'
import { costFormValues, costSchema, type CostFormValues } from '../schemas'

const Text = TextField<CostFormValues>
const Options = OptionsField<CostFormValues>

const CATEGORY_OPTIONS = COST_CATEGORIES.map((value) => ({
  value,
  label: `costs.category.${value}` as const,
}))

/** New cost when `cost` is missing, otherwise its changes. */
export function CostForm({
  cost,
  start,
  onSubmit,
  onReload,
  cancelTo,
}: {
  cost?: SiteCost
  /** Where a new cost starts: its site (may be empty) and day. */
  start: { site: string; date: string }
  onSubmit: (input: SiteCostInput) => Promise<void>
  onReload?: () => Promise<void>
  cancelTo: string
}) {
  const form = useForm<CostFormValues, unknown, SiteCostInput>({
    resolver: zodResolver(costSchema),
    defaultValues: costFormValues(cost, start),
  })
  const choices = useChoices().data
  const sites = [...(choices?.sites ?? [])]
  const suppliers = [...(choices?.suppliers ?? [])]
  // The linked site and supplier show even when not among the options (archived, or past
  // the first page)
  if (cost && !sites.some((s) => s.id === cost.site_id)) {
    sites.unshift({ id: cost.site.id, name: siteLabel(cost.site) })
  }
  if (cost?.supplier && !suppliers.some((s) => s.id === cost.supplier?.id)) {
    suppliers.unshift(cost.supplier)
  }
  const toOptions = (list: { id: string; name: string }[]) =>
    list.map((item) => ({ value: item.id, text: item.name }))
  // Keyed on the options, so the saved choice is selected once they arrive
  const loaded = choices ? 'loaded' : 'loading'

  return (
    <EntityForm form={form} onSubmit={onSubmit} onReload={onReload} cancelTo={cancelTo}>
      <FormSection legend="costs.section.main">
        <Options
          key={`site-${loaded}`}
          name="site_id"
          label="costs.site"
          empty="costs.site.choose"
          groups={[{ options: toOptions(sites) }]}
          required
        />
        <Text name="date" label="costs.date" type="date" required />
        <SelectField<CostFormValues>
          name="category"
          label="costs.category"
          options={CATEGORY_OPTIONS}
          required
        />
        <Text
          name="description"
          label="costs.description"
          hint="costs.description.hint"
          maxLength={300}
          required
        />
        <Text
          name="amount"
          label="costs.amount"
          hint="costs.amount.hint"
          inputMode="decimal"
          maxLength={20}
          required
        />
        <Options
          key={`supplier-${loaded}`}
          name="supplier_id"
          label="costs.supplier"
          hint="costs.supplier.hint"
          empty="costs.supplier.none"
          groups={[{ options: toOptions(suppliers) }]}
        />
      </FormSection>
      <Text name="notes" label="costs.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
