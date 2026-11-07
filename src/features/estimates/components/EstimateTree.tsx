import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useActionError } from '@/components/common/use-action-error'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useIsMobile } from '@/hooks/use-mobile'
import type { MessageId } from '@/i18n/it'
import { formatDecimal, formatEuro } from '@/lib/decimal'
import {
  MAX_CHAPTER_DEPTH,
  structureQuery,
  useArrangeTree,
  useChangeTree,
  type EstimateMeasurement,
  type EstimateStructure,
} from '../api'
import { buildTree, expandedRows, moved, siblings, subRows, type TreeRow } from '../tree'
import { TreeSheet, type TreeEdit } from './TreeSheets'

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
})
type TreeTableRow = Row<typeof features, TreeRow>
const column = createColumnHelper<typeof features, TreeRow>()

const NUMBER = 'text-right whitespace-nowrap tabular-nums'
const NO_ROWS: TreeRow[] = []

/** What the row menus need from the tree. */
interface TreeActions {
  editable: boolean
  structure: EstimateStructure
  open: (edit: TreeEdit) => void
  move: (row: TreeRow, by: -1 | 1) => void
  remove: (row: TreeRow) => void
}
const TreeActionsContext = createContext<TreeActions | null>(null)

function numberHeader(id: MessageId) {
  return function NumberHeader() {
    return (
      <span className="block text-right">
        <FormattedMessage id={id} />
      </span>
    )
  }
}

function factor(value: string | null) {
  return value === null ? null : formatDecimal(value)
}

const descriptionColumn = column.display({
  id: 'description',
  header: () => <FormattedMessage id="estimates.tree.description" />,
  cell: ({ row }) => <DescriptionCell row={row} />,
})
const actionsColumn = column.display({
  id: 'actions',
  header: () => (
    <span className="sr-only">
      <FormattedMessage id="estimates.tree.actions" />
    </span>
  ),
  cell: ({ row }) => <RowMenu row={row.original} />,
})

/** On a computer: every factor of the measurements in its own column. */
const desktopColumns = column.columns([
  descriptionColumn,
  column.display({
    id: 'unit',
    header: () => <FormattedMessage id="estimates.unit" />,
    cell: ({ row }) => (row.original.type === 'item' ? row.original.item.unit : null),
  }),
  ...(
    [
      ['equal_parts', 'estimates.equalParts.short'],
      ['length', 'estimates.length.short'],
      ['width', 'estimates.width.short'],
      ['height', 'estimates.height.short'],
    ] as const
  ).map(([key, label]) =>
    column.display({
      id: key,
      header: numberHeader(label),
      cell: ({ row }) =>
        row.original.type === 'measurement' ? (
          <span className={`block ${NUMBER}`}>{factor(row.original.measurement[key])}</span>
        ) : null,
    }),
  ),
  column.display({
    id: 'quantity',
    header: numberHeader('estimates.quantity'),
    cell: ({ row }) => {
      const value = row.original
      if (value.type === 'chapter') return null
      const quantity = value.type === 'item' ? value.item.quantity : value.measurement.quantity
      return (
        <span className={`block ${NUMBER} ${value.type === 'item' ? 'font-medium' : ''}`}>
          {formatDecimal(quantity)}
        </span>
      )
    },
  }),
  column.display({
    id: 'unit_price',
    header: numberHeader('estimates.unitPrice'),
    cell: ({ row }) =>
      row.original.type === 'item' ? (
        <span className={`block ${NUMBER}`}>{formatEuro(row.original.item.unit_price)}</span>
      ) : null,
  }),
  column.display({
    id: 'amount',
    header: numberHeader('estimates.amount'),
    cell: ({ row }) => <AmountCell row={row.original} />,
  }),
  actionsColumn,
])

/** On a phone: the numbers go under the description, the amount stays on the right. */
const mobileColumns = column.columns([
  descriptionColumn,
  column.display({
    id: 'amount',
    header: numberHeader('estimates.amount'),
    cell: ({ row }) => <AmountCell row={row.original} />,
  }),
  actionsColumn,
])

