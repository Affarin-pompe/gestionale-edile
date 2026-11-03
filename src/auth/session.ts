import type { QueryClient } from '@tanstack/react-query'
import {
  data,
  generatePath,
  redirect,
  type ActionFunctionArgs,
  type DataRouter,
  type LoaderFunctionArgs,
  type MiddlewareFunction,
} from 'react-router'
import { api } from '@/api/client'
import { ApiError, fieldErrors, unwrap } from '@/api/errors'
import { meContext, meQuery } from './me'
import type { Permission } from './permissions'

export const LOGIN_PATH = '/accedi'
// The page to go back to after signing in
const RETURN_PARAM = 'da'
const OWN_ORIGIN = 'http://app.invalid'

export function loginPath(returnTo?: string) {
  if (!returnTo || returnTo === '/') return LOGIN_PATH
  return `${LOGIN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: returnTo }).toString()}`
}

/** The page to open after signing in: a path of this app, never another site. */
export function returnPath(search: string) {
  const value = new URLSearchParams(search).get(RETURN_PARAM)
  if (!value?.startsWith('/')) return '/'
  // "//other.example" and "/\other.example" point to another site
  const url = new URL(value, OWN_ORIGIN)
  if (url.origin !== OWN_ORIGIN || url.pathname === LOGIN_PATH) return '/'
  return url.pathname + url.search + url.hash
}

/** Loads the signed-in user before any page that needs one, or sends to the sign-in page. */
export function requireAuth(queryClient: QueryClient): MiddlewareFunction {
  return async ({ request, context }) => {
    try {
      context.set(meContext, await queryClient.ensureQueryData(meQuery))
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
      const { pathname, search } = new URL(request.url)
      throw redirect(loginPath(pathname + search))
    }
  }
}

export const requireCompany: MiddlewareFunction = ({ params, context }) => {
  const isMember = context.get(meContext).companies.some((c) => c.slug === params.azienda)
  // The same answer the backend gives for another company's data
  if (!isMember) throw data(null, { status: 404 })
}

/**
 * Loader for a page that needs a permission: without it, the page does not exist for the user.
 * A loader and not a middleware: on the first page load, a middleware's error replaces the whole
 * app layout, while a loader's error shows inside it.
 */
export function requirePermission(permission: Permission) {
  return ({ params, context }: LoaderFunctionArgs) => {
    const company = context.get(meContext).companies.find((c) => c.slug === params.azienda)
    if (!company?.permissions.includes(permission)) throw data(null, { status: 404 })
    return null
  }
}

/** From the home page to the user's first company, if there is one. */
export function homeLoader({ context }: LoaderFunctionArgs) {
  const first = context.get(meContext).companies[0]
  return first ? redirect(generatePath('/:azienda', { azienda: first.slug })) : null
}

export async function loginAction({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const text = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' ? value : ''
  }
  try {
    unwrap(
      await api.POST('/api/auth/login', {
        body: { email: text('email'), password: text('password') },
      }),
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return { problem: 'login.tooManyAttempts' } as const
    }
    const fields = error instanceof ApiError ? fieldErrors(error) : {}
    // Missing CSRF cookie, network or server errors: nothing to fix in the form
    if (Object.keys(fields).length === 0) return { problem: 'login.failed' } as const
    return { fields }
  }
  return redirect(returnPath(new URL(request.url).search))
}

export async function logoutAction() {
  const { response } = await api.POST('/api/auth/logout')
  // 401: the session had already ended, which is what the user asked for
  if (!response.ok && response.status !== 401) {
    throw new Error(`Logout failed with status ${response.status}`)
  }
  return redirect(LOGIN_PATH)
}

/**
 * For a 401 from any request once the page is open: back to the sign-in page,
 * which then returns to the page the user was opening.
 */
export function expireSession(router: DataRouter) {
  const { pathname, search } = router.state.navigation.location ?? router.state.location
  if (pathname === LOGIN_PATH) return
  void router.navigate(loginPath(pathname + search), { replace: true })
}
