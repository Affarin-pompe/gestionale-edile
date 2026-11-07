import { useParams } from 'react-router'
import type { Permission } from '@/auth/permissions'

/** Relative to the company, as in the menu. */
export const SITES_PATH = 'cantieri'
export const SITE_PARAM = 'cantiere'

/** The tabs of a site, in the order they show; each is a page with its own URL. */
export const SITE_TABS = {
  overview: 'panoramica',
  reports: 'rapportini',
  documents: 'documenti',
  costs: 'costi',
  photos: 'foto',
  team: 'squadra',
  schedule: 'cronoprogramma',
} as const
export type SiteTab = keyof typeof SITE_TABS

/** The permission each tab needs, as its page's route asks for it. */
export const TAB_PERMISSIONS: Record<SiteTab, Permission> = {
  overview: 'sites.view',
  reports: 'reports.view',
  documents: 'documents.view',
  costs: 'costs.view',
  photos: 'documents.view',
  team: 'sites.view',
  schedule: 'sites.view',
}

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function sitePaths(company: string) {
  const list = `/${company}/${SITES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
    tab: (id: string, tab: SiteTab) => `${detail(id)}/${SITE_TABS[tab]}`,
    // The pages of the reports and costs modules, filtered on the site (agreed with them)
    allReports: (id: string) => `/${company}/rapportini?cantiere=${encodeURIComponent(id)}`,
    report: (report: string) => `/${company}/rapportini/${encodeURIComponent(report)}`,
    allCosts: (id: string) => `/${company}/costi?cantiere=${encodeURIComponent(id)}`,
  }
}

/** The site id in the URL; only pages under :cantiere use it. */
export function useSiteId() {
  const id = useParams()[SITE_PARAM]
  if (id === undefined) throw new Error(`No :${SITE_PARAM} in this route`)
  return id
}