function AmountCell({ row }: { row: TreeRow }) {
  if (row.type === 'measurement') return null
  const amount = row.type === 'chapter' ? row.chapter.amount : row.item.amount
  return (
    <span className={`block ${NUMBER} ${row.type === 'chapter' ? 'font-semibold' : 'font-medium'}`}>
      {formatEuro(amount)}
    </span>
  )
}

/** "2 × 3,200 × 2,500" for a measurement line, with the factors it has. */
function factors(line: EstimateMeasurement) {
  return [line.equal_parts, line.length, line.width, line.height]
    .filter((value) => value !== null)
    .map((value) => formatDecimal(value))
    .join(' × ')
}

function DescriptionCell({ row }: { row: TreeTableRow }) {
  const intl = useIntl()
  const isMobile = useIsMobile()
  const value = row.original
  const expander = row.getCanExpand() ? (
    <Button
      variant="ghost"
      size="icon-xs"
      className="mt-px"
      aria-expanded={row.getIsExpanded()}
      aria-label={intl.formatMessage({
        id: row.getIsExpanded() ? 'estimates.tree.collapse' : 'estimates.tree.expand',
      })}
      onClick={row.getToggleExpandedHandler()}
    >
      {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
    </Button>
  ) : (
    <span className="inline-block size-6 shrink-0" aria-hidden="true" />
  )

  let text: ReactNode
  let details: ReactNode = null
  if (value.type === 'chapter') {
    text = (
      <span className="font-semibold">
        {value.chapter.code && `${value.chapter.code} · `}
        {value.chapter.title}
      </span>
    )
  } else if (value.type === 'item') {
    text = (
      <>
        {value.item.code && <span className="font-medium">{`${value.item.code} · `}</span>}
        <span className="whitespace-pre-line">{value.item.description}</span>
      </>
    )
    if (isMobile) {
      details = `${formatDecimal(value.item.quantity)} ${value.item.unit} × ${formatEuro(value.item.unit_price)}`
    }
  } else {
    text = value.measurement.description ?? (
      <span className="text-muted-foreground">
        <FormattedMessage id="estimates.measurement.noDescription" />
      </span>
    )
    if (isMobile) {
      details = `${factors(value.measurement)} = ${formatDecimal(value.measurement.quantity)}`
    }
  }

  return (
    // Each level moves in by one step; measurements are under their item
    <div className="flex items-start gap-1.5" style={{ paddingLeft: `${row.depth * 1}rem` }}>
      {expander}
      <div className="min-w-0 pt-0.5">
        <p className="break-words">{text}</p>
        {details && <p className="text-sm text-muted-foreground tabular-nums">{details}</p>}
      </div>
    </div>
  )
}

/** The estimate's chapters, items and measurements as a tree that opens and closes. */
export function EstimateTree({ estimateId, editable }: { estimateId: string; editable: boolean }) {
  const intl = useIntl()
  const company = useCompany()
  const isMobile = useIsMobile()
  const query = useQuery(structureQuery(company.slug, estimateId))
  const structure = query.data?.data
  const change = useChangeTree(company.slug, estimateId)
  const arrange = useArrangeTree(company.slug, estimateId)
  const describeError = useActionError()

  const [edit, setEdit] = useState<TreeEdit>()
  const [deleting, setDeleting] = useState<TreeRow>()
  // Rows the user opened or closed; the others start open, measurements in view
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const rows = useMemo(() => (structure ? buildTree(structure) : NO_ROWS), [structure])
  const expanded: ExpandedState = { ...expandedRows(rows), ...toggled }

  const table = useTable({
    features,
    columns: isMobile ? mobileColumns : desktopColumns,
    data: rows,
    getRowId: (row) => row.id,
    getSubRows: subRows,
    // Measurement lines have no children, items without measurements cannot open
    getRowCanExpand: (row) => (subRows(row.original)?.length ?? 0) > 0,
    state: { expanded },
    onExpandedChange: (updater) => {
      const next = typeof updater === 'function' ? updater(expanded) : updater
      if (next === true) return
      setToggled(next)
    },
    autoResetExpanded: false,
  })

  const actions: TreeActions | null = structure
    ? {
        editable,
        structure,
        open: setEdit,
        move: (row, by) => {
          const arrangement = moved(structure, row, by)
          if (!arrangement || !query.data) return
          arrange.mutate(
            { etag: query.data.etag, arrangement },
            { onError: (error) => toast.error(describeError(error)) },
          )
        },
        remove: setDeleting,
      }
    : null

  const visibleColumns = (isMobile ? mobileColumns : desktopColumns).length - (editable ? 0 : 1)

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  } else if (!structure) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
        <p className="text-muted-foreground">
          <FormattedMessage id="estimates.tree.loadFailed" />
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <FormattedMessage id="list.retry" />
        </Button>
      </div>
    )
  } else if (rows.length === 0) {
    body = (
      <p className="p-5 text-muted-foreground">
        <FormattedMessage id={editable ? 'estimates.tree.emptyEditable' : 'estimates.tree.empty'} />
      </p>
    )
  } else {
    body = (
      <Table className={arrange.isPending || change.isPending ? 'opacity-60' : undefined}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) =>
                header.column.id === 'actions' && !editable ? null : (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ),
              )}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={row.original.type === 'chapter' ? 'bg-muted/50 hover:bg-muted' : undefined}
            >
              {row.getAllCells().map((cell) =>
                cell.column.id === 'actions' && !editable ? null : (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === 'description'
                        ? `whitespace-normal ${isMobile ? '' : 'min-w-72'}`
                        : cell.column.id === 'actions'
                          ? 'w-10'
                          : undefined
                    }
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ),
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={visibleColumns - (editable ? 2 : 1)} className="font-semibold">
              <FormattedMessage id="estimates.total" />
            </TableCell>
            <TableCell className={`${NUMBER} text-base font-semibold`}>
              {formatEuro(structure.total)}
            </TableCell>
            {editable && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
    )
  }

  return (
    <TreeActionsContext value={actions}>
      <Card asChild>
        <section aria-busy={query.isFetching || change.isPending || arrange.isPending}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="font-heading text-base leading-none font-semibold">
              <FormattedMessage id="estimates.tree.title" />
            </h2>
            <div className="flex flex-wrap gap-2">
              {rows.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    // Everything closed, or everything open again
                    const open = table.getIsSomeRowsExpanded()
                    const all = expandedRows(rows)
                    setToggled(
                      open ? Object.fromEntries(Object.keys(all).map((id) => [id, false])) : {},
                    )
                  }}
                >
                  <FormattedMessage
                    id={
                      table.getIsSomeRowsExpanded()
                        ? 'estimates.tree.collapseAll'
                        : 'estimates.tree.expandAll'
                    }
                  />
                </Button>
              )}
              {editable && structure && (
                <Button
                  variant="outline"
                  onClick={() => setEdit({ kind: 'chapter', parentId: null })}
                >
                  <Plus aria-hidden="true" />
                  <FormattedMessage id="estimates.chapter.new" />
                </Button>
              )}
            </div>
          </CardHeader>
          {body}
        </section>
      </Card>
      {edit && (
        <TreeSheet
          // A fresh form for each record
          key={JSON.stringify([edit.kind, editKey(edit)])}
          estimateId={estimateId}
          edit={edit}
          onClose={() => setEdit(undefined)}
        />
      )}
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title={deleting ? DELETE_TITLE[deleting.type] : 'estimates.chapter.deleteTitle'}
        text={deleting && <DeleteText row={deleting} />}
        confirm="estimates.tree.delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          if (deleting.type === 'chapter') {
            await change.mutateAsync({ kind: 'chapter', remove: deleting.chapter })
          } else if (deleting.type === 'item') {
            await change.mutateAsync({ kind: 'item', remove: deleting.item })
          } else {
            await change.mutateAsync({ kind: 'measurement', remove: deleting.measurement })
          }
          toast.success(intl.formatMessage({ id: 'estimates.tree.deleted' }))
        }}
      />
    </TreeActionsContext>
  )
}

