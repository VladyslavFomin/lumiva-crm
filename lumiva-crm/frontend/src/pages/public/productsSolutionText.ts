/* Тексты страницы «Решения → Товары» (ru/en/tr). Только реальные возможности (backend products/*):
 * категории с вложенностью (parentId, цвет, slug, порядок, активность); 16 типов своих полей (группы, обязательность,
 * показ в фильтрах/списке/быстрой правке, ширина); теги, связанные товары; статусы active/draft/archived/out_of_stock;
 * цена и себестоимость, цены в нескольких валютах, акционная цена с датами, оптовые пороги, комплекты; вес и габариты;
 * фото с обложкой; slug и SEO-мета; переводы карточки; варианты из атрибутов (генерация комбинаций, свой SKU, остаток,
 * цена, фото); штрихкод Code128 + QR и печать листа этикеток; история изменений (цена, себестоимость, статус, SKU,
 * штрихкод); публикация на выбранные сайты с модерацией (запрос → одобрение/отклонение с причиной, право products_publish);
 * публичный каталог по API (категории, товары, по SKU/внешнему ID), ingest с ключом идемпотентности; фиды Google Merchant
 * XML и CSV для WooCommerce по токену сайта; вебхуки created/updated/deleted/stock_changed/published; импорт XLSX/CSV
 * с предпросмотром, экспорт; аналитика каталога (стоимость, себестоимость, средняя маржа, по категориям/статусам/
 * валютам/тегам/складам); ИИ-ассистент (создание, поиск, цена/статус после подтверждения, массовые правки).
 * НЕТ: генерации EAN-13, синхронизации с маркетплейсами, ИИ «ищет дубли артикулов» (SKU и так уникален). */

type Item = { b: string; s: string };
type QA = { q: string; a: string };
type Card = { t: string; d: string; ic: string };

