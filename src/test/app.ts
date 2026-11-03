import type { QueryClient } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { createMemoryRouter, type DataRouter, type RouteObject } from 'react-router'
import { toast } from 'sonner'
import { afterEach } from 'vitest'
import { api, setUnauthorizedHandler } from '@/api/client'
import { App } from '@/app/App'
import { createQueryClient } from '@/app/query-client'
import { createRoutes } from '@/app/routes'
import { expireSession } from '@/auth/session'
import { MOCK_PASSWORD } from '@/mocks/data'
import { installBrowserCookies } from './cookies'
import { DESKTOP_WIDTH, installMatchMedia, setScreenWidth } from './media'

const routers: DataRouter[] = []

/**
 * Call once at the top of a test file that renders the app (in jsdom): cookies work as in a
 * browser, the screen is a desktop unless the test calls setScreenWidth (src/test/media.ts), and
 * after each test the app is unmounted, the 401 handler and the screen width are reset, and the
 * notices are dismissed.
 */
export function setupAppTests() {
  installBrowserCookies()
  // jsdom has no matchMedia, which the sidebar uses: a desktop screen unless a test picks a phone
  installMatchMedia()
  // Nor ResizeObserver, which the tooltips of the menu use to place their arrow: nothing resizes
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  afterEach(() => {
    cleanup()
    for (const router of routers.splice(0)) router.dispose()
    setUnauthorizedHandler(() => {})
    setScreenWidth(DESKTOP_WIDTH)
    // Sonner keeps its notices in the module: a new Toaster would show the previous test's again
    toast.dismiss()
  })
}

/**
 * Renders the whole app at a URL, as main.tsx does but with a memory router.
 * With expireSessionOn401, a 401 from the API goes to expireSession, as wired in main.tsx;
 * without it, a test sees what the routes do on their own.
 */
export function renderApp(url: string, { expireSessionOn401 = false } = {}) {
  return renderRoutes(createRoutes, url, { expireSessionOn401 })
}

/**
 * Like renderApp, with routes made for the test (e.g. a page that is not in the app yet).
 * The providers are the app's own.
 */
export function renderRoutes(
  routes: (queryClient: QueryClient) => RouteObject[],
  url: string,
  { expireSessionOn401 = false } = {},
) {
  const queryClient = createQueryClient()
  // Same retries, without the wait between them
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
  })
  const router = createMemoryRouter(routes(queryClient), { initialEntries: [url] })
  routers.push(router)
  if (expireSessionOn401) setUnauthorizedHandler(() => expireSession(router))
  const user = userEvent.setup()
  render(createElement(App, { router, queryClient }))
  return { router, queryClient, user }
}

/** Signs in as one of the users in src/mocks/data.ts: the session cookie lands in document.cookie. */
export async function signIn(email: string) {
  const { response } = await api.POST('/api/auth/login', {
    body: { email, password: MOCK_PASSWORD },
  })
  if (!response.ok) throw new Error(`Login as ${email} failed with ${response.status}`)
}

/** The ?da= parameter of the router's current URL. */
export function returnParam(router: DataRouter) {
  return new URLSearchParams(router.state.location.search).get('da')
}
