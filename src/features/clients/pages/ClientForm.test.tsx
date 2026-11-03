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
import { clientFormValues } from '../schemas'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
const NEW_URL = `${LIST_URL}/nuovo`
const FERRI_ID = 'impresa-rossi-001'
/** impresa-rossi-001 in src/mocks/data.ts */
const FERRI_NAME = 'Edil Ferri S.r.l.'
const FERRI_URL = `${LIST_URL}/${FERRI_ID}`
const EDIT_URL = `${FERRI_URL}/modifica`
const CLIENTS_API = '*/api/companies/:company/clients'
const CLIENT_API = '*/api/companies/:company/clients/:client'
const ROSSI_CLIENTS_PATH = '/api/companies/impresa-rossi/clients'
const FERRI_API_PATH = `${ROSSI_CLIENTS_PATH}/${FERRI_ID}`

const T = messages

const findHeading = (name: string) => screen.findByRole('heading', { name, level: 1 })
const textbox = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name })
const kindSelect = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: T['clients.kind'] })
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: T['form.save'] })
const main = () => screen.getByRole('main')
/** The link above the title, back to where the page belongs: the list unless named otherwise. */
/** The page's back link; a step of the breadcrumbs with its name never counts. */
const backLink = (name: string = T['clients.title']) => linkOutsideBreadcrumbs(name, main())

/** The error shown in the same field as the input, or null. */
function errorIn(input: HTMLElement) {
  const field = input.closest('[data-slot="field"]')
  return field?.querySelector('[data-slot="field-error"]')?.textContent ?? null
}

/** Every field of the form that shows an error, by label. */
function invalidFields() {
  return Array.from(main().querySelectorAll('[data-slot="field"]'))
    .filter((field) => field.querySelector('[data-slot="field-error"]'))
    .map((field) => field.querySelector('label')?.textContent?.replace('*', ''))
}

/** The messages above the buttons: alerts of the form that belong to no field. */
function formProblems() {
  const form = main().querySelector('form')
  if (!form) throw new Error('No form on the page')
  return within(form)
    .queryAllByRole('alert')
    .filter((alert) => alert.getAttribute('data-slot') !== 'field-error')
}

async function openNewForm(email = TITOLARE) {
  await signIn(email)
  const app = renderApp(NEW_URL)
  await findHeading(T['clients.new'])
  return app
}

async function openEditForm() {
  await signIn(TITOLARE)
  const app = renderApp(EDIT_URL)
  await findHeading(T['clients.editTitle'])
  return app
}

/** The JSON body of every client POST and PUT, in order; the mock still answers them. */
function recordSavedBodies() {
  const bodies: unknown[] = []
  const record = async ({ request }: { request: Request }) => {
    bodies.push(await request.clone().json())
  }
  server.use(http.post(CLIENTS_API, record), http.put(CLIENT_API, record))
  return bodies
}

/** Until the returned function is called, a new client's POST waits; then the mock answers. */
function holdCreate() {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.post(CLIENTS_API, async () => {
      await released
    }),
  )
  return release
}

