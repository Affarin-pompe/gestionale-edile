import { createApiClient } from '@/api/client'
import { MOCK_PASSWORD } from '@/mocks/data'

/**
 * A client that talks to the mock backend with a cookie jar, the way a browser would:
 * cookies set by a response go out with the next requests, and Max-Age=0 removes them.
 * In Node, MSW keeps no cookies of its own, so each test client starts signed out.
 */
export function createTestApi(options: { onUnauthorized?: () => void } = {}) {
  const jar = new Map<string, string>()

  async function fetchWithCookies(request: Request) {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    if (cookie) request.headers.set('Cookie', cookie)
    const response = await fetch(request)
    for (const header of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = header.split(';')
      const separator = pair.indexOf('=')
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      if (attributes.some((a) => /^\s*max-age=0\s*$/i.test(a))) jar.delete(name)
      else jar.set(name, value)
    }
    return response
  }

  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: fetchWithCookies,
    readCookie: (name) => jar.get(name),
    onUnauthorized: options.onUnauthorized,
  })

  /** Signs in as one of the users in src/mocks/data.ts. */
  async function login(email: string) {
    const { response } = await api.POST('/api/auth/login', {
      body: { email, password: MOCK_PASSWORD },
    })
    if (!response.ok) throw new Error(`Login as ${email} failed with ${response.status}`)
  }

  return { api, jar, login }
}