export type ProductsText = {
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
  catalog: {
    k: string; t: string; lede: string; items: Item[];
    vis: { tree: string; fields: string; items: string; cats: Array<[string, number, string[]]>; types: string[]; field: Array<[string, string]> };
  };
  card: { k: string; t: string; d: string; items: Card[] };
  variants: {
    k: string; t: string; lede: string; items: Item[];
    vis: { attrs: string; gen: string; cols: [string, string, string, string]; size: string; color: string; sizes: string[]; colors: Array<[string, string]>; base: string };
  };
  publish: {
    k: string; t: string; lede: string; items: Item[];
    vis: { product: string; steps: string[]; reject: string; sites: string; feeds: string; hooks: string };
  };
  work: { k: string; t: string; d: string; items: Card[] };
  pair: { cat: { title: string; items: string; rows: Array<[string, number]> }; margin: { title: string; price: string; cost: string; rows: Array<[string, number, number]> } };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string; aura: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

const ru: ProductsText = {
  crumbs: ['Решения', 'Товары'],
  kicker: 'Решение · Каталог товаров',
  t1: 'Каталог, который растёт',
  t2: 'вместе с ассортиментом.',
  sub: 'Категории любой вложенности, свои поля под вашу отрасль, варианты по размеру и цвету, цены в нескольких валютах, штрихкоды и этикетки. Публикуйте товары на свои сайты через модерацию, отдавайте фиды в Google Merchant и WooCommerce — из одного каталога в CRM.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '16', l: 'типов своих полей: от текста и списков до галереи, связей и повторителя' },
    { v: '4', l: 'статуса товара: активен, черновик, в архиве, нет в наличии' },
    { v: '2', l: 'готовых фида: Google Merchant (XML) и CSV для WooCommerce' },
    { v: '5', l: 'событий для вебхуков: создан, изменён, удалён, остаток изменился, опубликован' },
  ],
  prob: {
    k: '01 · Задача',
    t: 'Каталог в Excel живёт до первой сотни товаров.',
    d: 'Дальше начинаются дубли артикулов, характеристики в комментариях, цены в трёх валютах на разных листах и фото в чьей-то папке. Сайт обновляют вручную, штрихкоды рисуют в графическом редакторе, а новый сотрудник неделю разбирается, что где лежит. В Lumiva у каталога есть структура: категории, свои поля, варианты и история изменений — и один источник для сайта, фидов и продаж.',
  },
  catalog: {
    k: '02 · Структура каталога',
    t: 'Категории и поля — под вашу отрасль.',
    lede: 'Одежда, электроника, косметика или запчасти — структура каталога настраивается один раз, и все товары живут по ней.',
    items: [
      { b: 'Категории любой глубины', s: ' — «Одежда → Мужская → Верхняя одежда»: у каждой категории цвет, адрес (slug), порядок и признак активности.' },
      { b: '16 типов полей', s: ' — текст, длинный текст и редактор, число, дата и время, да/нет, списки с одним и несколькими вариантами, ссылка, файл и галерея, цвет, связь с другим объектом и повторитель.' },
      { b: 'Группы и правила', s: ' — поля собираются в группы, могут быть обязательными, показываться в фильтрах, в списке товаров и в быстрой правке.' },
      { b: 'Теги и связанные товары', s: ' — метки для подборок и «с этим покупают» прямо в карточке.' },
      { b: 'Статусы', s: ' — активен, черновик, в архиве или нет в наличии: черновики не попадают на сайт, архив не мешает в списке.' },
    ],
    vis: {
      tree: 'Категории',
      fields: 'Поля товара',
      items: 'товаров',
      cats: [['Одежда', 86, ['Мужская', 'Женская', 'Детская']], ['Обувь', 38, ['Кроссовки', 'Ботинки']], ['Аксессуары', 52, []]],
      types: ['Текст', 'Список', 'Число', 'Галерея', 'Цвет', 'Связь'],
      field: [['Материал', 'Список'], ['Состав, %', 'Число'], ['Фото на модели', 'Галерея'], ['Цвет ткани', 'Цвет']],
    },
  },
  card: {
    k: '03 · Карточка товара',
    t: 'Всё о товаре — в одной карточке.',
    d: 'Цены, себестоимость, фото, габариты, SEO и переводы — карточка готова и для продаж, и для сайта.',
    items: [
      { t: 'Цена и себестоимость', d: 'Себестоимость рядом с ценой — в аналитике сразу видна маржа по товарам и категориям.', ic: 'chart' },
      { t: 'Цены в разных валютах', d: 'Отдельные цены для евро, лиры, рубля и других валют, а не пересчёт по курсу.', ic: 'grid' },
      { t: 'Акции по датам', d: 'Акционная цена с датой начала и окончания — не нужно помнить, когда вернуть старую.', ic: 'clock' },
      { t: 'Оптовые цены', d: 'Пороги по количеству: от 10 штук — одна цена, от 50 — другая.', ic: 'filter' },
      { t: 'Комплекты', d: 'Набор из нескольких товаров с количеством каждого — продаётся как одна позиция.', ic: 'box' },
      { t: 'Фото и габариты', d: 'Галерея с обложкой, вес и размеры упаковки — для доставки и карточки на сайте.', ic: 'grid' },
      { t: 'SEO', d: 'Адрес страницы, заголовок и описание для поисковиков — у каждого товара.', ic: 'target' },
      { t: 'Переводы', d: 'Название, описание и SEO-поля на нужных языках — для сайта на нескольких языках.', ic: 'chat' },
      { t: 'Свои поля', d: 'Всё, что вы добавили в структуру каталога, — прямо в карточке, с проверкой обязательных полей.', ic: 'check' },
    ],
  },
  variants: {
    k: '04 · Варианты',
    t: 'Размер × цвет — без дублей карточек.',
    lede: 'Одна карточка товара — и набор вариантов, у каждого из которых свой артикул, остаток, цена и фото.',
    items: [
      { b: 'Атрибуты', s: ' — размер, цвет, объём, комплектация: значения задаются один раз, у цвета может быть свой оттенок для отображения.' },
      { b: 'Генерация вариантов', s: ' — выберите атрибуты, и CRM создаст все комбинации сама: 3 размера × 2 цвета = 6 вариантов.' },
      { b: 'Свой SKU и остаток', s: ' — у каждого варианта свой артикул и свой остаток на складе.' },
      { b: 'Своя цена и фото', s: ' — если вариант дороже или выглядит иначе, цена и фото задаются отдельно, иначе берутся из карточки.' },
    ],
    vis: { attrs: 'Атрибуты', gen: 'Создать варианты', cols: ['Вариант', 'SKU', 'Остаток', 'Цена'], size: 'Размер', color: 'Цвет', sizes: ['S', 'M', 'L'], colors: [['Чёрный', '#111113'], ['Песочный', '#d9c3a0']], base: 'как в карточке' },
  },
  publish: {
    k: '05 · Публикация и каналы',
    t: 'Один каталог — для сайтов, фидов и ваших систем.',
    lede: 'Товары из CRM попадают на ваши сайты, в Google Merchant и в другие системы. Что и где показывать, решаете вы.',
    items: [
      { b: 'Модерация публикации', s: ' — редактор отправляет товар на публикацию, а сотрудник с правом публикации одобряет его или отклоняет с причиной.' },
      { b: 'Выбор сайтов', s: ' — товар можно показать на всех сайтах или только на выбранных.' },
      { b: 'Публичный каталог по API', s: ' — сайт или витрина получают категории и товары, в том числе по артикулу или внешнему ID.' },
      { b: 'Фиды', s: ' — Google Merchant (XML) и CSV для импорта в WooCommerce по ссылке сайта, без ручной выгрузки.' },
      { b: 'Вебхуки и приём данных', s: ' — ваши системы узнают о создании, изменении, удалении, публикации и смене остатка, а сами могут отправлять товары в CRM.' },
    ],
    vis: { product: 'Кроссовки classic, белые', steps: ['Черновик', 'На модерации', 'Опубликован'], reject: 'или отклонён с причиной', sites: 'Сайты', feeds: 'Фиды', hooks: 'Вебхук' },
  },
  work: {
    k: '06 · Работа с каталогом',
    t: 'Чтобы каталог не пришлось вести вручную.',
    d: 'Импорт, этикетки, история и аналитика — всё, что экономит часы на рутине.',
    items: [
      { t: 'Импорт из Excel и CSV', d: 'Загрузка каталога с предпросмотром перед применением — и экспорт обратно.', ic: 'grid' },
      { t: 'Штрихкоды и QR', d: 'Штрихкод Code128 и QR-код по артикулу или штрихкоду, печать листа этикеток для выбранных товаров.', ic: 'box' },
      { t: 'История изменений', d: 'Кто и когда менял цену, себестоимость, статус, артикул и штрихкод.', ic: 'log' },
      { t: 'Аналитика каталога', d: 'Стоимость каталога и себестоимость, средняя маржа, разбивка по категориям, статусам, валютам, тегам и складам.', ic: 'chart' },
      { t: 'Склад', d: 'Остатки по складам, пороги минимума и дозаказ — в решении «Склад».', ic: 'filter' },
      { t: 'Права доступа', d: 'Кто может редактировать товары, а кто — публиковать их на сайте, задаётся ролями.', ic: 'shield' },
    ],
  },
  pair: {
    cat: { title: 'Товары по категориям · пример', items: 'товаров', rows: [['Одежда', 86], ['Аксессуары', 52], ['Обувь', 38], ['Товары для дома', 24]] },
    margin: { title: 'Цена и себестоимость по категориям · пример', price: 'цена', cost: 'себестоимость', rows: [['Одежда', 42, 18], ['Аксессуары', 58, 21], ['Обувь', 96, 52], ['Товары для дома', 31, 14]] },
  },
  steps: {
    k: '07 · Как это работает',
    t: 'От структуры каталога до витрины.',
    d: 'Пять шагов, после которых каталог живёт в CRM, а не в таблицах.',
    n: 'Шаг',
    items: [
      { t: 'Задайте структуру', d: 'Дерево категорий и свои поля — один раз, дальше все товары следуют схеме.' },
      { t: 'Загрузите товары', d: 'Импорт из Excel или CSV с предпросмотром, фото и цены — в карточки.' },
      { t: 'Создайте варианты', d: 'Выберите атрибуты — CRM сгенерирует все комбинации размеров и цветов.' },
      { t: 'Напечатайте этикетки', d: 'Штрихкоды и QR для выбранных товаров — на один лист.' },
      { t: 'Опубликуйте', d: 'Через модерацию — на нужные сайты, в Google Merchant и WooCommerce.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs каталог в Excel',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Структура', lumiva: 'Дерево категорий и свои поля с правилами', typical: 'Колонки, которые каждый заполняет по-своему' },
      { metric: 'Размеры и цвета', lumiva: 'Варианты со своим SKU и остатком', typical: 'Отдельная строка на каждый размер' },
      { metric: 'Сайт', lumiva: 'Публикация через модерацию, API и фиды', typical: 'Ручной перенос на сайт' },
      { metric: 'Кто что менял', lumiva: 'История цены, статуса, артикула и штрихкода', typical: 'Неизвестно, откуда новая цена' },
      { metric: 'Этикетки', lumiva: 'Штрихкод и QR на лист в один клик', typical: 'Рисуют в графическом редакторе' },
    ],
  },
  ai: {
    k: 'ИИ в каталоге',
    name: 'ИИ-ассистент',
    job: 'Чат с доступом к каталогу',
    text: 'Найдёт товар, создаст карточку или категорию, массово обновит позиции и поменяет цену или статус. Цену меняет только после того, как покажет текущую и новую и получит ваше «да».',
    list: ['Ищет товар по названию и SKU', 'Ставит акционную цену на неделю', 'Переводит позиции в архив'],
    hire: 'Все функции',
    aura: 'Дашборд «Склад и остатки»',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Структура и карточка',
        items: [
          { q: 'Сколько уровней вложенности у категорий?', a: 'Ограничения нет: «Одежда → Мужская → Верхняя одежда → Куртки». У каждой категории есть цвет, адрес (slug), порядок и признак активности — неактивные скрываются, не удаляя товары.' },
          { q: 'Какие поля можно добавить в карточку?', a: '16 типов: текст, длинный текст, редактор с форматированием, число, дата, дата и время, да/нет, список с одним и с несколькими вариантами, переключатель, ссылка, файл, галерея, цвет, связь с другим объектом и повторитель для таблиц внутри карточки. Поля можно группировать, делать обязательными и показывать в фильтрах, списке и быстрой правке.' },
          { q: 'Можно ли задать цены в разных валютах?', a: 'Да. У товара есть основная цена и валюта, а также отдельные цены в других валютах — они не пересчитываются по курсу, а задаются вами. Есть акционная цена с датами начала и окончания и оптовые цены по количеству.' },
          { q: 'Есть ли комплекты и связанные товары?', a: 'Да. Комплект собирается из нескольких товаров с количеством каждого и продаётся как одна позиция. Связанные товары и теги помогают делать подборки.' },
          { q: 'Поддерживаются ли переводы карточки?', a: 'Да. Название, описание и SEO-поля можно заполнить на нужных языках — это удобно для сайта на нескольких языках.' },
        ],
      },
      {
        g: 'Варианты и этикетки',
        items: [
          { q: 'Как работают варианты?', a: 'Создайте атрибуты — например, размер и цвет — и выберите их в карточке. CRM сама создаст все комбинации. У каждого варианта свой артикул и остаток, а цену и фото можно задать отдельно или оставить как в карточке.' },
          { q: 'Какие штрихкоды поддерживаются?', a: 'Для товара печатаются штрихкод Code128 и QR-код по артикулу или штрихкоду, который вы указали в карточке. Можно выбрать несколько товаров и напечатать лист этикеток с названием, ценой и кодами. Генерации номеров EAN-13 нет — если у вас есть свои EAN, просто укажите их в поле штрихкода.' },
          { q: 'Может ли быть два товара с одним артикулом?', a: 'Нет. Артикул и штрихкод уникальны в пределах компании, поэтому дубли не появятся ни при ручном вводе, ни при импорте.' },
        ],
      },
      {
        g: 'Сайт и интеграции',
        items: [
          { q: 'Как товары попадают на сайт?', a: 'Сайт получает каталог по публичному API: категории, список товаров и товар по артикулу или внешнему ID. Показываются только опубликованные товары; можно выбрать, на каких из ваших сайтов они видны.' },
          { q: 'Как устроена модерация публикации?', a: 'Редактор не может сам вывести товар на сайт — он отправляет запрос на публикацию. Сотрудник с правом публикации одобряет его или отклоняет с причиной. Так на сайт не попадают недооформленные карточки.' },
          { q: 'Есть ли фиды для Google и WooCommerce?', a: 'Да. По ссылке с токеном сайта доступны фид Google Merchant Center в XML и CSV для импорта в WooCommerce. Они собираются из каталога автоматически.' },
          { q: 'Можно связать каталог с нашей учётной системой?', a: 'Да. Вебхуки сообщают о создании, изменении, удалении и публикации товара и о смене остатка. В обратную сторону ваша система может отправлять товары в CRM по API — с ключом идемпотентности, чтобы повторная отправка не создала дубль.' },
          { q: 'Есть синхронизация с маркетплейсами?', a: 'Прямых подключений к маркетплейсам пока нет. Для каналов, которые принимают фиды или API, можно использовать фид Google Merchant, CSV для WooCommerce, публичный API и вебхуки.' },
        ],
      },
      {
        g: 'Работа и перенос',
        items: [
          { q: 'Как перенести каталог из Excel или 1С?', a: 'Выгрузите каталог в Excel или CSV и загрузите через импорт — перед применением вы увидите предпросмотр. Каталог можно и выгрузить обратно.' },
          { q: 'Видно ли, кто менял цену?', a: 'Да. В карточке товара есть история изменений цены, себестоимости, статуса, артикула и штрихкода — с автором и датой.' },
          { q: 'Можно попробовать на своих данных?', a: 'Да. Регистрация даёт 14 дней тарифа Enterprise бесплатно и без карты. Загрузите свой каталог из Excel и посмотрите, как он ляжет в структуру.' },
        ],
      },
    ],
  },
  cta: { k: 'Готовы посмотреть?', t: 'Перенесём ваш каталог из Excel и покажем его в CRM за 30 минут.' },
};

