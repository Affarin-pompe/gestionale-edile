import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const DEADLINES_PATH = 'scadenziario'
export const CALENDAR_PATH = 'calendario'
export const DEADLINE_PARAM = 'scadenza'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function deadlinePaths(company: string) {
  const list = `/${company}/${DEADLINES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    calendar: `${list}/${CALENDAR_PATH}`,
    new: `${list}/nuova`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
    // The supplier's page, where its documents and their deadlines are changed. Only the
    // URL is shared with the suppliers module, which is not imported here.
    supplier: (id: string) => `/${company}/anagrafiche/fornitori/${encodeURIComponent(id)}`,
  }
}

/** The deadline id in the URL; only pages under :scadenza use it. */
export function useDeadlineId() {
  const id = useParams()[DEADLINE_PARAM]
  if (id === undefined) throw new Error(`No :${DEADLINE_PARAM} in this route`)
  return id
}

// The filters in the URL, in Italian like the paths. They are shared by the list and the
// calendar, so going from one to the other keeps them.
export const FILTER = {
  from: 'dal',
  to: 'al',
  kind: 'tipo',
  status: 'stato',
  subject: 'soggetto',
  month: 'mese',
} as const

/** "cliente:<id>" or "fornitore:<id>" in the URL. */
const SUBJECT = /^(cliente|fornitore):(.{1,100})$/

export function isSubjectParam(value: string) {
  return SUBJECT.test(value)
}

export function subjectFromParam(value: string | undefined) {
  const match = value === undefined ? null : SUBJECT.exec(value)
  if (!match?.[2]) return undefined
  return match[1] === 'cliente' ? { client: match[2] } : { supplier: match[2] }
}
