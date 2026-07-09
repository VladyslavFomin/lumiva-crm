# Lumiva CRM — Roadmap / Что нужно сделать

> Приоритеты: 🔴 Критично / 🟡 Важно / 🟢 Улучшение

---

## 🔴 Быстрые исправления (1–4 часа каждое)

### ✅ B-1. Удаление Telegram-бота
**Файл:** `backend/src/telegram-crm/telegram-crm.controller.ts:92`
~~Есть `// TODO: удаление бота` — возвращает `{ success: true }` без реального удаления.~~
**Сделано:** `TelegramCrmService.deleteBot()` — вызывает `deleteWebhook` (best-effort) + удаляет запись из БД.

### ✅ B-2. Shopify — синхронизация по расписанию
~~Адаптер `ShopifyAdapter` готов, но нет `@Cron` планировщика (в отличие от Google Sheets).~~
**Сделано:** `ShopifySyncScheduler` — `@Cron('*/30 * * * *')`, guard от параллельного запуска, зарегистрирован в `IntegrationsModule`.

### ✅ B-3. Slack — inbound webhook (Slack → CRM)
~~Есть `SlackWebhookService` (исходящий, CRM → Slack).~~
**Сделано:** `SlackInboundController` + `SlackInboundService` — `POST /webhooks/slack/:connectionId`, Slack URL-verification challenge, создание лидов + заметок. Зарегистрирован в `AppModule`.

### ✅ B-4. Переводы — дополнить TR-локаль
~~Несколько ключей в `crm.salesIntegrations.kinds` и `crm.automations.panel.integrations`~~
**Сделано:** Полный аудит 74 пропущенных ключей; добавлены `crm.dashboard.*` (channels, tasks, pipeline, projects, recentLeads, leadsTimeline, salesByChannel, quickActions, staff, taskTypes, detailModal), `crm.emailTemplates.presets.items.*` (9 шаблонов), `crm.nav.deduplication/sms/smsMessages/smsSettings`, `crm.workspace.kindBadge.shortData`, `crm.workspace.table.mondayBoardSubtitle`. Дополнительно: исправлены `{{platform}}` интерполяция в `ZapierMakeConnectModal`, ключи `crm.common.cancel/next/back/close/optional`.

---

## ✅ Интеграции — РЕАЛИЗОВАНЫ

### I-1. Slack — полноценная интеграция ✅
- [x] Исходящий вебхук (CRM → Slack) — готово
- [x] Входящий вебхук (Slack → CRM, создание лидов) — готово (B-3)
- [x] `SlackConnectModal` — 2-вкладочный мастер (Outbound + Inbound), кастомный токен, дефолтный источник лида
- [x] `testConnection()` в ThirdPartyLinkAdapter, каталог помечен `inboundWebhook: true, leadCapture: true`

### I-2. OpenAI / LLM ✅
- [x] `OpenAiApiService` — `testConnection()` через `GET /v1/models` с Bearer-токеном
- [x] `configJson`: `{ catalogId: 'openai', apiKey, model?, baseUrl? }` (поддержка Azure/прокси)
- [x] `OpenAiConnectModal` — выбор модели (gpt-4o, o1, o3-mini и др.), опциональный baseUrl
- [x] ThirdPartyLinkAdapter диспетчеризирует testConnection для openai

### I-3. 1С:Предприятие ✅
- [x] `OneCApiService` — `testConnection()` (ping /hs/{path}/ping|health|/), `fetchOrders()` (sync)
- [x] `syncSales()` в ThirdPartyLinkAdapter — вызывает fetchOrders и возвращает счётчики
- [x] `configJson`: `{ baseUrl, login, password, infobase?, servicePath? }`
- [x] `OneCConnectModal` — 5-шаговый гайд + форма (basic auth, URL базы, инфобаза)

### I-4. SAP / ERP ✅
- [x] `SapApiService` — `testConnection()` с валидацией токена, опциональный ping SAP URL
- [x] `SapInboundService` + `SapInboundController` — `POST /webhooks/sap/:connectionId`
- [x] Поддержка SAP Business One, IS-U, generic JSON; auth: `X-SAP-Token` header или `?token=`
- [x] `SapConnectModal` — гайд → форма (авто-генерация токена) → done (показывает inbound URL + токен)

### I-5. Jira ✅
- [x] `JiraApiService` — `testConnection()`, `getProjects()`, `createIssue()` (ADF описание)
- [x] `JiraInboundService` + `JiraInboundController` — `POST /webhooks/jira/:connectionId`
- [x] Auth: `X-Lumiva-Token` / `X-Jira-Token` header или `?token=`; создаёт лид + note с changelog
- [x] `JiraConnectModal` — гайд → форма (jiraUrl, email, apiToken, projectKey, inboundToken) → done

