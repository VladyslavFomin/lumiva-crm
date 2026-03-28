import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildStamp = new Date().toISOString()

export default defineConfig({
  define: {
    __CRM_FRONT_BUILD__: JSON.stringify(buildStamp),
  },
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