const en: ProductsText = {
  crumbs: ['Solutions', 'Products'],
  kicker: 'Solution · Product catalogue',
  t1: 'A catalogue that grows',
  t2: 'with your range.',
  sub: 'Categories of any depth, your own fields for your industry, size and colour variants, prices in several currencies, barcodes and labels. Publish products to your websites through moderation and serve feeds to Google Merchant and WooCommerce — all from one catalogue in the CRM.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '16', l: 'custom field types: from text and lists to galleries, relations and repeaters' },
    { v: '4', l: 'product statuses: active, draft, archived, out of stock' },
    { v: '2', l: 'ready-made feeds: Google Merchant (XML) and CSV for WooCommerce' },
    { v: '5', l: 'webhook events: created, updated, deleted, stock changed, published' },
  ],
  prob: {
    k: '01 · The problem',
    t: 'An Excel catalogue survives until the first hundred items.',
    d: 'Then come duplicate SKUs, specs in comments, prices in three currencies on different sheets and photos in someone\'s folder. The website is updated by hand, barcodes are drawn in a graphics editor, and a new hire spends a week figuring out where everything is. In Lumiva the catalogue has a structure: categories, custom fields, variants and change history — and one source for the website, feeds and sales.',
  },
  catalog: {
    k: '02 · Catalogue structure',
    t: 'Categories and fields — for your industry.',
    lede: 'Clothing, electronics, cosmetics or spare parts — set up the catalogue structure once, and every product follows it.',
    items: [
      { b: 'Categories of any depth', s: ' — "Clothing → Men → Outerwear": each category has a colour, URL slug, order and an active flag.' },
      { b: '16 field types', s: ' — text, long text and rich editor, number, date and time, yes/no, single and multi-select lists, link, file and gallery, colour, relation to another object and repeater.' },
      { b: 'Groups and rules', s: ' — fields are grouped, can be required, and can show in filters, in the product list and in quick edit.' },
      { b: 'Tags and related products', s: ' — labels for collections and "bought together" right in the card.' },
      { b: 'Statuses', s: ' — active, draft, archived or out of stock: drafts never reach the website, and archived items stay out of the way.' },
    ],
    vis: {
      tree: 'Categories',
      fields: 'Product fields',
      items: 'items',
      cats: [['Clothing', 86, ['Men', 'Women', 'Kids']], ['Footwear', 38, ['Sneakers', 'Boots']], ['Accessories', 52, []]],
      types: ['Text', 'List', 'Number', 'Gallery', 'Colour', 'Relation'],
      field: [['Material', 'List'], ['Composition, %', 'Number'], ['Model photos', 'Gallery'], ['Fabric colour', 'Colour']],
    },
  },
  card: {
    k: '03 · Product card',
    t: 'Everything about a product — in one card.',
    d: 'Prices, cost, photos, dimensions, SEO and translations — the card is ready for both sales and the website.',
    items: [
      { t: 'Price and cost', d: 'Cost next to the price — analytics shows margin by product and category right away.', ic: 'chart' },
      { t: 'Prices in several currencies', d: 'Separate prices for euro, lira, rouble and other currencies, not an exchange-rate conversion.', ic: 'grid' },
      { t: 'Dated promotions', d: 'A sale price with start and end dates — no need to remember when to switch back.', ic: 'clock' },
      { t: 'Wholesale prices', d: 'Quantity tiers: one price from 10 pieces, another from 50.', ic: 'filter' },
      { t: 'Bundles', d: 'A set of several products with a quantity for each — sold as one item.', ic: 'box' },
      { t: 'Photos and dimensions', d: 'A gallery with a cover, weight and package size — for shipping and the product page.', ic: 'grid' },
      { t: 'SEO', d: 'Page URL, title and description for search engines — for every product.', ic: 'target' },
      { t: 'Translations', d: 'Name, description and SEO fields in the languages you need — for a multilingual website.', ic: 'chat' },
      { t: 'Custom fields', d: 'Everything you added to the catalogue structure, right in the card, with required-field checks.', ic: 'check' },
    ],
  },
  variants: {
    k: '04 · Variants',
    t: 'Size × colour — without duplicate cards.',
    lede: 'One product card and a set of variants, each with its own SKU, stock, price and photos.',
    items: [
      { b: 'Attributes', s: ' — size, colour, volume, configuration: values are set once, and a colour can have its own display shade.' },
      { b: 'Variant generation', s: ' — pick the attributes and the CRM creates every combination: 3 sizes × 2 colours = 6 variants.' },
      { b: 'Own SKU and stock', s: ' — each variant has its own SKU and its own warehouse stock.' },
      { b: 'Own price and photos', s: ' — if a variant costs more or looks different, set its price and photos separately; otherwise they come from the card.' },
    ],
    vis: { attrs: 'Attributes', gen: 'Create variants', cols: ['Variant', 'SKU', 'Stock', 'Price'], size: 'Size', color: 'Colour', sizes: ['S', 'M', 'L'], colors: [['Black', '#111113'], ['Sand', '#d9c3a0']], base: 'as in card' },
  },
  publish: {
    k: '05 · Publishing and channels',
    t: 'One catalogue — for websites, feeds and your systems.',
    lede: 'Products from the CRM reach your websites, Google Merchant and other systems. You decide what goes where.',
    items: [
      { b: 'Publishing moderation', s: ' — an editor submits a product for publishing, and an employee with publishing rights approves it or rejects it with a reason.' },
      { b: 'Choice of websites', s: ' — show a product on all websites or only on selected ones.' },
      { b: 'Public catalogue API', s: ' — a website or storefront gets categories and products, including by SKU or external ID.' },
      { b: 'Feeds', s: ' — Google Merchant (XML) and CSV for WooCommerce import via the site link, with no manual exports.' },
      { b: 'Webhooks and intake', s: ' — your systems learn about creation, updates, deletion, publishing and stock changes, and can send products into the CRM themselves.' },
    ],
    vis: { product: 'Classic sneakers, white', steps: ['Draft', 'In review', 'Published'], reject: 'or rejected with a reason', sites: 'Websites', feeds: 'Feeds', hooks: 'Webhook' },
  },
  work: {
    k: '06 · Working with the catalogue',
    t: 'So the catalogue never has to be kept by hand.',
    d: 'Import, labels, history and analytics — everything that saves hours of routine.',
    items: [
      { t: 'Import from Excel and CSV', d: 'Upload the catalogue with a preview before applying — and export it back.', ic: 'grid' },
      { t: 'Barcodes and QR', d: 'A Code128 barcode and QR code from the SKU or barcode, and a label sheet for selected products.', ic: 'box' },
      { t: 'Change history', d: 'Who changed price, cost, status, SKU and barcode, and when.', ic: 'log' },
      { t: 'Catalogue analytics', d: 'Catalogue value and cost, average margin, breakdown by category, status, currency, tag and warehouse.', ic: 'chart' },
      { t: 'Warehouse', d: 'Stock by warehouse, minimum thresholds and reordering — in the "Warehouse" solution.', ic: 'filter' },
      { t: 'Access rights', d: 'Who can edit products and who can publish them to the website is set by roles.', ic: 'shield' },
    ],
  },
  pair: {
    cat: { title: 'Products by category · example', items: 'items', rows: [['Clothing', 86], ['Accessories', 52], ['Footwear', 38], ['Home goods', 24]] },
    margin: { title: 'Price and cost by category · example', price: 'price', cost: 'cost', rows: [['Clothing', 42, 18], ['Accessories', 58, 21], ['Footwear', 96, 52], ['Home goods', 31, 14]] },
  },
  steps: {
    k: '07 · How it works',
    t: 'From catalogue structure to storefront.',
    d: 'Five steps after which the catalogue lives in the CRM, not in spreadsheets.',
    n: 'Step',
    items: [
      { t: 'Set the structure', d: 'A category tree and custom fields — once; every product then follows the scheme.' },
      { t: 'Upload products', d: 'Import from Excel or CSV with a preview, photos and prices into the cards.' },
      { t: 'Create variants', d: 'Pick attributes — the CRM generates every size and colour combination.' },
      { t: 'Print labels', d: 'Barcodes and QR codes for selected products — on one sheet.' },
      { t: 'Publish', d: 'Through moderation — to the right websites, Google Merchant and WooCommerce.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs a catalogue in Excel',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'Structure', lumiva: 'A category tree and custom fields with rules', typical: 'Columns everyone fills in their own way' },
      { metric: 'Sizes and colours', lumiva: 'Variants with their own SKU and stock', typical: 'A separate row for every size' },
      { metric: 'Website', lumiva: 'Publishing through moderation, API and feeds', typical: 'Copying to the website by hand' },
      { metric: 'Who changed what', lumiva: 'History of price, status, SKU and barcode', typical: 'Nobody knows where the new price came from' },
      { metric: 'Labels', lumiva: 'Barcode and QR on a sheet in one click', typical: 'Drawn in a graphics editor' },
    ],
  },
  ai: {
    k: 'AI in the catalogue',
    name: 'AI assistant',
    job: 'Chat with catalogue access',
    text: 'Finds a product, creates a card or category, bulk-updates items and changes a price or status. It changes a price only after showing you the current and the new one and getting your "yes".',
    list: ['Finds a product by name and SKU', 'Sets a sale price for a week', 'Moves items to the archive'],
    hire: 'All features',
    aura: '"Stock levels" dashboard',
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Structure and product card',
        items: [
          { q: 'How deep can categories go?', a: 'There is no limit: "Clothing → Men → Outerwear → Jackets". Each category has a colour, URL slug, order and an active flag — inactive ones are hidden without deleting products.' },
          { q: 'Which fields can we add to the card?', a: '16 types: text, long text, rich-text editor, number, date, date and time, yes/no, single and multi-select lists, radio, link, file, gallery, colour, relation to another object and a repeater for tables inside the card. Fields can be grouped, made required and shown in filters, the list and quick edit.' },
          { q: 'Can we set prices in different currencies?', a: 'Yes. A product has a main price and currency plus separate prices in other currencies — they are set by you, not converted at a rate. There is also a sale price with start and end dates and wholesale prices by quantity.' },
          { q: 'Are there bundles and related products?', a: 'Yes. A bundle is built from several products with a quantity for each and is sold as one item. Related products and tags help build collections.' },
          { q: 'Are card translations supported?', a: 'Yes. Name, description and SEO fields can be filled in the languages you need — handy for a multilingual website.' },
        ],
      },
      {
        g: 'Variants and labels',
        items: [
          { q: 'How do variants work?', a: 'Create attributes — for example size and colour — and pick them in the card. The CRM creates every combination itself. Each variant has its own SKU and stock, and its price and photos can be set separately or left as in the card.' },
          { q: 'Which barcodes are supported?', a: 'A Code128 barcode and a QR code are printed from the SKU or the barcode you entered in the card. Select several products and print a label sheet with name, price and codes. EAN-13 numbers are not generated — if you have your own EANs, just enter them in the barcode field.' },
          { q: 'Can two products share one SKU?', a: 'No. SKU and barcode are unique within the company, so duplicates do not appear either on manual entry or on import.' },
        ],
      },
      {
        g: 'Website and integrations',
        items: [
          { q: 'How do products get onto the website?', a: 'The website gets the catalogue via the public API: categories, the product list and a product by SKU or external ID. Only published products are shown, and you can choose which of your websites they appear on.' },
          { q: 'How does publishing moderation work?', a: 'An editor cannot put a product on the website alone — they send a publishing request. An employee with publishing rights approves it or rejects it with a reason. That keeps half-finished cards off the website.' },
          { q: 'Are there feeds for Google and WooCommerce?', a: 'Yes. Via a link with the site token you get a Google Merchant Center feed in XML and a CSV for WooCommerce import. Both are built from the catalogue automatically.' },
          { q: 'Can we connect the catalogue to our accounting system?', a: 'Yes. Webhooks report product creation, updates, deletion and publishing, and stock changes. The other way, your system can send products into the CRM via the API — with an idempotency key so a resend never creates a duplicate.' },
          { q: 'Is there marketplace sync?', a: 'There are no direct marketplace connections yet. For channels that accept feeds or an API, use the Google Merchant feed, the WooCommerce CSV, the public API and webhooks.' },
        ],
      },
      {
        g: 'Daily work and migration',
        items: [
          { q: 'How do we move the catalogue from Excel or 1C?', a: 'Export the catalogue to Excel or CSV and upload it via import — you will see a preview before applying. The catalogue can be exported back as well.' },
          { q: 'Can we see who changed a price?', a: 'Yes. The product card has a history of price, cost, status, SKU and barcode changes — with author and date.' },
          { q: 'Can we try it on our own data?', a: 'Yes. Sign-up gives 14 days of the Enterprise plan for free, no card required. Upload your catalogue from Excel and see how it fits the structure.' },
        ],
      },
    ],
  },
  cta: { k: 'Ready to see it?', t: 'We\'ll move your catalogue from Excel and show it in the CRM in 30 minutes.' },
};

