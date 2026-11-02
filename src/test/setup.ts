import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetDb } from '@/mocks/db'
import { server } from '@/mocks/node'

// Every test talks to the mock backend; a request it does not know fails the test
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetDb()
})
afterAll(() => server.close())
