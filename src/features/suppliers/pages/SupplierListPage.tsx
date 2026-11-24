import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import type { MessageId } from '@/i18n/it'
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_SORTS,
  supplierListQuery,
  type Supplier,
  type SupplierCategory,
} from '../api'
import { SupplierBadges } from '../components/SupplierBadges'
import { SupplierCard } from '../components/SupplierCard'
import { SupplierLink } from '../components/SupplierLink'
import { supplierPaths } from '../paths'

// URL parameters of the filters, in Italian like the paths
const CATEGORY = 'categoria'
const SUBCONTRACTOR = 'subappaltatore'
const ARCHIVED = 'archiviati'
const YES_NO = ['si', 'no'] as const

const column = listColumnHelper<Supplier>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('name', {
    header: () => <FormattedMessage id="suppliers.name" />,
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-2.5">
        <SupplierLink supplier={row.original} />
        <SupplierBadges
          subcontractor={row.original.subcontractor}
          archived={row.original.archived_at !== null}
        />
      </span>
    ),
  }),
  column.accessor('categories', {
    header: () => <FormattedMessage id="suppliers.categories" />,
    cell: (info) => <Categories categories={info.getValue()} />,
    enableSorting: false,
  }),
  column.display({
    id: 'taxId',
    header: () => <FormattedMessage id="suppliers.taxId" />,
    cell: ({ row }) => row.original.vat_number ?? row.original.tax_code,
  }),
  column.accessor('city', {
    header: () => <FormattedMessage id="suppliers.city" />,
    enableSorting: false,
  }),
  column.accessor('phone', {
    header: () => <FormattedMessage id="suppliers.phone" />,
    enableSorting: false,
  }),
])

function Categories({ categories }: { categories: SupplierCategory[] }) {
  const intl = useIntl()
  return categories
    .map((category) => intl.formatMessage({ id: `suppliers.category.${category}` }))
    .join(', ')
}

const yesNo = (value: string | undefined) =>
  value === 'si' ? true : value === 'no' ? false : undefined

export function SupplierListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({
    sorts: SUPPLIER_SORTS,
    filters: { [CATEGORY]: SUPPLIER_CATEGORIES, [SUBCONTRACTOR]: YES_NO, [ARCHIVED]: ['si'] },
  })
  const category = list.filters[CATEGORY] as SupplierCategory | undefined
  const subcontractor = list.filters[SUBCONTRACTOR]
  const archived = list.filters[ARCHIVED] === 'si'
  const query = useQuery(
    supplierListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      search: list.search,
      category,
      subcontractor: yesNo(subcontractor),
      archived,
    }),
  )
  const filtered =
    list.search.trim() !== '' ||
    category !== undefined ||
    subcontractor !== undefined ||
    archived ||
    list.page > 1

  const select = (
    label: MessageId,
    value: string | undefined,
    onChange: (value: string | undefined) => void,
    options: readonly { value: string; label: MessageId }[],
    all: MessageId = 'list.all',
  ) => (
    <NativeSelect
      aria-label={intl.formatMessage({ id: label })}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <NativeSelectOption value="">{intl.formatMessage({ id: all })}</NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {intl.formatMessage({ id: option.label })}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="suppliers.title" />}
        actions={
          <PermissionGate permission="suppliers.create">
            <Button asChild>
              <Link to={supplierPaths(company.slug).new}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="suppliers.new" />
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
            <SearchFilter label="suppliers.search" value={list.search} onChange={list.setSearch} />
            {select(
              'suppliers.categories',
              category,
              (value) => list.setFilter(CATEGORY, value),
              SUPPLIER_CATEGORIES.map((value) => ({
                value,
                label: `suppliers.category.${value}` as const,
              })),
              'suppliers.filter.allCategories',
            )}
            {select(
              'suppliers.subcontractor',
              subcontractor,
              (value) => list.setFilter(SUBCONTRACTOR, value),
              [
                { value: 'si', label: 'suppliers.filter.subcontractors' },
                { value: 'no', label: 'suppliers.filter.notSubcontractors' },
              ],
              'suppliers.filter.anySubcontractor',
            )}
            {select(
              'suppliers.filter.archive',
              archived ? 'si' : undefined,
              (value) => list.setFilter(ARCHIVED, value),
              [{ value: 'si', label: 'suppliers.filter.archived' }],
              'suppliers.filter.active',
            )}
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(supplier) => supplier.id}
        renderCard={(supplier) => <SupplierCard supplier={supplier} />}
        empty={filtered ? 'list.noResults' : 'suppliers.empty'}
      />
    </div>
  )
}
