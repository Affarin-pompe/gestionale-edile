import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { Money } from '@/components/common/Formats'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import {
  VEHICLE_KINDS,
  VEHICLE_SORTS,
  vehicleListQuery,
  type Vehicle,
  type VehicleKind,
} from '../api'
import { VehicleActiveBadge, VehicleKindBadge } from '../components/VehicleBadges'
import { VehicleCard } from '../components/VehicleCard'
import { VehicleLink } from '../components/VehicleLink'
import { vehiclePaths } from '../paths'

// URL parameters of the filters, in Italian like the paths
const KIND = 'tipo'
const ACTIVE = 'in_uso'

const column = listColumnHelper<Vehicle>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('name', {
    header: () => <FormattedMessage id="vehicles.name" />,
    cell: ({ row }) => <VehicleLink vehicle={row.original} />,
  }),
  column.accessor('kind', {
    header: () => <FormattedMessage id="vehicles.kind" />,
    cell: (info) => <VehicleKindBadge kind={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('plate', {
    header: () => <FormattedMessage id="vehicles.plate" />,
    enableSorting: false,
  }),
  column.accessor('hourly_cost', {
    header: () => <FormattedMessage id="vehicles.hourlyCost" />,
    cell: (info) => {
      const value = info.getValue()
      return value && <Money value={value} />
    },
    enableSorting: false,
  }),
  column.accessor('active', {
    header: () => <FormattedMessage id="vehicles.status" />,
    cell: (info) => <VehicleActiveBadge active={info.getValue()} />,
    enableSorting: false,
  }),
])

export function VehicleListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({
    sorts: VEHICLE_SORTS,
    filters: { [KIND]: VEHICLE_KINDS, [ACTIVE]: ['si', 'no'] },
  })
  const kind = list.filters[KIND] as VehicleKind | undefined
  const active = list.filters[ACTIVE]
  const query = useQuery(
    vehicleListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      search: list.search,
      kind,
      active: active === undefined ? undefined : active === 'si',
    }),
  )
  const filtered =
    list.search.trim() !== '' || kind !== undefined || active !== undefined || list.page > 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="vehicles.title" />}
        actions={
          <PermissionGate permission="vehicles.create">
            <Button asChild>
              <Link to={vehiclePaths(company.slug).new}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="vehicles.new" />
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
            <SearchFilter label="vehicles.search" value={list.search} onChange={list.setSearch} />
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'vehicles.kind' })}
              value={kind ?? ''}
              onChange={(event) => list.setFilter(KIND, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'list.all' })}
              </NativeSelectOption>
              {VEHICLE_KINDS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {intl.formatMessage({ id: `vehicles.kind.${value}` })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'vehicles.status' })}
              value={active ?? ''}
              onChange={(event) => list.setFilter(ACTIVE, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'vehicles.filter.any' })}
              </NativeSelectOption>
              <NativeSelectOption value="si">
                {intl.formatMessage({ id: 'vehicles.filter.active' })}
              </NativeSelectOption>
              <NativeSelectOption value="no">
                {intl.formatMessage({ id: 'vehicles.filter.inactive' })}
              </NativeSelectOption>
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(vehicle) => vehicle.id}
        renderCard={(vehicle) => <VehicleCard vehicle={vehicle} />}
        empty={filtered ? 'list.noResults' : 'vehicles.empty'}
      />
    </div>
  )
}
