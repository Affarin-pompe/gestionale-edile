import { cn } from 'cn'
import { Fragment, useId, useState, type ReactNode } from 'react'
import {
  FormProvider,
  useFormContext,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { ApiError, fieldErrors } from '@/api/errors'
import { applyFieldErrors } from './form-errors'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { listHref } from '@/hooks/use-list-params'
import { isMessageId, type MessageId } from '@/i18n/it'

/**
 * A form that saves an entity. A 422 puts the backend's messages under their fields;
 * a 403 or any other failure shows a message above the buttons. The page stays.
 */
export function EntityForm<TValues extends FieldValues, TOutput>({
  form,
  onSubmit,
  onReload,
  cancelTo,
  children,
}: {
  form: UseFormReturn<TValues, unknown, TOutput>
  /** Saves; a thrown ApiError is shown on the form. */
  onSubmit: (values: TOutput) => Promise<void>
  /**
   * Loads the record again, after a 412 (someone else changed it in the meantime). Without it
   * the message only asks to reload the page.
   */
  onReload?: () => Promise<void>
  /** Where Cancel goes; a list reopens as the user left it. */
  cancelTo: string
  children: ReactNode
}) {
  const [problem, setProblem] = useState<string>()
  const intl = useIntl()
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)

  const submit = form.handleSubmit(async (values) => {
    setProblem(undefined)
    setStale(false)
    try {
      await onSubmit(values)
    } catch (error) {
      setProblem(showError(error))
    }
  })

  async function reload() {
    if (!onReload) return
    setReloading(true)
    try {
      await onReload()
      setProblem(undefined)
      setStale(false)
    } catch {
      setProblem(intl.formatMessage({ id: 'form.reloadFailed' }))
    } finally {
      setReloading(false)
    }
  }

  /** Puts the error on the fields it names; returns what to show above the buttons. */
  function showError(error: unknown) {
    if (!(error instanceof ApiError)) return intl.formatMessage({ id: 'form.failed' })
    if (error.status === 403) return intl.formatMessage({ id: 'form.forbidden' })
    // 412: someone else saved first. 428: the version was missing. Reloading fixes both.
    if (error.status === 412 || error.status === 428) {
      setStale(true)
      return intl.formatMessage({ id: onReload ? 'form.stale' : 'form.staleReloadPage' })
    }
    if (error.status !== 422) return intl.formatMessage({ id: 'form.failed' })

    const { focused, others } = applyFieldErrors(form, fieldErrors(error))
    // Messages for fields the form does not have still need to be seen
    if (others.length > 0) return others.join(' ')
    return focused ? undefined : intl.formatMessage({ id: 'form.invalid' })
  }

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <p className="text-2sm text-muted-foreground">
          <FormattedMessage id="form.requiredNote" />
        </p>
        {children}
        {problem && (
          <div className="flex flex-wrap items-center gap-2.5">
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
            {stale && onReload && (
              <Button
                type="button"
                variant="outline"
                disabled={reloading}
                onClick={() => void reload()}
              >
                <FormattedMessage id="form.reload" />
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button asChild variant="outline">
            <Link to={listHref(cancelTo)}>
              <FormattedMessage id="form.cancel" />
            </Link>
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <FormattedMessage id={form.formState.isSubmitting ? 'form.saving' : 'form.save'} />
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

/** A group of fields in a card, with its title in the card's header. */
export function FormSection({ legend, children }: { legend: MessageId; children: ReactNode }) {
  return (
    <Card>
      <FieldSet className="gap-0">
        <FieldLegend className="mb-0 flex min-h-14 w-full items-center border-b px-5 font-semibold">
          <FormattedMessage id={legend} />
        </FieldLegend>
        <FieldGroup className="gap-5 p-5">{children}</FieldGroup>
      </FieldSet>
    </Card>
  )
}

// As in Metronic: where the card is wide enough, the label on the left and the field on the right
const ROW = '@md/field-group:flex-row @md/field-group:items-baseline @md/field-group:gap-2.5'
const ROW_LABEL = '@md/field-group:w-48 @md/field-group:shrink-0'

interface FieldProps<TValues extends FieldValues> {
  name: Path<TValues>
  label: MessageId
  hint?: MessageId
  required?: boolean
  className?: string
}

/** Label, description and error of a field, wired for screen readers. */
function useFieldParts<TValues extends FieldValues>({
  name,
  label,
  hint,
  required,
}: FieldProps<TValues>) {
  const intl = useIntl()
  const { register, getFieldState, formState } = useFormContext<TValues>()
  const id = useId()
  const { error } = getFieldState(name, formState)
  // Messages from the schema are ids; those from the backend are already text
  const message =
    error?.message &&
    (isMessageId(error.message) ? intl.formatMessage({ id: error.message }) : error.message)
  const describedBy = [hint && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(' ')

  return {
    register,
    control: {
      id,
      'aria-invalid': message ? true : undefined,
      'aria-required': required || undefined,
      'aria-describedby': describedBy || undefined,
    },
    label: (
      <FieldLabel htmlFor={id} className={ROW_LABEL}>
        <FormattedMessage id={label} />
        {required && <span aria-hidden="true">*</span>}
      </FieldLabel>
    ),
    after: (
      <>
        {hint && (
          <FieldDescription id={`${id}-hint`}>
            <FormattedMessage id={hint} />
          </FieldDescription>
        )}
        {message && <FieldError id={`${id}-error`}>{message}</FieldError>}
      </>
    ),
    invalid: Boolean(message),
  }
}

export function TextField<TValues extends FieldValues>({
  type = 'text',
  multiline = false,
  maxLength,
  autoComplete,
  deps,
  inputMode,
  ...props
}: FieldProps<TValues> & {
  type?: 'text' | 'email' | 'tel' | 'date'
  multiline?: boolean
  maxLength?: number
  autoComplete?: string
  /** Fields whose checks depend on this one, checked again when it changes. */
  deps?: Path<TValues>[]
  /** The phone's keyboard, e.g. 'decimal' for amounts and quantities. */
  inputMode?: 'decimal' | 'numeric'
}) {
  const parts = useFieldParts(props)
  const field = parts.register(props.name, { deps })
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      {parts.label}
      <FieldContent className="min-w-0 gap-1.5">
        {multiline ? (
          <Textarea {...parts.control} {...field} maxLength={maxLength} />
        ) : (
          <Input
            {...parts.control}
            {...field}
            type={type}
            maxLength={maxLength}
            autoComplete={autoComplete}
            inputMode={inputMode}
            className={type === 'date' ? 'w-full sm:w-44' : undefined}
          />
        )}
        {parts.after}
      </FieldContent>
    </Field>
  )
}

export function SelectField<TValues extends FieldValues>({
  options,
  deps,
  ...props
}: FieldProps<TValues> & {
  options: readonly { value: string; label: MessageId }[]
  /** Fields whose checks depend on this one, checked again when it changes. */
  deps?: Path<TValues>[]
}) {
  const intl = useIntl()
  const parts = useFieldParts(props)
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      {parts.label}
      <FieldContent className="min-w-0 gap-1.5">
        <NativeSelect
          className="w-full"
          {...parts.control}
          {...parts.register(props.name, { deps })}
        >
          {options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {intl.formatMessage({ id: option.label })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {parts.after}
      </FieldContent>
    </Field>
  )
}

/** A choice among records or values whose names are data, not texts of src/i18n. */
export function ChoiceField<TValues extends FieldValues>({
  options,
  empty,
  ...props
}: FieldProps<TValues> & {
  options: readonly { value: string; text: string }[]
  /** The first option, for "none"; without it a value must be chosen. */
  empty?: MessageId
}) {
  const intl = useIntl()
  const parts = useFieldParts(props)
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      {parts.label}
      <FieldContent className="min-w-0 gap-1.5">
        <NativeSelect className="w-full" {...parts.control} {...parts.register(props.name)}>
          {empty && (
            <NativeSelectOption value="">{intl.formatMessage({ id: empty })}</NativeSelectOption>
          )}
          {options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.text}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {parts.after}
      </FieldContent>
    </Field>
  )
}

/** A select whose options come from data (e.g. the names of the suppliers), in groups. */
export function OptionsField<TValues extends FieldValues>({
  groups,
  empty,
  ...props
}: FieldProps<TValues> & {
  groups: readonly { label?: MessageId; options: readonly { value: string; text: string }[] }[]
  /** The first option, for no choice: its value is ''. */
  empty?: MessageId
}) {
  const intl = useIntl()
  const parts = useFieldParts(props)
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      {parts.label}
      <FieldContent className="min-w-0 gap-1.5">
        <NativeSelect className="w-full" {...parts.control} {...parts.register(props.name)}>
          {empty && (
            <NativeSelectOption value="">{intl.formatMessage({ id: empty })}</NativeSelectOption>
          )}
          {groups.map((group, index) => {
            const options = group.options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.text}
              </NativeSelectOption>
            ))
            return group.label ? (
              <NativeSelectOptGroup
                key={group.label}
                label={intl.formatMessage({ id: group.label })}
              >
                {options}
              </NativeSelectOptGroup>
            ) : (
              <Fragment key={index}>{options}</Fragment>
            )
          })}
        </NativeSelect>
        {parts.after}
      </FieldContent>
    </Field>
  )
}

const CHECKBOX = 'size-4 shrink-0 accent-primary'

/** A yes-or-no field, such as "Subappaltatore": the label on the left, the box on the right. */
export function CheckboxField<TValues extends FieldValues>(props: FieldProps<TValues>) {
  const parts = useFieldParts(props)
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      {parts.label}
      <FieldContent className="min-w-0 gap-1.5">
        <input
          type="checkbox"
          className={CHECKBOX}
          {...parts.control}
          {...parts.register(props.name)}
        />
        {parts.after}
      </FieldContent>
    </Field>
  )
}

/** Several choices out of a short list, each with its box; the value is the chosen ones. */
export function CheckboxGroupField<TValues extends FieldValues>({
  options,
  ...props
}: FieldProps<TValues> & { options: readonly { value: string; label: MessageId }[] }) {
  const intl = useIntl()
  const parts = useFieldParts(props)
  const field = parts.register(props.name)
  return (
    <Field data-invalid={parts.invalid} className={cn(ROW, props.className)}>
      <span className={cn('text-sm leading-snug font-medium', ROW_LABEL)} aria-hidden="true">
        <FormattedMessage id={props.label} />
      </span>
      <FieldContent className="min-w-0 gap-1.5">
        <div
          role="group"
          aria-label={intl.formatMessage({ id: props.label })}
          aria-describedby={parts.control['aria-describedby']}
          className="flex flex-col gap-2"
        >
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className={CHECKBOX}
                value={option.value}
                aria-invalid={parts.control['aria-invalid']}
                {...field}
              />
              <FormattedMessage id={option.label} />
            </label>
          ))}
        </div>
        {parts.after}
      </FieldContent>
    </Field>
  )
}
