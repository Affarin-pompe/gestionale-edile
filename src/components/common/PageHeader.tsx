import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import type { MessageId } from '@/i18n/it'

/** The title of a page, with its main actions on the right. */
export function PageHeader({ title, actions }: { title: MessageId; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-heading text-2xl font-semibold">
        <FormattedMessage id={title} />
      </h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
