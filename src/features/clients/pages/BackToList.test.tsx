// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { messages } from '@/i18n/it'
import {
  breadcrumbs,
  linkOutsideBreadcrumbs,
  linksOutsideBreadcrumbs,
  renderApp,
  setupAppTests,
  signIn,
} from '@/test/app'
import { countRequests, deleteCookie } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
const FERRI_NAME = 'Edil Ferri S.r.l.'
const FERRI_URL = `${LIST_URL}/impresa-rossi-001`
const VERDI_LIST_URL = '/costruzioni-verdi/anagrafiche/clienti'
// Page 2 of the companies with "i" (all 40 of them), 10 per page, Z to A
const QUERY = '?pagina=2&per_pagina=10&ordine=-name&cerca=i&tipo=company'

const T = messages

const findHeading = (name: string) => screen.findByRole('heading', { name, level: 1 })
const main = () => screen.getByRole('main')
const crumb = (name: string) => within(breadcrumbs()).getByRole('link', { name })
/** The link above the title, back to where the page belongs. */
const backLink = (name: string) => linkOutsideBreadcrumbs(name, main())
const cancelLink = () => within(main()).getByRole('link', { name: T['form.cancel'] })
/** The link in the side menu: outside the page. */
function menuLink(name: string) {
  const links = linksOutsideBreadcrumbs(name).filter((link) => !main().contains(link))
  if (links.length !== 1) throw new Error(`Expected one menu link "${name}", found ${links.length}`)
  return links[0] as HTMLElement
}
const href = (link: HTMLElement) => link.getAttribute('href')
const isBusy = () => main().querySelector('[aria-busy]')?.getAttribute('aria-busy')
/** The names in the table, top to bottom. */
const rowNames = () =>
  Array.from(
    screen.getByRole('table').querySelectorAll('tbody tr'),
    (row) => row.querySelector('td')?.textContent,
  )

async function waitForList() {
  await findHeading(T['clients.title'])
  await waitFor(() => expect(isBusy()).toBe('false'))
}

/** Signs in and opens the list at this URL, until its rows are there. */
async function openList(url: string, options?: { expireSessionOn401: boolean }) {
  await signIn(TITOLARE)
  const app = renderApp(url, options)
  await waitForList()
  return app
}

/** Opens the client of the first row; returns its name and URL. */
async function openFirstClient(user: UserEvent) {
  const name = rowNames()[0]
  if (!name) throw new Error('The list has no rows')
  await user.click(within(screen.getByRole('table')).getByRole('link', { name }))
  await findHeading(name)
  return name
}

describe('from a client back to the list', () => {
  it('the Clienti step and the back link have the parameters the list had', async () => {
    const { user } = await openList(`${LIST_URL}${QUERY}`)

    await openFirstClient(user)

    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)
    expect(href(backLink(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)
    // Steps that are not lists stay as they are
    expect(href(crumb(T['menu.dashboard']))).toBe('/impresa-rossi')
  })

  it.each([
    ['the Clienti step', () => crumb(T['clients.title'])],
    ['the back link', () => backLink(T['clients.title'])],
  ])('%s reopens the list on the same page, with the same rows', async (_, link) => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`)
    const rows = rowNames()
    expect(rows).toHaveLength(10)
    await openFirstClient(user)

    await user.click(link())

    await waitForList()
    expect(router.state.location.pathname).toBe(LIST_URL)
    expect(router.state.location.search).toBe(QUERY)
    expect(rowNames()).toEqual(rows)
  })

  it('the side menu opens the list from scratch', async () => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`)
    await openFirstClient(user)

    expect(href(menuLink(T['menu.clients']))).toBe(LIST_URL)
    await user.click(menuLink(T['menu.clients']))

    await waitForList()
    expect(router.state.location.search).toBe('')
    expect(rowNames()).toHaveLength(25)
  })

  it('after the side menu, the way back is the plain list again', async () => {
    const { user } = await openList(`${LIST_URL}${QUERY}`)
    await openFirstClient(user)
    await user.click(menuLink(T['menu.clients']))
    await waitForList()

    await openFirstClient(user)

    expect(href(crumb(T['clients.title']))).toBe(LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(LIST_URL)
  })

  it('a list opened without parameters: the way back is the plain path', async () => {
    const { user } = await openList(LIST_URL)

    await openFirstClient(user)

    expect(href(crumb(T['clients.title']))).toBe(LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(LIST_URL)
  })

  it('after clearing the search and the filter, the way back is the plain path again', async () => {
    const { router, user } = await openList(`${LIST_URL}?cerca=Ferri&tipo=company`)
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: FERRI_NAME }))
    await findHeading(FERRI_NAME)
    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}?cerca=Ferri&tipo=company`)
    await user.click(crumb(T['clients.title']))
    await waitForList()

    await user.clear(screen.getByRole('searchbox', { name: T['clients.search'] }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: T['clients.kind'] }),
      T['list.all'],
    )
    await waitFor(() => expect(router.state.location.search).toBe(''))
    await waitFor(() => expect(isBusy()).toBe('false'))
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: FERRI_NAME }))
    await findHeading(FERRI_NAME)

    expect(href(crumb(T['clients.title']))).toBe(LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(LIST_URL)
  })
})

describe('from the edit form back to the list', () => {
  it('the Clienti step has the parameters; the client step, the back link and Annulla go to the client', async () => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`)
    const rows = rowNames()
    const name = await openFirstClient(user)
    const clientUrl = router.state.location.pathname
    await user.click(linkOutsideBreadcrumbs(T['clients.edit'], main()))
    await findHeading(T['clients.editTitle'])

    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)
    expect(href(crumb(name))).toBe(clientUrl)
    expect(href(backLink(name))).toBe(clientUrl)
    expect(href(cancelLink())).toBe(clientUrl)

    await user.click(crumb(T['clients.title']))

    await waitForList()
    expect(router.state.location.search).toBe(QUERY)
    expect(rowNames()).toEqual(rows)
  })
})

