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
  '/terms': {
    title: 'Условия использования — Lumiva CRM',
    description: 'Условия предоставления услуг платформы Lumiva CRM.',
  },
  '/changelog': {
    title: 'Список изменений — Lumiva CRM',
    description: 'История обновлений и новых функций платформы.',
  },
  '/integrations': {
    title: 'Интеграции — Lumiva CRM',
    description: 'Подключите Lumiva CRM к сервисам: Telegram, WhatsApp, Google Sheets и другим.',
  },
};

const BASE_URL = process.env.VITE_APP_URL || 'https://lumiva.agency';

function buildMetaTags(route, meta) {
  const ogUrl = `${BASE_URL}${route === '/' ? '' : route}`;
  return `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Lumiva CRM" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <link rel="canonical" href="${ogUrl}" />`.trim();
}

const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

let generated = 0;

for (const [route, meta] of Object.entries(SEO_META)) {
  const metaTags = buildMetaTags(route, meta);
  const html = baseHtml
    .replace(/<title>.*?<\/title>/s, '')
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

console.log(`\n✅ Prerender complete: ${generated} pages`);
