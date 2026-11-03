import { FormattedMessage } from 'react-intl'
import { useCompany, useMe } from '@/auth/me'

// Placeholder for the company dashboard
export function HomePage() {
  const me = useMe()
  const company = useCompany()
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold">
        <FormattedMessage id="home.greeting" values={{ name: me.name }} />
      </h1>
      <p className="text-muted-foreground">
        <FormattedMessage
          id="home.membership"
          values={{ company: company.name, role: company.role }}
        />
      </p>
    </div>
  )
}
