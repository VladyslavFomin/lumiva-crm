/* Тексты страницы «Решения → Маркетинг» (ru/en/tr). Только реальные возможности:
 * кабинеты Google Ads, Meta Ads (несколько кабинетов), Яндекс Директ, VK Реклама; GA4 и Яндекс Метрика;
 * страница «Трафик» (показы → клики → лиды → деньги по каналам, раскрытие кампаний, карта стран из GA4);
 * пересчёт в одну валюту по дневному курсу; напоминание об истечении токена Meta; UTM-шаблоны и UTM-ссылки
 * (лиды по меткам + переходы из GA4/Метрики); ROI по клиентам (кабинеты ↔ клиенты, выручка из ввода/импорта,
 * ценности конверсий, GA4, продаж CRM); SEO (Search Console + PageSpeed + еженедельный ИИ-отчёт на почту);
 * SMM-статистика Meta/VK; ИИ-менеджер отзывов Google (черновик ответа, публикация вручную);
 * рассылки email/SMS по сегментам (статус, источник, страна, менеджер, дата). */

type Item = { b: string; s: string };
type QA = { q: string; a: string };
type Card = { t: string; d: string; ic: string };

export type MarketingText = {
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
  ads: { k: string; t: string; lede: string; items: Item[]; vis: { h: string; cols: [string, string, string, string]; cur: string; synced: string } };
  sources: { k: string; t: string; d: string; items: Card[] };
  utm: {
    k: string; t: string; lede: string; items: Item[];
    vis: { builder: string; link: string; lead: string; leadName: string; sale: string; saleTxt: string; clicks: string };
  };
  roi: { k: string; t: string; lede: string; items: Item[]; vis: { h: string; spend: string; rev: string; prev: string; clients: string[] } };
  grow: { k: string; t: string; d: string; items: Card[] };
  pair: {
    ch: { title: string; spend: string; leads: string; cpl: string };
    seo: { title: string; clicks: string; impr: string; pages: string[] };
  };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string; aura: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

const ru: MarketingText = {
  crumbs: ['Решения', 'Маркетинг'],
  kicker: 'Решение · Маркетинг и SEO',
  t1: 'Реклама, сайт и продажи —',
  t2: 'в одной маркетинг-аналитике.',
  sub: 'Lumiva подтягивает расходы из Google Ads, Meta, Яндекс Директа и VK Рекламы, трафик из GA4 и Яндекс Метрики, а заявки и продажи — из CRM. Вы видите не клики, а путь от показа рекламы до денег: сколько потратили, сколько пришло лидов и сколько они принесли.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '4', l: 'рекламных кабинета: Google Ads, Meta, Яндекс Директ, VK Реклама' },
    { v: '2', l: 'системы веб-аналитики: Google Analytics 4 и Яндекс Метрика' },
    { v: '5', l: 'UTM-меток сохраняются у каждого лида — от source до term' },
    { v: '7', l: 'дней — раз в неделю ИИ присылает SEO-отчёт с выводами и задачами' },
  ],
  prob: {
    k: '01 · Задача',
    t: 'Расходы в четырёх кабинетах, заявки в CRM, выручка в таблице.',
    d: 'Каждый рекламный кабинет показывает свои клики и свою «конверсию», веб-аналитика — свои сессии, а продажи живут в CRM или в Excel у бухгалтера. Чтобы ответить на простой вопрос «какая реклама окупилась», маркетолог неделю сводит выгрузки, пересчитывает валюты и всё равно спорит с отделом продаж. Lumiva складывает расходы, трафик, заявки и выручку в одну модель, где у каждой цифры есть источник.',
  },
  ads: {
    k: '02 · Кабинеты и трафик',
    t: 'Все рекламные кабинеты на одном экране.',
    lede: 'Подключите кабинеты один раз — дальше расходы, показы и клики подтягиваются сами и стоят рядом с заявками из CRM.',
    items: [
      { b: 'Четыре кабинета', s: ' — Google Ads, Meta Ads, Яндекс Директ и VK Реклама подключаются через официальный вход в аккаунт, без выгрузок.' },
      { b: 'Несколько кабинетов Meta', s: ' — каждый рекламный аккаунт показывается отдельно: удобно, если вы ведёте рекламу нескольких брендов или клиентов.' },
      { b: 'Путь до денег', s: ' — на странице «Трафик» по каждому каналу видно показы, клики, лиды и расход за период, а по клику раскрываются кампании.' },
      { b: 'Одна валюта', s: ' — расходы в евро, лирах и рублях пересчитываются в выбранную валюту по дневному курсу, итоги не смешивают разные валюты.' },
      { b: 'Токены под контролем', s: ' — заранее приходит напоминание, что доступ к кабинету Meta скоро истечёт, чтобы данные не перестали обновляться.' },
    ],
    vis: { h: 'Трафик по каналам · 30 дней', cols: ['Показы', 'Клики', 'Лиды', 'Расход'], cur: 'Валюта', synced: 'обновлено сегодня' },
  },
  sources: {
    k: '03 · Источники данных',
    t: 'Всё, что влияет на заявки, — в одной модели.',
    d: 'Реклама, сайт, поиск и соцсети подключаются как источники. Данные хранятся у вас в CRM и доступны в отчётах, дашбордах Aura и ИИ-ассистенте.',
    items: [
      { t: 'Google Ads', d: 'Расходы, показы, клики и кампании. Ценность конверсий можно использовать как выручку в ROI.', ic: 'target' },
      { t: 'Meta Ads', d: 'Facebook и Instagram: несколько рекламных кабинетов, разбивка по аккаунтам и кампаниям.', ic: 'target' },
      { t: 'Яндекс Директ', d: 'Расходы и статистика кампаний для рекламы в России и СНГ.', ic: 'target' },
      { t: 'VK Реклама', d: 'Расходы и результаты кампаний VK рядом с остальными каналами.', ic: 'target' },
      { t: 'Google Analytics 4', d: 'Сессии и страны посетителей — для карты трафика и выручки по GA4.', ic: 'chart' },
      { t: 'Яндекс Метрика', d: 'Визиты и переходы, в том числе по вашим UTM-ссылкам.', ic: 'chart' },
      { t: 'Search Console и PageSpeed', d: 'Клики и показы из поиска, позиции и скорость страниц сайта.', ic: 'grid' },
      { t: 'Соцсети: Meta и VK', d: 'Профили, подписчики, охват и статистика публикаций.', ic: 'users' },
    ],
  },
  utm: {
    k: '04 · UTM и заявки',
    t: 'От ссылки в рекламе до продажи — без потерь.',
    lede: 'Метки задаются по шаблону, сохраняются у каждого лида и доходят до продажи. Поэтому видно, какая кампания принесла не просто заявки, а деньги.',
    items: [
      { b: 'Шаблоны UTM', s: ' — команда собирает ссылки по общим шаблонам, и одинаковые кампании не называются пятью разными способами.' },
      { b: 'Ссылки со статистикой', s: ' — у каждой UTM-ссылки видно лиды из заявок с такими же метками и переходы из GA4 или Яндекс Метрики.' },
      { b: 'Пять меток у лида', s: ' — utm_source, utm_medium, utm_campaign, utm_content и utm_term сохраняются вместе с сайтом и каналом заявки.' },
      { b: 'До выручки', s: ' — продажа связана с лидом, поэтому выручку можно посчитать по каналу и кампании, а не только количество заявок.' },
      { b: 'Несколько сайтов', s: ' — заявки со всех подключённых сайтов размечаются одинаково и попадают в один отчёт.' },
    ],
    vis: { builder: 'Конструктор UTM', link: 'Ссылка готова', lead: 'Новый лид', leadName: 'Анна Ковалёва', sale: 'Продажа', saleTxt: 'Подтверждена · €1 200', clicks: 'переходов из Метрики' },
  },
  roi: {
    k: '05 · ROI по клиентам',
    t: 'Окупаемость рекламы по каждому клиенту.',
    lede: 'Для агентств и компаний с несколькими направлениями: привяжите рекламные кабинеты к клиентам и сравните расход с выручкой за период.',
    items: [
      { b: 'Кабинеты ↔ клиенты', s: ' — каждый рекламный аккаунт привязывается к своему клиенту или направлению.' },
      { b: 'Выручка из разных источников', s: ' — ввод вручную или импорт, ценность конверсий рекламных площадок, GA4 или продажи CRM.' },
      { b: 'Сравнение периодов', s: ' — расход, выручка и окупаемость против прошлого периода и динамика по месяцам.' },
      { b: 'Помесячный ввод', s: ' — если выручка клиента считается вне CRM, её можно внести по месяцам прямо в строке клиента.' },
    ],
    vis: { h: 'ROI по клиентам · месяц', spend: 'расход', rev: 'выручка', prev: 'к прошлому месяцу', clients: ['Клиника «Дента»', 'Отель Antalya Bay', 'Интернет-магазин', 'Автосервис'] },
  },
  grow: {
    k: '06 · SEO, соцсети и рассылки',
    t: 'Не только платный трафик.',
    d: 'Поиск, соцсети, отзывы и рассылки — в той же CRM, где лиды и продажи.',
    items: [
      { t: 'SEO-метрики', d: 'Клики, показы, CTR и средняя позиция из Search Console, скорость страниц из PageSpeed.', ic: 'grid' },
      { t: 'ИИ-отчёт по SEO', d: 'Раз в неделю ИИ проверяет данные поиска, скорость и страницы сайта и присылает на почту выводы и задачи.', ic: 'spark' },
      { t: 'Соцсети', d: 'Профили Facebook, Instagram и VK: подписчики, охват и статистика публикаций.', ic: 'users' },
      { t: 'Отзывы Google', d: 'ИИ-менеджер отзывов следит за новыми отзывами, пишет черновик ответа на языке отзыва и предупреждает о негативе.', ic: 'chat' },
      { t: 'Сегменты', d: 'Выборки лидов по статусу, источнику, стране, менеджеру и дате создания.', ic: 'filter' },
      { t: 'Рассылки', d: 'Email- и SMS-рассылки по сегментам с вашего подключённого почтового ящика, шаблоны писем.', ic: 'mail' },
    ],
  },
  pair: {
    ch: { title: 'Расход и лиды по каналам · пример', spend: 'расход', leads: 'лидов', cpl: 'за лид' },
    seo: { title: 'Клики из поиска по страницам · пример', clicks: 'клики', impr: 'показы', pages: ['/pricing', '/features', '/blog/crm-guide', '/solutions/sales'] },
  },
  steps: {
    k: '07 · Как это работает',
    t: 'От подключения кабинетов до отчёта по ROI.',
    d: 'Пять шагов, после которых маркетинг считает себя сам.',
    n: 'Шаг',
    items: [
      { t: 'Подключите кабинеты', d: 'Google Ads, Meta, Яндекс Директ, VK Реклама, GA4 и Метрика — входом в аккаунт, без файлов.' },
      { t: 'Задайте шаблоны UTM', d: 'Команда собирает ссылки по шаблонам, метки одинаковые во всех кампаниях.' },
      { t: 'Заявки размечаются сами', d: 'Лиды с сайтов, форм и мессенджеров приходят с источником, кампанией и UTM.' },
      { t: 'Смотрите путь до денег', d: 'Трафик, расход, лиды и выручка по каналам в одной валюте, ROI по клиентам.' },
      { t: 'Получайте отчёты', d: 'Еженедельный SEO-отчёт на почту, дашборд Aura «Пульс лидов» и ИИ-аналитик по запросу.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs разрозненная отчётность',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Расходы', lumiva: 'Четыре кабинета подтягиваются сами, в одной валюте', typical: 'Выгрузки из каждого кабинета и курс вручную' },
      { metric: 'Заявки и кампании', lumiva: 'У каждого лида канал, кампания и пять UTM-меток', typical: 'Источник теряется между формой и CRM' },
      { metric: 'Окупаемость', lumiva: 'Расход против выручки по каналам и клиентам', typical: 'Только клики и «конверсии» кабинета' },
      { metric: 'SEO', lumiva: 'ИИ-отчёт по поиску и скорости сайта раз в неделю', typical: 'Ручная проверка, когда вспомнили' },
      { metric: 'Отзывы', lumiva: 'Новые отзывы Google с черновиком ответа', typical: 'Негатив замечают через месяц' },
    ],
  },
  ai: {
    k: 'ИИ-сотрудник для этого решения',
    name: 'Mira AI',
    job: 'Маркетинг-аналитик',
    text: 'Разбирает каналы, расходы, стоимость лида, окупаемость и тренды и готовит отчёты. Работает только на чтение: ничего не меняет в рекламных кабинетах и не тратит бюджет.',
    list: ['Считает CPL по каналам', 'Сравнивает кампании', 'Готовит отчёт по ROI'],
    hire: 'Об ИИ-сотрудниках',
    aura: 'Дашборд «Пульс лидов»',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Кабинеты и данные',
        items: [
          { q: 'Какие рекламные кабинеты можно подключить?', a: 'Google Ads, Meta Ads (Facebook и Instagram), Яндекс Директ и VK Рекламу. Подключение — через официальный вход в аккаунт рекламной системы, файлы выгружать не нужно. Для веб-аналитики подключаются Google Analytics 4 и Яндекс Метрика, для SEO — Google Search Console и PageSpeed.' },
          { q: 'У нас несколько кабинетов Meta. Их можно разделить?', a: 'Да. Каждый рекламный аккаунт Meta показывается отдельно, с собственной разбивкой по кампаниям. Это удобно, если вы ведёте рекламу нескольких брендов, филиалов или клиентов агентства.' },
          { q: 'Как часто обновляются расходы?', a: 'Данные кабинетов синхронизируются автоматически по расписанию — вручную ничего загружать не нужно. Если доступ к кабинету Meta скоро истечёт, CRM заранее пришлёт напоминание, чтобы обновление не прервалось.' },
          { q: 'Реклама идёт в разных валютах. Как считаются итоги?', a: 'Расходы в евро, лирах, рублях и других валютах пересчитываются в выбранную валюту отображения по дневному курсу. Суммы в разных валютах не складываются «как есть», поэтому итог по каналам корректный.' },
          { q: 'Можно смотреть рекламу по странам или рынкам?', a: 'Страны посетителей берутся из GA4 и видны на карте трафика. У рекламных кабинетов поля страны обычно нет, поэтому рынок определяется по названию кампании — ИИ-ассистент учитывает это, когда вы спрашиваете о конкретной стране.' },
        ],
      },
      {
        g: 'UTM и атрибуция',
        items: [
          { q: 'Какие метки сохраняются у заявки?', a: 'Пять UTM-меток — utm_source, utm_medium, utm_campaign, utm_content и utm_term, — а также сайт, канал и источник заявки. Они видны в карточке лида и доступны в фильтрах и отчётах.' },
          { q: 'Как сделать, чтобы метки у всей команды были одинаковыми?', a: 'Создайте шаблоны UTM: источник, канал и формат названия кампании задаются один раз, а сотрудники собирают ссылки по шаблону. Так одна и та же кампания не превращается в пять разных строк в отчёте.' },
          { q: 'Видно ли, сколько заявок принесла конкретная ссылка?', a: 'Да. У каждой UTM-ссылки показываются лиды из заявок с такими же метками, а переходы — из подключённой Google Analytics 4 или Яндекс Метрики.' },
          { q: 'Можно увидеть выручку по каналу, а не только лиды?', a: 'Да. Продажа связана с лидом, а лид — с каналом и кампанией. Поэтому выручку и окупаемость можно смотреть по каналу; для агентств есть отдельный отчёт ROI по клиентам.' },
          { q: 'Какие модели атрибуции поддерживаются?', a: 'Заявка относится к каналу и кампании, с которых она пришла, — по меткам и источнику, сохранённым в момент обращения. Многоканальных моделей (time-decay, data-driven) в Lumiva нет: мы показываем фактический источник каждой заявки, а не расчётную долю.' },
        ],
      },
      {
        g: 'ROI и отчёты',
        items: [
          { q: 'Как устроен ROI по клиентам?', a: 'Вы привязываете рекламные кабинеты к клиентам или направлениям, а выручку берёте из удобного источника: ввод вручную или импорт, ценность конверсий рекламных площадок, GA4 или продажи из CRM. Отчёт показывает расход, выручку и окупаемость с сравнением к прошлому периоду и помесячной динамикой.' },
          { q: 'Можно собрать свой маркетинговый дашборд?', a: 'Да. В Aura есть шаблон «Пульс лидов»: поток заявок, источники, стоимость лида и расход по каналам. Дашборд можно поправить словами в чате, открыть в CRM или вывести на экран в офисе.' },
          { q: 'Как работает еженедельный SEO-отчёт?', a: 'Раз в неделю ИИ собирает данные Google Search Console и PageSpeed и проверяет страницы сайта, а затем присылает на почту отчёт: что изменилось в поиске, какие страницы медленные и какие задачи стоит сделать.' },
          { q: 'Можно ли спросить ИИ о цифрах маркетинга?', a: 'Да. ИИ-ассистент отвечает по данным CRM: например, «сколько лидов дала Meta за неделю и почём». Итоги считаются кодом по реальным данным, а не придумываются моделью.' },
        ],
      },
      {
        g: 'Соцсети, отзывы и рассылки',
        items: [
          { q: 'Что видно по соцсетям?', a: 'Профили Facebook, Instagram и VK: подписчики, охват и статистика публикаций — рядом с остальными каналами.' },
          { q: 'Как работает менеджер отзывов?', a: 'ИИ-менеджер отзывов следит за новыми отзывами Google о вашей компании, пишет черновик ответа на языке отзыва и предупреждает о негативных. Публикуете ответ вы сами в Google — так ни одно слово не уходит без проверки.' },
          { q: 'Можно ли делать рассылки по базе?', a: 'Да. Соберите сегмент лидов по статусу, источнику, стране, менеджеру или дате создания и отправьте email- или SMS-рассылку. Письма уходят с вашего подключённого почтового ящика, есть шаблоны писем.' },
        ],
      },
    ],
  },
  cta: { k: 'Нужна единая маркетинг-аналитика?', t: 'Подключим ваши кабинеты и покажем путь от рекламы до денег за 30 минут.' },
};

