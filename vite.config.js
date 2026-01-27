import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Base public path when served in production
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 62522,
    host: true,
    strictPort: true, // Exit if port is already in use
  },
  preview: {
    port: 4173,
    host: true,
  },
})
