import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

interface PageSEOProps {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'article'
  jsonLd?: object
  noSuffix?: boolean
}

const BASE_URL = 'https://lumiva.agency'
const DEFAULT_IMAGE = `${BASE_URL}/og-image.svg`

const SLUG_NAMES: Record<string, string> = {
  services: 'Services',
  development: 'Development',
  design: 'Design',
  analytics: 'Analytics',
  strategy: 'Strategy',
  performance: 'Performance',
  content: 'Content',
  seo: 'SEO',
  smm: 'SMM',
  blog: 'Blog',
  cases: 'Cases',
  'corporate-sites': 'Corporate Sites',
  ecommerce: 'E-commerce',
  saas: 'SaaS',
  integrations: 'Integrations',
  landings: 'Landing Pages',
  configurators: 'Configurators',
  mobile: 'Mobile',
  devops: 'DevOps',
  'brand-identity': 'Brand Identity',
  brandbook: 'Brandbook',
  'visual-identity': 'Visual Identity',
  'product-ui': 'Product UI',
  packaging: 'Packaging',
  editorial: 'Editorial',
  motion: 'Motion',
  environmental: 'Environmental',
  social: 'Social Media',
  'privacy-policy': 'Privacy Policy',
}

function toCanonicalPath(path: string) {
  if (path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

function getBasePath(path: string): string {
  if (path.startsWith('/ru')) return path.slice(3) || '/'
  if (path.startsWith('/tr')) return path.slice(3) || '/'
  return path
}

function buildBreadcrumbs(path: string, pageTitle: string) {
  const clean = path.endsWith('/') ? path.slice(0, -1) : path
  const segments = clean.split('/').filter(Boolean)

  const langPrefix = segments[0] === 'ru' || segments[0] === 'tr' ? segments[0] : null
  const langPrefixPath = langPrefix ? `/${langPrefix}` : ''
  const contentSegments = langPrefix ? segments.slice(1) : segments

  if (contentSegments.length === 0) return null

  const items: object[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}${langPrefixPath}/` },
  ]

  let cumPath = `${BASE_URL}${langPrefixPath}`
  contentSegments.forEach((seg, idx) => {
    cumPath += `/${seg}`
    const isLast = idx === contentSegments.length - 1
    const name = (seg in SLUG_NAMES) ? SLUG_NAMES[seg] : (isLast ? pageTitle : seg)
    items.push({ '@type': 'ListItem', position: idx + 2, name, item: `${cumPath}/` })
  })

  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }
}

const LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  tr: 'tr_TR',
}

export default function PageSEO({ title, description, path, image, type = 'website', jsonLd, noSuffix }: PageSEOProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const locale = LOCALE_MAP[lang] || 'en_US'

  const canonicalPath = toCanonicalPath(path)
  const url = `${BASE_URL}${canonicalPath}`
  const fullTitle = noSuffix ? title : `${title} | Lumiva Agency`
  const ogImage = image || DEFAULT_IMAGE

  const basePath = getBasePath(path)
  const canonicalBase = toCanonicalPath(basePath)

  const hreflangEn = `${BASE_URL}${canonicalBase}`
  const hreflangRu = `${BASE_URL}/ru${canonicalBase === '/' ? '/' : canonicalBase}`
  const hreflangTr = `${BASE_URL}/tr${canonicalBase === '/' ? '/' : canonicalBase}`

  const breadcrumbLd = buildBreadcrumbs(path, title)

  return (
    <Helmet>
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <link rel="alternate" hrefLang="en" href={hreflangEn} />
      <link rel="alternate" hrefLang="ru" href={hreflangRu} />
      <link rel="alternate" hrefLang="tr" href={hreflangTr} />
      <link rel="alternate" hrefLang="x-default" href={hreflangEn} />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={locale} />
      <meta property="og:site_name" content="Lumiva Agency" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
      {breadcrumbLd && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbLd)}
        </script>
      )}
    </Helmet>
  )
}
