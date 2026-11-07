import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { Day, Money } from '@/components/common/Formats'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import { EMPLOYEE_SORTS, employeeListQuery, type Employee } from '../api'
import { ActiveBadge } from '../components/ActiveBadge'
import { EmployeeCard } from '../components/EmployeeCard'
import { EmployeeLink } from '../components/EmployeeLink'
import { employeePaths } from '../paths'

// URL parameter of the filter: "si" only those working, "no" only those who left
const ACTIVE = 'attivi'

const column = listColumnHelper<Employee>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('last_name', {
    header: () => <FormattedMessage id="employees.name" />,
    cell: ({ row }) => <EmployeeLink employee={row.original} />,
  }),
  column.accessor('job_title', {
    header: () => <FormattedMessage id="employees.jobTitle" />,
    enableSorting: false,
  }),
  column.accessor('hired_on', {
    header: () => <FormattedMessage id="employees.hiredOn" />,
    cell: (info) => {
      const value = info.getValue()
      return value && <Day value={value} />
    },
  }),
  column.accessor('hourly_cost', {
    header: () => <FormattedMessage id="employees.hourlyCost" />,
    cell: (info) => {
      const value = info.getValue()
      return value && <Money value={value} />
    },
    enableSorting: false,
  }),
  column.accessor('active', {
    header: () => <FormattedMessage id="employees.status" />,
    cell: (info) => <ActiveBadge active={info.getValue()} />,
    enableSorting: false,
  }),
])

export function EmployeeListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({ sorts: EMPLOYEE_SORTS, filters: { [ACTIVE]: ['si', 'no'] } })
  const active = list.filters[ACTIVE]
  const query = useQuery(
    employeeListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      search: list.search,
      active: active === undefined ? undefined : active === 'si',
    }),
  )
  const filtered = list.search.trim() !== '' || active !== undefined || list.page > 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="employees.title" />}
        actions={
          <PermissionGate permission="employees.create">
            <Button asChild>
              <Link to={employeePaths(company.slug).new}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="employees.new" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        filters={
          <FilterBar>
            <SearchFilter label="employees.search" value={list.search} onChange={list.setSearch} />
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'employees.status' })}
              value={active ?? ''}
              onChange={(event) => list.setFilter(ACTIVE, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'list.all' })}
              </NativeSelectOption>
              <NativeSelectOption value="si">
                {intl.formatMessage({ id: 'employees.filter.active' })}
              </NativeSelectOption>
              <NativeSelectOption value="no">
                {intl.formatMessage({ id: 'employees.filter.inactive' })}
              </NativeSelectOption>
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(employee) => employee.id}
        renderCard={(employee) => <EmployeeCard employee={employee} />}
        empty={filtered ? 'list.noResults' : 'employees.empty'}
      />
    </div>
  )
}
