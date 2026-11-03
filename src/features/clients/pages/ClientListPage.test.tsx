// @vitest-environment jsdom
import type { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import type { DataRouter, LoaderFunctionArgs, RouteObject } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createRoutes } from '@/app/routes'
import type { Me } from '@/auth/me'
import { messages } from '@/i18n/it'
import { seedClients } from '@/mocks/data'
import { server } from '@/mocks/node'
import { renderApp, renderRoutes, setupAppTests, signIn } from '@/test/app'
import { countRequests, sentRequests } from '@/test/cookies'
import { PHONE_WIDTH, setScreenWidth } from '@/test/media'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
const LIST_API = '*/api/companies/:company/clients'
const LIST_API_PATH = /^\/api\/companies\/[^/]+\/clients$/
const ROSSI_API_PATH = '/api/companies/impresa-rossi/clients'

const T = messages

// The seed data, to know which rows each page should show
const ROSSI = seedClients()['impresa-rossi'] ?? []
const ROSSI_BY_NAME = ROSSI.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'it'))
const ROSSI_NEWEST_FIRST = [...ROSSI]
  .sort((a, b) => b.created_at.localeCompare(a.created_at))
  .map((c) => c.name)

// Every list request the app sends, with its query string
const listRequests: URL[] = []
function recordListRequest({ request }: { request: Request }) {
  const url = new URL(request.url)
  if (request.method === 'GET' && LIST_API_PATH.test(url.pathname)) listRequests.push(url)
}
beforeAll(() => server.events.on('request:start', recordListRequest))
afterEach(() => {
  listRequests.length = 0
})
afterAll(() => server.events.removeListener('request:start', recordListRequest))

/** The query string of the last list request, as an object. */
const lastListQuery = () => Object.fromEntries(listRequests.at(-1)?.searchParams ?? [])
/** The search texts of every list request, in order (null when there was none). */
const sentSearches = () => listRequests.map((url) => url.searchParams.get('search'))
const urlParams = (router: DataRouter) =>
  Object.fromEntries(new URLSearchParams(router.state.location.search))

const findHeading = (name: string) => screen.findByRole('heading', { name })
const button = (name: string) => screen.getByRole('button', { name })
const queryButton = (name: string) => screen.queryByRole('button', { name })
const searchBox = () =>
  screen.getByRole<HTMLInputElement>('searchbox', { name: T['clients.search'] })
const kindSelect = () => screen.getByRole('combobox', { name: T['clients.kind'] })
const columnHeader = (name: string) => screen.getByRole('columnheader', { name })
/** The element that says whether the list is loading. */
const listRegion = () => screen.getByRole('main').querySelector('[aria-busy]')
const isBusy = () => listRegion()?.getAttribute('aria-busy')
/** The names in the table, top to bottom. With selectors: role queries on 25 rows are slow. */
const rowNames = () =>
  Array.from(
    screen.getByRole('table').querySelectorAll('tbody tr'),
    (row) => row.querySelector('td')?.textContent,
  )

/** Signs in, opens the URL and waits until the list has loaded. */
async function openList(url = LIST_URL) {
  await signIn(TITOLARE)
  const app = renderApp(url)
  await findHeading(T['clients.title'])
  await waitFor(() => expect(isBusy()).toBe('false'))
  return app
}

/** Until the returned function is called, list requests that match wait; then the mock answers. */
function holdListRequests(matches: (url: URL) => boolean = () => true) {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.get(LIST_API, async ({ request }) => {
      if (matches(new URL(request.url))) await released
    }),
  )
  return release
}

