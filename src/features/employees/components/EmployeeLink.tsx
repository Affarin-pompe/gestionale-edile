import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Employee } from '../api'
import { employeePaths } from '../paths'
import { employeeName } from '../schemas'

/** The employee's name, linking to its page. */
export function EmployeeLink({ employee, className }: { employee: Employee; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={employeePaths(company.slug).detail(employee.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {employeeName(employee)}
    </Link>
  )
}
