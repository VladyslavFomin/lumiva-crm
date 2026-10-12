import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  ssr: {
    noExternal: ['react-helmet-async'],
  },
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-server',
    rollupOptions: {
      output: { format: 'esm' },
    },
  },
})
