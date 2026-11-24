import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Supplier } from '../api'
import { supplierPaths } from '../paths'

/** The supplier's name, linking to its page. */
export function SupplierLink({ supplier, className }: { supplier: Supplier; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={supplierPaths(company.slug).detail(supplier.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {supplier.name}
    </Link>
  )
}
