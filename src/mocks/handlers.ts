import { http, HttpResponse } from 'msw/http'
import type { components } from '@/api/schema'
import { companies, MOCK_PASSWORD, users } from './data'
import { db } from './db'

type Schemas = components['schemas']
type Client = Schemas['Client']
type ClientInput = Schemas['ClientInput']
type ClientKind = Schemas['ClientKind']
type Cookies = Record<string, string>

// Any origin: the browser calls the page's own, tests call http://localhost
const path = (p: string) => `*/api${p}`

const SESSION_COOKIE = 'session'
const CSRF_COOKIE = 'XSRF-TOKEN'
const MAX_FAILED_LOGINS = 5
const LOCK_MS = 60_000
const SORTS = ['name', '-name', 'created_at', '-created_at']
const KINDS: readonly string[] = ['company', 'person', 'public_body'] satisfies ClientKind[]
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
const STALE =
  'Il cliente è stato modificato da qualcun altro. Ricarica la scheda per vedere le modifiche.'
const NO_VERSION = 'Manca la versione del cliente: ricarica la scheda e riprova.'
const HAS_DOCUMENTS = 'Il cliente ha documenti collegati e non si può eliminare: puoi archiviarlo.'

function error(status: number, message: string, headers?: HeadersInit, code?: string) {
  return HttpResponse.json({ message, ...(code && { code }) } satisfies Schemas['Error'], {
    status,
    headers,
  })
}

function etagOf(client: Client) {
  return `"${db.clientVersions.get(client.id) ?? 1}"`
}

/** The client with its version in the ETag header, as the backend sends it. */
function clientResponse(client: Client, status = 200) {
  return HttpResponse.json(client, { status, headers: { ETag: etagOf(client) } })
}

/** Saves a change: the client gets the next version. */
function bumpVersion(client: Client) {
  db.clientVersions.set(client.id, (db.clientVersions.get(client.id) ?? 1) + 1)
}

