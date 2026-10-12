# ТЗ / промт для ИИ в VS Code: SEO-аудит и доработка сайта Lumiva Agency

## Контекст проекта

Сайт: `https://lumiva.agency`

Сайт больше **не работает на WordPress/CMS**. Ранее сайт был на WordPress, но сейчас он перенесён на кастомную/статическую кодовую базу, которая редактируется через VS Code.

Нужно проверить кодовую базу проекта и внести недостающие SEO-доработки для корректной индексации, чистой структуры, устранения следов старого WordPress и улучшения коммерческого SEO.

Основная задача: привести сайт к состоянию, в котором Google/Yandex корректно индексируют актуальную версию сайта, без старых дублей, языковых конфликтов, битых ссылок и устаревших WordPress-следов.

---

## Главные цели

1. Проверить весь проект на SEO-ошибки.
2. Убедиться, что сайт полностью работает как кастомный/статический сайт, без зависимости от старого WordPress.
3. Удалить или корректно обработать старые WordPress-URL, категории, архивы, лишние страницы и дубли.
4. Настроить `robots.txt`, `sitemap.xml`, `canonical`, `hreflang`, meta title/description.
5. Проверить структуру страниц услуг, кейсов, блога и контактов.
6. Улучшить SEO-семантику для digital agency / marketing agency / web development / SEO / analytics / CRM / hotel marketing.
7. Добавить недостающую микроразметку Schema.org.
8. Проверить техническую готовность сайта к индексации.

---

## Важно учитывать

Проект НЕ на WordPress.

Не использовать решения вида:

- Yoast SEO
- Rank Math
- WordPress sitemap
- WordPress plugins
- WP REST
- wp-admin
- wp-json
- WordPress theme files

Все SEO-правки должны быть реализованы напрямую в коде проекта.

Если проект использует React/Vite/Next/Nuxt/Astro или другой стек — адаптировать реализацию под текущую архитектуру проекта.

---

## Что нужно проверить в первую очередь

### 1. Проверить структуру проекта

Найти:

- где находятся страницы;
- как реализован роутинг;
- где задаются meta title / description;
- есть ли шаблон layout/head;
- есть ли файл генерации sitemap;
- есть ли публичная папка `public/`;
- есть ли `robots.txt`;
- есть ли `sitemap.xml`;
- есть ли fallback/404;
- есть ли старые WordPress-страницы или редиректы.

Если проект статический, проверить папки типа:

```txt
/public
/src
/pages
/routes
/app
/components
/layouts
/dist
```

Если проект на Vite/React, проверить:

```txt
index.html
src/main.jsx или src/main.tsx
src/App.jsx или src/App.tsx
src/router
src/pages
public/robots.txt
public/sitemap.xml
```

Если проект на Next.js, проверить:

```txt
app/layout.tsx
app/page.tsx
app/sitemap.ts
app/robots.ts
pages/_document.tsx
pages/_app.tsx
next.config.js
```

---

## 2. Убрать следы старого WordPress

Проверить, существуют ли или индексируются ли старые URL:

```txt
/category/blog/
/tag/*
/author/*
/wp-content/*
/wp-json/*
/wp-admin/*
/?p=*
/?page_id=*
/feed/
/comments/feed/
```

Если такие маршруты есть в коде, удалить их или закрыть от индексации.

Если старые URL уже есть в поисковой выдаче, сделать 301 redirect на актуальные страницы.

Примеры:

```txt
/category/blog/        -> /blog/
/tag/seo/              -> /blog/
/author/admin/         -> /blog/
/feed/                 -> /blog/
```

Если в проекте есть конфигурация сервера, добавить редиректы на уровне nginx/hosting/router.

Если редиректы на уровне кода — реализовать через текущий роутер проекта.

---

## 3. Проверить и создать robots.txt

В корне публичной раздачи должен быть файл:

```txt
/robots.txt
```

Рекомендуемое содержимое:

```txt
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /private/
Disallow: /api/
Disallow: /dev/
Disallow: /test/
Disallow: /drafts/

Sitemap: https://lumiva.agency/sitemap.xml
```

Если каких-то директорий нет — не добавлять лишнее.

