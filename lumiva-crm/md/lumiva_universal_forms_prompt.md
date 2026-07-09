ле# Промт для ИИ: универсальный движок форм в Lumiva CRM

## Задача

Нужно расширить существующий модуль форм в Lumiva CRM и превратить его в полноценный универсальный конструктор форм для сайта.

Сейчас в CRM уже есть минимальная форма для сайта, выбор сайта, выбор шаблона, базовые настройки дизайна и embed-код через iframe.

Пример текущего embed-кода:

```html
<iframe 
  title="test" 
  src="https://crm.lumiva.agency/embed/EnCgDbqYrEKI8gZ0zKARzw" 
  width="100%" 
  height="700" 
  style="border:0" 
  loading="lazy">
</iframe>
```

Цель: клиент CRM должен иметь возможность создавать красивые, разнообразные и функциональные формы, вставлять их на сайт через iframe, popup-кнопку или floating widget, а все заявки должны попадать в CRM как лиды, заявки, бронирования или записи.

Форма должна быть универсальной: не только простая заявка, но и квиз, запись на услугу, бронирование времени, выбор специалиста, выбор услуги, расчет стоимости, загрузка файлов, бриф и другие сценарии.

---

## Контекст проекта

Проект: Lumiva CRM.

Основной CRM-домен:

```txt
https://crm.lumiva.agency
```

Встраиваемые формы:

```txt
https://crm.lumiva.agency/embed/{formPublicId}
```

В CRM уже есть:

- модуль форм;
- выбор зарегистрированного сайта;
- выбор шаблона формы;
- базовая настройка дизайна;
- поля формы;
- генерация iframe-кода;
- интеграция заявок с CRM.

Нужно не сломать текущий функционал, а расширить его.

---

# 1. Главная концепция

Нужно сделать универсальный form builder внутри CRM.

Администратор / клиент CRM должен иметь возможность:

1. Создать новую форму.
2. Выбрать сайт.
3. Выбрать тип формы или шаблон.
4. Настроить поля.
5. Настроить шаги, если форма многошаговая.
6. Настроить дизайн.
7. Настроить popup / iframe / floating widget.
8. Настроить логику условий.
9. Настроить запись / бронирование, если нужно.
10. Настроить услуги, специалистов, расписание.
11. Настроить финальный экран.
12. Получить код вставки.
13. Видеть все заявки в CRM.
14. При необходимости автоматически создавать лид, задачу, запись или бронь.

---

# 2. Типы форм

Добавить поддержку разных типов форм.

## 2.1 Простые формы

- Форма обращения.
- Позвоните нам.
- Заказать консультацию.
- Запросить коммерческое предложение.
- Техподдержка.
- Оставить бриф / задание.
- Заявка на аудит сайта.
- Заявка на SEO.
- Заявка на рекламу.
- Заявка на разработку сайта.
- Заявка на CRM.
- Заявка на SMM.
- Заявка на дизайн / брендинг.

## 2.2 Квиз-формы

Многошаговые формы, где пользователь проходит несколько вопросов.

Примеры:

- подбор услуги;
- расчет стоимости;
- подбор тарифа;
- бриф на сайт;
- бриф на рекламу;
- бриф на CRM;
- заявка с сегментацией клиента;
- квиз с финальным предложением.

Функции:

- шаги;
- прогресс-бар;
- кнопки назад / далее;
- разные типы вопросов;
- финальный экран;
- условная логика;
- контактные данные в конце;
- сохранение частично заполненной заявки, если пользователь не дошел до конца.

## 2.3 Формы записи

Форма, где пользователь выбирает:

1. Услугу.
2. Специалиста / менеджера / мастера.
3. Дату.
4. Время.
5. Контактные данные.
6. Комментарий.

Примеры:

- запись на консультацию;
- запись к специалисту;
- запись в салон;
- запись в клинику;
- запись на SPA;
- запись на звонок;
- запись на демонстрацию CRM;
- запись на встречу.

## 2.4 Формы бронирования

Форма, где пользователь может выбрать параметры бронирования.

Примеры:

- бронирование номера;
- бронирование услуги;
- бронирование столика;
- бронирование трансфера;
- бронирование мероприятия;
- бронирование консультации;
- групповое бронирование.

