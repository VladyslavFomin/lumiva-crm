# Подсказки-туры по страницам CRM + видео/gif из pl1

Начато 2026-10-12. Пошаговые окна рядом с кнопками (5–8 шагов) при первом заходе на страницу,
повтор — кнопка «?» → «Пройти обучение». Видео/gif к шагам и видео-гайд страницы — pl1 → «Контент».

## Как устроено
- **Каталог (единый источник)**: `backend/src/help-content/`
  - `help-pages.ts` — все страницы с кнопкой «?» (topic, группа, название ru/en/tr) + `welcome`.
  - `tours/<группа>.ts` — шаги: `step(id, data-tour-цель, [title ru,en,tr], [body ru,en,tr])`; подключить в `tour-steps.ts`.
  - id шага стабилен — к нему в pl1 привязано видео. Не переименовывать без миграции `help_media`.
- **Таблица** `help_media(topic, stepId, kind video|gif, url)`; `stepId='_page'` — видео-гайд окна «?».
- **API**: `GET /help-content/tours/:topic?lang=` (JWT CRM), `GET /platform/help-content`, `PUT /platform/help-content/media` (PlatformAdminGuard; пустой url = удалить).
- **Фронт CRM**: `components/help/tour/{tourStore,TourHost}.tsx`, `HelpMediaView.tsx`, `PageHelpButton.tsx` (`usePageTour`).
  Якорь шага — атрибут `data-tour="<цель>"` на элементе; нет элемента на экране → окно по центру.
  «Уже видел» — `users.preferences.tours.seen[topic]` (+ зеркало `localStorage lumiva.tours.v1`), `tours.off` — «не показывать автоматически».
  Туры ждут, пока открыт мастер настройки (`setToursBlocked('onboarding')`) или окно оплаты (`'billing'`).
- **pl1**: `src/pages/ContentPage.tsx` (маршрут `/content`).

## Как добавить тур страницы
1. Прочитать страницу, поставить `data-tour="<page>-<что>"` на 5–8 постоянно видимых элементов.
2. Написать шаги в `tours/<группа>.ts` (простые слова, 1–2 предложения, три языка), подключить в `tour-steps.ts`.
3. Проверка: все цели есть во фронте — `grep -rl 'data-tour="<цель>"' frontend/src`.
4. Деплой: `docker compose build --no-cache api && up -d api` (infra/), фронт — `scripts/deploy-live.sh`.

## Готово (раунд 1, 2026-10-12)
welcome, leads (+ board/calendar), leadCard, contacts, companies, sales, saleCard, projects (+ board/calendar), projectCard.

## Готово (раунд 2, 2026-10-12)
products, productCard, bookings, reservations, hotels, hotelFrontDesk, helpdesk, onlineChat, emailInbox, aiEmployees.
Карточки контакта/компании переведены на свои topic (contactCard/companyCard) — тур списка там больше не всплывает.

## Готово (раунд 3, 2026-10-12)
contactCard, companyCard, reservationCard, hotelReservations, hotelPricing, esign, telephony, marketingCampaigns, marketingBroadcasts, aiEmployeeProfile.
Общие блоки карточек (`contacts/CrmFormShared.tsx`: Card, SideCard, Tabs, Metrics) принимают проп `tour` → data-tour.
Автотур не запускается, если на странице нет ни одной цели его шагов (одна тема «?» на нескольких страницах, напр. hotelPricing на «Редактировать номер»); «Пройти обучение» работает всегда.

## Готово (раунд 4, 2026-10-12)
emailAccounts, marketingTraffic, marketingSegments, marketingSeo, hotelsList, hotelCard, hotelCalendar, bookingServices, bookingAvailability, aiEmployeesApprovals.

## Готово (раунд 5, 2026-10-13) — все оставшиеся
leadAiTools, leadsLost, leadsArchive, leadsTrash, leadsAnalytics, leadsRoi, companiesAnalytics, duplicates,
salesChannels, salesPayments, salesIntegrations, salesImport, все подразделы товаров (10), проектов (7) и бронирований (7),
hotelAnalytics, emailAccountForm, telephonySms/Analytics/Settings, marketingSmm/Utms/EmailTemplates, aiAssistant,
aiEmployeesChoose/Create/Logs/Reports.

**Итого: туры есть на всех 88 страницах с кнопкой «?».** Пропущен только `companyTasks` — отдельной страницы больше нет (это вкладка карточки компании).
Inline-кнопки «?» (leadAiTools, aiAssistant) тур сами не запускают — только через «Пройти обучение».


## Известные ограничения
- Шаги про открытый тикет/диалог (хелпдеск, чат) на пустом аккаунте показываются по центру — открыть нечего, так задумано.
- Страница «Входящие» (EmailInboxPage) захардкожена на русском — не переведена на en/tr (вне задачи туров).
- Видео только ссылками (YouTube/Vimeo/Loom или прямой mp4/webm/gif). Загрузки файлов в pl1 нет.
