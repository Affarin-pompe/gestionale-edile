import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Quote } from '../api'
import { quotePaths } from '../paths'

/** The quote's subject, linking to its page. */
export function QuoteLink({ quote, className }: { quote: Quote; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={quotePaths(company.slug).detail(quote.id)}
      className={cn('font-medium break-words underline-offset-4 hover:underline', className)}
    >
      {quote.subject}
    </Link>
  )
}
