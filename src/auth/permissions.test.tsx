// @vitest-environment jsdom
import type { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { LoadingScreen } from '@/app/LoadingScreen'
import { PageError, RouteError } from '@/app/RouteError'
import { PermissionGate } from '@/components/common/PermissionGate'
import { messages } from '@/i18n/it'
import { AppLayout } from '@/layouts/AppLayout'
import { server } from '@/mocks/node'
import { renderRoutes, setupAppTests, signIn } from '@/test/app'
import type { Me } from './me'
import { useCan } from './permissions'
import { requireAuth, requireCompany, requirePermission } from './session'

setupAppTests()

const TITOLARE = 'titolare@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'

/** Can do everything with clients in Impresa Rossi, and only look at them in Costruzioni Verdi. */
const twoRoles: Me = {
  id: 'u-test-due-ruoli',
  name: 'Paola Verdi',
  email: 'paola@example.test',
  companies: [
    {
      slug: 'impresa-rossi',
      name: 'Impresa Rossi S.r.l.',
      role: 'Titolare',
      permissions: ['clients.view', 'clients.create', 'clients.update'],
    },
    {
      slug: 'costruzioni-verdi',
      name: 'Costruzioni Verdi S.p.A.',
      role: 'Consulente',
      permissions: ['clients.view'],
    },
  ],
}

const signInWithTwoRoles = () => server.use(http.get('*/api/me', () => HttpResponse.json(twoRoles)))

/**
 * The routes of src/app/routes.tsx that lead to a company page, with one test page added the way a
 * module adds its pages.
 */
function routesAround(page: RouteObject) {
  return (queryClient: QueryClient): RouteObject[] => [
    {
      path: '/',
      ErrorBoundary: RouteError,
      HydrateFallback: LoadingScreen,
      children: [
        {
          middleware: [requireAuth(queryClient)],
          children: [
            {
              path: ':azienda',
              middleware: [requireCompany],
              Component: AppLayout,
              children: [
                {
                  ErrorBoundary: PageError,
                  children: [{ index: true, Component: DashboardPage }, page],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}

const findHeading = (name: string) => screen.findByRole('heading', { name })

describe('useCan and PermissionGate', () => {
  function GatedPage() {
    const canUpdate = useCan('clients.update')
    return (
      <>
        <h1>Pagina di prova</h1>
        <p>{canUpdate ? 'Può modificare' : 'Non può modificare'}</p>
        <PermissionGate permission="clients.create">
          <button type="button">Nuovo cliente</button>
        </PermissionGate>
        <PermissionGate permission="clients.create" fallback={<p>Solo consultazione</p>}>
          <p>Inserimento attivo</p>
        </PermissionGate>
      </>
    )
  }
  const render = (url: string) =>
    renderRoutes(routesAround({ path: 'prova', Component: GatedPage }), url)

  it('with the permission in the company in the URL, show the content and not the fallback', async () => {
    signInWithTwoRoles()
    render('/impresa-rossi/prova')
    await findHeading('Pagina di prova')

    expect(screen.getByText('Può modificare')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nuovo cliente' })).toBeTruthy()
    expect(screen.getByText('Inserimento attivo')).toBeTruthy()
    expect(screen.queryByText('Solo consultazione')).toBeNull()
  })

  it('without it, show the fallback, or nothing when there is none', async () => {
    signInWithTwoRoles()
    render('/costruzioni-verdi/prova')
    await findHeading('Pagina di prova')

    expect(screen.getByText('Non può modificare')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nuovo cliente' })).toBeNull()
    expect(screen.queryByText('Inserimento attivo')).toBeNull()
    expect(screen.getByText('Solo consultazione')).toBeTruthy()
  })

  it('follow the company when the URL changes to another one', async () => {
    signInWithTwoRoles()
    const { router } = render('/impresa-rossi/prova')
    await findHeading('Pagina di prova')
    expect(screen.getByRole('button', { name: 'Nuovo cliente' })).toBeTruthy()

    await act(() => router.navigate('/costruzioni-verdi/prova'))

    await waitFor(() => expect(screen.getByText('Solo consultazione')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Nuovo cliente' })).toBeNull()
    expect(screen.getByText('Non può modificare')).toBeTruthy()
  })
})

describe("requirePermission('clients.create')", () => {
  const PAGE_TITLE = 'Nuovo cliente'
  const PAGE_URL = '/impresa-rossi/anagrafiche/clienti/nuovo'
  const render = (url: string) =>
    renderRoutes(
      routesAround({
        path: 'anagrafiche/clienti/nuovo',
        loader: requirePermission('clients.create'),
        Component: () => <h1>{PAGE_TITLE}</h1>,
      }),
      url,
    )

  /** The not-found page of a company, as for /impresa-rossi/non-esiste: menu and header stay. */
  const expectNotFoundInsideLayout = async () => {
    await findHeading(messages['error.notFound.title'])
    expect(screen.queryByRole('heading', { name: PAGE_TITLE })).toBeNull()
    expect(screen.getByRole('link', { name: messages['menu.dashboard'] })).toBeTruthy()
    expect(screen.getByRole('link', { name: messages['error.home'] }).getAttribute('href')).toBe(
      '/impresa-rossi',
    )
  }

  it('a role with the permission sees the page', async () => {
    await signIn(TITOLARE)
    render(PAGE_URL)

    await findHeading(PAGE_TITLE)
    expect(screen.queryByText(messages['error.notFound.title'])).toBeNull()
  })

  it('a role without it, coming from another page of the app, gets the not-found page', async () => {
    await signIn(CAPOCANTIERE)
    const { router } = render('/impresa-rossi')
    await findHeading('Ciao, Marco Neri')

    await act(() => router.navigate(PAGE_URL))

    await expectNotFoundInsideLayout()
    expect(router.state.location.pathname).toBe(PAGE_URL)
  })

  it('a role without it, opening the URL directly, gets the same not-found page', async () => {
    await signIn(CAPOCANTIERE)
    const { router } = render(PAGE_URL)

    await expectNotFoundInsideLayout()
    expect(router.state.location.pathname).toBe(PAGE_URL)
  })

  it('checks the role in the company in the URL', async () => {
    signInWithTwoRoles()
    render('/costruzioni-verdi/anagrafiche/clienti/nuovo')

    await findHeading(messages['error.notFound.title'])
    expect(screen.queryByRole('heading', { name: PAGE_TITLE })).toBeNull()
  })

  it('also when the user moves there from a company where the page is allowed', async () => {
    signInWithTwoRoles()
    const { router } = render(PAGE_URL)
    await findHeading(PAGE_TITLE)

    await act(() => router.navigate('/costruzioni-verdi/anagrafiche/clienti/nuovo'))

    await findHeading(messages['error.notFound.title'])
    expect(screen.queryByRole('heading', { name: PAGE_TITLE })).toBeNull()
  })
})
