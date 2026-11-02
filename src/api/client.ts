import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'

// Names agreed in the contract (api/openapi.yaml, securitySchemes.csrf)
const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
// Some backends pick the error format from Accept and answer HTML without it
const ACCEPT_JSON = { Accept: 'application/json' }

export interface ApiClientOptions {
  /** Defaults to the page's origin: the session cookie only works on the same domain. */
  baseUrl?: string
  /** Defaults to the global fetch, looked up at call time so test interceptors can replace it. */
  fetch?: (request: Request) => Promise<Response>
  /** Defaults to document.cookie; tests inject their own. */
  readCookie?: (name: string) => string | undefined
  /** Called on a 401 outside /api/auth/: the session is gone and the app returns to the login page. */
  onUnauthorized?: () => void
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (
    options.baseUrl ?? (typeof location === 'undefined' ? '' : location.origin)
  ).replace(/\/$/, '')
  const fetchImpl = options.fetch ?? ((request: Request) => globalThis.fetch(request))
  const readCookie = options.readCookie ?? readDocumentCookie
  let pendingCsrf: Promise<unknown> | undefined

  async function csrfToken() {
    const token = readCookie(CSRF_COOKIE)
    if (token) return token
    // Concurrent requests share one call; the backend answers with the cookie
    pendingCsrf ??= fetchImpl(
      new Request(`${baseUrl}/api/auth/csrf`, { credentials: 'same-origin', headers: ACCEPT_JSON }),
    ).finally(() => {
      pendingCsrf = undefined
    })
    await pendingCsrf
    return readCookie(CSRF_COOKIE)
  }

  const middleware: Middleware = {
    async onRequest({ request }) {
      if (SAFE_METHODS.has(request.method)) return undefined
      // Without a token the request still goes out, and the backend refuses it
      const token = await csrfToken()
      if (token) request.headers.set(CSRF_HEADER, token)
      return request
    },
    onResponse({ schemaPath, response }) {
      // A 401 from login or logout belongs to that page, not to an expired session.
      // schemaPath is the contract path, whatever prefix baseUrl adds.
      if (response.status === 401 && !schemaPath.startsWith('/api/auth/')) {
        options.onUnauthorized?.()
      }
      return undefined
    },
  }

  const client = createClient<paths>({
    baseUrl,
    fetch: fetchImpl,
    credentials: 'same-origin',
    headers: ACCEPT_JSON,
  })
  client.use(middleware)
  return client
}

function readDocumentCookie(name: string) {
  if (typeof document === 'undefined') return undefined
  const prefix = `${name}=`
  const value = document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
  if (value === undefined) return undefined
  // Some backends URL-encode the token in the cookie and expect it decoded in the header
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

let unauthorizedHandler = () => {}

/** The router registers here where a 401 leads, once it exists. */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

/** The client the whole app uses. */
export const api = createApiClient({ onUnauthorized: () => unauthorizedHandler() })