const DELETE_TITLE = {
  chapter: 'estimates.chapter.deleteTitle',
  item: 'estimates.item.deleteTitle',
  measurement: 'estimates.measurement.deleteTitle',
} as const satisfies Record<TreeRow['type'], MessageId>

function editKey(edit: TreeEdit) {
  switch (edit.kind) {
    case 'chapter':
      return edit.chapter?.id ?? `new:${edit.parentId}`
    case 'item':
      return edit.item?.id ?? `new:${edit.chapterId}`
    case 'measurement':
      return edit.measurement?.id ?? `new:${edit.itemId}`
  }
}

function DeleteText({ row }: { row: TreeRow }) {
  if (row.type === 'chapter') {
    return (
      <FormattedMessage id="estimates.chapter.deleteText" values={{ name: row.chapter.title }} />
    )
  }
  if (row.type === 'item') {
    return (
      <FormattedMessage
        id="estimates.item.deleteText"
        values={{ name: row.item.description.slice(0, 120) }}
      />
    )
  }
  return (
    <FormattedMessage
      id="estimates.measurement.deleteText"
      values={{ name: row.measurement.description ?? factors(row.measurement) }}
    />
  )
}

function rowName(row: TreeRow) {
  if (row.type === 'chapter') return row.chapter.title
  if (row.type === 'item') return row.item.description.slice(0, 60)
  return row.measurement.description ?? factors(row.measurement)
}

