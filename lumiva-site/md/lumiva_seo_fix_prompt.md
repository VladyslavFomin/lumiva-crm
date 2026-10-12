# PROMPT ДЛЯ ИИ / VS CODE: исправление SEO-ошибок на lumiva.agency

## Контекст проекта

Сайт: `https://lumiva.agency/`

Сайт был перенесён со старой WordPress/WooCommerce-структуры на новую кастомную версию. Сейчас добавлены языковые версии, новые страницы услуг, один кейс и одна статья. В дальнейшем будут добавляться новые статьи и кейсы.

Текущая языковая логика должна быть такой:

```txt
/       → английская версия сайта, основной язык EN
/ru/    → русская версия сайта
/tr/    → турецкая версия сайта
```

Главная `/` на английском — это правильно. Исправлять её на русский не нужно.

Проблема: при SEO-проверке было замечено, что `/ru/` может редиректить на `/`. Это неправильно, потому что `/ru/` должна быть самостоятельной русской версией страницы. Нужно убрать такой редирект, если он есть, и настроить правильную мультиязычную SEO-структуру.

---

## Главная задача

Провести SEO-чистку сайта `lumiva.agency` после переезда с WordPress/WooCommerce и настройки языков.

Нужно:

1. Проверить и исправить маршруты языковых версий.
2. Убрать неправильный редирект `/ru/` → `/`, если он существует.
3. Настроить `canonical` и `hreflang`.
4. Убрать или редиректнуть старые WordPress/WooCommerce URL.
5. Исправить дубли страниц.
6. Проверить sitemap.xml.
7. Проверить robots.txt.
8. Убедиться, что блог, статьи и кейсы доступны в HTML и индексируемы.
9. Добавить базовую structured data разметку.

---

# 1. Языковая структура

## Ожидаемая структура

```txt
https://lumiva.agency/       → English
https://lumiva.agency/ru/    → Russian
https://lumiva.agency/tr/    → Turkish
```

## Что проверить

Проверить, что эти URL открываются без неправильных редиректов:

```txt
/
/ru/
/tr/
```

Ожидаемое поведение:

```txt
GET /      → 200 OK, English content
GET /ru/   → 200 OK, Russian content
GET /tr/   → 200 OK, Turkish content
```

Неправильное поведение:

```txt
/ru/ → 301/302 → /
/tr/ → 301/302 → /
```

Если такой редирект найден — убрать.

---

# 2. Canonical для языков

На каждой языковой версии должен быть self-referencing canonical.

## Для английской главной

```html
<link rel="canonical" href="https://lumiva.agency/" />
```

## Для русской главной

```html
<link rel="canonical" href="https://lumiva.agency/ru/" />
```

## Для турецкой главной

```html
<link rel="canonical" href="https://lumiva.agency/tr/" />
```

Важно: `/ru/` не должен иметь canonical на `/`, если это самостоятельная русская страница.

---

# 3. Hreflang

Добавить `hreflang` для всех языковых альтернатив.

## Для главной страницы

На `/`, `/ru/` и `/tr/` должны быть одинаковые alternate-ссылки:

```html
<link rel="alternate" hreflang="en" href="https://lumiva.agency/" />
<link rel="alternate" hreflang="ru" href="https://lumiva.agency/ru/" />
<link rel="alternate" hreflang="tr" href="https://lumiva.agency/tr/" />
<link rel="alternate" hreflang="x-default" href="https://lumiva.agency/" />
```

## Для страниц услуг

Если структура такая:

```txt
/services/seo/       → English
/ru/services/seo/    → Russian
/tr/services/seo/    → Turkish
```

то на каждой из этих страниц должны быть:

```html
<link rel="alternate" hreflang="en" href="https://lumiva.agency/services/seo/" />
<link rel="alternate" hreflang="ru" href="https://lumiva.agency/ru/services/seo/" />
<link rel="alternate" hreflang="tr" href="https://lumiva.agency/tr/services/seo/" />
<link rel="alternate" hreflang="x-default" href="https://lumiva.agency/services/seo/" />
```

Если конкретной языковой версии страницы пока нет, не добавлять `hreflang` на несуществующий URL.

---

# 4. Старые WordPress/WooCommerce URL

После переезда в индексе могут оставаться старые URL. Их нужно почистить.

Проверить наличие этих URL:

```txt
/category/blog/
/product-tag/crm/
/product/
/product-category/
/shop/
/cart/
/checkout/
/my-account/
/her-zaman-beklenenden-fazlasini-yapin/
/effektivnyj-marketing-s-n8n/
/marketing-budjet-gostinichnogo-biznesa/
/marketing-v-oteley-izuchite-ai/
```

## Рекомендованное поведение

### Старые категории блога

