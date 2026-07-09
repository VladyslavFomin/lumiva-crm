# Lumiva CRM: полный промт/ТЗ для универсального конструктора форм

Этот документ должен служить исходным промтом и техническим заданием для дальнейших сборок модуля форм Lumiva CRM. Он описывает продуктовую цель, текущий контекст, архитектурные ограничения, модель данных, UX редактора, публичный embed-рендер, аналитику, автоматизации и пошаговый план реализации.

## 0. Роль исполнителя

Ты работаешь как senior full-stack engineer и product-minded builder в существующем проекте Lumiva CRM.

Твоя задача не просто “добавить поля”, а постепенно превратить текущий минимальный модуль embed-форм в полноценный универсальный form builder для сайтов клиентов CRM. Важны три вещи:

- не ломать уже работающие формы и embed-коды;
- сохранять простоту для менеджера, который не является разработчиком;
- делать формы визуально современными, красивыми и коммерчески полезными: лид-формы, квизы, бронирования, записи, резервации, калькуляторы.

## 1. Контекст текущей реализации

Проект: `Lumiva CRM`.

Основной домен CRM:

```text
https://crm.lumiva.agency
```

Публичная форма:

```text
https://crm.lumiva.agency/embed/{formPublicId}
```

Публичные API:

```text
GET  /v1/public/embed/{publicId}/config
POST /v1/public/embed/{publicId}/submit
POST /v1/public/embed/{publicId}/attachment
```

CRM API:

```text
GET    /v1/embed-forms
POST   /v1/embed-forms
GET    /v1/embed-forms/:id
PATCH  /v1/embed-forms/:id
DELETE /v1/embed-forms/:id
POST   /v1/embed-forms/:id/preview-token
GET    /v1/embed-forms/templates
```

Ключевые файлы:

```text
backend/src/embed-forms/embed-form.entity.ts
backend/src/embed-forms/embed-forms.service.ts
backend/src/embed-forms/embed-forms.controller.ts
backend/src/embed-forms/public-embed.controller.ts
backend/src/embed-forms/embed-form-templates.ts
frontend/src/api/embedForms.ts
frontend/src/pages/web-forms/WebFormsListPage.tsx
frontend/src/pages/web-forms/WebFormEditorPage.tsx
frontend/src/pages/public-embed/PublicEmbedFormPage.tsx
frontend/public/forms/widget.js
```

Текущая БД-сущность `embed_forms` уже содержит гибкие JSON поля:

```text
fieldConfig jsonb
design jsonb
```

Стратегия развития: максимально использовать `fieldConfig` и `design`, чтобы добавлять новые возможности без миграций БД, если это безопасно.

## 2. Что уже реализовано

На момент создания этого документа уже есть:

- модуль форм в CRM;
- список форм;
- создание формы;
- выбор сайта;
- выбор шаблона;
- редактор полей;
- базовый редактор дизайна;
- публичный рендер `/embed/:publicId`;
- preview-token для draft preview;
- submit формы в лид CRM;
- загрузка файлов;
- honeypot;
- iframe embed;
- popup/floating `widget.js`;
- поддержка шагов;
- простая условная логика show/hide field;
- вкладки редактора: `Основное`, `Поля`, `Шаги`, `Логика`, `Запись / бронирование`, `Дизайн`, `Код`;
- визуальные пресеты: `Classic`, `Spa / Wellness`, `Hotel Booking`, `Dark Popup`;
- красивые selectable-блоки для `radio`, `multi_checkbox`, `service`, `specialist`;
- настройка popup/floating: текст, ширина, blur, позиция, задержка;
- расширенные шаблоны: `quiz`, `booking`, `reservation`, `service_request`, `audit`.

## 3. Главная продуктовая цель

Нужно сделать универсальный form builder, с помощью которого клиент CRM может:

