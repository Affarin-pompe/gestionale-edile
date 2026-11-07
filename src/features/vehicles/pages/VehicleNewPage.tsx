import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateVehicle, type VehicleInput } from '../api'
import { VehicleForm } from '../components/VehicleForm'
import { vehiclePaths } from '../paths'

export function VehicleNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = vehiclePaths(company.slug)
  const create = useCreateVehicle(company.slug)

  async function save(input: VehicleInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'vehicles.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="vehicles.title" /> }}
        title={<FormattedMessage id="vehicles.new" />}
      />
      <VehicleForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
