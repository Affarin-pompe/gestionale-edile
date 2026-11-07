import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { useActionError } from '@/components/common/use-action-error'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  employeeOptionsQuery,
  siteTeamQuery,
  useReplaceSiteTeam,
  type SiteTeamMember,
} from '../api'
import { QueryBody, TabSection } from '../components/TabSection'
import { useSiteId } from '../paths'

/** The employees assigned to the site. The contract has no vehicles in the team. */
export function SiteTeamPage() {
  const intl = useIntl()
  const company = useCompany()
  const id = useSiteId()
  const canUpdate = useCan('sites.update')
  const query = useQuery(siteTeamQuery(company.slug, id))
  const replace = useReplaceSiteTeam(company.slug, id)
  const describeError = useActionError()
  const team = query.data ?? []

  async function change(employeeIds: string[], done: 'sites.team.added' | 'sites.team.removed') {
    try {
      await replace.mutateAsync(employeeIds)
      toast.success(intl.formatMessage({ id: done }))
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  return (
    <TabSection
      title="sites.team.title"
      description={
        query.data && (
          <FormattedMessage id="sites.team.count" values={{ count: query.data.length }} />
        )
      }
    >
      {canUpdate && query.data && (
        <AddMember
          team={team}
          busy={replace.isPending}
          onAdd={(employeeId) =>
            change([...team.map((m) => m.employee_id), employeeId], 'sites.team.added')
          }
        />
      )}
      <QueryBody query={query} isEmpty={(data) => data.length === 0} empty="sites.team.empty">
        {(members) => (
          <ul className="divide-y">
            {members.map((member) => (
              <li
                key={member.employee_id}
                className="flex items-center justify-between gap-2.5 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2.5 font-medium">
                    {memberName(member)}
                    {!member.active && (
                      <Badge variant="invert-light">
                        <FormattedMessage id="sites.team.inactive" />
                      </Badge>
                    )}
                  </p>
                  {member.job_title && (
                    <p className="text-sm text-muted-foreground">{member.job_title}</p>
                  )}
                </div>
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={replace.isPending}
                    aria-label={intl.formatMessage(
                      { id: 'sites.team.remove' },
                      { name: memberName(member) },
                    )}
                    onClick={() =>
                      void change(
                        team
                          .filter((m) => m.employee_id !== member.employee_id)
                          .map((m) => m.employee_id),
                        'sites.team.removed',
                      )
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryBody>
    </TabSection>
  )
}

function memberName(member: Pick<SiteTeamMember, 'first_name' | 'last_name'>) {
  return `${member.last_name} ${member.first_name}`
}

/** A choice among the active employees not in the team yet. It needs employees.view. */
function AddMember({
  team,
  busy,
  onAdd,
}: {
  team: SiteTeamMember[]
  busy: boolean
  onAdd: (employeeId: string) => Promise<void>
}) {
  const intl = useIntl()
  const company = useCompany()
  const canSeeEmployees = useCan('employees.view')
  const employees = useQuery({ ...employeeOptionsQuery(company.slug), enabled: canSeeEmployees })
  const [chosen, setChosen] = useState('')
  if (!canSeeEmployees) {
    return (
      <p className="border-b px-5 py-3 text-sm text-muted-foreground">
        <FormattedMessage id="sites.team.noEmployeesView" />
      </p>
    )
  }
  const inTeam = new Set(team.map((m) => m.employee_id))
  const options = (employees.data ?? []).filter((e) => !inTeam.has(e.id))

  return (
    <form
      className="flex flex-wrap items-center gap-2.5 border-b px-5 py-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!chosen) return
        void onAdd(chosen).then(() => setChosen(''))
      }}
    >
      <NativeSelect
        aria-label={intl.formatMessage({ id: 'sites.team.choose' })}
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        disabled={employees.isPending}
      >
        <NativeSelectOption value="">
          {intl.formatMessage({
            id:
              options.length > 0 || employees.isPending ? 'sites.team.choose' : 'sites.team.allIn',
          })}
        </NativeSelectOption>
        {options.map((employee) => (
          <NativeSelectOption key={employee.id} value={employee.id}>
            {memberName(employee)}
            {employee.job_title ? ` · ${employee.job_title}` : ''}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button type="submit" variant="outline" disabled={busy || !chosen}>
        <Plus aria-hidden="true" />
        <FormattedMessage id="sites.team.add" />
      </Button>
    </form>
  )
}
