/* Тексты страницы «Решения → Склад» (ru/en/tr). Только реальные возможности (backend products/*, ai-office):
 * склады/точки (название, код, основной, активен), остаток по каждому складу; операции in/out/adjustment/sale/return
 * и перемещение transfer_out/transfer_in с причиной; каждое изменение пишется (тип, причина, автор, итог, источник:
 * вручную/импорт/API/продажа); порог минимума → уведомление «мало»/«закончился» + автоматизация product.stock_low;
 * прогноз «хватит на N дней» по продажам за 30 дней (Aura, ИИ-отдел, порог 14 дней); варианты со своим SKU и остатком;
 * штрихкоды и печать этикеток; импорт/экспорт; публичный API и вебхук product.stock_changed; аналитика по складам
 * (позиции, единицы, стоимость, мало) и топ по стоимости; ИИ-отдел «Склад» (Enterprise/Ultimate) готовит заказ
 * поставщику (поставщики только из «Мозга»/CRM), отправка после согласования или автоматически, если включено;
 * ИИ-ассистент корректирует остаток только после явного подтверждения.
 * НЕТ: ячеек хранения, резервов под заказы, поставок в пути, автосписания по заказам витрины/магазина. */

type Item = { b: string; s: string };
type QA = { q: string; a: string };
type Card = { t: string; d: string; ic: string };

