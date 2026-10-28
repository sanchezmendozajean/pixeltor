import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src/renderer'),
      '@shared': resolve(import.meta.dirname, 'src/shared'),
      '@core': resolve(import.meta.dirname, 'src/core')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/core/**/*.test.ts', 'tests/renderer/**/*.test.ts', 'src/**/*.test.ts'],
    benchmark: { include: ['tests/core/bench/**/*.bench.ts'] }
  }
})
