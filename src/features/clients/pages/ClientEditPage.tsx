import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { clientQuery, useUpdateClient, type ClientInput } from '../api'
import { ClientForm } from '../components/ClientForm'
import { clientPaths, useClientId } from '../paths'

export function ClientEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useClientId()
  const paths = clientPaths(company.slug)
  // Already loaded by the route's loader
  const { data: client } = useSuspenseQuery(clientQuery(company.slug, id))
  const update = useUpdateClient(company.slug, id)

  async function save(input: ClientInput) {
    await update.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'clients.updated' }))
    await navigate(paths.detail(id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: client.name }}
        title={<FormattedMessage id="clients.editTitle" />}
      />
      <ClientForm client={client} onSubmit={save} cancelTo={paths.detail(id)} />
    </div>
  )
}
