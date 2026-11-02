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
    params: { path: { company: COMPANY, client: CLIENT_ID } },
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
