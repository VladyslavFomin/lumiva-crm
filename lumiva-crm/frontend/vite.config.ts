import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Одна метка на процесс сборки: в JS (__CRM_FRONT_BUILD__) и в index.html (meta), чтобы проверить деплой без кэша бандла. */
const buildStamp = new Date().toISOString()

export default defineConfig({
  define: {
    __CRM_FRONT_BUILD__: JSON.stringify(buildStamp),
  },
  plugins: [
    react(),
    {
      name: 'html-build-stamp',
      transformIndexHtml(html) {
        const safe = buildStamp.replace(/"/g, '')
        return html.replace(
          '</head>',
          `  <meta name="crm-build" content="${safe}" />\n  </head>`,
        )
      },
    },
  ],
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
