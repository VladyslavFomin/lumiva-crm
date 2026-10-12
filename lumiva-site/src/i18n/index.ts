import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ru from './ru.json'
import tr from './tr.json'

export type Lang = 'en' | 'ru' | 'tr'
export const LANGS: Lang[] = ['en', 'ru', 'tr']

export function detectLangFromPath(path: string): Lang {
  if (path.startsWith('/ru')) return 'ru'
  if (path.startsWith('/tr')) return 'tr'
  return 'en'
}

const initialLang: Lang =
  typeof window !== 'undefined'
    ? detectLangFromPath(window.location.pathname)
    : 'en'

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    tr: { translation: tr },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18next
