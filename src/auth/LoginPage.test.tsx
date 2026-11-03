// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { messages } from '@/i18n/it'
import { MOCK_PASSWORD } from '@/mocks/data'
import { server } from '@/mocks/node'
import { renderApp, setupAppTests } from '@/test/app'
import { countRequests } from '@/test/cookies'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const WRONG_PASSWORD = 'password-sbagliata'
// The mock backend's answer to a wrong email or password (src/mocks/handlers.ts)
const WRONG_CREDENTIALS = 'Email o password non corretti.'

const findHeading = (name: string) => screen.findByRole('heading', { name })
const submitButton = () => screen.getByRole('button', { name: messages['login.submit'] })
const emailInput = () => screen.getByLabelText(messages['login.email'])
const passwordInput = () => screen.getByLabelText(messages['login.password'])

async function fillIn(user: UserEvent, email: string, password: string) {
  await findHeading(messages['login.title'])
  await user.type(emailInput(), email)
  await user.type(passwordInput(), password)
}

describe('valid login', () => {
  it('returns to the page in ?da=, with the user and their role in that company', async () => {
    const { router, user } = renderApp('/accedi?da=/costruzioni-verdi')
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    await findHeading('Ciao, Giulia Rossi')
    expect(screen.getByText('Costruzioni Verdi S.p.A., come Ufficio')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/costruzioni-verdi')
  })

  it('without ?da= goes to /, which opens the first company', async () => {
    const { router, user } = renderApp('/accedi')
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    await findHeading('Ciao, Giulia Rossi')
    expect(screen.getByText('Impresa Rossi S.r.l., come Titolare')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })

  it('with ?da= pointing to another site stays in the app', async () => {
    const { router, user } = renderApp(`/accedi?${new URLSearchParams({ da: '//evil.example' })}`)
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    await findHeading('Ciao, Giulia Rossi')
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })
})

describe('refused login', () => {
  it("a wrong password shows the backend's message under the email field", async () => {
    const { router, user } = renderApp('/accedi')
    await fillIn(user, TITOLARE, WRONG_PASSWORD)
    await user.click(submitButton())

    const message = await screen.findByText(WRONG_CREDENTIALS)
    const email = emailInput()
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(message.id).not.toBe('')
    expect(email.getAttribute('aria-describedby')).toBe(message.id)
    // Between the email field and the password field
    expect(email.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      message.compareDocumentPosition(passwordInput()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(passwordInput().getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(router.state.location.pathname).toBe('/accedi')
  })

  it('after 5 wrong attempts for one email, the next one says to wait', async () => {
    const { router, user } = renderApp('/accedi')
    await fillIn(user, TITOLARE, WRONG_PASSWORD)

    for (let attempt = 1; attempt <= 5; attempt++) {
      await user.click(submitButton())
      await waitFor(() => expect(countRequests('POST', '/api/auth/login')).toBe(attempt))
      await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
    }
    expect(screen.getByText(WRONG_CREDENTIALS)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    await user.click(submitButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(messages['login.tooManyAttempts'])
    expect(router.state.location.pathname).toBe('/accedi')
  })

  it.each([
    ['a server error', () => HttpResponse.json({ message: 'Errore' }, { status: 500 })],
    ['a network error', () => HttpResponse.error()],
  ])('%s shows that the login failed, on the same page', async (_, answer) => {
    server.use(http.post('*/api/auth/login', answer))
    const { router, user } = renderApp('/accedi?da=/impresa-rossi')
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(messages['login.failed'])
    expect(router.state.location.pathname).toBe('/accedi')
    expect(screen.queryByText('Ciao, Giulia Rossi')).toBeNull()
  })
})

describe('while the login request is pending', () => {
  it('the submit button is disabled and says the login is in progress', async () => {
    let answer = () => {}
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    // Holds the login back, then lets the regular mock answer it
    server.use(
      http.post('*/api/auth/login', async () => {
        await answered
      }),
    )
    const { router, user } = renderApp('/accedi')
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    const pending = await screen.findByRole('button', { name: messages['login.submitting'] })
    expect(pending.hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('button', { name: messages['login.submit'] })).toBeNull()

    answer()
    await findHeading('Ciao, Giulia Rossi')
    expect(router.state.location.pathname).toBe('/impresa-rossi')
  })

  it('the button is enabled again once the answer arrives', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: 'Errore' }, { status: 500 }),
      ),
    )
    const { user } = renderApp('/accedi')
    await fillIn(user, TITOLARE, MOCK_PASSWORD)
    await user.click(submitButton())

    await screen.findByRole('alert')
    expect(submitButton().hasAttribute('disabled')).toBe(false)
  })
})