Поля:

- дата заезда;
- дата выезда;
- количество гостей;
- тип номера / услуги;
- пожелания;
- контакты;
- промокод;
- источник заявки;
- дополнительные услуги.

---

# 3. Режимы отображения на сайте

Нужно поддержать несколько способов отображения формы.

## 3.1 Inline iframe

Текущий вариант оставить и улучшить.

Форма вставляется на сайт как iframe:

```html
<iframe 
  title="Lumiva Form" 
  src="https://crm.lumiva.agency/embed/{formPublicId}" 
  width="100%" 
  height="700" 
  style="border:0" 
  loading="lazy">
</iframe>
```

Нужно добавить:

- адаптивную высоту;
- postMessage resize, чтобы iframe мог автоматически менять высоту;
- корректную работу на мобильных;
- возможность выбрать тему формы;
- возможность скрыть лишние внешние отступы;
- возможность включить прозрачный фон.

## 3.2 Popup по кнопке

Клиент должен иметь возможность вставить на сайт кнопку, которая открывает popup.

Пример:

```html
<button data-lumiva-form="FORM_ID">
  Оставить заявку
</button>

<script src="https://crm.lumiva.agency/forms/widget.js"></script>
```

При клике открывается popup с формой.

Настройки popup:

- ширина;
- максимальная ширина;
- высота;
- затемнение фона;
- blur background;
- close button;
- закрытие по Esc;
- закрытие по клику вне формы;
- анимация открытия;
- позиция;
- fullscreen на мобильных;
- скругление;
- тень.

## 3.3 Floating button

Плавающая кнопка на сайте.

Настройки:

- текст кнопки;
- иконка;
- цвет;
- цвет текста;
- позиция: справа снизу, слева снизу, справа по центру, слева по центру;
- задержка показа;
- показывать сразу или через N секунд;
- показывать после скролла;
- показывать только на определенных страницах;
- не показывать повторно N дней после закрытия.

## 3.4 Auto popup

Автоматическое открытие формы.

Триггеры:

- через N секунд;
- после скролла X%;
- exit intent;
- после клика по CSS-селектору;
- после просмотра страницы N секунд;
- только один раз за сессию;
- не чаще одного раза в N дней.

---

# 4. Библиотека полей

Нужно сделать полноценную библиотеку полей.

## 4.1 Типы полей

Добавить поля:

1. Текстовое поле.
2. Email.
3. Телефон.
4. Число.
5. Textarea.
6. Select / dropdown.
7. Radio buttons.
8. Checkbox.
9. Multi-checkbox.
10. Date picker.
11. Time picker.
12. Date & time picker.
13. Calendar booking.
14. Выбор услуги.
15. Выбор специалиста / менеджера / мастера.
16. Выбор филиала / локации.
17. Количество гостей / человек.
18. Upload file.
19. Hidden field.
20. UTM field.
21. URL текущей страницы.
22. Consent checkbox.
23. Rating.
24. Range slider.
25. Price calculator.
26. Promo code.
27. HTML / text block.
28. Image block.
29. Divider.
30. Step title.
31. Final screen block.
32. Product / service card.
33. Yes / No field.
34. Address field.
35. Messenger selector: WhatsApp / Telegram / Email / Phone.

## 4.2 Настройки каждого поля

Каждое поле должно иметь настройки:

- label;
- placeholder;
- help text;
- required true / false;
- default value;
- validation;
- min length;
- max length;
- min value;
- max value;
- options для select / radio / checkbox;
- width: 100%, 50%, 33%;
- icon;
- css class;
- system name;
- CRM mapping;
- показывать поле в карточке лида true / false;
- отправлять поле в уведомления true / false;
- скрывать поле по условию;
- значение по умолчанию из UTM / URL / referrer;
- маска ввода, например для телефона;
- кастомная ошибка валидации.

---

# 5. Конструктор формы в CRM

Нужно улучшить UI редактора формы.

## 5.1 Структура редактора

Редактор должен быть разделен на вкладки:

1. Основное.
2. Поля.
3. Шаги.
4. Дизайн.
5. Логика.
6. Запись / бронирование.
7. Уведомления.
8. Интеграции.
9. Код вставки.
10. Предпросмотр.

## 5.2 Основное

