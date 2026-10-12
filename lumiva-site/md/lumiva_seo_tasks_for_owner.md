# Что нужно сделать вручную после SEO-чистки lumiva.agency

Этот файл — список действий для владельца сайта после того, как ИИ/разработчик внесёт технические правки в код.

Сайт: `https://lumiva.agency/`

Текущая правильная языковая структура:

```txt
/       → English
/ru/    → Russian
/tr/    → Turkish
```

Главная `/` должна оставаться на английском. Это правильно.

---

# 1. Проверить языковые страницы в браузере

Открой вручную:

```txt
https://lumiva.agency/
https://lumiva.agency/ru/
https://lumiva.agency/tr/
```

Проверь:

```txt
/       открывает английский сайт
/ru/    открывает русский сайт
/tr/    открывает турецкий сайт
```

Важно: `/ru/` не должен перекидывать на `/`.

Если `/ru/` редиректит на `/`, значит ошибку ещё не исправили.

---

# 2. Проверить старые мусорные URL

Открой эти адреса:

```txt
https://lumiva.agency/category/blog/
https://lumiva.agency/product-tag/crm/
https://lumiva.agency/product/
https://lumiva.agency/shop/
https://lumiva.agency/cart/
https://lumiva.agency/checkout/
https://lumiva.agency/my-account/
https://lumiva.agency/her-zaman-beklenenden-fazlasini-yapin/
```

Они не должны открываться как нормальные страницы сайта.

Правильные варианты:

```txt
301 редирект на новую релевантную страницу
или
410 Gone
или
404, если страница точно удалена
```

Лучше всего:

```txt
/category/blog/ → /blog/ или /ru/blog/
/product-tag/crm/ → /services/crm/ если такая страница есть
/product/, /shop/, /cart/, /checkout/, /my-account/ → 410 Gone
```

---

# 3. Проверить дубль e-commerce страницы

Открой:

```txt
https://lumiva.agency/services/development/e-commerce/
https://lumiva.agency/services/development/ecommerce/
```

Нужно, чтобы основная страница была одна.

Рекомендованный основной URL:

```txt
https://lumiva.agency/services/development/ecommerce/
```

Второй URL должен редиректить:

```txt
/services/development/e-commerce/ → 301 → /services/development/ecommerce/
```

---

# 4. Проверить sitemap.xml

Открой:

```txt
https://lumiva.agency/sitemap.xml
```

В sitemap должны быть только актуальные страницы.

Должны быть:

```txt
/
/ru/
/tr/
/services/
/ru/services/
/tr/services/
/blog/
/ru/blog/
/tr/blog/
/cases/
/ru/cases/
/tr/cases/
```

Если конкретных языковых страниц пока нет, они не должны быть в sitemap.

Не должно быть:

```txt
/category/blog/
/product-tag/crm/
/product/
/shop/
/cart/
/checkout/
/my-account/
/wp-admin/
/wp-content/
```

---

# 5. Проверить robots.txt

Открой:

```txt
https://lumiva.agency/robots.txt
```

Внизу должна быть строка:

```txt
Sitemap: https://lumiva.agency/sitemap.xml
```

Robots.txt не должен блокировать важные страницы:

```txt
/
/ru/
/tr/
/services/
/blog/
/cases/
```

Можно закрывать старые технические URL:

```txt
/product/
/product-tag/
/product-category/
/shop/
/cart/
/checkout/
/my-account/
/category/
```

---

# 6. Проверить блог

Открой:

```txt
https://lumiva.agency/blog/
https://lumiva.agency/ru/blog/
https://lumiva.agency/tr/blog/
```

Проверь, что в блоге видны:

```txt
- название статьи
- краткое описание
- дата
- категория
- ссылка на статью
```

Плохо, если блог показывает только:

```txt
Loading...
```

или все категории по 0.

Если статья одна — это нормально, но она должна быть видна поисковику и пользователю.

---

# 7. Проверить статью

Открой новую статью во всех языках, если переводы уже есть.

Проверь:

```txt
- страница открывается
- есть нормальный H1
- есть текст статьи
- title отличается от главной
- description относится именно к статье
- есть дата публикации
- есть автор или бренд
```

Если перевода статьи пока нет, лучше не делать пустую языковую страницу.

---

# 8. Проверить кейс

Открой страницу кейса.

