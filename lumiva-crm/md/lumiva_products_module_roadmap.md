# Lumiva CRM: модуль «Товары» с настраиваемыми полями — ТЗ и план реализации

Этот документ — исходное ТЗ и пошаговый план для модуля «Товары» (Products): карточка товара с
предустановленными полями (название, артикул, количество, цена…) плюс произвольные кастомные поля,
которые клиент сам создаёт в настройках — по образцу ACF (Advanced Custom Fields) в WordPress,
референс на который клиент прислал (скриншоты его текущего сайта на другом стеке). Плюс —
вариативные товары (цвет/размер и т.п.) и раздел «Склад» с остатками по каждому варианту.
Записан как промт/ТЗ для дальнейшей разработки, в том же формате, что
`lumiva_universal_forms_roadmap.md`.

## 0. Роль исполнителя

Работаешь как senior full-stack инженер в существующем проекте Lumiva CRM (backend: NestJS +
TypeORM + Postgres, frontend: React + Vite + Tailwind). Задача — не изобретать движок
кастомных полей с нуля, а **грамотно переиспользовать уже существующий в проекте механизм**
(модуль `custom-objects`, см. раздел 2) и достроить вокруг него товарную специфику: остаток,
цену, SKU, вариации (цвет/размер), склад, привязку к продажам, публичный API для внешнего
сайта клиента.

## 1. Что просит клиент (пересказ задачи)

У клиента есть внешний сайт (свой домен, свой стек — не Lumiva), на котором уже есть похожая
концепция: карточка объекта (в примере — объект недвижимости) с полями, часть из которых —
системные (ID, тип, цена, страна/город/район, даты, статус, отделка, этажность, расстояние до
моря/аэропорта), часть — динамический список чекбоксов «Функции» (бассейн, вайфай, консьерж…).
Поля админ добавляет сам через конструктор полей (ACF): выбирает тип поля (Text, Дата, Time,
Datetime, Textarea, WYSIWYG, Switcher, Checkbox, Iconpicker, Media, Gallery, Radio, Repeater,
Select, Number, Colorpicker, Записи/Relation, HTML, Map), затем настраивает параметры конкретно
для этого типа (у Select — список опций и переключатель «брать опции из глоссария»; у Number —
min/max/step; и т.п.), помечает поле обязательным/нет, задаёт ширину и т.д.

Клиент хочет то же самое **внутри Lumiva**, но для универсального модуля «Товары» (не только
недвижимость — любой товар: услуги, номера, товары интернет-магазина и т.п.):

1. Настройки → вкладка **«Типы полей»** — конструктор полей карточки товара.
2. Форма создания/редактирования товара — рендерится динамически по настроенным полям.
3. Список товаров — таблица в духе текущих списков (Лиды и т.п.): ID, название, количество,
   цена и т.д. + кастомные колонки.
4. Импорт и экспорт товаров.
5. **Вариативные товары**: у товара есть галочка «Вариативный товар» — если включена, у товара
   появляются атрибуты (например, цвет и размер), и по каждой комбинации атрибутов (напр.
   «Красный / M») — свой остаток. Отдельная графа в подменю «Товары» — **«Склад»**: показывает,
   какого товара, какого варианта (цвета/размера и т.п.) и сколько осталось.

## 2. Что уже есть в Lumiva и должно быть переиспользовано (важно!)

В проекте **уже существует** почти готовый движок пользовательских объектов с динамическими
полями — модуль `custom-objects` (frontend: раздел «Рабочая область» / `/workspace`). Он не
называется «Товары», но решает 80% той же задачи, и именно поэтому дальнейшая разработка идёт
по пути **дополнения**, а не написания второго похожего движка с нуля.

Уже реализовано и проверено в бою:

- `backend/src/custom-objects/custom-object.entity.ts` — объект (аналог «типа сущности»):
  `name`, `slug`, `description`, `workspaceAreaId`, `meta: jsonb`, `isActive`.
- `backend/src/custom-objects/custom-object-field.entity.ts` — определение поля: `key`, `label`,
  `type` (`text|number|date|datetime|boolean|status|select|multiselect|file`), `required`,
  `options: {value,label}[]` (для select/multiselect), `order`, `isActive`, `meta: jsonb`
  (свободный бэг — уже сейчас можно класть туда per-type настройки без миграций).
- `backend/src/custom-objects/custom-object-record.entity.ts` — запись: `values: jsonb`,
  `externalId` (для апсертов через импорт/API), `meta`.
