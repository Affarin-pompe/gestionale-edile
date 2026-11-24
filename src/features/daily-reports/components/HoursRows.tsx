import { cn } from 'cn'
import { Trash2, UsersRound } from 'lucide-react'
import { useFieldArray, useFormContext, useWatch, type FieldError } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { isMessageId, type MessageId } from '@/i18n/it'
import { fromInputDecimal } from '@/lib/decimal'
import { formatHours, sumHours } from '../hours'
import { DEFAULT_HOURS, MAX_ROWS, type ReportFormValues } from '../schemas'

/** Someone or something the hours can be written for, by name. */
export interface HoursOption {
  id: string
  text: string
  /** In the site's team: "add the team" adds them all at once. */
  inTeam?: boolean
}

const TEXTS = {
  labor: {
    key: 'employee_id',
    who: 'dailyReports.employee',
    add: 'dailyReports.labor.add',
    empty: 'dailyReports.labor.empty',
    unknown: 'dailyReports.employee.unknown',
  },
  vehicles: {
    key: 'vehicle_id',
    who: 'dailyReports.vehicle',
    add: 'dailyReports.vehicles.add',
    empty: 'dailyReports.vehicles.empty',
    unknown: 'dailyReports.vehicle.unknown',
  },
} as const satisfies Record<string, Record<string, string>>

/**
 * The hours of the employees (`labor`) or of the vehicles of a report: one row each, added
 * from a list and removed with a tap. `large` is the phone's version, with bigger fields.
 */
export function HoursRows({
  kind,
  options,
  large = false,
  disabledHint,
}: {
  kind: 'labor' | 'vehicles'
  options: readonly HoursOption[] | undefined
  large?: boolean
  /** Why rows cannot be added yet (no site chosen); without it they can. */
  disabledHint?: MessageId
}) {
  const intl = useIntl()
  const texts = TEXTS[kind]
  const { control, register, formState } = useFormContext<ReportFormValues>()
  // useFieldArray's own types cannot tell the two row shapes apart: both have hours
  const { fields, append, remove } = useFieldArray({ control, name: kind })
  const rows = useWatch({ control, name: kind }) as { hours: string; [key: string]: string }[]
  const ids = new Set(rows.map((row) => row[texts.key]))
  const names = new Map(options?.map((option) => [option.id, option.text]))
  const free = options?.filter((option) => !ids.has(option.id)) ?? []
  const team = kind === 'labor' ? free.filter((option) => option.inTeam) : []
  const full = fields.length >= MAX_ROWS
  const errors = formState.errors[kind] as
    (FieldError & Record<number, Record<string, FieldError | undefined> | undefined>) | undefined

  const text = (message: string | undefined) =>
    message && (isMessageId(message) ? intl.formatMessage({ id: message }) : message)
  const field = large ? 'h-12 text-base md:text-base' : undefined

  function add(id: string) {
    if (!id || full) return
    const row = { hours: DEFAULT_HOURS, description: '' }
    if (kind === 'labor') append({ ...row, employee_id: id })
    else append({ ...row, vehicle_id: id })
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id={texts.empty} />
        </p>
      )}
      {fields.length > 0 && (
        <ul className="flex flex-col">
          {fields.map((item, index) => {
            const id = rows[index]?.[texts.key] ?? ''
            const name = names.get(id) ?? intl.formatMessage({ id: texts.unknown })
            const rowErrors = errors?.[index]
            const hoursError = text(rowErrors?.hours?.message)
            const otherError =
              text(rowErrors?.[texts.key]?.message) ?? text(rowErrors?.description?.message)
            const hoursLabel = intl.formatMessage({ id: 'dailyReports.hoursOf' }, { name })
            return (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)_auto]"
              >
                <span className={cn('font-medium break-words', large && 'text-base')}>{name}</span>
                <span className="flex items-center gap-1.5">
                  <Input
                    {...register(`${kind}.${index}.hours`)}
                    inputMode="decimal"
                    maxLength={5}
                    aria-label={hoursLabel}
                    aria-invalid={hoursError ? true : undefined}
                    className={cn('w-20 text-right sm:w-full', field)}
                  />
                  <span className="text-sm text-muted-foreground" aria-hidden="true">
                    <FormattedMessage id="dailyReports.hoursUnit" />
                  </span>
                </span>
                <Input
                  {...register(`${kind}.${index}.description`)}
                  maxLength={500}
                  aria-label={intl.formatMessage({ id: 'dailyReports.rowNote' }, { name })}
                  placeholder={intl.formatMessage({ id: 'dailyReports.rowNote.placeholder' })}
                  className={cn('col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto', field)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size={large ? 'icon-lg' : 'icon'}
                  className="col-start-3 row-start-1 sm:col-start-auto"
                  aria-label={intl.formatMessage({ id: 'dailyReports.removeRow' }, { name })}
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                {(hoursError ?? otherError) && (
                  <p role="alert" className="col-span-full text-sm text-destructive">
                    {hoursError ?? otherError}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {errors?.message && (
        <p role="alert" className="text-sm text-destructive">
          {text(errors.message)}
        </p>
      )}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {disabledHint ? (
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id={disabledHint} />
          </p>
        ) : (
          <>
            <NativeSelect
              className={cn('w-full sm:w-72', large && '[&_select]:h-12 [&_select]:text-base')}
              aria-label={intl.formatMessage({ id: texts.add })}
              value=""
              disabled={full || free.length === 0}
              onChange={(event) => add(event.target.value)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: texts.add })}
              </NativeSelectOption>
              {free.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.text}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {team.length > 0 && !full && (
              <Button
                type="button"
                variant="outline"
                size={large ? 'lg' : 'default'}
                className={cn(large && 'h-12 text-base')}
                onClick={() => team.forEach((option) => add(option.id))}
              >
                <UsersRound aria-hidden="true" />
                <FormattedMessage id="dailyReports.labor.addTeam" />
              </Button>
            )}
          </>
        )}
        {fields.length > 0 && (
          <p className="text-sm text-muted-foreground sm:ml-auto">
            <FormattedMessage
              id="dailyReports.rowsTotal"
              values={{
                hours: formatHours(sumHours(rows.map((row) => fromInputDecimal(row.hours ?? '')))),
              }}
            />
          </p>
        )}
      </div>
    </div>
  )
}
