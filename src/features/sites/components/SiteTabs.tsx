import { cn } from 'cn'
import { FormattedMessage, useIntl } from 'react-intl'
import { NavLink } from 'react-router'
import { useCompany } from '@/auth/me'
import { SITE_TABS, sitePaths, TAB_PERMISSIONS, type SiteTab } from '../paths'

/** The tabs of a site as links: each is a page. On a phone the row scrolls sideways. */
export function SiteTabs({ siteId }: { siteId: string }) {
  const intl = useIntl()
  const company = useCompany()
  const paths = sitePaths(company.slug)
  const tabs = (Object.keys(SITE_TABS) as SiteTab[]).filter((tab) =>
    company.permissions.includes(TAB_PERMISSIONS[tab]),
  )
  return (
    <nav
      aria-label={intl.formatMessage({ id: 'sites.tabs' })}
      className="-mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
    >
      <ul className="flex min-w-max gap-5">
        {tabs.map((tab) => (
          <li key={tab}>
            <NavLink
              to={paths.tab(siteId, tab)}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex h-10 items-center border-b-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              <FormattedMessage id={`sites.tab.${tab}`} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