Поля:

- название формы в CRM;
- публичное название;
- сайт;
- тип формы;
- шаблон;
- статус активна / выключена;
- язык формы;
- timezone;
- ответственный менеджер;
- теги;
- источник лида;
- pipeline / воронка;
- статус нового лида;
- thank you message;
- redirect URL after submit.

## 5.3 Поля

Вкладка должна позволять:

- добавлять поля;
- удалять поля;
- редактировать поля;
- менять порядок drag & drop;
- группировать поля по строкам;
- настраивать ширину;
- дублировать поле;
- скрывать поле;
- делать поле обязательным;
- маппить поле в CRM.

## 5.4 Шаги

Для квизов и многошаговых форм:

- добавить шаг;
- удалить шаг;
- переименовать шаг;
- менять порядок шагов;
- назначать поля на шаг;
- включить / выключить прогресс-бар;
- задать текст кнопок;
- финальный экран;
- логика перехода между шагами.

## 5.5 Предпросмотр

Нужен live preview:

- desktop;
- tablet;
- mobile;
- inline;
- popup;
- floating button.

При изменении настроек форма должна визуально обновляться.

---

# 6. Условная логика

Нужно добавить визуальный редактор условий.

Пример логики:

```txt
IF service = SEO
THEN show field website_url

IF budget > 1000
THEN assign tag "Hot lead"

IF request_type = Support
THEN show file upload

IF specialist = Any
THEN auto assign available specialist
```

## 6.1 Условия

Поддержать операторы:

- equals;
- not equals;
- contains;
- not contains;
- greater than;
- less than;
- is empty;
- is not empty;
- selected;
- not selected.

## 6.2 Действия

Поддержать действия:

- показать поле;
- скрыть поле;
- показать шаг;
- скрыть шаг;
- перейти на другой шаг;
- изменить финальный экран;
- назначить тег;
- назначить ответственного;
- изменить pipeline;
- изменить статус лида;
- изменить приоритет;
- отправить уведомление;
- рассчитать стоимость;
- показать кастомный текст.

---

# 7. Запись и бронирование

Это ключевой блок.

Нужно реализовать систему записи / бронирования прямо внутри форм.

## 7.1 Сущность Service

Услуга:

```ts
type Service = {
  id: string;
  tenantId: string;
  siteId?: string | null;
  name: string;
  description?: string;
  durationMinutes: number;
  price?: number;
  currency?: string;
  active: boolean;
  category?: string;
  image?: string;
  color?: string;
  sortOrder: number;
};
```

Примеры услуг:

- SEO консультация;
- разработка сайта;
- аудит сайта;
- Wellness massage;
- SPA;
- консультация врача;
- бронирование трансфера;
- групповое размещение;
- MICE-заявка.

## 7.2 Сущность Specialist / Manager

Специалист / менеджер / мастер:

```ts
type Specialist = {
  id: string;
  tenantId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  description?: string;
  active: boolean;
  serviceIds: string[];
  workingHours: WorkingHours;
  breakTimes?: BreakTime[];
  unavailableDates?: string[];
  color?: string;
  sortOrder: number;
};
```

Примеры:

- менеджер продаж;
- SEO специалист;
- аккаунт-менеджер;
- мастер салона;
- врач;
- массажист;
- менеджер отеля.

## 7.3 Сущность Booking

Запись / бронь:

```ts
type Booking = {
  id: string;
  tenantId: string;
  formId: string;
  leadId?: string;
  serviceId?: string;
  specialistId?: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: "new" | "confirmed" | "cancelled" | "completed" | "no_show";
  notes?: string;
};
```

## 7.4 Логика слотов

Слоты должны строиться с учетом:

- выбранной услуги;
- длительности услуги;
- выбранного специалиста;
- рабочего графика специалиста;
- перерывов;
- выходных;
- недоступных дат;
- уже занятых записей;
- capacity;
- буфера между записями;
- минимального времени до записи;
- максимальной глубины записи.

Настройки:

- шаг времени: 15 / 30 / 60 минут;
- timezone;
- разрешить запись только на будущие даты;
- запретить запись меньше чем за X часов;
- максимальная глубина записи: 30 / 60 / 90 / 180 дней;
- лимит записей на слот;
- буфер до и после записи;
- auto assign specialist;
- разрешить "любой специалист";
- скрыть выбор специалиста;
- разрешить выбор нескольких услуг;
- групповая запись.

