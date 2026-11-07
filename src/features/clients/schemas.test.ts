import { describe, expect, it } from 'vitest'
import type { Client, ClientInput } from './api'
import { clientFormValues, clientSchema, type ClientFormValues } from './schemas'

// The 14 fields of ClientInput in api/openapi.yaml: all of them are always sent
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
  'country',
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
  country: 'IT',
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
  it('trims the text and sends null for empty optional fields, with exactly the 14 contract keys', () => {
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
      country: 'IT',
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

  it.each(['company', 'public_body'] as const)(
    'an Italian %s needs the VAT number or the tax code, either one',
    (kind) => {
      const missing = { vat_number: ['clients.vatOrTaxCodeRequired'] }
      expect(errorsOf(company({ kind, vat_number: '' }))).toEqual(missing)
      expect(errorsOf(company({ kind, vat_number: '   ' }))).toEqual(missing)
      expect(errorsOf(company({ kind, vat_number: '', tax_code: '90012345678' }))).toBeNull()
      expect(errorsOf(company({ kind }))).toBeNull()
    },
  )

  it('an Italian person needs the tax code, not the VAT number', () => {
    const person = { ...EMPTY, kind: 'person' as const, name: 'Mario Bianchi' }
    expect(errorsOf(person)).toEqual({ tax_code: ['clients.taxCodeRequired'] })
    expect(errorsOf({ ...person, tax_code: ' ' })).toEqual({
      tax_code: ['clients.taxCodeRequired'],
    })
    expect(errorsOf({ ...person, vat_number: '01234567890' })).toEqual({
      tax_code: ['clients.taxCodeRequired'],
    })
    expect(errorsOf({ ...person, tax_code: 'BNCMRA80A01L219X' })).toBeNull()
  })

  it.each(['company', 'public_body', 'person'] as const)(
    'a foreign %s needs neither tax id',
    (kind) => {
      expect(errorsOf({ ...EMPTY, kind, name: 'Bau Prova GmbH', country: 'DE' })).toBeNull()
    },
  )

  it('reports the missing tax ids together with an empty name', () => {
    expect(errorsOf({ ...EMPTY })).toEqual({
      name: ['validation.required'],
      vat_number: ['clients.vatOrTaxCodeRequired'],
    })
  })

  it('reports the missing tax code together with an empty name', () => {
    expect(errorsOf({ ...EMPTY, kind: 'person' })).toEqual({
      name: ['validation.required'],
      tax_code: ['clients.taxCodeRequired'],
    })
  })

  it('reports the missing tax ids together with an invalid email', () => {
    expect(errorsOf(company({ vat_number: '', email: 'non-una-email' }))).toEqual({
      vat_number: ['clients.vatOrTaxCodeRequired'],
      email: ['validation.email'],
    })
  })

  it('reports the missing tax ids together with a text that is too long', () => {
    expect(errorsOf(company({ vat_number: '', city: 'x'.repeat(101) }))).toEqual({
      vat_number: ['clients.vatOrTaxCodeRequired'],
      city: ['validation.tooLong'],
    })
  })
})

describe('clientSchema, country', () => {
  it('is required', () => {
    expect(errorsOf(company({ country: '  ' }))).toMatchObject({
      country: ['validation.required'],
    })
  })

  it('is sent in upper case, without spaces', () => {
    expect(parse(company({ country: ' de ' })).country).toBe('DE')
    expect(parse(company({ country: 'it' })).country).toBe('IT')
  })

  it.each(['ITA', 'I', '1T', 'I-'])('refuses %s, which is not a two-letter code', (country) => {
    expect(errorsOf(company({ country }))).toMatchObject({ country: ['clients.countryInvalid'] })
  })

  it('a lower-case "it" is Italy: the tax ids are required', () => {
    expect(errorsOf(company({ country: 'it', vat_number: '' }))).toEqual({
      vat_number: ['clients.vatOrTaxCodeRequired'],
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

  it('the SDI code has 7 characters, or 6 for the public administration', () => {
    expect(parse(company({ sdi_code: 'UFABC1' })).sdi_code).toBe('UFABC1')
    expect(parse(company({ sdi_code: 'ABC1234' })).sdi_code).toBe('ABC1234')
    expect(errorsOf(company({ sdi_code: 'ABC12' }))).toEqual({
      sdi_code: ['clients.sdiCodeLength'],
    })
  })

  it('accepts a kind only among company, public body and person', () => {
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
      country: 'IT',
      notes: null,
      archived_at: null,
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
      country: 'IT',
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
      country: 'IT',
      notes: null,
    }
    const client: Client = { ...input, id: 'x', archived_at: null, created_at: '', updated_at: '' }

    expect(parse(clientFormValues(client))).toEqual(input)
  })
})
