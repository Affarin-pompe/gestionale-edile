import { describe, expect, it } from 'vitest'
import type { Client, ClientInput } from './api'
import { clientFormValues, clientSchema, type ClientFormValues } from './schemas'

// The 13 fields of ClientInput in api/openapi.yaml: all of them are always sent
const INPUT_KEYS: (keyof ClientInput)[] = [
  'kind',
  'name',
  'vat_number',
  'tax_code',
  'email',
  'pec',
  'phone',
  'sdi_code',
  'street',
  'postal_code',
  'city',
  'province',
  'notes',
]

// maxLength of each field in ClientInput (api/openapi.yaml)
const MAX_LENGTHS = {
  name: 200,
  vat_number: 20,
  tax_code: 16,
  phone: 30,
  sdi_code: 7,
  street: 200,
  postal_code: 10,
  city: 100,
  province: 2,
  notes: 2000,
} as const

const EMPTY: ClientFormValues = {
  kind: 'company',
  name: '',
  vat_number: '',
  tax_code: '',
  email: '',
  pec: '',
  phone: '',
  sdi_code: '',
  street: '',
  postal_code: '',
  city: '',
  province: '',
  notes: '',
}

/** A company that passes, with only the required fields. */
const company = (values: Partial<ClientFormValues> = {}): ClientFormValues => ({
  ...EMPTY,
  name: 'Edil Prova S.r.l.',
  vat_number: '01234567890',
  ...values,
})

/** The messages of a failed parse by field, or null when it passes. */
function errorsOf(values: ClientFormValues) {
  const result = clientSchema.safeParse(values)
  if (result.success) return null
  const errors: Record<string, string[]> = {}
  for (const issue of result.error.issues) (errors[issue.path.join('.')] ??= []).push(issue.message)
  return errors
}

function parse(values: ClientFormValues) {
  const result = clientSchema.safeParse(values)
  if (!result.success) throw new Error(`Expected to pass: ${JSON.stringify(errorsOf(values))}`)
  return result.data
}

describe('clientSchema, what it sends', () => {
  it('trims the text and sends null for empty optional fields, with exactly the 13 contract keys', () => {
    const values = {
      ...company({
        name: '  Edil Prova S.r.l. ',
        vat_number: ' 01234567890 ',
        email: ' info@prova.example.test ',
        city: '  Torino  ',
        street: '   ',
        notes: '\n',
      }),
      // Not a field of the contract: it must not reach the backend
      id: 'impresa-rossi-001',
    }

    const output = parse(values)

    expect(output).toEqual({
      kind: 'company',
      name: 'Edil Prova S.r.l.',
      vat_number: '01234567890',
      tax_code: null,
      email: 'info@prova.example.test',
      pec: null,
      phone: null,
      sdi_code: null,
      street: null,
      postal_code: null,
      city: 'Torino',
      province: null,
      notes: null,
    })
    expect(Object.keys(output).sort()).toEqual([...INPUT_KEYS].sort())
  })

  it.each([
    'tax_code',
    'email',
    'pec',
    'phone',
    'sdi_code',
    'street',
    'postal_code',
    'city',
    'province',
    'notes',
  ] as const)('%s with only spaces is sent as null', (field) => {
    expect(parse(company({ [field]: '   ' }))[field]).toBeNull()
  })

  it('a person with only spaces as VAT number sends null', () => {
    const output = parse({
      ...EMPTY,
      kind: 'person',
      name: 'Mario Bianchi',
      tax_code: 'X',
      vat_number: '  ',
    })

    expect(output.vat_number).toBeNull()
    expect(output.tax_code).toBe('X')
  })
})