Если сайт полностью публичный и нет закрытых зон, можно оставить:

```txt
User-agent: *
Allow: /

Sitemap: https://lumiva.agency/sitemap.xml
```

Проверить, что файл открывается по адресу:

```txt
https://lumiva.agency/robots.txt
```

---

## 4. Проверить и создать sitemap.xml

Должен быть доступен файл:

```txt
https://lumiva.agency/sitemap.xml
```

В sitemap должны быть только актуальные публичные страницы.

Минимальный список страниц:

```txt
/
/services/
/services/design/
/services/development/
/services/development/corporate-sites/
/services/analytics/
/services/seo/
/services/performance/
/services/smm/
/services/crm/
/cases/
/blog/
/about/
/team/
/contacts/
/faq/
```

Если каких-то страниц в проекте нет — либо создать, либо не включать в sitemap.

Не добавлять в sitemap:

```txt
404
admin
api
private
dev
test
old WordPress pages
category pages без контента
страницы-дубли
```

Пример sitemap:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://lumiva.agency/</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://lumiva.agency/services/</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

Если проект позволяет автогенерацию sitemap — лучше сделать генератор на основе массива маршрутов, чтобы sitemap обновлялся автоматически.

---

## 5. Canonical URL

На каждой публичной странице должен быть canonical.

Примеры:

```html
<link rel="canonical" href="https://lumiva.agency/" />
<link rel="canonical" href="https://lumiva.agency/services/" />
<link rel="canonical" href="https://lumiva.agency/services/development/" />
```

Правила:

- canonical должен указывать на актуальный чистый URL;
- не должен содержать `utm_source`, `utm_medium`, `fbclid`, `gclid`;
- не должен указывать на старую WP-версию;
- не должен быть одинаковым на всех страницах;
- не должен указывать на localhost/dev.

---

## 6. Hreflang и языковые версии

Проверить текущую языковую стратегию сайта.

Если сайт только на русском — не добавлять лишние языковые версии.

Если есть русская, английская и турецкая версии, использовать структуру:

```txt
/       — основная версия, например RU
/en/    — English
/tr/    — Türkçe
```

И добавить hreflang:

```html
<link rel="alternate" hreflang="ru" href="https://lumiva.agency/" />
<link rel="alternate" hreflang="en" href="https://lumiva.agency/en/" />
<link rel="alternate" hreflang="tr" href="https://lumiva.agency/tr/" />
<link rel="alternate" hreflang="x-default" href="https://lumiva.agency/" />
```

Важно:

- не смешивать языки на одной странице без необходимости;
- не оставлять старые турецкие WP-блоки внутри русской версии;
- проверить меню, футер, CTA, формы и meta-теги на одном языке.

---

## 7. Meta title и description

Проверить все страницы.

Каждая страница должна иметь уникальные:

```html
<title>...</title>
<meta name="description" content="..." />
```

### Рекомендуемые meta для основных страниц

#### Главная

```txt
Title:
Lumiva Agency — digital marketing agency в Анталии для бизнеса и отелей

Description:
Lumiva Agency помогает бизнесу и отелям расти через стратегию, брендинг, разработку сайтов, SEO, performance-маркетинг, CRM и аналитику.
```

#### Услуги

```txt
Title:
Услуги digital marketing agency — стратегия, сайты, SEO, CRM и аналитика | Lumiva

Description:
Комплексные digital-услуги для бизнеса: маркетинговая стратегия, разработка сайтов, SEO, performance-реклама, SMM, CRM, аналитика и дизайн.
```

#### Разработка сайтов

```txt
Title:
Разработка сайтов для бизнеса и отелей | Lumiva Agency

Description:
Создаём быстрые, современные и SEO-готовые сайты для бизнеса, отелей и сервисных компаний: UX, дизайн, фронтенд, интеграции, аналитика и поддержка.
```

#### SEO

```txt
Title:
SEO-продвижение сайтов для бизнеса и отелей | Lumiva Agency

Description:
Технический SEO-аудит, семантика, структура сайта, контент, внутренняя оптимизация и рост органического трафика для бизнеса и отелей.
```

