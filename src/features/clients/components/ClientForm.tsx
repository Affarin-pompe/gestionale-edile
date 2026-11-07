import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { EntityForm, FormSection, SelectField, TextField } from '@/components/common/EntityForm'
import type { Client, ClientInput } from '../api'
import { clientFormValues, clientSchema, type ClientFormValues } from '../schemas'

const Text = TextField<ClientFormValues>
const Select = SelectField<ClientFormValues>

const KIND_OPTIONS = [
  { value: 'company', label: 'clients.kind.company' },
  { value: 'public_body', label: 'clients.kind.public_body' },
  { value: 'person', label: 'clients.kind.person' },
] as const

/** New client when `client` is missing, otherwise its changes. */
export function ClientForm({
  client,
  onSubmit,
  onReload,
  cancelTo,
}: {
  client?: Client
  onSubmit: (input: ClientInput) => Promise<void>
  /** Loads the client again after someone else changed it (see EntityForm). */
  onReload?: () => Promise<void>
  cancelTo: string
}) {
  const form = useForm<ClientFormValues, unknown, ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: clientFormValues(client),
  })
  // For Italian clients: a private person needs the tax code; a company or a public body
  // the VAT number or the tax code. Abroad neither is required.
  const [kind, country] = useWatch({ control: form.control, name: ['kind', 'country'] })
  const italian = country.trim().toUpperCase() === 'IT'
  const taxIds = ['vat_number', 'tax_code'] as const

  return (
    <EntityForm form={form} onSubmit={onSubmit} onReload={onReload} cancelTo={cancelTo}>
      <FormSection legend="clients.section.main">
        <Select
          name="kind"
          label="clients.kind"
          options={KIND_OPTIONS}
          deps={[...taxIds]}
          required
        />
        <Text name="name" label="clients.name" hint="clients.name.hint" maxLength={200} required />
      </FormSection>
      <FormSection legend="clients.section.tax">
        <Text
          name="vat_number"
          label="clients.vatNumber"
          hint={italian && kind !== 'person' ? 'clients.vatNumber.hint' : undefined}
          maxLength={20}
          deps={['tax_code']}
        />
        <Text
          name="tax_code"
          label="clients.taxCode"
          maxLength={16}
          required={italian && kind === 'person'}
          deps={['vat_number']}
        />
        <Text name="sdi_code" label="clients.sdiCode" hint="clients.sdiCode.hint" maxLength={7} />
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
        <Text
          name="country"
          label="clients.country"
          hint="clients.country.hint"
          maxLength={2}
          deps={[...taxIds]}
          required
        />
      </FormSection>
      <Text name="notes" label="clients.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
