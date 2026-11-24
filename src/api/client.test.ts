import type { Client } from 'openapi-fetch'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import type { components, operations } from './schema'

const BASE_URL = 'http://localhost'
const COMPANY = 'impresa-rossi'
const CLIENT_ID = '0b8f6a52-3c1e-4d7a-9f20-6f1b2c3d4e5f'
const CSRF_PATH = '/api/auth/csrf'
const COOKIE = 'XSRF-TOKEN'
const HEADER = 'X-XSRF-TOKEN'

type ApiClient = ReturnType<typeof createApiClient>

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

// The contract has no PATCH or DELETE operation yet. To send those methods through the
// client's middleware, the client is viewed through a test-only path that has them.
interface TestOnlyPaths {
  '/api/test-only': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never }
    get?: never
    put?: never
    post?: never
    delete: operations['logout']
    options?: never
    head?: never
    patch: operations['logout']
    trace?: never
  }
}

function withPatchAndDelete(client: ApiClient) {
  return client as unknown as Client<TestOnlyPaths>
}

/** Answers one request. The jar is what readCookie sees, so a handler can "set" a cookie. */
type Handler = (request: Request, jar: Map<string, string>) => Response | Promise<Response>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathOf(request: Request): string {
  return new URL(request.url).pathname
}

function isCsrfCall(request: Request): boolean {
  return pathOf(request) === CSRF_PATH
}

function describeRequests(requests: Request[]): string[] {
  return requests.map((request) => `${request.method} ${pathOf(request)}`)
}

// The usual backend: /api/auth/csrf sets the cookie, everything else succeeds
const backend: Handler = (request, jar) => {
  if (isCsrfCall(request)) {
    jar.set(COOKIE, 'fresh-token')
    return new Response(null, { status: 204 })
  }
  return json({ message: 'ok' })
}

function setup(
  options: { cookies?: Record<string, string>; handler?: Handler; baseUrl?: string } = {},
) {
  const jar = new Map(Object.entries(options.cookies ?? {}))
  const handler = options.handler ?? backend
  const requests: Request[] = []
  const onUnauthorized = vi.fn()
  const client = createApiClient({
    baseUrl: options.baseUrl ?? BASE_URL,
    fetch: (request) => {
      requests.push(request)
      return Promise.resolve(handler(request, jar))
    },
    readCookie: (name) => jar.get(name),
    onUnauthorized,
  })
  return { client, requests, onUnauthorized }
}

function onlyRequest(requests: Request[]): Request {
  expect(describeRequests(requests)).toHaveLength(1)
  const [request] = requests
  if (!request) throw new Error('no request was sent')
  return request
}

function createClientRequest(client: ApiClient) {
  return client.POST('/api/companies/{company}/clients', {
    params: { path: { company: COMPANY } },
    body: clientInput,
  })
}

function updateClientRequest(client: ApiClient) {
  return client.PUT('/api/companies/{company}/clients/{client}', {
    params: { path: { company: COMPANY, client: CLIENT_ID }, header: { 'If-Match': '"1"' } },
    body: clientInput,
  })
}

const unsafeRequests: [string, (client: ApiClient) => Promise<unknown>][] = [
  ['POST', createClientRequest],
  ['PUT', updateClientRequest],
  ['PATCH', (client) => withPatchAndDelete(client).PATCH('/api/test-only')],
  ['DELETE', (client) => withPatchAndDelete(client).DELETE('/api/test-only')],
]