- `backend/src/custom-objects/custom-object-view.entity.ts` — представления `table|kanban|calendar`.
- CRUD на все это: `custom-objects.controller.ts` (`/custom-objects/:objectId/fields`,
  `/records`, `/views`, `/analytics`, `/records/distinct-values`, `/records/push-to-board`…).
- **Импорт**: `custom-objects.service.ts` → `parseXlsx` (ExcelJS, реальный `.xlsx`) и `parseCsv`
  (`parseCsvRobust` из `backend/src/lib/import-spreadsheet.util.ts`), `previewImport`/
  `applyImport` с автоподбором маппинга колонка→поле (`buildSuggestedCustomObjectFieldMapping`),
  апсертом по `externalId`, авто-расширением опций select при импорте новых значений
  (`extendImportFieldOptions`). Только что (см. `previewHeadlessImport`/`attachImportAndApply`)
  добавлен «безголовый» предпросмотр файла без готовой таблицы — ровно то, что нужно для
  сценария «сначала загрузили файл, потом выбрали/создали товарный тип».
- **Внешний API**: `custom-objects-public.controller.ts` → `POST /public/custom-objects/:slug/ingest`
  под `ApiTokenGuard` (`backend/src/api-tokens/`) — уже готовый механизм, которым внешний сайт
  клиента может пушить записи по tenant API-токену с идемпотентностью
  (`x-idempotency-key`). Это прямое решение задачи «сайт на другом стеке» — токен уже есть в
  Настройках CRM (`crm.settings.api`, см. `backend/src/settings` / `frontend` `crm.settings.api.*`).
- Frontend: `frontend/src/pages/workspace/WorkspaceTableViewPage.tsx` и соседи — таблица,
  канбан, фильтры, редактор полей, импорт-мастер уже реализованы для custom-objects.

**Чего не хватает даже в custom-objects (тоже почини по пути, если время позволяет):**
- Экспорта записей в CSV/XLSX нет вообще (`grep` не находит ни одного `export`-эндпоинта в
  `custom-objects.controller.ts`) — то есть «импорт/экспорт товаров», который просит клиент,
  частично не существует даже для базового движка. Экспорт нужно добавить один раз и он
  автоматически станет доступен и для «Товаров» (см. раздел 8).

## 3. Как это устроено у зрелых CRM/e-commerce (ориентир)

Коротко, чтобы не изобретать велосипед и не собрать «детскую» версию:

- **HubSpot** — Products — отдельный первоклассный объект (как Contacts/Deals), с
  «Properties» (custom fields) через тот же движок, что у Deals/Contacts; товары привязываются
  строками (line items) к сделкам с ценой/количеством на момент продажи.
- **Salesforce** — `Product2` + `PricebookEntry` (цена может отличаться по прайс-листам), плюс
  стандартный конструктор кастомных полей платформы (тот же, что для любого объекта); товары
  тоже цепляются к Opportunity как line items.
- **Zoho CRM / Bitrix24** — модуль «Товары/Каталог»: SKU, единица измерения, остаток, цена,
  секции (категории), кастомные поля через тот же field-builder, что у лидов/сделок; в Bitrix24
  явно есть склад/остатки как отдельная опция, включая множественные склады.
- **Airtable / monday.com** (ближе всего к текущему `custom-objects`) — универсальные таблицы с
  типами колонок; но в проде поверх такой универсальной таблицы обычно всё равно делают
  специализированный «Products» шаблон с фиксированными смысловыми колонками (цена, остаток).
- **WooCommerce/Shopify** (то, что смотрит клиент через ACF, и прямой референс для вариаций) —
  сильный акцент на: SKU (уникальность), остаток (stock quantity + порог «мало на складе»),
  галерею изображений, категории/атрибуты, статус публикации. **Вариативные товары** устроены
  так: у товара есть набор **атрибутов** (напр. «Цвет», «Размер»), каждый атрибут — переиспользуемый
  на уровне магазина справочник значений (Цвет: Красный/Синий/Зелёный); товар помечается как
  «вариативный» и выбирает, какие атрибуты у него участвуют в вариациях; система (или админ)
  генерирует **комбинации** атрибутов = **варианты** (Variations), и у каждого варианта — свой
  SKU, свой остаток, опционально своя цена/фото. Склад в такой модели всегда считается **по
  варианту**, а не по товару — сумма по товару чисто витринная (агрегат).

