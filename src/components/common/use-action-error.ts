import { useIntl } from 'react-intl'
import { ApiError, errorMessage } from '@/api/errors'

/**
 * The text for an action that failed outside a form (a status change, a delete): the
 * backend's message for 403, 409, 412 and 422 when it sent one, otherwise a generic one.
 */
export function useActionError() {
  const intl = useIntl()
  return (error: unknown) => {
    if (error instanceof ApiError) {
      const message = errorMessage(error)
      if (error.status === 403) return message ?? intl.formatMessage({ id: 'form.forbidden' })
      if ([409, 412, 422].includes(error.status) && message) return message
    }
    return intl.formatMessage({ id: 'action.failed' })
  }
}
