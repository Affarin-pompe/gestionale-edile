import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const EMPLOYEES_PATH = 'anagrafiche/dipendenti'
export const EMPLOYEE_PARAM = 'dipendente'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function employeePaths(company: string) {
  const list = `/${company}/${EMPLOYEES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
  }
}

/** The employee id in the URL; only pages under :dipendente use it. */
export function useEmployeeId() {
  const id = useParams()[EMPLOYEE_PARAM]
  if (id === undefined) throw new Error(`No :${EMPLOYEE_PARAM} in this route`)
  return id
}
