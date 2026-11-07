/**
 * A calendar day from the API ("2026-11-07") as a Date at midnight UTC: formatted with
 * timeZone 'UTC' it is the same day wherever the browser is.
 */
export function calendarDay(day: string) {
  return new Date(`${day}T00:00:00Z`)
}