describe('createApiClient: CSRF token', () => {
  it('sends no X-XSRF-TOKEN on a GET, even when the cookie exists', async () => {
    const { client, requests } = setup({ cookies: { [COOKIE]: 'token-123' } })

    await client.GET('/api/me')

    const request = onlyRequest(requests)
    expect(request.method).toBe('GET')
    expect(request.headers.has(HEADER)).toBe(false)
  })

  it('never calls /api/auth/csrf for a GET, even when the cookie is missing', async () => {
    const { client, requests } = setup()

    await client.GET('/api/me')
    await client.GET('/api/companies/{company}/clients', { params: { path: { company: COMPANY } } })

    expect(describeRequests(requests)).toEqual([
      'GET /api/me',
      `GET /api/companies/${COMPANY}/clients`,
    ])
    expect(requests.map((request) => request.headers.has(HEADER))).toEqual([false, false])
  })

  it.each(unsafeRequests)(
    'sends X-XSRF-TOKEN equal to the XSRF-TOKEN cookie on %s',
    async (method, send) => {
      const { client, requests } = setup({
        cookies: { [COOKIE]: 'token-123', 'OTHER-TOKEN': 'not-this-one' },
      })

      await send(client)

      const request = onlyRequest(requests)
      expect(request.method).toBe(method)
      expect(request.headers.get(HEADER)).toBe('token-123')
    },
  )

  it.each([BASE_URL, 'https://gestionale.example.test:8443'])(
    'calls GET %s/api/auth/csrf once when the cookie is missing, then sends the token it set',
    async (baseUrl) => {
      const { client, requests } = setup({ baseUrl })

      await createClientRequest(client)

      expect(describeRequests(requests)).toEqual([
        'GET /api/auth/csrf',
        `POST /api/companies/${COMPANY}/clients`,
      ])
      const [csrf, post] = requests
      expect(csrf?.url).toBe(`${baseUrl}/api/auth/csrf`)
      expect(post?.headers.get(HEADER)).toBe('fresh-token')
    },
  )

  it('does not call /api/auth/csrf again once the cookie is set', async () => {
    const { client, requests } = setup()

    await createClientRequest(client)
    await updateClientRequest(client)

    expect(describeRequests(requests)).toEqual([
      'GET /api/auth/csrf',
      `POST /api/companies/${COMPANY}/clients`,
      `PUT /api/companies/${COMPANY}/clients/${CLIENT_ID}`,
    ])
    expect(requests[2]?.headers.get(HEADER)).toBe('fresh-token')
  })

  it('makes one /api/auth/csrf call for two unsafe requests started together, and both carry the token', async () => {
    let answerCsrf = () => {}
    const csrfAnswered = new Promise<void>((resolve) => {
      answerCsrf = resolve
    })
    const { client, requests } = setup({
      handler: async (request, jar) => {
        if (isCsrfCall(request)) {
          // The cookie arrives only with the response, as in a browser
          await csrfAnswered
          jar.set(COOKIE, 'fresh-token')
          return new Response(null, { status: 204 })
        }
        return json({ message: 'ok' })
      },
    })

    const first = createClientRequest(client)
    const second = updateClientRequest(client)
    // Give both requests time to reach the point where they wait for the token
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(requests.filter(isCsrfCall)).toHaveLength(1)
    answerCsrf()
    await Promise.all([first, second])

    expect(requests.filter(isCsrfCall)).toHaveLength(1)
    const unsafe = requests.filter((request) => !isCsrfCall(request))
    expect(unsafe.map((request) => request.method).sort()).toEqual(['POST', 'PUT'])
    expect(unsafe.map((request) => request.headers.get(HEADER))).toEqual([
      'fresh-token',
      'fresh-token',
    ])
  })

  it.each([
    ['answers 204 without setting the cookie', () => new Response(null, { status: 204 })],
    ['answers 500', () => json({ message: 'Errore interno' }, 500)],
  ])(
    'sends the request anyway, without X-XSRF-TOKEN, when /api/auth/csrf %s',
    async (_, csrfAnswer) => {
      const { client, requests } = setup({
        handler: (request) => (isCsrfCall(request) ? csrfAnswer() : json({ message: 'ok' })),
      })

      await createClientRequest(client)

      expect(describeRequests(requests)).toEqual([
        'GET /api/auth/csrf',
        `POST /api/companies/${COMPANY}/clients`,
      ])
      expect(requests[1]?.headers.has(HEADER)).toBe(false)
    },
  )
})

