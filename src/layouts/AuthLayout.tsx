import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { FormattedMessage } from 'react-intl'
import { Outlet } from 'react-router'

/** Sign-in pages: outside the session, with nothing cached from the previous one. */
export function AuthLayout() {
  const queryClient = useQueryClient()
  // After a logout or a 401, the previous user's data must not reappear, not even with the
  // browser's back button. Cleared once the pages that read it are gone, or they would fetch again.
  useEffect(() => {
    queryClient.clear()
  }, [queryClient])

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-4">
      <p className="font-heading text-xl font-semibold">
        <FormattedMessage id="app.name" />
      </p>
      <Outlet />
    </main>
  )
}
