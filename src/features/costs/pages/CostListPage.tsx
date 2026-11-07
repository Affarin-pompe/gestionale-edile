import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar } from '@/components/common/FilterBar'
import { Day } from '@/components/common/Formats'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import type { MessageId } from '@/i18n/it'
import { isDay } from '@/lib/days'
import { formatEuro } from '@/lib/money'
import {
  COST_CATEGORIES,
  COST_SORTS,
  costListQuery,
  useChoices,
  type Choice,
  type CostCategory,
  type SiteCost,
} from '../api'
import { CostCard } from '../components/CostCard'
import { CostLink, CostSiteLink } from '../components/CostLink'
import { costPaths, FILTER } from '../paths'

const right = 'block text-right tabular-nums'
const column = listColumnHelper<SiteCost>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('date', {
    header: () => <FormattedMessage id="costs.date" />,
    cell: (info) => <Day value={info.getValue()} />,
    sortDescFirst: true,
  }),
  column.accessor('description', {
    header: () => <FormattedMessage id="costs.description" />,
    cell: ({ row }) => <CostLink cost={row.original} />,
    enableSorting: false,
  }),
  column.display({
    id: 'site',
    header: () => <FormattedMessage id="costs.site" />,
    cell: ({ row }) => <CostSiteLink site={row.original.site} />,
  }),
  column.accessor('category', {
    header: () => <FormattedMessage id="costs.category" />,
    cell: (info) => <FormattedMessage id={`costs.category.${info.getValue()}`} />,
    enableSorting: false,
  }),
  column.display({
    id: 'supplier',
    header: () => <FormattedMessage id="costs.supplier" />,
    cell: ({ row }) => row.original.supplier?.name,
  }),
  column.accessor('amount', {
    header: () => (
      <span className={right}>
        <FormattedMessage id="costs.amount" />
      </span>
    ),
    cell: (info) => <span className={right}>{formatEuro(info.getValue())}</span>,
    sortDescFirst: true,
  }),
])

// Ids come from the backend: any short text is passed on, the backend checks it
const isId = (value: string) => value.length > 0 && value.length <= 100

const FILTERS = {
  [FILTER.site]: isId,
  [FILTER.category]: COST_CATEGORIES,
  [FILTER.supplier]: isId,
  [FILTER.from]: isDay,
  [FILTER.to]: isDay,
}

export function CostListPage() {
  const intl = useIntl()
  const company = useCompany()
  const paths = costPaths(company.slug)
  const list = useListParams({ sorts: COST_SORTS, filters: FILTERS })
  const { filters } = list
  const site = filters[FILTER.site]
  const supplier = filters[FILTER.supplier]
  const from = filters[FILTER.from]
  const to = filters[FILTER.to]
  // The backend refuses a range that ends before it starts: the end is left out until fixed
  const badRange = from !== undefined && to !== undefined && to < from
  const query = useQuery(
    costListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      site,
      supplier,
      category: filters[FILTER.category] as CostCategory | undefined,
      from,
      to: badRange ? undefined : to,
    }),
  )
  const choices = useChoices().data
  const filtered = Object.values(filters).some(Boolean)
  const t = (id: MessageId) => intl.formatMessage({ id })
  const total = query.data?.total_amount

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="costs.title" />}
        actions={
          <PermissionGate permission="costs.create">
            <Button asChild>
              <Link to={paths.new(site)}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="costs.new" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <div className="flex flex-col gap-1">
        {total !== undefined && (
          <p className="text-base" aria-live="polite">
            <FormattedMessage
              id={filtered ? 'costs.total.filtered' : 'costs.total'}
              values={{ total: <span className="font-semibold">{formatEuro(total)}</span> }}
            />
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id="costs.manualOnly" />
        </p>
      </div>
      <DataTable
        columns={columns}
        query={query}
        filters={
          <FilterBar>
            <ChoiceFilter
              label="costs.site"
              all="costs.filter.allSites"
              chosen="costs.filter.thisSite"
              value={site}
              options={choices?.sites}
              onChange={(value) => list.setFilter(FILTER.site, value)}
            />
            <NativeSelect
              aria-label={t('costs.category')}
              value={filters[FILTER.category] ?? ''}
              onChange={(event) => list.setFilter(FILTER.category, event.target.value || undefined)}
            >
              <NativeSelectOption value="">{t('costs.filter.allCategories')}</NativeSelectOption>
              {COST_CATEGORIES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(`costs.category.${value}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <ChoiceFilter
              label="costs.supplier"
              all="costs.filter.allSuppliers"
              chosen="costs.filter.thisSupplier"
              value={supplier}
              options={choices?.suppliers}
              onChange={(value) => list.setFilter(FILTER.supplier, value)}
            />
            <span className="flex w-full items-center gap-2 text-2sm text-muted-foreground sm:w-auto">
              <Input
                type="date"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                aria-label={t('costs.filter.from')}
                title={t('costs.filter.from')}
                value={from ?? ''}
                max={to}
                onChange={(event) => list.setFilter(FILTER.from, event.target.value || undefined)}
              />
              –
              <Input
                type="date"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                aria-label={t('costs.filter.to')}
                title={t('costs.filter.to')}
                value={to ?? ''}
                min={from}
                aria-invalid={badRange || undefined}
                onChange={(event) => list.setFilter(FILTER.to, event.target.value || undefined)}
              />
            </span>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(cost) => cost.id}
        renderCard={(cost) => <CostCard cost={cost} />}
        empty={filtered || list.page > 1 ? 'list.noResults' : 'costs.empty'}
      />
    </div>
  )
}

/** A filter on a site or a supplier; one from a shared URL that is not listed still shows. */
function ChoiceFilter({
  label,
  all,
  chosen,
  value,
  options,
  onChange,
}: {
  label: MessageId
  all: MessageId
  chosen: MessageId
  value: string | undefined
  options: Choice[] | undefined
  onChange: (value: string | undefined) => void
}) {
  const intl = useIntl()
  const known = options?.some((option) => option.id === value)
  return (
    <NativeSelect
      className="w-full sm:w-auto sm:max-w-64"
      aria-label={intl.formatMessage({ id: label })}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <NativeSelectOption value="">{intl.formatMessage({ id: all })}</NativeSelectOption>
      {value && !known && (
        <NativeSelectOption value={value}>{intl.formatMessage({ id: chosen })}</NativeSelectOption>
      )}
      {options?.map((option) => (
        <NativeSelectOption key={option.id} value={option.id}>
          {option.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