#### Analytics

```txt
Title:
Аналитика и дашборды для маркетинга и продаж | Lumiva Agency

Description:
Настраиваем аналитику, Looker Studio, отчёты, сквозную аналитику, UTM-структуру и dashboards для контроля рекламы, продаж и заявок.
```

#### CRM

```txt
Title:
CRM для отдела продаж и маркетинга | Lumiva Agency

Description:
Проектируем и внедряем CRM-решения для лидов, заявок, продаж, задач, коммуникаций, аналитики и автоматизации бизнес-процессов.
```

#### Контакты

```txt
Title:
Контакты Lumiva Agency — digital marketing agency in Antalya

Description:
Свяжитесь с Lumiva Agency для обсуждения сайта, SEO, рекламы, CRM, аналитики, дизайна или комплексного маркетинга для вашего бизнеса.
```

---

## 8. H1-H6 структура

Проверить каждую страницу.

Правила:

- на каждой странице должен быть один основной H1;
- H1 должен соответствовать теме страницы;
- H2 должны раскрывать основные разделы;
- не использовать H1 в логотипе, карточках или повторяющихся блоках;
- не делать заголовки только ради дизайна, если нарушается семантика.

Пример для главной:

```html
<h1>Digital marketing agency для бизнеса и отелей</h1>
```

Можно использовать брендовый текст рядом:

```txt
Маркетинг, который работает на выручку.
```

Но для SEO желательно иметь более прямое описание деятельности.

---

## 9. Open Graph и Twitter Cards

Добавить на все важные страницы:

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:url" content="https://lumiva.agency/..." />
<meta property="og:image" content="https://lumiva.agency/og-image.jpg" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="https://lumiva.agency/og-image.jpg" />
```

Проверить, что `og-image.jpg` существует, оптимизирован и не слишком тяжёлый.

---

## 10. Schema.org микроразметка

Добавить JSON-LD.

### Organization

На главной:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Lumiva Agency",
  "url": "https://lumiva.agency/",
  "logo": "https://lumiva.agency/logo.png",
  "email": "hello@lumiva.agency",
  "sameAs": []
}
</script>
```

### LocalBusiness / ProfessionalService

Если есть физическая привязка к Анталии:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Lumiva Agency",
  "url": "https://lumiva.agency/",
  "areaServed": ["Turkey", "Antalya", "Europe"],
  "serviceType": [
    "Digital Marketing",
    "Web Development",
    "SEO",
    "Performance Marketing",
    "CRM Implementation",
    "Marketing Analytics"
  ]
}
</script>
```

### Service

На страницах услуг добавить Service schema.

Пример для SEO:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "SEO-продвижение сайтов",
  "provider": {
    "@type": "Organization",
    "name": "Lumiva Agency",
    "url": "https://lumiva.agency/"
  },
  "areaServed": "Turkey",
  "serviceType": "SEO"
}
</script>
```

### FAQPage

Если на странице есть FAQ, добавить FAQPage schema.

---

## 11. Структура услуг

Проверить, есть ли отдельные страницы под каждое направление.

Желательная структура:

```txt
/services/
/services/seo/
/services/performance/
/services/smm/
/services/design/
/services/development/
/services/development/corporate-sites/
/services/development/hotel-website/
/services/analytics/
/services/crm/
/services/branding/
/services/content-production/
/services/hotel-marketing/
```

Если страниц нет — создать или подготовить структуру.

Каждая страница услуги должна иметь:

- уникальный H1;
- title;
- description;
- понятный первый экран;
- кому подходит услуга;
- что входит;
- процесс работы;
- результаты/метрики;
- кейсы или примеры;
- FAQ;
- CTA;
- внутренние ссылки на смежные услуги.

---

## 12. Коммерческая SEO-семантика

Добавить аккуратно в тексты следующие направления, без переспама:

```txt
digital marketing agency
marketing agency in Antalya
digital agency in Turkey
web development agency
разработка сайтов для бизнеса
разработка сайтов для отелей
SEO-продвижение сайтов
SEO для отелей
performance marketing
Google Ads agency
SMM для бизнеса
CRM для отдела продаж
маркетинговая аналитика
Looker Studio dashboards
брендинг для бизнеса
hotel marketing agency
маркетинг для отелей
```

