import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Client } from '../api'
import { clientPaths } from '../paths'

/** The client's name, linking to its page. */
export function ClientLink({ client, className }: { client: Client; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={clientPaths(company.slug).detail(client.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {client.name}
    </Link>
  )
}
