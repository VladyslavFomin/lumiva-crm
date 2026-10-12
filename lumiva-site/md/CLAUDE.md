# CLAUDE.md — SEO Remediation: lumiva.agency

> Этот файл — системный промт для Claude Code. Читай его перед любым действием.
> Задача: исправить критические SEO-проблемы сайта https://lumiva.agency

---

## Контекст проекта

**Сайт:** https://lumiva.agency  
**Тип:** Маркетинговое агентство / Lumiva Agency  
**Проблема:** Сайт полностью невидим в поиске Google. Органического трафика нет.  
**Причина №1:** Сайт — SPA (Single Page Application) без SSR. Google получает пустой HTML.  
**PageSpeed SEO:** 100/100 (технические теги есть, но загружаются через JS — боты их не видят)  
**Реальная SEO-видимость:** ~0 (сайт отсутствует в выдаче даже по собственному доменному имени)

### Что уже известно о стеке
- Есть Yandex.Metrica (счётчик 109183320) — значит JS-аналитика подключена
- Нет Google Analytics / GA4
- Рендеринг клиентский (JS SPA) — при curl/fetch без JS возвращается пустой HTML
- Lighthouse SEO = 100 → meta-теги технически присутствуют в JS
- Lighthouse Performance (mobile) = 57 → есть проблемы с производительностью
- "Ajan Tabanlı Tarama: 1/3" → одна из 3 агентных проверок провалена

**Перед началом работы: выясни стек командой ниже или изучи package.json**

```bash
cat package.json | head -60
ls -la src/ pages/ app/ 2>/dev/null || echo "structure unknown"
```

---

## ЗАДАЧА 1 — SSR / Static Rendering (КРИТИЧНО, делать первым)

**Проблема:** Поисковые боты получают пустой HTML без контента.  
**Решение:** Внедрить Server-Side Rendering или Static Site Generation.

### Если стек — Next.js (App Router или Pages Router)

Убедись, что страницы НЕ используют `"use client"` на уровне корневого layout без крайней необходимости.

```tsx
// ❌ ПЛОХО — вся страница клиентская, боты видят пустоту
"use client"
export default function HomePage() { ... }

// ✅ ХОРОШО — серверный компонент по умолчанию
export default function HomePage() { ... } // без "use client"

// ✅ Интерактивные части выносим в отдельный клиентский компонент
"use client"
export function ContactForm() { ... }
```

Для Next.js App Router добавь в каждую страницу экспорт metadata:

```tsx
// app/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lumiva Agency — Digital Marketing & CRM Analytics',
  description: 'Marketing agency specializing in hotel & hospitality digital marketing, CRM analytics, and B2C advertising. Based in Antalya, Turkey.',
  openGraph: {
    title: 'Lumiva Agency — Digital Marketing & CRM Analytics',
    description: 'Hotel marketing, CRM analytics, B2C advertising. Antalya, Turkey.',
    url: 'https://lumiva.agency',
    siteName: 'Lumiva Agency',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumiva Agency',
    description: 'Digital marketing for hotels. CRM analytics. Antalya.',
  },
  alternates: {
    canonical: 'https://lumiva.agency',
  },
}
```

### Если стек — Vite + React (без SSR)

Мигрировать на Next.js или добавить Prerender.io как быстрое решение.

Быстрое решение через react-snap (статическая пре-рендеризация):

```bash
npm install react-snap --save-dev
```

```json
// package.json
{
  "scripts": {
    "postbuild": "react-snap"
  },
  "reactSnap": {
    "source": "build",
    "minifyHtml": { "collapseWhitespace": false }
  }
}
```

### Если стек — Gatsby

Gatsby рендерит статику по умолчанию. Проверь:

```bash
gatsby build && gatsby serve
curl -s http://localhost:9000 | grep "<title>"
# Если title в ответе — SSR работает
```

### Проверка результата

После внедрения SSR/SSG проверь:

```bash
# Должен вернуть HTML с реальным контентом, а не пустой <div id="root">
curl -sL https://lumiva.agency | grep -E "<title>|<h1>|<meta name=\"description\""
```

---

## ЗАДАЧА 2 — Meta-теги и On-Page SEO