---

## 🟡 Средние задачи (2–5 дней каждая)

### M-1. Конструктор Embed-форм (визуальный UI)
Backend (`embed-forms`) готов: шаблоны, upload, origin-validation.
**Нет**: UI для создания/редактирования форм.
- [ ] Страница `/app/web-forms` с CRUD форм
- [ ] Визуальный drag-and-drop конструктор полей
- [ ] Превью формы + получение embed-кода (`<script>` или `<iframe>`)
- [ ] Статистика: сколько лидов пришло с каждой формы

### M-2. Биллинг — завершить пользовательский flow
Backend: Stripe подключён, `BillingService` работает.
**Нет**: полноценный UI для смены тарифа, оплаты, истории платежей.
- [ ] Страница тарифов с актуальными ценами из Stripe
- [ ] Кнопка "Обновить тариф" → Stripe Checkout session
- [ ] Webhook от Stripe: автоматическая смена плана при успешной оплате
- [ ] История платежей (Stripe invoice list)
- [ ] Уведомление при истечении пробного периода

### M-3. Мобильная PWA
Нет нативного приложения, но можно сделать PWA.
- [ ] `manifest.json` + иконки всех размеров
- [ ] Service Worker (offline-кэш основных страниц)
- [ ] Push-уведомления (new lead, task reminder)
- [ ] Адаптивная вёрстка аудит — проверить все ключевые страницы на 375px

### M-4. Уведомления — центр уведомлений
Есть `notifications` модуль в backend, но нет реального UI центра.
- [ ] Колокольчик в хедере с бейджем (live count через SSE или polling)
- [ ] Дропдаун с последними 20 уведомлениями
- [ ] Страница `/app/notifications` — полная лента
- [ ] Отметить все как прочитанные / настройки типов уведомлений

### M-5. Дедупликация — UI для слияния
Backend `deduplication` есть.
- [ ] Страница "Дубликаты" — список подозрительных пар
- [ ] Слияние двух лидов/контактов в один с выбором "мастер-записи"
- [ ] Автоматическое объединение по email/phone при создании нового лида

### M-6. API-документация (Swagger) — публичный доступ
Swagger есть в коде, но нет публичной страницы.
- [ ] Страница `/api-docs` открытая без авторизации
- [ ] Раздел в лендинге / docs-сайт

---

## ✅ Улучшения существующего — РЕАЛИЗОВАНЫ

### E-1. Shopify — двусторонняя интеграция ✅
- [x] `ShopifyInboundService` + controller — `POST /webhooks/shopify/:id`; обрабатывает `orders/create`, `orders/paid`, `orders/updated`
- [x] Создание/обновление лида при первом заказе (поиск по email, `createForTenant` если нет)
- [x] `ShopifyApiService.createFulfillment()` — статус заказа в Shopify при `status=completed` из CRM
- [x] Верификация HMAC-SHA256 подписи Shopify (опциональная, если `webhookSecret` задан)
- [x] Зарегистрирован в `AppModule`

### E-2. WooCommerce — входящий webhook ✅
- [x] `WooCommerceInboundService` + controller — `POST /webhooks/woocommerce/:id`
- [x] Авторизация: `X-WC-Webhook-Signature` HMAC или `?secret=` query param
- [x] `registerWebhooks(connection)` — автоматическая регистрация вебхуков в WooCommerce через REST API при подключении (если `PUBLIC_API_URL` задан)
- [x] Real-time создание/обновление Sale + Lead при получении события

### E-3. Dashboard — виджеты второго уровня ✅
- [x] Backend: `GET /leads/funnel-today`, `GET /leads/sources-weekly`, `GET /sales/recent`, `GET /contacts/birthdays`
- [x] Frontend: `FunnelTodayWidget`, `LeadSourcesWidget` (Recharts PieChart), `RecentDealsWidget`, `BirthdaysWidget`
- [x] Зарегистрированы в `dashboardLayout.ts` и `DashboardPage.tsx`; добавляются через "Add Widgets"

### E-4. Автоматизации — новые типы действий ✅
- [x] Action `create_jira_issue`: backend (использует `JiraApiService`), frontend (UI панель с выбором подключения, заголовок, описание, тип задачи)
- [x] `send_slack`, `send_mailchimp` — уже были реализованы ранее
- [x] Trigger `shopify.payment_received` добавлен в `TriggerEvent` enum и frontend