describe('list parameters in the URL', () => {
  it('without parameters asks for page 1 of 25, by name, without search or filter', async () => {
    await openList()

    expect(lastListQuery()).toEqual({ page: '1', per_page: '25', sort: 'name' })
    expect(listRequests[0]?.pathname).toBe(ROSSI_API_PATH)
    expect(searchBox().value).toBe('')
    expect(kindSelect()).toHaveProperty('value', '')
  })

  it.each([
    ['pagina=0', { page: '1' }],
    ['pagina=-1', { page: '1' }],
    ['pagina=abc', { page: '1' }],
    ['pagina=1.5', { page: '1' }],
    ['pagina=1234567', { page: '1' }],
    ['ordine=city', { sort: 'name' }],
    ['ordine=-NAME', { sort: 'name' }],
    ['ordine=', { sort: 'name' }],
    ['tipo=altro', {}],
    ['tipo=Company', {}],
    [`cerca=${'x'.repeat(100)}yz`, { search: 'x'.repeat(100) }],
  ])('?%s is replaced by a valid value, without errors', async (query, expected) => {
    await openList(`${LIST_URL}?${query}`)

    expect(lastListQuery()).toEqual({ page: '1', per_page: '25', sort: 'name', ...expected })
    expect(sentRequests.filter((r) => r.status === 422)).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a new sort goes back to page 1, keeping the filter', async () => {
    const { router, user } = await openList(`${LIST_URL}?pagina=2&tipo=company`)

    await user.click(within(columnHeader(T['clients.name'])).getByRole('button'))

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-name', tipo: 'company' }))
    await waitFor(() =>
      expect(lastListQuery()).toMatchObject({
        page: '1',
        sort: '-name',
        'filter[kind]': 'company',
      }),
    )
  })

  it('a new kind filter goes back to page 1, keeping the sort', async () => {
    const { router, user } = await openList(`${LIST_URL}?pagina=2&ordine=-name`)

    await user.selectOptions(kindSelect(), T['clients.kind.company'])

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-name', tipo: 'company' }))
    await waitFor(() =>
      expect(lastListQuery()).toEqual({
        page: '1',
        per_page: '25',
        sort: '-name',
        'filter[kind]': 'company',
      }),
    )
  })

  it('a new search goes back to page 1, keeping the filter', async () => {
    const { router, user } = await openList(`${LIST_URL}?pagina=2&tipo=company`)

    await user.type(searchBox(), 'Edil')

    await waitFor(() => expect(urlParams(router)).toEqual({ cerca: 'Edil', tipo: 'company' }))
    await waitFor(() =>
      expect(lastListQuery()).toMatchObject({
        page: '1',
        search: 'Edil',
        'filter[kind]': 'company',
      }),
    )
  })

  it('a new page keeps sort, search and filter', async () => {
    // "i" is in the name of every company: 40 of them, two pages
    const { router, user } = await openList(`${LIST_URL}?ordine=-name&tipo=company&cerca=i`)

    await user.click(button(T['list.next']))

    await waitFor(() =>
      expect(urlParams(router)).toEqual({
        pagina: '2',
        ordine: '-name',
        tipo: 'company',
        cerca: 'i',
      }),
    )
    await waitFor(() =>
      expect(lastListQuery()).toEqual({
        page: '2',
        per_page: '25',
        sort: '-name',
        search: 'i',
        'filter[kind]': 'company',
      }),
    )
  })

  it('sorting back by name takes ordine out of the URL', async () => {
    const { router, user } = await openList(`${LIST_URL}?ordine=-name`)

    await user.click(within(columnHeader(T['clients.name'])).getByRole('button'))

    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('going back to page 1 takes pagina out of the URL', async () => {
    const { router, user } = await openList(`${LIST_URL}?pagina=2&tipo=company`)

    await user.click(button(T['list.previous']))

    await waitFor(() => expect(urlParams(router)).toEqual({ tipo: 'company' }))
  })

  it('clearing the search takes cerca out of the URL', async () => {
    const { router, user } = await openList(`${LIST_URL}?cerca=Ferri&ordine=-name`)
    expect(searchBox().value).toBe('Ferri')

    await user.clear(searchBox())

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-name' }))
    await waitFor(() => expect(lastListQuery()).not.toHaveProperty('search'))
  })

  it('choosing "Tutti" takes tipo out of the URL', async () => {
    const { router, user } = await openList(`${LIST_URL}?tipo=person&ordine=-name`)

    await user.selectOptions(kindSelect(), T['list.all'])

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-name' }))
    await waitFor(() => expect(lastListQuery()).not.toHaveProperty('filter[kind]'))
  })
})

describe('search box', () => {
  it('sends one request with the whole text once typing stops, replacing the history entry', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await user.click(await screen.findByRole('link', { name: T['menu.clients'] }))
    await waitFor(() => expect(isBusy()).toBe('false'))
    listRequests.length = 0

    await user.type(searchBox(), 'Ferri')

    await waitFor(() => expect(urlParams(router)).toEqual({ cerca: 'Ferri' }))
    await screen.findByText('3 risultati · pagina 1 di 1')
    expect(rowNames()).toEqual(['Condominio Via Ferri', 'Edil Ferri S.r.l.', 'Paolo Ferri'])
    expect(sentSearches()).toEqual(['Ferri'])
    expect(router.state.historyAction).toBe('REPLACE')

    // The list without search was replaced: back goes to the page before it
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })

  it('text made only of spaces sends no search', async () => {
    const { router, user } = await openList()
    const before = listRequests.length

    await user.type(searchBox(), '   ')

    await waitFor(() => expect(urlParams(router)).toEqual({ cerca: '   ' }))
    await waitFor(() => expect(listRequests.length).toBeGreaterThan(before))
    await waitFor(() => expect(isBusy()).toBe('false'))
    expect(sentSearches().every((s) => s === null)).toBe(true)
    expect(rowNames()).toHaveLength(25)
  })

  it('trims the spaces around the text in the request', async () => {
    const { router, user } = await openList()

    await user.type(searchBox(), '  Edil Ferri  ')

    await waitFor(() => expect(urlParams(router)).toEqual({ cerca: '  Edil Ferri  ' }))
    await waitFor(() => expect(lastListQuery()).toMatchObject({ search: 'Edil Ferri' }))
    expect(sentSearches().filter((s) => s !== null && s !== s.trim())).toEqual([])
    await waitFor(() => expect(rowNames()).toEqual(['Edil Ferri S.r.l.']))
    expect(searchBox().value).toBe('  Edil Ferri  ')
  })

  it('shows the search of the URL when going back and forward', async () => {
    const { router, user } = await openList()

    await user.selectOptions(kindSelect(), T['clients.kind.company'])
    await waitFor(() => expect(urlParams(router)).toEqual({ tipo: 'company' }))
    await user.type(searchBox(), 'Ferri')
    await waitFor(() => expect(urlParams(router)).toEqual({ tipo: 'company', cerca: 'Ferri' }))

    await act(() => router.navigate(-1))
    expect(router.state.location.search).toBe('')
    await waitFor(() => expect(searchBox().value).toBe(''))
    expect(kindSelect()).toHaveProperty('value', '')

    await act(() => router.navigate(1))
    await waitFor(() => expect(searchBox().value).toBe('Ferri'))
    expect(kindSelect()).toHaveProperty('value', 'company')
  })

  it('shows the search of a URL opened from elsewhere', async () => {
    const { router } = await openList(`${LIST_URL}?cerca=Ferri`)
    expect(searchBox().value).toBe('Ferri')

    await act(() => router.navigate(`${LIST_URL}?cerca=Gallo`))

    await waitFor(() => expect(searchBox().value).toBe('Gallo'))
    await waitFor(() => expect(lastListQuery()).toMatchObject({ search: 'Gallo' }))
  })

  it('keeps letters typed while its previous text is still reaching the URL', async () => {
    // The client list's loader waits for `gate`: the URL changes only when it opens
    const gate: { wait?: Promise<void> } = {}
    const withGate = (routes: RouteObject[]): RouteObject[] =>
      routes.map((route) => {
        if (route.children) return { ...route, children: withGate(route.children) }
        if (route.path !== 'anagrafiche/clienti') return route
        const loader = route.loader
        return {
          ...route,
          loader: async (args: LoaderFunctionArgs) => {
            await gate.wait
            return typeof loader === 'function' ? loader(args) : null
          },
        }
      })
    await signIn(TITOLARE)
    const { router, user } = renderRoutes(
      (queryClient: QueryClient) => withGate(createRoutes(queryClient)),
      LIST_URL,
    )
    await findHeading(T['clients.title'])

    let open = () => {}
    gate.wait = new Promise<void>((resolve) => {
      open = resolve
    })
    await user.type(searchBox(), 'Fer')
    // The pause has passed: the box has applied "Fer", the URL is not there yet
    await waitFor(() => expect(router.state.navigation.location?.search).toBe('?cerca=Fer'))
    await user.type(searchBox(), 'ri')
    gate.wait = undefined
    open()

    await waitFor(() => expect(router.state.location.search).toBe('?cerca=Fer'))
    expect(searchBox().value).toBe('Ferri')
    await waitFor(() => expect(urlParams(router)).toEqual({ cerca: 'Ferri' }))
    expect(searchBox().value).toBe('Ferri')
    await waitFor(() => expect(lastListQuery()).toMatchObject({ search: 'Ferri' }))
  })
})

describe('table', () => {
  it('only Nome and "Aggiunto il" can be sorted; the sorted column says which way', async () => {
    await openList()

    const sortable = [T['clients.name'], T['clients.createdAt']]
    const fixed = [T['clients.kind'], T['clients.taxId'], T['clients.city']]
    for (const name of sortable) {
      expect(within(columnHeader(name)).getByRole('button', { name })).toBeTruthy()
    }
    for (const name of fixed) {
      expect(within(columnHeader(name)).queryByRole('button')).toBeNull()
    }
    expect(columnHeader(T['clients.name']).getAttribute('aria-sort')).toBe('ascending')
    for (const name of [...fixed, T['clients.createdAt']]) {
      expect(columnHeader(name).hasAttribute('aria-sort')).toBe(false)
    }
  })

  it('Nome switches between A-Z and Z-A', async () => {
    const { router, user } = await openList()
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(0, 25))

    await user.click(button(T['clients.name']))

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-name' }))
    await waitFor(() => expect(rowNames()).toEqual([...ROSSI_BY_NAME].reverse().slice(0, 25)))
    expect(columnHeader(T['clients.name']).getAttribute('aria-sort')).toBe('descending')

    await user.click(button(T['clients.name']))

    await waitFor(() => expect(router.state.location.search).toBe(''))
    await waitFor(() => expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(0, 25)))
    expect(columnHeader(T['clients.name']).getAttribute('aria-sort')).toBe('ascending')
  })

  it('"Aggiunto il" shows the newest first, then the oldest first', async () => {
    const { router, user } = await openList()

    await user.click(button(T['clients.createdAt']))

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: '-created_at' }))
    await waitFor(() => expect(rowNames()).toEqual(ROSSI_NEWEST_FIRST.slice(0, 25)))
    expect(columnHeader(T['clients.createdAt']).getAttribute('aria-sort')).toBe('descending')
    expect(columnHeader(T['clients.name']).hasAttribute('aria-sort')).toBe(false)

    await user.click(button(T['clients.createdAt']))

    await waitFor(() => expect(urlParams(router)).toEqual({ ordine: 'created_at' }))
    await waitFor(() => expect(rowNames()).toEqual([...ROSSI_NEWEST_FIRST].reverse().slice(0, 25)))
    expect(columnHeader(T['clients.createdAt']).getAttribute('aria-sort')).toBe('ascending')
  })

  it('a row shows name, kind, VAT number or tax code, city and the date it was added', async () => {
    await openList()

    const cells = (name: string) =>
      within(screen.getByRole('row', { name: new RegExp(`^${name}`) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    expect(cells('Edil Ferri S.r.l.')).toEqual([
      'Edil Ferri S.r.l.',
      'Impresa',
      '10000000000',
      'Torino',
      '01/01/2026',
    ])
    expect(cells('Anna Ricci')).toEqual([
      'Anna Ricci',
      'Privato',
      'RICXYZ80A01L2192',
      'Novara',
      '03/01/2026',
    ])
  })
})

describe('pagination', () => {
  it('counts results and pages, and moves between them', async () => {
    const { router, user } = await openList()

    expect(screen.getByText('60 risultati · pagina 1 di 3')).toBeTruthy()
    expect(button(T['list.previous'])).toHaveProperty('disabled', true)
    expect(button(T['list.next'])).toHaveProperty('disabled', false)

    await user.click(button(T['list.next']))

    await waitFor(() => expect(urlParams(router)).toEqual({ pagina: '2' }))
    await screen.findByText('60 risultati · pagina 2 di 3')
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(25, 50))
    expect(lastListQuery()).toMatchObject({ page: '2' })

    await user.click(button(T['list.next']))

    await screen.findByText('60 risultati · pagina 3 di 3')
    expect(urlParams(router)).toEqual({ pagina: '3' })
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(50))
    expect(button(T['list.next'])).toHaveProperty('disabled', true)
    expect(button(T['list.previous'])).toHaveProperty('disabled', false)
  })

  it('says "1 risultato" when one client matches', async () => {
    await openList(`${LIST_URL}?cerca=Edil Ferri`)

    expect(screen.getByText('1 risultato · pagina 1 di 1')).toBeTruthy()
    expect(rowNames()).toEqual(['Edil Ferri S.r.l.'])
  })

  it('a page past the end says so, and Precedente goes to the last page', async () => {
    const { router, user } = await openList(`${LIST_URL}?pagina=9`)

    expect(screen.getByText(T['list.noResults'])).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(button(T['list.previous']))

    await waitFor(() => expect(urlParams(router)).toEqual({ pagina: '3' }))
    await screen.findByText('60 risultati · pagina 3 di 3')
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(50))
  })
})

