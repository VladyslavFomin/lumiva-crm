import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // позволяет слушать внешний IP
    port: 5173,
    allowedHosts: [
      'crm.lumiva.agency',
      'www.crm.lumiva.agency',
      '195.35.56.237'
    ],
  }
})