```txt
/category/blog/ → 301 → /blog/
```

Если блог теперь мультиязычный:

```txt
/category/blog/ → 301 → /ru/blog/
```

Выбрать тот вариант, который соответствует текущей структуре сайта.

### WooCommerce product/tag/category

Если WooCommerce больше не используется:

```txt
/product-tag/crm/       → 410 Gone или 301 → релевантная CRM/service-страница
/product/               → 410 Gone
/product-category/      → 410 Gone
/shop/                  → 410 Gone или 301 → /services/
/cart/                  → 410 Gone
/checkout/              → 410 Gone
/my-account/            → 410 Gone
```

Если есть страница про CRM, можно сделать так:

```txt
/product-tag/crm/ → 301 → /services/crm/
```

Но только если `/services/crm/` реально существует.

### Старые статьи

Если старые статьи нужны — перенести их в новую структуру блога и сделать 301.

Пример:

```txt
/effektivnyj-marketing-s-n8n/ → 301 → /ru/blog/effektivnyj-marketing-s-n8n/
```

Если статьи больше не нужны:

```txt
/effektivnyj-marketing-s-n8n/ → 410 Gone
```

Не оставлять старые статьи с новым title главной страницы. Это выглядит как техническая ошибка роутинга.

---

# 5. Дубли страниц

Проверить дубли e-commerce страницы:

```txt
/services/development/e-commerce/
/services/development/ecommerce/
```

Нужно выбрать один основной URL.

Рекомендую оставить:

```txt
/services/development/ecommerce/
```

И настроить:

```txt
/services/development/e-commerce/ → 301 → /services/development/ecommerce/
```

На основной странице поставить:

```html
<link rel="canonical" href="https://lumiva.agency/services/development/ecommerce/" />
```

Аналогично проверить другие возможные дубли:

```txt
/services/seo
/services/seo/
/ru/services/seo
/ru/services/seo/
/tr/services/seo
/tr/services/seo/
```

Рекомендация: использовать единый формат со slash на конце:

```txt
/services/seo/
/ru/services/seo/
/tr/services/seo/
```

Версии без slash должны делать 301 на версию со slash.

---

# 6. Sitemap.xml

Проверить `https://lumiva.agency/sitemap.xml`.

В sitemap должны быть только актуальные страницы.

Пример корректной структуры:

```txt
https://lumiva.agency/
https://lumiva.agency/ru/
https://lumiva.agency/tr/

https://lumiva.agency/services/
https://lumiva.agency/ru/services/
https://lumiva.agency/tr/services/

https://lumiva.agency/services/seo/
https://lumiva.agency/ru/services/seo/
https://lumiva.agency/tr/services/seo/

https://lumiva.agency/services/development/ecommerce/
https://lumiva.agency/ru/services/development/ecommerce/
https://lumiva.agency/tr/services/development/ecommerce/

https://lumiva.agency/blog/
https://lumiva.agency/ru/blog/
https://lumiva.agency/tr/blog/

https://lumiva.agency/cases/
https://lumiva.agency/ru/cases/
https://lumiva.agency/tr/cases/
```

Не должно быть старых URL:

```txt
/category/blog/
/product-tag/crm/
/product/
/shop/
/cart/
/checkout/
/my-account/
/wp-content/
/wp-admin/
```

Если какие-то языковые страницы ещё не готовы, не добавлять их в sitemap до готовности.

---

# 7. Robots.txt

Проверить `https://lumiva.agency/robots.txt`.

Рекомендуемый вариант:

```txt
User-agent: *
Allow: /

Disallow: /wp-admin/
Disallow: /wp-content/
Disallow: /wp-includes/
Disallow: /product/
Disallow: /product-tag/
Disallow: /product-category/
Disallow: /shop/
Disallow: /cart/
Disallow: /checkout/
Disallow: /my-account/
Disallow: /category/
Disallow: /*?s=
Disallow: /*?add-to-cart=

Sitemap: https://lumiva.agency/sitemap.xml
```

Важно: если URL уже в индексе, одного robots.txt недостаточно. Для удаления из индекса лучше использовать 301, 410 или noindex.

---

# 8. Блог, статьи и кейсы

Проверить, что `/blog/`, `/ru/blog/`, `/tr/blog/` не выглядят пустыми в HTML.

В HTML должны быть видны:

```txt
- название статьи
- краткое описание
- дата публикации
- категория
- ссылка на статью
```

Плохо, если поисковик видит только:

```txt
Loading...
```

или пустые категории:

```txt
Brand & Identity — 0
Performance & ROI — 0
```

Для статьи должна быть отдельная страница, например:

```txt
/blog/seo-traffic-crm-gap/
/ru/blog/seo-traffic-crm-gap/
/tr/blog/seo-traffic-crm-gap/
```

