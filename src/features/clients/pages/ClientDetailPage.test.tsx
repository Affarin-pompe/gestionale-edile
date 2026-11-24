// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { Me } from '@/auth/me'
import { messages } from '@/i18n/it'
import { db } from '@/mocks/db'
import { server } from '@/mocks/node'
import {
  linkOutsideBreadcrumbs,
  linksOutsideBreadcrumbs,
  renderApp,
  setupAppTests,
  signIn,
} from '@/test/app'
import { countRequests } from '@/test/cookies'
import { PHONE_WIDTH, setScreenWidth } from '@/test/media'
import type { Client } from '../api'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
const NEW_URL = `${LIST_URL}/nuovo`
const FERRI_URL = `${LIST_URL}/impresa-rossi-001`
const EDIT_URL = `${FERRI_URL}/modifica`
const ROSSI_CLIENTS_PATH = '/api/companies/impresa-rossi/clients'

const T = messages

const findHeading = (name: string) => screen.findByRole('heading', { name, level: 1 })
const main = () => screen.getByRole('main')
/** The page's link with this name; steps of the breadcrumbs never count. */
const queryLink = (name: string) => {
  const links = linksOutsideBreadcrumbs(name, main())
  if (links.length > 1) throw new Error(`More than one link "${name}" in the page`)
  return links[0] ?? null
}

/** Every label of the page with the value under it. */
function details() {
  return Object.fromEntries(
    Array.from(main().querySelectorAll('dt'), (dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]),
  )
}

/** The text of the Note section, without its title. */
function notes() {
  const section = screen
    .getByRole('heading', { name: T['clients.notes'], level: 2 })
    .closest('section')
  return section?.querySelector('p')?.textContent
}

/** A client of Impresa Rossi with only the required fields. */
const bareClient = (values: Partial<Client> = {}): Client => ({
  id: 'impresa-rossi-prova',
  kind: 'person',
  name: 'Mario Bianchi',
  vat_number: null,
  tax_code: 'BNCMRA80A01L219X',
  email: null,
  pec: null,
  phone: null,
  sdi_code: null,
  street: null,
  postal_code: null,
  city: null,
  province: null,
  country: 'IT',
  notes: null,
  archived_at: null,
  created_at: '2026-03-01T09:00:00.000Z',
  updated_at: '2026-03-01T09:00:00.000Z',
  ...values,
})

/** Puts a client in the mock backend; the setup starts over from the seed after each test. */
function addClient(client: Client) {
  ;(db.clients['impresa-rossi'] ??= []).push(client)
  return `${LIST_URL}/${client.id}`
}

async function open(url: string, email = TITOLARE) {
  await signIn(email)
  return renderApp(url)
}

async function expectNotFoundInLayout() {
  await findHeading(T['error.notFound.title'])
  // Inside the layout: the menu is still there
  expect(linkOutsideBreadcrumbs(T['menu.dashboard'])).toBeTruthy()
  expect(linkOutsideBreadcrumbs(T['menu.clients'])).toBeTruthy()
  expect(screen.getAllByRole('main')).toHaveLength(1)
}

