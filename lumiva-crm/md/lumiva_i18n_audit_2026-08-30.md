# Аудит перевода CRM — 2026-08-30

Проверка проведена по всем страницам `frontend/src/pages/`: страница считается "без перевода", если её компонент не использует `useTranslation`/`t()` вообще — то есть весь текст на ней захардкожен на русском и не меняется при переключении языка в интерфейсе (RU/EN/TR).

## Переведено в этом заходе

Все 5 запрошенных страниц полностью переведены на русский/английский/турецкий и задеплоены:

| Страница | URL | Что сделано |
|---|---|---|
| BI-дашборд | `/bi` | Вся статическая часть переведена (~490 строк текста, 3 языка). Данные из бэкенда (названия каналов лидов, статусы воронки, тексты алертов, имена сотрудников) остаются на русском — это не UI-текст, а данные, которые генерирует backend; для их перевода нужна отдельная доработка API (см. ниже). |
| Календарь команды | `/calendar` | Полностью переведён |
| Подпись документов (Esign) | `/esign` + публичная страница подписания `/esign/:token` | Полностью переведён. Поле "Тип документа" (Договор/Счёт/NDA и т.п.) сознательно оставлено на русском — это сохранённые в БД данные, а не UI-текст |
| Почта · Входящие | `/email/inbox` | На EN/TR раньше вообще не было переводов (в JSON-файлах ключи существовали только в ru) — добавлены переводы на EN/TR |
| Почта · Аккаунты | `/email`, `/email/accounts/new`, `/email/accounts/:id` | Страница вообще не была подключена к переводам, весь текст был захардкожен — переведена с нуля (учтены все вкладки: Подключение, Подпись, Лиды, Диагностика, Журнал доставки) |

## Страницы без перевода (весь текст захардкожен на русском)

Отсортировано по объёму текста (примерное число текстовых блоков на странице). Открытие такой страницы с английским или турецким интерфейсом всё равно покажет русский текст.

### Модуль «Бронирования» (Bookings) — почти весь модуль
- `/bookings/reservations` — HotelReservationsPage.tsx *(86 блоков — на самом деле общий для отелей и бронирований)*
- `/bookings/availability` — BookingAvailabilityPage.tsx (58)
- `/bookings/reservations/:id` — ReservationDetailPage.tsx (43)
- `/bookings/reservations` — ReservationsPage.tsx (37)
- `/bookings/waitlist` — BookingWaitlistPage.tsx (34)
- `/bookings/settings` — BookingSettingsPage.tsx (22)
- `/bookings/resources` — BookingResourcesPage.tsx (21)
- `/bookings/services` — BookingServicesPage.tsx (20)
- `/bookings/locations` — BookingLocationsPage.tsx (20)
- `/bookings/analytics` — BookingAnalyticsPage.tsx (19)
- `/bookings/overview` (главная модуля) — BookingOverviewPage.tsx (14)
- `/bookings/reservations/import` — ReservationsImportPage.tsx (9)
- `/bookings/logs` — BookingLogsPage.tsx (8)

### Модуль «Отели» (Hotels/PMS) — почти весь модуль
- `/hotels/:id` (карточка отеля) — HotelDetailPage.tsx (58)
- `/hotels/analytics` — HotelAnalyticsPage.tsx (52)
- `/hotels/pricing` — HotelPricingPage.tsx (22)
- `/hotels/list` — HotelsListPage.tsx (21)
- `/hotels/room-types/:id/pricing` — HotelRoomPricingPage.tsx (18)
- `/hotels/calendar` (компонент цен) — HotelPricingCalendar.tsx (17)
- `/hotels/frontdesk` — HotelFrontDeskPage.tsx (12)
- `/hotels` (главная модуля) — HotelsOverviewPage.tsx (10)
- `/hotels/calendar` — HotelCalendarPage.tsx (5)
- HotelRoomOccupancyGrid.tsx, PhotoEditDrawer.tsx — вложенные компоненты (4 и 7)

### Модуль «Телефония»
- `/telephony` — TelephonyPage.tsx (28)
- `/telephony/settings` — TelephonySettingsPage.tsx (19)
- `/telephony/analytics` — TelephonyAnalyticsPage.tsx (18)
- `/telephony/sms` — TelephonySmsPage.tsx (7)

### Хелпдеск
- `/helpdesk` — HelpdeskPage.tsx (32)

### Аналитика лидов
- `/leads/analytics` — LeadsAnalyticsPageV2.tsx (78)

### Клиентские аккаунты (B2B-портал для клиентов)
- `/client-accounts/:clientId/analytics` — ClientAccountAnalyticsPage.tsx (15)
- `/client-accounts/operations` — ClientFinancialOperationsPage.tsx (8)
- `/client-accounts/sites` — ClientAccountSitesPage.tsx (4)
- Портал самого клиента: `/portal/:clientKey/dashboard`, `/tickets`, `/tickets/:id`, `/login`, `/verify` — PortalDashboardPage, PortalTicketsPage, PortalTicketDetailPage, PortalLoginPage, PortalVerifyPage (1–5 блоков каждая; это внешний портал для клиентов компании, не сотрудников)

### Настройки
- `/settings/api` — ApiTokensPage.tsx (12)
- `/settings/audit-log` — AuditLogPage.tsx (8)
- `/settings/export` — ExportBackupPage.tsx (2)

### Разное
- `EmailBulkSendModal.tsx` — модалка массовой рассылки внутри почты (11)
- `/api-integration/docs` — ApiDocsPage.tsx (9)
- `/contacts/duplicates` — DuplicatesPage.tsx + MergeModal.tsx (5+6)
- `/onboarding` — OnboardingWizardPage.tsx (2)
- Публичные встраиваемые формы (виджеты для сайтов клиентов): HotelBookingField.tsx, ServiceBookingField.tsx, ProductCartField.tsx, EmbedDesignPreview.tsx (1–7 блоков; это конструктор форм, показывается на сайте клиента, а не в самой CRM)

## Важное ограничение по BI-дашборду

Часть текста на `/bi` формируется на бэкенде (NestJS), а не во фронтенде:
- названия источников лидов и статусов воронки (`SOURCE_LABELS`, статусы "Все лиды", "В работе" и т.п.)
- тексты в блоке «Требует внимания» (`alerts[].module`, `alerts[].text`)

Эти строки приходят с сервера уже готовым русским текстом. Чтобы их тоже переводить, нужно либо передавать с фронтенда выбранный язык в API и генерировать текст на бэкенде на нужном языке, либо возвращать с бэкенда не текст, а ключи, которые фронтенд сам переводит. Это отдельная (не очень большая) задача backend-уровня — дайте знать, если её тоже нужно сделать.

## Как оценивался объём

Число в скобках — это количество JSX-текстовых узлов с кириллицей на странице (грубая оценка, `grep` по `>текст<`). Реальный объём немного больше — не считает текст в `placeholder=`, `title=`, названиях переменных состояния и т.п.
