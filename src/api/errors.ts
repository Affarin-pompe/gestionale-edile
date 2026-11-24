import type { components } from './schema'

type ValidationError = components['schemas']['ValidationError']

/** A non-2xx answer. Thrown by unwrap, so TanStack Query sees the query as failed. */
export class ApiError extends Error {
  readonly status: number
  /** The parsed JSON body, the raw text if it was not JSON, or undefined when it was empty. */
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Returns the data of an openapi-fetch call, or throws ApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) {
    // openapi-fetch gives '' for an empty body sent without Content-Length: 0
    throw new ApiError(result.response.status, result.error === '' ? undefined : result.error)
  }
  return result.data as T
}

/**
 * The errors of a 422, one message per field, keyed by the field path the backend uses
 * ("vat_number", "address.city"): the same paths react-hook-form's setError takes.
 * Any other error gives an empty object.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422 || !isValidationError(error.body)) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.body.errors)) {
    const [first] = messages
    if (first !== undefined) result[field] = first
  }
  return result
}

// The body comes from outside: check its shape before trusting it
function isValidationError(body: unknown): body is ValidationError {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return false
  const { errors } = body
  return (
    typeof errors === 'object' &&
    errors !== null &&
    Object.values(errors).every(
      (messages) => Array.isArray(messages) && messages.every((m) => typeof m === 'string'),
    )
  )
}

/** The backend's own message of an error (Italian, meant for the user), if it sent one. */
export function errorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  const { body } = error
  if (typeof body !== 'object' || body === null || !('message' in body)) return undefined
  return typeof body.message === 'string' && body.message ? body.message : undefined
}