**Вывод и рекомендация:** сделать «Товары» отдельным первоклассным модулем (свой пункт меню,
свои структурные поля: `sku`, `quantity`, `price`, `currency`, `category`, `status`, `images`,
`unit`, `isVariable`), а не ещё одним `custom-objects`-объектом — потому что (а) остаток/цена/SKU
нужны как настоящие типизированные колонки для быстрой фильтрации/сортировки, будущей интеграции
с Продажами и корректного учёта остатков по вариантам, а не как значения внутри `values jsonb`;
(b) в навигации и голове пользователя «Товары» — это ядро CRM, а не пользовательская таблица из
«Рабочей области». При этом **таксономию типов кастомных полей, per-type настройки и сам UX
конструктора полей — скопировать и адаптировать из custom-objects**, а не придумывать заново
(см. раздел 7). Модель вариаций — по образцу WooCommerce/Shopify (Attributes → Variants), как
самой проверенной и понятной клиенту схемы.

## 4. Модель данных

Новый модуль `backend/src/products/`.

```text
products                  — сам товар (карточка)
product_field_defs        — определения кастомных полей (аналог custom_object_field)
product_categories        — категории (плоский список в v1)
product_attributes        — переиспользуемые атрибуты тенанта (Цвет, Размер…) — для вариаций
product_variants          — конкретные варианты товара (Красный/M) — если товар вариативный
product_stock_movements   — журнал движения остатков (приход/списание/продажа/инвентаризация)
```

### `products`

| Колонка | Тип | Комментарий |
|---|---|---|
| id | uuid | |
| tenantId | uuid | |
| sku | varchar(64), nullable | уникален в пределах тенанта; для вариативного товара — «родительский» SKU/артикул, необязателен, т.к. реальные SKU на вариантах |
| name | varchar(255) | |
| description | text, nullable | |
| categoryId | uuid, nullable | FK → `product_categories` |
| status | varchar(32) | `active \| draft \| archived \| out_of_stock` |
| price | numeric(14,2) | базовая цена; для вариативного товара — это «цена по умолчанию», конкретный вариант может её переопределить |
| costPrice | numeric(14,2), nullable | закупочная |
| currency | char(3) | по образцу `Sale.currency` |
| isVariable | boolean, default false | «Вариативный товар» — чекбокс с макета клиента |
| variantAttributeIds | jsonb, nullable | массив id из `product_attributes`, участвующих в вариациях ЭТОГО товара (напр. [Цвет, Размер]); заполняется только если `isVariable=true` |
| quantity | integer, default 0 | остаток; **для невариативного товара — реальный, редактируемый остаток; для вариативного — вычисляемая сумма остатков всех активных `product_variants` (read-only, не редактируется напрямую)** |
| lowStockThreshold | integer, nullable | «мало на складе» — подсветка в списке/на складе |
| unit | varchar(32), nullable | шт/м²/кг/ночь и т.п. |
| images | jsonb, default `[]` | `[{url, isCover}]`, общая галерея товара (у варианта может быть своя, см. ниже) |
| externalId | varchar(255), nullable | для апсерта из импорта/публичного API |
| customFields | jsonb, default `{}` | значения кастомных полей, ключ = `ProductFieldDef.key` |
| isDeleted | boolean, default false | мягкое удаление, как у `Project`/`Lead` |
| createdAt / updatedAt | timestamptz | |

Индексы: `(tenantId, status)`, `(tenantId, categoryId)`, `(tenantId, createdAt)`,
`(tenantId, sku) unique where sku is not null`.

### `product_field_defs`

Практически повтор `CustomObjectField`, без `objectId` (в v1 у тенанта один «тип» товара —
специфика на потом решается категориями/тегами, не отдельными типами сущности):

```ts
key: string;            // латиница/цифры/подчёркивание, уникален в тенанте
label: string;
type: ProductFieldType; // см. раздел 7
required: boolean;
options: {value,label}[] | null;   // select / multiselect / radio
settings: Record<string, any> | null; // per-type настройки, см. раздел 7 (аналог field.meta)
order: number;
width: '25' | '50' | '75' | '100';    // как в ACF на скриншоте 4
group: string | null;   // «секция» полей на форме, если полей много (Phase 2)
showInList: boolean;    // колонка в таблице товаров
showInQuickEdit: boolean;
isActive: boolean;
createdAt / updatedAt;
```

### `product_categories` (простая версия v1)

```ts
id, tenantId, name, slug, order, isActive, createdAt, updatedAt
```

### `product_attributes` (переиспользуемые атрибуты — Цвет/Размер и т.п.)

```ts
id, tenantId,
name: string,               // «Цвет»
slug: string,
values: { id: string; value: string; label: string; colorHex?: string }[], // Красный/Синий/…
                             // colorHex опционален — красивый свотч, если атрибут = цвет
order: number,
isActive: boolean,
createdAt, updatedAt
```

