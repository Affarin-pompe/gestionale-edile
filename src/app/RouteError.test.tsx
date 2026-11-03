// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, data, type DataRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { messages } from '@/i18n/it'
import { App } from './App'
import { RouteError } from './RouteError'

const routers: DataRouter[] = []

afterEach(() => {
  cleanup()
  for (const router of routers.splice(0)) router.dispose()
})

/** Renders a page whose loader throws the error. */
function renderLoaderError(error: unknown) {
  const router = createMemoryRouter([
    {
      path: '/',
      loader: () => {
        throw error
      },
      Component: () => null,
      HydrateFallback: () => null,
      ErrorBoundary: RouteError,
    },
  ])
  routers.push(router)
  render(<App router={router} queryClient={new QueryClient()} />)
}

const findHeading = (name: string) => screen.findByRole('heading', { name })
const homeLink = () => screen.getByRole('link', { name: messages['error.home'] })
const reloadButton = () => screen.queryByRole('button', { name: messages['error.reload'] })

describe('RouteError', () => {
  it.each([
    ['an ApiError 403', new ApiError(403, { message: 'Il tuo ruolo non permette questa azione.' })],
    ['a 403 response', data(null, { status: 403 })],
  ])('%s shows that the role does not allow the page', async (_, error) => {
    renderLoaderError(error)
    await findHeading(messages['error.forbidden.title'])
    expect(screen.getByText(messages['error.forbidden.text'])).toBeTruthy()
    expect(homeLink().getAttribute('href')).toBe('/')
    expect(reloadButton()).toBeNull()
    expect(screen.queryByText(messages['error.notFound.title'])).toBeNull()
  })

  it.each([
    ['an ApiError 404', new ApiError(404, { message: 'Non trovato, oppure non hai accesso.' })],
    ['a 404 response', data(null, { status: 404 })],
  ])('%s shows the not-found page', async (_, error) => {
    renderLoaderError(error)
    await findHeading(messages['error.notFound.title'])
    expect(screen.getByText(messages['error.notFound.text'])).toBeTruthy()
    expect(homeLink().getAttribute('href')).toBe('/')
    expect(reloadButton()).toBeNull()
    expect(screen.queryByText(messages['error.forbidden.title'])).toBeNull()
  })

  it.each([
    ['an ApiError 500', new ApiError(500, undefined)],
    ['any other error', new Error('Something broke')],
  ])('%s shows the generic page, with reload and home', async (_, error) => {
    renderLoaderError(error)
    await findHeading(messages['error.generic.title'])
    expect(screen.getByText(messages['error.generic.text'])).toBeTruthy()
    expect(reloadButton()).toBeTruthy()
    expect(homeLink().getAttribute('href')).toBe('/')
  })
})
