// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { Me } from '@/auth/me'
import { messages } from '@/i18n/it'
import { server } from '@/mocks/node'
import {
  linkOutsideBreadcrumbs,
  linksOutsideBreadcrumbs,
  renderApp,
  setupAppTests,
  signIn,
} from '@/test/app'
import { PHONE_WIDTH, setScreenWidth } from '@/test/media'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const UFFICIO = 'ufficio@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'

const T = messages
const DASHBOARD = T['menu.dashboard']
const REGISTRY = T['menu.registry']
const CLIENTS = T['menu.clients']
const TOGGLE = T['ui.sidebar.toggle']
const APP_NAME = T['app.name']

const findHeading = (name: string) => screen.findByRole('heading', { name })
// Outside the breadcrumbs of the header, which have steps with the same names
const menuLink = (name: string) => linkOutsideBreadcrumbs(name)
const queryMenuLink = (name: string) => linksOutsideBreadcrumbs(name)[0] ?? null
/** The button in the header that shows the company in the URL, when there are more. */
const switcherButton = (company: string) =>
  screen.getByRole('button', { name: new RegExp(`^${company.replaceAll('.', '\\.')}`) })
const header = () => screen.getByRole('banner')
const avatar = (name: string) => screen.getByRole('button', { name: `Menu di ${name}` })
const logoLink = () => screen.getByRole('link', { name: APP_NAME })
/** The logo's name: hidden but still read while only the mark shows. */
const logoName = () => within(logoLink()).getByText(APP_NAME)
/** The toggle on the edge of the menu, on a computer: the rail has the same name. */
function edgeToggle() {
  const toggles = screen
    .getAllByRole('button', { name: TOGGLE })
    .filter((b) => b.hasAttribute('aria-expanded'))
  if (toggles.length !== 1) throw new Error(`Expected one edge toggle, found ${toggles.length}`)
  return toggles[0] as HTMLElement
}
const sidebarState = () =>
  document.querySelector('[data-slot="sidebar"][data-state]')?.getAttribute('data-state')
const queryBreadcrumbs = () => screen.queryByRole('navigation', { name: T['ui.breadcrumb'] })

/** Opens the avatar's menu and returns it. */
async function openUserMenu(user: ReturnType<typeof renderApp>['user'], name: string) {
  await user.click(avatar(name))
  return screen.findByRole('menu')
}

/** The side menu as it reads: each group's label (none for the first) and its items. */
function menuGroups(root: ParentNode = document) {
  return Array.from(root.querySelectorAll('[data-sidebar="group"]'), (group) => [
    group.querySelector('[data-sidebar="group-label"]')?.textContent ?? null,
    Array.from(group.querySelectorAll('[data-sidebar="menu-item"]'), (item) => item.textContent),
  ])
}
// Built modules need permissions the mock users do not have, so they are hidden
const PLANNED_REGISTRY: string[] = []
const menuWith = (
  registry: (string | null)[],
  admin: string[] = [T['menu.deadlines'], T['menu.costs']],
  work: string[] = [T['menu.sites'], T['menu.reports']],
) =>
  (
    [
      [null, [DASHBOARD]],
      [T['menu.work'], work],
      [T['menu.admin'], admin],
      [REGISTRY, registry],
      // A group with no item the user may see is not shown
    ] as [string | null, (string | null)[]][]
  ).filter(([, items]) => items.length > 0)
/** The menu items that say "Presto". */
const plannedItems = () =>
  Array.from(document.querySelectorAll('[data-sidebar="menu-item"]')).filter((item) =>
    item.textContent.endsWith(T['menu.soon']),
  )

/** A user whose only membership can do something with clients, but not see them. */
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

