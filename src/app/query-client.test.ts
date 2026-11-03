import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { createQueryClient } from './query-client'

/** How many times a query that always fails with this error is tried. */
async function attempts(error: Error) {
  const queryClient = createQueryClient()
  const queryFn = vi.fn(() => Promise.reject(error))
  // The real retry rule, without the wait between attempts
  await expect(queryClient.fetchQuery({ queryKey: ['test'], queryFn, retryDelay: 0 })).rejects.toBe(
    error,
  )
  queryClient.clear()
  return queryFn.mock.calls.length
}

function retryOption() {
  const retry = createQueryClient().getDefaultOptions().queries?.retry
  if (typeof retry !== 'function') throw new Error('Expected a retry function')
  return retry
}

describe('createQueryClient', () => {
  it.each([400, 401, 403, 404, 409, 422, 429])('does not retry an ApiError %i', async (status) => {
    expect(await attempts(new ApiError(status, undefined))).toBe(1)
  })

  it.each([500, 502, 503])('tries an ApiError %i 3 times in all', async (status) => {
    expect(await attempts(new ApiError(status, undefined))).toBe(3)
  })

  it('tries a network error 3 times in all', async () => {
    expect(await attempts(new TypeError('Failed to fetch'))).toBe(3)
  })

  it('the retry rule: no 4xx, and at most 2 retries for the others', () => {
    const retry = retryOption()
    expect(retry(0, new ApiError(404, undefined))).toBe(false)
    expect(retry(0, new ApiError(499, undefined))).toBe(false)
    expect(retry(0, new ApiError(500, undefined))).toBe(true)
    expect(retry(1, new ApiError(500, undefined))).toBe(true)
    expect(retry(2, new ApiError(500, undefined))).toBe(false)
    expect(retry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(retry(1, new TypeError('Failed to fetch'))).toBe(true)
    expect(retry(2, new TypeError('Failed to fetch'))).toBe(false)
  })
})