const en: MarketingText = {
  crumbs: ['Solutions', 'Marketing'],
  kicker: 'Solution · Marketing and SEO',
  t1: 'Ads, website and sales —',
  t2: 'in one marketing analytics view.',
  sub: 'Lumiva pulls spend from Google Ads, Meta, Yandex Direct and VK Ads, traffic from GA4 and Yandex Metrica, and leads and sales from the CRM. You see not clicks but the path from an ad impression to money: how much was spent, how many leads came in and what they brought.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '4', l: 'ad platforms: Google Ads, Meta, Yandex Direct, VK Ads' },
    { v: '2', l: 'web analytics systems: Google Analytics 4 and Yandex Metrica' },
    { v: '5', l: 'UTM tags kept on every lead — from source to term' },
    { v: '7', l: 'days — once a week AI sends an SEO report with findings and tasks' },
  ],
  prob: {
    k: '01 · The problem',
    t: 'Spend in four ad accounts, leads in the CRM, revenue in a spreadsheet.',
    d: 'Every ad platform shows its own clicks and its own "conversions", web analytics shows its sessions, and sales live in the CRM or in the accountant\'s Excel. To answer a simple question — which ads paid off — a marketer spends a week merging exports, converting currencies and still arguing with sales. Lumiva puts spend, traffic, leads and revenue into one model where every number has a source.',
  },
  ads: {
    k: '02 · Ad accounts and traffic',
    t: 'All ad platforms on one screen.',
    lede: 'Connect the accounts once — then spend, impressions and clicks sync on their own and sit next to CRM leads.',
    items: [
      { b: 'Four platforms', s: ' — Google Ads, Meta Ads, Yandex Direct and VK Ads connect via official account sign-in, no exports.' },
      { b: 'Several Meta ad accounts', s: ' — each ad account is shown separately: handy if you run ads for several brands or clients.' },
      { b: 'Path to money', s: ' — the Traffic page shows impressions, clicks, leads and spend per channel for the period, and campaigns expand on click.' },
      { b: 'One currency', s: ' — spend in euros, lira and roubles is converted to your chosen currency at the daily rate; totals never mix currencies.' },
      { b: 'Tokens under control', s: ' — you get a reminder in advance that Meta access is about to expire, so data keeps updating.' },
    ],
    vis: { h: 'Traffic by channel · 30 days', cols: ['Impr.', 'Clicks', 'Leads', 'Spend'], cur: 'Currency', synced: 'updated today' },
  },
  sources: {
    k: '03 · Data sources',
    t: 'Everything that drives leads — in one model.',
    d: 'Ads, website, search and social are connected as sources. The data stays in your CRM and is available in reports, Aura dashboards and the AI assistant.',
    items: [
      { t: 'Google Ads', d: 'Spend, impressions, clicks and campaigns. Conversion value can be used as revenue in ROI.', ic: 'target' },
      { t: 'Meta Ads', d: 'Facebook and Instagram: several ad accounts, breakdown by account and campaign.', ic: 'target' },
      { t: 'Yandex Direct', d: 'Spend and campaign stats for ads in Russia and CIS.', ic: 'target' },
      { t: 'VK Ads', d: 'VK campaign spend and results next to the other channels.', ic: 'target' },
      { t: 'Google Analytics 4', d: 'Sessions and visitor countries — for the traffic map and GA4 revenue.', ic: 'chart' },
      { t: 'Yandex Metrica', d: 'Visits and clicks, including those from your UTM links.', ic: 'chart' },
      { t: 'Search Console and PageSpeed', d: 'Search clicks and impressions, positions and page speed.', ic: 'grid' },
      { t: 'Social: Meta and VK', d: 'Profiles, followers, reach and post statistics.', ic: 'users' },
    ],
  },
  utm: {
    k: '04 · UTM and leads',
    t: 'From the ad link to the sale — nothing lost.',
    lede: 'Tags are set by template, kept on every lead and carried through to the sale. So you see which campaign brought not just leads but money.',
    items: [
      { b: 'UTM templates', s: ' — the team builds links from shared templates, so the same campaign is not named five different ways.' },
      { b: 'Links with stats', s: ' — each UTM link shows leads from requests with the same tags and clicks from GA4 or Yandex Metrica.' },
      { b: 'Five tags on every lead', s: ' — utm_source, utm_medium, utm_campaign, utm_content and utm_term are kept along with the site and channel.' },
      { b: 'Down to revenue', s: ' — a sale is linked to its lead, so revenue can be counted per channel and campaign, not just lead counts.' },
      { b: 'Several websites', s: ' — leads from all connected sites are tagged the same way and land in one report.' },
    ],
    vis: { builder: 'UTM builder', link: 'Link ready', lead: 'New lead', leadName: 'Anna Kovaleva', sale: 'Sale', saleTxt: 'Confirmed · €1,200', clicks: 'clicks from Metrica' },
  },
  roi: {
    k: '05 · ROI by client',
    t: 'Ad payback for every client.',
    lede: 'For agencies and companies with several lines of business: link ad accounts to clients and compare spend with revenue for the period.',
    items: [
      { b: 'Accounts ↔ clients', s: ' — each ad account is linked to its client or business line.' },
      { b: 'Revenue from different sources', s: ' — manual entry or import, ad platform conversion value, GA4 or CRM sales.' },
      { b: 'Period comparison', s: ' — spend, revenue and payback versus the previous period, plus monthly dynamics.' },
      { b: 'Monthly entry', s: ' — if a client\'s revenue is tracked outside the CRM, enter it by month right in the client row.' },
    ],
    vis: { h: 'ROI by client · month', spend: 'spend', rev: 'revenue', prev: 'vs last month', clients: ['Denta clinic', 'Antalya Bay hotel', 'Online store', 'Car service'] },
  },
  grow: {
    k: '06 · SEO, social and email',
    t: 'Not just paid traffic.',
    d: 'Search, social, reviews and campaigns — in the same CRM as your leads and sales.',
    items: [
      { t: 'SEO metrics', d: 'Clicks, impressions, CTR and average position from Search Console, page speed from PageSpeed.', ic: 'grid' },
      { t: 'AI SEO report', d: 'Once a week AI checks search data, speed and site pages and emails findings and tasks.', ic: 'spark' },
      { t: 'Social', d: 'Facebook, Instagram and VK profiles: followers, reach and post statistics.', ic: 'users' },
      { t: 'Google reviews', d: 'The AI reviews manager watches new reviews, drafts a reply in the reviewer\'s language and flags negative ones.', ic: 'chat' },
      { t: 'Segments', d: 'Lead selections by status, source, country, manager and creation date.', ic: 'filter' },
      { t: 'Campaigns', d: 'Email and SMS campaigns to segments from your connected mailbox, with email templates.', ic: 'mail' },
    ],
  },
  pair: {
    ch: { title: 'Spend and leads by channel · example', spend: 'spend', leads: 'leads', cpl: 'per lead' },
    seo: { title: 'Search clicks by page · example', clicks: 'clicks', impr: 'impressions', pages: ['/pricing', '/features', '/blog/crm-guide', '/solutions/sales'] },
  },
  steps: {
    k: '07 · How it works',
    t: 'From connecting accounts to an ROI report.',
    d: 'Five steps after which marketing measures itself.',
    n: 'Step',
    items: [
      { t: 'Connect accounts', d: 'Google Ads, Meta, Yandex Direct, VK Ads, GA4 and Metrica — by signing in, no files.' },
      { t: 'Set UTM templates', d: 'The team builds links from templates, tags stay consistent across campaigns.' },
      { t: 'Leads tag themselves', d: 'Leads from sites, forms and messengers arrive with source, campaign and UTM.' },
      { t: 'See the path to money', d: 'Traffic, spend, leads and revenue per channel in one currency, ROI by client.' },
      { t: 'Get reports', d: 'A weekly SEO report by email, the Aura "Lead pulse" dashboard and an AI analyst on request.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs scattered reporting',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'Spend', lumiva: 'Four ad platforms sync on their own, in one currency', typical: 'Exports from every account and manual exchange rates' },
      { metric: 'Leads and campaigns', lumiva: 'Every lead keeps channel, campaign and five UTM tags', typical: 'The source gets lost between the form and the CRM' },
      { metric: 'Payback', lumiva: 'Spend vs revenue by channel and client', typical: 'Only clicks and platform "conversions"' },
      { metric: 'SEO', lumiva: 'A weekly AI report on search and site speed', typical: 'Manual checks when someone remembers' },
      { metric: 'Reviews', lumiva: 'New Google reviews with a draft reply', typical: 'Negative reviews noticed a month later' },
    ],
  },
  ai: {
    k: 'AI employee for this solution',
    name: 'Mira AI',
    job: 'Marketing analyst',
    text: 'Analyses channels, spend, cost per lead, payback and trends and prepares reports. Works read-only: changes nothing in ad accounts and spends no budget.',
    list: ['Calculates CPL by channel', 'Compares campaigns', 'Prepares an ROI report'],
    hire: 'About AI employees',
    aura: '"Lead pulse" dashboard',
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Ad accounts and data',
        items: [
          { q: 'Which ad platforms can we connect?', a: 'Google Ads, Meta Ads (Facebook and Instagram), Yandex Direct and VK Ads. You connect by signing in to the ad platform officially — no file exports. For web analytics connect Google Analytics 4 and Yandex Metrica, for SEO — Google Search Console and PageSpeed.' },
          { q: 'We have several Meta ad accounts. Can they be separated?', a: 'Yes. Each Meta ad account is shown separately with its own campaign breakdown. Handy if you run ads for several brands, branches or agency clients.' },
          { q: 'How often is spend updated?', a: 'Ad account data syncs automatically on a schedule — nothing to upload by hand. If Meta access is about to expire, the CRM sends a reminder in advance so updates do not stop.' },
          { q: 'Our ads run in different currencies. How are totals calculated?', a: 'Spend in euros, lira, roubles and other currencies is converted to your chosen display currency at the daily rate. Amounts in different currencies are never added up as-is, so channel totals are correct.' },
          { q: 'Can we look at ads by country or market?', a: 'Visitor countries come from GA4 and are shown on the traffic map. Ad platforms usually have no country field, so the market is detected from the campaign name — the AI assistant takes this into account when you ask about a specific country.' },
        ],
      },
      {
        g: 'UTM and attribution',
        items: [
          { q: 'Which tags are kept on a lead?', a: 'Five UTM tags — utm_source, utm_medium, utm_campaign, utm_content and utm_term — plus the site, channel and source of the request. They are visible on the lead card and available in filters and reports.' },
          { q: 'How do we keep tags consistent across the team?', a: 'Create UTM templates: source, medium and the campaign name format are set once, and the team builds links from the template. So the same campaign does not turn into five different rows in a report.' },
          { q: 'Can we see how many leads a specific link brought?', a: 'Yes. Each UTM link shows leads from requests with the same tags, and clicks from the connected Google Analytics 4 or Yandex Metrica.' },
          { q: 'Can we see revenue per channel, not just leads?', a: 'Yes. A sale is linked to its lead, and the lead to its channel and campaign. So revenue and payback can be viewed per channel; agencies also get a separate ROI-by-client report.' },
          { q: 'Which attribution models are supported?', a: 'A lead is attributed to the channel and campaign it came from — by the tags and source saved at the moment of contact. Lumiva has no multi-touch models (time-decay, data-driven): we show the actual source of each lead, not a modelled share.' },
        ],
      },
      {
        g: 'ROI and reports',
        items: [
          { q: 'How does ROI by client work?', a: 'You link ad accounts to clients or business lines and take revenue from a convenient source: manual entry or import, ad platform conversion value, GA4 or CRM sales. The report shows spend, revenue and payback compared with the previous period, with monthly dynamics.' },
          { q: 'Can we build our own marketing dashboard?', a: 'Yes. Aura has a "Lead pulse" template: lead flow, sources, cost per lead and spend by channel. Adjust the dashboard by chatting, open it in the CRM or put it on an office screen.' },
          { q: 'How does the weekly SEO report work?', a: 'Once a week AI collects Google Search Console and PageSpeed data and checks your site pages, then emails a report: what changed in search, which pages are slow and which tasks are worth doing.' },
          { q: 'Can we ask the AI about marketing numbers?', a: 'Yes. The AI assistant answers from CRM data — e.g. "how many leads did Meta bring this week and at what cost". Totals are computed by code from real data, not made up by the model.' },
        ],
      },
      {
        g: 'Social, reviews and email',
        items: [
          { q: 'What do we see for social media?', a: 'Facebook, Instagram and VK profiles: followers, reach and post statistics — next to the other channels.' },
          { q: 'How does the reviews manager work?', a: 'The AI reviews manager watches new Google reviews of your business, drafts a reply in the reviewer\'s language and flags negative ones. You publish the reply in Google yourself — so nothing goes out unchecked.' },
          { q: 'Can we send campaigns to our base?', a: 'Yes. Build a lead segment by status, source, country, manager or creation date and send an email or SMS campaign. Emails go out from your connected mailbox, and email templates are available.' },
        ],
      },
    ],
  },
  cta: { k: 'Need unified marketing analytics?', t: 'We\'ll connect your ad accounts and show the path from ads to money in 30 minutes.' },
};

