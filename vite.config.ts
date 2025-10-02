import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,                 // acepta conexiones externas
    port: 3000,
    // mientras uses ngrok free (dominio cambia), habilita todos:
    allowedHosts: true,         // o pon el dominio exacto si prefieres
    hmr: {
      protocol: 'wss',
      // si quieres, fija el host de tu túnel actual; con allowedHosts:true suele bastar
      // host: 'TU-DOMINIO.ngrok-free.app',
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', // tu API local
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