Атрибуты — тенант-wide справочник (как в WooCommerce «Global attributes»): один раз завели
«Размер» со значениями S/M/L/XL, дальше переиспользуют на любом товаре. Это осознанный выбор
вместо локальных атрибутов на каждый товар — меньше дублирования, единообразные фильтры на
складе и в будущей витрине.

### `product_variants` (конкретные комбинации — реальные SKU и остатки)

```ts
id, tenantId, productId,
attributeValues: Record<attributeId, valueId>, // { "<Цвет.id>": "<Красный.id>", "<Размер.id>": "<M.id>" }
sku: string | null,          // уникален в тенанте, если задан
quantity: integer default 0, // РЕАЛЬНЫЙ остаток — редактируется только здесь (и через движения, см. ниже)
priceOverride: numeric(14,2) | null, // если null — используется products.price
images: jsonb | null,        // если null — используется products.images (напр. фото по цвету)
isActive: boolean,
createdAt, updatedAt
```

Индексы: `(tenantId, productId)`, `(tenantId, sku) unique where sku is not null`,
`(tenantId, productId, attributeValues) unique` (через генерируемый хэш комбинации — не давать
создать два одинаковых варианта).

### `product_stock_movements` (журнал остатков — то, что реально делает раздел «складом», а не
просто редактируемым числом)

```ts
id, tenantId,
productId,
variantId: uuid | null,        // null — движение по невариативному товару
type: 'in' | 'out' | 'adjustment' | 'sale' | 'return',
quantityDelta: integer,        // +5 / -2
resultingQuantity: integer,    // снапшот остатка ПОСЛЕ движения (для истории/аудита)
reason: text | null,           // «Инвентаризация», «Приход от поставщика», ссылка на заказ и т.п.
userId: uuid | null,           // кто сделал (null — если через публичный API/автоматику)
source: varchar(40) | null,    // 'manual' | 'import' | 'public_api' | 'sale'
createdAt: timestamptz
```

Любое изменение `quantity` (у товара или варианта) идёт **через сервис**, который параллельно
пишет строку в `product_stock_movements` — без прямого `UPDATE products SET quantity=...` в
обход журнала. Это то, что отличает «Склад» от простого поля «Количество» на карточке, и то, что
клиент неявно подразумевает словом «склад».

**Почему не переиспользовать таблицы `custom_object_fields`/`custom_object_records` буквально:**
рассматривали вариант «завести один `CustomObject` со slug `products` под капотом» — отказались,
потому что тогда remainder/price/sku/variants пришлось бы либо дублировать как структурные
колонки И как `values.*` (рассинхрон), либо жить только в `values jsonb` (проблемы с
уникальностью SKU, индексами, агрегацией остатков по вариантам, будущими FK из Sales line
items). Вместо этого **общий код** — это:
- одинаковый enum типов кастомного поля и одинаковая форма «настройки под тип» на фронте
  (компонент конструктора поля буквально копируется/параметризуется с `custom-objects`);
- один и тот же `ExcelJS`/`parseCsvRobust` пайплайн импорта (см. раздел 8);
- один и тот же `ApiTokenGuard`/`x-idempotency-key` паттерн для публичного API (раздел 9).

## 5. Вариации и «Склад» — сценарий использования

**На карточке товара** (`ProductFormPage`): чекбокс «Вариативный товар». При включении —
появляется блок «Атрибуты вариаций»: мультиселект существующих `product_attributes` (+ кнопка
«Создать атрибут» инлайн, если нужного ещё нет) — напр. выбрали «Цвет» и «Размер». Дальше —
кнопка «Сгенерировать варианты», которая строит декартово произведение выбранных значений
(Красный×S, Красный×M, Синий×S, Синий×M…) и показывает редактируемую таблицу: Вариант | SKU |
Остаток | Цена (опционально) | Фото (опционально) | Активен. Это ровно тот UX, который у
WooCommerce в разделе Variations — самый обкатанный и понятный клиенту паттерн. Поштучное
удаление/повторная генерация при смене набора атрибутов — без потери уже введённых остатков
там, где комбинация не изменилась.

**Раздел «Склад»** (`frontend/src/pages/products/StockPage.tsx`, подпункт меню «Товары →
Склад»): плоская таблица, одна строка = один вариант (для невариативных товаров — одна строка =
товар). Колонки: Товар (с миниатюрой), Вариант (человекочитаемо — «Красный / M»), SKU, Остаток,
Статус остатка (в наличии / мало / нет в наличии — по `lowStockThreshold`), Категория. Фильтры:
по товару, категории, статусу остатка, только вариативные/только простые. Инлайн-корректировка
остатка (+/− с обязательным полем «причина») — пишет строку в `product_stock_movements`, не
редактирует число напрямую в обход журнала. Дополнительно — история движений по конкретному
варианту (модалка/панель) для аудита.

