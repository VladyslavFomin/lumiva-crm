import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const API = 'https://pl2.lumiva.agency/api'

const BASE_ROUTES = [
  '/',
  '/services',
  '/services/strategy',
  '/services/performance',
  '/services/content',
  '/services/smm',
  '/services/seo',
  '/services/analytics',
  '/services/development',
  '/services/development/corporate-sites',
  '/services/development/ecommerce',
  '/services/development/saas',
  '/services/development/integrations',
  '/services/development/landings',
  '/services/development/configurators',
  '/services/development/mobile',
  '/services/development/devops',
  '/services/design',
  '/services/design/brand-identity',
  '/services/design/brandbook',
  '/services/design/visual-identity',
  '/services/design/product-ui',
  '/services/design/packaging',
  '/services/design/editorial',
  '/services/design/motion',
  '/services/design/environmental',
  '/services/design/social',
  '/blog',
  '/cases',
  '/privacy-policy',
]

// English-only pages — no ru/tr routes exist for these
const EN_ONLY_ROUTES = [
  '/terms-of-service',
  '/cookie-policy',
  '/digital-marketing-agency-antalya',
  '/seo-agency-antalya',
  '/web-development-antalya',
  '/crm-development-turkey',
  '/hotel-marketing-agency-turkey',
]

const LANGS = ['', '/ru', '/tr']

const STATIC_ROUTES = LANGS.flatMap(prefix =>
  BASE_ROUTES.map(route =>
    prefix === '' ? route : `${prefix}${route === '/' ? '' : route}`
  )
)

function htmlLangForRoute(route) {
  if (route === '/tr' || route.startsWith('/tr/')) return 'tr'
  if (route === '/ru' || route.startsWith('/ru/')) return 'ru'
  return 'en'
}

async function fetchBlogPosts(lang = '') {
  try {
    const url = lang
      ? `${API}/blog?status=published&limit=500&lang=${lang}`
      : `${API}/blog?status=published&limit=500`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    console.warn('⚠  Could not fetch blog posts — skipping blog post prerender')
    return []
  }
}

async function fetchBlogPost(slug, lang = '') {
  try {
    const url = lang
      ? `${API}/blog/${slug}?lang=${lang}&admin=true`
      : `${API}/blog/${slug}?admin=true`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchCases() {
  try {
    const res = await fetch(`${API}/cases?status=published&limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    console.warn('⚠  Could not fetch cases — skipping case prerender')
    return []
  }
}

async function prerender() {
  const serverEntry = path.join(root, 'dist-server/entry-server.js')
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`SSR bundle not found: ${serverEntry}\nRun: npm run build:server first`)
  }

  const { render } = await import(serverEntry)
  const template = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf-8')

  const posts = await fetchBlogPosts()
  console.log(`  Fetched ${posts.length} blog post(s) for prerender`)

  // Pre-fetch translated versions for each post
  const postsByLang = { ru: {}, en: {}, tr: {} }
  for (const post of posts) {
    postsByLang.ru[post.slug] = post
    postsByLang.en[post.slug] = post
    // Fetch TR version with translated blocks
    const trPost = await fetchBlogPost(post.slug, 'tr')
    postsByLang.tr[post.slug] = trPost || post
  }

  const cases = await fetchCases()
  console.log(`  Fetched ${cases.length} case(s) for prerender`)

  // Build blog post routes: each post in all 3 lang prefixes
  const blogRoutes = posts.flatMap(post => [
    `/blog/${post.slug}`,
    `/ru/blog/${post.slug}`,
    `/tr/blog/${post.slug}`,
  ])

  // Build case routes: each case in all 3 lang prefixes
  const caseRoutes = cases.flatMap(c => [
    `/cases/${c.slug}`,
    `/ru/cases/${c.slug}`,
    `/tr/cases/${c.slug}`,
  ])

  const ALL_ROUTES = [...STATIC_ROUTES, ...EN_ONLY_ROUTES, ...blogRoutes, ...caseRoutes]

  let ok = 0
  let fail = 0

  for (const route of ALL_ROUTES) {
    try {
      // Inject blog post data for SSR render with correct language
      const isBlogPost = /\/blog\/[^/]+$/.test(route)
      if (isBlogPost) {
        const slug = route.split('/blog/')[1]
        const lang = htmlLangForRoute(route)
        const langMap = lang === 'tr' ? postsByLang.tr : lang === 'ru' ? postsByLang.ru : postsByLang.en
        const post = langMap[slug]
        if (post) {
          global.__SSR_BLOG_DATA__ = post
        }
      }

      const { appHtml, headHtml } = render(route)

      // Clear injected data
      if (global.__SSR_BLOG_DATA__) global.__SSR_BLOG_DATA__ = null

      const html = template
        .replace(/<html lang="[^"]*">/, `<html lang="${htmlLangForRoute(route)}">`)
        .replace('</head>', `    ${headHtml}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)

      const outDir = route === '/' || route === '/ru' || route === '/tr'
        ? path.join(root, 'dist', route === '/' ? '' : route)
        : path.join(root, 'dist', route)

      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'index.html'), html)
      console.log(`  ✓  ${route}`)
      ok++
    } catch (err) {
      if (global.__SSR_BLOG_DATA__) global.__SSR_BLOG_DATA__ = null
      console.error(`  ✗  ${route}: ${err.message}`)
      fail++
    }
  }

  console.log(`\nPrerendered ${ok}/${ALL_ROUTES.length} pages${fail ? ` (${fail} failed)` : ''}`)
}

prerender().catch(err => {
  console.error(err)
  process.exit(1)
})
