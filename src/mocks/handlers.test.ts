import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '@/api/client'
import type { components, operations } from '@/api/schema'
import { companies, MOCK_PASSWORD, seedClients, users, type MockUser } from '@/mocks/data'
import { db } from '@/mocks/db'
import { createTestApi } from '@/test/api'

type Client = components['schemas']['Client']
type ClientInput = components['schemas']['ClientInput']
type ClientList = components['schemas']['ClientList']
type LoginInput = components['schemas']['LoginInput']
type ValidationError = components['schemas']['ValidationError']
type ListQuery = NonNullable<operations['listClients']['parameters']['query']>
type Api = ReturnType<typeof createApiClient>
type Jar = Map<string, string>
type Result = { response: Response; error?: unknown }

const BASE_URL = 'http://localhost'
const ROSSI = 'impresa-rossi'
const VERDI = 'costruzioni-verdi'
const ROSSI_001 = 'impresa-rossi-001'
const VERDI_001 = 'costruzioni-verdi-001'
const TITOLARE = 'titolare@example.test'
const UFFICIO = 'ufficio@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'

// expect.any() is typed any: typed once here, so the objects that use it stay type-checked
const anyString = expect.any(String) as string
const anyObject = expect.any(Object) as object

// The properties of Client in api/openapi.yaml
const CLIENT_FIELDS = [
  ...['kind', 'name', 'vat_number', 'tax_code', 'email', 'pec', 'phone', 'sdi_code'],
  ...['street', 'postal_code', 'city', 'province', 'notes', 'id', 'created_at', 'updated_at'],
].sort()

// A fresh copy of the seed, to compare the mock's answers against
const seed = seedClients()
const rossiSeed = seed[ROSSI] ?? []
const namesAsc = rossiSeed.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'it'))
const idsByCreation = [...rossiSeed]
  .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  .map((c) => c.id)

function seeded(id: string): Client {
  const client = [...rossiSeed, ...(seed[VERDI] ?? [])].find((c) => c.id === id)
  if (!client) throw new Error(`${id} is not in the seed`)
  return client
}

const validClient: ClientInput = {
  kind: 'company',
  name: 'Nuova Edilizia S.r.l.',
  vat_number: '09876543210',
  tax_code: null,
  email: 'ufficio@nuovaedilizia.example.test',
  pec: 'nuovaedilizia@pec.example.test',
  phone: '011 555 9999',
  sdi_code: 'XYZ9876',
  street: 'Via Roma 1',
  postal_code: '10121',
  city: 'Torino',
  province: 'TO',
  notes: null,
}

async function signedIn(email: string) {
  const testApi = createTestApi()
  await testApi.login(email)
  return testApi
}

function login(api: Api, email: string, password: string) {
  return api.POST('/api/auth/login', { body: { email, password } })
}

async function list(api: Api, query: ListQuery = {}, company = ROSSI): Promise<ClientList> {
  const { data, response } = await api.GET('/api/companies/{company}/clients', {
    params: { path: { company }, query },
  })
  expect(response.status).toBe(200)
  if (!data) throw new Error('the list came back without a body')
  return data
}

function getClientResult(api: Api, company: string, client: string) {
  return api.GET('/api/companies/{company}/clients/{client}', {
    params: { path: { company, client } },
  })
}

async function getClient(api: Api, company: string, client: string): Promise<Client> {
  const { data, response } = await getClientResult(api, company, client)
  expect(response.status).toBe(200)
  if (!data) throw new Error(`${client} came back without a body`)
  return data
}

function createClient(api: Api, body: ClientInput, company = ROSSI) {
  return api.POST('/api/companies/{company}/clients', { params: { path: { company } }, body })
}

function updateClient(api: Api, client: string, body: ClientInput, company = ROSSI) {
  return api.PUT('/api/companies/{company}/clients/{client}', {
    params: { path: { company, client } },
    body,
  })
}

/** Checks the shape of a 422 body and returns its fields, sorted. */
function errorFields(error: unknown): string[] {
  expect(error).toMatchObject({ message: anyString, errors: anyObject })
  const { errors } = error as ValidationError
  for (const messages of Object.values(errors)) {
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.every((m) => typeof m === 'string')).toBe(true)
  }
  return Object.keys(errors).sort()
}

