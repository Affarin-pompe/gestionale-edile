import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'

// Names agreed in the contract (api/openapi.yaml, securitySchemes.csrf)
const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
// The 403 code for a missing, expired or foreign token (contract, Error.code)
const CSRF_INVALID = 'csrf_invalid'
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
  // A copy of each unsafe request as it left, body included, in case it has to go again
  const retries = new WeakMap<Request, Request>()

  /** Asks the backend for a new token. Concurrent callers share one call. */
  async function renewCsrfToken() {
    // The backend answers with the cookie
    pendingCsrf ??= fetchImpl(
      new Request(`${baseUrl}/api/auth/csrf`, { credentials: 'same-origin', headers: ACCEPT_JSON }),
    ).finally(() => {
      pendingCsrf = undefined
    })
    await pendingCsrf
    return readCookie(CSRF_COOKIE)
  }

  async function csrfToken() {
    return readCookie(CSRF_COOKIE) ?? (await renewCsrfToken())
  }

  /**
   * After a 403 csrf_invalid: a new token, then the same request once more. If a request
   * that left at the same time has already renewed the token, that token is used without
   * asking again. Null when there is nothing better to send than the first answer.
   */
  async function retryWithNewToken(request: Request, response: Response) {
    const copy = retries.get(request)
    if (!copy || response.status !== 403 || !(await isCsrfInvalid(response))) return null
    const sent = request.headers.get(CSRF_HEADER) ?? undefined
    const current = readCookie(CSRF_COOKIE)
    let token = current
    if (token === undefined || token === sent) {
      // If the renewal itself fails, the first answer is the one that counts
      token = await renewCsrfToken().catch(() => undefined)
    }
    if (token === undefined || token === sent) return null
    copy.headers.set(CSRF_HEADER, token)
    // Straight to fetch, outside the middleware: a second refusal is the answer
    return fetchImpl(copy)
  }

  const middleware: Middleware = {
    async onRequest({ request }) {
      if (SAFE_METHODS.has(request.method)) return undefined
      // Without a token the request still goes out, and the backend refuses it
      const token = await csrfToken()
      if (token) request.headers.set(CSRF_HEADER, token)
      retries.set(request, request.clone())
      return request
    },
    async onResponse({ request, schemaPath, response }) {
      const retried = await retryWithNewToken(request, response)
      const final = retried ?? response
      // A 401 from login or logout belongs to that page, not to an expired session.
      // schemaPath is the contract path, whatever prefix baseUrl adds.
      if (final.status === 401 && !schemaPath.startsWith('/api/auth/')) {
        options.onUnauthorized?.()
      }
      return retried ?? undefined
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

/** Whether a 403 is the backend refusing the CSRF token, rather than the user's role. */
async function isCsrfInvalid(response: Response) {
  try {
    const body: unknown = await response.clone().json()
    return typeof body === 'object' && body !== null && 'code' in body && body.code === CSRF_INVALID
  } catch {
    return false
  }
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