## 6. Backend: сервисы и эндпоинты

```text
backend/src/products/
  product.entity.ts
  product-field-def.entity.ts
  product-category.entity.ts
  product-attribute.entity.ts
  product-variant.entity.ts
  product-stock-movement.entity.ts
  products.service.ts
  product-variants.service.ts      — генерация комбинаций, CRUD вариантов
  product-stock.service.ts         — движения остатков, агрегация quantity вариативного товара
  products.controller.ts           — CRM-эндпоинты (JwtAuthGuard)
  products-public.controller.ts    — внешний API (ApiTokenGuard)
  products.module.ts
  dto/*.dto.ts
```

CRM API (по образцу `custom-objects.controller.ts` и `leads.controller.ts`):

```text
GET    /products                       — список (пагинация, фильтры: status, categoryId,
                                          isVariable, search по name/sku, sort, диапазон
                                          price/quantity)
POST   /products
GET    /products/:id
PATCH  /products/:id
DELETE /products/:id                   — soft delete
POST   /products/:id/duplicate

GET    /products/field-defs
POST   /products/field-defs
PATCH  /products/field-defs/:id
DELETE /products/field-defs/:id
POST   /products/field-defs/reorder    — drag&drop порядок

GET    /products/categories
POST   /products/categories
PATCH  /products/categories/:id
DELETE /products/categories/:id

GET    /products/attributes                    — список атрибутов тенанта (Цвет, Размер…)
POST   /products/attributes
PATCH  /products/attributes/:id
DELETE /products/attributes/:id
POST   /products/attributes/:id/values          — добавить значение (Красный)
DELETE /products/attributes/:id/values/:valueId

GET    /products/:id/variants
POST   /products/:id/variants/generate          — { attributeIds: [...] } → создаёт недостающие
                                                   комбинации, не трогает существующие
PATCH  /products/:id/variants/:variantId
DELETE /products/:id/variants/:variantId

GET    /products/stock                          — раздел «Склад»: плоский список товар×вариант
                                                   с остатками (фильтры как в разделе 5)
POST   /products/stock/adjust                   — { productId, variantId?, delta, reason } →
                                                   пишет product_stock_movements, обновляет
                                                   quantity (и пересчитывает сумму на товаре,
                                                   если это вариант)
GET    /products/stock/movements?productId=&variantId= — история движений

POST   /products/import/preview        — как custom-objects: ExcelJS/CSV, без готовой сущности
                                          не нужно (categoryId опционален); поддержать импорт
                                          вариантов через колонки вида `Вариант: Цвет`/
                                          `Вариант: Размер` + `SKU варианта`/`Остаток варианта`
POST   /products/import/apply
GET    /products/export                — CSV/XLSX, см. раздел 8 (этого нет даже в custom-objects
                                          — сделать сразу правильно); для вариативных товаров —
                                          одна строка на вариант
```

Публичный API (для сайта клиента на другом стеке, токен из Настроек → API):

```text
GET  /public/products                  — список активных товаров (для витрины на внешнем сайте),
                                          вариативные — с вложенным массивом `variants`
GET  /public/products/:externalIdOrSku
POST /public/products/ingest           — апсерт товара (и вариантов, если переданы) по
                                          externalId/sku, идемпотентность как у custom-objects
                                          ingest (x-idempotency-key)
PATCH /public/products/stock           — { sku или variantSku, delta или absolute } — точечное
                                          обновление остатка (частый кейс: заказ оформлен на
                                          сайте → нужно быстро списать remainder конкретного
                                          варианта, без пересылки всей карточки); тоже пишет
                                          product_stock_movements с source='public_api'
```

`ProductsService.buildRecordValues`/`validateCustomFields` — валидация `customFields` по
`product_field_defs` при создании/обновлении товара: обязательные поля, допустимые типы,
допустимые `options` для select/radio — переиспользовать логику валидации, уже написанную для
`CustomObjectRecord` (`normalizeRecordValues` в `custom-objects.service.ts`), либо вынести её в
`backend/src/lib/` как общую утилиту `normalizeDynamicFieldValues()`, которой будут пользоваться
и `custom-objects`, и `products` — это единственное место, где стоит потратить время на реальное
обобщение кода между модулями, всё остальное — просто скопировать паттерн.

