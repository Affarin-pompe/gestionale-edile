import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import type { MessageId } from '@/i18n/it'

/** A page with just a title, a short text and what the user can do next. */
export function ErrorLayout({
  title,
  text,
  children,
}: {
  title: MessageId
  text: MessageId
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl font-semibold">
        <FormattedMessage id={title} />
      </h1>
      <p className="text-muted-foreground">
        <FormattedMessage id={text} />
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </main>
  )
}
