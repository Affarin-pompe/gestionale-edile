import { ApiError, unwrap } from './errors'

/** A record with the version the backend gave it (ETag), to send back in If-Match. */
export interface Versioned<T> {
  data: T
  etag: string
}

/** Like unwrap, keeping the ETag header of the answer. */
export function unwrapVersioned<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): Versioned<T> {
  const data = unwrap(result)
  // The contract promises the header; without it the next change gets a 428 and says so
  return { data, etag: result.response.headers.get('ETag') ?? '' }
}

/** Someone else changed the record after it was loaded (412, code stale_record). */
export function isStale(error: unknown) {
  return error instanceof ApiError && error.status === 412
}
