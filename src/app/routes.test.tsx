// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { meQuery } from '@/auth/me'
import { messages } from '@/i18n/it'
import { server } from '@/mocks/node'
import { renderApp, returnParam, setupAppTests, signIn } from '@/test/app'
import { countRequests, deleteCookie } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const UFFICIO = 'ufficio@example.test'
const NUOVO = 'nuovo@example.test'
const TITOLARE_GREETING = 'Ciao, Giulia Rossi'

const findHeading = (name: string) => screen.findByRole('heading', { name })

describe('signed out', () => {
  const protectedUrls = ['/impresa-rossi', '/impresa-rossi/qualcosa?x=1', '/xyz']

  it.each(protectedUrls)(
    'opening %s ends on the login page, which remembers path and query',
    async (url) => {
      const { router } = renderApp(url)
      await findHeading(messages['login.title'])
      expect(router.state.location.pathname).toBe('/accedi')
      expect(returnParam(router)).toBe(url)
    },
  )

  it.each(protectedUrls)(
    'opening %s ends on the same login URL with the 401 handler wired as in main.tsx',
    async (url) => {
      const { router } = renderApp(url, { expireSessionOn401: true })
      await findHeading(messages['login.title'])
      await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
      expect(router.state.location.pathname).toBe('/accedi')
      expect(returnParam(router)).toBe(url)
    },
  )

  it('opening / ends on the login page with nothing to return to', async () => {
    const { router } = renderApp('/')
    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(router.state.location.search).toBe('')
  })
})

describe('signed in', () => {
  it('/ goes to the first company of the user', async () => {
    await signIn(TITOLARE)
    const { router } = renderApp('/')
    await findHeading(TITOLARE_GREETING)
    expect(screen.getByText('Impresa Rossi S.r.l., come Titolare')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })

  it('a user without companies sees the "no company" page on /, with a logout button', async () => {
    await signIn(NUOVO)
    const { router } = renderApp('/')
    await findHeading(messages['noCompany.title'])
    expect(screen.getByText(messages['noCompany.text'])).toBeTruthy()
    expect(screen.getByRole('button', { name: messages['logout.submit'] })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/')
  })

  it.each([
    ['a company the user does not belong to', '/costruzioni-verdi'],
    ['a path that is not a company', '/xyz'],
  ])('%s shows the not-found page, at the same URL', async (_, url) => {
    await signIn(UFFICIO)
    const { router } = renderApp(url)
    await findHeading(messages['error.notFound.title'])
    expect(screen.getByText(messages['error.notFound.text'])).toBeTruthy()
    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/',
    )
    expect(screen.queryByText(/Luca Bianchi/)).toBeNull()
    expect(router.state.location.pathname).toBe(url)
  })

  it('an unknown page inside the company shows the not-found page, at the same URL', async () => {
    await signIn(UFFICIO)
    const { router } = renderApp('/impresa-rossi/non-esiste')
    await findHeading(messages['error.notFound.title'])
    expect(screen.getByText(messages['error.notFound.text'])).toBeTruthy()
    // Inside a valid company, home is its dashboard
    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/impresa-rossi',
    )
    expect(screen.queryByRole('heading', { name: 'Ciao, Luca Bianchi' })).toBeNull()
    expect(router.state.location.pathname).toBe('/impresa-rossi/non-esiste')
  })

  it('the company page shows the user and their role in that company', async () => {
    await signIn(TITOLARE)
    renderApp('/costruzioni-verdi')
    await findHeading(TITOLARE_GREETING)
    expect(screen.getByText('Costruzioni Verdi S.p.A., come Ufficio')).toBeTruthy()
  })
})

describe('session ending while the page is open', () => {
  it('a 401 goes to the login page, which returns to the current page', async () => {
    await signIn(TITOLARE)
    const { router, queryClient } = renderApp('/impresa-rossi?x=1', { expireSessionOn401: true })
    await findHeading(TITOLARE_GREETING)

    deleteCookie('session')
    await act(() => queryClient.refetchQueries({ queryKey: meQuery.queryKey }))

    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(returnParam(router)).toBe('/impresa-rossi?x=1')
    expect(screen.queryByText(TITOLARE_GREETING)).toBeNull()
  })
})

describe('loading and errors', () => {
  it('shows "Caricamento…" while the first page loads its data', async () => {
    let answer = () => {}
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    // Holds /api/me back, then lets the regular mock answer it
    server.use(
      http.get('*/api/me', async () => {
        await answered
      }),
    )
    await signIn(TITOLARE)
    renderApp('/impresa-rossi')

    expect(await screen.findByText(messages['app.loading'])).toBeTruthy()
    expect(screen.queryByText(TITOLARE_GREETING)).toBeNull()

    answer()
    await findHeading(TITOLARE_GREETING)
    expect(screen.queryByText(messages['app.loading'])).toBeNull()
  })

  it('/api/me answering 500 shows the generic error page, after 3 attempts', async () => {
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ message: 'Errore' }, { status: 500 })),
    )
    await signIn(TITOLARE)
    const { router } = renderApp('/impresa-rossi')

    await findHeading(messages['error.generic.title'])
    expect(screen.getByText(messages['error.generic.text'])).toBeTruthy()
    expect(screen.getByRole('button', { name: messages['error.reload'] })).toBeTruthy()
    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/',
    )
    expect(countRequests('GET', '/api/me')).toBe(3)
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })
})