### E-5. AI-сотрудники — подключение к OpenAI клиента ✅
- [x] `AiOpenAiService.chatCompletionWithConfig()` — принимает `overrideConfig { apiKey, baseUrl, model }`
- [x] `AiEmployeesService.resolveOpenAiConfig()` — читает `agent.settings.openaiConnectionId`, загружает подключение, передаёт ключ клиента
- [x] Frontend: выбор провайдера в форме AI-сотрудника ("Платформа" / "Свой ключ OpenAI")

### E-6. Email — bulk-рассылки ✅
- [x] Backend: `sendBulk()` в `EmailService` — фильтрация лидов по source/status, массовая отправка через SMTP
- [x] Backend: `POST /email/bulk-send`, `GET /email/track/:messageId` (tracking pixel 1x1 GIF)
- [x] Frontend: `EmailBulkSendModal` — 4-шаговый мастер (Audience → Compose → Preview → Sent)
- [x] "Bulk Send" кнопка добавлена в `EmailInboxPage`

### E-7. Импорт лидов — CSV улучшения ✅
- [x] Backend: `POST /leads/import/preview` — возвращает заголовки + первые 5 строк без импорта
- [x] Backend: `POST /leads/import` — принимает `{ csvData, columnMapping }`, маппинг колонок
- [x] Frontend: `LeadsCsvImportModal` — 3-шаговый мастер: Upload → Map Columns (авто-маппинг по имени) → Done
- [x] Кнопка "Import CSV" добавлена в `LeadsListPage`
- [ ] Импорт из Google Contacts (OAuth) — отложено (требует OAuth flow)
- [ ] Импорт из vCard — отложено

---

## ✅ Технический долг — ЗАКРЫТ

### T-1. Тесты ✅
- [x] Unit-тесты для `OpenAiApiService`, `OneCApiService`, `SapApiService`, `JiraApiService`
- [ ] E2E тест на `/webhooks/zapier-make/:id` — отложено
- [ ] E2E тест на `/webhooks/slack/:id` — отложено

### T-2. Переводы — аудит полноты ✅
- [x] Скрипт `frontend/scripts/audit-translations.cjs` — сравнивает RU/EN/TR, поддерживает `--filter=`
- [x] Все новые ключи (I-1..I-5, E-3, E-4) добавлены в EN/RU/TR синхронно

### T-3. Ошибки в коде ✅
- [x] Telegram `deleteBot` — был уже реализован в сервисе
- [x] `console.log` в `automations.service.ts` (6 шт.) заменены на `this.logger.debug()`
- [x] `console.log` в `leads.service.ts` и `leads.controller.ts` удалены

### T-4. Безопасность ✅
- [x] `WebhooksRateLimitGuard` создан — 120 req/min per IP, используется в новых контроллерах
- [x] **CORS embed-форм**: рефлект Origin — намеренный (формы встраиваются на сторонние сайты), безопасность на app-слое через `isOriginAllowedForPublicEmbed()`. Исправления: убрали `Authorization` из разрешённых CORS-заголовков embed endpoint (не нужен), добавили явный `Access-Control-Allow-Credentials: false`
- [x] **`EMBED_RELAXED_ORIGIN=1` в production**: добавлен hard-fail при старте в `validateEnv()` — сервер не поднимется с этим флагом в `NODE_ENV=production`
- [x] **Аудит tenantId**: все основные сервисы (leads, contacts, companies, sales, automations, integrations, ai-employees) проверены — `tenantId` присутствует во всех where-условиях. Inbound webhook-сервисы ищут connection по UUID без tenantId — это корректный дизайн (нет user-сессии, UUID + auth-token = секрет; tenantId деривируется из найденной сущности)

---

## 🗓 Предлагаемый порядок работы

| Неделя | Задачи |
|--------|--------|
| 1 | B-1 (Telegram), B-2 (Shopify cron), B-3 (Slack inbound), I-1 (Slack полный) |
| 2 | I-2 (OpenAI), E-5 (AI + ключ клиента) |
| 3 | M-1 (Embed forms UI) |
| 4 | I-3 (1С) |
| 5 | M-2 (Биллинг flow) |
| 6 | M-3 (PWA), M-4 (Уведомления) |
| 7+ | I-4 (SAP), I-5 (Jira), E-1/E-2 (webhooks), E-4 (actions) |

---

*Последнее обновление: 2026-06-15*
*Статус проверен автоматически по исходному коду.*
