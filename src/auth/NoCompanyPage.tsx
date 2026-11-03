import { ErrorLayout } from '@/layouts/ErrorLayout'
import { LogoutButton } from './LogoutButton'

/** For a user who signed in but does not belong to any company yet. */
export function NoCompanyPage() {
  return (
    <ErrorLayout title="noCompany.title" text="noCompany.text">
      <LogoutButton />
    </ErrorLayout>
  )
}
