import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'

// URL parameter names, in Italian like the paths
const PAGE = 'pagina'
const SORT = 'ordine'
const SEARCH = 'cerca'
const PER_PAGE = 'per_pagina'
// The contract's limit for search: longer would be refused with a 422
const MAX_SEARCH = 100
/** The rows per page one can choose, and the contract's default. */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_PER_PAGE = 25

// The parameters of each list as the user left it, by path. Only in memory: a reload
// forgets them, and so does the sign-in page, since another user may sign in.
const leftLists = new Map<string, string>()

function withoutTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/**
 * The way back to a list (breadcrumbs, back links, Cancel): its path with the page, sort,
 * search and filters it had when the user left it. Other paths stay as they are.
 */
export function listHref(path: string) {
  return path + (leftLists.get(withoutTrailingSlash(path)) ?? '')
}

/** Forgets every list's parameters: they belong to the user who chose them. */
export function forgetLists() {
  leftLists.clear()
}

export interface ListOptions<TSort extends string, TFilter extends string> {
  /** The API's sort values, as in the contract (e.g. 'name', '-name'); the first is the default. */
  sorts: readonly [TSort, ...TSort[]]
  /** The allowed values of each filter, by URL parameter name. */
  filters: Record<TFilter, readonly string[]>
}

/**
 * Page, sort, search and filters of a list, kept in the URL so a filtered list can be
 * bookmarked and shared. Values that the API would refuse fall back to the default.
 */
export function useListParams<TSort extends string, TFilter extends string>(
  options: ListOptions<TSort, TFilter>,
) {
  const [params, setParams] = useSearchParams()
  const [defaultSort] = options.sorts

  const { pathname, search: query } = useLocation()
  useEffect(() => {
    const path = withoutTrailingSlash(pathname)
    if (query) leftLists.set(path, query)
    else leftLists.delete(path)
  }, [pathname, query])

  const pageParam = params.get(PAGE) ?? ''
  const page = /^[1-9]\d{0,5}$/.test(pageParam) ? Number(pageParam) : 1
  const sortParam = params.get(SORT)
  const sort = options.sorts.find((s) => s === sortParam) ?? defaultSort
  const search = (params.get(SEARCH) ?? '').slice(0, MAX_SEARCH)
  const perPage =
    PER_PAGE_OPTIONS.find((n) => String(n) === params.get(PER_PAGE)) ?? DEFAULT_PER_PAGE
  const filters = {} as Partial<Record<TFilter, string>>
  for (const name of Object.keys(options.filters) as TFilter[]) {
    const value = params.get(name)
    if (value !== null && options.filters[name].includes(value)) filters[name] = value
  }

  /** Empty values leave the URL. Any change but the page goes back to the first page. */
  function update(changes: Record<string, string | undefined>, replace = false) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [name, value] of Object.entries(changes)) {
          if (value) next.set(name, value)
          else next.delete(name)
        }
        if (!(PAGE in changes)) next.delete(PAGE)
        return next
      },
      { replace },
    )
  }

  return {
    page,
    perPage,
    sort,
    search,
    filters,
    setPage: (value: number) => update({ [PAGE]: value > 1 ? String(value) : undefined }),
    setPerPage: (value: number) => {
      const known = PER_PAGE_OPTIONS.find((n) => n === value)
      if (known) update({ [PER_PAGE]: known === DEFAULT_PER_PAGE ? undefined : String(known) })
    },
    setSort: (value: string) => {
      const known = options.sorts.find((s) => s === value)
      if (known) update({ [SORT]: known === defaultSort ? undefined : known })
    },
    // Kept as typed (the API call trims it), and without one history entry per letter
    setSearch: (value: string) => update({ [SEARCH]: value.slice(0, MAX_SEARCH) }, true),
    setFilter: (name: TFilter, value: string | undefined) => update({ [name]: value }),
  }
}
