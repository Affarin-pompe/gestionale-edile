import { useId } from 'react'
import { useFormContext } from 'react-hook-form'
import { FormattedMessage, useIntl } from 'react-intl'
import { FieldDescription, FieldError, FieldLegend, FieldSet } from '@/components/ui/field'
import { isMessageId } from '@/i18n/it'
import type { ActivityFormValues } from '../schemas'

/**
 * The activities that must end before this one starts, each with its box. Their names are
 * data, which CheckboxGroupField does not take. The backend's 422 for a cycle lands here.
 */
export function DependsOnField({ options }: { options: { value: string; text: string }[] }) {
  const intl = useIntl()
  const id = useId()
  const { register, getFieldState, formState } = useFormContext<ActivityFormValues>()
  const { error } = getFieldState('depends_on', formState)
  const message =
    error?.message &&
    (isMessageId(error.message) ? intl.formatMessage({ id: error.message }) : error.message)
  const field = register('depends_on')

  return (
    <FieldSet
      data-invalid={Boolean(message)}
      aria-describedby={[`${id}-hint`, message && `${id}-error`].filter(Boolean).join(' ')}
      className="gap-1.5"
    >
      <FieldLegend variant="label">
        <FormattedMessage id="sites.schedule.dependsOn" />
      </FieldLegend>
      <FieldDescription id={`${id}-hint`}>
        <FormattedMessage id="sites.schedule.dependsOn.hint" />
      </FieldDescription>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id="sites.schedule.dependsOn.none" />
        </p>
      ) : (
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                value={option.value}
                aria-invalid={message ? true : undefined}
                {...field}
              />
              <span className="break-words">{option.text}</span>
            </label>
          ))}
        </div>
      )}
      {message && <FieldError id={`${id}-error`}>{message}</FieldError>}
    </FieldSet>
  )
}
