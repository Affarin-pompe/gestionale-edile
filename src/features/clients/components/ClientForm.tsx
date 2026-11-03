import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { EntityForm, FormSection, SelectField, TextField } from '@/components/common/EntityForm'
import type { Client, ClientInput } from '../api'
import { clientFormValues, clientSchema, type ClientFormValues } from '../schemas'

const Text = TextField<ClientFormValues>
const Select = SelectField<ClientFormValues>

const KIND_OPTIONS = [
  { value: 'company', label: 'clients.kind.company' },
  { value: 'person', label: 'clients.kind.person' },
] as const

/** New client when `client` is missing, otherwise its changes. */
export function ClientForm({
  client,
  onSubmit,
  cancelTo,
}: {
  client?: Client
  onSubmit: (input: ClientInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<ClientFormValues, unknown, ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: clientFormValues(client),
  })
  // A company needs the VAT number, a private person the tax code
  const kind = useWatch({ control: form.control, name: 'kind' })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="clients.section.main">
        <Select
          name="kind"
          label="clients.kind"
          options={KIND_OPTIONS}
          deps={['vat_number', 'tax_code']}
          required
        />
        <Text name="name" label="clients.name" hint="clients.name.hint" maxLength={200} required />
      </FormSection>
      <FormSection legend="clients.section.tax">
        <Text
          name="vat_number"
          label="clients.vatNumber"
          maxLength={20}
          required={kind === 'company'}
        />
        <Text name="tax_code" label="clients.taxCode" maxLength={16} required={kind === 'person'} />
        <Text name="sdi_code" label="clients.sdiCode" maxLength={7} />
      </FormSection>
      <FormSection legend="clients.section.contacts">
        <Text name="email" label="clients.email" type="email" autoComplete="off" />
        <Text name="pec" label="clients.pec" type="email" autoComplete="off" />
        <Text name="phone" label="clients.phone" type="tel" maxLength={30} autoComplete="off" />
      </FormSection>
      <FormSection legend="clients.section.address">
        <Text name="street" label="clients.street" maxLength={200} className="md:col-span-2" />
        <Text name="postal_code" label="clients.postalCode" maxLength={10} />
        <Text name="city" label="clients.city" maxLength={100} />
        <Text name="province" label="clients.province" hint="clients.province.hint" maxLength={2} />
      </FormSection>
      <Text name="notes" label="clients.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
