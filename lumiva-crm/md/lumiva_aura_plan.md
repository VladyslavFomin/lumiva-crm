# Aura — конструктор дашбордов-приложений (аналог monday Vibe)

Старт: 2026-10-09. Дизайн: Claude Design проект `3affa7c1-…`, `aura.html` + `components/aura-*.jsx`,
`styles/aura*.css`.

## Что это
Клиент описывает задачу текстом → ИИ задаёт 5 вопросов (данные, показатели, период, разрезы, зритель)
→ выбор стиля (5 тем) → сборка → редактор с ИИ-чатом (правки словами) → публикация.
Приложение открывается в CRM (с меню) или на весь экран без меню (ТВ/киоск), им можно
поделиться публичной ссылкой с паролем и сроком — как аналитикой таблицы рабочей области.

## Бэкенд (`backend/src/aura`)
- `aura_apps` (CREATE TABLE IF NOT EXISTS в onModuleInit, как workspace_shares): владелец, тема,
  плотность, kiosk, config jsonb (prompt, sources, widgets[], period, breakdown[], goals, viewer),
  access private|department|company, department_id, show_in_menu, refresh_sec,
  share_enabled/share_key/share_password_hash/share_expires_at/share_token_version/shared_by.
- `aura-catalog.ts` — 8 источников × виджеты, право RBAC на источник.
- `aura-data.service.ts` — расчёт каждого виджета из реальных таблиц, валюта → основная валюта
  тенанта по курсу, период + прошлый период, бакеты (час/день/неделя/месяц), фильтры
  (менеджер/канал/филиал/товар), права: RBAC на источник, LeadAccessService для лидов,
  «Видимость данных» (foreign_records=hide → свои; amounts скрыты → суммы только по своим).
- `aura-ai.service.ts` — бриф (prompt → источники/виджеты/период/разрезы/название),
  ответ своими словами на вопрос брифа, правки в редакторе (JSON-операции, валидация по каталогу).
  BYOK/квота как в остальных ИИ-функциях; без ИИ — детерминированный разбор по ключевым словам ru/en/tr.
- Публичная ссылка: `/public/aura/:shareKey` (info / unlock / data), токен JWT как у workspace share,
  данные считаются с правами того, кто включил ссылку.

## Честные замены относительно макета
- «План» менеджеров в CRM нет → цель отдела задаётся в приложении (goals.team_goal), колонка «План»
  в рейтинге → «Выручка».
- Расходов, кроме рекламы, в CRM нет → «Финансы»: доходы (продажи+брони+отели) против рекламного
  расхода, «Структура доходов» вместо «Структуры расходов».
- ROI по каналам без атрибуции выручки был бы выдумкой → «Расход по каналам» (+ стоимость лида).
- «Live»-тик макета (числа сами растут) → реальный опрос раз в refresh_sec.

## Фронтенд (`frontend/src/pages/aura`)
Маршруты: /aura (создать), /aura/templates, /aura/apps, /aura/brief, /aura/style, /aura/build/:id?,
/aura/view/:id (в CRM), /aura/app/:id (без меню), /aura/tv/:shareKey (публично).
Пункт «Aura» в сайдбаре + опубликованные приложения с «Показать в меню». ru/en/tr: `crm.aura.*`.

## Статус (2026-10-10) — всё выкачено, не закоммичено
- [x] backend: `backend/src/aura/*` (catalog, data, intent, ai, service, 2 контроллера, module), `RbacService.canUserAccess`
  + `FAIL_OPEN_PERMISSIONS` в permission.types (guard использует его же).
- [x] frontend: `frontend/src/pages/aura/*`, `api/aura.ts`, маршруты в AppRouter, пункт «Aura» в сайдбаре
  (+ приложения с «Показать в меню»), иконка `aura` в NavSidebarIcons, чат поддержки скрыт на /aura/tv и /aura/app.