---

# 8. UI выбора даты, времени, специалиста и услуги

## 8.1 Календарь

Сделать красивый календарь:

- месяц;
- переключение месяцев;
- дни недели;
- доступные даты активные;
- недоступные даты серые;
- выбранная дата подсвечена;
- ниже список доступных временных слотов;
- адаптив под мобильные;
- состояние loading;
- состояние no available slots.

## 8.2 Временные слоты

Отображение:

- кнопки времени;
- выбранный слот подсвечивается;
- недоступные слоты disabled;
- группировка по утро / день / вечер optional.

Пример:

```txt
09:00 - 10:00
10:00 - 11:00
11:00 - 12:00
13:00 - 14:00
14:00 - 15:00
15:00 - 16:00
```

## 8.3 Выбор специалиста

Два режима:

### Простой список

```txt
Anyone
Hannah Wellson
Driana Red
Anna Doe
```

### Карточки

Карточка специалиста:

- avatar;
- name;
- role;
- description;
- checkbox / radio;
- selected state;
- rating optional.

Настройки:

- показывать фото;
- показывать должность;
- показывать описание;
- показывать рейтинг;
- показывать только специалистов выбранной услуги;
- разрешить выбор "любой специалист";
- разрешить множественный выбор.

## 8.4 Выбор услуги

Карточка услуги:

- название;
- описание;
- длительность;
- цена;
- категория;
- изображение optional;
- checkbox / radio;
- selected state.

Настройки:

- одиночный выбор;
- множественный выбор;
- показывать цену;
- показывать длительность;
- показывать описание;
- группировать по категориям;
- считать итоговую стоимость;
- зависимость доступного времени от выбранной услуги.

---

# 9. Дизайн форм

Нужно расширить дизайнер формы.

## 9.1 Глобальные настройки

Добавить настройки:

- фон страницы iframe;
- фон формы;
- фон карточки;
- цвет текста;
- цвет заголовков;
- цвет placeholder;
- цвет border;
- цвет кнопки;
- цвет текста кнопки;
- цвет hover кнопки;
- цвет активного элемента;
- цвет ошибки;
- цвет успешного сообщения;
- радиус скругления;
- тень;
- ширина формы;
- max width;
- внутренние отступы;
- внешние отступы;
- шрифт;
- размер текста;
- размер заголовка;
- расстояние между полями;
- стиль input;
- стиль select;
- стиль checkbox;
- стиль radio;
- стиль календаря;
- стиль progress bar;
- стиль карточек услуг;
- стиль карточек специалистов.

## 9.2 Готовые темы

Добавить дизайн-пресеты:

1. Minimal White.
2. Dark Premium.
3. Soft Pastel.
4. SaaS Clean.
5. Agency Modern.
6. Hotel Luxury.
7. Medical Clean.
8. Beauty / SPA.
9. Corporate.
10. Glassmorphism Light.

Каждый пресет должен менять:

- цвета;
- скругления;
- отступы;
- стиль кнопок;
- стиль инпутов;
- стиль карточек;
- фон.

## 9.3 Mobile responsive

Все формы должны идеально работать на мобильных:

- поля в одну колонку;
- крупные удобные кнопки;
- календарь не выходит за экран;
- popup fullscreen optional;
- iframe height корректный;
- кнопки времени адаптивные;
- карточки услуг и специалистов адаптивные;
- без горизонтального скролла.

---

# 10. Уведомления

После отправки формы нужно поддержать уведомления.

## 10.1 Email

Настройки:

- отправлять уведомление владельцу;
- отправлять ответственному менеджеру;
- отправлять клиенту автоответ;
- кастомная тема письма;
- кастомный текст письма;
- включать все поля формы;
- включать ссылку на лид;
- включать ссылку на запись / бронь.

## 10.2 CRM

После отправки:

- создать лид;
- создать задачу;
- создать booking;
- добавить тег;
- назначить ответственного;
- изменить статус;
- сохранить UTM;
- сохранить referrer;
- сохранить страницу отправки;
- сохранить IP / user agent optional.