export type WarehouseText = {
  crumbs: [string, string];
  kicker: string;
  t1: string;
  t2: string;
  sub: string;
  tryFree: string;
  demo: string;
  demoNote: string;
  stats: Array<{ v: string; l: string }>;
  prob: { k: string; t: string; d: string };
  stock: {
    k: string; t: string; lede: string; items: Item[];
    vis: { all: string; locs: string[]; cols: [string, string, string, string]; st: { ok: string; low: string; out: string }; toast: string; toastOut: string; sale: string; products: string[] };
  };
  ops: { k: string; t: string; d: string; items: Card[] };
  moves: {
    k: string; t: string; lede: string; items: Item[];
    vis: { transfer: string; from: string; to: string; qty: string; log: string; rows: Array<[string, string, string, number, string]> };
  };
  ai: {
    k: string; t: string; lede: string; items: Item[];
    vis: { h: string; found: string; supplier: string; reorder: string; mail: string; subj: string; wait: string; sent: string; approve: string; rows: Array<[string, number, string]> };
  };
  more: { k: string; t: string; d: string; items: Card[] };
  pair: { loc: { title: string; units: string; value: string; low: string; rows: Array<[string, number, number, number]> }; top: { title: string; rows: Array<[string, number]> } };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  agent: { k: string; name: string; job: string; text: string; list: string[]; hire: string; aura: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

const ru: WarehouseText = {
  crumbs: ['Решения', 'Склад'],
  kicker: 'Решение · Склад и остатки',
  t1: 'Остатки по всем складам —',
  t2: 'и заказ поставщику раньше, чем товар закончится.',
  sub: 'Lumiva ведёт остатки по каждому складу и точке, записывает каждое движение — приход, продажу, возврат, перемещение, списание — и предупреждает, когда товар подходит к минимуму. ИИ-отдел «Склад» сам находит, что скоро закончится, и готовит заказ поставщику.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '7', l: 'типов операций: приход, расход, продажа, возврат, корректировка, перемещение туда и обратно' },
    { v: '14', l: 'дней — товары, которых при текущих продажах хватит меньше чем на две недели, попадают в список на дозаказ' },
    { v: '30', l: 'дней продаж — по ним считается, на сколько хватит остатка' },
    { v: '4', l: 'источника изменений остатка: вручную, импорт, API и продажа' },
  ],
  prob: {
    k: '01 · Задача',
    t: 'Остатки в Excel, а «сколько у нас есть» знает только кладовщик.',
    d: 'Товар лежит на двух складах и в магазине, приход записывают в тетрадь, перемещения — в чат, а таблица обновляется раз в неделю. Менеджер обещает клиенту то, чего уже нет, а о том, что позиция закончилась, узнают из жалобы. Заказ поставщику делают «на глаз», когда полка уже пустая. Lumiva держит остатки по каждому складу в одном месте и заранее подсказывает, что пора дозаказать.',
  },
  stock: {
    k: '02 · Остатки по складам',
    t: 'Каждая позиция — на каждом складе.',
    lede: 'Заведите склады и точки продаж, и для каждой позиции будет видно, сколько её на каждом из них и сколько всего.',
    items: [
      { b: 'Несколько складов', s: ' — склады, магазины, точки выдачи: у каждого название и код, один назначается основным, неактивные скрываются.' },
      { b: 'Остаток по каждому складу', s: ' — таблица остатков с фильтром по складу, поиском и режимом «только заканчивающиеся».' },
      { b: 'Порог минимума', s: ' — у каждого товара свой порог; ниже порога позиция подсвечивается, при нуле — помечается как закончившаяся.' },
      { b: 'Уведомления', s: ' — когда остаток опускается до порога или до нуля, ответственные получают уведомление в CRM со ссылкой на товар.' },
      { b: 'Варианты', s: ' — размер, цвет, комплектация: у каждого варианта свой артикул и свой остаток.' },
    ],
    vis: { all: 'Все склады', locs: ['Основной склад', 'Магазин'], cols: ['Товар', 'Склад', 'Остаток', 'Мин.'], st: { ok: 'в норме', low: 'мало', out: 'нет' }, toast: 'Низкий остаток', toastOut: 'Товар закончился', sale: 'продажа', products: ['Кофе зерновой 1 кг', 'Фильтры бумажные', 'Сироп ванильный', 'Стаканы 350 мл', 'Молоко овсяное'] },
  },
  ops: {
    k: '03 · Операции',
    t: 'Все движения товара — по правилам.',
    d: 'Остаток меняется не «вручную в ячейке», а операцией с типом и причиной. Поэтому всегда можно понять, откуда взялась цифра.',
    items: [
      { t: 'Приход', d: 'Поступление от поставщика на выбранный склад с комментарием.', ic: 'box' },
      { t: 'Расход и списание', d: 'Брак, порча, расход на нужды компании — с обязательной причиной.', ic: 'filter' },
      { t: 'Продажа и возврат', d: 'Отдельные типы операций, чтобы продажи и возвраты не смешивались со списаниями.', ic: 'chart' },
      { t: 'Перемещение', d: 'С одного склада на другой: остаток уменьшается на одном и увеличивается на другом одной операцией.', ic: 'pipe' },
      { t: 'Корректировка', d: 'Итог пересчёта: остаток приводится к факту, причина расхождения записывается.', ic: 'check' },
      { t: 'Массовый импорт', d: 'Загрузка остатков и товаров из Excel/CSV с предпросмотром перед применением.', ic: 'grid' },
    ],
  },
  moves: {
    k: '04 · Перемещения и история',
    t: 'Откуда взялась каждая цифра.',
    lede: 'Каждое изменение остатка записывается: что произошло, на каком складе, кто сделал, по какой причине и сколько стало после операции.',
    items: [
      { b: 'Перемещение между складами', s: ' — выбираете «откуда», «куда» и количество; обе стороны меняются одной операцией и связаны между собой.' },
      { b: 'Запись каждого движения', s: ' — тип операции, количество, итоговый остаток, причина, автор и источник: вручную, импорт, API или продажа.' },
      { b: 'История карточки', s: ' — в карточке товара видно, кто и когда менял цену, себестоимость, статус, артикул и штрихкод.' },
      { b: 'Через API тоже', s: ' — сайт, магазин или ваша учётная система могут менять остаток по API, и это тоже попадает в запись движений.' },
    ],
    vis: { transfer: 'Перемещение', from: 'Откуда', to: 'Куда', qty: 'Количество', log: 'Движения', rows: [['09:12', 'Приход', 'Основной склад', 40, 'поставка №118'], ['11:40', 'Перемещение', 'Основной склад → Магазин', 10, 'витрина'], ['14:05', 'Продажа', 'Магазин', -2, ''], ['16:30', 'Списание', 'Основной склад', -1, 'брак упаковки'], ['17:02', 'Возврат', 'Магазин', 1, 'обмен']] },
  },
  ai: {
    k: '05 · ИИ-отдел «Склад»',
    t: 'Заказ поставщику — до того, как полка опустеет.',
    lede: 'Встроенная программа ИИ-отдела «Склад» — «Дозаказ позиций на исходе»: каждое утро она смотрит остатки и продажи, находит позиции, которые закончились, ушли ниже порога или закончатся в ближайшие 14 дней, и готовит заказ поставщику.',
    items: [
      { b: 'Прогноз по продажам', s: ' — сколько дней хватит остатка, считается по продажам за последние 30 дней.' },
      { b: 'Группировка по поставщикам', s: ' — позиции объединяются в один заказ на каждого поставщика с количеством к дозаказу.' },
      { b: 'Только ваши поставщики', s: ' — адрес поставщика берётся из документов, которые вы дали отделу, или из контактов CRM. Если адреса нет, ИИ попросит его у вас, а не придумает.' },
      { b: 'Согласование', s: ' — по умолчанию заказ ждёт вашего подтверждения; автоотправку можно включить в настройках отдела.' },
      { b: 'Тарифы', s: ' — ИИ-отделы доступны на тарифах Enterprise и Ultimate.' },
    ],
    vis: { h: 'ИИ-отдел «Склад»', found: 'позиции на дозаказ', supplier: 'Поставщик', reorder: 'Дозаказать', mail: 'Письмо поставщику', subj: 'Заказ товара', wait: 'Ждёт согласования', sent: 'Отправлено', approve: 'Согласовать', rows: [['Кофе зерновой 1 кг', 60, '3 дн.'], ['Сироп ванильный', 24, '6 дн.'], ['Фильтры бумажные', 200, 'ниже порога']] },
  },
  more: {
    k: '06 · Вокруг склада',
    t: 'Всё, что нужно, чтобы склад жил с остальной CRM.',
    d: 'Склад связан с каталогом, аналитикой, автоматизациями и вашими внешними системами.',
    items: [
      { t: 'Штрихкоды и этикетки', d: 'Штрихкод у товара и варианта, печать этикеток пачкой прямо из CRM.', ic: 'grid' },
      { t: 'Автоматизация «Товар заканчивается»', d: 'При достижении порога — письмо, задача закупщику или сообщение в Telegram.', ic: 'bolt' },
      { t: 'Вебхуки', d: 'Ваша учётная система или сайт получают событие при каждом изменении остатка.', ic: 'pipe' },
      { t: 'Аналитика склада', d: 'Позиции, единицы и стоимость остатков по каждому складу, топ товаров и списки «мало» и «нет».', ic: 'chart' },
      { t: 'Дашборд Aura', d: 'Шаблон «Склад и остатки»: остатки, позиции на исходе с прогнозом в днях и топ продаж.', ic: 'spark' },
      { t: 'ИИ-ассистент', d: 'Спросите, что заканчивается, или попросите скорректировать остаток — ассистент сделает это только после вашего подтверждения.', ic: 'chat' },
    ],
  },
  pair: {
    loc: { title: 'Остатки по складам · пример', units: 'ед.', value: 'стоимость', low: 'мало', rows: [['Основной склад', 3120, 18400, 3], ['Магазин', 540, 4100, 2], ['Точка выдачи', 180, 1350, 1]] },
    top: { title: 'Топ по стоимости остатка · пример', rows: [['Кофе зерновой 1 кг', 5400], ['Молоко овсяное', 2900], ['Стаканы 350 мл', 1850], ['Сироп ванильный', 1200]] },
  },
  steps: {
    k: '07 · Как это работает',
    t: 'От первого импорта до заказа поставщику.',
    d: 'Пять шагов, после которых остатки перестают жить в Excel.',
    n: 'Шаг',
    items: [
      { t: 'Заведите склады', d: 'Основной склад, магазин, точка выдачи — с названием и кодом.' },
      { t: 'Загрузите товары', d: 'Импорт каталога и остатков из Excel или CSV с предпросмотром.' },
      { t: 'Задайте пороги', d: 'Минимальный остаток для каждого товара — ниже него придёт уведомление.' },
      { t: 'Проводите операции', d: 'Приход, продажа, возврат, перемещение и списание — с причиной и автором.' },
      { t: 'Дозаказывайте вовремя', d: 'ИИ-отдел «Склад» готовит заказы поставщикам по прогнозу продаж.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs склад в Excel',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Несколько складов', lumiva: 'Остаток по каждому складу и общий итог', typical: 'Отдельный лист на каждый склад' },
      { metric: 'Откуда цифра', lumiva: 'Каждое движение с типом, причиной и автором', typical: 'Число в ячейке, история потеряна' },
      { metric: 'Товар заканчивается', lumiva: 'Уведомление и автоматизация при пороге', typical: 'Узнаёте от клиента' },
      { metric: 'Дозаказ', lumiva: 'Прогноз по продажам и готовый заказ поставщику', typical: 'Заказ «на глаз», когда полка пустая' },
      { metric: 'Перемещения', lumiva: 'Одна операция меняет оба склада', typical: 'Две ручные правки в двух таблицах' },
    ],
  },
  agent: {
    k: 'ИИ-агент для этого решения',
    name: 'Stock AI',
    job: 'Агент ИИ-отдела «Склад»',
    text: 'Каждый день сверяет остатки с продажами, находит позиции на исходе и готовит письмо поставщику с количеством к дозаказу. Адреса поставщиков берёт только из ваших документов и CRM, а отправляет — после вашего согласования.',
    list: ['Проверяет остатки и порог', 'Считает, на сколько дней хватит', 'Готовит заказ поставщику'],
    hire: 'Об ИИ-отделах',
    aura: 'Дашборд «Склад и остатки»',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Склады и остатки',
        items: [
          { q: 'Сколько складов можно завести?', a: 'Столько, сколько нужно: склады, магазины, точки выдачи. У каждого есть название и код, один назначается основным, а неиспользуемые можно сделать неактивными, не теряя историю.' },
          { q: 'Как увидеть остаток товара на конкретном складе?', a: 'В таблице остатков выберите склад в фильтре — или «Все склады», чтобы увидеть общий итог. Там же есть поиск и режим «только заканчивающиеся».' },
          { q: 'Как работают варианты товара?', a: 'Размер, цвет или комплектация оформляются вариантами. У каждого варианта свой артикул и свой остаток, поэтому «футболка M» и «футболка L» не путаются.' },
          { q: 'Есть ли ячейки хранения, резервы под заказы и поставки в пути?', a: 'Пока нет. Остатки ведутся по складам и точкам, без адресного хранения по ячейкам; резервирование под заказы и учёт товара в пути не поддерживаются. Если это критично для вас — напишите нам, мы учитываем такие запросы.' },
        ],
      },
      {
        g: 'Операции и история',
        items: [
          { q: 'Какие операции со складом есть?', a: 'Приход, расход (списание), продажа, возврат, корректировка по итогам пересчёта и перемещение между складами. У каждой операции указываются склад, количество и причина.' },
          { q: 'Как сделать перемещение между складами?', a: 'Выберите товар, склад-источник, склад-получатель и количество. Остаток уменьшится на одном складе и увеличится на другом одной операцией, обе записи связаны между собой.' },
          { q: 'Видно ли, кто и почему изменил остаток?', a: 'Каждое изменение остатка записывается: тип операции, количество, итоговый остаток, причина, автор и источник — вручную, импорт, API или продажа. В карточке товара также видна история изменений цены, себестоимости, статуса, артикула и штрихкода.' },
          { q: 'Списывается ли остаток автоматически, когда приходит заказ?', a: 'Нет. Заказ с витрины или из магазина создаёт продажу, но остаток сам не списывает — продажа оформляется складской операцией. Если ваш сайт или учётная система сами ведут остатки, они могут обновлять их в Lumiva по API.' },
        ],
      },
      {
        g: 'Уведомления и дозаказ',
        items: [
          { q: 'Как узнать, что товар заканчивается?', a: 'Задайте товару порог минимального остатка. Когда остаток опускается до порога, ответственные получают уведомление «Низкий остаток», а при нуле — «Товар закончился», со ссылкой на товар. Можно добавить автоматизацию: письмо, задачу закупщику или сообщение в Telegram.' },
          { q: 'Как считается, на сколько дней хватит товара?', a: 'По продажам за последние 30 дней: средний расход в день сравнивается с текущим остатком. Позиции, которых хватит меньше чем на 14 дней, попадают в список на дозаказ — в дашборде Aura и у ИИ-отдела «Склад».' },
          { q: 'Как ИИ-отдел готовит заказ поставщику?', a: 'Каждый день он находит позиции, которые закончились, ушли ниже порога или закончатся в ближайшие 14 дней, группирует их по поставщикам и готовит письмо-заказ с количеством. Адрес поставщика берётся только из документов, которые вы дали отделу, или из контактов CRM; если адреса нет, отдел попросит его у вас.' },
          { q: 'Уйдёт ли заказ поставщику без моего ведома?', a: 'Нет, по умолчанию заказ ждёт вашего согласования. Автоматическую отправку заказов можно включить отдельно в настройках отдела, если вы доверяете ему этот шаг.' },
        ],
      },
      {
        g: 'Данные и интеграции',
        items: [
          { q: 'Как перенести остатки из Excel или 1С?', a: 'Выгрузите товары и остатки в Excel или CSV и загрузите их через импорт: перед применением вы увидите предпросмотр. Каталог и остатки можно и выгрузить обратно.' },
          { q: 'Можно синхронизировать остатки с сайтом или учётной системой?', a: 'Да. Остаток можно менять через публичный API с токеном, а вебхуки отправляют событие при каждом его изменении — так сайт, магазин или ваша учётная система остаются в курсе.' },
          { q: 'Есть штрихкоды?', a: 'Да. У товара и у каждого варианта может быть штрихкод, этикетки печатаются пачкой прямо из CRM.' },
          { q: 'Можно попробовать на своих данных?', a: 'Да. Регистрация даёт 14 дней тарифа Enterprise бесплатно и без карты — в нём доступны и склад, и ИИ-отделы. Загрузите товары из Excel и посмотрите остатки и прогноз на своих данных.' },
        ],
      },
    ],
  },
  cta: { k: 'Готовы посмотреть?', t: 'Перенесём ваши остатки из Excel и покажем склад на ваших данных за 30 минут.' },
};

