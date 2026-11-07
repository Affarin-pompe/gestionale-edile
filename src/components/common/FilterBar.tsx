import { Search } from 'lucide-react'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { Input } from '@/components/ui/input'
import type { MessageId } from '@/i18n/it'

export function FilterBar({ children }: { children: ReactNode }) {
  // min-w-0: in the grid of the card header, a long option of a select must not widen it
  return <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
}

const TYPING_PAUSE_MS = 300

/** A search box that applies its text after a pause in typing, not at every letter. */
export function SearchFilter({
  label,
  value,
  onChange,
}: {
  label: MessageId
  value: string
  onChange: (value: string) => void
}) {
  const intl = useIntl()
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  // The last text applied by this box, until the URL shows it
  const [sent, setSent] = useState<string>()
  if (value !== shown) {
    setShown(value)
    setSent(undefined)
    // The URL changed from outside, e.g. with the back button: the box follows it.
    // When the change is this box's own, the user may have typed more in the meantime.
    if (value !== sent) setText(value)
  }

  const apply = useEffectEvent((next: string) => {
    setSent(next)
    onChange(next)
  })
  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => apply(text), TYPING_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [text, value])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        className="pl-8"
        aria-label={intl.formatMessage({ id: label })}
        placeholder={intl.formatMessage({ id: label })}
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  )
}
