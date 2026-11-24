import { useParams } from 'react-router'

/** Relative to the company, as in the menu. */
export const VEHICLES_PATH = 'anagrafiche/mezzi'
export const VEHICLE_PARAM = 'mezzo'

/** Absolute paths of the module's pages. Ids come from the backend: they are encoded. */
export function vehiclePaths(company: string) {
  const list = `/${company}/${VEHICLES_PATH}`
  const detail = (id: string) => `${list}/${encodeURIComponent(id)}`
  return {
    list,
    new: `${list}/nuovo`,
    detail,
    edit: (id: string) => `${detail(id)}/modifica`,
  }
}

/** The vehicle id in the URL; only pages under :mezzo use it. */
export function useVehicleId() {
  const id = useParams()[VEHICLE_PARAM]
  if (id === undefined) throw new Error(`No :${VEHICLE_PARAM} in this route`)
  return id
}
