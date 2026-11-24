// The production build served against the real backend, without mocks: `npm run preview:backend`.
// The backend (gestionale-edile-backend) must be running on http://127.0.0.1:3100.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(
  base,
  defineConfig({
    preview: {
      port: 5190,
      strictPort: true,
      proxy: { '/api': { target: 'http://127.0.0.1:3100' } },
    },
  }),
)