Для кейса должна быть отдельная страница, например:

```txt
/cases/case-name/
/ru/cases/case-name/
/tr/cases/case-name/
```

Каждая статья и каждый кейс должны иметь:

```txt
- уникальный title
- уникальный meta description
- H1
- canonical
- hreflang, если есть переводы
- open graph tags
- structured data
```

---

# 9. Meta title и description

Проверить, что у каждой страницы уникальные title и description.

## Главная EN

```html
<title>Lumiva Agency — Full-Service Marketing Agency in Antalya</title>
<meta name="description" content="Lumiva Agency is a full-service digital marketing agency based in Antalya. Strategy, branding, websites, SEO, performance marketing, analytics and CRM for business growth.">
```

## Главная RU

```html
<title>Lumiva Agency — маркетинговое агентство полного цикла в Анталии</title>
<meta name="description" content="Lumiva Agency — digital marketing agency в Анталии. Стратегия, брендинг, сайты, SEO, performance-реклама, аналитика и CRM для роста бизнеса.">
```

## Главная TR

```html
<title>Lumiva Agency — Antalya’da Full-Service Dijital Pazarlama Ajansı</title>
<meta name="description" content="Lumiva Agency; strateji, marka kimliği, web geliştirme, SEO, performans pazarlaması, analitik ve CRM çözümleri sunan full-service dijital pazarlama ajansıdır.">
```

---

# 10. Structured Data

Добавить базовую JSON-LD разметку.

## Organization

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Lumiva Agency",
  "url": "https://lumiva.agency/",
  "email": "hello@lumiva.agency",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Antalya",
    "addressCountry": "TR"
  }
}
</script>
```

## WebSite

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Lumiva Agency",
  "url": "https://lumiva.agency/"
}
</script>
```

## Service для страниц услуг

Пример для SEO:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "SEO and Organic Growth",
  "provider": {
    "@type": "Organization",
    "name": "Lumiva Agency"
  },
  "areaServed": ["Turkey", "Europe", "CIS"],
  "serviceType": "SEO"
}
</script>
```

## Article для статей

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {
    "@type": "Person",
    "name": "Vlad Fomin"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Lumiva Agency"
  },
  "mainEntityOfPage": "https://lumiva.agency/blog/article-url/"
}
</script>
```

## BreadcrumbList

Добавить breadcrumbs для страниц услуг, блога и кейсов.

---

# 11. Контакты и брендовая консистентность

Проверить email на всех страницах.

Сейчас могут встречаться разные варианты:

```txt
hello@lumiva.studio
hello@lumiva.agency
vlad@lumiva.agency
```

Рекомендованная логика:

```txt
Основной email: hello@lumiva.agency
Sales / personal contact: vlad@lumiva.agency
```

Если `hello@lumiva.studio` больше не используется — убрать его со всех страниц.

---

# 12. Финальная проверка после исправлений

После внесения правок проверить:

```txt
curl -I https://lumiva.agency/
curl -I https://lumiva.agency/ru/
curl -I https://lumiva.agency/tr/
curl -I https://lumiva.agency/category/blog/
curl -I https://lumiva.agency/product-tag/crm/
curl -I https://lumiva.agency/services/development/e-commerce/
curl -I https://lumiva.agency/services/development/ecommerce/
```

Ожидаемо:

```txt
/       → 200
/ru/    → 200
/tr/    → 200
/category/blog/ → 301 или 410
/product-tag/crm/ → 301 или 410
/services/development/e-commerce/ → 301
/services/development/ecommerce/ → 200
```

Также проверить HTML каждой важной страницы:

```txt
- title
- meta description
- canonical
- hreflang
- H1
- visible HTML content
- Open Graph
- JSON-LD
```

---

# 13. Не делать

Не нужно:

```txt
- редиректить /ru/ на /
- ставить canonical с /ru/ на /
- добавлять в sitemap старые WordPress/WooCommerce URL
- оставлять старые страницы с title от главной
- оставлять блог пустым для поисковика
- создавать языковые hreflang-ссылки на страницы, которых нет
- закрывать важные страницы в robots.txt
```

---

# 14. Результат, который нужно получить

После исправлений сайт должен работать так:

```txt
/       — английская главная, 200 OK, canonical на /
/ru/    — русская главная, 200 OK, canonical на /ru/
/tr/    — турецкая главная, 200 OK, canonical на /tr/
```

Старый мусор после WordPress/WooCommerce должен быть удалён из активной структуры через 301/410.

Sitemap должен содержать только актуальные страницы.

Robots.txt должен не блокировать важные страницы и должен указывать на sitemap.

Каждая страница должна иметь корректные meta, canonical, hreflang и базовую structured data.