## 10.3 Telegram / Webhook optional

Добавить возможность:

- отправить webhook;
- отправить данные в Telegram;
- отправить данные в Make / Zapier / n8n;
- отправить данные на внешний URL.

---

# 11. Интеграция с CRM

Каждая отправка формы должна попадать в CRM.

## 11.1 Lead mapping

Администратор должен настроить, куда маппить поля:

- имя;
- телефон;
- email;
- компания;
- сайт;
- сообщение;
- бюджет;
- услуга;
- специалист;
- дата записи;
- время записи;
- UTM;
- источник;
- кастомные поля.

## 11.2 Лид

Создавать лид с данными:

- tenantId;
- siteId;
- formId;
- formName;
- name;
- phone;
- email;
- message;
- source;
- status;
- pipeline;
- assignedTo;
- tags;
- customFields;
- utm;
- referrer;
- pageUrl;
- createdAt.

## 11.3 Booking

Если форма содержит запись / бронирование, дополнительно создавать Booking:

- service;
- specialist;
- date;
- time;
- duration;
- customer;
- status;
- link to lead.

---

# 12. Аналитика форм

Добавить статистику по формам:

- просмотры формы;
- открытия popup;
- начатые заполнения;
- отправленные заявки;
- conversion rate;
- abandoned quiz;
- популярные ответы;
- популярные услуги;
- популярные даты / время;
- источники UTM;
- страницы сайта;
- устройства desktop / mobile;
- динамика по дням.

В интерфейсе формы показать:

- total views;
- total submissions;
- conversion;
- last submission;
- status active / inactive.

---

# 13. Код вставки

Во вкладке "Код вставки" нужно показывать варианты.

## 13.1 iframe

```html
<iframe 
  title="Lumiva Form" 
  src="https://crm.lumiva.agency/embed/{formPublicId}" 
  width="100%" 
  height="700" 
  style="border:0" 
  loading="lazy">
</iframe>
```

## 13.2 Popup button

```html
<button data-lumiva-form="{formPublicId}">
  Оставить заявку
</button>
<script src="https://crm.lumiva.agency/forms/widget.js"></script>
```

## 13.3 Floating widget

```html
<script 
  src="https://crm.lumiva.agency/forms/widget.js" 
  data-lumiva-floating="{formPublicId}">
</script>
```

## 13.4 Direct link

```txt
https://crm.lumiva.agency/embed/{formPublicId}
```

Добавить кнопку "Скопировать код".

---

# 14. Backend API

Нужно добавить / расширить API.

## 14.1 Forms

```txt
GET    /api/forms
POST   /api/forms
GET    /api/forms/:id
PATCH  /api/forms/:id
DELETE /api/forms/:id
POST   /api/forms/:id/duplicate
POST   /api/forms/:id/publish
POST   /api/forms/:id/unpublish
```

## 14.2 Public embed

```txt
GET  /embed/:publicId
GET  /api/public/forms/:publicId
POST /api/public/forms/:publicId/submit
POST /api/public/forms/:publicId/view
POST /api/public/forms/:publicId/start
```

## 14.3 Services

```txt
GET    /api/form-services
POST   /api/form-services
GET    /api/form-services/:id
PATCH  /api/form-services/:id
DELETE /api/form-services/:id
```

## 14.4 Specialists

```txt
GET    /api/form-specialists
POST   /api/form-specialists
GET    /api/form-specialists/:id
PATCH  /api/form-specialists/:id
DELETE /api/form-specialists/:id
```

## 14.5 Booking slots

```txt
GET /api/public/forms/:publicId/slots?serviceId=&specialistId=&date=
```

## 14.6 Bookings

```txt
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/:id
PATCH  /api/bookings/:id
DELETE /api/bookings/:id
```

---

# 15. Database

Нужно продумать таблицы / сущности.

## 15.1 forms

Поля:

- id;
- tenantId;
- siteId;
- publicId;
- name;
- title;
- description;
- type;
- template;
- status;
- language;
- timezone;
- settingsJson;
- designJson;
- logicJson;
- embedSettingsJson;
- notificationSettingsJson;
- crmMappingJson;
- createdAt;
- updatedAt.

## 15.2 form_fields

Поля:

