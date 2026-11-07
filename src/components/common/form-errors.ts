import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { ApiError, errorMessage, fieldErrors } from '@/api/errors'

/**
 * How a form shows a failed save: a 422 puts the backend's messages under their fields;
 * the returned text goes above the buttons (403, 409 and 412 with the backend's message,
 * anything else as a generic failure).
 */
export function useShowFormError<TValues extends FieldValues, TOutput>(
  form: UseFormReturn<TValues, unknown, TOutput>,
) {
  const intl = useIntl()
  /** Puts the error on the fields it names; returns what to show above the buttons. */
  return function showError(error: unknown) {
    if (!(error instanceof ApiError)) return intl.formatMessage({ id: 'form.failed' })
    if (error.status === 403) return intl.formatMessage({ id: 'form.forbidden' })
    // Someone else changed the record, or its state no longer allows the change
    if (error.status === 409 || error.status === 412) {
      return errorMessage(error) ?? intl.formatMessage({ id: 'form.failed' })
    }
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
}