describe('the layout inside a company', () => {
  it('the header has the toggle, the breadcrumbs, the company and the avatar; main has only the page', async () => {
    await signIn(TITOLARE)
    renderApp('/impresa-rossi/anagrafiche/clienti')
    await findHeading(T['clients.title'])

    const main = screen.getByRole('main')
    expect(main.contains(header())).toBe(false)
    expect(header().contains(main)).toBe(false)
    expect(within(header()).getAllByRole('button', { name: TOGGLE })).toHaveLength(1)
    expect(header().contains(queryBreadcrumbs())).toBe(true)
    expect(header().contains(switcherButton('Impresa Rossi S.r.l.'))).toBe(true)
    expect(header().contains(avatar('Giulia Rossi'))).toBe(true)
    expect(within(main).getByRole('heading', { name: T['clients.title'], level: 1 })).toBeTruthy()
    expect(within(main).queryByRole('button', { name: TOGGLE })).toBeNull()
    expect(within(main).queryByRole('navigation', { name: T['ui.breadcrumb'] })).toBeNull()
  })

  it('the avatar has the initials, named after the user; its menu has name, email and role', async () => {
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    expect(avatar('Giulia Rossi').textContent).toBe('GR')
    expect(avatar('Giulia Rossi').querySelector('[aria-hidden="true"]')?.textContent).toBe('GR')
    // The role is in the avatar's menu only
    expect(screen.queryByText('Titolare')).toBeNull()

    const menu = await openUserMenu(user, 'Giulia Rossi')
    expect(within(menu).getByText('Giulia Rossi')).toBeTruthy()
    expect(within(menu).getByText(TITOLARE)).toBeTruthy()
    expect(within(menu).getByText('Titolare')).toBeTruthy()
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([T['logout.submit']])
  })

  it('the avatar menu shows the role the user has in the company in the URL', async () => {
    await signIn(TITOLARE)
    const { user } = renderApp('/costruzioni-verdi')
    await findHeading('Ciao, Giulia Rossi')

    expect(switcherButton('Costruzioni Verdi S.p.A.')).toBeTruthy()
    const menu = await openUserMenu(user, 'Giulia Rossi')
    expect(within(menu).getByText('Ufficio')).toBeTruthy()
    expect(screen.queryByText('Titolare')).toBeNull()
    expect(screen.queryByText('Impresa Rossi S.r.l.')).toBeNull()
  })

  it('logout from the avatar menu ends on the login page', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi', { expireSessionOn401: true })
    await findHeading('Ciao, Giulia Rossi')

    const menu = await openUserMenu(user, 'Giulia Rossi')
    await user.click(within(menu).getByRole('menuitem', { name: T['logout.submit'] }))

    await findHeading(T['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
  })

  it('the logo links to the dashboard of the company in the URL', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/costruzioni-verdi/anagrafiche/clienti')
    await findHeading(T['clients.title'])

    expect(screen.getAllByRole('link', { name: APP_NAME })).toHaveLength(1)
    expect(logoLink().getAttribute('href')).toBe('/costruzioni-verdi')
    expect(logoName().classList.contains('sr-only')).toBe(false)

    await user.click(logoLink())

    await findHeading('Ciao, Giulia Rossi')
    expect(router.state.location.pathname).toBe('/costruzioni-verdi')
  })

  it('keeps the menu around a page that does not exist, with one main region', async () => {
    await signIn(UFFICIO)
    const { router } = renderApp('/impresa-rossi/non-esiste')
    await findHeading(T['error.notFound.title'])

    expect(menuLink(DASHBOARD)).toBeTruthy()
    expect(menuLink(CLIENTS)).toBeTruthy()
    expect(avatar('Luca Bianchi')).toBeTruthy()
    expect(screen.getByRole('link', { name: T['error.home'] }).getAttribute('href')).toBe(
      '/impresa-rossi',
    )
    // The error is part of the page, not a second page inside it
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(router.state.location.pathname).toBe('/impresa-rossi/non-esiste')
  })

  it('is not shown around the not-found page of a company the user does not belong to', async () => {
    await signIn(UFFICIO)
    renderApp('/costruzioni-verdi')
    await findHeading(T['error.notFound.title'])

    expect(screen.getByRole('link', { name: T['error.home'] }).getAttribute('href')).toBe('/')
    expect(queryMenuLink(DASHBOARD)).toBeNull()
    expect(queryMenuLink(CLIENTS)).toBeNull()
    expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull()
    expect(screen.queryByRole('link', { name: APP_NAME })).toBeNull()
    expect(screen.queryByText(/Luca Bianchi/)).toBeNull()
  })

  it('takes its screen-reader texts from the Italian messages, not the English defaults', async () => {
    await signIn(TITOLARE)
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    const rail = screen.getAllByRole('button', { name: TOGGLE }).find((b) => b.title)
    expect(rail?.title).toBe(TOGGLE)
    expect(screen.queryByText(/toggle sidebar/i)).toBeNull()
    expect(screen.queryByLabelText(/toggle sidebar/i)).toBeNull()
    expect(screen.queryByTitle(/toggle sidebar/i)).toBeNull()
    expect(document.body.innerHTML).not.toMatch(/toggle sidebar/i)
  })
})