describe('createApiClient: CSRF token renewal', () => {
  const STALE = 'stale-token'
  const FRESH = 'fresh-token'
  const CREATE = `POST /api/companies/${COMPANY}/clients`
  const UPDATE = `PUT /api/companies/${COMPANY}/clients/${CLIENT_ID}`
  const RENEW = `GET ${CSRF_PATH}`

  function csrfInvalid() {
    return json({ message: 'Token di sicurezza non valido', code: 'csrf_invalid' }, 403)
  }

  function setCsrfCookie(jar: Map<string, string>, token = FRESH) {
    jar.set(COOKIE, token)
    return new Response(null, { status: 204 })
  }

  // A backend that has moved on to FRESH: any other token, or none, is csrf_invalid
  const rotated: Handler = (request, jar) => {
    if (isCsrfCall(request)) return setCsrfCookie(jar)
    if (request.headers.get(HEADER) !== FRESH) return csrfInvalid()
    return json({ message: 'ok' })
  }

  it.each(unsafeRequests)(
    'after a 403 csrf_invalid on %s, calls /api/auth/csrf and sends the request once more with the new token',
    async (method, send) => {
      const { client, requests, onUnauthorized } = setup({
        cookies: { [COOKIE]: STALE },
        handler: rotated,
      })

      const { response } = (await send(client)) as { response: Response }

      const sent = `${method} ${pathOf(requests[0] ?? new Request(BASE_URL))}`
      expect(describeRequests(requests)).toEqual([sent, RENEW, sent])
      expect(requests.map((request) => request.headers.get(HEADER))).toEqual([STALE, null, FRESH])
      expect(response.status).toBe(200)
      expect(onUnauthorized).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['POST', createClientRequest],
    ['PUT', updateClientRequest],
  ] as const)('sends the same body and headers again on the retried %s', async (_, send) => {
    const { client, requests } = setup({ cookies: { [COOKIE]: STALE }, handler: rotated })

    const { data, response } = await send(client)

    expect(response.status).toBe(200)
    expect(data).toEqual({ message: 'ok' })
    const [first, , retry] = requests
    if (!first || !retry) throw new Error('the request was not sent twice')
    const firstBody: unknown = await first.clone().json()
    const retryBody: unknown = await retry.clone().json()
    expect(firstBody).toEqual(clientInput)
    expect(retryBody).toEqual(firstBody)
    for (const header of ['Content-Type', 'If-Match', 'Accept']) {
      expect(retry.headers.get(header)).toBe(first.headers.get(header))
    }
    expect(retry.headers.get('Accept')).toBe('application/json')
  })

  it('sends the body again even when the backend read it before refusing the request', async () => {
    const bodies: unknown[] = []
    const { client } = setup({
      cookies: { [COOKIE]: STALE },
      handler: async (request, jar) => {
        if (!isCsrfCall(request)) {
          const body: unknown = await request.json()
          bodies.push(body)
        }
        return rotated(request, jar)
      },
    })

    const { response } = await createClientRequest(client)

    expect(response.status).toBe(200)
    expect(bodies).toEqual([clientInput, clientInput])
  })

  it('gives the caller the response to the retry, not the 403', async () => {
    const answers: Response[] = []
    const { client } = setup({
      cookies: { [COOKIE]: STALE },
      handler: async (request, jar) => {
        const answer = await rotated(request, jar)
        if (!isCsrfCall(request)) answers.push(answer)
        return answer
      },
    })

    const { data, error, response } = await createClientRequest(client)

    expect(answers.map((answer) => answer.status)).toEqual([403, 200])
    expect(response).toBe(answers[1])
    expect(data).toEqual({ message: 'ok' })
    expect(error).toBeUndefined()
  })

  it.each([
    ['403 csrf_invalid again', csrfInvalid],
    ['422', () => json({ message: 'Controlla i dati', errors: { name: ['Obbligatorio'] } }, 422)],
    ['500', () => json({ message: 'Errore interno' }, 500)],
  ])(
    'returns the answer to the retry when it is %s, with no third attempt and no second renewal',
    async (_, secondAnswer) => {
      const answers: Response[] = []
      let renewals = 0
      const { client, requests } = setup({
        cookies: { [COOKIE]: STALE },
        handler: (request, jar) => {
          if (isCsrfCall(request)) {
            renewals += 1
            return setCsrfCookie(jar, `token-${String(renewals)}`)
          }
          const answer = answers.length === 0 ? csrfInvalid() : secondAnswer()
          answers.push(answer)
          return answer
        },
      })

      const { response, error } = await createClientRequest(client)

      expect(describeRequests(requests)).toEqual([CREATE, RENEW, CREATE])
      expect(requests.map((request) => request.headers.get(HEADER))).toEqual([
        STALE,
        null,
        'token-1',
      ])
      expect(response).toBe(answers[1])
      expect(error).toEqual(await secondAnswer().json())
    },
  )

  it.each<[string, () => Response]>([
    [
      'a { message } body without code (the role is not allowed)',
      () => json({ message: 'Il tuo ruolo non permette questa azione.' }, 403),
    ],
    ['another code', () => json({ message: 'Vietato', code: 'forbidden' }, 403)],
    [
      'an HTML body',
      () =>
        new Response('<h1>403 csrf_invalid</h1>', {
          status: 403,
          headers: { 'Content-Type': 'text/html' },
        }),
    ],
    ['a JSON string instead of an object', () => json('csrf_invalid', 403)],
    ['an empty body', () => new Response(null, { status: 403 })],
  ])('neither renews the token nor retries after a 403 with %s', async (_, forbidden) => {
    const answers: Response[] = []
    const { client, requests } = setup({
      cookies: { [COOKIE]: STALE },
      handler: (request, jar) => {
        if (isCsrfCall(request)) return setCsrfCookie(jar)
        const answer = forbidden()
        answers.push(answer)
        return answer
      },
    })

    const { response } = await createClientRequest(client)

    expect(describeRequests(requests)).toEqual([CREATE])
    expect(response).toBe(answers[0])
    expect(response.status).toBe(403)
  })

  it('never retries a GET, even after a 403 csrf_invalid', async () => {
    const { client, requests } = setup({ cookies: { [COOKIE]: STALE }, handler: rotated })

    const { response, error } = await client.GET('/api/me')

    expect(pathOf(onlyRequest(requests))).toBe('/api/me')
    expect(response.status).toBe(403)
    expect(error).toMatchObject({ code: 'csrf_invalid' })
  })

  it('makes one /api/auth/csrf call for two requests refused together, and retries both with the new token', async () => {
    let answerCsrf = () => {}
    const csrfAnswered = new Promise<void>((resolve) => {
      answerCsrf = resolve
    })
    const { client, requests } = setup({
      cookies: { [COOKIE]: STALE },
      handler: async (request, jar) => {
        // The cookie arrives only with the response, as in a browser
        if (isCsrfCall(request)) await csrfAnswered
        return rotated(request, jar)
      },
    })

    const first = createClientRequest(client)
    const second = updateClientRequest(client)
    // Give both refusals time to reach the renewal
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(describeRequests(requests).sort()).toEqual([RENEW, CREATE, UPDATE].sort())
    answerCsrf()
    const results = await Promise.all([first, second])

    expect(requests.filter(isCsrfCall)).toHaveLength(1)
    expect(
      requests
        .filter((request) => !isCsrfCall(request))
        .map((request) => `${request.method} ${String(request.headers.get(HEADER))}`)
        .sort(),
    ).toEqual([`POST ${FRESH}`, `POST ${STALE}`, `PUT ${FRESH}`, `PUT ${STALE}`])
    expect(results.map((result) => result.response.status)).toEqual([200, 200])
  })

  it('retries a request refused after another one renewed the token with that token, without renewing again', async () => {
    let answerUpdate = () => {}
    const updateAnswered = new Promise<void>((resolve) => {
      answerUpdate = resolve
    })
    const { client, requests } = setup({
      cookies: { [COOKIE]: STALE },
      handler: async (request, jar) => {
        // The refusal of the PUT is late: it arrives once the POST is done
        if (request.method === 'PUT' && request.headers.get(HEADER) === STALE) await updateAnswered
        return rotated(request, jar)
      },
    })

    const update = updateClientRequest(client)
    const created = await createClientRequest(client)
    expect(created.response.status).toBe(200)
    expect(requests.filter(isCsrfCall)).toHaveLength(1)
    answerUpdate()
    const updated = await update

    expect(updated.response.status).toBe(200)
    expect(describeRequests(requests)).toEqual([UPDATE, CREATE, RENEW, CREATE, UPDATE])
    expect(requests.map((request) => request.headers.get(HEADER))).toEqual([
      STALE,
      STALE,
      null,
      FRESH,
      FRESH,
    ])
  })

  it('renews again for a later refusal, once the first renewal is over', async () => {
    let accepted = 'none-yet'
    let renewals = 0
    const { client, requests } = setup({
      cookies: { [COOKIE]: STALE },
      handler: (request, jar) => {
        if (isCsrfCall(request)) {
          renewals += 1
          accepted = `token-${String(renewals)}`
          return setCsrfCookie(jar, accepted)
        }
        return request.headers.get(HEADER) === accepted ? json({ message: 'ok' }) : csrfInvalid()
      },
    })

    expect((await createClientRequest(client)).response.status).toBe(200)
    // The backend stops accepting token-1, as when it expires
    accepted = 'expired'
    expect((await updateClientRequest(client)).response.status).toBe(200)

    expect(describeRequests(requests)).toEqual([CREATE, RENEW, CREATE, UPDATE, RENEW, UPDATE])
    expect(requests.map((request) => request.headers.get(HEADER))).toEqual([
      STALE,
      null,
      'token-1',
      'token-1',
      null,
      'token-2',
    ])
  })

  it.each<[string, Handler]>([
    ['answers 204 without setting the cookie', () => new Response(null, { status: 204 })],
    ['answers 500', () => json({ message: 'Errore interno' }, 500)],
    ['fails with a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('returns the first 403 when /api/auth/csrf %s', async (_, csrfAnswer) => {
    const refusals: Response[] = []
    const { client, requests } = setup({
      cookies: { [COOKIE]: STALE },
      handler: (request, jar) => {
        if (isCsrfCall(request)) return csrfAnswer(request, jar)
        const refusal = csrfInvalid()
        refusals.push(refusal)
        return refusal
      },
    })

    const { response, error } = await createClientRequest(client)

    expect(describeRequests(requests)).toEqual([CREATE, RENEW])
    expect(response).toBe(refusals[0])
    expect(error).toEqual({ message: 'Token di sicurezza non valido', code: 'csrf_invalid' })
  })

  it('calls onUnauthorized once when the retry answers 401 outside /api/auth/', async () => {
    const { client, requests, onUnauthorized } = setup({
      cookies: { [COOKIE]: STALE },
      handler: (request, jar) => {
        if (isCsrfCall(request)) return setCsrfCookie(jar)
        if (request.headers.get(HEADER) !== FRESH) return csrfInvalid()
        return json({ message: 'Sessione scaduta' }, 401)
      },
    })

    const { response, error } = await createClientRequest(client)

    expect(describeRequests(requests)).toEqual([CREATE, RENEW, CREATE])
    expect(response.status).toBe(401)
    expect(error).toEqual({ message: 'Sessione scaduta' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not call onUnauthorized when the retried logout answers 401', async () => {
    const { client, requests, onUnauthorized } = setup({
      cookies: { [COOKIE]: STALE },
      handler: (request, jar) => {
        if (isCsrfCall(request)) return setCsrfCookie(jar)
        if (request.headers.get(HEADER) !== FRESH) return csrfInvalid()
        return json({ message: 'Non autenticato' }, 401)
      },
    })

    const { response } = await client.POST('/api/auth/logout')

    expect(describeRequests(requests)).toEqual([
      'POST /api/auth/logout',
      RENEW,
      'POST /api/auth/logout',
    ])
    expect(response.status).toBe(401)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('createApiClient: 401 handling', () => {
  it('calls onUnauthorized once on a 401 outside /api/auth/ and still returns that 401', async () => {
    const unauthorized = json({ message: 'Sessione scaduta' }, 401)
    const { client, onUnauthorized } = setup({
      cookies: { [COOKIE]: 'token-123' },
      handler: () => unauthorized,
    })

    const result = await client.GET('/api/me')

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(result.response).toBe(unauthorized)
    expect(result.response.status).toBe(401)
    expect(result.error).toEqual({ message: 'Sessione scaduta' })
    expect(result.data).toBeUndefined()
  })

  it('calls onUnauthorized once on a 401 from an unsafe request that first called /api/auth/csrf', async () => {
    const { client, onUnauthorized } = setup({
      handler: (request, jar) => {
        if (isCsrfCall(request)) {
          jar.set(COOKIE, 'fresh-token')
          return new Response(null, { status: 204 })
        }
        return json({ message: 'Sessione scaduta' }, 401)
      },
    })

    const result = await createClientRequest(client)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(result.response.status).toBe(401)
    expect(result.error).toEqual({ message: 'Sessione scaduta' })
  })

  it('calls onUnauthorized once for each 401 response', async () => {
    const { client, onUnauthorized } = setup({
      cookies: { [COOKIE]: 'token-123' },
      handler: () => json({ message: 'Sessione scaduta' }, 401),
    })

    await client.GET('/api/me')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    await client.GET('/api/companies/{company}/clients', { params: { path: { company: COMPANY } } })
    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })

  it.each([
    [
      '/api/auth/login',
      (client: ApiClient) =>
        client.POST('/api/auth/login', {
          body: { email: 'mario@example.test', password: 'not-the-right-one' },
        }),
    ],
    ['/api/auth/logout', (client: ApiClient) => client.POST('/api/auth/logout')],
  ])('does not call onUnauthorized on a 401 from %s', async (path, send) => {
    const { client, requests, onUnauthorized } = setup({
      cookies: { [COOKIE]: 'token-123' },
      handler: () => json({ message: 'Non autenticato' }, 401),
    })

    const result = await send(client)

    expect(pathOf(onlyRequest(requests))).toBe(path)
    expect(result.response.status).toBe(401)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it.each([
    [
      '/api/auth/login',
      (client: ApiClient) =>
        client.POST('/api/auth/login', {
          body: { email: 'mario@example.test', password: 'not-the-right-one' },
        }),
    ],
    ['/api/auth/logout', (client: ApiClient) => client.POST('/api/auth/logout')],
  ])(
    'with a baseUrl under a path, ignores a 401 from %s but still reports one from /api/me',
    async (path, send) => {
      const baseUrl = 'http://localhost/gestionale'
      const { client, requests, onUnauthorized } = setup({
        baseUrl,
        cookies: { [COOKIE]: 'token-123' },
        handler: () => json({ message: 'Non autenticato' }, 401),
      })

      const result = await send(client)
      expect(result.response.status).toBe(401)
      expect(onUnauthorized).not.toHaveBeenCalled()

      await client.GET('/api/me')
      expect(onUnauthorized).toHaveBeenCalledTimes(1)

      expect(requests.map((request) => request.url)).toEqual([
        `${baseUrl}${path}`,
        `${baseUrl}/api/me`,
      ])
    },
  )

  it.each([200, 403, 404, 422, 500])('does not call onUnauthorized on a %i', async (status) => {
    const { client, onUnauthorized } = setup({
      cookies: { [COOKIE]: 'token-123' },
      handler: () => json({ message: 'Risposta' }, status),
    })

    const read = await client.GET('/api/me')
    const write = await createClientRequest(client)

    expect(read.response.status).toBe(status)
    expect(write.response.status).toBe(status)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('createApiClient: URL and headers', () => {
  it('sends a request to baseUrl + path, with the company slug and the query serialized', async () => {
    const { client, requests } = setup()

    await client.GET('/api/companies/{company}/clients', {
      params: {
        path: { company: COMPANY },
        query: { filter: { kind: 'company' }, page: 2 },
      },
    })

    expect(onlyRequest(requests).url).toBe(
      `${BASE_URL}/api/companies/impresa-rossi/clients?filter[kind]=company&page=2`,
    )
  })

  it('uses the baseUrl it is given', async () => {
    const baseUrl = 'https://gestionale.example.test:8443'
    const { client, requests } = setup({ baseUrl })

    await client.GET('/api/companies/{company}/clients/{client}', {
      params: { path: { company: COMPANY, client: CLIENT_ID } },
    })

    expect(onlyRequest(requests).url).toBe(
      `${baseUrl}/api/companies/${COMPANY}/clients/${CLIENT_ID}`,
    )
  })

  it('with a trailing slash in baseUrl, sends the CSRF call and client requests without a double slash', async () => {
    const { client, requests } = setup({ baseUrl: 'http://localhost/' })

    await createClientRequest(client)
    await client.GET('/api/me')

    expect(requests.map((request) => request.url)).toEqual([
      'http://localhost/api/auth/csrf',
      `http://localhost/api/companies/${COMPANY}/clients`,
      'http://localhost/api/me',
    ])
  })

  it('sends Accept: application/json on every request made through the client', async () => {
    const { client, requests } = setup({ cookies: { [COOKIE]: 'token-123' } })

    await client.GET('/api/me')
    await createClientRequest(client)
    await updateClientRequest(client)
    await client.POST('/api/auth/logout')

    expect(requests.map((request) => request.headers.get('Accept'))).toEqual([
      'application/json',
      'application/json',
      'application/json',
      'application/json',
    ])
  })

  it('sends Accept: application/json on the /api/auth/csrf call too', async () => {
    const { client, requests } = setup()

    await createClientRequest(client)

    expect(
      requests.map((request) => [
        `${request.method} ${pathOf(request)}`,
        request.headers.get('Accept'),
      ]),
    ).toEqual([
      ['GET /api/auth/csrf', 'application/json'],
      [`POST /api/companies/${COMPANY}/clients`, 'application/json'],
    ])
  })
})

describe('createApiClient: cookie from document.cookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setupWithDocument(cookie: string, csrfCookie?: string) {
    const fakeDocument = { cookie }
    vi.stubGlobal('document', fakeDocument)
    const requests: Request[] = []
    const client = createApiClient({
      baseUrl: BASE_URL,
      fetch: (request) => {
        requests.push(request)
        if (isCsrfCall(request)) {
          if (csrfCookie !== undefined) fakeDocument.cookie = csrfCookie
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        return Promise.resolve(json({ message: 'ok' }, 201))
      },
    })
    return { client, requests }
  }

  it('reads XSRF-TOKEN from document.cookie when no readCookie is given', async () => {
    const { client, requests } = setupWithDocument(
      'theme=dark; OLD-XSRF-TOKEN=stale; XSRF-TOKEN=token-123; lang=it',
    )

    await createClientRequest(client)

    expect(onlyRequest(requests).headers.get(HEADER)).toBe('token-123')
  })

  it('sends a URL-encoded cookie value decoded', async () => {
    const { client, requests } = setupWithDocument('XSRF-TOKEN=abc%3D%3D')

    await createClientRequest(client)

    expect(onlyRequest(requests).headers.get(HEADER)).toBe('abc==')
  })

  it('sends a malformed encoding as it is, without throwing', async () => {
    const { client, requests } = setupWithDocument('XSRF-TOKEN=%E0%A4%A')

    await expect(createClientRequest(client)).resolves.toBeDefined()

    expect(onlyRequest(requests).headers.get(HEADER)).toBe('%E0%A4%A')
  })

  it('reads document.cookie again after /api/auth/csrf has set it', async () => {
    const { client, requests } = setupWithDocument(
      'theme=dark',
      'theme=dark; XSRF-TOKEN=fresh%2Btoken',
    )

    await createClientRequest(client)

    expect(describeRequests(requests)).toEqual([
      'GET /api/auth/csrf',
      `POST /api/companies/${COMPANY}/clients`,
    ])
    expect(requests[1]?.headers.get(HEADER)).toBe('fresh+token')
  })
})
