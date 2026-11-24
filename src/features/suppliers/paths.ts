import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const SUPPLIERS_PATH = 'anagrafiche/fornitori'
export const SUPPLIER_PARAM = 'fornitore'
export const DOCUMENT_PARAM = 'documento'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function supplierPaths(company: string) {
  const list = `/${company}/${SUPPLIERS_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
    newDocument: (id: string) => `${detail(id)}/documenti/nuovo`,
    editDocument: (id: string, document: string) =>
      `${detail(id)}/documenti/${encodeURIComponent(document)}`,
  }
}

/** The supplier id in the URL; only pages under :fornitore use it. */
export function useSupplierId() {
  const id = useParams()[SUPPLIER_PARAM]
  if (id === undefined) throw new Error(`No :${SUPPLIER_PARAM} in this route`)
  return id
}

/** The document id in the URL; only the page of a document uses it. */
export function useDocumentId() {
  const id = useParams()[DOCUMENT_PARAM]
  if (id === undefined) throw new Error(`No :${DOCUMENT_PARAM} in this route`)
  return id
}
