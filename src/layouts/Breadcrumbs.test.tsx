// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { messages } from '@/i18n/it'
import { db } from '@/mocks/db'
import { server } from '@/mocks/node'
import { breadcrumbs, renderApp, setupAppTests, signIn } from '@/test/app'
import { countRequests } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const DASHBOARD_URL = '/impresa-rossi'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
const NEW_URL = `${LIST_URL}/nuovo`
const FERRI_NAME = 'Edil Ferri S.r.l.'
const FERRI_URL = `${LIST_URL}/impresa-rossi-001`
const EDIT_URL = `${FERRI_URL}/modifica`
const ROSSI_CLIENTS_PATH = '/api/companies/impresa-rossi/clients'
const CLIENT_API = '*/api/companies/:company/clients/:client'

const T = messages

const findHeading = (name: string) => screen.findByRole('heading', { name, level: 1 })
const textbox = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name })

/** Each step of the breadcrumbs, as a link: its text, where it goes and whether it is the page. */
function steps() {
  return within(breadcrumbs())
    .getAllByRole('link')
    .map((step) => ({
      text: step.textContent,
      href: step.getAttribute('href'),
      current: step.getAttribute('aria-current'),
      disabled: step.getAttribute('aria-disabled'),
    }))
}
/** A step before the last: a real link. */
const link = (text: string, href: string) => ({ text, href, current: null, disabled: null })
/** The last step, the page itself: a link role without a target. */
const here = (text: string) => ({ text, href: null, current: 'page', disabled: 'true' })

const dashboard = link(T['menu.dashboard'], DASHBOARD_URL)
const clients = link(T['clients.title'], LIST_URL)

async function open(url: string) {
  await signIn(TITOLARE)
  return renderApp(url)
}

describe('breadcrumbs of each page', () => {
  it('the dashboard is the only step on the dashboard', async () => {
    await open(DASHBOARD_URL)

    await waitFor(() => expect(steps()).toEqual([here(T['menu.dashboard'])]))
  })

  it('the client list: Dashboard › Clienti', async () => {
    await open(LIST_URL)
    await findHeading(T['clients.title'])

    expect(steps()).toEqual([dashboard, here(T['clients.title'])])
  })

  it('the list with parameters is still the page itself', async () => {
    await open(`${LIST_URL}?pagina=2&ordine=-name`)
    await findHeading(T['clients.title'])

    expect(steps()).toEqual([dashboard, here(T['clients.title'])])
  })

  it('a new client: Dashboard › Clienti › Nuovo cliente', async () => {
    await open(NEW_URL)
    await findHeading(T['clients.new'])

    expect(steps()).toEqual([dashboard, clients, here(T['clients.new'])])
  })

  it("a client: Dashboard › Clienti › the client's name", async () => {
    await open(FERRI_URL)
    await findHeading(FERRI_NAME)

    expect(steps()).toEqual([dashboard, clients, here(FERRI_NAME)])
  })

  it("editing a client: Dashboard › Clienti › the client's name › Modifica", async () => {
    await open(EDIT_URL)
    await findHeading(T['clients.editTitle'])

    expect(steps()).toEqual([
      dashboard,
      clients,
      link(FERRI_NAME, FERRI_URL),
      here(T['clients.edit']),
    ])
  })

  it('the separators between the steps are not read', async () => {
    await open(EDIT_URL)
    await findHeading(T['clients.editTitle'])

    const separators = breadcrumbs().querySelectorAll('[data-slot="breadcrumb-separator"]')
    expect(separators).toHaveLength(3)
    for (const separator of separators) {
      expect(separator.getAttribute('aria-hidden')).toBe('true')
    }
    expect(within(breadcrumbs()).getAllByRole('listitem')).toHaveLength(4)
  })

  it('the steps of another company go to that company', async () => {
    const verdi = '/costruzioni-verdi/anagrafiche/clienti'
    await open(`${verdi}/costruzioni-verdi-001/modifica`)
    await findHeading(T['clients.editTitle'])

    expect(steps()).toEqual([
      link(T['menu.dashboard'], '/costruzioni-verdi'),
      link(T['clients.title'], verdi),
      link(FERRI_NAME, `${verdi}/costruzioni-verdi-001`),
      here(T['clients.edit']),
    ])
  })

  it.each([
    '/impresa-rossi/qualcosa',
    '/impresa-rossi/anagrafiche',
    '/impresa-rossi/anagrafiche/clienti/impresa-rossi-001/qualcosa',
  ])('a path the company does not have (%s): Dashboard › Non trovato', async (url) => {
    await open(url)

    await findHeading(T['error.notFound.title'])
    expect(steps()).toEqual([dashboard, here(T['crumb.notFound'])])
  })
})