describe('new client, checks before saving', () => {
  it('an empty form sends nothing and says what is missing under Nome and Partita IVA', async () => {
    const { user } = await openNewForm()

    await user.click(saveButton())

    await waitFor(() => expect(errorIn(textbox(T['clients.name']))).toBe(T['validation.required']))
    expect(errorIn(textbox(T['clients.vatNumber']))).toBe(T['clients.vatRequired'])
    expect(invalidFields()).toEqual([T['clients.name'], T['clients.vatNumber']])
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(0)
  })

  it('marks the missing fields as invalid and points them at their error', async () => {
    const { user } = await openNewForm()

    await user.click(saveButton())

    const name = textbox(T['clients.name'])
    const vat = textbox(T['clients.vatNumber'])
    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    expect(vat.getAttribute('aria-invalid')).toBe('true')
    for (const input of [name, vat]) {
      const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
      const described = ids.map((id) => document.getElementById(id)?.textContent)
      expect(described).toContain(errorIn(input))
    }
    // The hint under Nome is still read, next to the error
    const hint = T['clients.name.hint']
    expect(screen.getByRole('textbox', { description: (text) => text.includes(hint) })).toBe(name)
    expect(textbox(T['clients.taxCode']).hasAttribute('aria-invalid')).toBe(false)
    expect(textbox(T['clients.taxCode']).hasAttribute('aria-describedby')).toBe(false)
  })

  it('moves the focus to the first missing field', async () => {
    const { user } = await openNewForm()

    await user.click(saveButton())

    await waitFor(() => expect(document.activeElement).toBe(textbox(T['clients.name'])))
  })

  it('after a failed save, choosing Privato asks for the tax code instead of the VAT number', async () => {
    const { user } = await openNewForm()
    await user.click(saveButton())
    await waitFor(() => expect(errorIn(textbox(T['clients.vatNumber']))).not.toBeNull())

    await user.selectOptions(kindSelect(), T['clients.kind.person'])

    await waitFor(() =>
      expect(errorIn(textbox(T['clients.taxCode']))).toBe(T['clients.taxCodeRequired']),
    )
    expect(errorIn(textbox(T['clients.vatNumber']))).toBeNull()
    expect(textbox(T['clients.vatNumber']).hasAttribute('aria-invalid')).toBe(false)
    expect(invalidFields()).toEqual([T['clients.name'], T['clients.taxCode']])
  })

  it('marks as required the VAT number of a company and the tax code of a person', async () => {
    const { user } = await openNewForm()
    const required = (name: string) => textbox(name).getAttribute('aria-required')

    expect(kindSelect().value).toBe('company')
    expect(required(T['clients.vatNumber'])).toBe('true')
    expect(required(T['clients.taxCode'])).toBeNull()

    await user.selectOptions(kindSelect(), T['clients.kind.person'])

    await waitFor(() => expect(required(T['clients.taxCode'])).toBe('true'))
    expect(required(T['clients.vatNumber'])).toBeNull()
    expect(required(T['clients.name'])).toBe('true')
    expect(kindSelect().getAttribute('aria-required')).toBe('true')

    await user.selectOptions(kindSelect(), T['clients.kind.company'])

    await waitFor(() => expect(required(T['clients.vatNumber'])).toBe('true'))
    expect(required(T['clients.taxCode'])).toBeNull()
  })
})