describe('loading', () => {
  it('the first time, shows placeholders and no rows', async () => {
    const release = holdListRequests()
    await signIn(TITOLARE)
    renderApp(LIST_URL)
    await findHeading(T['clients.title'])

    expect(isBusy()).toBe('true')
    expect(listRegion()?.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(T['clients.empty'])).toBeNull()

    release()
    await waitFor(() => expect(isBusy()).toBe('false'))
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(0, 25))
    expect(listRegion()?.querySelector('[data-slot="skeleton"]')).toBeNull()
  })

  it('while another page loads, keeps the previous rows on screen', async () => {
    const { router, user } = await openList()
    const release = holdListRequests((url) => url.searchParams.get('page') === '2')

    await user.click(button(T['list.next']))

    await waitFor(() => expect(urlParams(router)).toEqual({ pagina: '2' }))
    await waitFor(() => expect(lastListQuery()).toMatchObject({ page: '2' }))
    expect(isBusy()).toBe('true')
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(0, 25))
    expect(listRegion()?.querySelector('[data-slot="skeleton"]')).toBeNull()

    release()
    await waitFor(() => expect(isBusy()).toBe('false'))
    expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(25, 50))
  })
})

describe('empty and failed lists', () => {
  const emptyList = () =>
    server.use(
      http.get(LIST_API, () =>
        HttpResponse.json({ data: [], meta: { total: 0, page: 1, per_page: 25 } }),
      ),
    )

  it('a company without clients says so, without pagination', async () => {
    emptyList()
    await openList()

    expect(screen.getByText(T['clients.empty'])).toBeTruthy()
    expect(screen.queryByText(T['list.noResults'])).toBeNull()
    expect(queryButton(T['list.previous'])).toBeNull()
    expect(queryButton(T['list.next'])).toBeNull()
    expect(screen.queryByText(/risultat/)).toBeNull()
  })

  it('a search without matches says there are no results, without pagination', async () => {
    await openList(`${LIST_URL}?cerca=nessuno`)

    expect(screen.getByText(T['list.noResults'])).toBeTruthy()
    expect(screen.queryByText(T['clients.empty'])).toBeNull()
    expect(queryButton(T['list.next'])).toBeNull()
  })

  it('a filter without matches says there are no results', async () => {
    emptyList()
    await openList(`${LIST_URL}?tipo=person`)

    expect(screen.getByText(T['list.noResults'])).toBeTruthy()
    expect(screen.queryByText(T['clients.empty'])).toBeNull()
  })

  it('a server error, after the retries, offers to try again', async () => {
    let failing = true
    server.use(
      http.get(LIST_API, () => {
        if (failing) return HttpResponse.json({ message: 'Errore' }, { status: 500 })
        return undefined
      }),
    )
    await signIn(TITOLARE)
    const { router, user } = renderApp(LIST_URL)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(T['list.loadFailed'])).toBeTruthy()
    expect(countRequests('GET', ROSSI_API_PATH)).toBe(3)
    expect(screen.queryByRole('table')).toBeNull()

    failing = false
    await user.click(within(alert).getByRole('button', { name: T['list.retry'] }))

    await waitFor(() => expect(rowNames()).toEqual(ROSSI_BY_NAME.slice(0, 25)))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(router.state.location.pathname).toBe(LIST_URL)
  })

  it('a 403 shows that the role does not allow it, on the same page and without retrying', async () => {
    server.use(
      http.get(LIST_API, () =>
        HttpResponse.json({ message: 'Il tuo ruolo non permette questa azione.' }, { status: 403 }),
      ),
    )
    await signIn(TITOLARE)
    const { router } = renderApp(`${LIST_URL}?ordine=-name`)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(T['error.forbidden.text'])
    expect(within(alert).queryByRole('button')).toBeNull()
    expect(screen.queryByText(T['list.loadFailed'])).toBeNull()
    // Still the list page inside the layout, not an error page
    expect(screen.getByRole('heading', { name: T['clients.title'] })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: T['error.forbidden.title'] })).toBeNull()
    expect(screen.getByRole('link', { name: T['menu.dashboard'] })).toBeTruthy()
    expect(router.state.location.pathname).toBe(LIST_URL)
    expect(urlParams(router)).toEqual({ ordine: '-name' })
    expect(countRequests('GET', ROSSI_API_PATH)).toBe(1)
  })
})