const en: WarehouseText = {
  crumbs: ['Solutions', 'Warehouse'],
  kicker: 'Solution · Warehouse and stock',
  t1: 'Stock across all warehouses —',
  t2: 'and a supplier order before items run out.',
  sub: 'Lumiva tracks stock for every warehouse and point of sale, records every movement — receipt, sale, return, transfer, write-off — and warns you when an item approaches its minimum. The AI "Warehouse" department finds what will run out soon and prepares a supplier order.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '7', l: 'operation types: receipt, issue, sale, return, adjustment, transfer out and in' },
    { v: '14', l: 'days — items that will last less than two weeks at current sales go onto the reorder list' },
    { v: '30', l: 'days of sales — used to calculate how long stock will last' },
    { v: '4', l: 'sources of stock changes: manual, import, API and sale' },
  ],
  prob: {
    k: '01 · The problem',
    t: 'Stock lives in Excel, and only the storekeeper knows "how much we have".',
    d: 'Items sit in two warehouses and a shop, receipts are written in a notebook, transfers in a chat, and the spreadsheet is updated once a week. A manager promises a client something that is already gone, and you learn an item ran out from a complaint. Supplier orders are placed by eye once the shelf is empty. Lumiva keeps stock for every warehouse in one place and tells you in advance what to reorder.',
  },
  stock: {
    k: '02 · Stock by warehouse',
    t: 'Every item — in every warehouse.',
    lede: 'Add your warehouses and points of sale, and for each item you will see how much is in each of them and in total.',
    items: [
      { b: 'Several warehouses', s: ' — warehouses, shops, pickup points: each with a name and code; one is the default, inactive ones are hidden.' },
      { b: 'Stock per warehouse', s: ' — a stock table with a warehouse filter, search and a "running low only" mode.' },
      { b: 'Minimum threshold', s: ' — each item has its own threshold; below it the item is highlighted, at zero it is marked as out of stock.' },
      { b: 'Notifications', s: ' — when stock drops to the threshold or to zero, the responsible people get a CRM notification with a link to the item.' },
      { b: 'Variants', s: ' — size, colour, configuration: each variant has its own SKU and its own stock.' },
    ],
    vis: { all: 'All warehouses', locs: ['Main warehouse', 'Shop'], cols: ['Item', 'Warehouse', 'Stock', 'Min.'], st: { ok: 'ok', low: 'low', out: 'out' }, toast: 'Low stock', toastOut: 'Out of stock', sale: 'sale', products: ['Coffee beans 1 kg', 'Paper filters', 'Vanilla syrup', 'Cups 350 ml', 'Oat milk'] },
  },
  ops: {
    k: '03 · Operations',
    t: 'Every stock movement — by the rules.',
    d: 'Stock changes not by editing a cell but through an operation with a type and a reason. So you can always tell where a number came from.',
    items: [
      { t: 'Receipt', d: 'Goods from a supplier into the chosen warehouse, with a comment.', ic: 'box' },
      { t: 'Issue and write-off', d: 'Defects, spoilage, internal use — with a mandatory reason.', ic: 'filter' },
      { t: 'Sale and return', d: 'Separate operation types so sales and returns are not mixed with write-offs.', ic: 'chart' },
      { t: 'Transfer', d: 'From one warehouse to another: stock goes down in one and up in the other in a single operation.', ic: 'pipe' },
      { t: 'Adjustment', d: 'The result of a count: stock is brought in line with reality, and the reason for the difference is recorded.', ic: 'check' },
      { t: 'Bulk import', d: 'Upload stock and items from Excel/CSV with a preview before applying.', ic: 'grid' },
    ],
  },
  moves: {
    k: '04 · Transfers and history',
    t: 'Where every number came from.',
    lede: 'Every stock change is recorded: what happened, in which warehouse, who did it, why, and how much remained after the operation.',
    items: [
      { b: 'Transfers between warehouses', s: ' — choose "from", "to" and the quantity; both sides change in one operation and are linked.' },
      { b: 'Every movement recorded', s: ' — operation type, quantity, resulting stock, reason, author and source: manual, import, API or sale.' },
      { b: 'Item card history', s: ' — the item card shows who changed price, cost, status, SKU and barcode, and when.' },
      { b: 'Via API too', s: ' — your website, store or accounting system can change stock via the API, and that is recorded as well.' },
    ],
    vis: { transfer: 'Transfer', from: 'From', to: 'To', qty: 'Quantity', log: 'Movements', rows: [['09:12', 'Receipt', 'Main warehouse', 40, 'delivery #118'], ['11:40', 'Transfer', 'Main warehouse → Shop', 10, 'display'], ['14:05', 'Sale', 'Shop', -2, ''], ['16:30', 'Write-off', 'Main warehouse', -1, 'damaged packaging'], ['17:02', 'Return', 'Shop', 1, 'exchange']] },
  },
  ai: {
    k: '05 · AI "Warehouse" department',
    t: 'A supplier order — before the shelf is empty.',
    lede: 'The built-in program of the AI "Warehouse" department — "Reorder items running low": every morning it checks stock and sales, finds items that are out, below the threshold or will run out within 14 days, and prepares a supplier order.',
    items: [
      { b: 'Forecast from sales', s: ' — how many days the stock will last is calculated from the last 30 days of sales.' },
      { b: 'Grouped by supplier', s: ' — items are combined into one order per supplier, with the quantity to reorder.' },
      { b: 'Only your suppliers', s: ' — the supplier address comes from documents you gave the department or from CRM contacts. If there is no address, the AI asks you for it instead of making one up.' },
      { b: 'Approval', s: ' — by default the order waits for your confirmation; automatic sending can be enabled in the department settings.' },
      { b: 'Plans', s: ' — AI departments are available on the Enterprise and Ultimate plans.' },
    ],
    vis: { h: 'AI "Warehouse" department', found: 'items to reorder', supplier: 'Supplier', reorder: 'Reorder', mail: 'Email to supplier', subj: 'Purchase order', wait: 'Awaiting approval', sent: 'Sent', approve: 'Approve', rows: [['Coffee beans 1 kg', 60, '3 days'], ['Vanilla syrup', 24, '6 days'], ['Paper filters', 200, 'below min']] },
  },
  more: {
    k: '06 · Around the warehouse',
    t: 'Everything that keeps the warehouse in sync with the rest of the CRM.',
    d: 'The warehouse is connected to the catalogue, analytics, automations and your external systems.',
    items: [
      { t: 'Barcodes and labels', d: 'Barcodes on items and variants, batch label printing right from the CRM.', ic: 'grid' },
      { t: '"Running low" automation', d: 'When the threshold is reached — an email, a task for the buyer or a Telegram message.', ic: 'bolt' },
      { t: 'Webhooks', d: 'Your accounting system or website receives an event on every stock change.', ic: 'pipe' },
      { t: 'Warehouse analytics', d: 'Items, units and stock value per warehouse, top items and "low" and "out" lists.', ic: 'chart' },
      { t: 'Aura dashboard', d: 'The "Stock levels" template: stock, items running out with a forecast in days, and top sales.', ic: 'spark' },
      { t: 'AI assistant', d: 'Ask what is running out, or ask it to adjust stock — the assistant does it only after your confirmation.', ic: 'chat' },
    ],
  },
  pair: {
    loc: { title: 'Stock by warehouse · example', units: 'units', value: 'value', low: 'low', rows: [['Main warehouse', 3120, 18400, 3], ['Shop', 540, 4100, 2], ['Pickup point', 180, 1350, 1]] },
    top: { title: 'Top items by stock value · example', rows: [['Coffee beans 1 kg', 5400], ['Oat milk', 2900], ['Cups 350 ml', 1850], ['Vanilla syrup', 1200]] },
  },
  steps: {
    k: '07 · How it works',
    t: 'From the first import to a supplier order.',
    d: 'Five steps after which stock stops living in Excel.',
    n: 'Step',
    items: [
      { t: 'Add warehouses', d: 'Main warehouse, shop, pickup point — with a name and code.' },
      { t: 'Upload items', d: 'Import the catalogue and stock from Excel or CSV with a preview.' },
      { t: 'Set thresholds', d: 'A minimum stock level per item — below it you get a notification.' },
      { t: 'Record operations', d: 'Receipt, sale, return, transfer and write-off — with reason and author.' },
      { t: 'Reorder on time', d: 'The AI "Warehouse" department prepares supplier orders based on the sales forecast.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs a warehouse in Excel',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'Several warehouses', lumiva: 'Stock per warehouse and a total', typical: 'A separate sheet per warehouse' },
      { metric: 'Where the number came from', lumiva: 'Every movement with type, reason and author', typical: 'A number in a cell, history lost' },
      { metric: 'Running low', lumiva: 'Notification and automation at the threshold', typical: 'You find out from a client' },
      { metric: 'Reordering', lumiva: 'Sales forecast and a ready supplier order', typical: 'Ordering by eye once the shelf is empty' },
      { metric: 'Transfers', lumiva: 'One operation changes both warehouses', typical: 'Two manual edits in two sheets' },
    ],
  },
  agent: {
    k: 'AI agent for this solution',
    name: 'Stock AI',
    job: 'Agent of the AI "Warehouse" department',
    text: 'Every day compares stock with sales, finds items running low and prepares an email to the supplier with the quantity to reorder. Takes supplier addresses only from your documents and CRM, and sends after your approval.',
    list: ['Checks stock and thresholds', 'Calculates how many days are left', 'Prepares a supplier order'],
    hire: 'About AI departments',
    aura: '"Stock levels" dashboard',
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Warehouses and stock',
        items: [
          { q: 'How many warehouses can we add?', a: 'As many as you need: warehouses, shops, pickup points. Each has a name and code, one is the default, and unused ones can be made inactive without losing their history.' },
          { q: 'How do we see stock in a specific warehouse?', a: 'Pick the warehouse in the stock table filter — or "All warehouses" for the total. There is also search and a "running low only" mode.' },
          { q: 'How do item variants work?', a: 'Size, colour or configuration are set up as variants. Each variant has its own SKU and its own stock, so "T-shirt M" and "T-shirt L" never get mixed up.' },
          { q: 'Are there storage bins, order reservations and goods in transit?', a: 'Not yet. Stock is kept per warehouse and point, without bin-level storage; reserving stock for orders and tracking goods in transit are not supported. If this is critical for you, write to us — we take such requests into account.' },
        ],
      },
      {
        g: 'Operations and history',
        items: [
          { q: 'Which warehouse operations are there?', a: 'Receipt, issue (write-off), sale, return, adjustment after a count, and transfer between warehouses. Each operation records the warehouse, quantity and reason.' },
          { q: 'How do we transfer between warehouses?', a: 'Choose the item, source warehouse, destination warehouse and quantity. Stock goes down in one warehouse and up in the other in a single operation, and both records are linked.' },
          { q: 'Can we see who changed stock and why?', a: 'Every stock change is recorded: operation type, quantity, resulting stock, reason, author and source — manual, import, API or sale. The item card also shows the history of price, cost, status, SKU and barcode changes.' },
          { q: 'Is stock written off automatically when an order comes in?', a: 'No. An order from the storefront or a store creates a sale but does not reduce stock by itself — the sale is recorded as a warehouse operation. If your website or accounting system keeps stock itself, it can update it in Lumiva via the API.' },
        ],
      },
      {
        g: 'Notifications and reordering',
        items: [
          { q: 'How do we know an item is running low?', a: 'Set a minimum stock threshold for the item. When stock drops to it, the responsible people get a "Low stock" notification, and at zero — "Out of stock", with a link to the item. You can add an automation: an email, a task for the buyer or a Telegram message.' },
          { q: 'How is "days of stock left" calculated?', a: 'From sales over the last 30 days: the average daily usage is compared with current stock. Items that will last less than 14 days go onto the reorder list — in the Aura dashboard and for the AI "Warehouse" department.' },
          { q: 'How does the AI department prepare a supplier order?', a: 'Every day it finds items that are out, below the threshold or will run out within 14 days, groups them by supplier and prepares an order email with quantities. The supplier address comes only from documents you gave the department or from CRM contacts; if it is missing, the department asks you for it.' },
          { q: 'Will an order go to a supplier without my knowledge?', a: 'No, by default the order waits for your approval. Automatic sending of orders can be enabled separately in the department settings if you trust it with that step.' },
        ],
      },
      {
        g: 'Data and integrations',
        items: [
          { q: 'How do we move stock from Excel or 1C?', a: 'Export items and stock to Excel or CSV and upload them via import — you will see a preview before applying. The catalogue and stock can be exported back as well.' },
          { q: 'Can we sync stock with our website or accounting system?', a: 'Yes. Stock can be changed via the public API with a token, and webhooks send an event on every change — so your website, store or accounting system stays up to date.' },
          { q: 'Are there barcodes?', a: 'Yes. Items and every variant can have a barcode, and labels are printed in batches right from the CRM.' },
          { q: 'Can we try it on our own data?', a: 'Yes. Sign-up gives 14 days of the Enterprise plan for free, no card required — it includes the warehouse and AI departments. Upload items from Excel and see stock and the forecast on your own data.' },
        ],
      },
    ],
  },
  cta: { k: 'Ready to see it?', t: 'We\'ll move your stock from Excel and show the warehouse on your data in 30 minutes.' },
};