1. Создать форму для сайта.
2. Выбрать сайт.
3. Выбрать тип формы или шаблон.
4. Настроить поля.
5. Настроить шаги.
6. Настроить дизайн без кода.
7. Настроить inline iframe, popup, floating widget или auto popup.
8. Настроить условную логику.
9. Настроить запись/бронирование: услуги, специалисты, расписание, слоты.
10. Настроить цену и калькулятор.
11. Настроить уведомления и CRM-действия.
12. Получить код вставки.
13. Видеть заявки, брони, записи и частично заполненные формы в CRM.
14. Смотреть аналитику конверсий и drop-off по шагам.

Форма должна быть не просто набором HTML inputs. Она должна выглядеть как мини-продукт/мини-лендинг внутри iframe или popup.

## 4. Типы форм, которые должен покрывать конструктор

### 4.1 Простые формы

Примеры:

- форма обращения;
- обратный звонок;
- консультация;
- запрос коммерческого предложения;
- техподдержка;
- бриф;
- заявка на аудит;
- заявка на SEO;
- заявка на рекламу;
- заявка на сайт;
- заявка на CRM;
- заявка на SMM;
- дизайн/брендинг.

### 4.2 Квиз-формы

Многошаговые формы с вопросами, прогрессом и финальным предложением.

Примеры:

- подбор услуги;
- расчёт стоимости;
- подбор тарифа;
- бриф на сайт;
- бриф на рекламу;
- бриф на CRM;
- сегментация клиента;
- квиз с индивидуальным финальным экраном.

Квиз должен поддерживать:

- шаги;
- progress bar;
- назад/далее;
- условные переходы;
- обязательные поля на текущем шаге;
- контактные данные в конце;
- сохранение partial submission;
- изменение результата/цены/тегов по ответам.

### 4.3 Формы записи

Пользователь выбирает:

1. услугу;
2. специалиста;
3. дату;
4. время;
5. контакты;
6. комментарий.

Примеры:

- запись на консультацию;
- запись к специалисту;
- запись в салон;
- запись в клинику;
- запись на SPA;
- запись на звонок;
- запись на demo CRM;
- запись на встречу.

### 4.4 Формы бронирования/резервации

Пользователь выбирает параметры брони.

Примеры:

- бронирование номера;
- бронирование услуги;
- бронирование столика;
- бронирование трансфера;
- бронирование мероприятия;
- групповое бронирование;
- бронирование консультации.

Поля:

- check-in;
- check-out;
- гости;
- тип номера/услуги;
- дополнительные услуги;
- пожелания;
- контакты;
- промокод;
- источник заявки;
- total price.

## 5. Архитектурные принципы

### 5.1 Совместимость

Все старые формы должны продолжать работать. Нельзя переименовывать существующие поля в БД без миграций и обратной совместимости.

Если добавляется новое поведение, оно должно быть опциональным:

```text
fieldConfig.steps?
fieldConfig.settings?
fieldConfig.display?
fieldConfig.logic?
fieldConfig.booking?
fieldConfig.notifications?
fieldConfig.analytics?
design.visualPreset?
design.optionStyle?
design.headerStyle?
```

### 5.2 JSON-first модель

Пока возможно, расширять `fieldConfig` и `design`, а не создавать отдельные таблицы.

Отдельные таблицы создавать только когда данные становятся самостоятельной сущностью:

- events analytics;
- partial submissions;
- bookings;
- notification logs;
- availability exceptions;
- reusable services/staff каталог.

### 5.3 Preview не должен создавать лид

Preview должен:

- работать для неопубликованных форм;
- использовать preview-token;
- не создавать лид;
- не отправлять уведомления;
- показывать пользователю success state;
- желательно автоматически сохранять текущую форму перед открытием preview.

### 5.4 Public embed должен быть изолированным

Публичная форма должна:

- не требовать JWT;
- работать на стороннем сайте в iframe;
- отправлять `postMessage` resize;
- проверять origin для submit/upload;
- быть mobile-first;
- не зависеть от CRM layout;
- не иметь лишних глобальных отступов и конфликтов стилей.

## 6. Рекомендуемая модель `fieldConfig`

