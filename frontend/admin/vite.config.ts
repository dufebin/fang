import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:9080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:9080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