describe('from the new client form back to the list', () => {
  it('the Clienti step, the back link and Annulla have the parameters the list had', async () => {
    const { user } = await openList(`${LIST_URL}${QUERY}`)

    await user.click(linkOutsideBreadcrumbs(T['clients.new'], main()))
    await findHeading(T['clients.new'])

    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)
    expect(href(backLink(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)
    expect(href(cancelLink())).toBe(`${LIST_URL}${QUERY}`)
  })

  it.each([
    ['Annulla', cancelLink],
    ['the back link', () => backLink(T['clients.title'])],
  ])('%s reopens the list as it was, without saving', async (_, link) => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`)
    const rows = rowNames()
    await user.click(linkOutsideBreadcrumbs(T['clients.new'], main()))
    await findHeading(T['clients.new'])

    await user.click(link())

    await waitForList()
    expect(router.state.location.search).toBe(QUERY)
    expect(rowNames()).toEqual(rows)
    expect(countRequests('POST', '/api/companies/impresa-rossi/clients')).toBe(0)
  })
})

describe('whose parameters', () => {
  it("another company's list does not have them, and the first company keeps its own", async () => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`)
    await openFirstClient(user)

    await act(() => router.navigate(`${VERDI_LIST_URL}/costruzioni-verdi-001`))
    await findHeading(FERRI_NAME)

    expect(href(crumb(T['clients.title']))).toBe(VERDI_LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(VERDI_LIST_URL)

    await act(() => router.navigate(FERRI_URL))
    await waitFor(() => expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`))
  })

  it('after a logout and a new sign-in, the way back is the plain path', async () => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`, { expireSessionOn401: true })
    const name = await openFirstClient(user)
    const clientUrl = router.state.location.pathname
    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)

    await user.click(screen.getByRole('button', { name: /Giulia Rossi/ }))
    await user.click(await screen.findByRole('menuitem', { name: T['logout.submit'] }))
    await screen.findByRole('heading', { name: T['login.title'] })
    await signIn(TITOLARE)
    await act(() => router.navigate(clientUrl))
    await findHeading(name)

    expect(href(crumb(T['clients.title']))).toBe(LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(LIST_URL)
  })

  it('after the session expires (401) and a new sign-in, the way back is the plain path', async () => {
    const { router, user } = await openList(`${LIST_URL}${QUERY}`, { expireSessionOn401: true })
    const name = await openFirstClient(user)
    const clientUrl = router.state.location.pathname
    expect(href(crumb(T['clients.title']))).toBe(`${LIST_URL}${QUERY}`)

    // A client not loaded yet: its request gets the 401
    deleteCookie('session')
    await act(() => router.navigate(`${LIST_URL}/impresa-rossi-003`))
    await screen.findByRole('heading', { name: T['login.title'] })
    expect(router.state.location.pathname).toBe('/accedi')
    await signIn(TITOLARE)
    await act(() => router.navigate(clientUrl))
    await findHeading(name)

    expect(href(crumb(T['clients.title']))).toBe(LIST_URL)
    expect(href(backLink(T['clients.title']))).toBe(LIST_URL)
  })
})