Пример расширенной структуры:

```json
{
  "fields": [],
  "steps": [],
  "settings": {
    "showProgress": true,
    "nextText": "Далее",
    "backText": "Назад",
    "submitText": "Отправить",
    "finalScreen": {
      "title": "Спасибо!",
      "message": "Мы свяжемся с вами."
    }
  },
  "display": {
    "embedModes": ["iframe", "popup", "floating"],
    "popupButtonText": "Оставить заявку",
    "popupWidthPx": 760,
    "popupBlur": true,
    "popupFullscreenMobile": true,
    "floatingLabel": "Оставить заявку",
    "floatingPosition": "right-bottom",
    "floatingDelaySec": 0,
    "autoPopup": {
      "enabled": false,
      "delaySec": 10,
      "scrollPercent": null,
      "exitIntent": false,
      "frequencyDays": 7
    }
  },
  "logic": [],
  "booking": {},
  "pricing": {},
  "notifications": {},
  "crmActions": {},
  "analytics": {}
}
```

## 7. Рекомендуемая модель поля

```json
{
  "id": "f_service_abc123",
  "type": "service",
  "key": "service",
  "label": "Выберите услугу",
  "placeholder": "",
  "helpText": "",
  "required": true,
  "stepId": "step_service",
  "defaultValue": "",
  "min": null,
  "max": null,
  "maxLength": null,
  "colSpan": 2,
  "options": [
    {
      "value": "wellness",
      "label": "Wellness massage",
      "description": "60 min",
      "price": "$10.00",
      "duration": "60 min",
      "imageUrl": ""
    }
  ],
  "visibility": {
    "hiddenByDefault": false
  },
  "crmMapping": {
    "target": "lead.meta.service",
    "showInLead": true,
    "sendInNotifications": true
  }
}
```

## 8. Поддерживаемые field types

Базовые:

- `text`
- `email`
- `url`
- `tel`
- `number`
- `textarea`
- `select`
- `date`
- `time`
- `datetime`
- `file`
- `checkbox_consent`
- `messaging`

Расширенные:

- `radio`
- `checkbox`
- `multi_checkbox`
- `hidden`
- `utm`
- `page_url`
- `rating`
- `range`
- `promo_code`
- `guests`
- `service`
- `specialist`
- `html`
- `divider`
- `booking_calendar`
- `price_total`
- `final_screen`
- `product_card`
- `address`
- `yes_no`

## 9. Рекомендуемая модель `design`

```json
{
  "visualPreset": "spa",
  "fontFamily": "system-ui",
  "fontSizePx": 15,
  "headingSizePx": 28,
  "textColor": "#405f57",
  "backgroundColor": "#ffffff",
  "fieldBackground": "#eef7f2",
  "borderColor": "#dbe8e1",
  "accentColor": "#5fa898",
  "buttonBackground": "#48685f",
  "buttonTextColor": "#ffffff",
  "headerStyle": "band",
  "headerBackground": "#48685f",
  "headerTextColor": "#ffffff",
  "optionStyle": "list",
  "borderRadiusPx": 14,
  "fieldPaddingPx": 14,
  "gapPx": 14,
  "formMaxWidthPx": 720,
  "formOuterPadXPx": 24,
  "formOuterPadYPx": 24
}
```

Дополнительные будущие настройки:

- `cardShadow`
- `cardStyle`
- `calendarStyle`
- `buttonIcon`
- `backgroundImage`
- `sectionSpacingPx`
- `mobileFullscreen`
- `hideTitle`
- `showStepTitle`
- `labelPosition`
- `inputVariant`

## 10. Эпик 1: Live preview в редакторе

### Цель

Менеджер должен видеть форму прямо в CRM во время настройки.

### UI

Добавить вкладку или правую панель `Предпросмотр`.

Переключатели:

- `Desktop`
- `Tablet`
- `Mobile`
- `Inline`
- `Popup`
- `Floating`
- `Success state`
- `Step N`

### Технический подход

