import { LogOut } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useSubmit } from 'react-router'
import { useCompany, useMe } from '@/auth/me'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** "Giulia Rossi" → "GR": the first letters of the first and the last word. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words
  return letters.map((word) => word?.charAt(0).toUpperCase()).join('')
}

/** The user's avatar on the right of the header, as in Metronic: who is signed in, and logout. */
export function UserMenu() {
  const me = useMe()
  const company = useCompany()
  const submit = useSubmit()
  const intl = useIntl()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full p-0"
          aria-label={intl.formatMessage({ id: 'layout.userMenu' }, { name: me.name })}
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-2sm font-semibold text-primary"
          >
            {initials(me.name)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate font-medium text-foreground">{me.name}</span>
          <span className="truncate text-xs text-muted-foreground">{me.email}</span>
          <span className="truncate text-xs text-muted-foreground">{company.role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* The same action as the logout button outside the app */}
        <DropdownMenuItem onSelect={() => void submit(null, { method: 'post', action: '/esci' })}>
          <LogOut />
          <FormattedMessage id="logout.submit" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
