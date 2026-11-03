import { FormattedMessage } from 'react-intl'
import { LogoutButton } from '@/auth/LogoutButton'
import { useCompany, useMe } from '@/auth/me'

// Placeholder for the company dashboard, until the app layout (PR 6 of phase 0)
export function HomePage() {
  const me = useMe()
  const company = useCompany()
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl font-semibold">
        <FormattedMessage id="home.greeting" values={{ name: me.name }} />
      </h1>
      <p className="text-muted-foreground">
        <FormattedMessage
          id="home.membership"
          values={{ company: company.name, role: company.role }}
        />
      </p>
      <div>
        <LogoutButton />
      </div>
    </main>
  )
}
