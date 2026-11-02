import { http, HttpResponse } from 'msw/http'
import type { components } from '@/api/schema'
import { companies, MOCK_PASSWORD, users } from './data'
import { db } from './db'

type Schemas = components['schemas']
type Client = Schemas['Client']
type ClientInput = Schemas['ClientInput']
type Cookies = Record<string, string>

// Any origin: the browser calls the page's own, tests call http://localhost
const path = (p: string) => `*/api${p}`

const SESSION_COOKIE = 'session'
const CSRF_COOKIE = 'XSRF-TOKEN'
const MAX_FAILED_LOGINS = 5
const LOCK_MS = 60_000
const SORTS = ['name', '-name', 'created_at', '-created_at']
// From the contract (ClientInput): the mock refuses what the backend would refuse
const MAX_LENGTHS: Partial<Record<keyof ClientInput, number>> = {
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
}

const SESSION_EXPIRED = 'Sessione scaduta: accedi di nuovo.'
const BAD_CSRF = 'Token di sicurezza non valido: ricarica la pagina.'
const NOT_FOUND = 'Non trovato, oppure non hai accesso.'
const NOT_ALLOWED = 'Il tuo ruolo non permette questa azione.'

function error(status: number, message: string, headers?: HeadersInit) {
  return HttpResponse.json({ message } satisfies Schemas['Error'], { status, headers })
}

function invalid(errors: Record<string, string[]>) {
  const body: Schemas['ValidationError'] = { message: 'Controlla i dati inseriti.', errors }
  return HttpResponse.json(body, { status: 422 })
}

function csrfCookie() {
  return `${CSRF_COOKIE}=${crypto.randomUUID()}; Path=/; SameSite=Lax`
}

// Simpler than the real backend: the cookie holds the user id, so the session survives page
// reloads in development. Logout cannot revoke it on the server, and the CSRF token is not
// tied to it: those guarantees are the backend's to test. The real cookie is also HttpOnly;
// this one cannot be, because in the browser MSW sets cookies through document.cookie.
function sessionCookies(userId: string | null) {
  const headers = new Headers()
  headers.append(
    'Set-Cookie',
    userId
      ? `${SESSION_COOKIE}=${userId}; Path=/; SameSite=Lax`
      : `${SESSION_COOKIE}=; Path=/; Max-Age=0`,
  )
  // A new session always comes with a new CSRF token
  headers.append('Set-Cookie', csrfCookie())
  return headers
}

function currentUser(cookies: Cookies) {
  return users.find((user) => user.id === cookies[SESSION_COOKIE])
}

function hasValidCsrf(request: Request, cookies: Cookies) {
  const token = cookies[CSRF_COOKIE]
  return token !== undefined && request.headers.get('X-XSRF-TOKEN') === token
}

/**
 * Checks session, CSRF (for requests that change data) and membership, in this order.
 * Returns the user's permissions in the company, or the response that refuses the request.
 */
