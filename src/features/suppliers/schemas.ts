import { z } from 'zod'
import { message, optionalDay, optionalEmail, optionalText, requiredText } from '@/lib/form-schema'
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_DOCUMENT_KINDS,
  type Supplier,
  type SupplierDocument,
  type SupplierDocumentInput,
  type SupplierInput,
} from './api'

/** The same rules as the backend (SupplierInput), so most mistakes show before saving. */
export const supplierSchema = z
  .object({
    name: requiredText(200),
    vat_number: optionalText(20),
    tax_code: optionalText(16),
    email: optionalEmail,
    pec: optionalEmail,
    phone: optionalText(30),
    street: optionalText(200),
    postal_code: optionalText(10),
    city: optionalText(100),
    province: optionalText(2),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, message('suppliers.countryInvalid')),
    // An unchecked group gives false in react-hook-form, one box a string, more an array
    categories: z
      .union([z.array(z.enum(SUPPLIER_CATEGORIES)), z.enum(SUPPLIER_CATEGORIES), z.literal(false)])
      .transform((value) => (value === false ? [] : Array.isArray(value) ? value : [value])),
    subcontractor: z.boolean(),
    notes: optionalText(2000),
  })
  .superRefine((supplier, context) => {
    // An Italian supplier needs at least one of the two
    if (supplier.country === 'IT' && !supplier.vat_number && !supplier.tax_code) {
      context.addIssue({ code: 'custom', path: ['vat_number'], message: 'suppliers.taxIdRequired' })
    }
  }) satisfies z.ZodType<SupplierInput>

export type SupplierFormValues = z.input<typeof supplierSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function supplierFormValues(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? '',
    vat_number: supplier?.vat_number ?? '',
    tax_code: supplier?.tax_code ?? '',
    categories: supplier?.categories ?? [],
    subcontractor: supplier?.subcontractor ?? false,
    email: supplier?.email ?? '',
    pec: supplier?.pec ?? '',
    phone: supplier?.phone ?? '',
    street: supplier?.street ?? '',
    postal_code: supplier?.postal_code ?? '',
    city: supplier?.city ?? '',
    province: supplier?.province ?? '',
    country: supplier?.country ?? 'IT',
    notes: supplier?.notes ?? '',
  }
}

export const supplierDocumentSchema = z
  .object({
    kind: z.enum(SUPPLIER_DOCUMENT_KINDS, message('validation.required')),
    description: optionalText(200),
    issued_on: optionalDay,
    expires_on: optionalDay,
    notes: optionalText(2000),
  })
  .superRefine((document, context) => {
    if (document.kind === 'other' && !document.description) {
      context.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'suppliers.documents.descriptionRequired',
      })
    }
    // Both are AAAA-MM-GG: as text they sort like dates
    if (document.issued_on && document.expires_on && document.expires_on < document.issued_on) {
      context.addIssue({
        code: 'custom',
        path: ['expires_on'],
        message: 'suppliers.documents.expiresBeforeIssued',
      })
    }
  }) satisfies z.ZodType<SupplierDocumentInput>

export type SupplierDocumentFormValues = z.input<typeof supplierDocumentSchema>

export function supplierDocumentFormValues(
  document?: SupplierDocument,
): SupplierDocumentFormValues {
  return {
    kind: document?.kind ?? 'durc',
    description: document?.description ?? '',
    issued_on: document?.issued_on ?? '',
    expires_on: document?.expires_on ?? '',
    notes: document?.notes ?? '',
  }
}
