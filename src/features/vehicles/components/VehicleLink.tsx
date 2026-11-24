import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Vehicle } from '../api'
import { vehiclePaths } from '../paths'

/** The vehicle's name, linking to its page. */
export function VehicleLink({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={vehiclePaths(company.slug).detail(vehicle.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {vehicle.name}
    </Link>
  )
}