Не вставлять ключи механически. Вписать естественно в заголовки, описания, FAQ и блоки услуг.

---

## 13. Блог

Проверить, работает ли `/blog/`.

Если блог пустой или показывает `Загрузка...`, исправить.

Если статей нет, не показывать пустые категории с нулём материалов как SEO-страницы.

Минимально создать структуру:

```txt
/blog/
/blog/seo/
/blog/web-development/
/blog/hotel-marketing/
/blog/crm/
/blog/analytics/
```

Первые темы для статей:

```txt
Как выбрать маркетинговое агентство для отеля
SEO для отелей: что влияет на прямые бронирования
Сколько стоит разработка сайта для бизнеса в 2026 году
Что такое сквозная аналитика простыми словами
Как CRM помогает отделу продаж не терять лиды
Google Ads или SEO: что выбрать бизнесу
Как отелю получать заявки из Instagram и Google
Как построить digital-стратегию для отеля
```

Каждая статья должна иметь:

- slug;
- title;
- description;
- H1;
- дату публикации;
- автора или бренд;
- Article schema;
- хлебные крошки;
- внутренние ссылки на услуги;
- CTA в конце.

---

## 14. URL-структура

Проверить все URL.

Правила:

- использовать lowercase;
- использовать дефисы, не подчёркивания;
- не использовать query-параметры для постоянных страниц;
- не дублировать страницы со slash и без slash;
- выбрать один формат: лучше trailing slash `/services/` или без slash `/services`, и везде соблюдать его;
- настроить 301 redirect со второго варианта на основной.

Пример чистой структуры:

```txt
https://lumiva.agency/services/seo/
https://lumiva.agency/services/development/
https://lumiva.agency/blog/seo-for-hotels/
```

---

## 15. 404 страница

Проверить, есть ли кастомная 404.

Она должна:

- возвращать HTTP status 404;
- иметь понятный текст;
- давать ссылки на главную, услуги, кейсы, контакты;
- не индексироваться.

Добавить:

```html
<meta name="robots" content="noindex, follow" />
```

---

## 16. Производительность и Core Web Vitals

Проверить:

- размер JS bundle;
- lazy loading изображений;
- оптимизацию изображений;
- WebP/AVIF;
- preload главных шрифтов;
- отсутствие тяжёлых неиспользуемых библиотек;
- CLS из-за изображений без width/height;
- LCP на главной;
- mobile performance.

Для изображений:

```html
<img src="..." alt="..." loading="lazy" width="..." height="..." />
```

Для главного hero-изображения не использовать lazy loading, если оно влияет на LCP.

---

## 17. Alt у изображений

Проверить все изображения.

Правила:

- декоративные изображения могут иметь `alt=""`;
- важные изображения должны иметь описательный alt;
- не писать ключевые слова спамом;
- логотип должен иметь alt вроде `Lumiva Agency`.

Примеры:

```html
<img src="/images/lumiva-dashboard.webp" alt="Маркетинговый дашборд Lumiva для аналитики заявок" />
<img src="/images/hotel-website-case.webp" alt="Кейс разработки сайта для отельного бренда" />
```

---

## 18. Контакты и доверие

Проверить единообразие контактов.

Важно выбрать один основной email:

```txt
hello@lumiva.agency
```

Если используется другой email, например `hello@lumiva.studio`, выбрать один основной и заменить по всему сайту.

Проверить:

- email;
- телефон;
- адрес/город;
- ссылки на соцсети;
- формы заявки;
- CTA-кнопки;
- footer;
- structured data.

---

## 19. Внутренняя перелинковка

Добавить ссылки между связанными страницами.

Примеры:

Со страницы разработки сайтов ссылаться на:

```txt
SEO
Analytics
CRM
Cases
Contacts
```

Со страницы SEO ссылаться на:

```txt
Development
Analytics
Content
Hotel Marketing
```

Со страницы CRM ссылаться на:

```txt
Analytics
Sales automation
Web integrations
```

Добавить хлебные крошки:

