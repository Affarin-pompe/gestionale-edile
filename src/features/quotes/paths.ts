import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const QUOTES_PATH = 'preventivi'
export const QUOTE_PARAM = 'preventivo'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function quotePaths(company: string) {
  const list = `/${company}/${QUOTES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
  }
}

/** The quote id in the URL; only pages under :preventivo use it. */
export function useQuoteId() {
  const id = useParams()[QUOTE_PARAM]
  if (id === undefined) throw new Error(`No :${QUOTE_PARAM} in this route`)
  return id
}
