import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts') } }
    },
    resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
        // El preload con sandbox debe ser CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    },
    resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } }
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/renderer/index.html') } }
    },
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src/renderer'),
        '@shared': resolve(import.meta.dirname, 'src/shared'),
        '@core': resolve(import.meta.dirname, 'src/core')
      }
    },
    plugins: [vue()]
  }
})
