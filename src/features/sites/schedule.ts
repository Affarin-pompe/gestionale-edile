// The days of the schedule, as AAAA-MM-GG: positions on the chart are counted in whole days,
// in UTC, so the browser's time zone never moves a bar.
import { addDays } from '@/lib/days'
import type { SiteActivity } from './api'

const MS_PER_DAY = 86_400_000

function utc(day: string) {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
}

/** Days from `from` to `to`: 0 for the same day. */
export function daysBetween(from: string, to: string) {
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY)
}

export interface Scale {
  from: string
  to: string
  /** Days shown, both ends included. */
  days: number
}

/** From the first start to the last end, with a day of room on each side. */
export function scaleOf(activities: SiteActivity[]): Scale | undefined {
  if (activities.length === 0) return undefined
  let from = activities[0]?.start_on ?? ''
  let to = activities[0]?.end_on ?? ''
  for (const activity of activities) {
    if (activity.start_on < from) from = activity.start_on
    if (activity.end_on > to) to = activity.end_on
  }
  from = addDays(from, -1)
  to = addDays(to, 1)
  return { from, to, days: daysBetween(from, to) + 1 }
}

/** Where a span of days starts and how wide it is, in percent of the scale. */
export function placement(scale: Scale, start: string, end: string) {
  const left = (daysBetween(scale.from, start) / scale.days) * 100
  const width = ((daysBetween(start, end) + 1) / scale.days) * 100
  return { left: `${left}%`, width: `${width}%` }
}

/** Where each month starts inside the scale, for the labels above the bars. */
export function monthStarts(scale: Scale) {
  // The month the scale starts in is named at its left edge, unless the next one is so near
  // that the two names would overlap
  const first = nextMonth(scale.from)
  const starts = daysBetween(scale.from, first) >= 8 ? [scale.from] : []
  for (let day = first; day <= scale.to; day = nextMonth(day)) starts.push(day)
  return starts
}

/** The first day of the month after `day`'s. */
function nextMonth(day: string) {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  return month === 12
    ? `${String(year + 1).padStart(4, '0')}-01-01`
    : `${day.slice(0, 4)}-${String(month + 1).padStart(2, '0')}-01`
}
