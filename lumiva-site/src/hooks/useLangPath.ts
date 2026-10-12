import { useTranslation } from 'react-i18next'

export function useLangPath() {
  const { i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'ru' | 'tr'
  const prefix = lang === 'ru' ? '/ru' : lang === 'tr' ? '/tr' : ''

  return {
    p: (path: string) => `${prefix}${path}`,
    h: (hash: string) => `${prefix}${hash}`,
    prefix,
    lang,
  }
}
