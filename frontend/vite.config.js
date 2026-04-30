import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,

      allowedHosts: true,

      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/static': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/bienvenido/pdf': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