function cookieHeader(jar: Jar, except?: string) {
  return [...jar]
    .filter(([name]) => name !== except)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/** GET of the list with a raw query string, for values the types forbid. */
async function rawList(jar: Jar, query: string) {
  const response = await fetch(`${BASE_URL}/api/companies/${ROSSI}/clients?${query}`, {
    headers: { Accept: 'application/json', Cookie: cookieHeader(jar) },
  })
  const body: unknown = await response.json()
  return { status: response.status, body }
}

/**
 * A typed client that sends the jar's cookies but sets X-XSRF-TOKEN to `header`, or leaves
 * it out when `header` is undefined. With dropCookie, the XSRF-TOKEN cookie is left out too.
 */
function forgedCsrfClient(jar: Jar, csrf: { header?: string; dropCookie?: boolean }) {
  return createApiClient({
    baseUrl: BASE_URL,
    fetch: (request) => {
      request.headers.set('Cookie', cookieHeader(jar, csrf.dropCookie ? 'XSRF-TOKEN' : undefined))
      return fetch(request)
    },
    readCookie: () => csrf.header,
  })
}

const companyName = new Map(companies.map((c) => [c.slug, c.name]))

function expectedMe(user: MockUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companies: user.memberships.map((m) => ({
      slug: m.company,
      name: companyName.get(m.company),
      role: m.role,
      permissions: m.permissions,
    })),
  }
}

