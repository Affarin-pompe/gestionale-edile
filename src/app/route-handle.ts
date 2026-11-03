import type { ComponentType } from 'react'
import type { MessageId } from '@/i18n/it'

/** What a route tells the layout about itself, in its `handle`. */
export interface RouteHandle {
  /**
   * Its name in the breadcrumbs: a text, or a component for a name that comes from data
   * (e.g. the client's name). Routes without it are not a step of the breadcrumbs.
   */
  crumb: MessageId | ComponentType
}
