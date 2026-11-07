// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/schema'
import { messages } from '@/i18n/it'
import { server } from '@/mocks/node'
import { renderApp, setupAppTests, signIn } from '@/test/app'
import { countRequests } from '@/test/cookies'

setupAppTests()

type Dashboard = components['schemas']['Dashboard']

const TITOLARE = 'titolare@example.test'
const CAPOCANTIERE = 'capocantiere@example.test'
const DASHBOARD_API = '*/api/companies/:company/dashboard'
const T = messages

const section = (name: string) => {
  const heading = screen.getByRole('heading', { name, level: 2 })
  const block = heading.closest('section')
  if (!block) throw new Error(`No section for "${name}"`)
  return block
}
const querySection = (name: string) => screen.queryByRole('heading', { name, level: 2 })

const FIXED: Dashboard = {
  today: '2026-11-07',
  sites: { planned: 2, active: 5, suspended: 1, completed: 12 },
  over_budget: [
    {
      site: { id: 's1', name: 'Ristrutturazione bagno', code: 'C-002' },
      budget: '18000.00',
      total: '21450.30',
      overrun: '3450.30',
    },
  ],
  costs_this_month: { month: '2026-11', total: '1234567.89' },
  reports: { to_approve: 3, drafts: 0 },
  deadlines: [
    {
      id: 'd1',
      title: 'F24 ritenute',
      due_on: '2026-11-03',
      kind: 'tax',
      amount: '4123.00',
      overdue: true,
    },
    {
      id: 'd2',
      title: 'Revisione autocarro',
      due_on: '2026-11-11',
      kind: 'vehicle',
      amount: null,
      overdue: false,
    },
  ],
}

async function open(email = TITOLARE, answer?: Dashboard) {
  if (answer) server.use(http.get(DASHBOARD_API, () => HttpResponse.json(answer)))
  await signIn(email)
  const app = renderApp('/impresa-rossi')
  await screen.findByRole('heading', { name: T['dashboard.sites'], level: 2 })
  return app
}

describe('dashboard', () => {
  it('shows the sites by status, the costs of the month and the reports to handle', async () => {
    await open(TITOLARE, FIXED)

    const sites = section(T['dashboard.sites'])
    const stat = (block: HTMLElement, label: string) =>
      within(block).getByText(label).nextElementSibling?.textContent
    expect(stat(sites, T['dashboard.sites.active'])).toBe('5')
    expect(stat(sites, T['dashboard.sites.planned'])).toBe('2')
    expect(stat(sites, T['dashboard.sites.suspended'])).toBe('1')
    expect(stat(sites, T['dashboard.sites.completed'])).toBe('12')

    const costs = section('Costi di novembre 2026')
    expect(within(costs).getByText('1.234.567,89 €')).toBeTruthy()

    const reports = section(T['dashboard.reports'])
    expect(stat(reports, T['dashboard.reports.toApprove'])).toBe('3')
    expect(stat(reports, T['dashboard.reports.drafts'])).toBe('0')
  })

  it('lists the deadlines, marking the overdue ones', async () => {
    await open(TITOLARE, FIXED)

    const deadlines = section(T['dashboard.deadlines'])
    const rows = within(deadlines).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('F24 ritenute')).toBeTruthy()
    expect(
      within(rows[0] as HTMLElement).getByText('Imposte e contributi · 4.123,00 €'),
    ).toBeTruthy()
    expect(within(rows[0] as HTMLElement).getByText('Scaduta il 03/11/2026')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('Scade il 11/11/2026')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('Mezzo')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).queryByText(/Scaduta/)).toBeNull()
  })

  it('lists the sites over budget with how much they overrun', async () => {
    await open(TITOLARE, FIXED)

    const over = section(T['dashboard.overBudget'])
    expect(within(over).getByText('Ristrutturazione bagno')).toBeTruthy()
    expect(within(over).getByText('C-002')).toBeTruthy()
    expect(within(over).getByText('3.450,30 € oltre il budget')).toBeTruthy()
    expect(within(over).getByText('21.450,30 € di costi su 18.000,00 € di budget')).toBeTruthy()
  })

  it('says so when no deadline is close and no site is over budget', async () => {
    await open(TITOLARE, { ...FIXED, deadlines: [], over_budget: [] })

    const deadlines = section(T['dashboard.deadlines'])
    expect(within(deadlines).getByText(T['dashboard.deadlines.empty'])).toBeTruthy()
    const over = section(T['dashboard.overBudget'])
    expect(within(over).getByText(T['dashboard.overBudget.empty'])).toBeTruthy()
  })

  it('capocantiere, without costs.view, sees neither the costs nor the sites over budget', async () => {
    await open(CAPOCANTIERE)

    expect(querySection(T['dashboard.overBudget'])).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Costi di /, level: 2 })).toBeNull()
    expect(querySection(T['dashboard.reports'])).toBeTruthy()
    expect(querySection(T['dashboard.deadlines'])).toBeTruthy()
  })

  it('a part the backend sends as null is not shown, even with the permission', async () => {
    await open(TITOLARE, { ...FIXED, reports: null, deadlines: null })

    expect(querySection(T['dashboard.reports'])).toBeNull()
    expect(querySection(T['dashboard.deadlines'])).toBeNull()
    expect(querySection(T['dashboard.overBudget'])).toBeTruthy()
  })

  it('a failed load says so and offers to try again', async () => {
    let failing = true
    server.use(
      http.get(DASHBOARD_API, () =>
        failing ? HttpResponse.json({ message: 'Errore' }, { status: 500 }) : undefined,
      ),
    )
    await signIn(TITOLARE)
    const { user } = renderApp('/impresa-rossi')
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toBe(T['dashboard.loadFailed'])

    failing = false
    await user.click(screen.getByRole('button', { name: T['list.retry'] }))

    await screen.findByRole('heading', { name: T['dashboard.sites'], level: 2 })
    expect(countRequests('GET', '/api/companies/impresa-rossi/dashboard')).toBeGreaterThan(1)
  })
})
