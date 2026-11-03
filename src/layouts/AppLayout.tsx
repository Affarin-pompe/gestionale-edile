import { ArrowLeftToLine } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { NavLink, Outlet, useMatch } from 'react-router'
import { menu, type MenuItem } from '@/app/menu'
import { useCompany } from '@/auth/me'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
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
import { AppLogo } from './AppLogo'
import { Breadcrumbs } from './Breadcrumbs'
import { CompanySwitcher } from './CompanySwitcher'
import { UserMenu } from './UserMenu'

/**
 * Every page inside a company, framed as in Metronic: the side menu with the app's logo,
 * a header with where the page is on the left and the company and the user on the right.
 */
export function AppLayout() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-17.5 shrink-0 justify-center px-6 group-data-[collapsible=icon]:px-5">
          <SidebarLogo />
        </SidebarHeader>
        <SidebarContent>
          <Navigation />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-5 px-4 pb-7.5 lg:px-7.5">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Where the page is on the left; the company and the user on the right. */
function AppHeader() {
  const { isMobile } = useSidebar()

  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-3 bg-background px-4 md:h-17.5 lg:px-7.5">
      {isMobile ? (
        // The menu is a drawer: its button and the mark take the logo's place. No
        // breadcrumbs: the page's own back link takes their place
        <>
          <SidebarTrigger className="-ml-1" />
          <AppLogo markOnly />
        </>
      ) : (
        <>
          <SidebarToggle />
          <Breadcrumbs />
        </>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2.5">
        <CompanySwitcher />
        <UserMenu />
      </div>
    </header>
  )
}

/** The whole logo, or only the mark while the menu shows only icons. */
function SidebarLogo() {
  const { state, isMobile } = useSidebar()
  return <AppLogo markOnly={state === 'collapsed' && !isMobile} />
}

/** Metronic's button on the edge between the side menu and the page, on a computer. */
function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar()
  const intl = useIntl()
  const expanded = state === 'expanded'

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="absolute top-5 left-0 size-7.5 -translate-x-1/2 bg-background"
      aria-label={intl.formatMessage({ id: 'ui.sidebar.toggle' })}
      aria-expanded={expanded}
      onClick={toggleSidebar}
    >
      <ArrowLeftToLine className={expanded ? undefined : 'rotate-180'} aria-hidden="true" />
    </Button>
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
          {items.map((item) =>
            item.soon ? (
              <MenuSoon key={item.path} item={item} />
            ) : (
              <MenuLink
                key={item.path}
                item={item}
                to={`/${slug}${item.path && `/${item.path}`}`}
              />
            ),
          )}
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

/** A module that is planned but not built yet: its name and "Presto", as Metronic's "Soon". */
function MenuSoon({ item }: { item: MenuItem }) {
  const intl = useIntl()
  const label = intl.formatMessage({ id: item.label })
  const soon = intl.formatMessage({ id: 'menu.soon' })

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={`${label} · ${soon}`}
        className="cursor-default hover:bg-transparent hover:text-sidebar-foreground hover:[&>svg]:text-muted-foreground"
      >
        <span>
          <item.icon />
          <span className="truncate">{label}</span>
          <Badge
            variant="secondary"
            className="ml-auto text-foreground/70 group-data-[collapsible=icon]:hidden"
          >
            <FormattedMessage id="menu.soon" />
          </Badge>
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
