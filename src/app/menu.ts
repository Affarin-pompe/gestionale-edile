import { LayoutDashboard, Users, type LucideIcon } from 'lucide-react'
import type { Permission } from '@/auth/permissions'
import type { MessageId } from '@/i18n/it'

export interface MenuItem {
  label: MessageId
  icon: LucideIcon
  /** Relative to the company: '' is its dashboard. */
  path: string
  /** Without it the item is hidden. */
  permission?: Permission
}

export interface MenuGroup {
  label?: MessageId
  items: MenuItem[]
}

// The side menu. A new module is one more line here.
export const menu: MenuGroup[] = [
  { items: [{ label: 'menu.dashboard', icon: LayoutDashboard, path: '' }] },
  {
    label: 'menu.registry',
    items: [
      {
        label: 'menu.clients',
        icon: Users,
        path: 'anagrafiche/clienti',
        permission: 'clients.view',
      },
    ],
  },
]
