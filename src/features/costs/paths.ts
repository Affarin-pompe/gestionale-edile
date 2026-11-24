import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const COSTS_PATH = 'costi'
export const COST_PARAM = 'costo'

// The filters in the URL, in Italian like the paths. `cantiere` is also how other pages
// (the site's page) open the list and the new cost on one site.
export const FILTER = {
  site: 'cantiere',
  category: 'categoria',
  supplier: 'fornitore',
  from: 'dal',
  to: 'al',
} as const

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function costPaths(company: string) {
  const list = `/${company}/${COSTS_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: (site?: string) =>
      site ? `${list}/nuovo?${new URLSearchParams({ [FILTER.site]: site })}` : `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
    // Pages of other modules. Only the URLs are shared: the modules are not imported.
    site: (id: string) => `/${company}/cantieri/${encodeURIComponent(id)}`,
    supplier: (id: string) => `/${company}/anagrafiche/fornitori/${encodeURIComponent(id)}`,
  }
}

/** The cost id in the URL; only pages under :costo use it. */
export function useCostId() {
  const id = useParams()[COST_PARAM]
  if (id === undefined) throw new Error(`No :${COST_PARAM} in this route`)
  return id
}
