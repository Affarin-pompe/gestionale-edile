import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const REPORTS_PATH = 'rapportini'
export const TODAY_PATH = 'oggi'
export const REPORT_PARAM = 'rapportino'

// The filters in the URL, in Italian like the paths. `cantiere` is also how other pages
// (the site's page) open the list, today's page and the new report on one site.
export const FILTER = {
  site: 'cantiere',
  from: 'dal',
  to: 'al',
  status: 'stato',
} as const

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function reportPaths(company: string) {
  const list = `/${company}/${REPORTS_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  const onSite = (path: string, site?: string) =>
    site ? `${path}?${new URLSearchParams({ [FILTER.site]: site })}` : path
  return {
    list,
    listOfSite: (site: string) => onSite(list, site),
    new: (site?: string) => onSite(`${list}/nuovo`, site),
    today: (site?: string) => onSite(`${list}/${TODAY_PATH}`, site),
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
    // The site's page. Only the URL is shared with the sites module, which is not imported.
    site: (id: string) => `/${company}/cantieri/${encodeURIComponent(id)}`,
  }
}

/** The report id in the URL; only pages under :rapportino use it. */
export function useReportId() {
  const id = useParams()[REPORT_PARAM]
  if (id === undefined) throw new Error(`No :${REPORT_PARAM} in this route`)
  return id
}
