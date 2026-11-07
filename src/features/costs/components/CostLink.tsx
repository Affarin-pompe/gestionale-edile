import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { SiteCost } from '../api'
import { costPaths } from '../paths'

/** The cost's description, linking to its page. */
export function CostLink({ cost, className }: { cost: SiteCost; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={costPaths(company.slug).detail(cost.id)}
      className={cn('font-medium break-words underline-offset-4 hover:underline', className)}
    >
      {cost.description}
    </Link>
  )
}

/** The site's code and name, linking to the site's page. */
export function CostSiteLink({ site }: { site: SiteCost['site'] }) {
  const company = useCompany()
  return (
    <Link to={costPaths(company.slug).site(site.id)} className="underline-offset-4 hover:underline">
      {site.code ? `${site.code} · ${site.name}` : site.name}
    </Link>
  )
}
