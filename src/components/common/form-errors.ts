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

    const { focused, others } = applyFieldErrors(form, fieldErrors(error))
    // Messages for fields the form does not have still need to be seen
    if (others.length > 0) return others.join(' ')
    return focused ? undefined : intl.formatMessage({ id: 'form.invalid' })
  }
}

/**
 * Puts the messages of a 422 under the form's fields, in their order on screen, so the cursor
 * goes to the first wrong one. A path inside a field (labor.0.hours, for a list of rows) goes
 * to that row's input. Returns the messages for fields the form does not have.
 */
export function applyFieldErrors<TValues extends FieldValues, TOutput>(
  form: UseFormReturn<TValues, unknown, TOutput>,
  errors: Record<string, string>,
) {
  const known = Object.keys(form.getValues())
  const belongs = (path: string, name: string) => path === name || path.startsWith(`${name}.`)
  let focused = false
  for (const name of known) {
    for (const [path, message] of Object.entries(errors)) {
      if (!belongs(path, name)) continue
      form.setError(path as Path<TValues>, { type: 'server', message }, { shouldFocus: !focused })
      focused = true
    }
  }
  const others = Object.entries(errors)
    .filter(([path]) => !known.some((name) => belongs(path, name)))
    .map(([, message]) => message)
  return { focused, others }
}
