import type { ReactNode } from 'react'
import { useCan, type Permission } from '@/auth/permissions'

/** Shows its content only to roles with the permission. It hides; the backend blocks. */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  return useCan(permission) ? children : fallback
}