Варианты:

1. Рендерить тот же React-компонент публичной формы с локальным config object без API.
2. Использовать iframe preview URL с draft config, сохранённым перед preview.

Предпочтительно в долгосрочной перспективе: вынести render engine в общий компонент, который используется и публичной страницей, и редактором.

### Acceptance criteria

- Изменение цвета сразу видно в preview.
- Изменение полей сразу видно в preview.
- Можно переключить mobile width.
- Можно посмотреть popup/floating вид.
- Preview не создаёт лид.

## 11. Эпик 2: Визуальный календарь записи

### Цель

Сделать booking UI как в референсах: месяц, дни, слоты, детали записи.

### Требования

Календарь должен:

- показывать текущий месяц;
- переключать месяц;
- показывать дни недели;
- выделять выбранную дату;
- скрывать недоступные даты;
- показывать слоты выбранного дня;
- учитывать timezone;
- учитывать длительность слота;
- учитывать буфер;
- учитывать расписание;
- отображаться красиво на мобильном.

### Данные

В `fieldConfig.booking`:

```json
{
  "timezone": "Europe/Zurich",
  "slotMinutes": 30,
  "bufferMinutes": 0,
  "scheduleText": "Пн-Пт 09:00-18:00",
  "availability": {
    "mon": [["09:00", "18:00"]],
    "tue": [["09:00", "18:00"]]
  },
  "blackoutDates": [],
  "maxDaysAhead": 60
}
```

### Payload submit

```json
{
  "booking_date": "2026-06-10",
  "booking_time": "14:00",
  "booking_slot": "14:00-14:30",
  "service": "spa_detox",
  "specialist": "anna"
}
```

### Acceptance criteria

- Пользователь может выбрать дату и слот без ручного ввода.
- В лиде сохраняются дата, время, услуга, специалист.
- На шаге confirmation видно appointment details.

## 12. Эпик 3: Калькулятор цены

### Цель

Форма должна уметь считать стоимость в процессе заполнения.

### Источники цены

- цена услуги;
- цена дополнительной опции;
- количество гостей;
- количество дней;
- длительность;
- промокод;
- ручная скидка;
- условная логика.

### Модель

```json
{
  "pricing": {
    "enabled": true,
    "currency": "USD",
    "showTotal": true,
    "formula": "services + extras - discount",
    "promoCodes": [
      { "code": "SPA5", "type": "percent", "value": 5 }
    ]
  }
}
```

### UI

- Блок `Total price`.
- Подробности расчёта.
- Настройка валюты.
- Настройка текста кнопки.

### Acceptance criteria

- Цена пересчитывается при выборе услуги/опций/гостей.
- Промокод меняет цену.
- Итог сохраняется в лид.
- Итог можно использовать в уведомлениях.

## 13. Эпик 4: Расширенные дизайн-темы

### Цель

Сделать формы визуально готовыми к использованию на коммерческих сайтах.

### Темы

- `Spa / Wellness`
- `Hotel Booking`
- `Clinic`
- `Restaurant Reservation`
- `SaaS Demo`
- `Agency Quiz`
- `Dark Luxury`
- `Minimal White`
- `Colorful Startup`
- `Legal / Consulting`
- `Real Estate`
- `Education`

### Каждая тема должна задавать

- цвета;
- шрифты;
- стиль шапки;
- стиль карточек;
- стиль календаря;
- стиль кнопок;
- стиль progress bar;
- радиусы;
- тени;
- max-width формы;
- mobile behavior.

### Acceptance criteria

- Пользователь выбирает тему и получает красивый результат.
- После выбора темы можно вручную изменить отдельные цвета.
- Тема не ломает существующие поля.

## 14. Эпик 5: Popup/floating настройки 2.0

### Цель

Сделать embed-поведение форм управляемым без кода.

### Popup settings

- ширина;
- max-width;
- max-height;
- fullscreen on mobile;
- blur background;
- overlay color;
- close button style;
- close on ESC;
- close on backdrop click;
- animation;
- position;
- border radius;
- shadow.