describe('mock backend: session and CSRF', () => {
  it('answers 401 with a { message } body to GET /api/me without a session', async () => {
    const { api } = createTestApi()
    const { response, error } = await api.GET('/api/me')
    expect(response.status).toBe(401)
    expect(error).toStrictEqual({ message: anyString })
  })

  it.each(users)('signs in $email with 204, then /api/me returns that user', async (user) => {
    const { api } = createTestApi()
    expect((await login(api, user.email, MOCK_PASSWORD)).response.status).toBe(204)
    const { response, data } = await api.GET('/api/me')
    expect(response.status).toBe(200)
    expect(data).toStrictEqual(expectedMe(user))
  })

  it('returns companies: [] for the user with no company', async () => {
    const { api } = await signedIn('nuovo@example.test')
    expect((await api.GET('/api/me')).data?.companies).toEqual([])
  })

  it.each(['TITOLARE@EXAMPLE.TEST', '  titolare@example.test  ', '\tTitolare@Example.Test '])(
    'matches the email %j ignoring case and surrounding spaces',
    async (email) => {
      const { api } = createTestApi()
      expect((await login(api, email, MOCK_PASSWORD)).response.status).toBe(204)
      expect((await api.GET('/api/me')).data?.email).toBe(TITOLARE)
    },
  )

  it('answers a wrong password and an unknown email with the same 422, one error on email', async () => {
    const { api } = createTestApi()
    const wrongPassword = await login(api, TITOLARE, 'non-questa')
    const unknownEmail = await login(api, 'nessuno@example.test', MOCK_PASSWORD)
    expect(wrongPassword.response.status).toBe(422)
    expect(unknownEmail.response.status).toBe(422)
    expect(errorFields(wrongPassword.error)).toEqual(['email'])
    expect(wrongPassword.error).toMatchObject({ errors: { email: [anyString] } })
    expect(unknownEmail.error).toStrictEqual(wrongPassword.error)
  })

  it.each<[string, object, string[]]>([
    ['an empty body', {}, ['email', 'password']],
    ['empty strings', { email: '', password: '' }, ['email', 'password']],
    ['no email', { password: MOCK_PASSWORD }, ['email']],
    ['an empty email', { email: '', password: MOCK_PASSWORD }, ['email']],
    ['no password', { email: TITOLARE }, ['password']],
    ['an empty password', { email: TITOLARE, password: '' }, ['password']],
  ])(
    'answers 422 to a login with %s, with an error on each missing field',
    async (_, body, fields) => {
      const { api } = createTestApi()
      // Some bodies leave out fields the types require, as a broken form could
      const { response, error } = await api.POST('/api/auth/login', { body: body as LoginInput })
      expect(response.status).toBe(422)
      expect(errorFields(error)).toEqual(fields)
    },
  )

  it('logs out with 204, after which /api/me answers 401', async () => {
    const { api } = await signedIn(TITOLARE)
    expect((await api.GET('/api/me')).response.status).toBe(200)
    expect((await api.POST('/api/auth/logout')).response.status).toBe(204)
    expect((await api.GET('/api/me')).response.status).toBe(401)
  })

  it('answers 401 to a logout without a session', async () => {
    const { api } = createTestApi()
    const { response, error } = await api.POST('/api/auth/logout')
    expect(response.status).toBe(401)
    expect(error).toStrictEqual({ message: anyString })
  })

  it('sets a new XSRF-TOKEN on login and another one on logout', async () => {
    const { api, jar } = createTestApi()
    await api.GET('/api/auth/csrf')
    const beforeLogin = jar.get('XSRF-TOKEN')
    expect((await login(api, TITOLARE, MOCK_PASSWORD)).response.status).toBe(204)
    const afterLogin = jar.get('XSRF-TOKEN')
    expect((await api.POST('/api/auth/logout')).response.status).toBe(204)
    const afterLogout = jar.get('XSRF-TOKEN')

    expect([beforeLogin, afterLogin, afterLogout].every(Boolean)).toBe(true)
    expect(afterLogin).not.toBe(beforeLogin)
    expect(afterLogout).not.toBe(afterLogin)
  })

  const csrfProtected: [string, (client: Api) => Promise<Result>][] = [
    ['login', (client) => login(client, UFFICIO, MOCK_PASSWORD)],
    ['logout', (client) => client.POST('/api/auth/logout')],
    ['client create', (client) => createClient(client, validClient)],
    ['client update', (client) => updateClient(client, ROSSI_001, validClient)],
  ]
  const csrfFaults: [string, { header?: string; dropCookie?: boolean }][] = [
    ['no X-XSRF-TOKEN header', {}],
    ['an X-XSRF-TOKEN that does not match the cookie', { header: 'not-the-token' }],
    ['neither the header nor the cookie', { dropCookie: true }],
  ]

  it.each(
    csrfProtected.flatMap(([name, send]) =>
      csrfFaults.map(([fault, csrf]) => [name, fault, send, csrf] as const),
    ),
  )('refuses %s with 403 when it has %s, and changes nothing', async (_, __, send, csrf) => {
    const { api, jar } = await signedIn(TITOLARE)

    const { response, error } = await send(forgedCsrfClient(jar, csrf))

    expect(response.status).toBe(403)
    expect(error).toStrictEqual({ message: anyString })
    // No session created, switched or closed
    expect(response.headers.getSetCookie()).toEqual([])
    expect((await api.GET('/api/me')).data?.email).toBe(TITOLARE)
    expect((await list(api)).meta.total).toBe(60)
    expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(seeded(ROSSI_001))
  })

  it('keeps the cookies of two test clients apart', async () => {
    const owner = await signedIn(TITOLARE)
    const foreman = await signedIn(CAPOCANTIERE)
    const signedOut = createTestApi()

    expect((await owner.api.GET('/api/me')).data?.email).toBe(TITOLARE)
    expect((await foreman.api.GET('/api/me')).data?.email).toBe(CAPOCANTIERE)
    expect((await signedOut.api.GET('/api/me')).response.status).toBe(401)
  })
})

