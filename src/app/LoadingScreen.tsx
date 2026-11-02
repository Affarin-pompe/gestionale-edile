import { FormattedMessage } from 'react-intl'

/** Shown while the first page loads its data. */
export function LoadingScreen() {
  return (
    <main aria-busy className="flex min-h-svh items-center justify-center text-muted-foreground">
      <FormattedMessage id="app.loading" />
    </main>
  )
}
