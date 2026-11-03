import type { components } from '@/api/schema'
import { useCompany } from './me'

export type Permission = components['schemas']['Permission']

/**
 * Whether the user's role allows this in the company in the URL.
 * Only for hiding buttons and sections: the backend checks every request again.
 */
export function useCan(permission: Permission) {
  return useCompany().permissions.includes(permission)
}