describe('new client, answers of the backend', () => {
  it('a VAT number already used shows the message of the backend under Partita IVA, focused', async () => {
    const { router, user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    // The VAT number of Edil Ferri S.r.l. in the mock data
    await user.type(textbox(T['clients.vatNumber']), '10000000000')

    await user.click(saveButton())

    const vat = textbox(T['clients.vatNumber'])
    await waitFor(() => expect(errorIn(vat)).toBe('Esiste già un cliente con questa partita IVA.'))
    expect(vat.getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(vat))
    expect(invalidFields()).toEqual([T['clients.vatNumber']])
    expect(formProblems()).toEqual([])
    expect(router.state.location.pathname).toBe(NEW_URL)
    expect(screen.queryByText(T['clients.created'])).toBeNull()
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(1)
  })

  it('an error on a field the form does not have is shown above the buttons', async () => {
    server.use(
      http.post(CLIENTS_API, () =>
        HttpResponse.json(
          {
            message: 'Controlla i dati inseriti.',
            errors: { 'address.region': ['Regione non valida.'] },
          },
          { status: 422 },
        ),
      ),
    )
    const { router, user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    await waitFor(() => expect(formProblems()).toHaveLength(1))
    const [problem] = formProblems()
    expect(problem?.textContent).toBe('Regione non valida.')
    expect(problem?.getAttribute('role')).toBe('alert')
    // Above the buttons
    expect(problem?.compareDocumentPosition(saveButton())).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(invalidFields()).toEqual([])
    expect(router.state.location.pathname).toBe(NEW_URL)
  })

  it.each([
    [
      'Nome, after Email and Provincia',
      {
        province: ['Al massimo 2 caratteri.'],
        email: ['Indirizzo non valido.'],
        name: ['Esiste già un cliente con questo nome.'],
      },
      T['clients.name'],
    ],
    [
      'Partita IVA, after Provincia',
      {
        province: ['Al massimo 2 caratteri.'],
        vat_number: ['Esiste già un cliente con questa partita IVA.'],
      },
      T['clients.vatNumber'],
    ],
  ])(
    'a 422 listing %s puts each message under its field and focuses the first in the form',
    async (_, errors, first) => {
      server.use(
        http.post(CLIENTS_API, () =>
          HttpResponse.json({ message: 'Controlla i dati inseriti.', errors }, { status: 422 }),
        ),
      )
      const { user } = await openNewForm()
      await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
      await user.type(textbox(T['clients.vatNumber']), '01234567890')

      await user.click(saveButton())

      const labels: Record<string, string> = {
        name: T['clients.name'],
        vat_number: T['clients.vatNumber'],
        email: T['clients.email'],
        province: T['clients.province'],
      }
      await waitFor(() => expect(invalidFields()).toHaveLength(Object.keys(errors).length))
      for (const [field, [message]] of Object.entries(errors)) {
        expect(errorIn(textbox(labels[field] ?? field))).toBe(message)
      }
      await waitFor(() => expect(document.activeElement).toBe(textbox(first)))
      expect(formProblems()).toEqual([])
    },
  )

  it('a 422 on fields of the form and on one it lacks: messages under the fields and above the buttons', async () => {
    server.use(
      http.post(CLIENTS_API, () =>
        HttpResponse.json(
          {
            message: 'Controlla i dati inseriti.',
            errors: {
              'address.region': ['Regione non valida.'],
              city: ['Comune sconosciuto.'],
              vat_number: ['Partita IVA non valida.'],
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    await waitFor(() =>
      expect(formProblems().map((p) => p.textContent)).toEqual(['Regione non valida.']),
    )
    expect(errorIn(textbox(T['clients.vatNumber']))).toBe('Partita IVA non valida.')
    expect(errorIn(textbox(T['clients.city']))).toBe('Comune sconosciuto.')
    await waitFor(() => expect(document.activeElement).toBe(textbox(T['clients.vatNumber'])))
  })

  it('shows the fields in the order of clientFormValues, which a 422 follows to pick the focus', async () => {
    await openNewForm()

    const form = main().querySelector('form')
    const names = Array.from(form?.elements ?? [], (control) => control.getAttribute('name'))
    expect(names.filter(Boolean)).toEqual(Object.keys(clientFormValues()))
  })

  it.each([
    ['an empty list of errors', { message: 'Dati non validi.', errors: {} }],
    ['no list of errors', { message: 'Dati non validi.' }],
  ])('a 422 with %s says to check the data', async (_, body) => {
    server.use(http.post(CLIENTS_API, () => HttpResponse.json(body, { status: 422 })))
    const { user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    await waitFor(() =>
      expect(formProblems().map((p) => p.textContent)).toEqual([T['form.invalid']]),
    )
    expect(invalidFields()).toEqual([])
  })

  it.each([
    [
      'a 403',
      () =>
        HttpResponse.json({ message: 'Il tuo ruolo non permette questa azione.' }, { status: 403 }),
      T['form.forbidden'],
    ],
    ['a 500', () => HttpResponse.json({ message: 'Errore' }, { status: 500 }), T['form.failed']],
    ['a network error', () => HttpResponse.error(), T['form.failed']],
  ])('%s keeps the page and the values, says so, and is not retried', async (_, answer, text) => {
    server.use(http.post(CLIENTS_API, answer))
    const { router, user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')
    await user.type(textbox(T['clients.city']), 'Torino')

    await user.click(saveButton())

    await waitFor(() => expect(formProblems().map((p) => p.textContent)).toEqual([text]))
    expect(router.state.location.pathname).toBe(NEW_URL)
    expect(screen.getByRole('heading', { name: T['clients.new'], level: 1 })).toBeTruthy()
    expect(textbox(T['clients.name']).value).toBe('Nuova Edil S.r.l.')
    expect(textbox(T['clients.vatNumber']).value).toBe('01234567890')
    expect(textbox(T['clients.city']).value).toBe('Torino')
    expect(saveButton().disabled).toBe(false)
    expect(screen.queryByText(T['clients.created'])).toBeNull()
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(1)
  })

  it('a role the backend no longer allows to add clients gets the 403 message', async () => {
    // The menu still says clients.create, but the backend knows the role has only clients.view
    const stale: Me = {
      id: 'u-capocantiere',
      name: 'Marco Neri',
      email: CAPOCANTIERE,
      companies: [
        {
          slug: 'impresa-rossi',
          name: 'Impresa Rossi S.r.l.',
          role: 'Capo cantiere',
          permissions: ['clients.view', 'clients.create'],
        },
      ],
    }
    server.use(http.get('*/api/me', () => HttpResponse.json(stale)))
    const { user } = await openNewForm(CAPOCANTIERE)
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    await waitFor(() =>
      expect(formProblems().map((p) => p.textContent)).toEqual([T['form.forbidden']]),
    )
    expect(textbox(T['clients.name']).value).toBe('Nuova Edil S.r.l.')
  })

  it('after a failure, saving again sends the client again', async () => {
    let failing = true
    server.use(
      http.post(CLIENTS_API, () =>
        failing ? HttpResponse.json({ message: 'Errore' }, { status: 500 }) : undefined,
      ),
    )
    const { router, user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')
    await user.click(saveButton())
    await waitFor(() => expect(formProblems()).toHaveLength(1))

    failing = false
    await user.click(saveButton())

    await waitFor(() => expect(router.state.location.pathname).not.toBe(NEW_URL))
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(2)
  })
})

describe('new client, saving', () => {
  it('while saving, the button is disabled and says so', async () => {
    const release = holdCreate()
    const { router, user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    const saving = await screen.findByRole<HTMLButtonElement>('button', { name: T['form.saving'] })
    expect(saving.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: T['form.save'] })).toBeNull()
    await user.click(saving)

    release()
    await waitFor(() => expect(router.state.location.pathname).not.toBe(NEW_URL))
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(1)
  })

  it('sends the text trimmed, and null for the empty fields', async () => {
    const bodies = recordSavedBodies()
    const { user } = await openNewForm()
    await user.type(textbox(T['clients.name']), '  Nuova Edil S.r.l.  ')
    await user.type(textbox(T['clients.vatNumber']), ' 01234567890 ')
    await user.type(textbox(T['clients.email']), ' info@nuovaedil.example.test')
    await user.type(textbox(T['clients.street']), '   ')
    await user.type(textbox(T['clients.city']), ' Torino ')

    await user.click(saveButton())

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      kind: 'company',
      name: 'Nuova Edil S.r.l.',
      vat_number: '01234567890',
      tax_code: null,
      email: 'info@nuovaedil.example.test',
      pec: null,
      phone: null,
      sdi_code: null,
      street: null,
      postal_code: null,
      city: 'Torino',
      province: null,
      notes: null,
    })
  })

  it('says "Cliente aggiunto." and opens the new client, with its data', async () => {
    const { router, user } = await openNewForm()
    await user.selectOptions(kindSelect(), T['clients.kind.person'])
    await user.type(textbox(T['clients.name']), 'Mario Bianchi')
    await user.type(textbox(T['clients.taxCode']), 'BNCMRA80A01L219X')
    await user.type(textbox(T['clients.city']), 'Asti')

    await user.click(saveButton())

    expect(await screen.findByText(T['clients.created'])).toBeTruthy()
    await findHeading('Mario Bianchi')
    const created = db.clients['impresa-rossi']?.at(-1)
    expect(created?.name).toBe('Mario Bianchi')
    expect(router.state.location.pathname).toBe(`${LIST_URL}/${created?.id}`)
    expect(screen.getByText('BNCMRA80A01L219X')).toBeTruthy()
    expect(screen.getByText('Asti')).toBeTruthy()
    expect(screen.getByText(T['clients.kind.person'])).toBeTruthy()
    // The notice outlives the page change
    expect(screen.getByText(T['clients.created'])).toBeTruthy()
  })

  it('opens the new client with the answer of the save, without loading it again', async () => {
    const { user } = await openNewForm()
    await user.type(textbox(T['clients.name']), 'Nuova Edil S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')

    await user.click(saveButton())

    await findHeading('Nuova Edil S.r.l.')
    const created = db.clients['impresa-rossi']?.at(-1)
    expect(countRequests('GET', `${ROSSI_CLIENTS_PATH}/${created?.id}`)).toBe(0)
  })

  it('the list, loaded before, then includes the new client', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp(LIST_URL)
    await screen.findByText('60 risultati')
    await user.click(linkOutsideBreadcrumbs(T['clients.new'], main()))
    await findHeading(T['clients.new'])
    // First by name, so it is on page 1
    await user.type(textbox(T['clients.name']), 'Abete Costruzioni S.r.l.')
    await user.type(textbox(T['clients.vatNumber']), '01234567890')
    await user.click(saveButton())
    await findHeading('Abete Costruzioni S.r.l.')

    await user.click(backLink())

    await screen.findByText('61 risultati')
    expect(router.state.location.pathname).toBe(LIST_URL)
    const firstRow = screen.getByRole('table').querySelector('tbody tr td')
    expect(firstRow?.textContent).toBe('Abete Costruzioni S.r.l.')
  })
})

describe('editing a client', () => {
  it("starts with the client's values", async () => {
    await openEditForm()

    expect(kindSelect().value).toBe('company')
    const values = Object.fromEntries(
      [
        'clients.name',
        'clients.vatNumber',
        'clients.taxCode',
        'clients.sdiCode',
        'clients.email',
        'clients.pec',
        'clients.phone',
        'clients.street',
        'clients.postalCode',
        'clients.city',
        'clients.province',
        'clients.notes',
      ].map((id) => [id, textbox(T[id as keyof typeof T]).value]),
    )
    expect(values).toEqual({
      'clients.name': FERRI_NAME,
      'clients.vatNumber': '10000000000',
      'clients.taxCode': '',
      'clients.sdiCode': 'ABC1234',
      'clients.email': 'cliente1@example.test',
      'clients.pec': 'cliente1@pec.example.test',
      'clients.phone': '011 555 1000',
      'clients.street': 'Via Ferri 1',
      'clients.postalCode': '10121',
      'clients.city': 'Torino',
      'clients.province': 'TO',
      'clients.notes': '',
    })
  })

  it('sends every field with PUT, changed or not', async () => {
    const bodies = recordSavedBodies()
    const { user } = await openEditForm()
    await user.clear(textbox(T['clients.name']))
    await user.type(textbox(T['clients.name']), 'Edil Ferri e Figli S.r.l.')
    await user.clear(textbox(T['clients.pec']))
    await user.type(textbox(T['clients.notes']), 'Cliente dal 2020.')

    await user.click(saveButton())

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      kind: 'company',
      name: 'Edil Ferri e Figli S.r.l.',
      vat_number: '10000000000',
      tax_code: null,
      email: 'cliente1@example.test',
      pec: null,
      phone: '011 555 1000',
      sdi_code: 'ABC1234',
      street: 'Via Ferri 1',
      postal_code: '10121',
      city: 'Torino',
      province: 'TO',
      notes: 'Cliente dal 2020.',
    })
    expect(countRequests('PUT', FERRI_API_PATH)).toBe(1)
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(0)
  })

  it('keeping its own VAT number is not a duplicate', async () => {
    const { router, user } = await openEditForm()
    await user.clear(textbox(T['clients.city']))
    await user.type(textbox(T['clients.city']), 'Asti')

    await user.click(saveButton())

    await waitFor(() => expect(router.state.location.pathname).toBe(FERRI_URL))
    expect(invalidFields()).toEqual([])
  })

  it('says "Modifiche salvate." and the client page shows the new values', async () => {
    const { router, user } = await openEditForm()
    await user.clear(textbox(T['clients.name']))
    await user.type(textbox(T['clients.name']), 'Edil Ferri e Figli S.r.l.')
    await user.clear(textbox(T['clients.city']))
    await user.type(textbox(T['clients.city']), 'Asti')

    await user.click(saveButton())

    expect(await screen.findByText(T['clients.updated'])).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe(FERRI_URL))
    await findHeading('Edil Ferri e Figli S.r.l.')
    expect(screen.getByText('10121 Asti (TO)')).toBeTruthy()
    expect(screen.queryByText('10121 Torino (TO)')).toBeNull()
  })

  it('the list, loaded before, then shows the new values', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp(LIST_URL)
    await screen.findByText('60 risultati')
    await user.click(screen.getByRole('link', { name: FERRI_NAME }))
    await findHeading(FERRI_NAME)
    await user.click(linkOutsideBreadcrumbs(T['clients.edit'], main()))
    await findHeading(T['clients.editTitle'])
    await user.clear(textbox(T['clients.name']))
    await user.type(textbox(T['clients.name']), 'Edil Ferri e Figli S.r.l.')
    await user.clear(textbox(T['clients.city']))
    await user.type(textbox(T['clients.city']), 'Asti')
    await user.click(saveButton())
    await findHeading('Edil Ferri e Figli S.r.l.')

    await user.click(backLink())

    const row = await screen.findByRole('row', { name: /^Edil Ferri e Figli S\.r\.l\./ })
    expect(within(row).getByText('Asti')).toBeTruthy()
    expect(screen.queryByRole('row', { name: /^Edil Ferri S\.r\.l\./ })).toBeNull()
    expect(router.state.location.pathname).toBe(LIST_URL)
  })
})

describe('leaving the form', () => {
  it.each([
    ['Annulla', NEW_URL, LIST_URL, T['clients.title']],
    ['the back link', NEW_URL, LIST_URL, T['clients.title']],
    ['Annulla', EDIT_URL, FERRI_URL, FERRI_NAME],
    ['the back link', EDIT_URL, FERRI_URL, FERRI_NAME],
  ])('%s on %s goes to %s, without saving', async (link, url, expected, destination) => {
    await signIn(TITOLARE)
    const { router, user } = renderApp(url)
    await screen.findByRole('button', { name: T['form.save'] })
    await user.type(textbox(T['clients.name']), ' modificato')

    await user.click(
      link === 'Annulla'
        ? within(main()).getByRole('link', { name: T['form.cancel'] })
        : // From the edit form the link goes back to the client, and is named after it
          backLink(url === EDIT_URL ? FERRI_NAME : T['clients.title']),
    )

    // The router's state changes before React shows the page: wait for the page itself
    await findHeading(destination)
    expect(router.state.location.pathname).toBe(expected)
    expect(screen.queryByRole('button', { name: T['form.save'] })).toBeNull()
    expect(countRequests('POST', ROSSI_CLIENTS_PATH)).toBe(0)
    expect(countRequests('PUT', FERRI_API_PATH)).toBe(0)
  })

  it('the back link of the edit form is named after the client, not "Clienti"', async () => {
    await openEditForm()

    expect(backLink(FERRI_NAME).getAttribute('href')).toBe(FERRI_URL)
    expect(linksOutsideBreadcrumbs(T['clients.title'], main())).toEqual([])
  })

  it('the back link of the new client form is "Clienti", to the list', async () => {
    await openNewForm()

    expect(backLink().getAttribute('href')).toBe(LIST_URL)
  })
})
