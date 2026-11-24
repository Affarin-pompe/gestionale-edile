import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { MessageId } from '@/i18n/it'

/** A section of a record's page: a card with its title in the header. */
export function Section({ title, children }: { title: MessageId; children: ReactNode }) {
  return (
    <Card asChild>
      <section>
        <CardHeader>
          <h2 className="font-heading text-base leading-none font-semibold">
            <FormattedMessage id={title} />
          </h2>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </section>
    </Card>
  )
}

/** A section made of label and value pairs. */
export function DetailSection({ title, children }: { title: MessageId; children: ReactNode }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-4">{children}</dl>
    </Section>
  )
}

/** A label and its value; an empty value says "Non indicato". */
export function Detail({ label, children }: { label: MessageId; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-2.5">
      <dt className="text-muted-foreground">
        <FormattedMessage id={label} />
      </dt>
      <dd className="break-words">{children || <Missing />}</dd>
    </div>
  )
}

export function Missing() {
  return (
    <span className="text-muted-foreground">
      <FormattedMessage id="detail.empty" />
    </span>
  )
}

/** Free text written by a user, with its line breaks. Never as HTML. */
export function NotesSection({ title, notes }: { title: MessageId; notes: string | null }) {
  return (
    <Section title={title}>
      <p className="break-words whitespace-pre-line">{notes ?? <Missing />}</p>
    </Section>
  )
}