### Floating settings

- label;
- icon;
- color;
- text color;
- position;
- delay;
- scroll trigger;
- page include/exclude;
- hide after close N days;
- mobile behavior.

### Auto popup triggers

- after N seconds;
- after scroll X%;
- exit intent;
- click selector;
- page view duration;
- once per session;
- once per N days.

### Acceptance criteria

- Generated embed code includes selected settings.
- `widget.js` respects selected settings.
- Settings work on external sites, not only CRM.

## 15. Эпик 6: Условная логика 2.0

### Цель

Сделать полноценный rule builder.

### Operators

- equals;
- not equals;
- contains;
- not contains;
- greater than;
- less than;
- empty;
- not empty;
- selected;
- not selected;
- in list;
- between.

### Actions

Frontend actions:

- show field;
- hide field;
- show step;
- hide step;
- go to step;
- set field value;
- change final screen;
- change price;
- apply discount.

CRM actions:

- assign tag;
- assign owner;
- set pipeline;
- set status;
- set priority;
- send notification;
- create task.

### UI

Rule builder:

```text
IF [field] [operator] [value]
AND/OR [field] [operator] [value]
THEN [action] [target]
```

### Acceptance criteria

- Можно построить ветвящийся квиз.
- Можно назначить CRM-действия по ответам.
- Логика работает и в preview, и в published embed.

## 16. Эпик 7: Partial submissions / брошенные формы

### Цель

Собирать потенциальные лиды даже если пользователь не дошёл до submit.

### Когда сохранять partial

- пользователь прошёл первый шаг;
- пользователь оставил email/phone;
- пользователь заполнил N полей;
- пользователь выбрал услугу/дату;
- пользователь закрыл popup после заполнения.

### Данные

```json
{
  "formId": "...",
  "publicId": "...",
  "status": "partial",
  "currentStepId": "contacts",
  "fieldValues": {},
  "utm": {},
  "referrer": "",
  "pageUrl": "",
  "startedAt": "",
  "updatedAt": ""
}
```

### CRM UI

- вкладка/фильтр `Брошенные формы`;
- статус `Черновик`, `Брошено`, `Отправлено`;
- кнопка создать лид из partial;
- показывать шаг, на котором пользователь ушёл.

### Acceptance criteria

- Partial не создаёт мусорные полноценные лиды.
- Если пользователь позже отправил форму, partial связывается с финальной заявкой.

## 17. Эпик 8: Уведомления

### Цель

Нужные сотрудники должны получать уведомления сразу после заявки/бронирования.

### Каналы

- email;
- Telegram;
- Slack;
- webhook;
- internal CRM notification.

### Настройки

- включить/выключить по форме;
- получатели;
- разные получатели по условиям;
- шаблон сообщения;
- включать вложения;
- включать UTM;
- включать booking details;
- включать price breakdown;
- не отправлять из preview.

### Acceptance criteria

- После submit отправляется уведомление.
- Ошибка уведомления не ломает submit.
- Есть лог отправки уведомления.

## 18. Эпик 9: Аналитика форм

### Цель

Понимать эффективность форм и находить слабые шаги.

### События

- `form_view`;
- `popup_open`;
- `floating_show`;
- `form_start`;
- `step_view`;
- `step_complete`;
- `field_error`;
- `submit_success`;
- `submit_error`;
- `file_upload`;
- `partial_saved`;
- `popup_close`.

### Метрики

- views;
- starts;
- submissions;
- conversion rate;
- submit errors;
- average completion time;
- drop-off by step;
- conversion by source/UTM;
- conversion by page URL;
- top selected services;
- revenue/expected price if pricing enabled.

### UI

- analytics page for form;
- charts;
- funnel;
- table of events;
- filters by date/site/template/source;
- export CSV.

### Acceptance criteria

- Можно понять, где пользователи уходят.
- Можно сравнить формы и сайты.

## 19. Эпик 10: Библиотека блоков