const tr: MarketingText = {
  crumbs: ['Çözümler', 'Pazarlama'],
  kicker: 'Çözüm · Pazarlama ve SEO',
  t1: 'Reklam, site ve satışlar —',
  t2: 'tek pazarlama analitiğinde.',
  sub: 'Lumiva harcamaları Google Ads, Meta, Yandex Direct ve VK Ads\'ten, trafiği GA4 ve Yandex Metrica\'dan, talepleri ve satışları CRM\'den alır. Tıklamaları değil, reklam gösteriminden paraya giden yolu görürsünüz: ne harcandı, kaç talep geldi ve ne getirdi.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '4', l: 'reklam platformu: Google Ads, Meta, Yandex Direct, VK Ads' },
    { v: '2', l: 'web analitiği sistemi: Google Analytics 4 ve Yandex Metrica' },
    { v: '5', l: 'UTM etiketi her talepte saklanır — source\'tan term\'e' },
    { v: '7', l: 'gün — haftada bir yapay zekâ bulgular ve görevlerle SEO raporu gönderir' },
  ],
  prob: {
    k: '01 · Sorun',
    t: 'Harcamalar dört reklam hesabında, talepler CRM\'de, ciro tabloda.',
    d: 'Her reklam platformu kendi tıklamalarını ve kendi "dönüşümlerini", web analitiği kendi oturumlarını gösterir; satışlar ise CRM\'de veya muhasebecinin Excel\'inde durur. "Hangi reklam kendini amorti etti" sorusunu yanıtlamak için pazarlamacı bir hafta dışa aktarımları birleştirir, kurları çevirir ve yine de satış ekibiyle tartışır. Lumiva harcamaları, trafiği, talepleri ve ciroyu her rakamın kaynağı olan tek bir modelde toplar.',
  },
  ads: {
    k: '02 · Reklam hesapları ve trafik',
    t: 'Tüm reklam platformları tek ekranda.',
    lede: 'Hesapları bir kez bağlayın — sonra harcamalar, gösterimler ve tıklamalar kendiliğinden senkronize olur ve CRM talepleriyle yan yana durur.',
    items: [
      { b: 'Dört platform', s: ' — Google Ads, Meta Ads, Yandex Direct ve VK Ads resmi hesap girişiyle bağlanır, dışa aktarma yok.' },
      { b: 'Birden fazla Meta hesabı', s: ' — her reklam hesabı ayrı gösterilir: birkaç marka veya müşteri için reklam yönetiyorsanız kullanışlı.' },
      { b: 'Paraya giden yol', s: ' — "Trafik" sayfasında her kanal için dönem bazında gösterim, tıklama, talep ve harcama görünür, kampanyalar tıklayınca açılır.' },
      { b: 'Tek para birimi', s: ' — euro, lira ve ruble harcamaları günlük kurla seçilen para birimine çevrilir; toplamlar para birimlerini karıştırmaz.' },
      { b: 'Erişim kontrolü', s: ' — Meta erişiminin süresi dolmadan önce hatırlatma gelir, böylece veriler güncellenmeye devam eder.' },
    ],
    vis: { h: 'Kanallara göre trafik · 30 gün', cols: ['Gösterim', 'Tıklama', 'Talep', 'Harcama'], cur: 'Para birimi', synced: 'bugün güncellendi' },
  },
  sources: {
    k: '03 · Veri kaynakları',
    t: 'Talepleri etkileyen her şey — tek modelde.',
    d: 'Reklam, site, arama ve sosyal medya kaynak olarak bağlanır. Veriler CRM\'inizde kalır ve raporlarda, Aura panolarında ve yapay zekâ asistanında kullanılabilir.',
    items: [
      { t: 'Google Ads', d: 'Harcama, gösterim, tıklama ve kampanyalar. Dönüşüm değeri ROI\'de ciro olarak kullanılabilir.', ic: 'target' },
      { t: 'Meta Ads', d: 'Facebook ve Instagram: birden fazla reklam hesabı, hesap ve kampanya kırılımı.', ic: 'target' },
      { t: 'Yandex Direct', d: 'Rusya ve BDT reklamları için harcama ve kampanya istatistikleri.', ic: 'target' },
      { t: 'VK Ads', d: 'VK kampanya harcamaları ve sonuçları diğer kanallarla yan yana.', ic: 'target' },
      { t: 'Google Analytics 4', d: 'Oturumlar ve ziyaretçi ülkeleri — trafik haritası ve GA4 cirosu için.', ic: 'chart' },
      { t: 'Yandex Metrica', d: 'Ziyaretler ve geçişler, UTM bağlantılarınızdan gelenler dahil.', ic: 'chart' },
      { t: 'Search Console ve PageSpeed', d: 'Aramadan tıklama ve gösterimler, sıralamalar ve sayfa hızı.', ic: 'grid' },
      { t: 'Sosyal medya: Meta ve VK', d: 'Profiller, takipçiler, erişim ve gönderi istatistikleri.', ic: 'users' },
    ],
  },
  utm: {
    k: '04 · UTM ve talepler',
    t: 'Reklam bağlantısından satışa — kayıpsız.',
    lede: 'Etiketler şablona göre verilir, her talepte saklanır ve satışa kadar taşınır. Böylece hangi kampanyanın yalnızca talep değil para getirdiği görünür.',
    items: [
      { b: 'UTM şablonları', s: ' — ekip bağlantıları ortak şablonlardan oluşturur, aynı kampanya beş farklı şekilde adlandırılmaz.' },
      { b: 'İstatistikli bağlantılar', s: ' — her UTM bağlantısında aynı etiketli taleplerden gelen talepler ve GA4 veya Yandex Metrica\'dan geçişler görünür.' },
      { b: 'Her talepte beş etiket', s: ' — utm_source, utm_medium, utm_campaign, utm_content ve utm_term site ve kanalla birlikte saklanır.' },
      { b: 'Ciroya kadar', s: ' — satış talebe bağlıdır, bu yüzden ciro yalnızca talep sayısı değil kanal ve kampanya bazında hesaplanabilir.' },
      { b: 'Birden fazla site', s: ' — bağlı tüm sitelerden gelen talepler aynı şekilde etiketlenir ve tek rapora düşer.' },
    ],
    vis: { builder: 'UTM oluşturucu', link: 'Bağlantı hazır', lead: 'Yeni talep', leadName: 'Anna Kovaleva', sale: 'Satış', saleTxt: 'Onaylandı · €1.200', clicks: 'Metrica\'dan geçiş' },
  },
  roi: {
    k: '05 · Müşteri bazında ROI',
    t: 'Her müşteri için reklam geri dönüşü.',
    lede: 'Ajanslar ve birden fazla iş kolu olan şirketler için: reklam hesaplarını müşterilere bağlayın ve dönem için harcamayı ciroyla karşılaştırın.',
    items: [
      { b: 'Hesaplar ↔ müşteriler', s: ' — her reklam hesabı kendi müşterisine veya iş koluna bağlanır.' },
      { b: 'Farklı kaynaklardan ciro', s: ' — elle giriş veya içe aktarma, reklam platformu dönüşüm değeri, GA4 veya CRM satışları.' },
      { b: 'Dönem karşılaştırması', s: ' — harcama, ciro ve geri dönüş önceki döneme göre, aylık dinamikle.' },
      { b: 'Aylık giriş', s: ' — müşterinin cirosu CRM dışında takip ediliyorsa doğrudan müşteri satırına ay ay girilebilir.' },
    ],
    vis: { h: 'Müşteri bazında ROI · ay', spend: 'harcama', rev: 'ciro', prev: 'geçen aya göre', clients: ['Denta kliniği', 'Antalya Bay oteli', 'Online mağaza', 'Oto servis'] },
  },
  grow: {
    k: '06 · SEO, sosyal medya ve e-posta',
    t: 'Yalnızca ücretli trafik değil.',
    d: 'Arama, sosyal medya, yorumlar ve kampanyalar — talepler ve satışlarla aynı CRM\'de.',
    items: [
      { t: 'SEO metrikleri', d: 'Search Console\'dan tıklama, gösterim, TO ve ortalama sıralama, PageSpeed\'den sayfa hızı.', ic: 'grid' },
      { t: 'Yapay zekâ SEO raporu', d: 'Haftada bir yapay zekâ arama verilerini, hızı ve site sayfalarını kontrol eder, bulguları ve görevleri e-postayla gönderir.', ic: 'spark' },
      { t: 'Sosyal medya', d: 'Facebook, Instagram ve VK profilleri: takipçiler, erişim ve gönderi istatistikleri.', ic: 'users' },
      { t: 'Google yorumları', d: 'Yapay zekâ yorum yöneticisi yeni yorumları izler, yorumun dilinde yanıt taslağı yazar ve olumsuzları bildirir.', ic: 'chat' },
      { t: 'Segmentler', d: 'Durum, kaynak, ülke, yönetici ve oluşturma tarihine göre talep seçimleri.', ic: 'filter' },
      { t: 'Kampanyalar', d: 'Bağlı e-posta kutunuzdan segmentlere e-posta ve SMS kampanyaları, e-posta şablonları.', ic: 'mail' },
    ],
  },
  pair: {
    ch: { title: 'Kanallara göre harcama ve talepler · örnek', spend: 'harcama', leads: 'talep', cpl: 'talep başına' },
    seo: { title: 'Sayfalara göre arama tıklamaları · örnek', clicks: 'tıklama', impr: 'gösterim', pages: ['/pricing', '/features', '/blog/crm-guide', '/solutions/sales'] },
  },
  steps: {
    k: '07 · Nasıl çalışır',
    t: 'Hesapları bağlamaktan ROI raporuna.',
    d: 'Pazarlamanın kendini ölçmesi için beş adım.',
    n: 'Adım',
    items: [
      { t: 'Hesapları bağlayın', d: 'Google Ads, Meta, Yandex Direct, VK Ads, GA4 ve Metrica — girişle, dosya olmadan.' },
      { t: 'UTM şablonlarını ayarlayın', d: 'Ekip bağlantıları şablondan oluşturur, etiketler tüm kampanyalarda aynı kalır.' },
      { t: 'Talepler kendiliğinden etiketlenir', d: 'Sitelerden, formlardan ve mesajlaşmadan gelen talepler kaynak, kampanya ve UTM ile gelir.' },
      { t: 'Paraya giden yolu görün', d: 'Kanal bazında trafik, harcama, talep ve ciro tek para biriminde, müşteri bazında ROI.' },
      { t: 'Rapor alın', d: 'Haftalık SEO raporu e-postayla, Aura "Talep nabzı" panosu ve istek üzerine yapay zekâ analisti.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs dağınık raporlama',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Harcamalar', lumiva: 'Dört platform kendiliğinden, tek para biriminde senkronize olur', typical: 'Her hesaptan dışa aktarma ve elle kur' },
      { metric: 'Talepler ve kampanyalar', lumiva: 'Her talepte kanal, kampanya ve beş UTM etiketi', typical: 'Kaynak form ile CRM arasında kaybolur' },
      { metric: 'Geri dönüş', lumiva: 'Kanal ve müşteri bazında harcama ve ciro', typical: 'Yalnızca tıklamalar ve platform "dönüşümleri"' },
      { metric: 'SEO', lumiva: 'Arama ve site hızı için haftalık yapay zekâ raporu', typical: 'Biri hatırlayınca elle kontrol' },
      { metric: 'Yorumlar', lumiva: 'Yeni Google yorumları yanıt taslağıyla', typical: 'Olumsuz yorum bir ay sonra fark edilir' },
    ],
  },
  ai: {
    k: 'Bu çözüm için yapay zekâ çalışanı',
    name: 'Mira AI',
    job: 'Pazarlama analisti',
    text: 'Kanalları, harcamaları, talep maliyetini, geri dönüşü ve trendleri analiz eder ve raporlar hazırlar. Yalnızca okuma yetkisiyle çalışır: reklam hesaplarında hiçbir şeyi değiştirmez ve bütçe harcamaz.',
    list: ['Kanallara göre CPL hesaplar', 'Kampanyaları karşılaştırır', 'ROI raporu hazırlar'],
    hire: 'Yapay zekâ çalışanları hakkında',
    aura: '"Talep nabzı" panosu',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Reklam hesapları ve veriler',
        items: [
          { q: 'Hangi reklam platformlarını bağlayabiliriz?', a: 'Google Ads, Meta Ads (Facebook ve Instagram), Yandex Direct ve VK Ads. Bağlantı reklam platformuna resmi girişle yapılır, dosya dışa aktarmaya gerek yoktur. Web analitiği için Google Analytics 4 ve Yandex Metrica, SEO için Google Search Console ve PageSpeed bağlanır.' },
          { q: 'Birden fazla Meta hesabımız var. Ayrılabilir mi?', a: 'Evet. Her Meta reklam hesabı kendi kampanya kırılımıyla ayrı gösterilir. Birkaç marka, şube veya ajans müşterisi için reklam yönetiyorsanız kullanışlıdır.' },
          { q: 'Harcamalar ne sıklıkla güncellenir?', a: 'Reklam hesabı verileri programa göre otomatik senkronize olur — elle yükleme gerekmez. Meta erişiminin süresi dolmak üzereyse CRM önceden hatırlatma gönderir, böylece güncelleme durmaz.' },
          { q: 'Reklamlar farklı para birimlerinde. Toplamlar nasıl hesaplanır?', a: 'Euro, lira, ruble ve diğer para birimlerindeki harcamalar günlük kurla seçilen görüntüleme para birimine çevrilir. Farklı para birimlerindeki tutarlar olduğu gibi toplanmaz, bu yüzden kanal toplamları doğrudur.' },
          { q: 'Reklamlara ülke veya pazar bazında bakabilir miyiz?', a: 'Ziyaretçi ülkeleri GA4\'ten gelir ve trafik haritasında görünür. Reklam platformlarında genellikle ülke alanı yoktur, bu yüzden pazar kampanya adından belirlenir — belirli bir ülkeyi sorduğunuzda yapay zekâ asistanı bunu dikkate alır.' },
        ],
      },
      {
        g: 'UTM ve atıf',
        items: [
          { q: 'Talepte hangi etiketler saklanır?', a: 'Beş UTM etiketi — utm_source, utm_medium, utm_campaign, utm_content ve utm_term — ile talebin sitesi, kanalı ve kaynağı. Talep kartında görünür, filtrelerde ve raporlarda kullanılabilir.' },
          { q: 'Ekipte etiketlerin aynı kalmasını nasıl sağlarız?', a: 'UTM şablonları oluşturun: kaynak, kanal ve kampanya adı biçimi bir kez belirlenir, ekip bağlantıları şablondan oluşturur. Böylece aynı kampanya raporda beş farklı satıra dönüşmez.' },
          { q: 'Belirli bir bağlantının kaç talep getirdiğini görebilir miyiz?', a: 'Evet. Her UTM bağlantısında aynı etiketli taleplerden gelen talepler, bağlı Google Analytics 4 veya Yandex Metrica\'dan da geçişler gösterilir.' },
          { q: 'Yalnızca talepleri değil, kanal bazında ciroyu görebilir miyiz?', a: 'Evet. Satış talebe, talep de kanala ve kampanyaya bağlıdır. Bu yüzden ciro ve geri dönüş kanal bazında görülebilir; ajanslar için ayrıca müşteri bazında ROI raporu var.' },
          { q: 'Hangi atıf modelleri destekleniyor?', a: 'Talep, geldiği kanal ve kampanyaya atanır — başvuru anında kaydedilen etiketlere ve kaynağa göre. Lumiva\'da çok kanallı modeller (time-decay, data-driven) yoktur: hesaplanmış bir pay değil, her talebin gerçek kaynağını gösteririz.' },
        ],
      },
      {
        g: 'ROI ve raporlar',
        items: [
          { q: 'Müşteri bazında ROI nasıl çalışır?', a: 'Reklam hesaplarını müşterilere veya iş kollarına bağlar, ciroyu uygun kaynaktan alırsınız: elle giriş veya içe aktarma, reklam platformu dönüşüm değeri, GA4 veya CRM satışları. Rapor; harcama, ciro ve geri dönüşü önceki dönemle karşılaştırmalı ve aylık dinamikle gösterir.' },
          { q: 'Kendi pazarlama panomuzu kurabilir miyiz?', a: 'Evet. Aura\'da "Talep nabzı" şablonu var: talep akışı, kaynaklar, talep maliyeti ve kanallara göre harcama. Panoyu sohbetle düzenleyin, CRM\'de açın veya ofis ekranına yansıtın.' },
          { q: 'Haftalık SEO raporu nasıl çalışır?', a: 'Haftada bir yapay zekâ Google Search Console ve PageSpeed verilerini toplar ve site sayfalarını kontrol eder, ardından e-postayla rapor gönderir: aramada ne değişti, hangi sayfalar yavaş ve hangi görevler yapılmalı.' },
          { q: 'Pazarlama rakamlarını yapay zekâya sorabilir miyiz?', a: 'Evet. Yapay zekâ asistanı CRM verilerine göre yanıt verir — örneğin "Meta bu hafta kaç talep getirdi, maliyeti ne". Toplamlar model tarafından uydurulmaz, gerçek verilerden kodla hesaplanır.' },
        ],
      },
      {
        g: 'Sosyal medya, yorumlar ve e-posta',
        items: [
          { q: 'Sosyal medyada ne görünür?', a: 'Facebook, Instagram ve VK profilleri: takipçiler, erişim ve gönderi istatistikleri — diğer kanallarla yan yana.' },
          { q: 'Yorum yöneticisi nasıl çalışır?', a: 'Yapay zekâ yorum yöneticisi işletmeniz hakkındaki yeni Google yorumlarını izler, yorumun dilinde yanıt taslağı yazar ve olumsuzları bildirir. Yanıtı Google\'da siz yayınlarsınız — böylece hiçbir kelime kontrolsüz gitmez.' },
          { q: 'Tabanımıza kampanya gönderebilir miyiz?', a: 'Evet. Durum, kaynak, ülke, yönetici veya oluşturma tarihine göre bir talep segmenti oluşturun ve e-posta veya SMS kampanyası gönderin. E-postalar bağlı posta kutunuzdan gider, e-posta şablonları mevcuttur.' },
        ],
      },
    ],
  },
  cta: { k: 'Birleşik pazarlama analitiğine mi ihtiyacınız var?', t: 'Reklam hesaplarınızı bağlayalım ve reklamdan paraya giden yolu 30 dakikada gösterelim.' },
};

export const MARKETING_T: Record<'ru' | 'en' | 'tr', MarketingText> = { ru, en, tr };
