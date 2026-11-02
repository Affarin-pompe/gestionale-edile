import type { components } from '@/api/schema'

type Client = components['schemas']['Client']
type Permission = components['schemas']['Permission']

// Made-up data for development and tests. Never put real people or companies here.

/** Every mock user signs in with this password. */
export const MOCK_PASSWORD = 'cantiere-demo'

export const companies = [
  { slug: 'impresa-rossi', name: 'Impresa Rossi S.r.l.' },
  { slug: 'costruzioni-verdi', name: 'Costruzioni Verdi S.p.A.' },
]

export interface MockUser {
  id: string
  name: string
  email: string
  memberships: { company: string; role: string; permissions: Permission[] }[]
}

const ALL_CLIENT_PERMISSIONS: Permission[] = ['clients.view', 'clients.create', 'clients.update']

export const users: MockUser[] = [
  {
    id: 'u-titolare',
    name: 'Giulia Rossi',
    email: 'titolare@example.test',
    memberships: [
      { company: 'impresa-rossi', role: 'Titolare', permissions: ALL_CLIENT_PERMISSIONS },
      { company: 'costruzioni-verdi', role: 'Ufficio', permissions: ALL_CLIENT_PERMISSIONS },
    ],
  },
  {
    id: 'u-ufficio',
    name: 'Luca Bianchi',
    email: 'ufficio@example.test',
    memberships: [
      { company: 'impresa-rossi', role: 'Ufficio', permissions: ALL_CLIENT_PERMISSIONS },
    ],
  },
  {
    id: 'u-capocantiere',
    name: 'Marco Neri',
    email: 'capocantiere@example.test',
    memberships: [
      { company: 'impresa-rossi', role: 'Capo cantiere', permissions: ['clients.view'] },
    ],
  },
  {
    id: 'u-nuovo',
    name: 'Sara Galli',
    email: 'nuovo@example.test',
    memberships: [],
  },
]

const SURNAMES = (
  'Ferri,Colombo,Ricci,Marino,Greco,Bruno,Gallo,Conti,De Luca,Costa,' +
  'Giordano,Mancini,Rizzo,Lombardi,Moretti,Barbieri,Fontana,Santoro,Mariani,Rinaldi'
).split(',')
const COMPANY_FORMS = ['Edil {s} S.r.l.', 'Immobiliare {s} S.p.A.', 'Condominio Via {s}']
const FIRST_NAMES = ['Anna', 'Paolo', 'Elena']
const CITIES = [
  { city: 'Torino', province: 'TO', postal_code: '10121' },
  { city: 'Milano', province: 'MI', postal_code: '20121' },
  { city: 'Novara', province: 'NO', postal_code: '28100' },
  { city: 'Asti', province: 'AT', postal_code: '14100' },
]

// The lists are never empty, so the index always hits
const pick = <T>(list: readonly T[], i: number) => list[i % list.length] as T

/**
 * Deterministic, so tests can count on names, order and pages.
 * Names are unique: each index gets its own surname and naming round.
 */
function generateClients(company: string, count: number, vatBase: number): Client[] {
  return Array.from({ length: count }, (_, i) => {
    const surname = pick(SURNAMES, i)
    const round = Math.floor(i / SURNAMES.length)
    const isCompany = i % 3 !== 2
    const created = new Date(Date.UTC(2026, 0, 1 + i, 9)).toISOString()
    return {
      id: `${company}-${String(i + 1).padStart(3, '0')}`,
      kind: isCompany ? 'company' : 'person',
      name: isCompany
        ? pick(COMPANY_FORMS, round).replace('{s}', surname)
        : `${pick(FIRST_NAMES, round)} ${surname}`,
      vat_number: isCompany ? String(vatBase + i * 1013) : null,
      tax_code: isCompany
        ? null
        : `${surname.replace(' ', '').slice(0, 3).toUpperCase()}XYZ80A01L219${i % 10}`,
      email: `cliente${i + 1}@example.test`,
      pec: isCompany ? `cliente${i + 1}@pec.example.test` : null,
      phone: `011 555 ${1000 + i}`,
      sdi_code: isCompany ? 'ABC1234' : null,
      street: `Via ${surname} ${i + 1}`,
      ...pick(CITIES, i),
      notes: null,
      created_at: created,
      updated_at: created,
    }
  })
}

/** Clients by company slug. */
export function seedClients(): Record<string, Client[]> {
  return {
    // Enough for three pages at the default page size
    'impresa-rossi': generateClients('impresa-rossi', 60, 10_000_000_000),
    'costruzioni-verdi': generateClients('costruzioni-verdi', 5, 20_000_000_000),
  }
}