describe('side menu', () => {
  it.each([
    [TITOLARE, [T['menu.deadlines'], T['menu.costs']]],
    [UFFICIO, [T['menu.deadlines'], T['menu.costs']]],
    // Without costs.view: no Costi
    [CAPOCANTIERE, [T['menu.deadlines']]],
  ])(
    '%s sees Dashboard, Lavori, Amministrazione, and Clienti under Anagrafiche',
    async (email, admin) => {
      await signIn(email)
      renderApp('/impresa-rossi')
      await waitFor(() => menuLink(DASHBOARD))

      expect(menuLink(CLIENTS)).toBeTruthy()
      expect(menuLink(T['menu.reports'])).toBeTruthy()
      expect(menuGroups()).toEqual(menuWith([CLIENTS, ...PLANNED_REGISTRY], admin))
    },
  )

  it('without clients.view in the company, Anagrafiche shows no Clienti', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.json(withoutClientsView)))
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Paola Verdi')

    expect(menuLink(DASHBOARD)).toBeTruthy()
    expect(queryMenuLink(CLIENTS)).toBeNull()
    // Without companies' permissions: no Scadenziario, Costi, Cantieri or Rapportini either
    expect(menuGroups()).toEqual(menuWith(PLANNED_REGISTRY, [], []))
  })

  it.each([
    ['titolare', TITOLARE],
    ['capocantiere', CAPOCANTIERE],
  ])('for %s the planned modules say "Presto" and are not links', async (_, email) => {
    await signIn(email)
    renderApp('/impresa-rossi')
    await waitFor(() => menuLink(DASHBOARD))

    const planned = plannedItems()
    expect(planned).toHaveLength(0)
    for (const item of planned) {
      expect(within(item as HTMLElement).getByText(T['menu.soon'])).toBeTruthy()
      expect(item.querySelector('a, button, [href], [tabindex]')).toBeNull()
    }
    for (const id of ['menu.quotes'] as const) {
      expect(screen.queryByRole('link', { name: new RegExp(T[id]) })).toBeNull()
    }
  })

  it('links to the pages of the company in the URL', async () => {
    await signIn(TITOLARE)
    renderApp('/costruzioni-verdi')
    await waitFor(() => menuLink(DASHBOARD))

    expect(menuLink(DASHBOARD).getAttribute('href')).toBe('/costruzioni-verdi')
    expect(menuLink(CLIENTS).getAttribute('href')).toBe('/costruzioni-verdi/anagrafiche/clienti')
  })

  // data-active drives the highlight of the item, which jsdom cannot show
  const isCurrent = (link: HTMLElement) =>
    link.getAttribute('aria-current') === 'page' && link.getAttribute('data-active') === 'true'
  const isNotCurrent = (link: HTMLElement) =>
    !link.hasAttribute('aria-current') && link.getAttribute('data-active') === 'false'

  it('marks Dashboard as the current page only on the dashboard', async () => {
    await signIn(TITOLARE)
    renderApp('/impresa-rossi')
    await waitFor(() => menuLink(DASHBOARD))

    expect(menuLink(DASHBOARD).getAttribute('href')).toBe('/impresa-rossi')
    expect(menuLink(CLIENTS).getAttribute('href')).toBe('/impresa-rossi/anagrafiche/clienti')
    expect(isCurrent(menuLink(DASHBOARD))).toBe(true)
    expect(isNotCurrent(menuLink(CLIENTS))).toBe(true)
  })

  it.each(['/impresa-rossi/anagrafiche/clienti', '/impresa-rossi/anagrafiche/clienti/123'])(
    'marks Clienti as the current page, not Dashboard, on %s',
    async (url) => {
      await signIn(TITOLARE)
      renderApp(url)
      await waitFor(() => menuLink(DASHBOARD))

      expect(isCurrent(menuLink(CLIENTS))).toBe(true)
      expect(isNotCurrent(menuLink(DASHBOARD))).toBe(true)
    },
  )

  it('following Clienti opens its URL inside the same layout', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await waitFor(() => menuLink(DASHBOARD))

    await user.click(menuLink(CLIENTS))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/impresa-rossi/anagrafiche/clienti'),
    )
    await findHeading(T['clients.title'])
    expect(screen.queryByRole('heading', { name: T['error.notFound.title'] })).toBeNull()
    expect(isCurrent(menuLink(CLIENTS))).toBe(true)
  })
})

