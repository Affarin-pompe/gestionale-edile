import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { EntityForm, FormSection, SelectField, TextField } from '@/components/common/EntityForm'
import { SUPPLIER_DOCUMENT_KINDS, type SupplierDocument, type SupplierDocumentInput } from '../api'
import {
  supplierDocumentFormValues,
  supplierDocumentSchema,
  type SupplierDocumentFormValues,
} from '../schemas'

const Text = TextField<SupplierDocumentFormValues>

const KIND_OPTIONS = SUPPLIER_DOCUMENT_KINDS.map((value) => ({
  value,
  label: `suppliers.documents.kind.${value}` as const,
}))

/** New document when `document` is missing, otherwise its changes. */
export function SupplierDocumentForm({
  document,
  onSubmit,
  cancelTo,
}: {
  document?: SupplierDocument
  onSubmit: (input: SupplierDocumentInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<SupplierDocumentFormValues, unknown, SupplierDocumentInput>({
    resolver: zodResolver(supplierDocumentSchema),
    defaultValues: supplierDocumentFormValues(document),
  })
  // "Other" needs a description that says what it is
  const kind = useWatch({ control: form.control, name: 'kind' })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="suppliers.documents.one">
        <SelectField<SupplierDocumentFormValues>
          name="kind"
          label="suppliers.documents.kind"
          options={KIND_OPTIONS}
          deps={['description']}
          required
        />
        <Text
          name="description"
          label="suppliers.documents.description"
          maxLength={200}
          required={kind === 'other'}
        />
        <Text name="issued_on" label="suppliers.documents.issuedOn" type="date" />
        <Text
          name="expires_on"
          label="suppliers.documents.expiresOn"
          hint="suppliers.documents.expiresOn.hint"
          type="date"
        />
      </FormSection>
      <Text name="notes" label="suppliers.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
