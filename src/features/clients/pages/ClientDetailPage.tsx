import { useSuspenseQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { MessageId } from '@/i18n/it'
import { clientQuery } from '../api'
import { ClientKindBadge } from '../components/ClientKindBadge'
import { clientPaths, useClientId } from '../paths'

export function ClientDetailPage() {
  const company = useCompany()
  const id = useClientId()
  const paths = clientPaths(company.slug)
  // Already loaded by the route's loader
  const { data: client } = useSuspenseQuery(clientQuery(company.slug, id))
  const place = [client.postal_code, client.city, client.province && `(${client.province})`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="clients.title" /> }}
        title={client.name}
        actions={
          <PermissionGate permission="clients.update">
            <Button asChild>
              <Link to={paths.edit(id)}>
                <Pencil aria-hidden="true" />
                <FormattedMessage id="clients.edit" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <p>
        <ClientKindBadge kind={client.kind} />
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="clients.section.tax">
          <Detail label="clients.vatNumber">{client.vat_number}</Detail>
          <Detail label="clients.taxCode">{client.tax_code}</Detail>
          <Detail label="clients.sdiCode">{client.sdi_code}</Detail>
        </DetailSection>
        <DetailSection title="clients.section.contacts">
          <Detail label="clients.email">
            {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
          </Detail>
          <Detail label="clients.pec">{client.pec}</Detail>
          <Detail label="clients.phone">
            {client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}
          </Detail>
        </DetailSection>
        <DetailSection title="clients.section.address">
          <Detail label="clients.street">{client.street}</Detail>
          <Detail label="clients.city">{place}</Detail>
        </DetailSection>
        <Section title="clients.notes">
          <p className="break-words whitespace-pre-line">{client.notes ?? <Missing />}</p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: MessageId; children: ReactNode }) {
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

function DetailSection({ title, children }: { title: MessageId; children: ReactNode }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-4">{children}</dl>
    </Section>
  )
}

function Detail({ label, children }: { label: MessageId; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-2.5">
      <dt className="text-muted-foreground">
        <FormattedMessage id={label} />
      </dt>
      <dd className="break-words">{children || <Missing />}</dd>
    </div>
  )
}

function Missing() {
  return (
    <span className="text-muted-foreground">
      <FormattedMessage id="detail.empty" />
    </span>
  )
}
