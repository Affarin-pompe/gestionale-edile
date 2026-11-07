// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { messages } from '@/i18n/it'
import { db } from '@/mocks/db'
import { renderApp, setupAppTests, signIn } from '@/test/app'
import { countRequests } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const UFFICIO = 'ufficio@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'
const LIST_URL = '/impresa-rossi/anagrafiche/clienti'
/** impresa-rossi-001 has documents in the mock data: it cannot be deleted */
const FERRI_ID = 'impresa-rossi-001'
const FERRI_URL = `${LIST_URL}/${FERRI_ID}`
const FERRI_NAME = 'Edil Ferri S.r.l.'
/** impresa-rossi-002 has none */
const COLOMBO_ID = 'impresa-rossi-002'
const COLOMBO_URL = `${LIST_URL}/${COLOMBO_ID}`
const COLOMBO_NAME = 'Edil Colombo S.r.l.'
const ARCHIVED_URL = `${LIST_URL}/impresa-rossi-archiviato-1`
const CLIENTS_API = '/api/companies/impresa-rossi/clients'

const T = messages

const findHeading = (name: string) => screen.findByRole('heading', { name, level: 1 })
const queryButton = (name: string) => screen.queryByRole('button', { name })
const button = (name: string) => screen.getByRole('button', { name })
const dialog = () => screen.getByRole('alertdialog')
const rossi = (id: string) => db.clients['impresa-rossi']?.find((c) => c.id === id)

async function open(url: string, name: string, email = TITOLARE) {
  await signIn(email)
  const app = renderApp(url)
  await findHeading(name)
  return app
}

describe('who sees archive, restore and delete', () => {
  it('titolare sees Archivia and Elimina', async () => {
    await open(FERRI_URL, FERRI_NAME)
    expect(button(T['clients.archive'])).toBeTruthy()
    expect(button(T['clients.delete'])).toBeTruthy()
    expect(queryButton(T['clients.restore'])).toBeNull()
  })

  it('ufficio, without clients.delete, sees Archivia but not Elimina', async () => {
    await open(FERRI_URL, FERRI_NAME, UFFICIO)
    expect(button(T['clients.archive'])).toBeTruthy()
    expect(queryButton(T['clients.delete'])).toBeNull()
  })

  it('capocantiere, who can only view, sees neither', async () => {
    await open(FERRI_URL, FERRI_NAME, CAPOCANTIERE)
    expect(queryButton(T['clients.archive'])).toBeNull()
    expect(queryButton(T['clients.delete'])).toBeNull()
  })

  it('an archived client says so, and offers Ripristina instead of Archivia', async () => {
    await open(ARCHIVED_URL, 'Comune di Valprova')
    expect(screen.getByText(/^Archiviato il 30\/06\/2026/)).toBeTruthy()
    expect(button(T['clients.restore'])).toBeTruthy()
    expect(queryButton(T['clients.archive'])).toBeNull()
    expect(screen.getByText(T['clients.kind.public_body'])).toBeTruthy()
  })
})

describe('archiving and restoring', () => {
  it('Archivia archives the client, says so, and the page shows it archived', async () => {
    const { user } = await open(FERRI_URL, FERRI_NAME)

    await user.click(button(T['clients.archive']))

    expect(await screen.findByText(T['clients.archivedDone'])).toBeTruthy()
    expect(await screen.findByRole('button', { name: T['clients.restore'] })).toBeTruthy()
    expect(screen.getByText(/^Archiviato il /)).toBeTruthy()
    expect(rossi(FERRI_ID)?.archived_at).not.toBeNull()
    // The answer of the archive is the new page: no second read
    expect(countRequests('GET', `${CLIENTS_API}/${FERRI_ID}`)).toBe(1)
  })

  it('then Ripristina, with the new version, makes it active again', async () => {
    const { user } = await open(FERRI_URL, FERRI_NAME)
    await user.click(button(T['clients.archive']))
    await screen.findByRole('button', { name: T['clients.restore'] })

    await user.click(button(T['clients.restore']))

    expect(await screen.findByText(T['clients.restoredDone'])).toBeTruthy()
    await screen.findByRole('button', { name: T['clients.archive'] })
    expect(rossi(FERRI_ID)?.archived_at).toBeNull()
    expect(screen.queryByText(/^Archiviato il /)).toBeNull()
  })

  it('a 412 says someone else changed it, and Ricarica shows the newer version', async () => {
    const { user } = await open(FERRI_URL, FERRI_NAME)
    const ferri = rossi(FERRI_ID)
    if (!ferri) throw new Error('No Edil Ferri in the mock data')
    ferri.name = 'Edil Ferri Nuova S.r.l.'
    db.clientVersions.set(FERRI_ID, 2)

    await user.click(button(T['clients.archive']))

    expect(await screen.findByText(T['clients.stale'])).toBeTruthy()
    expect(ferri.archived_at).toBeNull()
    // A plain click: a pointer on the notice makes sonner call setPointerCapture, missing in jsdom
    fireEvent.click(button(T['action.reload']))
    await findHeading('Edil Ferri Nuova S.r.l.')
  })
})