describe('client page', () => {
  it('shows name, kind and every field of the client', async () => {
    await open(FERRI_URL)
    await findHeading('Edil Ferri S.r.l.')

    expect(within(main()).getByText(T['clients.kind.company'])).toBeTruthy()
    expect(details()).toEqual({
      [T['clients.vatNumber']]: '10000000000',
      [T['clients.taxCode']]: T['detail.empty'],
      [T['clients.sdiCode']]: 'ABC1234',
      [T['clients.email']]: 'cliente1@example.test',
      [T['clients.pec']]: 'cliente1@pec.example.test',
      [T['clients.phone']]: '011 555 1000',
      [T['clients.street']]: 'Via Ferri 1',
      [T['clients.city']]: '10121 Torino (TO)',
      [T['clients.country']]: 'Italia',
    })
    expect(notes()).toBe(T['detail.empty'])
  })

  it('links the email to write to it and the phone to call it', async () => {
    await open(FERRI_URL)
    await findHeading('Edil Ferri S.r.l.')

    const email = within(main()).getByRole('link', { name: 'cliente1@example.test' })
    expect(email.getAttribute('href')).toBe('mailto:cliente1@example.test')
    const phone = within(main()).getByRole('link', { name: '011 555 1000' })
    expect(decodeURI(phone.getAttribute('href') ?? '').replaceAll(' ', '')).toBe('tel:0115551000')
    // The PEC is not a link
    expect(queryLink('cliente1@pec.example.test')).toBeNull()
  })

  it('a client with only the required fields says "Non indicato" for the others, without links', async () => {
    const url = addClient(bareClient())
    await open(url)
    await findHeading('Mario Bianchi')

    expect(within(main()).getByText(T['clients.kind.person'])).toBeTruthy()
    expect(details()).toEqual({
      [T['clients.vatNumber']]: T['detail.empty'],
      [T['clients.taxCode']]: 'BNCMRA80A01L219X',
      [T['clients.sdiCode']]: T['detail.empty'],
      [T['clients.email']]: T['detail.empty'],
      [T['clients.pec']]: T['detail.empty'],
      [T['clients.phone']]: T['detail.empty'],
      [T['clients.street']]: T['detail.empty'],
      [T['clients.city']]: T['detail.empty'],
      [T['clients.country']]: 'Italia',
    })
    expect(notes()).toBe(T['detail.empty'])
    expect(main().querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  })

  it.each([
    [{ postal_code: '10121', city: 'Torino', province: 'TO' }, '10121 Torino (TO)'],
    [{ city: 'Torino' }, 'Torino'],
    [{ postal_code: '10121', city: 'Torino' }, '10121 Torino'],
    [{ city: 'Torino', province: 'TO' }, 'Torino (TO)'],
  ])('shows the place %o as "%s"', async (place, expected) => {
    const url = addClient(bareClient(place))
    await open(url)
    await findHeading('Mario Bianchi')

    expect(details()[T['clients.city']]).toBe(expected)
  })

  it('shows the notes', async () => {
    const url = addClient(bareClient({ notes: 'Pagamento a 60 giorni.' }))
    await open(url)
    await findHeading('Mario Bianchi')

    expect(notes()).toBe('Pagamento a 60 giorni.')
  })

  it('the back link goes to the list', async () => {
    const { router, user } = await open(FERRI_URL)
    await findHeading('Edil Ferri S.r.l.')

    await user.click(linkOutsideBreadcrumbs(T['clients.title'], main()))

    await waitFor(() => expect(router.state.location.pathname).toBe(LIST_URL))
    await findHeading(T['clients.title'])
  })
})

describe('who can add and change clients', () => {
  it('titolare sees "Nuovo cliente" in the list and "Modifica" on a client', async () => {
    const { user } = await open(LIST_URL)
    await screen.findByText('60 risultati')

    expect(queryLink(T['clients.new'])?.getAttribute('href')).toBe(NEW_URL)

    await user.click(screen.getByRole('link', { name: 'Edil Ferri S.r.l.' }))
    await findHeading('Edil Ferri S.r.l.')

    expect(queryLink(T['clients.edit'])?.getAttribute('href')).toBe(EDIT_URL)
  })

  it('capocantiere, who can only view, has no "Nuovo cliente" in the list', async () => {
    await open(LIST_URL, CAPOCANTIERE)
    await screen.findByText('60 risultati')

    expect(queryLink(T['clients.new'])).toBeNull()
    expect(screen.queryByRole('button', { name: T['clients.new'] })).toBeNull()
  })

  it('capocantiere opens a client, without "Modifica"', async () => {
    await open(FERRI_URL, CAPOCANTIERE)
    await findHeading('Edil Ferri S.r.l.')

    expect(details()[T['clients.vatNumber']]).toBe('10000000000')
    expect(queryLink(T['clients.edit'])).toBeNull()
    expect(screen.queryByRole('button', { name: T['clients.edit'] })).toBeNull()
  })

  it.each([
    ['the new client form', NEW_URL],
    ['the edit form', EDIT_URL],
  ])('capocantiere opening %s directly gets the not-found page', async (_, url) => {
    const { router } = await open(url, CAPOCANTIERE)

    await expectNotFoundInLayout()
    expect(screen.queryByRole('button', { name: T['form.save'] })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(router.state.location.pathname).toBe(url)
  })

  it('who can change clients but not see them gets the not-found page on the edit form, without loading the client', async () => {
    const updateOnly: Me = {
      id: 'u-test-solo-modifica',
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
    await signIn(TITOLARE)
    server.use(http.get('*/api/me', () => HttpResponse.json(updateOnly)))
    const { router } = renderApp(EDIT_URL)

    await findHeading(T['error.notFound.title'])
    expect(linkOutsideBreadcrumbs(T['menu.dashboard'])).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: T['form.save'] })).toBeNull()
    expect(router.state.location.pathname).toBe(EDIT_URL)
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/impresa-rossi-001`)).toBe(0)
  })
})

describe('clients that cannot be opened', () => {
  it.each([
    ['a client of another company', 'costruzioni-verdi-001', ''],
    ['a client of another company', 'costruzioni-verdi-001', '/modifica'],
    ['a client that does not exist', 'impresa-rossi-999', ''],
    ['a client that does not exist', 'impresa-rossi-999', '/modifica'],
  ])('%s (%s%s) gets the not-found page, after one request', async (_, id, suffix) => {
    const url = `${LIST_URL}/${id}${suffix}`
    const { router } = await open(url)

    await expectNotFoundInLayout()
    expect(screen.queryByRole('heading', { name: 'Edil Ferri S.r.l.' })).toBeNull()
    expect(screen.queryByRole('button', { name: T['form.save'] })).toBeNull()
    expect(router.state.location.pathname).toBe(url)
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/${id}`)).toBe(1)
  })

  it('the same client opens under its own company', async () => {
    await open('/costruzioni-verdi/anagrafiche/clienti/costruzioni-verdi-001')

    await findHeading('Edil Ferri S.r.l.')
    expect(details()[T['clients.vatNumber']]).toBe('20000000000')
  })

  it('/nuovo is the new client form, not a client called "nuovo"', async () => {
    await open(NEW_URL)

    await findHeading(T['clients.new'])
    expect(screen.getByRole('button', { name: T['form.save'] })).toBeTruthy()
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/nuovo`)).toBe(0)
  })
})

describe('opening a client from the list', () => {
  it("the name in the table links to the client's page", async () => {
    const { router, user } = await open(LIST_URL)
    await screen.findByText('60 risultati')
    const row = screen.getByRole('row', { name: /^Anna Ricci/ })

    await user.click(within(row).getByRole('link', { name: 'Anna Ricci' }))

    await findHeading('Anna Ricci')
    expect(router.state.location.pathname).toBe(`${LIST_URL}/impresa-rossi-003`)
  })

  it("on a phone, each card is a link named after the client, to the client's page", async () => {
    setScreenWidth(PHONE_WIDTH)
    const { router, user } = await open(LIST_URL)
    await screen.findByText('60 risultati')
    const card = screen
      .getByRole('heading', { name: 'Edil Ferri S.r.l.', level: 2 })
      .closest('article')
    if (!card) throw new Error('No card for Edil Ferri S.r.l.')

    const links = within(card).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Edil Ferri S.r.l.'])
    expect(within(card).getByRole('link', { name: 'Edil Ferri S.r.l.' })).toBe(links[0])
    await user.click(links[0] as HTMLElement)

    await findHeading('Edil Ferri S.r.l.')
    expect(router.state.location.pathname).toBe(FERRI_URL)
  })
})
