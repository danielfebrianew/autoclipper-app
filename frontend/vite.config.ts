/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const isTest = process.env.VITEST === 'true'

// In test runs, redirect the Wails Go bindings + runtime to in-memory mocks so
// components that import them render without a live Wails backend. Components
// import via relative paths of varying depth (../../wailsjs vs ../../../wailsjs),
// so we match with regexes on the trailing module path. Outside tests the real
// generated files are used unchanged.
const testAliases = isTest
  ? [
      {
        find: /.*wailsjs\/go\/main\/App$/,
        replacement: fileURLToPath(new URL('./src/test/mocks/wails.ts', import.meta.url)),
      },
      {
        find: /.*wailsjs\/runtime\/runtime$/,
        replacement: fileURLToPath(new URL('./src/test/mocks/runtime.ts', import.meta.url)),
      },
    ]
  : []

export default defineConfig({
  // In test mode the React plugin injects a refresh "preamble" that jsdom never
  // executes, which makes plugin-react v2 throw "can't detect preamble". Tests
  // don't need fast-refresh, so we run esbuild's automatic JSX transform via the
  // plugin only outside tests and let Vitest handle JSX in test mode.
  plugins: isTest ? [] : [react()],
  esbuild: isTest ? { jsx: 'automatic', jsxImportSource: 'react' } : undefined,
  resolve: {
    alias: testAliases,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        'src/**/*.test.{ts,tsx}',
      ],
    },
  },
})
