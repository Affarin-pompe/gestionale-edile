// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { messages } from '@/i18n/it'
import { server } from '@/mocks/node'
import { renderApp, returnParam, setupAppTests, signIn } from '@/test/app'
import { countRequests, deleteCookie, sentRequests } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const NUOVO = 'nuovo@example.test'
const TITOLARE_GREETING = 'Ciao, Giulia Rossi'

const findHeading = (name: string) => screen.findByRole('heading', { name })

/** Inside a company, logout is the last item of the menu under the user's name. */
async function logOutFromUserMenu(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: /Giulia Rossi/ }))
  await user.click(await screen.findByRole('menuitem', { name: messages['logout.submit'] }))
}

describe('logout from the user menu', () => {
  it('ends on the login page with nothing cached, and the previous user does not come back', async () => {
    await signIn(TITOLARE)
    const { router, queryClient, user } = renderApp('/impresa-rossi', {
      expireSessionOn401: true,
    })
    await findHeading(TITOLARE_GREETING)
    expect(queryClient.getQueryCache().getAll()).not.toHaveLength(0)

    await logOutFromUserMenu(user)

    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(router.state.location.search).toBe('')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)

    await act(() => router.navigate('/impresa-rossi'))
    await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
    expect(router.state.location.pathname).toBe('/accedi')
    expect(returnParam(router)).toBe('/impresa-rossi')
    expect(screen.queryByText(TITOLARE_GREETING)).toBeNull()
    expect(screen.getByRole('heading', { name: messages['login.title'] })).toBeTruthy()
  })

  it('ends on the login page when the session had already expired', async () => {
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi', { expireSessionOn401: true })
    await findHeading(TITOLARE_GREETING)

    deleteCookie('session')
    await logOutFromUserMenu(user)

    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(router.state.location.search).toBe('')
    expect(sentRequests.find((r) => r.path === '/api/auth/logout')?.status).toBe(401)
  })

  it('shows the generic error page, not the login, when the logout fails', async () => {
    server.use(
      http.post('*/api/auth/logout', () =>
        HttpResponse.json({ message: 'Errore' }, { status: 500 }),
      ),
    )
    await signIn(TITOLARE)
    const { router, user } = renderApp('/impresa-rossi', { expireSessionOn401: true })
    await findHeading(TITOLARE_GREETING)

    await logOutFromUserMenu(user)

    await findHeading(messages['error.generic.title'])
    expect(screen.getByRole('button', { name: messages['error.reload'] })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: messages['login.title'] })).toBeNull()
    expect(router.state.location.pathname).not.toBe('/accedi')
  })
})

describe('logout button of the "no company" page', () => {
  it('ends on the login page, and the session is over', async () => {
    await signIn(NUOVO)
    const { router, user } = renderApp('/')
    await findHeading(messages['noCompany.title'])

    await user.click(screen.getByRole('button', { name: messages['logout.submit'] }))

    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(router.state.location.search).toBe('')
    expect(countRequests('POST', '/api/auth/logout')).toBe(1)

    await act(() => router.navigate('/'))
    await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
    expect(router.state.location.pathname).toBe('/accedi')
    expect(screen.queryByRole('heading', { name: messages['noCompany.title'] })).toBeNull()
  })
})

describe('opening /esci from the address bar', () => {
  it('redirects to / without logging out', async () => {
    await signIn(NUOVO)
    const { router } = renderApp('/esci')

    await findHeading(messages['noCompany.title'])
    expect(router.state.location.pathname).toBe('/')
    expect(countRequests('POST', '/api/auth/logout')).toBe(0)
  })

  it('signed out, redirects to / and from there to the login, with nothing to return to', async () => {
    const { router } = renderApp('/esci')

    await findHeading(messages['login.title'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(router.state.location.search).toBe('')
  })
})