- [x] i18n `crm.aura.*` + `crm.nav.aura*` ru/en/tr (ключи сверены скриптом).
- [x] e2e на одноразовом тенанте (26 проверок: все виджеты/периоды/фильтры/валюта, права sales+«чужие скрыты»,
  ссылка с паролем, отзыв токена при смене пароля, доступ коллег) + проход UI в браузере. Тенант удалён.

## Важное
- TypeORM postgres: `UPDATE … RETURNING` через dataSource.query отдаёт `[rows, count]` (INSERT — просто rows) →
  `firstRow()` в aura.service.ts. Ловушка на будущее для любых raw UPDATE RETURNING.
- Платформенный ключ OpenAI без кредитов (429 credit_balance_exhausted, 2026-10-10) → ИИ брифа/правок уходит в
  резервный разбор по ключевым словам; UI это честно пишет. Путь с моделью ещё не проверен вживую.
- `.au-rv` появление — глобальный наблюдатель (контент монтируется позже эффектов из-за MainLayout).
- Скриншоты Playwright сразу после goto показывают старый кадр (и у /bi) — делать второй снимок.
- 2026-10-10 (фидбек: «не вижу шаблонов/блоков» в карусели, Chrome на Mac): общий `preserve-3d`-контекст карусели +
  overflow/radius + много анимированных слоёв внутри — на реальном GPU содержимое карточек терялось (headless Chromium
  этого не показывает). Переделано: у каждой карточки своя `perspective()` в transform, наклон через `--rx/--ry`,
  обрезка во внутреннем `.ah-shot-in`, миниатюры без анимаций, подложка у точек. WebKit проверен в docker-образе
  mcr.microsoft.com/playwright (образ после проверки удалён).
- 2026-10-10, настоящая причина пустых превью (диагностика из консоли пользователя, Chrome 153 Mac): высота `.ad`
  = только padding (64/80px) → `container-type:inline-size` в его Chrome обнулял высоту содержимого внутри
  масштабированного превью. Container queries убраны; адаптив — классы `ad-w-sm/ad-w-xs` по ResizeObserver в AuraDash.
  Не возвращать container-type в Aura. Наш headless Chromium/WebKit этого не воспроизводили.
- 2026-10-10, ОКОНЧАТЕЛЬНАЯ причина пустых превью: блокировщик рекламы у пользователя прятал элементы с классами
  `ad-*` (`.ad-card`, `.ad-grid`, `.ad-title` — косметические фильтры EasyList). Все классы дашборда переименованы
  в `dsh-*`. Правило: в этом проекте никогда не давать CSS-классам префикс `ad`/`ad-`/`ads`/`banner`/`sponsor`.
  (Отказ от container queries из предыдущего пункта оставлен — вреда нет.)

## 2026-10-10 — «ИИ делает что угодно, а не только из шаблона»
- `aura-custom.ts`: реестр наборов данных (leads, sales, calls, bookings, hotel_bookings, products, contacts, companies,
  ads + `table:<uuid>` таблицы рабочей области) с белым списком полей/SQL-выражений; `sanitizeCustom`, `sanitizeStyle`.
- `aura-custom-data.ts`: выполнение пользовательских виджетов (count/sum/avg/min/max, фильтры, groupBy поле/date,
  kpi/line/bar/donut/table), права: раздел/контакты/компании/custom_objects, лиды через LeadAccess, «только свои»,
  скрытые суммы, членство в области рабочего пространства.
- config.custom + config.style; ИИ-операции add_custom / style / style_reset; бриф тоже может предлагать custom.
- ИИ возвращает aiError (provider_quota / tenant_quota / unavailable) → чат пишет реальную причину.
- Резервный разбор понимает цвета ru/en/tr («фон красный», «карточки чёрные», hex).
- Проверено скриптом на одноразовом тенанте (виджеты из 5 наборов + таблица области, отказ чужой области,
  own-only) и в браузере. Платформенный OpenAI всё ещё без кредитов — путь с моделью вживую не проверен.