/** 428 without If-Match, 412 when it is not the current version; null when it matches. */
function checkVersion(request: Request, client: Client) {
  const ifMatch = request.headers.get('If-Match')
  if (!ifMatch) return error(428, NO_VERSION, undefined, 'precondition_required')
  if (ifMatch !== etagOf(client)) return error(412, STALE, undefined, 'stale_record')
  return null
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
  const kind = KINDS.includes(String(body.kind)) ? (body.kind as ClientKind) : 'company'
  const country = text('country')?.toUpperCase() ?? null
  const input: ClientInput = {
    kind,
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
    country: country ?? '',
    notes: text('notes'),
  }
  const errors: Record<string, string[]> = {}
  if (!KINDS.includes(String(body.kind))) errors.kind = ['Tipo di cliente non valido.']
  if (!input.name) errors.name = ['Il nome è obbligatorio.']
  if (!('country' in body)) errors.country = ['Campo mancante.']
  else if (!country) errors.country = ['Il paese è obbligatorio.']
  else if (!/^[A-Z]{2}$/.test(country)) {
    errors.country = ['Usa il codice di due lettere del paese, ad esempio IT.']
  }
  // The tax ids are required only for Italian clients
  const italian = country === 'IT'
  if (italian && kind !== 'person' && !input.vat_number && !input.tax_code) {
    errors.vat_number = ['Indica la partita IVA o il codice fiscale.']
  } else if (input.vat_number && others.some((c) => c.vat_number === input.vat_number)) {
    errors.vat_number = ['Esiste già un cliente con questa partita IVA.']
  }
  if (italian && kind === 'person' && !input.tax_code) {
    errors.tax_code = ['Il codice fiscale è obbligatorio per un privato.']
  }
  if (input.sdi_code && input.sdi_code.length < 6) {
    errors.sdi_code = [
      'Il codice destinatario è di 7 caratteri, 6 per la pubblica amministrazione.',
    ]
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

/**
 * The client named in the URL, for the requests that change it: 404 when the user cannot see
 * it, 403 without `permission`, then 428 or 412 when If-Match is not the current version.
 */
function changeableClient(
  request: Request,
  cookies: Cookies,
  params: Record<string, unknown>,
  permission: Schemas['Permission'],
) {
  const company = String(params.company)
  const permissions = guard(request, cookies, company, true)
  if (permissions instanceof Response) return permissions
  const clients = db.clients[company] ?? []
  const index = clients.findIndex((c) => c.id === params.client)
  const current = clients[index]
  if (!current || !permissions.includes('clients.view')) return error(404, NOT_FOUND)
  if (!permissions.includes(permission)) return error(403, NOT_ALLOWED)
  return { clients, index, current }
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
    const archivedParam = query.get('filter[archived]')
    // Strict like a real backend, so a wrong parameter in the frontend shows up at once
    if (!SORTS.includes(sort)) return invalid({ sort: ['Ordinamento non valido.'] })
    if (kind !== null && !KINDS.includes(kind)) {
      return invalid({ 'filter.kind': ['Filtro non valido.'] })
    }
    if (archivedParam !== null && archivedParam !== 'true' && archivedParam !== 'false') {
      return invalid({ 'filter.archived': ['Filtro non valido.'] })
    }
    const archived = archivedParam === 'true'
    const page = intParam(query.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const perPage = intParam(query.get('per_page'), 25, 100)
    const search = query.get('search')?.trim().toLowerCase() ?? ''
    if (search.length > 100) return invalid({ search: ['Ricerca troppo lunga.'] })
    const field = sort.endsWith('created_at') ? 'created_at' : 'name'
    const direction = sort.startsWith('-') ? -1 : 1

    const rows = (db.clients[company] ?? [])
      .filter((c) => (c.archived_at !== null) === archived)
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
      archived_at: null,
      created_at: now,
      updated_at: now,
    }
    clients.push(client)
    return clientResponse(client, 201)
  }),

  http.get(path('/companies/:company/clients/:client'), ({ request, cookies, params }) => {
    const company = String(params.company)
    const permissions = guard(request, cookies, company, false)
    if (permissions instanceof Response) return permissions
    const client = db.clients[company]?.find((c) => c.id === params.client)
    // Without the permission a client is as invisible as one from another company
    if (!client || !permissions.includes('clients.view')) return error(404, NOT_FOUND)
    return clientResponse(client)
  }),

  // In the backend's order: 404, 403, 428 (no If-Match), 422, then 412 (an older version)
  http.put(path('/companies/:company/clients/:client'), async ({ request, cookies, params }) => {
    const found = changeableClient(request, cookies, params, 'clients.update')
    if (found instanceof Response) return found
    const { clients, index, current } = found
    if (!request.headers.get('If-Match')) {
      return error(428, NO_VERSION, undefined, 'precondition_required')
    }
    const others = clients.filter((c) => c.id !== current.id)
    const result = parseClient(await readJson(request), others)
    if ('errors' in result) return invalid(result.errors)
    const stale = checkVersion(request, current)
    if (stale) return stale
    const updated: Client = {
      ...result.input,
      id: current.id,
      archived_at: current.archived_at,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    }
    clients[index] = updated
    bumpVersion(updated)
    return clientResponse(updated)
  }),

  http.delete(path('/companies/:company/clients/:client'), ({ request, cookies, params }) => {
    const found = changeableClient(request, cookies, params, 'clients.delete')
    if (found instanceof Response) return found
    const { clients, index, current } = found
    const refused = checkVersion(request, current)
    if (refused) return refused
    if (db.clientsWithDocuments.has(current.id)) {
      return error(409, HAS_DOCUMENTS, undefined, 'has_documents')
    }
    clients.splice(index, 1)
    db.clientVersions.delete(current.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Archiving an archived client keeps its date; restoring an active one changes nothing else
  ...(['archive', 'restore'] as const).map((action) =>
    http.post(
      path(`/companies/:company/clients/:client/${action}`),
      ({ request, cookies, params }) => {
        const found = changeableClient(request, cookies, params, 'clients.update')
        if (found instanceof Response) return found
        const { clients, index, current } = found
        const refused = checkVersion(request, current)
        if (refused) return refused
        const now = new Date().toISOString()
        const updated: Client = {
          ...current,
          archived_at: action === 'archive' ? (current.archived_at ?? now) : null,
          updated_at: now,
        }
        clients[index] = updated
        bumpVersion(updated)
        return clientResponse(updated)
      },
    ),
  ),
]