const tr: ProductsText = {
  crumbs: ['Çözümler', 'Ürünler'],
  kicker: 'Çözüm · Ürün kataloğu',
  t1: 'Ürün yelpazenizle',
  t2: 'birlikte büyüyen katalog.',
  sub: 'Her derinlikte kategoriler, sektörünüze özel alanlar, beden ve renk varyantları, birden fazla para biriminde fiyatlar, barkodlar ve etiketler. Ürünleri moderasyonla sitelerinizde yayınlayın, Google Merchant ve WooCommerce\'e feed verin — hepsi CRM\'deki tek katalogdan.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '16', l: 'özel alan türü: metin ve listelerden galeri, ilişki ve tekrarlayıcıya' },
    { v: '4', l: 'ürün durumu: aktif, taslak, arşiv, stokta yok' },
    { v: '2', l: 'hazır feed: Google Merchant (XML) ve WooCommerce için CSV' },
    { v: '5', l: 'webhook olayı: oluşturuldu, güncellendi, silindi, stok değişti, yayınlandı' },
  ],
  prob: {
    k: '01 · Sorun',
    t: 'Excel\'deki katalog ilk yüz ürüne kadar yaşar.',
    d: 'Sonra mükerrer SKU\'lar, yorumlardaki özellikler, farklı sayfalarda üç para biriminde fiyatlar ve birinin klasöründeki fotoğraflar başlar. Site elle güncellenir, barkodlar grafik editöründe çizilir, yeni çalışan neyin nerede olduğunu bir hafta çözer. Lumiva\'da kataloğun bir yapısı vardır: kategoriler, özel alanlar, varyantlar ve değişiklik geçmişi — site, feed\'ler ve satışlar için tek kaynak.',
  },
  catalog: {
    k: '02 · Katalog yapısı',
    t: 'Kategoriler ve alanlar — sektörünüze göre.',
    lede: 'Giyim, elektronik, kozmetik veya yedek parça — katalog yapısı bir kez ayarlanır ve tüm ürünler ona göre yaşar.',
    items: [
      { b: 'Her derinlikte kategoriler', s: ' — "Giyim → Erkek → Dış giyim": her kategorinin rengi, adresi (slug), sırası ve aktiflik durumu var.' },
      { b: '16 alan türü', s: ' — metin, uzun metin ve editör, sayı, tarih ve saat, evet/hayır, tekli ve çoklu seçim listeleri, bağlantı, dosya ve galeri, renk, başka bir nesneyle ilişki ve tekrarlayıcı.' },
      { b: 'Gruplar ve kurallar', s: ' — alanlar gruplanır, zorunlu olabilir, filtrelerde, ürün listesinde ve hızlı düzenlemede gösterilebilir.' },
      { b: 'Etiketler ve ilgili ürünler', s: ' — koleksiyonlar için etiketler ve "bununla birlikte alınanlar" doğrudan kartta.' },
      { b: 'Durumlar', s: ' — aktif, taslak, arşiv veya stokta yok: taslaklar siteye çıkmaz, arşiv listede engel olmaz.' },
    ],
    vis: {
      tree: 'Kategoriler',
      fields: 'Ürün alanları',
      items: 'ürün',
      cats: [['Giyim', 86, ['Erkek', 'Kadın', 'Çocuk']], ['Ayakkabı', 38, ['Spor ayakkabı', 'Bot']], ['Aksesuar', 52, []]],
      types: ['Metin', 'Liste', 'Sayı', 'Galeri', 'Renk', 'İlişki'],
      field: [['Malzeme', 'Liste'], ['İçerik, %', 'Sayı'], ['Model fotoğrafları', 'Galeri'], ['Kumaş rengi', 'Renk']],
    },
  },
  card: {
    k: '03 · Ürün kartı',
    t: 'Ürünle ilgili her şey — tek kartta.',
    d: 'Fiyatlar, maliyet, fotoğraflar, ölçüler, SEO ve çeviriler — kart hem satış hem site için hazır.',
    items: [
      { t: 'Fiyat ve maliyet', d: 'Maliyet fiyatın yanında — analitikte ürün ve kategori bazında marj hemen görünür.', ic: 'chart' },
      { t: 'Farklı para birimlerinde fiyat', d: 'Euro, lira, ruble ve diğer para birimleri için kurla çevrilmeyen ayrı fiyatlar.', ic: 'grid' },
      { t: 'Tarihli kampanyalar', d: 'Başlangıç ve bitiş tarihli indirimli fiyat — eskisine ne zaman döneceğinizi hatırlamanız gerekmez.', ic: 'clock' },
      { t: 'Toptan fiyatlar', d: 'Miktar eşikleri: 10 adetten bir fiyat, 50 adetten başka.', ic: 'filter' },
      { t: 'Setler', d: 'Her birinin miktarıyla birkaç üründen oluşan set — tek kalem olarak satılır.', ic: 'box' },
      { t: 'Fotoğraflar ve ölçüler', d: 'Kapaklı galeri, ağırlık ve paket boyutları — kargo ve ürün sayfası için.', ic: 'grid' },
      { t: 'SEO', d: 'Her ürün için arama motorları için sayfa adresi, başlık ve açıklama.', ic: 'target' },
      { t: 'Çeviriler', d: 'Gerekli dillerde ad, açıklama ve SEO alanları — çok dilli site için.', ic: 'chat' },
      { t: 'Özel alanlar', d: 'Katalog yapısına eklediğiniz her şey doğrudan kartta, zorunlu alan kontrolüyle.', ic: 'check' },
    ],
  },
  variants: {
    k: '04 · Varyantlar',
    t: 'Beden × renk — mükerrer kart olmadan.',
    lede: 'Tek bir ürün kartı ve her birinin kendi SKU\'su, stoku, fiyatı ve fotoğrafı olan varyantlar.',
    items: [
      { b: 'Nitelikler', s: ' — beden, renk, hacim, set: değerler bir kez belirlenir, rengin kendi görüntüleme tonu olabilir.' },
      { b: 'Varyant oluşturma', s: ' — nitelikleri seçin, CRM tüm kombinasyonları kendisi oluşturur: 3 beden × 2 renk = 6 varyant.' },
      { b: 'Kendi SKU\'su ve stoku', s: ' — her varyantın kendi SKU\'su ve depoda kendi stoku var.' },
      { b: 'Kendi fiyatı ve fotoğrafı', s: ' — varyant daha pahalıysa veya farklı görünüyorsa fiyatı ve fotoğrafı ayrı belirlenir, yoksa karttan alınır.' },
    ],
    vis: { attrs: 'Nitelikler', gen: 'Varyant oluştur', cols: ['Varyant', 'SKU', 'Stok', 'Fiyat'], size: 'Beden', color: 'Renk', sizes: ['S', 'M', 'L'], colors: [['Siyah', '#111113'], ['Kum', '#d9c3a0']], base: 'karttaki gibi' },
  },
  publish: {
    k: '05 · Yayın ve kanallar',
    t: 'Tek katalog — siteler, feed\'ler ve sistemleriniz için.',
    lede: 'CRM\'deki ürünler sitelerinize, Google Merchant\'a ve diğer sistemlere ulaşır. Neyin nerede gösterileceğine siz karar verirsiniz.',
    items: [
      { b: 'Yayın moderasyonu', s: ' — editör ürünü yayına gönderir, yayın yetkisi olan çalışan onu onaylar veya nedeniyle reddeder.' },
      { b: 'Site seçimi', s: ' — ürünü tüm sitelerde veya yalnızca seçilenlerde gösterin.' },
      { b: 'API ile herkese açık katalog', s: ' — site veya vitrin kategorileri ve ürünleri, SKU veya harici ID ile de alır.' },
      { b: 'Feed\'ler', s: ' — site bağlantısıyla Google Merchant (XML) ve WooCommerce içe aktarımı için CSV, elle dışa aktarma olmadan.' },
      { b: 'Webhook\'lar ve veri alımı', s: ' — sistemleriniz oluşturma, güncelleme, silme, yayın ve stok değişikliklerinden haberdar olur, ürünleri kendileri de CRM\'e gönderebilir.' },
    ],
    vis: { product: 'Klasik spor ayakkabı, beyaz', steps: ['Taslak', 'İncelemede', 'Yayında'], reject: 'veya nedeniyle reddedildi', sites: 'Siteler', feeds: 'Feed\'ler', hooks: 'Webhook' },
  },
  work: {
    k: '06 · Katalogla çalışma',
    t: 'Kataloğu elle tutmak zorunda kalmamak için.',
    d: 'İçe aktarma, etiketler, geçmiş ve analitik — rutinden saatler kazandıran her şey.',
    items: [
      { t: 'Excel ve CSV\'den içe aktarma', d: 'Kataloğu uygulamadan önce önizlemeyle yükleyin — ve geri dışa aktarın.', ic: 'grid' },
      { t: 'Barkod ve QR', d: 'SKU veya barkoddan Code128 barkodu ve QR kodu, seçilen ürünler için etiket sayfası.', ic: 'box' },
      { t: 'Değişiklik geçmişi', d: 'Fiyatı, maliyeti, durumu, SKU\'yu ve barkodu kimin ne zaman değiştirdiği.', ic: 'log' },
      { t: 'Katalog analitiği', d: 'Katalog değeri ve maliyeti, ortalama marj, kategori, durum, para birimi, etiket ve depo kırılımı.', ic: 'chart' },
      { t: 'Depo', d: 'Depolara göre stok, minimum eşikler ve yeniden sipariş — "Depo" çözümünde.', ic: 'filter' },
      { t: 'Erişim hakları', d: 'Ürünleri kimin düzenleyebileceği ve kimin sitede yayınlayabileceği rollerle belirlenir.', ic: 'shield' },
    ],
  },
  pair: {
    cat: { title: 'Kategorilere göre ürünler · örnek', items: 'ürün', rows: [['Giyim', 86], ['Aksesuar', 52], ['Ayakkabı', 38], ['Ev ürünleri', 24]] },
    margin: { title: 'Kategorilere göre fiyat ve maliyet · örnek', price: 'fiyat', cost: 'maliyet', rows: [['Giyim', 42, 18], ['Aksesuar', 58, 21], ['Ayakkabı', 96, 52], ['Ev ürünleri', 31, 14]] },
  },
  steps: {
    k: '07 · Nasıl çalışır',
    t: 'Katalog yapısından vitrine.',
    d: 'Kataloğun tablolarda değil CRM\'de yaşaması için beş adım.',
    n: 'Adım',
    items: [
      { t: 'Yapıyı belirleyin', d: 'Kategori ağacı ve özel alanlar — bir kez; sonra tüm ürünler şemaya uyar.' },
      { t: 'Ürünleri yükleyin', d: 'Excel veya CSV\'den önizlemeyle içe aktarma, fotoğraflar ve fiyatlar kartlara.' },
      { t: 'Varyant oluşturun', d: 'Nitelikleri seçin — CRM tüm beden ve renk kombinasyonlarını oluşturur.' },
      { t: 'Etiket yazdırın', d: 'Seçilen ürünler için barkod ve QR — tek sayfada.' },
      { t: 'Yayınlayın', d: 'Moderasyonla — doğru sitelere, Google Merchant\'a ve WooCommerce\'e.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs Excel\'de katalog',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Yapı', lumiva: 'Kategori ağacı ve kurallı özel alanlar', typical: 'Herkesin kendi doldurduğu sütunlar' },
      { metric: 'Beden ve renkler', lumiva: 'Kendi SKU\'su ve stoku olan varyantlar', typical: 'Her beden için ayrı satır' },
      { metric: 'Site', lumiva: 'Moderasyon, API ve feed\'lerle yayın', typical: 'Siteye elle aktarma' },
      { metric: 'Kim neyi değiştirdi', lumiva: 'Fiyat, durum, SKU ve barkod geçmişi', typical: 'Yeni fiyatın nereden geldiği bilinmez' },
      { metric: 'Etiketler', lumiva: 'Tek tıkla sayfaya barkod ve QR', typical: 'Grafik editöründe çizilir' },
    ],
  },
  ai: {
    k: 'Katalogda yapay zekâ',
    name: 'Yapay zekâ asistanı',
    job: 'Kataloğa erişimli sohbet',
    text: 'Ürün bulur, kart veya kategori oluşturur, ürünleri toplu günceller, fiyatı veya durumu değiştirir. Fiyatı yalnızca mevcut ve yeni fiyatı gösterip "evet" yanıtınızı aldıktan sonra değiştirir.',
    list: ['Ad ve SKU ile ürün bulur', 'Bir haftalık indirimli fiyat koyar', 'Ürünleri arşive taşır'],
    hire: 'Tüm özellikler',
    aura: '"Stok durumu" panosu',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Yapı ve ürün kartı',
        items: [
          { q: 'Kategoriler kaç seviye derinliğe kadar inebilir?', a: 'Sınır yok: "Giyim → Erkek → Dış giyim → Montlar". Her kategorinin rengi, adresi (slug), sırası ve aktiflik durumu var — pasif olanlar ürünler silinmeden gizlenir.' },
          { q: 'Karta hangi alanlar eklenebilir?', a: '16 tür: metin, uzun metin, biçimlendirmeli editör, sayı, tarih, tarih ve saat, evet/hayır, tekli ve çoklu seçim listesi, seçenek düğmesi, bağlantı, dosya, galeri, renk, başka nesneyle ilişki ve kart içinde tablo için tekrarlayıcı. Alanlar gruplanabilir, zorunlu yapılabilir, filtrelerde, listede ve hızlı düzenlemede gösterilebilir.' },
          { q: 'Farklı para birimlerinde fiyat belirleyebilir miyiz?', a: 'Evet. Ürünün ana fiyatı ve para birimi ile diğer para birimlerinde ayrı fiyatları vardır — kurla çevrilmez, siz belirlersiniz. Ayrıca başlangıç ve bitiş tarihli indirimli fiyat ve miktara göre toptan fiyatlar var.' },
          { q: 'Setler ve ilgili ürünler var mı?', a: 'Evet. Set, her birinin miktarıyla birkaç üründen oluşturulur ve tek kalem olarak satılır. İlgili ürünler ve etiketler koleksiyon oluşturmaya yardımcı olur.' },
          { q: 'Kart çevirileri destekleniyor mu?', a: 'Evet. Ad, açıklama ve SEO alanları gerekli dillerde doldurulabilir — çok dilli site için kullanışlıdır.' },
        ],
      },
      {
        g: 'Varyantlar ve etiketler',
        items: [
          { q: 'Varyantlar nasıl çalışır?', a: 'Nitelikler oluşturun — örneğin beden ve renk — ve kartta seçin. CRM tüm kombinasyonları kendisi oluşturur. Her varyantın kendi SKU\'su ve stoku vardır, fiyatı ve fotoğrafı ayrı belirlenebilir veya karttaki gibi bırakılabilir.' },
          { q: 'Hangi barkodlar destekleniyor?', a: 'Kartta belirttiğiniz SKU veya barkoddan Code128 barkodu ve QR kodu yazdırılır. Birkaç ürün seçip ad, fiyat ve kodlarla bir etiket sayfası yazdırabilirsiniz. EAN-13 numarası üretilmez — kendi EAN\'larınız varsa barkod alanına girmeniz yeterli.' },
          { q: 'İki ürünün SKU\'su aynı olabilir mi?', a: 'Hayır. SKU ve barkod şirket içinde benzersizdir, bu yüzden ne elle girişte ne de içe aktarmada mükerrer oluşmaz.' },
        ],
      },
      {
        g: 'Site ve entegrasyonlar',
        items: [
          { q: 'Ürünler siteye nasıl çıkar?', a: 'Site kataloğu herkese açık API ile alır: kategoriler, ürün listesi ve SKU veya harici ID ile ürün. Yalnızca yayınlanmış ürünler gösterilir; sitelerinizden hangilerinde görüneceklerini seçebilirsiniz.' },
          { q: 'Yayın moderasyonu nasıl işler?', a: 'Editör ürünü siteye tek başına çıkaramaz — yayın isteği gönderir. Yayın yetkisi olan çalışan onu onaylar veya nedeniyle reddeder. Böylece yarım kalmış kartlar siteye çıkmaz.' },
          { q: 'Google ve WooCommerce için feed var mı?', a: 'Evet. Site anahtarlı bir bağlantıyla XML formatında Google Merchant Center feed\'i ve WooCommerce içe aktarımı için CSV alırsınız. İkisi de katalogdan otomatik oluşturulur.' },
          { q: 'Kataloğu muhasebe sistemimize bağlayabilir miyiz?', a: 'Evet. Webhook\'lar ürün oluşturma, güncelleme, silme ve yayınlama ile stok değişikliklerini bildirir. Ters yönde sisteminiz ürünleri API ile CRM\'e gönderebilir — tekrar gönderim mükerrer oluşturmasın diye idempotency anahtarıyla.' },
          { q: 'Pazar yerleriyle senkronizasyon var mı?', a: 'Pazar yerlerine doğrudan bağlantı henüz yok. Feed veya API kabul eden kanallar için Google Merchant feed\'i, WooCommerce CSV\'si, herkese açık API ve webhook\'lar kullanılabilir.' },
        ],
      },
      {
        g: 'Günlük iş ve taşıma',
        items: [
          { q: 'Kataloğu Excel\'den veya 1C\'den nasıl taşırız?', a: 'Kataloğu Excel veya CSV\'ye aktarın ve içe aktarma ile yükleyin — uygulamadan önce önizleme görürsünüz. Katalog geri de aktarılabilir.' },
          { q: 'Fiyatı kimin değiştirdiği görülebilir mi?', a: 'Evet. Ürün kartında fiyat, maliyet, durum, SKU ve barkod değişikliklerinin geçmişi yazar ve tarihle birlikte var.' },
          { q: 'Kendi verilerimizle deneyebilir miyiz?', a: 'Evet. Kayıt, Enterprise planını 14 gün ücretsiz ve kartsız verir. Kataloğunuzu Excel\'den yükleyin ve yapıya nasıl oturduğunu görün.' },
        ],
      },
    ],
  },
  cta: { k: 'Görmeye hazır mısınız?', t: 'Kataloğunuzu Excel\'den taşıyalım ve 30 dakikada CRM\'de gösterelim.' },
};

export const PRODUCTS_T: Record<'ru' | 'en' | 'tr', ProductsText> = { ru, en, tr };
