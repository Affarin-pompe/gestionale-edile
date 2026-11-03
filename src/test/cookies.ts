import { afterAll, afterEach, beforeAll } from 'vitest'

export interface SentRequest {
  method: string
  path: string
  /** The answer's status, or undefined for a network error. */
  status: number | undefined
}

/** Every request the app sent in the current test, in order. Emptied after each test. */
export const sentRequests: SentRequest[] = []

/** How many requests went out with this method and path in the current test. */
export function countRequests(method: string, path: string) {
  return sentRequests.filter((r) => r.method === method && r.path === path).length
}

/** Removes one cookie from document.cookie, as the browser does when it expires. */
export function deleteCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0`
}

function deleteAllCookies() {
  for (const pair of document.cookie.split('; ')) {
    const name = pair.slice(0, pair.indexOf('='))
    if (name) deleteCookie(name)
  }
}

/**
 * Makes fetch keep cookies in jsdom the way a browser does. In Node, MSW neither reads
 * document.cookie nor writes the Set-Cookie of its answers there: here document.cookie goes out as
 * the Cookie header, and each Set-Cookie of the answer is written to document.cookie (jsdom
 * honours Max-Age=0). Also records the requests in sentRequests.
 *
 * Call once at the top of a test file that runs in jsdom: it wraps the fetch MSW has patched in
 * the setup file, and clears cookies and the request log after each test.
 */
export function installBrowserCookies() {
  let mswFetch: typeof fetch | undefined

  beforeAll(() => {
    const inner = globalThis.fetch
    mswFetch = inner
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request && !init ? input : new Request(input, init)
      if (document.cookie) request.headers.set('Cookie', document.cookie)
      const sent = { method: request.method, path: new URL(request.url).pathname }
      let response: Response
      try {
        response = await inner(request)
      } catch (error) {
        sentRequests.push({ ...sent, status: undefined })
        throw error
      }
      for (const cookie of response.headers.getSetCookie()) document.cookie = cookie
      sentRequests.push({ ...sent, status: response.status })
      return response
    }
  })

  afterEach(() => {
    deleteAllCookies()
    sentRequests.length = 0
  })

  afterAll(() => {
    if (mswFetch) globalThis.fetch = mswFetch
  })
}
