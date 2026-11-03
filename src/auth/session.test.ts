import { createMemoryRouter, type DataRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expireSession, loginPath, returnPath } from './session'

/** The search string of the login page with this ?da= value. */
const withReturn = (da: string) => `?${new URLSearchParams({ da }).toString()}`

describe('returnPath', () => {
  it.each([
    '//evil.example',
    '//evil.example/impresa-rossi',
    '///evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    '/\t/evil.example',
    'https://evil.example',
    'https://evil.example/impresa-rossi',
    'javascript:alert(1)',
    'impresa-rossi',
    ' /impresa-rossi',
    '',
    '/accedi',
    '/accedi?da=/x',
    '/accedi#x',
  ])('?da=%j goes to /', (da) => {
    expect(returnPath(withReturn(da))).toBe('/')
  })

  it('also when ?da= is written unencoded', () => {
    expect(returnPath('?da=//evil.example')).toBe('/')
    expect(returnPath('?da=/\\evil.example')).toBe('/')
    expect(returnPath('?da=https://evil.example')).toBe('/')
  })

  it('goes to / without ?da=', () => {
    expect(returnPath('')).toBe('/')
    expect(returnPath('?altro=/impresa-rossi')).toBe('/')
  })

  it.each([
    '/',
    '/impresa-rossi',
    '/impresa-rossi/qualcosa?x=1',
    '/impresa-rossi/clienti?pagina=2&ordine=-nome#elenco',
    '/impresa-rossi#sezione',
  ])('keeps the app path %s with its query and hash', (path) => {
    expect(returnPath(withReturn(path))).toBe(path)
  })
})

describe('loginPath', () => {
  it('is the bare login page for / or nothing', () => {
    expect(loginPath()).toBe('/accedi')
    expect(loginPath('/')).toBe('/accedi')
    expect(loginPath('')).toBe('/accedi')
  })

  it.each(['/impresa-rossi', '/impresa-rossi/qualcosa?x=1&y=2', '/xyz#a'])(
    'puts %s in ?da=, and returnPath gives it back',
    (path) => {
      const url = new URL(loginPath(path), 'http://localhost')
      expect(url.pathname).toBe('/accedi')
      expect(url.searchParams.get('da')).toBe(path)
      expect(returnPath(url.search)).toBe(path)
    },
  )
})

describe('expireSession', () => {
  const routers: DataRouter[] = []
  afterEach(() => {
    for (const router of routers.splice(0)) router.dispose()
  })

  function routerAt(url: string) {
    const router = createMemoryRouter(
      [
        { path: '*' },
        // A page whose data never arrives, to catch the router in the middle of a navigation
        { path: '/lento', loader: () => new Promise<never>(() => {}) },
      ],
      { initialEntries: [url] },
    )
    routers.push(router)
    return router
  }

  it('goes to the login page, replacing the current page and remembering it', async () => {
    const router = routerAt('/impresa-rossi/qualcosa?x=1')
    expireSession(router)

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/accedi'))
    expect(new URLSearchParams(router.state.location.search).get('da')).toBe(
      '/impresa-rossi/qualcosa?x=1',
    )
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('during a navigation, remembers the page being opened', async () => {
    const router = routerAt('/impresa-rossi')
    void router.navigate('/lento?y=2')
    await vi.waitFor(() => expect(router.state.navigation.state).toBe('loading'))

    expireSession(router)

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/accedi'))
    expect(new URLSearchParams(router.state.location.search).get('da')).toBe('/lento?y=2')
  })

  it('does nothing when the router is already on the login page', () => {
    const router = routerAt('/accedi?da=%2Fimpresa-rossi')
    const navigate = vi.spyOn(router, 'navigate')

    expireSession(router)

    expect(navigate).not.toHaveBeenCalled()
    expect(router.state.location.search).toBe('?da=%2Fimpresa-rossi')
    expect(router.state.navigation.state).toBe('idle')
  })
})
