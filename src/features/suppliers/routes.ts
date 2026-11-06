import type { QueryClient } from '@tanstack/react-query'
import { data, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { requirePermission } from '@/auth/session'
import { supplierDocumentsQuery, supplierQuery } from './api'
import { DocumentCrumb } from './components/DocumentCrumb'
import { SupplierCrumb } from './components/SupplierCrumb'
import { SupplierDetailPage } from './pages/SupplierDetailPage'
import { SupplierDocumentEditPage } from './pages/SupplierDocumentEditPage'
import { SupplierDocumentNewPage } from './pages/SupplierDocumentNewPage'
import { SupplierEditPage } from './pages/SupplierEditPage'
import { SupplierListPage } from './pages/SupplierListPage'
import { SupplierNewPage } from './pages/SupplierNewPage'
import { DOCUMENT_PARAM, SUPPLIER_PARAM, SUPPLIERS_PATH } from './paths'

/** Paths relative to the company, nested like the breadcrumbs: list › supplier › edit. */
export function supplierRoutes(queryClient: QueryClient): RouteObject[] {
  const canView = requirePermission('suppliers.view')
  const canUpdate = requirePermission('suppliers.update')

  // The supplier is loaded before its pages open: one of another company, or one that does
  // not exist, gets the 404 page (the API answers 404)
  async function loadSupplier(args: LoaderFunctionArgs) {
    canView(args)
    const { azienda = '', [SUPPLIER_PARAM]: id = '' } = args.params
    await queryClient.ensureQueryData(supplierQuery(azienda, id))
    return null
  }

  // The contract has no request for a single document: it is looked for in the list
  async function loadDocument(args: LoaderFunctionArgs) {
    canUpdate(args)
    const { azienda = '', [SUPPLIER_PARAM]: id = '', [DOCUMENT_PARAM]: document } = args.params
    const documents = await queryClient.fetchQuery(supplierDocumentsQuery(azienda, id))
    if (!documents.some((d) => d.id === document)) throw data(null, { status: 404 })
    return null
  }

  return [
    {
      path: SUPPLIERS_PATH,
      handle: { crumb: 'suppliers.title' } satisfies RouteHandle,
      children: [
        { index: true, loader: canView, Component: SupplierListPage },
        {
          path: 'nuovo',
          handle: { crumb: 'suppliers.new' } satisfies RouteHandle,
          loader: requirePermission('suppliers.create'),
          Component: SupplierNewPage,
        },
        {
          path: `:${SUPPLIER_PARAM}`,
          handle: { crumb: SupplierCrumb } satisfies RouteHandle,
          loader: loadSupplier,
          children: [
            { index: true, Component: SupplierDetailPage },
            {
              path: 'modifica',
              handle: { crumb: 'suppliers.edit' } satisfies RouteHandle,
              loader: canUpdate,
              Component: SupplierEditPage,
            },
            {
              path: 'documenti/nuovo',
              handle: { crumb: 'suppliers.documents.new' } satisfies RouteHandle,
              loader: canUpdate,
              Component: SupplierDocumentNewPage,
            },
            {
              path: `documenti/:${DOCUMENT_PARAM}`,
              handle: { crumb: DocumentCrumb } satisfies RouteHandle,
              loader: loadDocument,
              Component: SupplierDocumentEditPage,
            },
          ],
        },
      ],
    },
  ]
}
