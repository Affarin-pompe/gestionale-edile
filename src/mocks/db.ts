import { seedClients } from './data'

/** The mock backend's state. It lives in memory and starts over on every page load. */
export const db = {
  clients: seedClients(),
  /** Failed logins by email, for the rate limit. */
  failedLogins: new Map<string, { count: number; lockedUntil: number }>(),
}

/** Back to the seed data; the test setup calls it after every test. */
export function resetDb() {
  db.clients = seedClients()
  db.failedLogins.clear()
}
