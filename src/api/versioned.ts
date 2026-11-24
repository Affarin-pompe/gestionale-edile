import { unwrap } from './errors'

/** A record with the version the backend gave it (ETag), to send back in If-Match. */
export interface Versioned<T> {
  record: T
  etag: string
}

/** Like unwrap, keeping the ETag header of the answer. */
export function unwrapVersioned<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): Versioned<T> {
  const record = unwrap(result)
  // Without it a later change gets a 428: better to know now
  const etag = result.response.headers.get('ETag')
  if (!etag) throw new Error('The answer has no ETag header')
  return { record, etag }
}