describe('route, menu and company', () => {
  /** A member of Impresa Rossi who can add clients but not see them. */
  const withoutClientsView: Me = {
    id: 'u-test-senza-clienti',
    name: 'Paola Verdi',
    email: 'paola@example.test',
    companies: [
      {
        slug: 'impresa-rossi',
        name: 'Impresa Rossi S.r.l.',
        role: 'Contabile',
        permissions: ['clients.create', 'clients.update'],
      },
    ],
  }

  it('without clients.view, the URL opens the not-found page inside the layout', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.json(withoutClientsView)))
    const { router } = renderApp(LIST_URL)

    await findHeading(T['error.notFound.title'])
    expect(screen.getByRole('link', { name: T['menu.dashboard'] })).toBeTruthy()
    expect(screen.queryByRole('link', { name: T['menu.clients'] })).toBeNull()
    expect(screen.queryByRole('heading', { name: T['clients.title'] })).toBeNull()
    expect(router.state.location.pathname).toBe(LIST_URL)
    expect(listRequests).toEqual([])
  })

  it('marks Clienti as the current page in the menu, also with parameters', async () => {
    await openList(`${LIST_URL}?pagina=2&ordine=-name`)

    const link = screen.getByRole('link', { name: T['menu.clients'] })
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.getAttribute('data-active')).toBe('true')
    const dashboard = screen.getByRole('link', { name: T['menu.dashboard'] })
    expect(dashboard.hasAttribute('aria-current')).toBe(false)
  })

  it('asks for the clients of the company in the URL, also after switching company', async () => {
    const { router } = await openList()
    expect(screen.getByText('60 risultati · pagina 1 di 3')).toBeTruthy()

    await act(() => router.navigate('/costruzioni-verdi/anagrafiche/clienti'))

    await screen.findByText('5 risultati · pagina 1 di 1')
    await waitFor(() => expect(isBusy()).toBe('false'))
    const verdi = (seedClients()['costruzioni-verdi'] ?? []).map((c) => c.name)
    expect(rowNames()).toEqual(verdi.sort((a, b) => a.localeCompare(b, 'it')))
    expect(listRequests.at(-1)?.pathname).toBe('/api/companies/costruzioni-verdi/clients')
    // The two companies have clients with the same names, not the same VAT numbers
    const ferri = screen.getByRole('row', { name: /^Edil Ferri S\.r\.l\./ })
    expect(within(ferri).getByText('20000000000')).toBeTruthy()
  })
})

describe('on a phone', () => {
  const card = (name: string) => {
    const article = screen.getByRole('heading', { name, level: 2 }).closest('article')
    if (!article) throw new Error(`No card for ${name}`)
    return article
  }

  it('each client is a card with name, kind, tax id and city, and there is no table', async () => {
    setScreenWidth(PHONE_WIDTH)
    await openList()

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(25)
    expect(card('Edil Ferri S.r.l.').textContent).toBe(
      'Edil Ferri S.r.l.Impresa · 10000000000 · Torino',
    )
    expect(card('Anna Ricci').textContent).toBe('Anna RicciPrivato · RICXYZ80A01L2192 · Novara')
    expect(screen.getByText('60 risultati · pagina 1 di 3')).toBeTruthy()
  })

  it('on a desktop the same list is a table, without cards', async () => {
    await openList()

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryAllByRole('article')).toEqual([])
    expect(rowNames()).toHaveLength(25)
  })
})
