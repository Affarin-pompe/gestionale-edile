import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, EllipsisVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { createContext, use, useState, type ReactNode } from 'react'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatDecimal, formatEuro } from '@/lib/decimal'
import {
  LINE_KINDS,
  quoteLinesQuery,
  useDeleteQuoteLine,
  useSwapQuoteLines,
  type QuoteLine,
  type QuoteLineKind,
  type VatRate,
} from '../api'
import { QuoteLineSheet } from './QuoteLineSheet'

const features = tableFeatures({})
const column = createColumnHelper<typeof features, QuoteLine>()
const NO_LINES: QuoteLine[] = []

const right = 'text-right whitespace-nowrap tabular-nums'

/** What the line cells need from the page: whether lines can change, and how. */
interface LineActions {
  editable: boolean
  lines: QuoteLine[]
  edit: (line: QuoteLine) => void
  move: (line: QuoteLine, by: -1 | 1) => void
  remove: (line: QuoteLine) => void
}
const LineActionsContext = createContext<LineActions | null>(null)

// Sections and text lines have only the description: it spans the row
const columns = column.columns([
  column.accessor('description', {
    header: () => <FormattedMessage id="quotes.line.description" />,
    cell: ({ row }) => <Description line={row.original} />,
  }),
  column.accessor('unit', {
    header: () => <FormattedMessage id="quotes.line.unit" />,
  }),
  column.accessor('quantity', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.line.quantity" />
      </span>
    ),
    cell: (info) => <span className={`block ${right}`}>{decimalOrNothing(info.getValue())}</span>,
  }),
  column.accessor('unit_price', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.line.unitPrice" />
      </span>
    ),
    cell: (info) => {
      const value = info.getValue()
      return <span className={`block ${right}`}>{value && formatEuro(value)}</span>
    },
  }),
  column.accessor('discount_percent', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.line.discount" />
      </span>
    ),
    cell: (info) => <span className={`block ${right}`}>{percent(info.getValue())}</span>,
  }),
  column.accessor('vat_rate', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.line.vat" />
      </span>
    ),
    cell: (info) => <span className={`block ${right}`}>{vat(info.getValue())}</span>,
  }),
  column.accessor('amount', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.line.amount" />
      </span>
    ),
    cell: (info) => {
      const value = info.getValue()
      return <span className={`block font-medium ${right}`}>{value && formatEuro(value)}</span>
    },
  }),
  column.display({
    id: 'actions',
    header: () => (
      <span className="sr-only">
        <FormattedMessage id="quotes.line.actions" />
      </span>
    ),
    cell: ({ row }) => <LineMenu line={row.original} />,
  }),
])

function decimalOrNothing(value: string | null) {
  return value === null ? null : formatDecimal(value)
}

/** "5.00" → "5 %"; no discount shows nothing. */
function percent(value: string | null) {
  if (value === null || /^0+(\.0+)?$/.test(value)) return null
  return `${formatDecimal(value.replace(/\.?0+$/, ''))}\u00a0%`
}

function vat(rate: VatRate | null) {
  return rate === null ? null : `${rate}\u00a0%`
}

function Description({ line }: { line: QuoteLine }) {
  if (line.kind === 'section') {
    return <p className="font-semibold break-words whitespace-pre-line">{line.description}</p>
  }
  return (
    <p
      className={`break-words whitespace-pre-line ${line.kind === 'text' ? 'text-muted-foreground' : ''}`}
    >
      {line.description}
    </p>
  )
}

