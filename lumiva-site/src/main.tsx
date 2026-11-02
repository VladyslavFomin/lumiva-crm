import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './styles/lh.css'
import './styles/v2-pages.css'
import './styles/v2-art.css'
import './components/lh/ai-characters.css'
import './i18n'
import App from './App.tsx'

document.documentElement.classList.add('js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
