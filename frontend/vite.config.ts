import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BACKEND_PROXY_TARGET lets the dev-server proxy reach the backend by its
// docker-compose service name (http://backend:8080) when running in a
// container; defaults to localhost for host-machine dev.
const backendTarget = process.env.BACKEND_PROXY_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    // 'frontend' is this service's docker-compose hostname — the e2e
    // playwright container reaches the dev server through it.
    allowedHosts: ['frontend', 'localhost'],
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