/** The lines of a quote; in a draft, with the actions to add, change, move and delete them. */
export function QuoteLines({ quoteId, editable }: { quoteId: string; editable: boolean }) {
  const intl = useIntl()
  const company = useCompany()
  const isMobile = useIsMobile()
  const query = useQuery(quoteLinesQuery(company.slug, quoteId))
  const lines = query.data ?? NO_LINES
  const swap = useSwapQuoteLines(company.slug, quoteId)
  const remove = useDeleteQuoteLine(company.slug, quoteId)
  const describeError = useActionError()

  // The line in the side panel: a new one of a kind, or one to change
  const [editing, setEditing] = useState<{ kind: QuoteLineKind; line?: QuoteLine }>()
  const [deleting, setDeleting] = useState<QuoteLine>()

  const table = useTable({
    features,
    columns,
    data: lines,
    getRowId: (line) => line.id,
  })

  const actions: LineActions = {
    editable,
    lines,
    edit: (line) => setEditing({ kind: line.kind, line }),
    move: (line, by) => {
      const index = lines.indexOf(line)
      const other = lines[index + by]
      if (!other) return
      const [first, second] = by < 0 ? [other, line] : [line, other]
      swap.mutate({ first, second }, { onError: (error) => toast.error(describeError(error)) })
    },
    remove: setDeleting,
  }
  // The VAT of a new line: the one of the last line with a price
  const lastVat = [...lines].reverse().find((line) => line.vat_rate !== null)?.vat_rate ?? undefined

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
        <p className="text-muted-foreground">
          <FormattedMessage id="quotes.lines.loadFailed" />
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <FormattedMessage id="list.retry" />
        </Button>
      </div>
    )
  } else if (lines.length === 0) {
    body = (
      <p className="p-5 text-muted-foreground">
        <FormattedMessage id={editable ? 'quotes.lines.emptyDraft' : 'quotes.lines.empty'} />
      </p>
    )
  } else if (isMobile) {
    body = (
      <ul className="divide-y">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <Description line={line} />
              {line.kind === 'item' && (
                <p className="text-sm text-muted-foreground">
                  {[
                    `${decimalOrNothing(line.quantity)} ${line.unit ?? ''} × ${formatEuro(line.unit_price ?? '0')}`,
                    percent(line.discount_percent) &&
                      intl.formatMessage(
                        { id: 'quotes.line.discountShort' },
                        { value: percent(line.discount_percent) },
                      ),
                    vat(line.vat_rate) &&
                      intl.formatMessage(
                        { id: 'quotes.line.vatShort' },
                        { value: vat(line.vat_rate) },
                      ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            {line.amount && (
              <span className={`font-medium ${right}`}>{formatEuro(line.amount)}</span>
            )}
            <LineMenu line={line} />
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <Table className={swap.isPending ? 'opacity-60' : undefined}>
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
          {table.getRowModel().rows.map((row) => {
            const cells = row
              .getAllCells()
              .filter((cell) => editable || cell.column.id !== 'actions')
            const [first, ...rest] = cells
            // A section or a text line: the description takes the place of the numbers
            if (row.original.kind !== 'item' && first) {
              const menu = rest.find((cell) => cell.column.id === 'actions')
              return (
                <TableRow key={row.id}>
                  <TableCell colSpan={cells.length - (menu ? 1 : 0)} className="whitespace-normal">
                    <table.FlexRender cell={first} />
                  </TableCell>
                  {menu && (
                    <TableCell className="w-10">
                      <table.FlexRender cell={menu} />
                    </TableCell>
                  )}
                </TableRow>
              )
            }
            return (
              <TableRow key={row.id}>
                {cells.map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === 'description' ? 'min-w-64 whitespace-normal' : undefined
                    }
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <LineActionsContext value={actions}>
      <Card asChild>
        <section aria-busy={query.isFetching || swap.isPending}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="font-heading text-base leading-none font-semibold">
              <FormattedMessage id="quotes.lines.title" />
            </h2>
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Plus aria-hidden="true" />
                    <FormattedMessage id="quotes.lines.add" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {LINE_KINDS.map((kind) => (
                    <DropdownMenuItem key={kind} onSelect={() => setEditing({ kind })}>
                      <FormattedMessage id={`quotes.line.kind.${kind}`} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          {body}
        </section>
      </Card>
      {editing && (
        <QuoteLineSheet
          key={editing.line?.id ?? editing.kind}
          quoteId={quoteId}
          kind={editing.kind}
          line={editing.line}
          vatRate={lastVat}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title="quotes.line.deleteTitle"
        text={deleting?.description}
        confirm="quotes.line.delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          await remove.mutateAsync(deleting)
          toast.success(intl.formatMessage({ id: 'quotes.line.deleted' }))
        }}
      />
    </LineActionsContext>
  )
}

/** Change, move or delete a line; only in a draft. */
function LineMenu({ line }: { line: QuoteLine }) {
  const intl = useIntl()
  const actions = use(LineActionsContext)
  if (!actions?.editable) return null
  const index = actions.lines.indexOf(line)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={intl.formatMessage(
            { id: 'quotes.line.menu' },
            { line: line.description.slice(0, 60) },
          )}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => actions.edit(line)}>
          <Pencil aria-hidden="true" />
          <FormattedMessage id="quotes.line.edit" />
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index <= 0} onSelect={() => actions.move(line, -1)}>
          <ArrowUp aria-hidden="true" />
          <FormattedMessage id="quotes.line.moveUp" />
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index >= actions.lines.length - 1}
          onSelect={() => actions.move(line, 1)}
        >
          <ArrowDown aria-hidden="true" />
          <FormattedMessage id="quotes.line.moveDown" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(line)}>
          <Trash2 aria-hidden="true" />
          <FormattedMessage id="quotes.line.delete" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