## 7. Типы кастомных полей и их настройки

Список ниже — адаптация ACF-типов со скриншота клиента под то, что реально нужно для карточки
товара, с явным делением на v1 (сделать сразу) и Phase 2 (задел, не блокирует релиз). Обратите
внимание: «Вариативный товар»/атрибуты вариаций — это **не** тип кастомного поля, а отдельный
структурный механизм из раздела 5, не смешивать с `product_field_defs`.

| Тип (`ProductFieldType`) | v1? | Настройки (`settings jsonb`) |
|---|---|---|
| `text` | ✅ | `placeholder`, `maxLength`, `defaultValue` |
| `textarea` | ✅ | `rows`, `maxLength` |
| `number` | ✅ | `min`, `max`, `step`, `decimals`, `isCurrency` |
| `date` | ✅ | `minDate`, `maxDate` |
| `datetime` | ✅ | — |
| `boolean` (switcher) | ✅ | `labelOn`, `labelOff` |
| `select` (одиночный) | ✅ | `options: {value,label}[]` |
| `multiselect` / `checkbox-group` | ✅ | `options: {value,label}[]` — это ровно кейс «Функции» со скриншота 1 |
| `radio` | ✅ | `options: {value,label}[]` |
| `url` | ✅ | `allowedProtocols` |
| `media` (одно изображение/файл) | ✅ | `accept` (mime), `maxSizeMb` |
| `gallery` (много изображений) | ✅ | `accept`, `maxSizeMb`, `maxCount` |
| `wysiwyg` (rich text) | ⏳ Phase 2 | `toolbarPreset` |
| `colorpicker` | ⏳ Phase 2 | `palette: string[]` |
| `relation` («Записи» — связь с др. товаром/категорией) | ⏳ Phase 2 | `targetType`, `multiple` |
| `repeater` (вложенная мини-таблица, напр. «характеристики: ключ/значение») | ⏳ Phase 2 | `subFields: FieldDef[]` |
| `iconpicker`, `map` | ❌ не делаем | низкая ценность для товарной карточки, ACF-специфика недвижимости |

Общие настройки поля (не зависят от типа, есть у всех — как на скриншоте 4):
`required`, `width` (25/50/75/100%), `description` (текст-подсказка под полем),
`showInList`, `showInQuickEdit`, `defaultValue` (где применимо).

Разница с ACF: у ACF есть переключатель «Get options from the glossary» — в Lumiva ближайший
аналог — брать `options` из уже существующего `custom_object` (например, у тенанта есть
рабочая таблица «Города» — дать возможность указать `optionsSource: {objectId, labelField}`
вместо статичного списка). Это Phase 2 — в v1 просто статичный список опций, вводимый вручную,
этого достаточно для запуска.

## 8. Импорт / экспорт

**Импорт** — буквально переиспользовать то, что уже сделано для файлового вложения в ИИ-чат
(см. `backend/src/custom-objects/custom-objects.service.ts` → `previewHeadlessImport` /
`attachImportAndApply`, добавленные в этой же кодовой базе для workspace-таблиц): тот же
`parseXlsx`/`parseCsv`, тот же принцип «сначала предпросмотр без сущности → потом применение
с выбранным маппингом колонка→поле». Для товаров дополнительно: колонка `sku`/`externalId`
используется для апсерта (обновить существующий товар, а не создать дубль), колонки, не
совпавшие ни с одним структурным полем (`name`,`price`,`quantity`,`sku`…) и ни с одним
`product_field_defs.key/label`, — предлагать создать как новое кастомное поле «на лету» (частый
паттерн у Airtable/HubSpot при импорте). Для вариативных товаров — поддержать «широкий» формат
(колонки `Вариант: Цвет`, `Вариант: Размер`, `SKU варианта`, `Остаток варианта` на той же
строке, что и родительский товар, как в экспортах WooCommerce) — несколько строк с одинаковым
`sku`/`name` родителя схлопываются в один товар с несколькими вариантами.

**Экспорт** — этого нет даже в `custom-objects`, добавить с нуля:
`GET /products/export?format=xlsx|csv&status=&categoryId=` — генерация файла через тот же
`ExcelJS`, что уже используется в `backend/src/automations/reports.service.ts` для XLSX-отчётов
(готовый прецедент в проекте, просто переиспользовать). Колонки — структурные поля + все
активные `product_field_defs` (с `label` в заголовке); для вариативных товаров — по одной строке
на вариант, с колонками атрибутов и остатком варианта. Сразу сделать так же для `custom-objects`
(`GET /custom-objects/:objectId/export`) — минимальный доп. код, закрывает пробел, который иначе
клиент найдёт следующим сообщением.

