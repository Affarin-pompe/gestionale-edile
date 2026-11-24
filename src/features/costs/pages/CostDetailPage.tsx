import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Detail, DetailSection, NotesSection } from '@/components/common/DetailSection'
import { Day } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/lib/money'
import { costQuery, forgetCost, useDeleteCost } from '../api'
import { CostSiteLink } from '../components/CostLink'
import { costPaths, useCostId } from '../paths'

export function CostDetailPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCompany()
  const id = useCostId()
  const paths = costPaths(company.slug)
  // Already loaded by the route's loader
  const { record: cost, etag } = useSuspenseQuery(costQuery(company.slug, id)).data
  const canUpdate = useCan('costs.update')
  const canDelete = useCan('costs.delete')
  const canSeeSuppliers = useCan('suppliers.view')
  const remove = useDeleteCost(company.slug, id)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="costs.title" /> }}
        title={cost.description}
        actions={
          <>
            {canDelete && (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" />
                <FormattedMessage id="costs.delete" />
              </Button>
            )}
            {canUpdate && (
              <Button asChild>
                <Link to={paths.edit(id)}>
                  <Pencil aria-hidden="true" />
                  <FormattedMessage id="costs.edit" />
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="costs.section.main">
          <Detail label="costs.amount">
            <span className="font-semibold">{formatEuro(cost.amount)}</span>
          </Detail>
          <Detail label="costs.date">
            <Day value={cost.date} />
          </Detail>
          <Detail label="costs.category">
            <FormattedMessage id={`costs.category.${cost.category}`} />
          </Detail>
          <Detail label="costs.site">
            <CostSiteLink site={cost.site} />
          </Detail>
          <Detail label="costs.supplier">
            {cost.supplier &&
              (canSeeSuppliers ? (
                <Link
                  to={paths.supplier(cost.supplier.id)}
                  className="underline-offset-4 hover:underline"
                >
                  {cost.supplier.name}
                </Link>
              ) : (
                cost.supplier.name
              ))}
          </Detail>
        </DetailSection>
        <NotesSection title="costs.notes" notes={cost.notes} />
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="costs.delete.title"
        text={
          <FormattedMessage
            id="costs.delete.text"
            values={{ description: cost.description, amount: formatEuro(cost.amount) }}
          />
        }
        confirm="costs.delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(etag)
          toast.success(intl.formatMessage({ id: 'costs.deleted' }))
          await navigate(paths.list)
          forgetCost(queryClient, company.slug, id)
        }}
      />
    </div>
  )
}
