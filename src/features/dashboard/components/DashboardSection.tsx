import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/** A block of the dashboard: a card with one title, and its content without further boxes. */
export function DashboardSection({
  title,
  className,
  children,
}: {
  title: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card asChild className={className}>
      <section>
        <CardHeader>
          <h2 className="font-heading text-base leading-none font-semibold">{title}</h2>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </section>
    </Card>
  )
}

/** Numbers side by side, each with its label under it. */
export function Stats({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">{children}</dl>
}

export function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    // The number reads first; for screen readers the label still comes before it
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl leading-none font-semibold">{value}</dd>
    </div>
  )
}