- id;
- formId;
- stepId nullable;
- type;
- label;
- placeholder;
- helpText;
- required;
- optionsJson;
- validationJson;
- settingsJson;
- mappingJson;
- sortOrder;
- createdAt;
- updatedAt.

## 15.3 form_steps

Поля:

- id;
- formId;
- title;
- description;
- sortOrder;
- settingsJson;
- createdAt;
- updatedAt.

## 15.4 form_submissions

Поля:

- id;
- tenantId;
- siteId;
- formId;
- leadId nullable;
- bookingId nullable;
- status;
- dataJson;
- utmJson;
- pageUrl;
- referrer;
- userAgent;
- ip;
- createdAt.

## 15.5 form_services

Поля:

- id;
- tenantId;
- siteId nullable;
- name;
- description;
- durationMinutes;
- price;
- currency;
- category;
- image;
- active;
- color;
- sortOrder;
- createdAt;
- updatedAt.

## 15.6 form_specialists

Поля:

- id;
- tenantId;
- name;
- role;
- email;
- phone;
- avatar;
- description;
- active;
- workingHoursJson;
- breakTimesJson;
- unavailableDatesJson;
- color;
- sortOrder;
- createdAt;
- updatedAt.

## 15.7 form_specialist_services

Связь many-to-many:

- specialistId;
- serviceId.

## 15.8 bookings

Поля:

- id;
- tenantId;
- formId;
- leadId nullable;
- serviceId nullable;
- specialistId nullable;
- date;
- startTime;
- endTime;
- status;
- customerName;
- customerPhone;
- customerEmail;
- notes;
- dataJson;
- createdAt;
- updatedAt.

---

# 16. Frontend pages

Нужно добавить / улучшить страницы.

## 16.1 Forms list

Список форм:

- название;
- сайт;
- тип;
- статус;
- просмотры;
- заявки;
- конверсия;
- дата создания;
- кнопки: редактировать, дублировать, код, удалить.

## 16.2 New form

Страница создания:

- название в CRM;
- сайт;
- шаблон;
- кнопка "Создать и настроить".

## 16.3 Form editor

Главная страница редактирования формы.

Вкладки:

- Основное;
- Поля;
- Шаги;
- Дизайн;
- Логика;
- Запись / бронирование;
- Уведомления;
- Интеграции;
- Код вставки;
- Предпросмотр.

## 16.4 Services page

Страница управления услугами:

- список услуг;
- создание;
- редактирование;
- удаление;
- активность;
- категория;
- длительность;
- цена.

## 16.5 Specialists page

Страница управления специалистами:

- список специалистов;
- avatar;
- имя;
- должность;
- услуги;
- график работы;
- активность;
- редактирование;
- удаление.

## 16.6 Bookings page

Страница записей / бронирований:

- календарь;
- список записей;
- фильтр по дате;
- фильтр по специалисту;
- фильтр по услуге;
- статус;
- карточка записи;
- ссылка на лид.

---

# 17. UX / UI требования

Дизайн должен соответствовать текущему стилю Lumiva CRM:

- clean;
- minimal;
- SaaS;
- белый фон;
- аккуратные карточки;
- темный текст;
- мягкие границы;
- современные кнопки;
- без перегруза;
- удобно на мобильном.

Для форм на сайте добавить более разнообразные стили:

- минималистичные формы;
- premium dark;
- luxury hotel;
- beauty / spa;
- modern agency;
- corporate;
- soft pastel.

Важно: интерфейс должен быть понятен обычному клиенту, не программисту.

---

# 18. Безопасность

Нужно учесть:

- public forms доступны без авторизации только по publicId;
- нельзя получить данные другого tenant;
- submit должен проверять form active;
- CORS / origin validation по site domain;
- rate limit на отправку форм;
- защита от spam;
- honeypot field;
- optional captcha;
- file upload validation;
- limit file size;
- allowed file types;
- sanitize HTML/text;
- не отдавать приватные настройки во frontend embed;
- не отдавать API keys.

---

# 19. Anti-spam

Добавить настройки:

- honeypot;
- min time to submit;
- max submissions per IP;
- captcha optional;
- block duplicate submissions;
- block disposable emails optional;
- block keywords optional.

---

# 20. File upload

Если форма содержит upload field:

