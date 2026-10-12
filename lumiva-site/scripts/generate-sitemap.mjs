import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const BASE_URL = 'https://lumiva.agency'
const API = 'https://pl2.lumiva.agency/api'
const PROD_SITEMAP_URL = `${BASE_URL}/sitemap.xml`
const TODAY = new Date().toISOString().slice(0, 10)

// Static pages: [path, priority, changefreq, lastmod?]
const STATIC_PAGES = [
  ['/', '1.0', 'weekly'],
  ['/services', '0.9', 'monthly'],
  ['/services/development', '0.85', 'monthly'],
  ['/services/development/corporate-sites', '0.75', 'monthly'],
  ['/services/development/ecommerce', '0.75', 'monthly'],
  ['/services/development/saas', '0.75', 'monthly'],
  ['/services/development/integrations', '0.7', 'monthly'],
  ['/services/development/landings', '0.75', 'monthly'],
  ['/services/development/configurators', '0.7', 'monthly'],
  ['/services/development/mobile', '0.75', 'monthly'],
  ['/services/development/devops', '0.7', 'monthly'],
  ['/services/design', '0.85', 'monthly'],
  ['/services/design/brand-identity', '0.75', 'monthly'],
  ['/services/design/brandbook', '0.7', 'monthly'],
  ['/services/design/visual-identity', '0.7', 'monthly'],
  ['/services/design/product-ui', '0.75', 'monthly'],
  ['/services/design/packaging', '0.7', 'monthly'],
  ['/services/design/editorial', '0.7', 'monthly'],
  ['/services/design/motion', '0.7', 'monthly'],
  ['/services/design/environmental', '0.7', 'monthly'],
  ['/services/design/social', '0.7', 'monthly'],
  ['/services/analytics', '0.8', 'monthly'],
  ['/services/strategy', '0.8', 'monthly'],
  ['/services/performance', '0.8', 'monthly'],
  ['/services/content', '0.8', 'monthly'],
  ['/services/seo', '0.8', 'monthly'],
  ['/services/smm', '0.8', 'monthly'],
  ['/blog', '0.85', 'weekly'],
  ['/privacy-policy', '0.3', 'yearly'],
]

// English-only pages — no ru/tr routes exist for these, so they get a single
// entry with en + x-default hreflang only (no ru/tr alternates).
const EN_ONLY_PAGES = [
  ['/terms-of-service', '0.3', 'yearly'],
  ['/cookie-policy', '0.3', 'yearly'],
  ['/digital-marketing-agency-antalya', '0.8', 'monthly'],
  ['/seo-agency-antalya', '0.8', 'monthly'],
  ['/web-development-antalya', '0.8', 'monthly'],
  ['/crm-development-turkey', '0.8', 'monthly'],
  ['/hotel-marketing-agency-turkey', '0.8', 'monthly'],
]

function toUrl(basePath) {
  const p = basePath === '/' ? '/' : `${basePath}/`
  return `${BASE_URL}${p}`
}

function ruUrl(basePath) {
  if (basePath === '/') return `${BASE_URL}/ru/`
  return `${BASE_URL}/ru${basePath}/`
}

function trUrl(basePath) {
  if (basePath === '/') return `${BASE_URL}/tr/`
  return `${BASE_URL}/tr${basePath}/`
}

function urlEntry({ loc, enHref, ruHref, trHref, priority, changefreq, lastmod }) {
  return `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="x-default" href="${enHref}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}"/>
    <xhtml:link rel="alternate" hreflang="ru" href="${ruHref}"/>
    <xhtml:link rel="alternate" hreflang="tr" href="${trHref}"/>
    <lastmod>${lastmod || TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

async function fetchBlogPosts() {
  try {
    const res = await fetch(`${API}/blog?status=published&limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    console.warn('⚠  Could not fetch blog posts for sitemap')
    return []
  }
}

