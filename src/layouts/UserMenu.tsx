import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useSubmit } from 'react-router'
import { useMe } from '@/auth/me'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function UserMenu() {
  const me = useMe()
  const submit = useSubmit()
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
                <UserRound className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{me.name}</span>
                <span className="truncate text-xs">{me.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            align="end"
            side={isMobile ? 'bottom' : 'right'}
          >
            {/* The same action as the logout button outside the app */}
            <DropdownMenuItem
              onSelect={() => void submit(null, { method: 'post', action: '/esci' })}
            >
              <LogOut />
              <FormattedMessage id="logout.submit" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
