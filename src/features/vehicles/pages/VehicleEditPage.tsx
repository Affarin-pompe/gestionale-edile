import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { vehicleQuery, useUpdateVehicle, type VehicleInput } from '../api'
import { VehicleForm } from '../components/VehicleForm'
import { vehiclePaths, useVehicleId } from '../paths'

export function VehicleEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useVehicleId()
  const paths = vehiclePaths(company.slug)
  // Already loaded by the route's loader
  const { data } = useSuspenseQuery(vehicleQuery(company.slug, id))
  // The version the form was opened on: if someone saves meanwhile, the backend answers 412
  const [etag] = useState(data.etag)
  const update = useUpdateVehicle(company.slug, id)

  async function save(input: VehicleInput) {
    await update.mutateAsync({ input, etag })
    toast.success(intl.formatMessage({ id: 'vehicles.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: data.record.name }}
        title={<FormattedMessage id="vehicles.editTitle" />}
      />
      <VehicleForm vehicle={data.record} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