async function fetchCases() {
  try {
    const res = await fetch(`${API}/cases?status=published&limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    console.warn('⚠  Could not fetch cases for sitemap')
    return []
  }
}

async function fetchProductionSlugs() {
  try {
    const res = await fetch(PROD_SITEMAP_URL)
    if (!res.ok) return { blog: [], cases: [] }
    const xml = await res.text()
    const matches = [...xml.matchAll(/<loc>(https:\/\/lumiva\.agency\/[^<]+)<\/loc>/g)].map((m) => m[1])
    const blog = new Set()
    const cases = new Set()
    for (const url of matches) {
      const path = url.replace(BASE_URL, '').replace(/\/+$/, '')
      const parts = path.split('/').filter(Boolean)
      const langOffset = parts[0] === 'ru' || parts[0] === 'tr' ? 1 : 0
      const section = parts[langOffset]
      const slug = parts[langOffset + 1]
      if (section === 'blog' && slug) blog.add(slug)
      if (section === 'cases' && slug) cases.add(slug)
    }
    return { blog: [...blog], cases: [...cases] }
  } catch {
    return { blog: [], cases: [] }
  }
}

async function generate() {
  let posts = await fetchBlogPosts()
  let cases = await fetchCases()
  if (posts.length === 0 || cases.length === 0) {
    const fallback = await fetchProductionSlugs()
    if (posts.length === 0 && fallback.blog.length > 0) {
      posts = fallback.blog.map((slug) => ({ slug, updatedAt: TODAY, publishedAt: TODAY }))
      console.log(`  Fallback blog slugs from production sitemap: ${posts.length}`)
    }
    if (cases.length === 0 && fallback.cases.length > 0) {
      cases = fallback.cases.map((slug) => ({ slug, updatedAt: TODAY, publishedAt: TODAY }))
      console.log(`  Fallback case slugs from production sitemap: ${cases.length}`)
    }
  }
  console.log(`  Fetched ${posts.length} blog post(s)`)
  console.log(`  Fetched ${cases.length} case(s)`)

  const entries = []

  // Static pages — appear in all 3 languages
  for (const [pagePath, priority, changefreq] of STATIC_PAGES) {
    const en = toUrl(pagePath)
    const ru = ruUrl(pagePath)
    const tr = trUrl(pagePath)
    // EN canonical
    entries.push(urlEntry({ loc: en, enHref: en, ruHref: ru, trHref: tr, priority, changefreq }))
    // RU canonical
    entries.push(urlEntry({ loc: ru, enHref: en, ruHref: ru, trHref: tr, priority, changefreq }))
    // TR canonical
    entries.push(urlEntry({ loc: tr, enHref: en, ruHref: ru, trHref: tr, priority, changefreq }))
  }

  // Blog posts
  for (const post of posts) {
    const slug = post.slug
    if (!slug) continue
    const lastmod = (post.updatedAt || post.publishedAt || TODAY).slice(0, 10)
    const en = `${BASE_URL}/blog/${slug}/`
    const ru = `${BASE_URL}/ru/blog/${slug}/`
    const tr = `${BASE_URL}/tr/blog/${slug}/`
    entries.push(urlEntry({ loc: ru, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
    entries.push(urlEntry({ loc: en, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
    entries.push(urlEntry({ loc: tr, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
  }

  // Case pages
  for (const caseItem of cases) {
    const slug = caseItem.slug
    if (!slug) continue
    const lastmod = (caseItem.updatedAt || caseItem.publishedAt || TODAY).slice(0, 10)
    const en = `${BASE_URL}/cases/${slug}/`
    const ru = `${BASE_URL}/ru/cases/${slug}/`
    const tr = `${BASE_URL}/tr/cases/${slug}/`
    entries.push(urlEntry({ loc: en, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
    entries.push(urlEntry({ loc: ru, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
    entries.push(urlEntry({ loc: tr, enHref: en, ruHref: ru, trHref: tr, priority: '0.8', changefreq: 'monthly', lastmod }))
  }

  // English-only pages — single language, x-default + en hreflang only
  for (const [pagePath, priority, changefreq] of EN_ONLY_PAGES) {
    const loc = toUrl(pagePath)
    entries.push(`  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${loc}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${entries.join('\n\n')}

</urlset>`

  const outPath = path.join(root, 'public', 'sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf-8')
  console.log(`  ✓  sitemap.xml — ${entries.length} entries (${posts.length * 3 + cases.length * 3 + STATIC_PAGES.length * 3} URLs)`)
}

generate().catch(err => {
  console.error(err)
  process.exit(1)
})
