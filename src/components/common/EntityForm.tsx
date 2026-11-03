import { useId, useState, type ReactNode } from 'react'
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
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { isMessageId, type MessageId } from '@/i18n/it'

/**
 * A form that saves an entity. A 422 puts the backend's messages under their fields;
 * a 403 or any other failure shows a message above the buttons. The page stays.
 */
export function EntityForm<TValues extends FieldValues, TOutput>({
  form,
  onSubmit,
  cancelTo,
  children,
}: {
  form: UseFormReturn<TValues, unknown, TOutput>
  /** Saves; a thrown ApiError is shown on the form. */
  onSubmit: (values: TOutput) => Promise<void>
  cancelTo: string
  children: ReactNode
}) {
  const intl = useIntl()
  const [problem, setProblem] = useState<string>()

  const submit = form.handleSubmit(async (values) => {
    setProblem(undefined)
    try {
      await onSubmit(values)
    } catch (error) {
      setProblem(showError(error))
    }
  })

  /** Puts the error on the fields it names; returns what to show above the buttons. */
  function showError(error: unknown) {
    if (!(error instanceof ApiError)) return intl.formatMessage({ id: 'form.failed' })
    if (error.status === 403) return intl.formatMessage({ id: 'form.forbidden' })
    if (error.status !== 422) return intl.formatMessage({ id: 'form.failed' })

    const errors = fieldErrors(error)
    // The form's fields in their order on screen, so the cursor goes to the first wrong one
    const known = Object.keys(form.getValues())
    let focused = false
    for (const name of known) {
      const message = errors[name]
      if (message === undefined) continue
      form.setError(name as Path<TValues>, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    }
    const others = Object.entries(errors)
      .filter(([name]) => !known.includes(name))
      .map(([, message]) => message)
    // Messages for fields the form does not have still need to be seen
    if (others.length > 0) return others.join(' ')
    return focused ? undefined : intl.formatMessage({ id: 'form.invalid' })
  }

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id="form.requiredNote" />
        </p>
        {children}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <FormattedMessage id={form.formState.isSubmitting ? 'form.saving' : 'form.save'} />
          </Button>
          <Button asChild variant="outline">
            <Link to={cancelTo}>
              <FormattedMessage id="form.cancel" />
            </Link>
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

/** A group of fields with a title; two columns on wide screens. */
export function FormSection({ legend, children }: { legend: MessageId; children: ReactNode }) {
  return (
    <FieldSet>
      <FieldLegend>
        <FormattedMessage id={legend} />
      </FieldLegend>
      <FieldGroup className="grid gap-4 md:grid-cols-2">{children}</FieldGroup>
    </FieldSet>
  )
}

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
      <FieldLabel htmlFor={id}>
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
  ...props
}: FieldProps<TValues> & {
  type?: 'text' | 'email' | 'tel'
  multiline?: boolean
  maxLength?: number
  autoComplete?: string
}) {
  const parts = useFieldParts(props)
  const field = parts.register(props.name)
  return (
    <Field data-invalid={parts.invalid} className={props.className}>
      {parts.label}
      {multiline ? (
        <Textarea {...parts.control} {...field} maxLength={maxLength} />
      ) : (
        <Input
          {...parts.control}
          {...field}
          type={type}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
      )}
      {parts.after}
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
    <Field data-invalid={parts.invalid} className={props.className}>
      {parts.label}
      <NativeSelect {...parts.control} {...parts.register(props.name, { deps })}>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {intl.formatMessage({ id: option.label })}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {parts.after}
    </Field>
  )
}
