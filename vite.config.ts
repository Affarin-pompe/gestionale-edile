/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Phase 0 starts with no tests; each later PR brings its own.
    passWithNoTests: true,
  },
})