## 9. Публичный API / интеграция с внешним сайтом

Сайт клиента на другом стеке не имеет доступа к сессии CRM — только к tenant API-токену
(`Настройки → API`, уже реализовано, `backend/src/api-tokens/`). Схема:

- **Внешний сайт → CRM (пуш остатков/новых позиций)**: `POST /public/products/ingest` с
  заголовком `X-Api-Token`, как уже устроено в `custom-objects-public.controller.ts`
  (`ApiTokenGuard`) — апсерт по `sku`/`externalId` (и вариантам внутри, если переданы),
  идемпотентность через `x-idempotency-key`, чтобы повторный вебхук не создавал дублей.
  `PATCH /public/products/stock` — узкий, частый вызов «списать N по SKU варианта после
  заказа», без пересылки всей карточки.
- **CRM → внешний сайт (витрина товаров)**: `GET /public/products` — можно вызывать без токена
  (публичный каталог, если клиент хочет вывести товары на сайте) или тоже под токеном, если
  каталог приватный — вынести решение в `platform-settings`/флаг на товаре (`isPubliclyVisible`).
  Уточнить у клиента при реализации: нужен ли вообще публичный read-каталог, или синхронизация
  только «сайт → CRM» (учёт остатков), а сама витрина рисуется на стороне сайта из его же БД.
- Задокументировать эти эндпоинты в `crm.settings.api.usageBody`-подобном месте в UI Настроек
  (там уже есть блок «Where this token is used» — просто добавить туда товарные примеры
  curl-запросов, включая пример апдейта остатка варианта).

## 10. Frontend

```text
frontend/src/pages/products/
  ProductsListPage.tsx       — таблица (паттерн LeadsListPage.tsx): колонки ID/Фото/Название/
                                SKU/Категория/Остаток/Цена/Статус/Вариативный + кастомные
                                showInList-поля, поиск, фильтры по статусу/категории, бэйдж
                                «мало на складе», bulk-действия (изменить статус/категорию,
                                удалить), кнопки «Импорт»/«Экспорт»/«Добавить товар»
  ProductFormPage.tsx        — создание/редактирование: структурные поля сверху (название,
                                SKU, цена, категория, статус, галерея), чекбокс «Вариативный
                                товар» → блок атрибутов + таблица сгенерированных вариантов
                                (см. раздел 5) вместо простого поля «Остаток», затем блок
                                кастомных полей, отрендеренный динамически по
                                product-field-defs (компонент DynamicFieldInput,
                                type→component switch)
  StockPage.tsx               — раздел «Склад» (см. раздел 5): плоская таблица товар×вариант,
                                инлайн-корректировка остатка, история движений
  ProductAttributesPage.tsx  — управление атрибутами (Цвет/Размер…) и их значениями
  ProductImportModal.tsx     — предпросмотр/маппинг, как у workspace-импорта
  ProductFieldTypesPage.tsx  — вкладка «Типы полей» ВНУТРИ раздела «Товары» (не в общих
                                Настройках CRM и не в «Рабочей области»): список полей (drag
                                reorder), «+ Добавить поле» → модалка: Label/Key(auto-slug)/
                                Type/Required/Width/Description + блок «настройки под тип»,
                                который меняется по выбранному Type (1:1 с ACF-скриншотом 4
                                клиента)
frontend/src/api/products.ts — fetchProducts/createProduct/updateProduct/deleteProduct/
                                fetchProductFieldDefs/createProductFieldDef/…/
                                fetchProductAttributes/generateVariants/…/
                                fetchStock/adjustStock/fetchStockMovements/…/
                                previewProductImport/applyProductImport/exportProductsUrl
```

**Навигация — зафиксировано по фидбеку клиента:** «Товары» — полностью самостоятельный
top-level пункт в `MainLayout.tsx` `NAV` (раздел `main`, рядом с «Проекты»/«Продажи»/«Лиды»),
никак не вложенный в «Рабочую область» (`WorkspaceSidebarBlock`) и не завязанный на неё в UI —
это отдельная запись в сайдбаре со своей иконкой, и раскрывается на дочерние пункты подменю:
**«Список товаров»**, **«Склад»**, «Категории», «Типы полей» (конструктор полей и атрибуты — тоже
здесь, не в общих Настройках CRM). Переиспользование `custom-objects` касается только
backend-паттернов и кода конструктора кастомных полей (раздел 2/10) — пользователь никогда не
видит и не заходит в «Рабочую область», чтобы работать с товарами и складом.

