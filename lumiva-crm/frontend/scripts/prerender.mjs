/**
 * Post-build prerender: generates dist/[route]/index.html for each public page
 * with route-specific meta tags so crawlers get proper SEO data immediately.
 *
 * Usage: node scripts/prerender.mjs  (runs after vite build)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(__dirname, '../dist');

const SEO_META = {
  '/': {
    title: 'Lumiva CRM — современная CRM-система для бизнеса',
    description: 'Управляйте сделками, клиентами и командой в одном месте. Автоматизация, аналитика, интеграции.',
  },
  '/pricing': {
    title: 'Тарифы — Lumiva CRM',
    description: 'Выберите подходящий тариф. Начните бесплатно и масштабируйтесь по мере роста.',
  },
  '/features': {
    title: 'Возможности — Lumiva CRM',
    description: 'Воронки продаж, автоматизация, аналитика, email-рассылки и многое другое.',
  },
  '/about': {
    title: 'О нас — Lumiva CRM',
    description: 'Команда Lumiva создаёт инструменты для роста бизнеса.',
  },
  '/blog': {
    title: 'Блог — Lumiva CRM',
    description: 'Статьи о продажах, маркетинге и управлении клиентами.',
  },
  '/contact': {
    title: 'Контакты — Lumiva CRM',
    description: 'Свяжитесь с нашей командой. Ответим на вопросы и поможем с запуском.',
  },
  '/faq': {
    title: 'Частые вопросы — Lumiva CRM',
    description: 'Ответы на популярные вопросы о работе с Lumiva CRM.',
  },
  '/privacy': {
    title: 'Политика конфиденциальности — Lumiva CRM',
    description: 'Как мы обрабатываем и защищаем ваши данные.',
  },
  '/security': {
    title: 'Безопасность и защита данных — Lumiva CRM',
    description: 'Изоляция данных компаний, роли и права, двухфакторный вход, HTTPS и ежедневные резервные копии.',
  },
  '/compare': {
    title: 'Почему выбирают Lumiva CRM',
    description: 'No-code рабочие области, AI-ассистент и AI-сотрудники, Bookings и Hotels/PMS в одной системе — без сравнения с конкретными брендами.',
  },
  '/terms': {
    title: 'Условия использования — Lumiva CRM',
    description: 'Условия предоставления услуг платформы Lumiva CRM.',
  },
  '/changelog': {
    title: 'Список изменений — Lumiva CRM',
    description: 'История обновлений и новых функций платформы.',
  },
  '/api-integration/docs': {
    title: 'Справочник API — Lumiva CRM',
    description: 'REST API Lumiva CRM: аутентификация по токену, приём лидов, товары, бронирования и пользовательские объекты.',
  },
  '/integrations': {
    title: 'Интеграции — Lumiva CRM',
    description: '30+ интеграций: WhatsApp, Telegram, Google Ads, Meta, amoCRM, Bitrix24, HubSpot, iyzico, PayTR, ЮKassa и другие.',
  },
  '/solutions': {
    title: 'Решения по отрасли — Lumiva CRM',
    description: 'Подбираем набор модулей и доступов под цикл продаж: от первого касания до удержания и LTV.',
  },
  '/solutions/analytics': {
    title: 'Аналитика — решения Lumiva CRM',
    description: 'Живая аналитика по сделкам, каналам и команде — единая отчётность для маркетинга и продаж.',
  },
  '/solutions/marketing': {
    title: 'Маркетинг — решения Lumiva CRM',
    description: 'UTM-атрибуция, кампании и единая отчётность для CMO и Head of Sales.',
  },
  '/solutions/sales': {
    title: 'Продажи — решения Lumiva CRM',
    description: 'Контроль этапов, задач и прогноза выручки по каждой сделке и аккаунту.',
  },
  '/solutions/warehouse': {
    title: 'Склад — решения Lumiva CRM',
    description: 'Физический учёт остатков, склады и bin-level контроль в единой CRM.',
  },
  '/solutions/client-accounts': {
    title: 'Клиентские аккаунты — решения Lumiva CRM',
    description: 'Портал и доступы для клиентов и партнёров, встроенные в CRM.',
  },
  '/solutions/products': {
    title: 'Товары — решения Lumiva CRM',
    description: 'Каталог товаров, цены, остатки и атрибуты в одной системе.',
  },
  '/solutions/booking': {
    title: 'Бронирования — решения Lumiva CRM',
    description: 'Онлайн-запись, занятость сотрудников и лист ожидания в одной системе.',
  },
  '/solutions/hotels': {
    title: 'Система резервации — решения Lumiva CRM',
    description: 'Пейсинг по датам заезда, риск недозагрузки и тарифы по рынкам и агентствам.',
  },
  '/development': {
    title: 'Разработка CRM под ваш процесс — Lumiva CRM',
    description: 'Проектируем архитектуру CRM под реальные этапы продаж, сервиса и маркетинга, с KPI и прозрачной ответственностью.',
  },
  '/scenarios': {
    title: 'Сценарии использования — Lumiva CRM',
    description: 'Прикладные сценарии для B2B, eCommerce и сервисных компаний с распределёнными командами.',
  },
  '/api-integration': {
    title: 'API и интеграции — Lumiva CRM',
    description: 'Открытый API для синхронизации лидов, сделок, статусов, задач и отчётности с внешними системами.',
  },
};

const BASE_URL = process.env.VITE_APP_URL || 'https://crm.lumiva.agency';

const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildMetaTags(route, meta) {
  const ogUrl = `${BASE_URL}${route === '/' ? '' : route}`;
  const title = attr(meta.title);
  const description = attr(meta.description);
  const image = attr(meta.image || `${BASE_URL}/og-image.png`);
  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:type" content="${meta.type || 'website'}" />
    <meta property="og:site_name" content="Lumiva CRM" />
    <meta property="og:image" content="${image}" />${meta.image ? '' : `
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />`}
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${ogUrl}" />`.trim();
}

// Strip whatever static/default tags already live in the base index.html so
// prerendering stays idempotent regardless of what index.html itself contains.
function stripExistingSeoTags(html) {
  return html
    .replace(/<title>.*?<\/title>\s*/is, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
}

