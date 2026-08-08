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
    description: 'Шифрование, изоляция тенантов, RBAC и защита приложения — на уровне инфраструктуры и кода.',
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
  '/integrations': {
    title: 'Интеграции — Lumiva CRM',
    description: 'Подключите Lumiva CRM к сервисам: Telegram, WhatsApp, Google Sheets и другим.',
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
  '/blog/deal-cycle-optimization': {
    title: 'Как сократить цикл сделки без потери маржинальности — Lumiva CRM',
    description: 'Методика приоритизации лидов, контроль касаний и внедрение SLA для менеджеров.',
  },
  '/blog/utm-architecture': {
    title: 'UTM-архитектура для прозрачной аналитики CRM — Lumiva CRM',
    description: 'Практика построения структуры меток и отчётов для маркетинга и отдела продаж.',
  },
  '/blog/crm-adoption': {
    title: 'Как внедрять CRM, чтобы команда реально работала в системе — Lumiva CRM',
    description: 'Подход к запуску, регламентам и адаптации сотрудников без сопротивления. Чек-лист из 12 пунктов.',
  },
  '/blog/automation-triggers': {
    title: 'Триггерные автоматизации: 8 сценариев для отдела продаж — Lumiva CRM',
    description: 'Как настроить автоматические задачи, уведомления и статусы без программирования.',
  },
  '/blog/integrations-guide': {
    title: 'Руководство по интеграциям: от Telegram до 1С — Lumiva CRM',
    description: 'Как выбрать нужные интеграции, настроить синхронизацию и избежать дублирования данных.',
  },
  '/blog/analytics-dashboards': {
    title: 'Дашборды для руководителя: что смотреть каждый день — Lumiva CRM',
    description: 'Набор метрик, которые дают реальную картину здоровья бизнеса. Как настроить CRM-аналитику за 30 минут.',
  },
};

const BASE_URL = process.env.VITE_APP_URL || 'https://crm.lumiva.agency';

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

console.log(`\n✅ Prerender complete: ${generated} pages`);