Проверь, что там есть:

```txt
- название кейса
- задача
- что сделали
- результат
- услуги / направления
- CTA для связи
```

Кейс не должен быть только красивой карточкой без отдельной SEO-страницы.

---

# 9. Проверить email и контакты

Пройти главную, услуги, блог, кейсы, футер.

Проверить, какие email используются.

Рекомендованная логика:

```txt
hello@lumiva.agency — основной общий email
vlad@lumiva.agency — персональный / sales email
```

Если `hello@lumiva.studio` больше не используется, его лучше убрать, чтобы не было путаницы.

---

# 10. Проверить через Google Search Console

После исправлений зайти в Google Search Console.

## Добавить / обновить sitemap

Раздел:

```txt
Indexing → Sitemaps
```

Отправить:

```txt
https://lumiva.agency/sitemap.xml
```

## Запросить переобход важных страниц

Через URL Inspection проверить и отправить на переобход:

```txt
https://lumiva.agency/
https://lumiva.agency/ru/
https://lumiva.agency/tr/
https://lumiva.agency/services/
https://lumiva.agency/blog/
https://lumiva.agency/cases/
```

Также проверить старые URL:

```txt
https://lumiva.agency/category/blog/
https://lumiva.agency/product-tag/crm/
https://lumiva.agency/product/
```

Нужно убедиться, что Google видит редирект, 410 или noindex.

---

# 11. Временно удалить старые URL из Google

Если старые WooCommerce/WordPress URL всё ещё видны в Google, можно временно скрыть их.

Google Search Console:

```txt
Indexing → Removals → New request
```

Добавить старые URL или префиксы:

```txt
https://lumiva.agency/product-tag/
https://lumiva.agency/product/
https://lumiva.agency/category/
https://lumiva.agency/shop/
```

Важно: это временное удаление. В коде всё равно должны быть 301, 410 или noindex.

---

# 12. Проверить через онлайн-инструменты

После правок проверить сайт через:

```txt
Google Rich Results Test
Google PageSpeed Insights
Ahrefs Webmaster Tools
Screaming Frog SEO Spider
Яндекс.Вебмастер
```

Минимально проверить:

```txt
- нет битых ссылок 404 на важных страницах
- нет дублей title
- нет дублей description
- canonical правильные
- hreflang не ведёт на несуществующие страницы
- sitemap чистый
- старые WP/WooCommerce URL не индексируются
```

---

# 13. Что делать после исправления ошибок

Когда технические ошибки будут исправлены, можно продолжать развитие контента.

## Следующие SEO-задачи

```txt
1. Добавить больше статей в блог.
2. Добавить больше кейсов.
3. Сделать отдельные SEO-страницы под услуги.
4. Сделать страницы под рынки: Turkey, Antalya, CIS, Europe.
5. Добавить FAQ на страницы услуг.
6. Добавить больше внутренней перелинковки между услугами, блогом и кейсами.
```

## Примеры будущих страниц

```txt
/en/services/performance-marketing/
/ru/services/performance-marketing/
/tr/services/performance-marketing/

/en/services/crm-integration/
/ru/services/crm-integration/
/tr/services/crm-integration/

/en/blog/
/ru/blog/
/tr/blog/
```

Если основная английская версия находится на `/`, отдельный `/en/` можно не создавать. Но тогда нужно быть последовательным:

```txt
English: /
Russian: /ru/
Turkish: /tr/
```

---

# 14. Главный чек-лист готовности

Сайт можно считать нормально подготовленным к SEO, когда:

```txt
[ ] / открывается на английском и отдаёт 200 OK
[ ] /ru/ открывается на русском и отдаёт 200 OK
[ ] /tr/ открывается на турецком и отдаёт 200 OK
[ ] /ru/ не редиректит на /
[ ] canonical на каждой странице указывает на саму себя
[ ] hreflang настроен между языковыми версиями
[ ] sitemap.xml содержит только актуальные URL
[ ] robots.txt указывает на sitemap
[ ] старые WooCommerce URL удалены, редиректнуты или отдают 410
[ ] нет дублей e-commerce URL
[ ] блог не пустой в HTML
[ ] статья открывается как отдельная SEO-страница
[ ] кейс открывается как отдельная SEO-страница
[ ] email и контакты единообразны
[ ] сайт отправлен на переобход в Google Search Console
```
