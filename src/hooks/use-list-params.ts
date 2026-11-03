import { useSearchParams } from 'react-router'

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
