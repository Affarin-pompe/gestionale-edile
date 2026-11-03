import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateClient, type ClientInput } from '../api'
import { ClientForm } from '../components/ClientForm'
import { clientPaths } from '../paths'

export function ClientNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = clientPaths(company.slug)
  const create = useCreateClient(company.slug)

  async function save(input: ClientInput) {
    const client = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'clients.created' }))
    await navigate(paths.detail(client.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="clients.title" /> }}
        title={<FormattedMessage id="clients.new" />}
      />
      <ClientForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