```txt
Главная → Услуги → SEO
Главная → Услуги → Разработка сайтов
Главная → Блог → SEO для отелей
```

И BreadcrumbList schema.

---

## 20. Проверить индексацию технических страниц

Закрыть от индексации:

```txt
/admin
/api
/login
/private
/dev
/test
/drafts
/preview
```

Если эти страницы есть, добавить:

```html
<meta name="robots" content="noindex, nofollow" />
```

И/или закрыть в robots.txt, если это действительно технические зоны.

---

## 21. Проверить сборку и деплой

После всех правок:

1. Запустить локальную сборку.
2. Проверить отсутствие ошибок линтера/TypeScript, если используется.
3. Проверить, что sitemap и robots попадают в финальный build/dist.
4. Проверить, что старые URL корректно редиректятся или отдают 404.
5. Проверить, что canonical не ведёт на localhost.
6. Проверить, что все внутренние ссылки рабочие.
7. Проверить мобильную версию.

---

## 22. Финальный чек-лист готовности

Перед завершением задачи проверить:

- [ ] `/robots.txt` открывается.
- [ ] `/sitemap.xml` открывается.
- [ ] В sitemap только актуальные страницы.
- [ ] На каждой странице есть уникальный title.
- [ ] На каждой странице есть unique meta description.
- [ ] На каждой странице есть canonical.
- [ ] Нет canonical на localhost/dev.
- [ ] Нет старых WordPress-ссылок в меню и футере.
- [ ] Старые WP URL редиректятся или отдают корректный 404.
- [ ] Нет пустых страниц блога с `Загрузка...`.
- [ ] Нет смешения русского, турецкого и английского внутри одной языковой версии.
- [ ] Контакты единообразны по всему сайту.
- [ ] Есть Organization schema.
- [ ] Есть Service schema на страницах услуг.
- [ ] Есть FAQPage schema там, где есть FAQ.
- [ ] Есть BreadcrumbList schema.
- [ ] Изображения имеют alt.
- [ ] Большие изображения оптимизированы.
- [ ] 404 страница работает и отдаёт HTTP 404.
- [ ] Все CTA и формы работают.
- [ ] Внутренние ссылки не битые.
- [ ] Сайт корректно работает на мобильных.

---

## 23. Что не делать

Не делать:

- не возвращать сайт на WordPress;
- не предлагать плагины WordPress;
- не создавать дубли страниц ради SEO;
- не набивать тексты ключевыми словами;
- не закрывать весь сайт от индексации;
- не добавлять noindex на важные страницы;
- не оставлять старые WP URL в sitemap;
- не использовать lorem ipsum;
- не менять дизайн без необходимости;
- не ломать текущую визуальную систему Lumiva.

---

## 24. Формат результата от ИИ

После проверки и правок предоставить отчёт:

```txt
1. Что было найдено
2. Какие файлы изменены
3. Какие SEO-проблемы исправлены
4. Какие страницы добавлены/обновлены
5. Какие редиректы настроены
6. Какие meta-теги добавлены
7. Какие schema-разметки добавлены
8. Что осталось сделать вручную
9. Команды для проверки/сборки/деплоя
```

---

## 25. Приоритет выполнения

### Высокий приоритет

1. robots.txt
2. sitemap.xml
3. canonical
4. title/description
5. чистка старых WordPress URL
6. 404
7. единые контакты
8. исправление пустого блога

### Средний приоритет

1. schema.org
2. hreflang, если есть языковые версии
3. внутренняя перелинковка
4. alt изображений
5. Open Graph

### Низкий приоритет

1. новые блог-статьи
2. дополнительные SEO-посадочные
3. расширенные кейсы
4. локальное SEO под Antalya/Turkey

---

## 26. Главная рекомендация

Главная задача сейчас — не просто добавить SEO-теги, а привести сайт к чистой актуальной структуре после переезда с WordPress.

Самое важное:

- убрать старые WordPress-дубли;
- сделать корректную индексацию;
- настроить sitemap/robots/canonical;
- проверить языковые версии;
- усилить страницы услуг коммерческими SEO-формулировками;
- не ломать текущий дизайн.