### Цель

Перейти от формы как списка полей к форме как мини-лендингу.

### Blocks

- `Hero`;
- `Text`;
- `Image`;
- `Divider`;
- `FAQ`;
- `Reviews`;
- `Services list`;
- `Specialists cards`;
- `Calendar`;
- `Price total`;
- `Booking details`;
- `Final screen`;
- `Promo / offer`;
- `Trust badges`;
- `HTML custom block`.

### Модель блока

```json
{
  "id": "block_hero",
  "type": "hero",
  "stepId": "intro",
  "title": "Book an Appointment",
  "subtitle": "Choose service and time",
  "settings": {}
}
```

### Acceptance criteria

- Можно добавить блок на шаг.
- Можно менять порядок блоков.
- Блоки участвуют в preview и public render.

## 20. Дополнительные важные задачи

### 20.1 Дублирование форм

Нужна кнопка `Дублировать`, чтобы быстро создать копию формы с тем же дизайном и полями.

### 20.2 Версии формы

Желательно хранить историю изменений или хотя бы `updatedAt`, чтобы понимать, когда форма менялась.

### 20.3 Импорт/экспорт формы

Возможность экспортировать JSON формы и импортировать его в другой tenant/site.

### 20.4 A/B тесты

В будущем: несколько вариантов формы, split traffic, сравнение конверсий.

### 20.5 Мультиязычность

Настройки языка формы, тексты кнопок, ошибки, privacy consent, success screen.

### 20.6 Accessibility

Формы должны быть доступны:

- labels;
- keyboard navigation;
- focus states;
- aria для ошибок;
- контраст;
- mobile touch targets.

## 21. Рекомендуемый порядок следующих сборок

### Сборка 1: Live preview

- общий render config;
- preview панель;
- device switcher;
- inline/popup/floating preview.

### Сборка 2: Booking calendar

- календарь;
- слоты;
- booking details;
- submit payload.

### Сборка 3: Price calculator

- price metadata;
- total block;
- promo codes;
- save price breakdown.

### Сборка 4: Theme pack

- расширить темы;
- preview карточки тем;
- настройки header/cards/calendar.

### Сборка 5: Popup/floating advanced

- triggers;
- frequency;
- page targeting;
- mobile behavior.

### Сборка 6: Logic 2.0

- advanced operators;
- step jumps;
- CRM actions.

### Сборка 7: Partial submissions

- backend endpoint;
- persistence;
- CRM UI.

### Сборка 8: Notifications

- email/telegram/webhook;
- templates;
- logs.

### Сборка 9: Analytics

- events;
- dashboards;
- funnel/drop-off.

### Сборка 10: Blocks builder

- block model;
- block library;
- public render blocks.

## 22. Definition of done для каждой сборки

Каждая сборка считается готовой, если:

- старые формы открываются и отправляются;
- draft preview работает;
- published embed работает;
- iframe resize работает;
- popup работает;
- floating работает;
- submit не создаёт лид в preview;
- submit создаёт лид в published mode;
- `frontend type-check` проходит;
- `frontend build` проходит;
- `backend build` проходит, если затронут backend;
- изменения выложены на `crm.lumiva.agency`, если задача предполагает deploy.

## 23. Важные анти-паттерны

Не делать:

- не хардкодить конкретный шаблон под один сайт;
- не ломать JSON старых форм;
- не смешивать preview submit с реальным лидом;
- не завязывать публичный render на JWT;
- не добавлять тяжёлые зависимости без необходимости;
- не делать настройки только через код, если менеджер должен менять их в UI;
- не превращать редактор в слишком сложную форму без визуального preview.

## 24. Главный критерий успеха

Клиент CRM должен открыть модуль форм, выбрать красивый шаблон, настроить его без разработчика, вставить на сайт через iframe/popup/floating и получать заявки/брони в CRM. Итоговая форма должна выглядеть профессионально: как современные booking/quiz/popup формы на коммерческих сайтах, а не как технический набор input-полей.