describe('deleting', () => {
  it('asks first; Annulla deletes nothing', async () => {
    const { user } = await open(COLOMBO_URL, COLOMBO_NAME)

    await user.click(button(T['clients.delete']))

    expect(within(dialog()).getByText(`Eliminare ${COLOMBO_NAME}?`)).toBeTruthy()
    await user.click(within(dialog()).getByRole('button', { name: T['action.cancel'] }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rossi(COLOMBO_ID)).toBeTruthy()
    expect(countRequests('DELETE', `${CLIENTS_API}/${COLOMBO_ID}`)).toBe(0)
  })

  it('once confirmed, deletes the client, says so and goes back to the list', async () => {
    const { router, user } = await open(COLOMBO_URL, COLOMBO_NAME)
    await user.click(button(T['clients.delete']))

    await user.click(within(dialog()).getByRole('button', { name: T['clients.delete.confirm'] }))

    expect(await screen.findByText(T['clients.deletedDone'])).toBeTruthy()
    await findHeading(T['clients.title'])
    expect(router.state.location.pathname).toBe(LIST_URL)
    expect(rossi(COLOMBO_ID)).toBeUndefined()
    await screen.findByText('59 risultati')
    expect(screen.queryByRole('link', { name: COLOMBO_NAME })).toBeNull()
  })

  it('a client with documents (409) is not deleted: the dialog explains why and offers to archive it', async () => {
    const { router, user } = await open(FERRI_URL, FERRI_NAME)
    await user.click(button(T['clients.delete']))

    await user.click(within(dialog()).getByRole('button', { name: T['clients.delete.confirm'] }))

    expect(await within(dialog()).findByText(T['clients.delete.hasDocuments'])).toBeTruthy()
    expect(rossi(FERRI_ID)).toBeTruthy()
    expect(router.state.location.pathname).toBe(FERRI_URL)
    expect(within(dialog()).queryByRole('button', { name: T['clients.delete.confirm'] })).toBeNull()

    await user.click(within(dialog()).getByRole('button', { name: T['clients.archive'] }))

    expect(await screen.findByText(T['clients.archivedDone'])).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rossi(FERRI_ID)?.archived_at).not.toBeNull()
  })

  it('a 412 is explained in the dialog, and nothing is deleted', async () => {
    const { user } = await open(COLOMBO_URL, COLOMBO_NAME)
    db.clientVersions.set(COLOMBO_ID, 2)
    await user.click(button(T['clients.delete']))

    await user.click(within(dialog()).getByRole('button', { name: T['clients.delete.confirm'] }))

    expect(await within(dialog()).findByText(T['clients.stale'])).toBeTruthy()
    expect(rossi(COLOMBO_ID)).toBeTruthy()
    await user.click(within(dialog()).getByRole('button', { name: T['action.reload'] }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(countRequests('GET', `${CLIENTS_API}/${COLOMBO_ID}`)).toBe(2)
  })
})

describe('archived clients in the list', () => {
  it('"Stato: Archiviati" lists only the archived clients, and the URL keeps it', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp(LIST_URL)
    await screen.findByText('60 risultati')
    expect(screen.queryByRole('link', { name: 'Comune di Valprova' })).toBeNull()

    await user.selectOptions(
      screen.getByRole('combobox', { name: T['clients.status'] }),
      T['clients.status.archived'],
    )

    await screen.findByText('2 risultati')
    expect(new URLSearchParams(router.state.location.search).get('stato')).toBe('archiviati')
    expect(screen.getByRole('link', { name: 'Comune di Valprova' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bau Beispiel GmbH' })).toBeTruthy()
  })

  it('the kind filter offers Ente pubblico', async () => {
    await signIn(TITOLARE)
    const { user } = renderApp(`${LIST_URL}?stato=archiviati`)
    await screen.findByText('2 risultati')

    await user.selectOptions(
      screen.getByRole('combobox', { name: T['clients.kind'] }),
      T['clients.kind.public_body'],
    )

    await screen.findByText('1 risultato')
    expect(screen.getByRole('link', { name: 'Comune di Valprova' })).toBeTruthy()
  })
})
