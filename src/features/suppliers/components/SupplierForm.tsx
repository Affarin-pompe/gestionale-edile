import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  CheckboxField,
  CheckboxGroupField,
  EntityForm,
  FormSection,
  TextField,
} from '@/components/common/EntityForm'
import { SUPPLIER_CATEGORIES, type Supplier, type SupplierInput } from '../api'
import { supplierFormValues, supplierSchema, type SupplierFormValues } from '../schemas'

const Text = TextField<SupplierFormValues>

const CATEGORY_OPTIONS = SUPPLIER_CATEGORIES.map((value) => ({
  value,
  label: `suppliers.category.${value}` as const,
}))

/** New supplier when `supplier` is missing, otherwise its changes. */
export function SupplierForm({
  supplier,
  onSubmit,
  cancelTo,
}: {
  supplier?: Supplier
  onSubmit: (input: SupplierInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<SupplierFormValues, unknown, SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplierFormValues(supplier),
  })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="suppliers.section.main">
        <Text
          name="name"
          label="suppliers.name"
          hint="suppliers.name.hint"
          maxLength={200}
          required
        />
        <Text
          name="vat_number"
          label="suppliers.vatNumber"
          hint="suppliers.taxId.hint"
          maxLength={20}
        />
        <Text name="tax_code" label="suppliers.taxCode" maxLength={16} />
        <CheckboxGroupField<SupplierFormValues>
          name="categories"
          label="suppliers.categories"
          options={CATEGORY_OPTIONS}
        />
        <CheckboxField<SupplierFormValues>
          name="subcontractor"
          label="suppliers.subcontractor"
          hint="suppliers.subcontractor.hint"
        />
      </FormSection>
      <FormSection legend="suppliers.section.contacts">
        <Text name="email" label="suppliers.email" type="email" autoComplete="off" />
        <Text name="pec" label="suppliers.pec" type="email" autoComplete="off" />
        <Text name="phone" label="suppliers.phone" type="tel" maxLength={30} autoComplete="off" />
      </FormSection>
      <FormSection legend="suppliers.section.address">
        <Text name="street" label="suppliers.street" maxLength={200} />
        <Text name="postal_code" label="suppliers.postalCode" maxLength={10} />
        <Text name="city" label="suppliers.city" maxLength={100} />
        <Text
          name="province"
          label="suppliers.province"
          hint="suppliers.province.hint"
          maxLength={2}
        />
        <Text
          name="country"
          label="suppliers.country"
          hint="suppliers.country.hint"
          maxLength={2}
          required
        />
      </FormSection>
      <Text name="notes" label="suppliers.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