describe('mock backend: failed login limit', () => {
  const UNKNOWN = 'nessuno@example.test'
  const START = Date.UTC(2026, 10, 2, 9)
  // Five spellings of one email: after trim and lowercase they are the same email
  const spellings = (email: string) => [
    email,
    email.toUpperCase(),
    `  ${email}  `,
    `\t${email}`,
    email.charAt(0).toUpperCase() + email.slice(1),
  ]

  /** Fails `count` times (5 by default) with a wrong password, each answered 422. */
  async function fail(api: Api, email: string, count = 5) {
    for (const spelling of spellings(email).slice(0, count)) {
      expect((await login(api, spelling, 'non-questa')).response.status).toBe(422)
    }
  }

  // Only Date is faked: faking the other timers can hang MSW
  function freezeClockAt(time: number) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(time)
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([TITOLARE, UNKNOWN])(
    'locks %s alone after 5 failed logins: 429 even to the right password, Retry-After 1-60',
    async (email) => {
      const { api } = createTestApi()
      await fail(api, email)

      const { response } = await login(api, email, MOCK_PASSWORD)
      expect(response.status).toBe(429)
      expect(Number(response.headers.get('Retry-After'))).toSatisfy(
        (seconds: number) => Number.isInteger(seconds) && seconds >= 1 && seconds <= 60,
      )
      expect((await api.GET('/api/me')).response.status).toBe(401)
      // Other emails are not locked
      expect((await login(api, 'altro@example.test', 'non-questa')).response.status).toBe(422)
      expect((await login(api, UFFICIO, MOCK_PASSWORD)).response.status).toBe(204)
    },
  )

  it.each([
    [0, 429, '60'],
    [1_000, 429, '59'],
    [59_999, 429, '1'],
    [60_000, 204, null],
  ])(
    '%i ms after the 5th failure, answers the right password with %i and Retry-After %s',
    async (elapsed, status, retryAfter) => {
      freezeClockAt(START)
      const { api } = createTestApi()
      await fail(api, TITOLARE)

      vi.setSystemTime(START + elapsed)
      const { response } = await login(api, TITOLARE, MOCK_PASSWORD)
      expect(response.status).toBe(status)
      expect(response.headers.get('Retry-After')).toBe(retryAfter)
    },
  )

  it('counts from zero once the lock has ended: 5 new failures lock the email again', async () => {
    freezeClockAt(START)
    const { api } = createTestApi()
    await fail(api, TITOLARE)

    vi.setSystemTime(START + 60_000)
    await fail(api, TITOLARE)
    expect((await login(api, TITOLARE, MOCK_PASSWORD)).response.status).toBe(429)
  })

  it('resets the count for that email on a successful login before the 5th failure', async () => {
    const { api } = createTestApi()
    for (let round = 0; round < 2; round += 1) {
      await fail(api, TITOLARE, 4)
      expect((await login(api, TITOLARE, MOCK_PASSWORD)).response.status).toBe(204)
    }
  })

  let failuresLeftBehind = false

  it('leaves a locked email and a partial count behind (first of two tests)', async () => {
    const { api } = createTestApi()
    await fail(api, TITOLARE)
    await fail(api, UFFICIO, 4)
    expect((await login(api, TITOLARE, MOCK_PASSWORD)).response.status).toBe(429)
    failuresLeftBehind = true
  })

  // Must run right after the test above
  it('starts the next test with no failures recorded', async () => {
    expect(failuresLeftBehind).toBe(true)
    const { api } = createTestApi()
    expect((await login(api, TITOLARE, MOCK_PASSWORD)).response.status).toBe(204)
    // With the 4 failures above still counted, this one would lock ufficio
    await fail(api, UFFICIO, 1)
    expect((await login(api, UFFICIO, MOCK_PASSWORD)).response.status).toBe(204)
  })
})

describe('mock backend: companies and permissions', () => {
  const operations: [string, (api: Api, company: string) => Promise<Result>][] = [
    [
      'list',
      (api, company) =>
        api.GET('/api/companies/{company}/clients', { params: { path: { company } } }),
    ],
    ['get', (api, company) => getClientResult(api, company, VERDI_001)],
    ['create', (api, company) => createClient(api, validClient, company)],
    ['update', (api, company) => updateClient(api, VERDI_001, validClient, company)],
  ]

  it.each(operations)(
    'answers 404 to %s for a non-member, with the same body as for a company that does not exist',
    async (_, send) => {
      const { api } = await signedIn(UFFICIO)
      const notMember = await send(api, VERDI)
      const missing = await send(api, 'impresa-inesistente')

      expect(notMember.response.status).toBe(404)
      expect(missing.response.status).toBe(404)
      expect(notMember.error).toStrictEqual({ message: anyString })
      expect(notMember.error).toStrictEqual(missing.error)

      const owner = await signedIn(TITOLARE)
      expect((await list(owner.api, {}, VERDI)).meta.total).toBe(5)
      expect(await getClient(owner.api, VERDI, VERDI_001)).toStrictEqual(seeded(VERDI_001))
    },
  )

  it("answers 404 to get and update of another company's client through the user's company", async () => {
    // The owner belongs to both companies, so only the path keeps the client out of reach
    const { api } = await signedIn(TITOLARE)
    const nonexistent = await getClientResult(api, ROSSI, 'impresa-rossi-999')
    const get = await getClientResult(api, ROSSI, VERDI_001)
    const update = await updateClient(api, VERDI_001, validClient)

    expect(get.response.status).toBe(404)
    expect(update.response.status).toBe(404)
    expect(get.error).toStrictEqual(nonexistent.error)
    expect(update.error).toStrictEqual(nonexistent.error)
    expect(await getClient(api, VERDI, VERDI_001)).toStrictEqual(seeded(VERDI_001))
  })

  it('lets capocantiere list and read, but answers 403 to create and update and changes nothing', async () => {
    const { api } = await signedIn(CAPOCANTIERE)
    expect((await list(api)).meta.total).toBe(60)
    expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(seeded(ROSSI_001))

    const created = await createClient(api, validClient)
    const updated = await updateClient(api, ROSSI_001, validClient)

    expect(created.response.status).toBe(403)
    expect(updated.response.status).toBe(403)
    expect(created.error).toStrictEqual({ message: anyString })
    expect(updated.error).toStrictEqual({ message: anyString })
    expect((await list(api)).meta.total).toBe(60)
    expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(seeded(ROSSI_001))
  })
})

