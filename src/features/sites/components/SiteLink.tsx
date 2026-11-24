import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Site } from '../api'
import { sitePaths } from '../paths'

/** The site's name, linking to its page. */
export function SiteLink({ site, className }: { site: Site; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={sitePaths(company.slug).detail(site.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {site.name}
    </Link>
  )
}