function guard(request: Request, cookies: Cookies, company: string, changesData: boolean) {
  const user = currentUser(cookies)
  if (!user) return error(401, SESSION_EXPIRED)
  if (changesData && !hasValidCsrf(request, cookies)) return error(403, BAD_CSRF)
  const membership = user.memberships.find((m) => m.company === company)
  // Another company's data looks exactly like data that does not exist
  if (!membership) return error(404, NOT_FOUND)
  return membership.permissions
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

/** Keeps only the contract's fields, like a real backend should, and validates them. */
function parseClient(
  body: Record<string, unknown>,
  others: Client[],
): { input: ClientInput } | { errors: Record<string, string[]> } {
  const text = (key: string) => {
    const value = body[key]
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
  }
  const input: ClientInput = {
    kind: body.kind === 'person' ? 'person' : 'company',
    name: text('name') ?? '',
    vat_number: text('vat_number'),
    tax_code: text('tax_code'),
    email: text('email'),
    pec: text('pec'),
    phone: text('phone'),
    sdi_code: text('sdi_code'),
    street: text('street'),
    postal_code: text('postal_code'),
    city: text('city'),
    province: text('province'),
    notes: text('notes'),
  }
  const errors: Record<string, string[]> = {}
  if (body.kind !== 'company' && body.kind !== 'person') errors.kind = ['Scegli impresa o privato.']
  if (!input.name) errors.name = ['Il nome è obbligatorio.']
  if (body.kind === 'company' && !input.vat_number) {
    errors.vat_number = ['La partita IVA è obbligatoria per le imprese.']
  } else if (input.vat_number && others.some((c) => c.vat_number === input.vat_number)) {
    errors.vat_number = ['Esiste già un cliente con questa partita IVA.']
  }
  if (body.kind === 'person' && !input.tax_code) {
    errors.tax_code = ['Il codice fiscale è obbligatorio per i privati.']
  }
  for (const key of ['email', 'pec'] as const) {
    if (input[key]?.includes('@') === false) errors[key] = ['Indirizzo non valido.']
  }
  for (const [key, max] of Object.entries(MAX_LENGTHS)) {
    const value = input[key as keyof ClientInput]
    if (value && value.length > max) errors[key] ??= [`Al massimo ${max} caratteri.`]
  }
  return Object.keys(errors).length > 0 ? { errors } : { input }
}

// Only whole integers count: "2x" falls back to the default like "abc"
function intParam(value: string | null, fallback: number, max: number) {
  if (value === null || !/^-?\d+$/.test(value)) return fallback
  return Math.min(max, Math.max(1, Number(value)))
}

export const handlers = [
  http.get(path('/auth/csrf'), () => {
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': csrfCookie() } })
  }),

  http.post(path('/auth/login'), async ({ request, cookies }) => {
    if (!hasValidCsrf(request, cookies)) return error(403, BAD_CSRF)
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) {
      return invalid({
        ...(!email && { email: ["Inserisci l'email."] }),
        ...(!password && { password: ['Inserisci la password.'] }),
      })
    }
    // Per email and for one minute, so one locked account does not lock out the others
    const attempts = db.failedLogins.get(email) ?? { count: 0, lockedUntil: 0 }
    const wait = Math.ceil((attempts.lockedUntil - Date.now()) / 1000)
    if (wait > 0) {
      return error(429, 'Troppi tentativi: riprova tra un minuto.', { 'Retry-After': String(wait) })
    }
    const user = users.find((u) => u.email === email)
    if (!user || password !== MOCK_PASSWORD) {
      attempts.count += 1
      if (attempts.count >= MAX_FAILED_LOGINS) {
        attempts.count = 0
        attempts.lockedUntil = Date.now() + LOCK_MS
      }
      db.failedLogins.set(email, attempts)
      // The same answer for an unknown email and a wrong password
      return invalid({ email: ['Email o password non corretti.'] })
    }
    db.failedLogins.delete(email)
    return new HttpResponse(null, { status: 204, headers: sessionCookies(user.id) })
  }),

  http.post(path('/auth/logout'), ({ request, cookies }) => {
    if (!currentUser(cookies)) return error(401, SESSION_EXPIRED)
    if (!hasValidCsrf(request, cookies)) return error(403, BAD_CSRF)
    return new HttpResponse(null, { status: 204, headers: sessionCookies(null) })
  }),

  http.get(path('/me'), ({ cookies }) => {
    const user = currentUser(cookies)
    if (!user) return error(401, SESSION_EXPIRED)
    return HttpResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      companies: user.memberships.map((m) => ({
        slug: m.company,
        name: companies.find((c) => c.slug === m.company)?.name ?? m.company,
        role: m.role,
        permissions: m.permissions,
      })),
    } satisfies Schemas['Me'])
  }),

  http.get(path('/companies/:company/clients'), ({ request, cookies, params }) => {
    const company = String(params.company)
    const permissions = guard(request, cookies, company, false)
    if (permissions instanceof Response) return permissions
    if (!permissions.includes('clients.view')) return error(403, NOT_ALLOWED)

    const query = new URL(request.url).searchParams
    const sort = query.get('sort') ?? 'name'
    const kind = query.get('filter[kind]')
    // Strict like a real backend, so a wrong parameter in the frontend shows up at once
    if (!SORTS.includes(sort)) return invalid({ sort: ['Ordinamento non valido.'] })
    if (kind !== null && kind !== 'company' && kind !== 'person') {
      return invalid({ 'filter.kind': ['Filtro non valido.'] })
    }
    const page = intParam(query.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const perPage = intParam(query.get('per_page'), 25, 100)
    const search = query.get('search')?.trim().toLowerCase() ?? ''
    if (search.length > 100) return invalid({ search: ['Ricerca troppo lunga.'] })
    const field = sort.endsWith('created_at') ? 'created_at' : 'name'
    const direction = sort.startsWith('-') ? -1 : 1

    const rows = (db.clients[company] ?? [])
      .filter((c) => kind === null || c.kind === kind)
      .filter((c) =>
        [c.name, c.vat_number, c.tax_code, c.city].some((v) => v?.toLowerCase().includes(search)),
      )
      .sort((a, b) => direction * a[field].localeCompare(b[field], 'it'))
    return HttpResponse.json({
      data: rows.slice((page - 1) * perPage, page * perPage),
      meta: { total: rows.length, page, per_page: perPage },
    } satisfies Schemas['ClientList'])
  }),

  http.post(path('/companies/:company/clients'), async ({ request, cookies, params }) => {
    const company = String(params.company)
    const permissions = guard(request, cookies, company, true)
    if (permissions instanceof Response) return permissions
    if (!permissions.includes('clients.create')) return error(403, NOT_ALLOWED)

    const clients = (db.clients[company] ??= [])
    const result = parseClient(await readJson(request), clients)
    if ('errors' in result) return invalid(result.errors)
    const now = new Date().toISOString()
    const client: Client = {
      ...result.input,
      id: `${company}-${crypto.randomUUID()}`,
      created_at: now,
      updated_at: now,
    }
    clients.push(client)
    return HttpResponse.json(client, { status: 201 })
  }),

  http.get(path('/companies/:company/clients/:client'), ({ request, cookies, params }) => {
    const company = String(params.company)
    const permissions = guard(request, cookies, company, false)
    if (permissions instanceof Response) return permissions
    const client = db.clients[company]?.find((c) => c.id === params.client)
    // Without the permission a client is as invisible as one from another company
    if (!client || !permissions.includes('clients.view')) return error(404, NOT_FOUND)
    return HttpResponse.json(client)
  }),

  http.put(path('/companies/:company/clients/:client'), async ({ request, cookies, params }) => {
    const company = String(params.company)
    const permissions = guard(request, cookies, company, true)
    if (permissions instanceof Response) return permissions
    const clients = db.clients[company] ?? []
    const index = clients.findIndex((c) => c.id === params.client)
    const current = clients[index]
    if (!current || !permissions.includes('clients.view')) return error(404, NOT_FOUND)
    if (!permissions.includes('clients.update')) return error(403, NOT_ALLOWED)

    const others = clients.filter((c) => c.id !== current.id)
    const result = parseClient(await readJson(request), others)
    if ('errors' in result) return invalid(result.errors)
    const updated: Client = {
      ...result.input,
      id: current.id,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    }
    clients[index] = updated
    return HttpResponse.json(updated)
  }),
]