/** Add under, change, move or delete a row. */
function RowMenu({ row }: { row: TreeRow }) {
  const intl = useIntl()
  const actions = use(TreeActionsContext)
  if (!actions?.editable) return null
  const { structure, open, move, remove } = actions
  const order = siblings(structure, row)
  const id = row.type === 'chapter' ? row.chapter.id : row.type === 'item' ? row.item.id : ''
  const index = order.indexOf(id)
  const canMove = row.type !== 'measurement'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={intl.formatMessage({ id: 'estimates.tree.menu' }, { name: rowName(row) })}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.type === 'chapter' && (
          <>
            <DropdownMenuItem
              onSelect={() =>
                open({ kind: 'item', chapterId: row.chapter.id, parentName: row.chapter.title })
              }
            >
              <Plus aria-hidden="true" />
              <FormattedMessage id="estimates.item.new" />
            </DropdownMenuItem>
            {row.level < MAX_CHAPTER_DEPTH && (
              <DropdownMenuItem
                onSelect={() =>
                  open({ kind: 'chapter', parentId: row.chapter.id, parentName: row.chapter.title })
                }
              >
                <Plus aria-hidden="true" />
                <FormattedMessage id="estimates.chapter.newSub" />
              </DropdownMenuItem>
            )}
          </>
        )}
        {row.type === 'item' && (
          <DropdownMenuItem
            onSelect={() =>
              open({ kind: 'measurement', itemId: row.item.id, parentName: rowName(row) })
            }
          >
            <Plus aria-hidden="true" />
            <FormattedMessage id="estimates.measurement.new" />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            if (row.type === 'chapter') {
              open({ kind: 'chapter', parentId: row.chapter.parent_id, chapter: row.chapter })
            } else if (row.type === 'item') {
              open({
                kind: 'item',
                chapterId: row.item.chapter_id,
                item: row.item,
                parentName: rowName(row),
              })
            } else {
              open({
                kind: 'measurement',
                itemId: row.measurement.item_id,
                measurement: row.measurement,
                parentName: rowName(row),
              })
            }
          }}
        >
          <Pencil aria-hidden="true" />
          <FormattedMessage id="estimates.tree.edit" />
        </DropdownMenuItem>
        {canMove && (
          <>
            <DropdownMenuItem disabled={index <= 0} onSelect={() => move(row, -1)}>
              <ArrowUp aria-hidden="true" />
              <FormattedMessage id="estimates.tree.moveUp" />
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index < 0 || index >= order.length - 1}
              onSelect={() => move(row, 1)}
            >
              <ArrowDown aria-hidden="true" />
              <FormattedMessage id="estimates.tree.moveDown" />
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => remove(row)}>
          <Trash2 aria-hidden="true" />
          <FormattedMessage id="estimates.tree.delete" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
