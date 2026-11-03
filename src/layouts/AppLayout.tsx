import { useIntl } from 'react-intl'
import { NavLink, Outlet, useMatch } from 'react-router'
import { menu, type MenuItem } from '@/app/menu'
import { useCompany } from '@/auth/me'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Breadcrumbs } from './Breadcrumbs'
import { CompanySwitcher } from './CompanySwitcher'
import { UserMenu } from './UserMenu'

/** Every page inside a company: side menu, header and the page. */
export function AppLayout() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-17.5 justify-center">
          <CompanySwitcher />
        </SidebarHeader>
        <SidebarContent>
          <Navigation />
        </SidebarContent>
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-3 bg-background px-4 md:h-17.5 lg:px-7.5">
          <SidebarTrigger className="-ml-1" />
          {/* On a phone the page's own back link takes their place */}
          <Breadcrumbs className="hidden md:block" />
        </header>
        <div className="flex flex-1 flex-col gap-5 px-4 pb-7.5 lg:px-7.5">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function Navigation() {
  const intl = useIntl()
  const { slug, permissions } = useCompany()

  return menu.map((group) => {
    const items = group.items.filter((i) => !i.permission || permissions.includes(i.permission))
    if (items.length === 0) return null
    return (
      <SidebarGroup key={group.label ?? 'main'}>
        {group.label && (
          <SidebarGroupLabel>{intl.formatMessage({ id: group.label })}</SidebarGroupLabel>
        )}
        <SidebarMenu>
          {items.map((item) => (
            <MenuLink key={item.path} item={item} to={`/${slug}${item.path && `/${item.path}`}`} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )
  })
}

function MenuLink({ item, to }: { item: MenuItem; to: string }) {
  const label = useIntl().formatMessage({ id: item.label })
  const { setOpenMobile } = useSidebar()
  // The dashboard is active only on itself, a section also on its sub-pages
  const end = item.path === ''
  const active = useMatch({ path: to, end }) !== null

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} end={end} onClick={() => setOpenMobile(false)}>
          <item.icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