/* Статьи блога живут в CMS pl2 (lumiva-agency-backend) — мета и sitemap собираем из API на момент сборки.
 * Новая статья, опубликованная позже, открывается сразу (SPA), а её мета обновит scripts/prerender-blog.mjs. */
const BLOG_API = process.env.BLOG_API || 'http://127.0.0.1:3010/blog';
export async function loadBlogMeta() {
  try {
    const r = await fetch(`${BLOG_API}?site=crm&status=published&limit=200`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return (d.items || []).map((p) => ({
      route: '/blog/' + p.slug,
      meta: {
        title: `${p.seoTitle || p.title} — Lumiva CRM`,
        description: p.seoDescription || p.excerpt || '',
        image: p.coverUrl || undefined,
        type: 'article',
      },
      lastmod: (p.updatedAt || p.publishedAt || '').slice(0, 10),
    }));
  } catch (e) {
    console.warn('⚠ blog posts not loaded for prerender:', e.message);
    return null;
  }
}

const blogMeta = await loadBlogMeta();
for (const b of blogMeta || []) SEO_META[b.route] = b.meta;

const rawBaseHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');
const baseHtml = stripExistingSeoTags(rawBaseHtml);

let generated = 0;

for (const [route, meta] of Object.entries(SEO_META)) {
  const metaTags = buildMetaTags(route, meta);
  const html = baseHtml
    .replace('</head>', `  ${metaTags}\n  </head>`);

  if (route === '/') {
    writeFileSync(join(distDir, 'index.html'), html, 'utf-8');
  } else {
    const dir = join(distDir, route.slice(1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
  }

  generated++;
  console.log(`✓ ${route}`);
}

// sitemap: статьи блога из CMS вместо прежнего статичного списка
if (blogMeta) {
  const smPath = join(distDir, 'sitemap.xml');
  try {
    let sm = readFileSync(smPath, 'utf-8').replace(/\s*<url><loc>[^<]*\/blog\/[^<]+<\/loc>.*?<\/url>/g, '');
    const urls = blogMeta
      .map((b) => `  <url><loc>${BASE_URL}${b.route}</loc>${b.lastmod ? `<lastmod>${b.lastmod}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.5</priority></url>`)
      .join('\n');
    sm = sm.replace(/(<url><loc>[^<]*\/blog<\/loc>.*?<\/url>)/, `$1\n${urls}`);
    writeFileSync(smPath, sm, 'utf-8');
    console.log(`✓ sitemap.xml (${blogMeta.length} blog posts)`);
  } catch (e) {
    console.warn('⚠ sitemap not updated:', e.message);
  }
}

console.log(`\n✅ Prerender complete: ${generated} pages`);