**Применять для каждой страницы сайта.**

### Главная страница (/)

```html
<title>Lumiva Agency — Digital Marketing for Hotels | Antalya, Turkey</title>
<meta name="description" content="Lumiva Agency — digital marketing and CRM analytics for hotel brands. B2C advertising, UTM analytics, and performance campaigns. Based in Antalya, Turkey.">
<link rel="canonical" href="https://lumiva.agency/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://lumiva.agency/">
<meta property="og:title" content="Lumiva Agency — Digital Marketing for Hotels">
<meta property="og:description" content="Marketing agency specializing in hotel digital marketing, CRM analytics, and B2C ad campaigns. Antalya, Turkey.">
<meta property="og:image" content="https://lumiva.agency/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Lumiva Agency — Digital Marketing for Hotels">
<meta name="twitter:description" content="Hotel marketing agency. CRM analytics. Performance ads. Antalya.">
```

### Структура H-тегов (обязательно для каждой страницы)

```html
<!-- Только один H1 на страницу -->
<h1>Digital Marketing Agency for Hotels</h1>

<!-- H2 — разделы страницы -->
<h2>Services</h2>
<h2>Case Studies</h2>
<h2>Contact Us</h2>

<!-- H3 — подразделы -->
<h3>B2C Advertising Campaigns</h3>
<h3>CRM Analytics & UTM Tracking</h3>
```

### Structured Data (Schema.org)

Добавь JSON-LD на главную страницу:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MarketingAgency",
  "name": "Lumiva Agency",
  "url": "https://lumiva.agency",
  "description": "Digital marketing agency specializing in hotel brands, CRM analytics, and B2C advertising.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Antalya",
    "addressCountry": "TR"
  },
  "sameAs": [
    "https://lumiva.crm"
  ],
  "serviceType": [
    "Digital Marketing",
    "CRM Analytics",
    "Hotel Marketing",
    "B2C Advertising"
  ]
}
</script>
```

---

## ЗАДАЧА 3 — sitemap.xml

Создать и разместить по адресу: `https://lumiva.agency/sitemap.xml`

### Для Next.js App Router (автоматически)

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://lumiva.agency',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://lumiva.agency/services',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://lumiva.agency/cases',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://lumiva.agency/about',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: 'https://lumiva.agency/contact',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    // Добавляй новые страницы сюда по мере создания
  ]
}
```

### Вручную (если Next.js не используется)

Создать файл `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://lumiva.agency/</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://lumiva.agency/services</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://lumiva.agency/cases</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://lumiva.agency/about</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://lumiva.agency/contact</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

---

## ЗАДАЧА 4 — robots.txt

Создать файл `public/robots.txt`:

```txt
User-agent: *
Allow: /

# Блокируем технические пути (добавь свои если есть)
Disallow: /api/
Disallow: /_next/
Disallow: /admin/

# Sitemap
Sitemap: https://lumiva.agency/sitemap.xml
```

Для Next.js App Router — автоматический вариант:

```ts
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: 'https://lumiva.agency/sitemap.xml',
  }
}
```

---

## ЗАДАЧА 5 — Google Analytics 4 и Search Console

### Установка GA4

```bash
npm install @next/third-parties
```

```tsx
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXXXXXXX" /> {/* Замени на свой ID */}
    </html>
  )
}
```

Или без библиотеки — через `<Script>` в `_document.tsx` / `layout.tsx`:

```tsx
import Script from 'next/script'

// Добавить в <head> или перед </body>
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  `}
</Script>
```

### Верификация для Google Search Console

Скачать HTML-файл верификации с Search Console и разместить в `public/`:

```bash
# Файл будет называться примерно так:
public/google1234567890abcdef.html
```

---

## ЗАДАЧА 6 — Производительность (Performance 57 → 85+)

PageSpeed показал 57 на мобильном. Это влияет на Core Web Vitals и ранжирование.

### Диагностика

```bash
# Запусти Lighthouse локально
npx lighthouse https://lumiva.agency --output=html --output-path=./lighthouse-report.html
open lighthouse-report.html
```

### Типичные причины низкого Performance и их исправление

**1. Неоптимизированные изображения**

```tsx
// ❌ ПЛОХО
<img src="/hero.jpg" />

