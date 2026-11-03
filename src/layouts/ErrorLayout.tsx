import { cn } from 'cn'
import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import type { MessageId } from '@/i18n/it'

/**
 * A page with just a title, a short text and what the user can do next.
 * inPage: inside the app layout, which already has the page's <main>.
 */
export function ErrorLayout({
  title,
  text,
  inPage = false,
  children,
}: {
  title: MessageId
  text: MessageId
  inPage?: boolean
  children: ReactNode
}) {
  const Tag = inPage ? 'div' : 'main'
  return (
    <Tag
      className={cn(
        'mx-auto flex w-full max-w-md flex-col justify-center gap-4 p-4',
        inPage ? 'flex-1' : 'min-h-svh',
      )}
    >
      <h1 className="font-heading text-2xl font-semibold">
        <FormattedMessage id={title} />
      </h1>
      <p className="text-muted-foreground">
        <FormattedMessage id={text} />
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </Tag>
  )
}
