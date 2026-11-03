import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany, useMe } from '@/auth/me'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** The company in the URL, in the header; with more than one, a menu to open another. */
export function CompanySwitcher() {
  const { companies } = useMe()
  const company = useCompany()

  const current = (
    <>
      <Building2 className="text-muted-foreground" aria-hidden="true" />
      <span className="max-w-32 truncate sm:max-w-56">{company.name}</span>
    </>
  )

  if (companies.length < 2) {
    return <p className="flex min-w-0 items-center gap-2 text-2sm font-medium">{current}</p>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-0">
          {current}
          <ChevronsUpDown className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end">
        <DropdownMenuLabel>
          <FormattedMessage id="layout.companies" />
        </DropdownMenuLabel>
        {companies.map((c) => (
          // Links, so another company can open in a new tab
          <DropdownMenuItem key={c.slug} asChild>
            <Link to={`/${c.slug}`} aria-current={c.slug === company.slug ? 'true' : undefined}>
              {c.name}
              {c.slug === company.slug && <Check className="ml-auto" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
