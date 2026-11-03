import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const CLIENTS_PATH = 'anagrafiche/clienti'
export const CLIENT_PARAM = 'cliente'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function clientPaths(company: string) {
  const list = `/${company}/${CLIENTS_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
  }
}

/** The client id in the URL; only pages under :cliente use it. */
export function useClientId() {
  const id = useParams()[CLIENT_PARAM]
  if (id === undefined) throw new Error(`No :${CLIENT_PARAM} in this route`)
  return id
}