describe('company switcher', () => {
  it('lists every company of the user as a link, the current one marked', async () => {
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    await user.click(switcherButton('Impresa Rossi S.r.l.'))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText(T['layout.companies'])).toBeTruthy()
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((i) => [i.textContent, i.getAttribute('href')])).toEqual([
      ['Impresa Rossi S.r.l.', '/impresa-rossi'],
      ['Costruzioni Verdi S.p.A.', '/costruzioni-verdi'],
    ])
    // The company in the URL: for screen readers, and with a check icon for everyone else
    expect(items[0]?.getAttribute('aria-current')).toBe('true')
    expect(items[1]?.hasAttribute('aria-current')).toBe(false)
    expect(items[0]?.querySelector('svg.lucide-check')).not.toBeNull()
    expect(items[1]?.querySelector('svg.lucide-check')).toBeNull()
  })

  it('following another company opens it; the avatar menu then has the role there', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    await user.click(switcherButton('Impresa Rossi S.r.l.'))
    await user.click(await screen.findByRole('menuitem', { name: 'Costruzioni Verdi S.p.A.' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/costruzioni-verdi'))
    await waitFor(() => switcherButton('Costruzioni Verdi S.p.A.'))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(menuLink(DASHBOARD).getAttribute('href')).toBe('/costruzioni-verdi')
    const menu = await openUserMenu(user, 'Giulia Rossi')
    expect(within(menu).getByText('Ufficio')).toBeTruthy()
    expect(screen.queryByText('Titolare')).toBeNull()
  })

  it('with a single company, the header shows its name, with nothing to open', async () => {
    await signIn(UFFICIO)
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Luca Bianchi')

    const name = within(header()).getByText('Impresa Rossi S.r.l.')
    expect(name.closest('p')).not.toBeNull()
    expect(name.closest('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /Impresa Rossi/ })).toBeNull()
    expect(screen.queryByText(T['layout.companies'])).toBeNull()
    // The role is in the avatar's menu, not next to the company
    expect(screen.queryByText('Ufficio')).toBeNull()
  })
})

describe('on a computer', () => {
  it('the toggle on the edge collapses the menu to its icons, and the logo to its mark', async () => {
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')
    // The toggle on the edge and the rail
    expect(screen.getAllByRole('button', { name: TOGGLE })).toHaveLength(2)
    expect(edgeToggle().getAttribute('aria-expanded')).toBe('true')
    expect(sidebarState()).toBe('expanded')
    expect(logoName().classList.contains('sr-only')).toBe(false)

    await user.click(edgeToggle())

    expect(edgeToggle().getAttribute('aria-expanded')).toBe('false')
    expect(sidebarState()).toBe('collapsed')
    // Only the mark shows; the link keeps its name and its target
    expect(logoName().classList.contains('sr-only')).toBe(true)
    expect(logoLink().getAttribute('href')).toBe('/impresa-rossi')

    await user.click(edgeToggle())

    expect(edgeToggle().getAttribute('aria-expanded')).toBe('true')
    expect(sidebarState()).toBe('expanded')
    expect(logoName().classList.contains('sr-only')).toBe(false)
  })
})

describe('on a phone', () => {
  const openMenuSheet = async (user: ReturnType<typeof renderApp>['user']) => {
    await user.click(screen.getByRole('button', { name: TOGGLE }))
    return screen.findByRole('dialog', { name: T['ui.sidebar.title'] })
  }

  it('the header has one menu button and the mark, the company and the avatar, no breadcrumbs', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    renderApp('/impresa-rossi/anagrafiche/clienti/impresa-rossi-001')
    await findHeading('Edil Ferri S.r.l.')

    expect(screen.getAllByRole('button', { name: TOGGLE })).toHaveLength(1)
    expect(header().contains(screen.getByRole('button', { name: TOGGLE }))).toBe(true)
    expect(screen.getByRole('button', { name: TOGGLE }).hasAttribute('aria-expanded')).toBe(false)
    expect(header().contains(logoLink())).toBe(true)
    expect(logoLink().getAttribute('href')).toBe('/impresa-rossi')
    expect(logoName().classList.contains('sr-only')).toBe(true)
    expect(header().contains(switcherButton('Impresa Rossi S.r.l.'))).toBe(true)
    expect(header().contains(avatar('Giulia Rossi'))).toBe(true)
    // Not even hidden: the page's back link takes their place
    expect(queryBreadcrumbs()).toBeNull()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: T['clients.title'] }),
    ).toBeTruthy()
  })

  it('the menu stays closed until the button opens it, with the logo and the menu only', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    expect(queryMenuLink(DASHBOARD)).toBeNull()
    expect(queryMenuLink(CLIENTS)).toBeNull()

    const sheet = await openMenuSheet(user)
    expect(within(sheet).getByText(T['ui.sidebar.description'])).toBeTruthy()
    expect(within(sheet).getByRole('link', { name: CLIENTS })).toBeTruthy()
    // The whole logo, not only the mark
    const logo = within(sheet).getByRole('link', { name: APP_NAME })
    expect(within(logo).getByText(APP_NAME).classList.contains('sr-only')).toBe(false)
    expect(menuGroups(sheet)).toEqual(menuWith([CLIENTS, ...PLANNED_REGISTRY]))
    // The company and the user are in the header, not in the menu
    expect(within(sheet).queryByRole('button', { name: /Giulia Rossi/ })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /Impresa Rossi/ })).toBeNull()
    expect(within(sheet).getByRole('button', { name: T['ui.close'] })).toBeTruthy()
    expect(document.body.innerHTML).not.toMatch(/toggle sidebar|mobile sidebar|>Close</i)
  })

  it('following a link of the menu closes it', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    const sheet = await openMenuSheet(user)
    await user.click(within(sheet).getByRole('link', { name: CLIENTS }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/impresa-rossi/anagrafiche/clienti'),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(queryMenuLink(CLIENTS)).toBeNull()
  })

  it('switching company from the header opens it, without the menu', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    await user.click(switcherButton('Impresa Rossi S.r.l.'))
    await user.click(await screen.findByRole('menuitem', { name: 'Costruzioni Verdi S.p.A.' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/costruzioni-verdi'))
    await waitFor(() => switcherButton('Costruzioni Verdi S.p.A.'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(logoLink().getAttribute('href')).toBe('/costruzioni-verdi')
  })

  it('on a wider screen the menu is shown in place, without opening it', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')
    expect(queryMenuLink(DASHBOARD)).toBeNull()

    act(() => setScreenWidth(1024))

    expect(menuLink(DASHBOARD)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(queryBreadcrumbs()).not.toBeNull()
  })
})
