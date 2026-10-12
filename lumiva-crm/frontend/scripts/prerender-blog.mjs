/**
 * Обновляет мета-теги статей блога и sitemap прямо в живой папке сайта — без пересборки фронтенда.
 * Статьи публикуются в CMS pl2 в любой момент, а scripts/prerender.mjs запускается только при сборке.
 * Запускается по cron (см. /etc/cron.d/crm-blog-prerender) и безопасен для повторного запуска.
 *
 * Usage: node scripts/prerender-blog.mjs [siteDir=/var/www/crm.lumiva.agency]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const siteDir = process.argv[2] || '/var/www/crm.lumiva.agency';
const BASE_URL = 'https://crm.lumiva.agency';
const BLOG_API = process.env.BLOG_API || 'http://127.0.0.1:3010/blog';
const MARK = '<meta name="lumiva-blog-prerender" content="1" />';

const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stripExistingSeoTags(html) {
  return html
    .replace(/<title>.*?<\/title>\s*/is, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="lumiva-blog-prerender"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
}

function metaTags(p) {
  const url = `${BASE_URL}/blog/${p.slug}`;
  const title = attr(`${p.seoTitle || p.title} — Lumiva CRM`);
  const description = attr(p.seoDescription || p.excerpt || '');
  const image = attr(p.coverUrl || `${BASE_URL}/og-image.png`);
  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Lumiva CRM" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${url}" />
    ${MARK}`.trim();
}

const r = await fetch(`${BLOG_API}?site=crm&status=published&limit=200`, { signal: AbortSignal.timeout(8000) });
if (!r.ok) {
  console.error('blog API HTTP', r.status);
  process.exit(1);
}
const posts = (await r.json()).items || [];
const base = stripExistingSeoTags(readFileSync(join(siteDir, 'index.html'), 'utf-8'));
const blogDir = join(siteDir, 'blog');
const live = new Set();

for (const p of posts) {
  if (!/^[A-Za-z0-9_-]+$/.test(p.slug)) continue;
  live.add(p.slug);
  const dir = join(blogDir, p.slug);
  mkdirSync(dir, { recursive: true });
  const html = base.replace('</head>', `  ${metaTags(p)}\n  </head>`);
  const file = join(dir, 'index.html');
  if (!existsSync(file) || readFileSync(file, 'utf-8') !== html) writeFileSync(file, html, 'utf-8');
}

// снятые с публикации статьи: убираем только страницы, созданные этим скриптом или сборкой блога
for (const name of existsSync(blogDir) ? readdirSync(blogDir) : []) {
  const f = join(blogDir, name, 'index.html');
  if (live.has(name) || !existsSync(f)) continue;
  const html = readFileSync(f, 'utf-8');
  if (html.includes('lumiva-blog-prerender') || html.includes('property="og:type" content="article"')) rmSync(join(blogDir, name), { recursive: true });
}

const smPath = join(siteDir, 'sitemap.xml');
if (existsSync(smPath)) {
  let sm = readFileSync(smPath, 'utf-8').replace(/\s*<url><loc>[^<]*\/blog\/[^<]+<\/loc>.*?<\/url>/g, '');
  const urls = posts
    .filter((p) => live.has(p.slug))
    .map((p) => {
      const lm = (p.updatedAt || p.publishedAt || '').slice(0, 10);
      return `  <url><loc>${BASE_URL}/blog/${p.slug}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.5</priority></url>`;
    })
    .join('\n');
  sm = sm.replace(/(<url><loc>[^<]*\/blog<\/loc>.*?<\/url>)/, `$1\n${urls}`);
  writeFileSync(smPath, sm, 'utf-8');
}
console.log(`blog prerender: ${live.size} posts`);