// ✅ ХОРОШО — Next.js Image
import Image from 'next/image'
<Image
  src="/hero.jpg"
  alt="Lumiva Agency — hotel marketing"
  width={1200}
  height={600}
  priority // для hero-изображений above the fold
/>
```

**2. Неиспользуемый JavaScript (bundle splitting)**

```tsx
// ❌ ПЛОХО — всё в одном бандле
import HeavyComponent from './HeavyComponent'

// ✅ ХОРОШО — lazy loading
import dynamic from 'next/dynamic'
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
})
```

**3. Шрифты без оптимизации**

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap', // не блокирует рендеринг
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      {children}
    </html>
  )
}
```

**4. Preload критических ресурсов**

```html
<!-- В <head> -->
<link rel="preload" href="/hero.jpg" as="image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://mc.yandex.ru">
```

**5. Проверить Core Web Vitals**

Целевые показатели:
- LCP (Largest Contentful Paint): < 2.5s
- CLS (Cumulative Layout Shift): < 0.1
- FID / INP (Interaction to Next Paint): < 200ms

```bash
# Проверить в коде наличие layout shift
# Распространённая причина: изображения без width/height
# Все img/Image должны иметь явные размеры или aspect-ratio
```

---

## ЗАДАЧА 7 — Исправление "Ajan Tabanlı Tarama: 1/3"

Это агентная (headless browser) проверка от Google. Одна из трёх провалилась.

Типичные причины:
- Блокировка ботов через User-Agent
- Редирект для ботов (cloaking)
- Ошибки в robots.txt, блокирующие важные ресурсы

```bash
# Проверить как видит страницу Googlebot
curl -sL -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://lumiva.agency | grep -E "<title>|<h1>|<main>"

# Проверить как видит обычный браузер
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  https://lumiva.agency | grep -E "<title>|<h1>|<main>"

# Если ответы различаются — это cloaking, надо убрать
```

Проверить, что robots.txt не блокирует JS/CSS файлы:

```bash
curl -sL https://lumiva.agency/robots.txt
# Убедиться что нет: Disallow: /_next/ или Disallow: /static/
```

---

## ЗАДАЧА 8 — Контентная SEO-стратегия (после технических задач)

После того как сайт начнёт индексироваться, нужен контент для привлечения органики.

### Целевые кластеры ключевых слов

**Кластер 1 — Hotel Marketing (EN)**
- `hotel digital marketing agency Turkey`
- `B2C hotel advertising Antalya`
- `hotel marketing analytics`
- `hospitality CRM marketing`

**Кластер 2 — CRM / Analytics (RU)**
- `CRM аналитика для отелей`
- `UTM разметка туристический бизнес`
- `сквозная аналитика отели`
- `маркетинг для отельного бизнеса`

**Кластер 3 — Brand (EN/TR)**
- `Lumiva Agency Antalya`
- `Lumiva Agency digital marketing`
- `lumiva.agency отзывы`

### Страницы, которые нужно создать

```
/services                    — Описание услуг с ключевыми словами
/services/hotel-marketing    — Лендинг под отельный маркетинг
/services/crm-analytics      — Лендинг под CRM и аналитику
/cases                       — Кейсы (с реальными метриками)
/cases/atg-hotels            — Кейс ATG Hotels (если можно публично)
/blog                        — SEO-статьи (см. ниже)
/about                       — О компании + E-E-A-T сигналы
/contact                     — Контакты + структурированные данные
```

### Минимальный план блога (6 статей для старта)

```
1. "UTM-разметка для отелей: полный гайд 2026"           → /blog/utm-hotel-marketing
2. "CRM-аналитика в гостиничном бизнесе: с чего начать"  → /blog/crm-hotel-analytics
3. "Как настроить B2C рекламу для отеля в Google Ads"     → /blog/google-ads-hotel
4. "Customer Journey Map для гостиничного бизнеса"        → /blog/customer-journey-hotel
5. "Digital marketing agency in Antalya: what to look for"→ /blog/digital-agency-antalya
6. "EUR/TRY в рекламных бюджетах: управление валютным риском" → /blog/eur-try-ad-budgets
```

