// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { Me } from '@/auth/me'
import { messages } from '@/i18n/it'
import { server } from '@/mocks/node'
import { renderApp, setupAppTests, signIn } from '@/test/app'
import { PHONE_WIDTH, setScreenWidth } from '@/test/media'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const UFFICIO = 'ufficio@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'

const DASHBOARD = messages['menu.dashboard']
const REGISTRY = messages['menu.registry']
const CLIENTS = messages['menu.clients']
const TOGGLE = messages['ui.sidebar.toggle']

const findHeading = (name: string) => screen.findByRole('heading', { name })
const menuLink = (name: string) => screen.getByRole('link', { name })
const queryMenuLink = (name: string) => screen.queryByRole('link', { name })
/** The button at the top of the menu, which shows the company in the URL. */
const switcherButton = (company: string) =>
  screen.getByRole('button', { name: new RegExp(`^${company.replaceAll('.', '\\.')}`) })

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
  it('shows the company and the role in it, the user, and the menu toggle', async () => {
    await signIn(TITOLARE)
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    const switcher = switcherButton('Impresa Rossi S.r.l.')
    expect(within(switcher).getByText('Titolare')).toBeTruthy()
    const userMenu = screen.getByRole('button', { name: /Giulia Rossi/ })
    expect(within(userMenu).getByText('Giulia Rossi')).toBeTruthy()
    expect(within(userMenu).getByText(TITOLARE)).toBeTruthy()
    // The button in the header and the rail on the edge of the menu
    expect(screen.getAllByRole('button', { name: TOGGLE })).toHaveLength(2)
  })

  it('shows the role the user has in the company in the URL', async () => {
    await signIn(TITOLARE)
    renderApp('/costruzioni-verdi')
    await findHeading('Ciao, Giulia Rossi')

    expect(within(switcherButton('Costruzioni Verdi S.p.A.')).getByText('Ufficio')).toBeTruthy()
    expect(screen.queryByText('Titolare')).toBeNull()
    expect(screen.queryByText('Impresa Rossi S.r.l.')).toBeNull()
  })

  it('keeps the menu around a page that does not exist, with one main region', async () => {
    await signIn(UFFICIO)
    const { router } = renderApp('/impresa-rossi/non-esiste')
    await findHeading(messages['error.notFound.title'])

    expect(menuLink(DASHBOARD)).toBeTruthy()
    expect(menuLink(CLIENTS)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Luca Bianchi/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/impresa-rossi',
    )
    // The error is part of the page, not a second page inside it
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(router.state.location.pathname).toBe('/impresa-rossi/non-esiste')
  })

  it('is not shown around the not-found page of a company the user does not belong to', async () => {
    await signIn(UFFICIO)
    renderApp('/costruzioni-verdi')
    await findHeading(messages['error.notFound.title'])

    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/',
    )
    expect(queryMenuLink(DASHBOARD)).toBeNull()
    expect(queryMenuLink(CLIENTS)).toBeNull()
    expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull()
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
  it.each([TITOLARE, UFFICIO, CAPOCANTIERE])(
    '%s sees Dashboard, and Clienti under Anagrafiche',
    async (email) => {
      await signIn(email)
      renderApp('/impresa-rossi')
      await screen.findByRole('link', { name: DASHBOARD })

      expect(menuLink(CLIENTS)).toBeTruthy()
      expect(screen.getByText(REGISTRY)).toBeTruthy()
    },
  )

  it('without clients.view in the company, has no Clienti and no Anagrafiche', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.json(withoutClientsView)))
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Paola Verdi')

    expect(menuLink(DASHBOARD)).toBeTruthy()
    expect(queryMenuLink(CLIENTS)).toBeNull()
    expect(screen.queryByText(REGISTRY)).toBeNull()
  })

  it('links to the pages of the company in the URL', async () => {
    await signIn(TITOLARE)
    renderApp('/costruzioni-verdi')
    await screen.findByRole('link', { name: DASHBOARD })

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
    await screen.findByRole('link', { name: DASHBOARD })

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
      await screen.findByRole('link', { name: DASHBOARD })

      expect(isCurrent(menuLink(CLIENTS))).toBe(true)
      expect(isNotCurrent(menuLink(DASHBOARD))).toBe(true)
    },
  )

  it('following Clienti opens its URL inside the same layout', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await screen.findByRole('link', { name: DASHBOARD })

    await user.click(menuLink(CLIENTS))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/impresa-rossi/anagrafiche/clienti'),
    )
    // The Clienti page comes with the next pull request: for now, the not-found page
    await findHeading(messages['error.notFound.title'])
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
    expect(within(menu).getByText(messages['layout.companies'])).toBeTruthy()
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

  it('following another company opens it, with the role there', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    await user.click(switcherButton('Impresa Rossi S.r.l.'))
    await user.click(await screen.findByRole('menuitem', { name: 'Costruzioni Verdi S.p.A.' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/costruzioni-verdi'))
    const switcher = await waitFor(() => switcherButton('Costruzioni Verdi S.p.A.'))
    expect(within(switcher).getByText('Ufficio')).toBeTruthy()
    expect(screen.queryByText('Titolare')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(menuLink(DASHBOARD).getAttribute('href')).toBe('/costruzioni-verdi')
  })

  it('with a single company there is nothing to switch to', async () => {
    await signIn(UFFICIO)
    renderApp('/impresa-rossi')
    await findHeading('Ciao, Luca Bianchi')

    expect(screen.getByText('Impresa Rossi S.r.l.')).toBeTruthy()
    expect(screen.getByText('Ufficio')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Impresa Rossi/ })).toBeNull()
    expect(screen.queryByText(messages['layout.companies'])).toBeNull()
  })
})

describe('on a phone', () => {
  const openMenuSheet = async (user: ReturnType<typeof renderApp>['user']) => {
    await user.click(screen.getByRole('button', { name: TOGGLE }))
    return screen.findByRole('dialog', { name: messages['ui.sidebar.title'] })
  }

  it('the menu stays closed until the toggle opens it', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    expect(queryMenuLink(DASHBOARD)).toBeNull()
    expect(queryMenuLink(CLIENTS)).toBeNull()

    const sheet = await openMenuSheet(user)
    expect(within(sheet).getByText(messages['ui.sidebar.description'])).toBeTruthy()
    expect(within(sheet).getByRole('link', { name: CLIENTS })).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: /Giulia Rossi/ })).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: messages['ui.close'] })).toBeTruthy()
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

  it('switching company closes the menu', async () => {
    setScreenWidth(PHONE_WIDTH)
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi')
    await findHeading('Ciao, Giulia Rossi')

    const sheet = await openMenuSheet(user)
    await user.click(within(sheet).getByRole('button', { name: /^Impresa Rossi S\.r\.l\./ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Costruzioni Verdi S.p.A.' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/costruzioni-verdi'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Costruzioni Verdi S.p.A., come Ufficio')).toBeTruthy()
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
  })
})