describe('clientSchema, required fields', () => {
  it('a name made only of spaces is missing', () => {
    expect(errorsOf(company({ name: '    ' }))).toEqual({ name: ['validation.required'] })
  })

  it('a company needs the VAT number, not the tax code', () => {
    expect(errorsOf(company({ vat_number: '' }))).toEqual({ vat_number: ['clients.vatRequired'] })
    expect(errorsOf(company({ vat_number: '   ' }))).toEqual({
      vat_number: ['clients.vatRequired'],
    })
  })

  it('a person needs the tax code, not the VAT number', () => {
    const person = { ...EMPTY, kind: 'person' as const, name: 'Mario Bianchi' }

    expect(errorsOf(person)).toEqual({ tax_code: ['clients.taxCodeRequired'] })
    expect(errorsOf({ ...person, tax_code: ' ' })).toEqual({
      tax_code: ['clients.taxCodeRequired'],
    })
    expect(errorsOf({ ...person, tax_code: 'BNCMRA80A01L219X' })).toBeNull()
  })

  it('reports the missing VAT number together with an empty name', () => {
    expect(errorsOf({ ...EMPTY })).toEqual({
      name: ['validation.required'],
      vat_number: ['clients.vatRequired'],
    })
  })

  it('reports the missing tax code together with an empty name', () => {
    expect(errorsOf({ ...EMPTY, kind: 'person' })).toEqual({
      name: ['validation.required'],
      tax_code: ['clients.taxCodeRequired'],
    })
  })

  it('reports the missing VAT number together with an invalid email', () => {
    expect(errorsOf(company({ vat_number: '', email: 'non-una-email' }))).toEqual({
      vat_number: ['clients.vatRequired'],
      email: ['validation.email'],
    })
  })

  it('reports the missing VAT number together with a text that is too long', () => {
    expect(errorsOf(company({ vat_number: '', city: 'x'.repeat(101) }))).toEqual({
      vat_number: ['clients.vatRequired'],
      city: ['validation.tooLong'],
    })
  })
})

describe('clientSchema, lengths and addresses', () => {
  it.each(Object.entries(MAX_LENGTHS) as [keyof typeof MAX_LENGTHS, number][])(
    '%s takes at most %i characters',
    (field, max) => {
      expect(parse(company({ [field]: 'x'.repeat(max) }))[field]).toBe('x'.repeat(max))
      expect(errorsOf(company({ [field]: 'x'.repeat(max + 1) }))).toEqual({
        [field]: ['validation.tooLong'],
      })
    },
  )

  it('counts the length after trimming the spaces around the text', () => {
    expect(parse(company({ province: ' TO ' })).province).toBe('TO')
  })

  it.each(['email', 'pec'] as const)('%s may be empty, and is sent as null', (field) => {
    expect(parse(company({ [field]: '' }))[field]).toBeNull()
  })

  it.each(['email', 'pec'] as const)('%s must be a valid address', (field) => {
    expect(errorsOf(company({ [field]: 'mario.rossi' }))).toEqual({ [field]: ['validation.email'] })
    expect(errorsOf(company({ [field]: 'mario@' }))).toEqual({ [field]: ['validation.email'] })
    expect(parse(company({ [field]: ' mario@prova.example.test ' }))[field]).toBe(
      'mario@prova.example.test',
    )
  })

  it('accepts a kind only among company and person', () => {
    const values = { ...company(), kind: 'ente' } as unknown as ClientFormValues

    expect(errorsOf(values)).toMatchObject({ kind: ['validation.required'] })
  })
})

describe('clientFormValues', () => {
  it('without a client, starts a company with every other field empty', () => {
    expect(clientFormValues()).toEqual(EMPTY)
  })

  it("puts the client's values in the inputs, with '' for the missing ones and nothing else", () => {
    const client: Client = {
      id: 'impresa-rossi-900',
      kind: 'person',
      name: 'Mario Bianchi',
      vat_number: null,
      tax_code: 'BNCMRA80A01L219X',
      email: 'mario@prova.example.test',
      pec: null,
      phone: '011 555 0000',
      sdi_code: null,
      street: null,
      postal_code: '10121',
      city: 'Torino',
      province: null,
      notes: null,
      created_at: '2026-01-01T09:00:00.000Z',
      updated_at: '2026-01-02T09:00:00.000Z',
    }

    expect(clientFormValues(client)).toEqual({
      kind: 'person',
      name: 'Mario Bianchi',
      vat_number: '',
      tax_code: 'BNCMRA80A01L219X',
      email: 'mario@prova.example.test',
      pec: '',
      phone: '011 555 0000',
      sdi_code: '',
      street: '',
      postal_code: '10121',
      city: 'Torino',
      province: '',
      notes: '',
    })
  })

  it('round-trips: the values of a saved client parse back to the same input', () => {
    const input: ClientInput = {
      kind: 'company',
      name: 'Edil Prova S.r.l.',
      vat_number: '01234567890',
      tax_code: null,
      email: null,
      pec: 'prova@pec.example.test',
      phone: null,
      sdi_code: 'ABC1234',
      street: 'Via Roma 1',
      postal_code: null,
      city: null,
      province: 'TO',
      notes: null,
    }
    const client: Client = { ...input, id: 'x', created_at: '', updated_at: '' }

    expect(parse(clientFormValues(client))).toEqual(input)
  })
})