const tr: WarehouseText = {
  crumbs: ['Çözümler', 'Depo'],
  kicker: 'Çözüm · Depo ve stok',
  t1: 'Tüm depolarda stok —',
  t2: 've ürün bitmeden tedarikçiye sipariş.',
  sub: 'Lumiva her depo ve satış noktası için stoku tutar, her hareketi — giriş, satış, iade, transfer, fire — kaydeder ve ürün minimuma yaklaştığında uyarır. Yapay zekâ "Depo" departmanı yakında bitecek ürünleri bulur ve tedarikçiye sipariş hazırlar.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '7', l: 'işlem türü: giriş, çıkış, satış, iade, düzeltme, giden ve gelen transfer' },
    { v: '14', l: 'gün — mevcut satışlarla iki haftadan az yetecek ürünler yeniden sipariş listesine girer' },
    { v: '30', l: 'günlük satış — stokun ne kadar yeteceği buna göre hesaplanır' },
    { v: '4', l: 'stok değişikliği kaynağı: elle, içe aktarma, API ve satış' },
  ],
  prob: {
    k: '01 · Sorun',
    t: 'Stok Excel\'de, "elimizde ne kadar var" sorusunu yalnızca depocu biliyor.',
    d: 'Ürünler iki depoda ve bir mağazada duruyor, girişler deftere, transferler sohbete yazılıyor, tablo haftada bir güncelleniyor. Yönetici müşteriye artık olmayan bir şeyi vaat ediyor, ürünün bittiği şikâyetle öğreniliyor. Tedarikçi siparişi raf boşalınca göz kararı veriliyor. Lumiva her deponun stokunu tek yerde tutar ve neyin yeniden sipariş edilmesi gerektiğini önceden söyler.',
  },
  stock: {
    k: '02 · Depolara göre stok',
    t: 'Her ürün — her depoda.',
    lede: 'Depolarınızı ve satış noktalarınızı ekleyin; her ürün için her birinde ne kadar olduğu ve toplamı görünür.',
    items: [
      { b: 'Birden fazla depo', s: ' — depolar, mağazalar, teslim noktaları: her birinin adı ve kodu var; biri varsayılan, pasif olanlar gizlenir.' },
      { b: 'Depo bazında stok', s: ' — depo filtreli, aramalı ve "yalnızca azalanlar" modlu stok tablosu.' },
      { b: 'Minimum eşik', s: ' — her ürünün kendi eşiği var; altına düşünce vurgulanır, sıfırda tükendi olarak işaretlenir.' },
      { b: 'Bildirimler', s: ' — stok eşiğe veya sıfıra düştüğünde sorumlular ürüne bağlantılı bir CRM bildirimi alır.' },
      { b: 'Varyantlar', s: ' — beden, renk, set: her varyantın kendi SKU\'su ve kendi stoku var.' },
    ],
    vis: { all: 'Tüm depolar', locs: ['Ana depo', 'Mağaza'], cols: ['Ürün', 'Depo', 'Stok', 'Min.'], st: { ok: 'normal', low: 'az', out: 'yok' }, toast: 'Düşük stok', toastOut: 'Ürün tükendi', sale: 'satış', products: ['Çekirdek kahve 1 kg', 'Kâğıt filtre', 'Vanilya şurubu', 'Bardak 350 ml', 'Yulaf sütü'] },
  },
  ops: {
    k: '03 · İşlemler',
    t: 'Tüm ürün hareketleri — kurallara göre.',
    d: 'Stok bir hücreyi düzenleyerek değil, türü ve nedeni olan bir işlemle değişir. Böylece bir rakamın nereden geldiği her zaman anlaşılır.',
    items: [
      { t: 'Giriş', d: 'Tedarikçiden seçilen depoya giriş, yorumla birlikte.', ic: 'box' },
      { t: 'Çıkış ve fire', d: 'Kusur, bozulma, şirket içi kullanım — zorunlu nedenle.', ic: 'filter' },
      { t: 'Satış ve iade', d: 'Satışlar ve iadeler fire ile karışmasın diye ayrı işlem türleri.', ic: 'chart' },
      { t: 'Transfer', d: 'Bir depodan diğerine: stok tek işlemle birinde azalır, diğerinde artar.', ic: 'pipe' },
      { t: 'Düzeltme', d: 'Sayım sonucu: stok gerçeğe getirilir, farkın nedeni kaydedilir.', ic: 'check' },
      { t: 'Toplu içe aktarma', d: 'Stok ve ürünleri Excel/CSV\'den uygulamadan önce önizlemeyle yükleyin.', ic: 'grid' },
    ],
  },
  moves: {
    k: '04 · Transferler ve geçmiş',
    t: 'Her rakamın nereden geldiği.',
    lede: 'Her stok değişikliği kaydedilir: ne oldu, hangi depoda, kim yaptı, neden ve işlemden sonra ne kadar kaldı.',
    items: [
      { b: 'Depolar arası transfer', s: ' — "nereden", "nereye" ve miktarı seçin; iki taraf tek işlemle değişir ve birbirine bağlanır.' },
      { b: 'Her hareket kaydedilir', s: ' — işlem türü, miktar, sonuç stok, neden, yapan kişi ve kaynak: elle, içe aktarma, API veya satış.' },
      { b: 'Kart geçmişi', s: ' — ürün kartında fiyatı, maliyeti, durumu, SKU\'yu ve barkodu kimin ne zaman değiştirdiği görünür.' },
      { b: 'API ile de', s: ' — siteniz, mağazanız veya muhasebe sisteminiz stoku API ile değiştirebilir, bu da kaydedilir.' },
    ],
    vis: { transfer: 'Transfer', from: 'Nereden', to: 'Nereye', qty: 'Miktar', log: 'Hareketler', rows: [['09:12', 'Giriş', 'Ana depo', 40, 'teslimat #118'], ['11:40', 'Transfer', 'Ana depo → Mağaza', 10, 'vitrin'], ['14:05', 'Satış', 'Mağaza', -2, ''], ['16:30', 'Fire', 'Ana depo', -1, 'hasarlı ambalaj'], ['17:02', 'İade', 'Mağaza', 1, 'değişim']] },
  },
  ai: {
    k: '05 · Yapay zekâ "Depo" departmanı',
    t: 'Raf boşalmadan tedarikçiye sipariş.',
    lede: 'Yapay zekâ "Depo" departmanının yerleşik programı — "Azalan ürünlerin yeniden siparişi": her sabah stokları ve satışları kontrol eder, tükenen, eşiğin altına düşen veya 14 gün içinde bitecek ürünleri bulur ve tedarikçiye sipariş hazırlar.',
    items: [
      { b: 'Satışa dayalı tahmin', s: ' — stokun kaç gün yeteceği son 30 günün satışlarından hesaplanır.' },
      { b: 'Tedarikçiye göre gruplama', s: ' — ürünler, yeniden sipariş miktarıyla her tedarikçi için tek bir siparişte birleştirilir.' },
      { b: 'Yalnızca sizin tedarikçileriniz', s: ' — tedarikçi adresi departmana verdiğiniz belgelerden veya CRM kişilerinden alınır. Adres yoksa yapay zekâ uydurmak yerine sizden ister.' },
      { b: 'Onay', s: ' — varsayılan olarak sipariş onayınızı bekler; otomatik gönderim departman ayarlarında açılabilir.' },
      { b: 'Planlar', s: ' — yapay zekâ departmanları Enterprise ve Ultimate planlarında mevcuttur.' },
    ],
    vis: { h: 'Yapay zekâ "Depo" departmanı', found: 'yeniden sipariş edilecek ürün', supplier: 'Tedarikçi', reorder: 'Sipariş', mail: 'Tedarikçiye e-posta', subj: 'Satın alma siparişi', wait: 'Onay bekliyor', sent: 'Gönderildi', approve: 'Onayla', rows: [['Çekirdek kahve 1 kg', 60, '3 gün'], ['Vanilya şurubu', 24, '6 gün'], ['Kâğıt filtre', 200, 'eşik altında']] },
  },
  more: {
    k: '06 · Deponun etrafında',
    t: 'Deponun CRM\'in geri kalanıyla uyumlu çalışması için gereken her şey.',
    d: 'Depo; katalog, analitik, otomasyonlar ve harici sistemlerinizle bağlantılıdır.',
    items: [
      { t: 'Barkodlar ve etiketler', d: 'Ürün ve varyantlarda barkod, doğrudan CRM\'den toplu etiket yazdırma.', ic: 'grid' },
      { t: '"Ürün azalıyor" otomasyonu', d: 'Eşiğe ulaşıldığında — e-posta, satın almacıya görev veya Telegram mesajı.', ic: 'bolt' },
      { t: 'Webhook\'lar', d: 'Muhasebe sisteminiz veya siteniz her stok değişikliğinde bir olay alır.', ic: 'pipe' },
      { t: 'Depo analitiği', d: 'Her depo için ürün sayısı, birim ve stok değeri, en iyi ürünler ve "az" ile "yok" listeleri.', ic: 'chart' },
      { t: 'Aura panosu', d: '"Stok durumu" şablonu: stok, gün tahminiyle azalan ürünler ve en çok satanlar.', ic: 'spark' },
      { t: 'Yapay zekâ asistanı', d: 'Neyin azaldığını sorun veya stoku düzeltmesini isteyin — asistan bunu yalnızca onayınızdan sonra yapar.', ic: 'chat' },
    ],
  },
  pair: {
    loc: { title: 'Depolara göre stok · örnek', units: 'adet', value: 'değer', low: 'az', rows: [['Ana depo', 3120, 18400, 3], ['Mağaza', 540, 4100, 2], ['Teslim noktası', 180, 1350, 1]] },
    top: { title: 'Stok değerine göre en iyiler · örnek', rows: [['Çekirdek kahve 1 kg', 5400], ['Yulaf sütü', 2900], ['Bardak 350 ml', 1850], ['Vanilya şurubu', 1200]] },
  },
  steps: {
    k: '07 · Nasıl çalışır',
    t: 'İlk içe aktarmadan tedarikçi siparişine.',
    d: 'Stoğun Excel\'de yaşamayı bırakması için beş adım.',
    n: 'Adım',
    items: [
      { t: 'Depoları ekleyin', d: 'Ana depo, mağaza, teslim noktası — ad ve kodla.' },
      { t: 'Ürünleri yükleyin', d: 'Kataloğu ve stoğu Excel veya CSV\'den önizlemeyle içe aktarın.' },
      { t: 'Eşikleri ayarlayın', d: 'Her ürün için minimum stok — altına düşünce bildirim gelir.' },
      { t: 'İşlemleri kaydedin', d: 'Giriş, satış, iade, transfer ve fire — neden ve yapan kişiyle.' },
      { t: 'Zamanında sipariş verin', d: 'Yapay zekâ "Depo" departmanı satış tahminine göre tedarikçi siparişleri hazırlar.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs Excel\'de depo',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Birden fazla depo', lumiva: 'Depo bazında stok ve toplam', typical: 'Her depo için ayrı sayfa' },
      { metric: 'Rakam nereden geldi', lumiva: 'Tür, neden ve yapan kişiyle her hareket', typical: 'Hücrede bir sayı, geçmiş kayıp' },
      { metric: 'Ürün azalıyor', lumiva: 'Eşikte bildirim ve otomasyon', typical: 'Müşteriden öğrenilir' },
      { metric: 'Yeniden sipariş', lumiva: 'Satış tahmini ve hazır tedarikçi siparişi', typical: 'Raf boşalınca göz kararı sipariş' },
      { metric: 'Transferler', lumiva: 'Tek işlem iki depoyu da değiştirir', typical: 'İki tabloda iki elle düzeltme' },
    ],
  },
  agent: {
    k: 'Bu çözüm için yapay zekâ ajanı',
    name: 'Stock AI',
    job: 'Yapay zekâ "Depo" departmanı ajanı',
    text: 'Her gün stokları satışlarla karşılaştırır, azalan ürünleri bulur ve yeniden sipariş miktarıyla tedarikçiye bir e-posta hazırlar. Tedarikçi adreslerini yalnızca belgelerinizden ve CRM\'den alır, onayınızdan sonra gönderir.',
    list: ['Stok ve eşikleri kontrol eder', 'Kaç gün yeteceğini hesaplar', 'Tedarikçi siparişi hazırlar'],
    hire: 'Yapay zekâ departmanları hakkında',
    aura: '"Stok durumu" panosu',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Depolar ve stok',
        items: [
          { q: 'Kaç depo ekleyebiliriz?', a: 'İhtiyacınız kadar: depolar, mağazalar, teslim noktaları. Her birinin adı ve kodu var, biri varsayılan olur, kullanılmayanlar geçmişleri kaybolmadan pasif yapılabilir.' },
          { q: 'Belirli bir depodaki stoku nasıl görürüz?', a: 'Stok tablosunun filtresinde depoyu seçin — veya toplam için "Tüm depolar". Ayrıca arama ve "yalnızca azalanlar" modu var.' },
          { q: 'Ürün varyantları nasıl çalışır?', a: 'Beden, renk veya set varyant olarak tanımlanır. Her varyantın kendi SKU\'su ve kendi stoku vardır, böylece "tişört M" ile "tişört L" karışmaz.' },
          { q: 'Raf adresleri, sipariş rezervasyonları ve yoldaki ürünler var mı?', a: 'Henüz yok. Stok depo ve nokta bazında tutulur, raf düzeyinde adresleme yoktur; siparişler için rezervasyon ve yoldaki ürün takibi desteklenmez. Sizin için kritikse bize yazın — bu tür talepleri dikkate alıyoruz.' },
        ],
      },
      {
        g: 'İşlemler ve geçmiş',
        items: [
          { q: 'Hangi depo işlemleri var?', a: 'Giriş, çıkış (fire), satış, iade, sayım sonrası düzeltme ve depolar arası transfer. Her işlemde depo, miktar ve neden belirtilir.' },
          { q: 'Depolar arası transfer nasıl yapılır?', a: 'Ürünü, kaynak depoyu, hedef depoyu ve miktarı seçin. Stok tek işlemle bir depoda azalır, diğerinde artar ve iki kayıt birbirine bağlanır.' },
          { q: 'Stoku kimin ve neden değiştirdiği görülebilir mi?', a: 'Her stok değişikliği kaydedilir: işlem türü, miktar, sonuç stok, neden, yapan kişi ve kaynak — elle, içe aktarma, API veya satış. Ürün kartında ayrıca fiyat, maliyet, durum, SKU ve barkod değişikliklerinin geçmişi görünür.' },
          { q: 'Sipariş geldiğinde stok otomatik düşülür mü?', a: 'Hayır. Vitrinden veya mağazadan gelen sipariş bir satış oluşturur ama stoku kendiliğinden düşürmez — satış bir depo işlemi olarak kaydedilir. Siteniz veya muhasebe sisteminiz stoku kendisi tutuyorsa API ile Lumiva\'da güncelleyebilir.' },
        ],
      },
      {
        g: 'Bildirimler ve yeniden sipariş',
        items: [
          { q: 'Bir ürünün azaldığını nasıl anlarız?', a: 'Ürüne minimum stok eşiği belirleyin. Stok eşiğe düştüğünde sorumlular "Düşük stok", sıfırda ise "Ürün tükendi" bildirimini ürüne bağlantıyla alır. Bir otomasyon da ekleyebilirsiniz: e-posta, satın almacıya görev veya Telegram mesajı.' },
          { q: 'Stokun kaç gün yeteceği nasıl hesaplanır?', a: 'Son 30 günün satışlarından: günlük ortalama tüketim mevcut stokla karşılaştırılır. 14 günden az yetecek ürünler yeniden sipariş listesine girer — Aura panosunda ve yapay zekâ "Depo" departmanında.' },
          { q: 'Yapay zekâ departmanı tedarikçi siparişini nasıl hazırlar?', a: 'Her gün tükenen, eşiğin altına düşen veya 14 gün içinde bitecek ürünleri bulur, tedarikçiye göre gruplar ve miktarlarla bir sipariş e-postası hazırlar. Tedarikçi adresi yalnızca departmana verdiğiniz belgelerden veya CRM kişilerinden alınır; yoksa departman sizden ister.' },
          { q: 'Sipariş benim haberim olmadan tedarikçiye gider mi?', a: 'Hayır, varsayılan olarak sipariş onayınızı bekler. Bu adımda departmana güveniyorsanız otomatik sipariş gönderimi departman ayarlarında ayrıca açılabilir.' },
        ],
      },
      {
        g: 'Veriler ve entegrasyonlar',
        items: [
          { q: 'Stoku Excel\'den veya 1C\'den nasıl aktarırız?', a: 'Ürünleri ve stoku Excel veya CSV\'ye aktarın ve içe aktarma ile yükleyin — uygulamadan önce önizleme görürsünüz. Katalog ve stok geri de aktarılabilir.' },
          { q: 'Stoku sitemiz veya muhasebe sistemimizle senkronize edebilir miyiz?', a: 'Evet. Stok, anahtarlı herkese açık API ile değiştirilebilir, webhook\'lar her değişiklikte bir olay gönderir — böylece siteniz, mağazanız veya muhasebe sisteminiz güncel kalır.' },
          { q: 'Barkod var mı?', a: 'Evet. Ürünün ve her varyantın barkodu olabilir, etiketler doğrudan CRM\'den toplu yazdırılır.' },
          { q: 'Kendi verilerimizle deneyebilir miyiz?', a: 'Evet. Kayıt, Enterprise planını 14 gün ücretsiz ve kartsız verir — depo ve yapay zekâ departmanları dahildir. Ürünleri Excel\'den yükleyin, stoku ve tahmini kendi verilerinizle görün.' },
        ],
      },
    ],
  },
  cta: { k: 'Görmeye hazır mısınız?', t: 'Stoklarınızı Excel\'den taşıyalım ve depoyu 30 dakikada kendi verilerinizle gösterelim.' },
};

export const WAREHOUSE_T: Record<'ru' | 'en' | 'tr', WarehouseText> = { ru, en, tr };
