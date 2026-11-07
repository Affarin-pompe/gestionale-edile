import type { QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { quoteLinesQuery, quoteQuery } from './api'
import { QuoteCrumb } from './components/QuoteCrumb'
import { QuoteDetailPage } from './pages/QuoteDetailPage'
import { QuoteEditPage } from './pages/QuoteEditPage'
import { QuoteListPage } from './pages/QuoteListPage'
import { QuoteNewPage } from './pages/QuoteNewPage'
import { QUOTE_PARAM, QUOTES_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › quote › edit. */
export function quoteRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('quotes.view')

  // The quote is loaded before its pages open: one of another company, or one that does
  // not exist, gets the 404 page. The lines start loading at the same time.
  async function loadQuote(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [QUOTE_PARAM]: id = '' } = args.params
    void queryClient.prefetchQuery(quoteLinesQuery(azienda, id))
    await queryClient.ensureQueryData(quoteQuery(azienda, id))
    return null
  }

  return [
    {
      path: QUOTES_PATH,
      handle: { crumb: 'quotes.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: QuoteListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'quotes.new' } satisfies RouteHandle,
          loader: requirePermission('quotes.create'),
          Component: QuoteNewPage,
        },
        {
          path: `:${QUOTE_PARAM}`,
          handle: { crumb: QuoteCrumb } satisfies RouteHandle,
          loader: loadQuote,
          children: [
            { index: true, Component: QuoteDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'quotes.edit' } satisfies RouteHandle,
              loader: requirePermission('quotes.update'),
              Component: QuoteEditPage,
            },
          ],
        },
      ],
    },
  ]
}