Компонент **конструктора поля** (Type→settings) и компонент **динамического рендера поля в
форме** — оба должны быть написаны так, чтобы **тот же код позже переиспользовать для
custom-objects** (там сейчас, вероятно, более простой/старый вариант этой формы) — то есть
писать их как `DynamicFieldEditor`/`DynamicFieldInput` с типом полей как пропом, а не хардкодить
«товарные» подписи внутри.

## 11. Права доступа

Проверить `backend/src/staff/staff-rbac.ts` — добавить туда permissions для товаров
(`products.read`, `products.write`, `products.delete`, `products.manage_fields`,
`products.manage_stock`), по аналогии с тем, как там уже описаны права на другие модули.
Поле-конструктор («Типы полей», «Атрибуты») — только владелец/админ; сам товар и складские
корректировки — по обычным ролям сотрудников (возможно, `products.manage_stock` — отдельное,
более узкое право, чтобы не каждый сотрудник мог менять остатки).

## 12. Пошаговый план реализации

1. **Backend-основа**: миграция + сущности `Product`, `ProductFieldDef`, `ProductCategory`;
   `ProductsService` (CRUD товара + CRUD field-defs + категорий); `ProductsController`.
2. **Валидация кастомных полей**: `normalizeDynamicFieldValues()` (вынести из
   `custom-objects.service.ts` или написать по аналогии) — обязательность, типы, options.
3. **Frontend — Настройки → Типы полей**: конструктор полей с per-type настройками.
4. **Frontend — список и карточка товара**: `ProductsListPage`, `ProductFormPage` с
   динамическим рендером кастомных полей (пока без вариаций — простой `quantity`).
5. **Атрибуты и вариации**: `ProductAttribute`, `ProductVariant`, генерация комбинаций,
   `ProductAttributesPage`, блок вариаций в `ProductFormPage`.
6. **Склад**: `ProductStockMovement`, `product-stock.service.ts` (движения + агрегация
   quantity у вариативных товаров), `StockPage.tsx`, эндпоинты `/products/stock*`.
7. **Импорт/экспорт**: `previewProductImport`/`applyProductImport` (копия паттерна
   `previewHeadlessImport`/`attachImportAndApply`, + широкий формат для вариантов),
   `GET /products/export` (новый XLSX/CSV генератор, с разверткой по вариантам), и заодно
   `GET /custom-objects/:objectId/export` (закрыть пробел в существующем модуле).
8. **Публичный API**: `products-public.controller.ts` (`ingest` + `stock`, с поддержкой
   вариантов), обновить текст в Настройках → API про новые эндпоинты.
9. **RBAC**: права в `staff-rbac.ts`, пункты меню, гварды на UI.
10. **(Phase 2, после обратной связи от клиента)**: `wysiwyg`, `colorpicker`, `relation`,
    `repeater`, категории-дерево, привязка товаров/вариантов к продажам как line items (сумма
    сделки = Σ товар×количество×цена, автосписание остатка варианта при продаже — тогда
    `product_stock_movements.type='sale'` начинает заполняться автоматически из Sales, а не
    только руками), множественные склады/локации, штрихкоды — это отдельная, более крупная
    задача на стыке с модулем Sales, явно вынесенная за рамки v1.

## 13. Вопросы, которые нужно закрыть с клиентом до/во время реализации

- Нужен ли **публичный read-каталог** (`GET /public/products` без токена) или интеграция —
  только «сайт → CRM» в одну сторону (учёт остатков/цен), а витрину сайт рисует сам?
- Нужна ли привязка товаров к Продажам/Сделкам как позиции (line items) уже в v1, или это
  можно отложить в Phase 2? (Сильно меняет объём работ и модель `Sale`.)
- Категории — плоский список или нужна вложенность (подкатегории) сразу?
- Мультивалютность цены (как у `Sale.currency`) — нужна на старте?
- Нужны ли **множественные склады/локации** (разные точки/города со своим остатком одного и
  того же варианта) уже в v1, или пока один общий остаток на тенант достаточен?
- Атрибуты вариаций — тенант-wide переиспользуемые (рекомендация, раздел 4) или клиент хочет
  локальные атрибуты на каждый товар отдельно?

**Закрыто:**
- «Товары» — отдельный top-level раздел меню, не вложен в «Рабочую область».
- «Типы полей» живут внутри самого раздела «Товары», а не в общих Настройках CRM (см. раздел 10).
- Нужны вариативные товары (атрибуты вроде цвета/размера) и отдельный подраздел «Склад» с
  остатком по каждому варианту (см. разделы 4, 5).