describe('mock backend: client list', () => {
  it('defaults to page 1 of 25 rows sorted by name ascending, with total 60', async () => {
    const { api } = await signedIn(TITOLARE)
    const { data, meta } = await list(api)
    expect(meta).toStrictEqual({ total: 60, page: 1, per_page: 25 })
    expect(data.map((c) => c.name)).toEqual(namesAsc.slice(0, 25))
  })

  it('returns 10 rows on page 3, and empty data past the end with total still 60', async () => {
    const { api } = await signedIn(TITOLARE)
    const third = await list(api, { page: 3 })
    expect(third.data.map((c) => c.name)).toEqual(namesAsc.slice(50))
    expect(third.data).toHaveLength(10)

    const pastTheEnd = await list(api, { page: 4 })
    expect(pastTheEnd.data).toEqual([])
    expect(pastTheEnd.meta.total).toBe(60)
  })

  it.each<[string, number, number]>([
    ['page=2&per_page=10', 2, 10],
    ['per_page=0', 1, 1],
    ['per_page=-5', 1, 1],
    ['per_page=101', 1, 100],
    ['per_page=1000', 1, 100],
    ['page=-5', 1, 25],
    // Not whole integers: back to the defaults
    ...['abc', '10abc', '1.5'].map((value): [string, number, number] => [
      `per_page=${value}`,
      1,
      25,
    ]),
    ...['abc', '2x', '1.5'].map((value): [string, number, number] => [`page=${value}`, 1, 25]),
    ['page=abc&per_page=abc', 1, 25],
  ])('reads %s as page %i with per_page %i', async (query, page, perPage) => {
    const { jar } = await signedIn(TITOLARE)
    const { status, body } = await rawList(jar, query)
    expect(status).toBe(200)
    const { data, meta } = body as ClientList
    expect(meta).toStrictEqual({ total: 60, page, per_page: perPage })
    expect(data.map((c) => c.name)).toEqual(namesAsc.slice((page - 1) * perPage, page * perPage))
  })

  it.each<[NonNullable<ListQuery['sort']>, 'name' | 'id', string[]]>([
    ['name', 'name', namesAsc],
    ['-name', 'name', [...namesAsc].reverse()],
    ['created_at', 'id', idsByCreation],
    ['-created_at', 'id', [...idsByCreation].reverse()],
  ])('orders the rows by sort=%s', async (sort, field, expected) => {
    const { api } = await signedIn(TITOLARE)
    const { data } = await list(api, { sort, per_page: 100 })
    expect(data.map((c) => c[field])).toEqual(expected)
  })

  it('answers 422 on sort to an unknown sort value', async () => {
    const { jar } = await signedIn(TITOLARE)
    const { status, body } = await rawList(jar, 'sort=surname')
    expect(status).toBe(422)
    expect(errorFields(body)).toEqual(['sort'])
  })

  it.each(['person', 'company'] as const)(
    'returns only clients of kind %s, and counts only those in total',
    async (kind) => {
      const { api } = await signedIn(TITOLARE)
      const expected = rossiSeed.filter((c) => c.kind === kind).map((c) => c.id)
      expect(expected.length).toBeGreaterThan(0)
      const { data, meta } = await list(api, { filter: { kind }, per_page: 100 })
      expect(meta.total).toBe(expected.length)
      expect(data.map((c) => c.id).sort()).toEqual(expected.sort())
    },
  )

  it('answers 422 to an unknown kind', async () => {
    const { jar } = await signedIn(TITOLARE)
    const { status, body } = await rawList(jar, 'filter[kind]=ente')
    expect(status).toBe(422)
    expect(errorFields(body).length).toBeGreaterThan(0)
  })

  const rossi004 = seeded('impresa-rossi-004')
  it.each<[string, ListQuery, (c: Client) => boolean]>([
    ['name', { search: 'eDIL' }, (c) => c.name.startsWith('Edil ')],
    ['VAT number', { search: rossi004.vat_number ?? '' }, (c) => c.id === rossi004.id],
    ['tax code', { search: 'ricXYZ80' }, (c) => c.tax_code?.startsWith('RICXYZ80') === true],
    ['city', { search: 'aSTI' }, (c) => c.city === 'Asti'],
    [
      'city, combined with the kind filter',
      { search: 'asti', filter: { kind: 'person' } },
      (c) => c.city === 'Asti' && c.kind === 'person',
    ],
  ])('finds clients by %s, ignoring case', async (_, query, matches) => {
    const { api } = await signedIn(TITOLARE)
    const expected = rossiSeed.filter(matches).map((c) => c.id)
    expect(expected.length).toBeGreaterThan(0)
    const { data, meta } = await list(api, { ...query, per_page: 100 })
    expect(meta.total).toBe(expected.length)
    expect(data.map((c) => c.id).sort()).toEqual(expected.sort())
  })

  it('answers 422 on search when it is over 100 characters after trimming, and accepts 100', async () => {
    const { api } = await signedIn(TITOLARE)
    const send = (search: string) =>
      api.GET('/api/companies/{company}/clients', {
        params: { path: { company: ROSSI }, query: { search } },
      })
    const tooLong = await send(` ${'x'.repeat(101)} `)
    expect(tooLong.response.status).toBe(422)
    expect(errorFields(tooLong.error)).toEqual(['search'])
    expect((await send(`  ${'x'.repeat(100)}  `)).response.status).toBe(200)
  })

  it("returns rows with exactly the contract's Client fields", async () => {
    const { api } = await signedIn(TITOLARE)
    const { data } = await list(api, { per_page: 100 })
    expect(data).toHaveLength(60)
    for (const row of data) expect(Object.keys(row).sort()).toEqual(CLIENT_FIELDS)
  })
})