---

## ЗАДАЧА 9 — Внешние упоминания и бэклинки

Это нужно делать вручную параллельно с техническими задачами.

### Каталоги для регистрации (приоритет)

```
1. clutch.co           — Создать профиль агентства (важнейший для B2B)
2. sortlist.com        — Добавить в Antalya + Turkey listings
3. vc.ru               — Написать экспертную статью со ссылкой
4. techbehemoths.com   — Добавить в Digital Marketing / Antalya
5. marketing-tech.ru   — Каталог агентств (русскоязычный рынок)
6. Google Business     — Создать карточку (maps.google.com/business)
```

### Минимальный профиль для каталогов

```
Name: Lumiva Agency
URL: https://lumiva.agency
Category: Digital Marketing Agency / Hotel Marketing / CRM Analytics
Location: Antalya, Turkey
Description: Digital marketing agency specializing in hotel and hospitality brands. 
             Services: B2C advertising, CRM analytics, UTM tracking, performance campaigns.
             Clients: hotel chains in Turkey (ATG Hotels group).
Founded: [год]
Team size: [кол-во]
```

---

## Порядок выполнения задач

```
НЕДЕЛЯ 1 (критично):
  [ ] Задача 1 — SSR/SSG (без этого остальное бессмысленно)
  [ ] Задача 2 — Meta-теги и Schema.org
  [ ] Задача 3 — sitemap.xml
  [ ] Задача 4 — robots.txt

НЕДЕЛЯ 2 (важно):
  [ ] Задача 5 — GA4 + Search Console + сабмит sitemap
  [ ] Задача 6 — Core Web Vitals / Performance
  [ ] Задача 7 — Агентная проверка (1/3 ошибка)

МЕСЯЦ 2 (рост):
  [ ] Задача 8 — Создание страниц услуг и кейсов
  [ ] Задача 8 — Первые 2-3 статьи блога
  [ ] Задача 9 — Регистрация в Clutch и Sortlist

МЕСЯЦ 3+ (масштаб):
  [ ] Задача 8 — Полный контент-план блога
  [ ] Задача 9 — Все каталоги + PR-упоминания
  [ ] Мониторинг позиций через Search Console
```

---

## Команды для проверки прогресса

```bash
# 1. Проверить рендеринг (должен вернуть контент, не пустой div)
curl -sL https://lumiva.agency | grep -c "<p\|<h1\|<h2\|<article"

# 2. Проверить sitemap
curl -sL https://lumiva.agency/sitemap.xml | grep "<loc>"

# 3. Проверить robots.txt
curl -sL https://lumiva.agency/robots.txt

# 4. Проверить meta-теги
curl -sL https://lumiva.agency | grep -E 'name="description"|property="og:'

# 5. Lighthouse CLI (установить глобально)
npm install -g lighthouse
lighthouse https://lumiva.agency --only-categories=seo,performance --output=json \
  | jq '.categories | {seo: .seo.score, performance: .performance.score}'

# 6. Проверить индексацию (через браузер)
# Открыть: https://www.google.com/search?q=site:lumiva.agency
# Если 0 результатов — сайт ещё не проиндексирован
```

---

## Что НЕ нужно делать

- ❌ Не трогай Yandex.Metrica — она работает, пусть остаётся
- ❌ Не добавляй `noindex` на любые публичные страницы
- ❌ Не блокируй в robots.txt файлы JS/CSS/изображений
- ❌ Не дублируй контент на нескольких URL без canonical
- ❌ Не используй один и тот же title/description на разных страницах
- ❌ Не делай редиректы для Googlebot отличные от редиректов для пользователей (cloaking)

---

## Целевые метрики (через 3 месяца после исправлений)

| Метрика | Сейчас | Цель |
|---|---|---|
| Позиций в Google | 0 | 50+ |
| Проиндексировано страниц | 0 | 10+ |
| PageSpeed Performance (mobile) | 57 | 80+ |
| PageSpeed SEO | 100 | 100 |
| Органический трафик/мес | ~0 | 200+ |
| Backlinks (домены) | ~0 | 10+ |
| Google Search Console — клики/мес | 0 | 50+ |
