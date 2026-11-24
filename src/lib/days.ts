// Dates without a time (AAAA-MM-GG), as the contract sends them. The arithmetic is done in
// UTC, so the browser's time zone never moves a day.

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const MS_PER_DAY = 86_400_000

function toUtc(day: string) {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
}

function fromUtc(time: number) {
  return new Date(time).toISOString().slice(0, 10)
}

/** A real calendar day written as AAAA-MM-GG. */
export function isDay(value: string) {
  return DAY.test(value) && fromUtc(toUtc(value)) === value
}

/** A month written as AAAA-MM. */
export function isMonth(value: string) {
  return MONTH.test(value) && isDay(`${value}-01`)
}

/** Today in Italy, where the company works, whatever the browser's time zone. */
export function today() {
  // en-CA writes the date as AAAA-MM-GG
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

export function addDays(day: string, days: number) {
  return fromUtc(toUtc(day) + days * MS_PER_DAY)
}

/** Monday 0 … Sunday 6, as Italian calendars start the week on Monday. */
export function weekday(day: string) {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7
}

export function monthOf(day: string) {
  return day.slice(0, 7)
}

export function shiftMonth(month: string, months: number) {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + months
  const year = Math.floor(index / 12)
  return `${String(year).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** The first and the last day of the month. */
export function monthRange(month: string) {
  const from = `${month}-01`
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) }
}

/** The weeks shown for a month, Monday to Sunday, with the days of the months around it. */
export function monthWeeks(month: string) {
  const { from, to } = monthRange(month)
  const start = addDays(from, -weekday(from))
  const end = addDays(to, 6 - weekday(to))
  const weeks: string[][] = []
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
  }
  return weeks
}

/** For Intl: noon in UTC of that day, so no time zone shows it as another day. */
export function dayToDate(day: string) {
  return new Date(toUtc(day) + MS_PER_DAY / 2)
}