describe('mock backend: create and update clients', () => {
  it('creates a client with 201: new id, created_at equal to updated_at, text trimmed, blanks as null', async () => {
    const { api } = await signedIn(TITOLARE)
    const { response, data } = await createClient(api, {
      kind: 'company',
      name: '  Nuova Edilizia S.r.l.  ',
      vat_number: ' 09876543210 ',
      tax_code: '',
      email: ' ufficio@nuovaedilizia.example.test ',
      pec: '',
      phone: '\t011 555 9999 ',
      sdi_code: ' XYZ9876',
      street: 'Via Roma 1 ',
      postal_code: ' 10121',
      city: ' Torino ',
      province: ' TO ',
      notes: '   ',
    })

    expect(response.status).toBe(201)
    expect(data).toStrictEqual({
      ...validClient,
      pec: null,
      id: anyString,
      created_at: anyString,
      updated_at: anyString,
    })
    if (!data) throw new Error('the created client came back without a body')
    expect(data.id).not.toBe('')
    expect(rossiSeed.map((c) => c.id)).not.toContain(data.id)
    expect(data.updated_at).toBe(data.created_at)
    expect(Number.isNaN(Date.parse(data.created_at))).toBe(false)

    const all = await list(api, { per_page: 100 })
    expect(all.meta.total).toBe(61)
    expect(all.data).toContainEqual(data)
    expect(await getClient(api, ROSSI, data.id)).toStrictEqual(data)
  })

  it.each(['create', 'update'] as const)(
    'neither stores nor returns unknown fields sent on %s',
    async (operation) => {
      const { api } = await signedIn(TITOLARE)
      const body = {
        ...validClient,
        is_admin: true,
        company: VERDI,
        id: 'scelto-dal-client',
        created_at: '2000-01-01T00:00:00.000Z',
      }
      const { data } =
        operation === 'create'
          ? await createClient(api, body)
          : await updateClient(api, ROSSI_001, body)
      if (!data) throw new Error(`${operation} came back without a body`)

      expect(Object.keys(data).sort()).toEqual(CLIENT_FIELDS)
      expect(data.id).not.toBe(body.id)
      expect(data.created_at).not.toBe(body.created_at)
      expect(Object.keys(await getClient(api, ROSSI, data.id)).sort()).toEqual(CLIENT_FIELDS)
      expect((await list(api, {}, VERDI)).meta.total).toBe(5)
    },
  )

  const takenVat = seeded(ROSSI_001).vat_number ?? ''
  it.each<[string, string, object]>([
    ['an empty name', 'name', { ...validClient, name: '' }],
    ['no name at all', 'name', { ...validClient, name: undefined }],
    ['an unknown kind', 'kind', { ...validClient, kind: 'ente' }],
    ['a company without a VAT number', 'vat_number', { ...validClient, vat_number: null }],
    ['a person without a tax code', 'tax_code', { ...validClient, kind: 'person', tax_code: null }],
    ['a VAT number taken in this company', 'vat_number', { ...validClient, vat_number: takenVat }],
    ['the same, padded with spaces', 'vat_number', { ...validClient, vat_number: ` ${takenVat} ` }],
    ['an email without @', 'email', { ...validClient, email: 'ufficio.example.test' }],
    ['a PEC without @', 'pec', { ...validClient, pec: 'pec.example.test' }],
  ])('answers 422 to a create with %s, with the error on %s only', async (_, field, body) => {
    const { api } = await signedIn(TITOLARE)
    // These bodies break the contract on purpose, as a broken form could
    const { response, error } = await createClient(api, body as ClientInput)
    expect(response.status).toBe(422)
    expect(errorFields(error)).toEqual([field])
    expect((await list(api)).meta.total).toBe(60)
  })

  it('accepts in another company a VAT number already used in this one', async () => {
    const { api } = await signedIn(TITOLARE)
    const { response } = await createClient(api, { ...validClient, vat_number: takenVat }, VERDI)
    expect(response.status).toBe(201)
    expect((await list(api, {}, VERDI)).meta.total).toBe(6)
  })

  // maxLength of each ClientInput field in api/openapi.yaml
  const maxLengths: [Exclude<keyof ClientInput, 'kind'>, number][] = [
    ['name', 200],
    ['vat_number', 20],
    ['tax_code', 16],
    ['phone', 30],
    ['sdi_code', 7],
    ['street', 200],
    ['postal_code', 10],
    ['city', 100],
    ['province', 2],
    ['notes', 2000],
  ]

  it.each(maxLengths)(
    'answers 422 on %s over %i characters, on create and update, and stores nothing',
    async (field, max) => {
      const { api } = await signedIn(TITOLARE)
      const body = { ...validClient, [field]: 'A'.repeat(max + 1) }
      const created = await createClient(api, body)
      const updated = await updateClient(api, ROSSI_001, body)

      expect([created.response.status, updated.response.status]).toEqual([422, 422])
      expect(errorFields(created.error)).toEqual([field])
      expect(errorFields(updated.error)).toEqual([field])
      expect((await list(api)).meta.total).toBe(60)
      expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(seeded(ROSSI_001))
    },
  )

  it.each(maxLengths)(
    'accepts %s of exactly %i characters on create and update',
    async (field, max) => {
      const { api } = await signedIn(TITOLARE)
      const created = await createClient(api, { ...validClient, [field]: 'A'.repeat(max) })
      // Its own VAT number, so it does not clash with the client just created
      const updated = await updateClient(api, ROSSI_001, {
        ...validClient,
        vat_number: takenVat,
        [field]: 'B'.repeat(max),
      })

      expect([created.response.status, updated.response.status]).toEqual([201, 200])
      expect(created.data?.[field]).toBe('A'.repeat(max))
      expect(updated.data?.[field]).toBe('B'.repeat(max))
    },
  )

  it('keeps the duplicate error on a VAT number that is also too long, on create and update', async () => {
    const { api } = await signedIn(TITOLARE)
    const messagesOn = async (result: Promise<Result>) =>
      (((await result).error as ValidationError | undefined)?.errors ?? {}).vat_number ?? []
    const [duplicate] = await messagesOn(
      createClient(api, { ...validClient, vat_number: takenVat }),
    )
    const [tooLong] = await messagesOn(
      createClient(api, { ...validClient, vat_number: 'X'.repeat(21) }),
    )
    expect(duplicate).toBeTruthy()
    expect(tooLong).toBeTruthy()
    expect(duplicate).not.toBe(tooLong)

    // The API refuses VAT numbers over 20 characters, so the older client that has one is
    // put straight into the mock's state; resetDb removes it after the test
    const longVat = 'IT'.padEnd(21, '0')
    db.clients[ROSSI]?.push({ ...seeded('impresa-rossi-002'), id: 'legacy', vat_number: longVat })
    const body = { ...validClient, vat_number: longVat }

    expect(await messagesOn(createClient(api, body))).toContain(duplicate)
    expect(await messagesOn(updateClient(api, ROSSI_001, body))).toContain(duplicate)
  })

  it('replaces every field on update, keeps id and created_at, and changes updated_at', async () => {
    const { api } = await signedIn(TITOLARE)
    const before = seeded(ROSSI_001)
    // Every field differs from the seeded client
    const replacement: ClientInput = {
      kind: 'person',
      name: 'Mario Esposito',
      vat_number: null,
      tax_code: 'SPSMRA80A01L219X',
      email: 'mario.esposito@example.test',
      pec: null,
      phone: '333 000 1111',
      sdi_code: null,
      street: 'Corso Roma 10',
      postal_code: '15121',
      city: 'Alessandria',
      province: 'AL',
      notes: 'Ora è un privato',
    }

    const { response, data } = await updateClient(api, ROSSI_001, replacement)

    expect(response.status).toBe(200)
    expect(data).toStrictEqual({
      ...replacement,
      id: ROSSI_001,
      created_at: before.created_at,
      updated_at: anyString,
    })
    expect(data?.updated_at).not.toBe(before.updated_at)
    expect(Number.isNaN(Date.parse(data?.updated_at ?? ''))).toBe(false)
    expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(data)
  })

  it('accepts an update that keeps the client its own VAT number', async () => {
    const { api } = await signedIn(TITOLARE)
    const { response, data } = await updateClient(api, ROSSI_001, {
      ...validClient,
      vat_number: takenVat,
    })
    expect(response.status).toBe(200)
    expect(data?.vat_number).toBe(takenVat)
  })

  it("answers 422 on vat_number to an update that takes another client's VAT number", async () => {
    const { api } = await signedIn(TITOLARE)
    const otherVat = seeded('impresa-rossi-002').vat_number
    expect(otherVat).toBeTruthy()
    const { response, error } = await updateClient(api, ROSSI_001, {
      ...validClient,
      vat_number: otherVat,
    })
    expect(response.status).toBe(422)
    expect(errorFields(error)).toEqual(['vat_number'])
    expect(await getClient(api, ROSSI, ROSSI_001)).toStrictEqual(seeded(ROSSI_001))
  })
})

describe('mock backend: state between tests', () => {
  let createdId: string | undefined

  it('keeps a created client within the test that created it', async () => {
    const { api } = await signedIn(TITOLARE)
    const { response, data } = await createClient(api, validClient)
    expect(response.status).toBe(201)
    createdId = data?.id
    expect((await list(api)).meta.total).toBe(61)
  })

  // Must run right after the test above
  it('no longer has the client created by the previous test', async () => {
    expect(createdId).toBeDefined()
    const { api } = await signedIn(TITOLARE)
    expect((await getClientResult(api, ROSSI, createdId ?? '')).response.status).toBe(404)
    expect((await list(api)).meta.total).toBe(60)
  })
})
