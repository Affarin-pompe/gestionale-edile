import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const ESTIMATES_PATH = 'computi'
export const ESTIMATE_PARAM = 'computo'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function estimatePaths(company: string) {
  const list = `/${company}/${ESTIMATES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
  }
}

/** The estimate id in the URL; only pages under :computo use it. */
export function useEstimateId() {
  const id = useParams()[ESTIMATE_PARAM]
  if (id === undefined) throw new Error(`No :${ESTIMATE_PARAM} in this route`)
  return id
}
