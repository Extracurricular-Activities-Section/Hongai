import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, 'index.html'),
        apply: path.resolve(rootDir, 'apply.html'),
        manage: path.resolve(rootDir, 'manage.html'),
      },
    },
  },
  // Agent skill files under .cursor can be locked on Windows while being written;
  // watching them crashes Vite with EBUSY.
  server: {
    watch: {
      ignored: ['**/.cursor/**'],
    },
  },
})

