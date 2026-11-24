import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/auth/me'
import { isDay } from '@/lib/days'
import { todayQuery, type DailyReport, type DailyReportToday } from '../api'
import type { HoursOption } from './HoursRows'

/** "Rossi Mario": by surname, as the backend sorts them. */
function personName(person: { first_name: string; last_name: string }) {
  return `${person.last_name} ${person.first_name}`
}

function vehicleName(vehicle: { name: string; plate: string | null }) {
  return vehicle.plate ? `${vehicle.name} (${vehicle.plate})` : vehicle.name
}

/** The employees and vehicles to choose from, out of today's answer, plus the report's own. */
export function hoursOptions(today: DailyReportToday | undefined, report?: DailyReport) {
  const labor: HoursOption[] =
    today?.employees.map((e) => ({ id: e.id, text: personName(e), inTeam: e.in_team })) ?? []
  const vehicles: HoursOption[] =
    today?.vehicles.map((v) => ({ id: v.id, text: vehicleName(v) })) ?? []
  // Rows of people or vehicles no longer active keep their names
  for (const row of report?.labor ?? []) {
    if (!labor.some((o) => o.id === row.employee_id)) {
      labor.push({ id: row.employee_id, text: personName(row) })
    }
  }
  for (const row of report?.vehicles ?? []) {
    if (!vehicles.some((o) => o.id === row.vehicle_id)) {
      vehicles.push({ id: row.vehicle_id, text: vehicleName(row) })
    }
  }
  return { labor, vehicles }
}

/**
 * What the backend has for a site on a day (the report already written, if any) and the
 * active employees and vehicles. It answers to every role that sees reports, also without
 * employees.view or vehicles.view, which the employees' and vehicles' lists would need.
 */
export function useDayOfSite(site: string, date: string) {
  const company = useCompany()
  const ready = site !== '' && isDay(date)
  return useQuery({ ...todayQuery(company.slug, site, date), enabled: ready })
}