describe('moving with the breadcrumbs', () => {
  it('each step opens its page, up to the dashboard', async () => {
    const { router, user } = await open(EDIT_URL)
    await findHeading(T['clients.editTitle'])

    await user.click(within(breadcrumbs()).getByRole('link', { name: FERRI_NAME }))
    await findHeading(FERRI_NAME)
    expect(router.state.location.pathname).toBe(FERRI_URL)
    expect(steps()).toEqual([dashboard, clients, here(FERRI_NAME)])

    await user.click(within(breadcrumbs()).getByRole('link', { name: T['clients.title'] }))
    await findHeading(T['clients.title'])
    expect(router.state.location.pathname).toBe(LIST_URL)
    expect(steps()).toEqual([dashboard, here(T['clients.title'])])

    await user.click(within(breadcrumbs()).getByRole('link', { name: T['menu.dashboard'] }))
    await waitFor(() => expect(router.state.location.pathname).toBe(DASHBOARD_URL))
    await waitFor(() => expect(steps()).toEqual([here(T['menu.dashboard'])]))
  })

  it('the last step does not navigate', async () => {
    const { router, user } = await open(FERRI_URL)
    await findHeading(FERRI_NAME)

    await user.click(within(breadcrumbs()).getByRole('link', { name: FERRI_NAME }))

    expect(router.state.location.pathname).toBe(FERRI_URL)
    // Still the first entry: no navigation, not even to the same URL
    expect(router.state.historyAction).toBe('POP')
    expect(router.state.navigation.state).toBe('idle')
  })
})

describe("the client's step", () => {
  it('follows the client loaded again, while it stays on screen', async () => {
    const { queryClient } = await open(FERRI_URL)
    await findHeading(FERRI_NAME)
    // Renamed elsewhere; the page then loads its data again (as when the window gets focus)
    const ferri = db.clients['impresa-rossi']?.find((c) => c.id === 'impresa-rossi-001')
    if (!ferri) throw new Error('No client impresa-rossi-001 in the seed data')
    ferri.name = 'Edil Ferri Costruzioni S.r.l.'

    await act(() => queryClient.invalidateQueries())

    await findHeading('Edil Ferri Costruzioni S.r.l.')
    expect(steps()).toEqual([dashboard, clients, here('Edil Ferri Costruzioni S.r.l.')])
  })

  it('after saving a new name, shows the new name without loading the client again', async () => {
    const { router, user } = await open(EDIT_URL)
    await findHeading(T['clients.editTitle'])
    await user.clear(textbox(T['clients.name']))
    await user.type(textbox(T['clients.name']), 'Edil Ferri e Figli S.r.l.')
    // Typing is not saving: the step keeps the saved name
    expect(steps()[2]).toEqual(link(FERRI_NAME, FERRI_URL))

    await user.click(screen.getByRole('button', { name: T['form.save'] }))

    await findHeading('Edil Ferri e Figli S.r.l.')
    expect(router.state.location.pathname).toBe(FERRI_URL)
    expect(steps()).toEqual([dashboard, clients, here('Edil Ferri e Figli S.r.l.')])
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/impresa-rossi-001`)).toBe(1)

    // And on the edit form, opened again
    await user.click(screen.getByRole('link', { name: T['clients.edit'] }))
    await findHeading(T['clients.editTitle'])
    expect(steps()[2]).toEqual(link('Edil Ferri e Figli S.r.l.', FERRI_URL))
  })

  it.each([
    ['a client of another company', 'costruzioni-verdi-001'],
    ['a client that does not exist', 'impresa-rossi-999'],
  ])('%s says "Non trovato", after one request', async (_, id) => {
    const url = `${LIST_URL}/${id}`
    await open(url)

    await findHeading(T['error.notFound.title'])
    expect(steps()).toEqual([dashboard, clients, here(T['crumb.notFound'])])
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/${id}`)).toBe(1)
  })

  it.each([
    ['a client of another company', 'costruzioni-verdi-001'],
    ['a client that does not exist', 'impresa-rossi-999'],
  ])('%s, on its edit form, says "Non trovato" › Modifica, after one request', async (_, id) => {
    const url = `${LIST_URL}/${id}`
    await open(`${url}/modifica`)

    await findHeading(T['error.notFound.title'])
    expect(steps()).toEqual([
      dashboard,
      clients,
      link(T['crumb.notFound'], url),
      here(T['clients.edit']),
    ])
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/${id}`)).toBe(1)
  })

  // Only a 404 says the client is not there: after another error the step is just "Cliente"
  it('a server error loading the client says "Cliente", on the generic error page', async () => {
    server.use(
      http.get(CLIENT_API, () => HttpResponse.json({ message: 'Errore' }, { status: 500 })),
    )
    await open(FERRI_URL)

    await findHeading(T['error.generic.title'])
    expect(steps()).toEqual([dashboard, clients, here(T['clients.one'])])
    expect(screen.queryByText(T['crumb.notFound'])).toBeNull()
  })

  it('a server error on the edit form says "Cliente" › Modifica', async () => {
    server.use(
      http.get(CLIENT_API, () => HttpResponse.json({ message: 'Errore' }, { status: 500 })),
    )
    await open(EDIT_URL)

    await findHeading(T['error.generic.title'])
    expect(steps()).toEqual([
      dashboard,
      clients,
      link(T['clients.one'], FERRI_URL),
      here(T['clients.edit']),
    ])
  })

  it('a network failure loading the client says "Cliente"', async () => {
    server.use(http.get(CLIENT_API, () => HttpResponse.error()))
    await open(FERRI_URL)

    await findHeading(T['error.generic.title'])
    expect(steps()).toEqual([dashboard, clients, here(T['clients.one'])])
  })

  it('a 403 loading the client says "Cliente", on the forbidden page', async () => {
    server.use(
      http.get(CLIENT_API, () =>
        HttpResponse.json({ message: 'Il tuo ruolo non permette questa azione.' }, { status: 403 }),
      ),
    )
    await open(FERRI_URL)

    await findHeading(T['error.forbidden.title'])
    expect(steps()).toEqual([dashboard, clients, here(T['clients.one'])])
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/impresa-rossi-001`)).toBe(1)
  })
})
