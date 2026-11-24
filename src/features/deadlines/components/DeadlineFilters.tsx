import { useIntl } from 'react-intl'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'
import type { MessageId } from '@/i18n/it'
import { DEADLINE_KINDS, DEADLINE_STATUSES, useSubjects } from '../api'

/** Kind, status and subject: the filters the list and the calendar share. */
export function DeadlineFilters({
  kind,
  status,
  subject,
  onChange,
}: {
  kind: string | undefined
  status: string | undefined
  /** As in the URL: "cliente:<id>" or "fornitore:<id>". */
  subject: string | undefined
  onChange: (filter: 'kind' | 'status' | 'subject', value: string | undefined) => void
}) {
  const intl = useIntl()
  const subjects = useSubjects().data
  const t = (id: MessageId) => intl.formatMessage({ id })
  const known =
    subjects?.clients.some((c) => subject === `cliente:${c.id}`) ||
    subjects?.suppliers.some((s) => subject === `fornitore:${s.id}`)

  return (
    <>
      <NativeSelect
        aria-label={t('deadlines.kind')}
        value={kind ?? ''}
        onChange={(event) => onChange('kind', event.target.value || undefined)}
      >
        <NativeSelectOption value="">{t('deadlines.filter.allKinds')}</NativeSelectOption>
        {DEADLINE_KINDS.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {t(`deadlines.kind.${value}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={t('deadlines.status')}
        value={status ?? ''}
        onChange={(event) => onChange('status', event.target.value || undefined)}
      >
        <NativeSelectOption value="">{t('deadlines.filter.allStatuses')}</NativeSelectOption>
        {DEADLINE_STATUSES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {t(`deadlines.filter.status.${value}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        className="max-w-full sm:max-w-60"
        aria-label={t('deadlines.subject')}
        value={subject ?? ''}
        onChange={(event) => onChange('subject', event.target.value || undefined)}
      >
        <NativeSelectOption value="">{t('deadlines.filter.allSubjects')}</NativeSelectOption>
        {/* A subject from a shared URL that is not among the options still shows */}
        {subject && !known && (
          <NativeSelectOption value={subject}>
            {t('deadlines.filter.thisSubject')}
          </NativeSelectOption>
        )}
        {subjects && subjects.clients.length > 0 && (
          <NativeSelectOptGroup label={t('deadlines.subject.clients')}>
            {subjects.clients.map((client) => (
              <NativeSelectOption key={client.id} value={`cliente:${client.id}`}>
                {client.name}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}
        {subjects && subjects.suppliers.length > 0 && (
          <NativeSelectOptGroup label={t('deadlines.subject.suppliers')}>
            {subjects.suppliers.map((supplier) => (
              <NativeSelectOption key={supplier.id} value={`fornitore:${supplier.id}`}>
                {supplier.name}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}
      </NativeSelect>
    </>
  )
}
