// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import type { DataRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderRoutes, setupAppTests } from '@/test/app'
import { useListParams } from './use-list-params'

setupAppTests()

const SORTS = ['name', '-name', '-created_at', 'created_at'] as const
const FILTERS = { tipo: ['company', 'person'], stato: ['aperto', 'chiuso'] }

type ListParams = ReturnType<typeof useListParams<(typeof SORTS)[number], keyof typeof FILTERS>>

// What a page would do with the list; each one is a button of the probe below
const ACTIONS: Record<string, (list: ListParams) => void> = {
  'page 1': (list) => list.setPage(1),
  'page 3': (list) => list.setPage(3),
  'sort -name': (list) => list.setSort('-name'),
  'sort name': (list) => list.setSort('name'),
  'sort unknown': (list) => list.setSort('city'),
  'search Ferri': (list) => list.setSearch('Ferri'),
  'search long': (list) => list.setSearch('x'.repeat(150)),
  'search empty': (list) => list.setSearch(''),
  'tipo company': (list) => list.setFilter('tipo', 'company'),
  'tipo none': (list) => list.setFilter('tipo', undefined),
}

/** Shows what the hook reads from the URL, and runs its setters from buttons. */
function Probe() {
  const list = useListParams({ sorts: SORTS, filters: FILTERS })
  const { page, sort, search, filters } = list
  return (
    <>
      <output>{JSON.stringify({ page, sort, search, filters })}</output>
      {Object.entries(ACTIONS).map(([label, run]) => (
        <button key={label} onClick={() => run(list)}>
          {label}
        </button>
      ))}
    </>
  )
}

function renderProbe(url: string) {
  return renderRoutes(() => [{ path: '/elenco', Component: Probe }], url)
}

function readState(): unknown {
  return JSON.parse(screen.getByRole('status').textContent)
}

function urlParams(router: DataRouter) {
  return Object.fromEntries(new URLSearchParams(router.state.location.search))
}

const DEFAULTS = { page: 1, sort: 'name', search: '', filters: {} }

describe('reading the URL', () => {
  it('without parameters gives the defaults', () => {
    renderProbe('/elenco')
    expect(readState()).toEqual(DEFAULTS)
  })

  it('reads every parameter it knows, and ignores the others', () => {
    renderProbe('/elenco?pagina=4&ordine=-created_at&cerca=Rossi&tipo=person&stato=aperto&x=1')
    expect(readState()).toEqual({
      page: 4,
      sort: '-created_at',
      search: 'Rossi',
      filters: { tipo: 'person', stato: 'aperto' },
    })
  })

  it.each(['0', '-1', 'abc', '1.5', '01', '2x', '', '1234567', '1e3', ' 2'])(
    'pagina=%j falls back to page 1',
    (value) => {
      renderProbe(`/elenco?pagina=${encodeURIComponent(value)}`)
      expect(readState()).toEqual(DEFAULTS)
    },
  )

  it('accepts pages up to six digits', () => {
    renderProbe('/elenco?pagina=999999')
    expect(readState()).toMatchObject({ page: 999999 })
  })

  it.each(['city', 'NAME', '--name', '', 'name,-created_at'])(
    'ordine=%j, not a sort of the list, falls back to the first one',
    (value) => {
      renderProbe(`/elenco?ordine=${encodeURIComponent(value)}`)
      expect(readState()).toEqual(DEFAULTS)
    },
  )

  it('drops a filter value that is not allowed, keeping the valid ones', () => {
    renderProbe('/elenco?tipo=Company&stato=chiuso')
    expect(readState()).toEqual({ ...DEFAULTS, filters: { stato: 'chiuso' } })
  })

  it('keeps only the first 100 characters of the search', () => {
    renderProbe(`/elenco?cerca=${'a'.repeat(100)}bcd`)
    expect(readState()).toEqual({ ...DEFAULTS, search: 'a'.repeat(100) })
  })
})

describe('changing the list', () => {
  const click = async (user: ReturnType<typeof renderProbe>['user'], label: string) =>
    user.click(screen.getByRole('button', { name: label }))

  it('a new sort goes back to page 1 and keeps the rest', async () => {
    const { router, user } = renderProbe('/elenco?pagina=2&cerca=Rossi&tipo=company&x=1')
    await click(user, 'sort -name')
    expect(urlParams(router)).toEqual({ ordine: '-name', cerca: 'Rossi', tipo: 'company', x: '1' })
    expect(router.state.historyAction).toBe('PUSH')
  })

  it('a new filter goes back to page 1 and keeps the rest', async () => {
    const { router, user } = renderProbe('/elenco?pagina=2&ordine=-name')
    await click(user, 'tipo company')
    expect(urlParams(router)).toEqual({ ordine: '-name', tipo: 'company' })
  })

  it('a new search goes back to page 1, replacing the history entry', async () => {
    const { router, user } = renderProbe('/elenco?pagina=2&tipo=company')
    await click(user, 'search Ferri')
    expect(urlParams(router)).toEqual({ cerca: 'Ferri', tipo: 'company' })
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('a new page keeps sort, search and filters', async () => {
    const { router, user } = renderProbe('/elenco?ordine=-name&cerca=Rossi&tipo=person')
    await click(user, 'page 3')
    expect(urlParams(router)).toEqual({
      pagina: '3',
      ordine: '-name',
      cerca: 'Rossi',
      tipo: 'person',
    })
    expect(readState()).toMatchObject({ page: 3, sort: '-name', search: 'Rossi' })
  })

  it.each([
    ['page 1', '?pagina=3&tipo=person', { tipo: 'person' }],
    ['sort name', '?ordine=-name&pagina=2', {}],
    ['search empty', '?cerca=Rossi&ordine=-name', { ordine: '-name' }],
    ['tipo none', '?tipo=person&cerca=Rossi', { cerca: 'Rossi' }],
  ])('%s takes the default value out of the URL', async (label, search, expected) => {
    const { router, user } = renderProbe(`/elenco${search}`)
    await click(user, label)
    expect(urlParams(router)).toEqual(expected)
  })

  it('a sort the list does not have changes nothing', async () => {
    const { router, user } = renderProbe('/elenco?pagina=2&ordine=-name')
    await click(user, 'sort unknown')
    expect(urlParams(router)).toEqual({ pagina: '2', ordine: '-name' })
  })

  it('a search longer than 100 characters is cut in the URL', async () => {
    const { router, user } = renderProbe('/elenco')
    await click(user, 'search long')
    expect(urlParams(router)).toEqual({ cerca: 'x'.repeat(100) })
  })

  it('follows the URL when it changes from outside', async () => {
    const { router } = renderProbe('/elenco?cerca=Rossi')
    await act(() => router.navigate('/elenco?ordine=-created_at&pagina=2'))
    expect(readState()).toEqual({ ...DEFAULTS, page: 2, sort: '-created_at' })
  })
})
