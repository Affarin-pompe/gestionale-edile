import { Fragment } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useMatches } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { listHref } from '@/hooks/use-list-params'

/** Where the page is: a step for each route of the URL that has a crumb in its handle. */
export function Breadcrumbs({ className }: { className?: string }) {
  const steps = useMatches().flatMap((match) => {
    const crumb = (match.handle as Partial<RouteHandle> | undefined)?.crumb
    if (!crumb) return []
    const Crumb = crumb
    const label = typeof Crumb === 'string' ? <FormattedMessage id={Crumb} /> : <Crumb />
    // A list reopens as the user left it
    return [{ id: match.id, to: listHref(match.pathname), label }]
  })

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="text-2sm">
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {index === steps.length - 1 ? (
                <BreadcrumbPage>{step.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={step.to}>{step.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
