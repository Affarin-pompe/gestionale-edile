import { describe, expect, expectTypeOf, it } from 'vitest'
import { createApiClient } from './client'
import { ApiError, fieldErrors, unwrap } from './errors'
import type { components } from './schema'

type Me = components['schemas']['Me']
type ClientRecord = components['schemas']['Client']

const COMPANY = 'impresa-rossi'

const clientInput: components['schemas']['ClientInput'] = {
  kind: 'company',
  name: 'Edilizia Bianchi S.r.l.',
  vat_number: '01234567890',
  tax_code: null,
  email: null,
  pec: null,
  phone: null,
  sdi_code: null,
  street: null,
  postal_code: null,
  city: null,
  province: null,
  country: 'IT',
  notes: null,
}

const validationBody = {
  message: 'I dati non sono validi.',
  errors: {
    vat_number: ['Esiste già un cliente con questa partita IVA.', 'Formato non valido.'],
    'address.city': ['Il comune è obbligatorio.'],
  },
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// unwrap is fed what the real client returns, so the tests cover how the two fit together
function clientAnswering(response: Response) {
  return createApiClient({
    baseUrl: 'http://localhost',
    fetch: () => Promise.resolve(response),
    readCookie: () => 'token-123',
  })
}

function errorThrownBy(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    return error
  }
  throw new Error('expected the call to throw')
}

describe('unwrap', () => {
  it('returns the data of a 200', async () => {
    const me: Me = {
      id: 'u-1',
      name: 'Mario Rossi',
      email: 'mario@example.test',
      companies: [
        {
          slug: COMPANY,
          name: 'Impresa Rossi S.r.l.',
          role: 'Titolare',
          permissions: ['clients.view'],
        },
      ],
    }
    const result = await clientAnswering(json(me, 200)).GET('/api/me')

    const data = unwrap(result)

    expectTypeOf(data).toEqualTypeOf<Me>()
    expect(data).toEqual(me)
  })

  it('returns the data of a 201', async () => {
    const created: ClientRecord = {
      ...clientInput,
      id: '0b8f6a52-3c1e-4d7a-9f20-6f1b2c3d4e5f',
      archived_at: null,
      created_at: '2026-11-02T10:00:00Z',
      updated_at: '2026-11-02T10:00:00Z',
    }
    const result = await clientAnswering(json(created, 201)).POST(
      '/api/companies/{company}/clients',
      { params: { path: { company: COMPANY } }, body: clientInput },
    )

    const data = unwrap(result)

    // openapi-fetch flattens the intersection behind Client: the shapes match both ways
    expectTypeOf(data).toExtend<ClientRecord>()
    expectTypeOf<ClientRecord>().toExtend<typeof data>()
    expect(data).toEqual(created)
  })

  it.each([
    [401, { message: 'Sessione scaduta.' }],
    [403, { message: 'Non hai il permesso.' }],
    [404, { message: 'Non trovato.' }],
    [422, validationBody],
    [500, { message: 'Errore interno.' }],
  ])('throws an ApiError with the status and the parsed body of a %i', async (status, body) => {
    const result = await clientAnswering(json(body, status)).GET('/api/me')

    const error = errorThrownBy(() => unwrap(result))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(Error)
    expect((error as ApiError).status).toBe(status)
    expect((error as ApiError).body).toEqual(body)
  })

  it.each([
    ['with Content-Length: 0', { 'Content-Length': '0' }],
    ['without Content-Length', {}],
  ])(
    'throws an ApiError with body undefined for a non-2xx with an empty body (%s)',
    async (_, headers) => {
      const result = await clientAnswering(new Response(null, { status: 500, headers })).GET(
        '/api/me',
      )

      const error = errorThrownBy(() => unwrap(result))

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(500)
      expect((error as ApiError).body).toBeUndefined()
    },
  )
})

describe('fieldErrors', () => {
  it('returns the first message per field of a 422, keeping dotted keys as they are', () => {
    const error = new ApiError(422, {
      message: 'I dati non sono validi.',
      errors: { vat_number: ['A', 'B'], 'address.city': ['C'] },
    })

    expect(fieldErrors(error)).toStrictEqual({ vat_number: 'A', 'address.city': 'C' })
  })

  it('reads the 422 that unwrap throws for a request made through the client', async () => {
    const result = await clientAnswering(json(validationBody, 422)).POST(
      '/api/companies/{company}/clients',
      { params: { path: { company: COMPANY } }, body: clientInput },
    )

    const error = errorThrownBy(() => unwrap(result))

    expect(fieldErrors(error)).toStrictEqual({
      vat_number: 'Esiste già un cliente con questa partita IVA.',
      'address.city': 'Il comune è obbligatorio.',
    })
  })

  it('leaves out a field whose message list is empty', () => {
    const error = new ApiError(422, {
      message: 'I dati non sono validi.',
      errors: { vat_number: [], name: ['Il nome è obbligatorio.'] },
    })

    expect(fieldErrors(error)).toStrictEqual({ name: 'Il nome è obbligatorio.' })
  })

  it.each<[string, unknown]>([
    ['a plain Error', new Error('Network down')],
    ['undefined', undefined],
    ['null', null],
    ['an object shaped like an ApiError', { status: 422, body: validationBody }],
  ])('returns {} when the error is %s', (_, error) => {
    expect(fieldErrors(error)).toStrictEqual({})
  })

  it.each([400, 401, 403, 404, 409, 500])('returns {} for an ApiError with status %i', (status) => {
    expect(fieldErrors(new ApiError(status, validationBody))).toStrictEqual({})
  })

  it.each<[string, unknown]>([
    ['no body', undefined],
    ['a null body', null],
    ['a string body', 'Unprocessable Content'],
    ['no errors', { message: 'I dati non sono validi.' }],
    ['errors set to null', { message: 'x', errors: null }],
    ['errors set to a string', { message: 'x', errors: 'vat_number' }],
    ['errors set to a number', { message: 'x', errors: 42 }],
    ['a value that is not an array', { message: 'x', errors: { vat_number: 'A' } }],
    [
      'a value that is not an array next to a valid one',
      { message: 'x', errors: { name: ['Il nome è obbligatorio.'], vat_number: 'A' } },
    ],
    ['an array of non-strings', { message: 'x', errors: { vat_number: [42] } }],
    [
      'an array mixing strings and non-strings',
      { message: 'x', errors: { vat_number: ['A', null] } },
    ],
  ])('returns {} for a 422 with %s', (_, body) => {
    expect(fieldErrors(new ApiError(422, body))).toStrictEqual({})
  })
})
