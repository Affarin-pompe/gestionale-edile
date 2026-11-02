/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // msw() serves the mock worker during development only: nothing imports virtual:msw,
  // so the build never emits it (CI checks this)
  plugins: [react(), tailwindcss(), msw()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['src/test/setup.ts'],
  },
})