- разрешенные типы файлов;
- максимальный размер;
- multiple true / false;
- хранение файла;
- ссылка на файл в CRM;
- отображение файла в карточке лида;
- защита от небезопасных расширений.

---

# 21. UTM и tracking

Автоматически сохранять:

- utm_source;
- utm_medium;
- utm_campaign;
- utm_content;
- utm_term;
- pageUrl;
- referrer;
- userAgent;
- device;
- language;
- timezone.

Для iframe нужно получать данные через query params или postMessage от parent page.

---

# 22. Embed widget.js

Нужно создать публичный JS-файл:

```txt
https://crm.lumiva.agency/forms/widget.js
```

Он должен:

- находить кнопки с `data-lumiva-form`;
- открывать popup;
- поддерживать floating widget;
- добавлять iframe внутрь popup;
- слушать postMessage resize;
- закрывать popup;
- поддерживать auto popup triggers;
- не конфликтовать с сайтом клиента;
- быть легким и безопасным.

---

# 23. Acceptance Criteria

Задача считается выполненной, если:

1. Можно создать форму любого типа.
2. Можно выбрать шаблон.
3. Можно добавить любые поля.
4. Можно создать многошаговую форму.
5. Можно настроить дизайн.
6. Можно создать форму записи с услугой, специалистом, датой и временем.
7. Слоты времени корректно считаются.
8. Можно создать popup-форму.
9. Можно создать floating button.
10. Можно получить iframe-код.
11. Можно получить popup-код.
12. Все отправки попадают в CRM.
13. Если есть запись, создается Booking.
14. Если есть заявка, создается Lead.
15. UTM и pageUrl сохраняются.
16. Форма работает на мобильных.
17. Форма работает в iframe.
18. Popup работает на сайте клиента.
19. Есть защита от спама.
20. Нельзя получить данные другого tenant.
21. Есть список заявок.
22. Есть список записей.
23. Есть предпросмотр формы.
24. Есть статистика по форме.
25. Старый функционал форм не сломан.

---

# 24. Рекомендация по этапам реализации

## Этап 1. Архитектура

- проверить текущий модуль форм;
- понять существующие сущности;
- не ломать текущие API;
- добавить миграции;
- добавить новые JSON settings;
- добавить publicId, если его нет.

## Этап 2. Новый редактор форм

- вкладки;
- поля;
- дизайн;
- preview;
- embed code.

## Этап 3. Многошаговые формы

- steps;
- progress bar;
- next / back;
- final screen.

## Этап 4. Услуги и специалисты

- CRUD услуг;
- CRUD специалистов;
- связь специалиста и услуги;
- график работы.

## Этап 5. Booking engine

- генерация слотов;
- проверка доступности;
- создание booking;
- отображение записей.

## Этап 6. Popup / widget.js

- popup button;
- floating button;
- auto popup;
- iframe resize.

## Этап 7. Аналитика и антиспам

- views;
- starts;
- submissions;
- conversion;
- spam protection.

## Этап 8. Финальная полировка

- mobile;
- дизайн-пресеты;
- тестирование;
- багфикс;
- защита tenant isolation.

---

# 25. Важные требования

- Делать аккуратно и постепенно.
- Не ломать существующую CRM.
- Соблюдать текущий дизайн Lumiva.
- Не удалять старые формы.
- Сохранять обратную совместимость embed-ссылок.
- Все новые данные должны быть привязаны к tenantId.
- Все public endpoints должны быть безопасными.
- Форма должна быть реально красивой, а не просто технической.
- Конструктор должен быть удобным для клиента без знаний кода.
- Код должен быть чистым, поддерживаемым и расширяемым.

---

# 26. Финальный результат

В результате в Lumiva CRM должен появиться полноценный универсальный модуль форм, который позволит клиентам создавать:

- обычные формы заявок;
- popup-формы;
- floating forms;
- квизы;
- формы записи;
- формы бронирования;
- формы выбора услуги;
- формы выбора специалиста;
- формы с календарем;
- формы с расчетом стоимости;
- формы с файлами;
- формы для любых ниш бизнеса.

Каждая форма должна легко вставляться на сайт через iframe или JS-widget, красиво выглядеть, корректно работать на мобильных и автоматически передавать все данные в CRM.
