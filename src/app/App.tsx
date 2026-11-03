import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'
import type { DataRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { messages } from '@/i18n/it'

export function App({ router, queryClient }: { router: DataRouter; queryClient: QueryClient }) {
  return (
    <IntlProvider locale="it" defaultLocale="it" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </IntlProvider>
  )
}
