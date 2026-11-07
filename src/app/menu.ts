import {
  CalendarClock,
  ClipboardList,
  Construction,
  Contact,
  FileText,
  Handshake,
  LayoutDashboard,
  Ruler,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/auth/permissions'
import type { MessageId } from '@/i18n/it'

export interface MenuItem {
  label: MessageId
  icon: LucideIcon
  /** Relative to the company: '' is its dashboard. For a planned module, its future path. */
  path: string
  /** Without it the item is hidden. */
  permission?: Permission
  /** Planned but not built yet: shown to everyone as "Presto", without a link. */
  soon?: boolean
}

export interface MenuGroup {
  label?: MessageId
  items: MenuItem[]
}

// The side menu. A new module is one more line here; once it is built, its permission
// takes the place of `soon`. Requested modules come first in their group.
export const menu: MenuGroup[] = [
  { items: [{ label: 'menu.dashboard', icon: LayoutDashboard, path: '' }] },
  {
    label: 'menu.work',
    items: [
      { label: 'menu.quotes', icon: FileText, path: 'preventivi', permission: 'quotes.view' },
      { label: 'menu.estimates', icon: Ruler, path: 'computi', permission: 'estimates.view' },
      { label: 'menu.sites', icon: Construction, path: 'cantieri', permission: 'sites.view' },
      { label: 'menu.reports', icon: ClipboardList, path: 'rapportini', soon: true },
    ],
  },
  {
    label: 'menu.admin',
    items: [
      {
        label: 'menu.deadlines',
        icon: CalendarClock,
        path: 'scadenziario',
        permission: 'deadlines.view',
      },
      { label: 'menu.costs', icon: Wallet, path: 'costi', soon: true },
    ],
  },
  {
    label: 'menu.registry',
    items: [
      {
        label: 'menu.clients',
        icon: Users,
        path: 'anagrafiche/clienti',
        permission: 'clients.view',
      },
      {
        label: 'menu.suppliers',
        icon: Handshake,
        path: 'anagrafiche/fornitori',
        permission: 'suppliers.view',
      },
      {
        label: 'menu.employees',
        icon: Contact,
        path: 'anagrafiche/dipendenti',
        permission: 'employees.view',
      },
      {
        label: 'menu.vehicles',
        icon: Truck,
        path: 'anagrafiche/mezzi',
        permission: 'vehicles.view',
      },
    ],
  },
]
