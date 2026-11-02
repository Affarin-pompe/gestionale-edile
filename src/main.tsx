import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { setUnauthorizedHandler } from './api/client'
import { App } from './app/App'
import { createQueryClient } from './app/query-client'
import { createRoutes } from './app/routes'
import { expireSession } from './auth/session'
import './index.css'

// Development only: the production build drops this import, and CI checks it
async function startMocks() {
  if (!import.meta.env.DEV) return
  const { worker } = await import('./mocks/browser')
  await worker.start()
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')

// The router starts loading data as soon as it exists, so only after the mocks are ready
void startMocks().then(() => {
  const queryClient = createQueryClient()
  const router = createBrowserRouter(createRoutes(queryClient))
  setUnauthorizedHandler(() => expireSession(router))
  createRoot(root).render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  )
})
