import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany, useMe } from '@/auth/me'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

/** The company in the URL; with more than one, a menu to open another. */
export function CompanySwitcher() {
  const { companies } = useMe()
  const company = useCompany()
  const { isMobile, setOpenMobile } = useSidebar()

  const current = (
    <>
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{company.name}</span>
        <span className="truncate text-xs">{company.role}</span>
      </div>
    </>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {companies.length < 2 ? (
          <div className="flex items-center gap-2 p-2">{current}</div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                {current}
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
            >
              <DropdownMenuLabel>
                <FormattedMessage id="layout.companies" />
              </DropdownMenuLabel>
              {companies.map((c) => (
                // Links, so another company can open in a new tab
                <DropdownMenuItem key={c.slug} asChild onSelect={() => setOpenMobile(false)}>
                  <Link
                    to={`/${c.slug}`}
                    aria-current={c.slug === company.slug ? 'true' : undefined}
                  >
                    {c.name}
                    {c.slug === company.slug && <Check className="ml-auto" />}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
