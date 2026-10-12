/* Тексты страницы «Решения → Продажи» (ru/en/tr). Только то, что есть в продукте:
 * сайты (sites: домен + токен, проверка origin, отключение, модули по сайту), источники лидов и UTM,
 * статусы продаж new/pending/confirmed/cancelled/refunded, журнал смены статусов (audit-log),
 * автоматизации sale.status_changed и «зависшие продажи» (SALE_STALE, порог по умолчанию 14 дней),
 * синхронизация статуса с WooCommerce, ссылка на оплату iyzico/PayTR/ЮKassa, отчёт по менеджерам. */

type Item = { b: string; s: string };
type QA = { q: string; a: string };

export type SalesText = {
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
  sites: {
    k: string; t: string; lede: string; items: Item[];
    vis: { h: string; inbox: string; now: string; min: string; off: string; leads: Array<{ n: string; site: number; src: string; utm: string }> };
  };
  channels: { k: string; t: string; d: string; items: Array<{ t: string; d: string; ic: string }> };
  appr: {
    k: string; t: string; lede: string; items: Item[];
    vis: { deal: string; amount: string; meta: string[]; st: Record<'new' | 'pending' | 'confirmed' | 'cancelled' | 'refunded', string>; log: Record<string, string>; by: string; auto: string; woo: string; mail: string };
  };
  track: { k: string; t: string; d: string; items: Array<{ t: string; d: string; ic: string }> };
  pair: { mgr: { title: string; won: string; lost: string; rep: string; rows: Array<[string, number, number, number]> }; ch: { title: string; ok: string; cancel: string; refund: string; rows: Array<[string, number, number, number]> } };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string; aura: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

export const SITES = ['shop.example.com', 'hotel.example.com', 'promo.example.com'];

const ru: SalesText = {
  crumbs: ['Решения', 'Продажи'],
  kicker: 'Решение · Продажи',
  t1: 'Заявки со всех сайтов и каналов —',
  t2: 'в одной воронке продаж.',
  sub: 'Lumiva собирает лиды с нескольких сайтов, мессенджеров и магазинов, сохраняет источник и UTM каждой заявки, а продажи ведёт по понятным статусам: ожидает подтверждения, подтверждена, отменена, возврат. Каждое решение попадает в журнал — видно, кто, когда и что изменил.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '5', l: 'статусов продажи: новая, ожидает, подтверждена, отменена, возврат' },
    { v: '14', l: 'дней без решения — и продажа попадает в сводку зависших (порог настраивается)' },
    { v: '3', l: 'исхода по каждому менеджеру: выигрыш, проигрыш, повторная продажа' },
    { v: '30', l: 'дней на восстановление удалённых лидов из корзины' },
  ],
  prob: {
    k: '01 · Задача',
    t: 'Заявки приходят с пяти сайтов и трёх мессенджеров. Отчёт собирают вручную.',
    d: 'Один сайт на WordPress, магазин на WooCommerce, клиенты пишут в WhatsApp и Telegram. Заявки теряются между почтой и чатами, никто не знает, с какой рекламы пришёл клиент, а решение по заказу — подтвердили его или отклонили — живёт в голове менеджера. К концу месяца цифры собирают из пяти мест и спорят, чьи правильные. Lumiva сводит всё это в одну воронку с одной историей.',
  },
  sites: {
    k: '02 · Мультисайтовость',
    t: 'Сколько угодно сайтов — одна база лидов.',
    lede: 'Подключите все свои сайты, лендинги и магазины. Заявки попадают в общий список, но у каждой видно, откуда она пришла.',
    items: [
      { b: 'Свой токен у каждого сайта', s: ' — сайт добавляется с доменом и получает отдельный ключ для форм и API. Ограничения по количеству сайтов нет.' },
      { b: 'Защита от поддельных заявок', s: ' — заявка принимается, только если пришла с домена, зарегистрированного для этого токена. Чужой сайт не сможет слать лиды от вашего имени.' },
      { b: 'Сайт помнится в карточке', s: ' — у лида сохраняются сайт, канал, источник и UTM-метки, поэтому отчёт по сайтам не нужно собирать вручную.' },
      { b: 'Включение и отключение', s: ' — сайт можно временно отключить, не удаляя историю, а модули WordPress-плагина (формы, коннектор) включать для каждого сайта отдельно.' },
      { b: 'Магазины как каналы продаж', s: ' — каждый подключённый магазин WooCommerce становится отдельным каналом со своими суммами и количеством заказов.' },
    ],
    vis: {
      h: 'Подключённые сайты',
      inbox: 'Входящие лиды',
      now: 'только что', min: 'мин',
      off: 'отключён',
      leads: [
        { n: 'Анна Ковалёва', site: 0, src: 'Google Ads', utm: 'utm_campaign=autumn' },
        { n: 'Мерт Йылмаз', site: 1, src: 'WhatsApp', utm: 'utm_source=wa' },
        { n: 'Илья Петров', site: 2, src: 'Meta Ads', utm: 'utm_campaign=promo' },
        { n: 'Элиф Демир', site: 0, src: 'Instagram', utm: 'utm_medium=social' },
        { n: 'Олег Смирнов', site: 1, src: 'Telegram', utm: 'utm_source=tg' },
      ],
    },
  },
  channels: {
    k: '03 · Каналы',
    t: 'Лиды из всех каналов — с источником.',
    d: 'Не важно, где клиент оставил заявку: на сайте, в мессенджере или в магазине. В CRM она появляется сразу, с каналом и источником.',
    items: [
      { t: 'Сайты и формы', d: 'Встраиваемые формы, WordPress и Contact Form 7, POST-запрос с любого лендинга.', ic: 'grid' },
      { t: 'WhatsApp Business', d: 'Сообщения превращаются в лиды, отвечать можно прямо из карточки клиента.', ic: 'chat' },
      { t: 'Telegram', d: 'Бот и переписка в CRM, новые обращения сразу попадают в воронку.', ic: 'chat' },
      { t: 'Instagram и Facebook', d: 'Лиды из рекламы и сообщений с сохранённой кампанией и источником.', ic: 'target' },
      { t: 'Онлайн-чат на сайте', d: 'Виджет с ИИ-консультантом: посетитель оставляет контакты — появляется лид.', ic: 'mail' },
      { t: 'Магазины', d: 'Заказы WooCommerce и Shopify, витрина Lumiva — как продажи с суммой и статусом.', ic: 'box' },
      { t: 'Бронирования', d: 'Онлайн-запись и бронирование номеров автоматически привязываются к лиду и контакту клиента.', ic: 'cal' },
      { t: 'Импорт и API', d: 'Загрузка CSV/Excel и приём лидов по API из ботов, сервисов и n8n/Make/Zapier.', ic: 'bolt' },
    ],
  },
  appr: {
    k: '04 · Одобрение и отклонение',
    t: 'У каждой продажи — понятный статус и решение.',
    lede: 'Новый заказ ждёт подтверждения. Менеджер подтверждает или отменяет его в один клик, а CRM записывает решение и запускает следующие шаги.',
    items: [
      { b: 'Пять статусов', s: ' — новая, ожидает подтверждения, подтверждена, отменена и возврат. Статус меняется в карточке или прямо в списке.' },
      { b: 'Решение в журнале', s: ' — фиксируется, кто сменил статус, с какого на какой и когда. Спорить о том, кто отменил заказ, не придётся.' },
      { b: 'Автоматизации на смену статуса', s: ' — письмо клиенту, задача, сообщение в Telegram или webhook при подтверждении или отмене.' },
      { b: 'Обратно в магазин', s: ' — для заказов WooCommerce новый статус отправляется обратно в магазин.' },
      { b: 'Оплата по ссылке', s: ' — из карточки продажи формируется ссылка на оплату через iyzico, PayTR или ЮKassa.' },
    ],
    vis: {
      deal: 'Заказ #4821 · Двухместный номер',
      amount: '€640',
      meta: ['hotel.example.com', 'Booking · direct', 'utm_campaign=autumn'],
      st: { new: 'Новая', pending: 'Ожидает', confirmed: 'Подтверждена', cancelled: 'Отменена', refunded: 'Возврат' },
      log: { created: 'Заказ создан с сайта', pending: 'Ожидает → проверка оплаты', confirmed: 'Ожидает → Подтверждена', cancelled: 'Ожидает → Отменена' },
      by: 'Анна К.',
      auto: 'Автоматизация: письмо клиенту отправлено',
      woo: 'Статус отправлен в магазин',
      mail: 'Задача «Позвонить клиенту» создана',
    },
  },
  track: {
    k: '05 · Отслеживание',
    t: 'Ни одна заявка не теряется без следа.',
    d: 'От первого клика по рекламе до оплаты — у каждой заявки и продажи есть история, а зависшие вы увидите раньше клиента.',
    items: [
      { t: 'Источник и UTM', d: 'utm_source, utm_medium, utm_campaign, utm_content и utm_term сохраняются у каждого лида.', ic: 'target' },
      { t: 'История лида', d: 'Смена статуса, ответственного и полей — в ленте карточки с датой и автором.', ic: 'clock' },
      { t: 'Переписка в карточке', d: 'WhatsApp, Telegram и email по клиенту — в одной ленте, независимо от канала.', ic: 'chat' },
      { t: 'Журнал действий', d: 'Кто и что изменил в продажах и лидах — с датой, временем и старым значением.', ic: 'log' },
      { t: 'Зависшие продажи', d: 'Раз в день — сводка продаж без решения дольше N дней: письмом, в Telegram или задачей.', ic: 'bell' },
      { t: 'Зависшие лиды', d: 'Такая же сводка по лидам, которые давно не двигались по воронке.', ic: 'bell' },
    ],
  },
  pair: {
    mgr: { title: 'Результат по менеджерам · пример', won: 'выиграно', lost: 'проиграно', rep: 'повторные', rows: [['Анна Ковалёва', 24, 6, 5], ['Мерт Йылмаз', 19, 9, 3], ['Илья Петров', 15, 7, 2], ['Элиф Демир', 12, 4, 4]] },
    ch: { title: 'Продажи по каналам · пример', ok: 'подтверждено', cancel: 'отменено', refund: 'возвраты', rows: [['Сайт', 82, 14, 4], ['WooCommerce', 74, 20, 6], ['Партнёры B2B', 88, 10, 2], ['OTA', 69, 25, 6]] },
  },
  steps: {
    k: '06 · Как это работает',
    t: 'От заявки до подтверждённой продажи.',
    d: 'Пять шагов, которые проходит каждая заявка. Ничего не нужно переносить вручную.',
    n: 'Шаг',
    items: [
      { t: 'Заявка пришла', d: 'С любого сайта или канала. CRM сохраняет сайт, источник и UTM, проверяет дубли по email и телефону.' },
      { t: 'Квалификация', d: 'Лид получает ответственного и статус «В работе». ИИ-сотрудник может разобрать заявку и назначить менеджера.' },
      { t: 'Продажа', d: 'По заявке создаётся продажа с суммой и каналом — она ждёт подтверждения.' },
      { t: 'Решение', d: 'Подтвердить или отменить. Решение записывается в журнал и запускает автоматизации.' },
      { t: 'Контроль', d: 'Аналитика по менеджерам и каналам, сводка зависших продаж и экспорт в CSV/Excel.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs заявки в почте и таблицах',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Несколько сайтов', lumiva: 'Все сайты в одной базе, у каждого лида виден сайт', typical: 'Отдельная почта или таблица на каждый сайт' },
      { metric: 'Источник заявки', lumiva: 'Канал, кампания и UTM сохранены у каждого лида', typical: 'Источник теряется между системами' },
      { metric: 'Решение по заказу', lumiva: 'Статус и журнал: кто подтвердил или отменил и когда', typical: 'Договорённость в чате менеджера' },
      { metric: 'Зависшие продажи', lumiva: 'Ежедневная сводка заказов без решения', typical: 'Узнаёте, когда клиент уже ушёл' },
      { metric: 'Результат менеджеров', lumiva: 'Выигранные, проигранные и повторные продажи по каждому', typical: 'Сводные таблицы вручную раз в месяц' },
    ],
  },
  ai: {
    k: 'ИИ-сотрудник для этого решения',
    name: 'Sofia AI',
    job: 'Менеджер продаж',
    text: 'Следит за воронкой между планёрками: находит сделки без движения, готовит follow-up и ставит менеджеру задачу на следующий шаг. Письма клиенту уходят только после вашего согласования.',
    list: ['Ищет зависшие сделки', 'Готовит follow-up письмо', 'Ставит задачу менеджеру'],
    hire: 'Об ИИ-сотрудниках',
    aura: 'Дашборд «Отдел продаж»',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Сайты и каналы',
        items: [
          { q: 'Сколько сайтов можно подключить?', a: 'Ограничения по количеству сайтов нет. Каждый сайт добавляется со своим доменом и получает отдельный токен. Заявки со всех сайтов попадают в общий список лидов, но у каждого лида сохраняется, с какого сайта он пришёл, — это видно в карточке.' },
          { q: 'Как подключить сайт на WordPress или любой другой платформе?', a: 'Для WordPress есть плагин Lumiva: он передаёт заявки из Contact Form 7 и других форм, а для WooCommerce — ещё и заказы. Для любого другого сайта подойдёт встраиваемая форма Lumiva или обычный POST-запрос к API с токеном сайта — его можно отправить из лендинга, бота или n8n/Make/Zapier.' },
          { q: 'Может ли кто-то отправлять поддельные заявки от имени нашего сайта?', a: 'Публичный приём заявок проверяет, что запрос пришёл именно с того домена, который вы указали для этого токена. Запросы с чужих доменов отклоняются. Если токен где-то засветился, сайт можно отключить или перевыпустить ключ.' },
          { q: 'Из каких ещё каналов приходят лиды?', a: 'WhatsApp Business, Telegram, Instagram и Facebook, онлайн-чат на сайте, онлайн-запись и бронирования, витрина Lumiva, магазины WooCommerce и Shopify, импорт из CSV/Excel и API. У каждого лида сохраняются канал и источник.' },
          { q: 'Клиент написал и с сайта, и в WhatsApp. Будет два лида?', a: 'Lumiva ищет дубли по email, телефону и названию и показывает их группами с причиной совпадения. Объединить можно в один клик, а при ошибке — отменить слияние. Можно включить и ночное автослияние.' },
        ],
      },
      {
        g: 'Отслеживание',
        items: [
          { q: 'Какие данные об источнике сохраняются у заявки?', a: 'Сайт, канал (форма, мессенджер, магазин, API) и источник, а также пять UTM-меток: utm_source, utm_medium, utm_campaign, utm_content и utm_term. Поэтому в отчётах видно не только сколько пришло заявок, но и с какой кампании.' },
          { q: 'Где посмотреть историю по конкретной заявке?', a: 'В карточке лида — лента истории: смена статуса, ответственного и полей с датой и автором, а также переписка по клиенту из WhatsApp, Telegram и почты. По продажам изменения статуса пишутся в журнал действий: кто, когда и с какого статуса на какой.' },
          { q: 'Как узнать о продажах, по которым никто не принял решение?', a: 'Включите автоматизацию «Зависшие продажи». Раз в день она собирает продажи в статусах «Новая» и «Ожидает», которые не менялись дольше заданного срока (по умолчанию 14 дней), и присылает сводку — письмом, в Telegram или задачей ответственному. Такая же есть для лидов.' },
          { q: 'Можно выгрузить данные для своего отчёта?', a: 'Да. Аналитику продаж можно выгрузить в CSV или Excel, а новые лиды можно передавать в CRM через API.' },
        ],
      },
      {
        g: 'Одобрение и отклонение',
        items: [
          { q: 'Как устроено подтверждение продажи?', a: 'У продажи пять статусов: новая, ожидает подтверждения, подтверждена, отменена и возврат. Новый заказ с сайта или из магазина ждёт решения; менеджер подтверждает или отменяет его в карточке или прямо в списке.' },
          { q: 'Что происходит, когда продажу подтверждают или отменяют?', a: 'Смена статуса записывается в журнал действий и запускает автоматизации на событие «статус продажи изменён»: письмо клиенту, задачу, сообщение в Telegram, тег или webhook во внешнюю систему. Для заказов WooCommerce новый статус отправляется обратно в магазин.' },
          { q: 'Можно ли принять оплату по подтверждённой продаже?', a: 'Да. Из карточки продажи формируется ссылка на оплату через подключённого провайдера — iyzico, PayTR или ЮKassa. Платежи видны в отдельном журнале оплат.' },
          { q: 'Видно ли, сколько продаж отменили или вернули?', a: 'Да. В аналитике продаж подтверждённые, отменённые и возвраты считаются отдельно, с разбивкой по каналам, рынкам и периодам.' },
          { q: 'Можно ли ограничить, кто подтверждает и отменяет продажи?', a: 'Да. Права доступа задаются по ролям: кто может редактировать продажи, видит ли сотрудник только свои записи или все, скрыты ли от него суммы и контакты.' },
        ],
      },
      {
        g: 'Команда и аналитика',
        items: [
          { q: 'Можно смотреть результаты по менеджерам?', a: 'Да. Отчёт по менеджерам показывает выигранные и проигранные лиды и повторные продажи по каждому сотруднику за выбранный период. Проигранные лиды собраны отдельно: количество, упущенная сумма и динамика.' },
          { q: 'Подходит для еженедельных планёрок?', a: 'Да. Для планёрок удобно собрать дашборд Aura по шаблону «Отдел продаж»: выручка, воронка, цель отдела и рейтинг менеджеров на одном экране, его можно вывести и на ТВ в офисе.' },
          { q: 'Можно попробовать на своих данных?', a: 'Да. Регистрация даёт 14 дней тарифа Enterprise бесплатно и без карты. Клиентов и лиды можно загрузить из Excel или CSV, а сайты подключить за несколько минут.' },
        ],
      },
    ],
  },
  cta: { k: 'Готовы посмотреть?', t: 'Подключим ваши сайты и покажем воронку на ваших данных за 30 минут.' },
};

const en: SalesText = {
  crumbs: ['Solutions', 'Sales'],
  kicker: 'Solution · Sales',
  t1: 'Requests from every site and channel —',
  t2: 'in one sales pipeline.',
  sub: 'Lumiva collects leads from several websites, messengers and stores, keeps the source and UTM of every request, and runs sales through clear statuses: awaiting confirmation, confirmed, cancelled, refunded. Every decision goes into the log — you can see who changed what and when.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '5', l: 'sale statuses: new, pending, confirmed, cancelled, refunded' },
    { v: '14', l: 'days without a decision and a sale lands in the stalled digest (configurable)' },
    { v: '3', l: 'outcomes per manager: won, lost, repeat sale' },
    { v: '30', l: 'days to restore deleted leads from the trash' },
  ],
  prob: {
    k: '01 · The problem',
    t: 'Requests come from five websites and three messengers. Reports are built by hand.',
    d: 'One site runs on WordPress, the store on WooCommerce, clients write in WhatsApp and Telegram. Requests get lost between email and chats, nobody knows which ad brought the client, and the decision on an order — confirmed or declined — lives in a manager\'s head. At month end the numbers are pulled from five places and argued over. Lumiva brings it all into one pipeline with one history.',
  },
  sites: {
    k: '02 · Multi-site',
    t: 'As many websites as you need — one lead base.',
    lede: 'Connect all your websites, landing pages and stores. Requests land in one shared list, yet each one shows where it came from.',
    items: [
      { b: 'Each site has its own token', s: ' — a site is added with its domain and gets a separate key for forms and the API. There is no limit on the number of sites.' },
      { b: 'Protection from fake requests', s: ' — a request is accepted only if it comes from the domain registered for that token. Another site cannot send leads on your behalf.' },
      { b: 'The site stays on the card', s: ' — each lead keeps its site, channel, source and UTM tags, so per-site reports need no manual work.' },
      { b: 'Enable and disable', s: ' — a site can be paused without deleting its history, and WordPress plugin modules (forms, connector) can be switched on per site.' },
      { b: 'Stores as sales channels', s: ' — every connected WooCommerce store becomes its own sales channel with its own totals and order counts.' },
    ],
    vis: {
      h: 'Connected sites',
      inbox: 'Incoming leads',
      now: 'just now', min: 'min',
      off: 'paused',
      leads: [
        { n: 'Anna Kovaleva', site: 0, src: 'Google Ads', utm: 'utm_campaign=autumn' },
        { n: 'Mert Yilmaz', site: 1, src: 'WhatsApp', utm: 'utm_source=wa' },
        { n: 'Ilya Petrov', site: 2, src: 'Meta Ads', utm: 'utm_campaign=promo' },
        { n: 'Elif Demir', site: 0, src: 'Instagram', utm: 'utm_medium=social' },
        { n: 'Oleg Smirnov', site: 1, src: 'Telegram', utm: 'utm_source=tg' },
      ],
    },
  },
  channels: {
    k: '03 · Channels',
    t: 'Leads from every channel — with their source.',
    d: 'Wherever a client leaves a request — on a site, in a messenger or in a store — it appears in the CRM right away, with channel and source.',
    items: [
      { t: 'Websites and forms', d: 'Embeddable forms, WordPress and Contact Form 7, a POST request from any landing page.', ic: 'grid' },
      { t: 'WhatsApp Business', d: 'Messages become leads, and you can reply right from the client card.', ic: 'chat' },
      { t: 'Telegram', d: 'Bot and chats inside the CRM, new conversations go straight into the pipeline.', ic: 'chat' },
      { t: 'Instagram and Facebook', d: 'Leads from ads and messages with the campaign and source kept.', ic: 'target' },
      { t: 'Website chat', d: 'A widget with an AI consultant: a visitor leaves contacts and a lead appears.', ic: 'mail' },
      { t: 'Stores', d: 'WooCommerce and Shopify orders and the Lumiva storefront — as sales with amount and status.', ic: 'box' },
      { t: 'Bookings', d: 'Online appointments and room bookings are linked to the client\'s lead and contact automatically.', ic: 'cal' },
      { t: 'Import and API', d: 'CSV/Excel upload and lead intake via API from bots, services and n8n/Make/Zapier.', ic: 'bolt' },
    ],
  },
  appr: {
    k: '04 · Approval and rejection',
    t: 'Every sale has a clear status and decision.',
    lede: 'A new order waits for confirmation. A manager confirms or cancels it in one click, and the CRM records the decision and triggers the next steps.',
    items: [
      { b: 'Five statuses', s: ' — new, awaiting confirmation, confirmed, cancelled and refunded. Change the status on the card or right in the list.' },
      { b: 'Decision in the log', s: ' — who changed the status, from what to what and when is recorded. No more arguing about who cancelled the order.' },
      { b: 'Automations on status change', s: ' — an email to the client, a task, a Telegram message or a webhook on confirmation or cancellation.' },
      { b: 'Back to the store', s: ' — for WooCommerce orders the new status is sent back to the store.' },
      { b: 'Payment by link', s: ' — create a payment link from the sale card via iyzico, PayTR or YooKassa.' },
    ],
    vis: {
      deal: 'Order #4821 · Double room',
      amount: '€640',
      meta: ['hotel.example.com', 'Booking · direct', 'utm_campaign=autumn'],
      st: { new: 'New', pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled', refunded: 'Refunded' },
      log: { created: 'Order created from the website', pending: 'Pending → payment check', confirmed: 'Pending → Confirmed', cancelled: 'Pending → Cancelled' },
      by: 'Anna K.',
      auto: 'Automation: email sent to the client',
      woo: 'Status sent to the store',
      mail: 'Task "Call the client" created',
    },
  },
  track: {
    k: '05 · Tracking',
    t: 'No request disappears without a trace.',
    d: 'From the first ad click to payment, every request and sale has a history — and you will spot stalled ones before the client does.',
    items: [
      { t: 'Source and UTM', d: 'utm_source, utm_medium, utm_campaign, utm_content and utm_term are kept on every lead.', ic: 'target' },
      { t: 'Lead history', d: 'Status, owner and field changes in the card timeline, with date and author.', ic: 'clock' },
      { t: 'Messages in the card', d: 'WhatsApp, Telegram and email for a client in one thread, whatever the channel.', ic: 'chat' },
      { t: 'Activity log', d: 'Who changed what in sales and leads — with date, time and the old value.', ic: 'log' },
      { t: 'Stalled sales', d: 'A daily digest of sales without a decision for over N days — by email, Telegram or as a task.', ic: 'bell' },
      { t: 'Stalled leads', d: 'The same digest for leads that have not moved in the pipeline for a while.', ic: 'bell' },
    ],
  },
  pair: {
    mgr: { title: 'Results by manager · example', won: 'won', lost: 'lost', rep: 'repeat', rows: [['Anna Kovaleva', 24, 6, 5], ['Mert Yilmaz', 19, 9, 3], ['Ilya Petrov', 15, 7, 2], ['Elif Demir', 12, 4, 4]] },
    ch: { title: 'Sales by channel · example', ok: 'confirmed', cancel: 'cancelled', refund: 'refunded', rows: [['Website', 82, 14, 4], ['WooCommerce', 74, 20, 6], ['B2B partners', 88, 10, 2], ['OTA', 69, 25, 6]] },
  },
  steps: {
    k: '06 · How it works',
    t: 'From request to confirmed sale.',
    d: 'Five steps every request goes through. Nothing has to be copied by hand.',
    n: 'Step',
    items: [
      { t: 'Request arrives', d: 'From any site or channel. The CRM keeps the site, source and UTM and checks duplicates by email and phone.' },
      { t: 'Qualification', d: 'The lead gets an owner and the "In progress" status. An AI employee can sort the request and assign a manager.' },
      { t: 'Sale', d: 'A sale with amount and channel is created from the request — it waits for confirmation.' },
      { t: 'Decision', d: 'Confirm or cancel. The decision is written to the log and triggers automations.' },
      { t: 'Control', d: 'Analytics by manager and channel, the stalled sales digest and CSV/Excel export.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs requests in email and spreadsheets',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'Several websites', lumiva: 'All sites in one base, each lead shows its site', typical: 'A separate inbox or sheet per site' },
      { metric: 'Request source', lumiva: 'Channel, campaign and UTM kept on every lead', typical: 'The source gets lost between systems' },
      { metric: 'Order decision', lumiva: 'Status and log: who confirmed or cancelled and when', typical: 'An agreement in a manager\'s chat' },
      { metric: 'Stalled sales', lumiva: 'A daily digest of orders without a decision', typical: 'You find out when the client is gone' },
      { metric: 'Manager results', lumiva: 'Won, lost and repeat sales for each manager', typical: 'Manual spreadsheets once a month' },
    ],
  },
  ai: {
    k: 'AI employee for this solution',
    name: 'Sofia AI',
    job: 'Sales manager',
    text: 'Watches the pipeline between stand-ups: finds deals with no movement, drafts a follow-up and gives the manager a task for the next step. Emails to clients go out only after your approval.',
    list: ['Finds stalled deals', 'Drafts a follow-up email', 'Creates a task for a manager'],
    hire: 'About AI employees',
    aura: '"Sales team" dashboard',
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Websites and channels',
        items: [
          { q: 'How many websites can we connect?', a: 'There is no limit on the number of sites. Each site is added with its domain and gets its own token. Requests from all sites go into one shared lead list, but every lead keeps the site it came from — you can see it on the card.' },
          { q: 'How do we connect a WordPress site or any other platform?', a: 'For WordPress there is the Lumiva plugin: it passes requests from Contact Form 7 and other forms, and for WooCommerce it also passes orders. For any other site use an embeddable Lumiva form or a plain POST request to the API with the site token — from a landing page, a bot or n8n/Make/Zapier.' },
          { q: 'Can someone send fake requests on behalf of our site?', a: 'Public lead intake checks that the request came from exactly the domain you registered for that token. Requests from other domains are rejected. If a token leaks, you can pause the site or reissue the key.' },
          { q: 'What other channels do leads come from?', a: 'WhatsApp Business, Telegram, Instagram and Facebook, website chat, online appointments and bookings, the Lumiva storefront, WooCommerce and Shopify stores, CSV/Excel import and the API. Each lead keeps its channel and source.' },
          { q: 'A client wrote both on the site and in WhatsApp. Will there be two leads?', a: 'Lumiva looks for duplicates by email, phone and name and shows them in groups with the match reason. Merge in one click, and undo the merge if needed. Nightly auto-merge can also be turned on.' },
        ],
      },
      {
        g: 'Tracking',
        items: [
          { q: 'What source data is kept on a request?', a: 'The site, channel (form, messenger, store, API) and source, plus five UTM tags: utm_source, utm_medium, utm_campaign, utm_content and utm_term. So reports show not just how many requests came in, but from which campaign.' },
          { q: 'Where can we see the history of a specific request?', a: 'The lead card has a history timeline: status, owner and field changes with date and author, plus the client\'s WhatsApp, Telegram and email messages. For sales, status changes go into the activity log: who, when and from which status to which.' },
          { q: 'How do we learn about sales nobody has decided on?', a: 'Turn on the "Stalled sales" automation. Once a day it collects sales in "New" and "Pending" that have not changed for longer than the set period (14 days by default) and sends a digest — by email, Telegram or as a task for the owner. There is the same one for leads.' },
          { q: 'Can we export data for our own report?', a: 'Yes. Sales analytics can be exported to CSV or Excel, and new leads can be sent into the CRM via the API.' },
        ],
      },
      {
        g: 'Approval and rejection',
        items: [
          { q: 'How does sale confirmation work?', a: 'A sale has five statuses: new, awaiting confirmation, confirmed, cancelled and refunded. A new order from the site or store waits for a decision; a manager confirms or cancels it on the card or right in the list.' },
          { q: 'What happens when a sale is confirmed or cancelled?', a: 'The status change is written to the activity log and triggers automations on the "sale status changed" event: an email to the client, a task, a Telegram message, a tag or a webhook to an external system. For WooCommerce orders the new status is sent back to the store.' },
          { q: 'Can we take payment for a confirmed sale?', a: 'Yes. A payment link is created from the sale card via the connected provider — iyzico, PayTR or YooKassa. Payments appear in a separate payments ledger.' },
          { q: 'Can we see how many sales were cancelled or refunded?', a: 'Yes. Sales analytics counts confirmed, cancelled and refunded sales separately, broken down by channel, market and period.' },
          { q: 'Can we restrict who confirms and cancels sales?', a: 'Yes. Access rights are set per role: who can edit sales, whether an employee sees only their own records or all, and whether amounts and contacts are hidden from them.' },
        ],
      },
      {
        g: 'Team and analytics',
        items: [
          { q: 'Can we see results by manager?', a: 'Yes. The manager report shows won and lost leads and repeat sales for each employee over the selected period. Lost leads are collected separately: count, lost amount and trend.' },
          { q: 'Does it work for weekly sales reviews?', a: 'Yes. For reviews, build an Aura dashboard from the "Sales team" template: revenue, pipeline, team goal and manager ranking on one screen — you can also put it on the office TV.' },
          { q: 'Can we try it on our own data?', a: 'Yes. Sign-up gives 14 days of the Enterprise plan for free, no card required. Upload clients and leads from Excel or CSV and connect your sites in a few minutes.' },
        ],
      },
    ],
  },
  cta: { k: 'Ready to see it?', t: 'We\'ll connect your sites and show the pipeline on your data in 30 minutes.' },
};

const tr: SalesText = {
  crumbs: ['Çözümler', 'Satış'],
  kicker: 'Çözüm · Satış',
  t1: 'Tüm sitelerden ve kanallardan gelen talepler —',
  t2: 'tek satış hunisinde.',
  sub: 'Lumiva birden fazla siteden, mesajlaşma uygulamasından ve mağazadan gelen talepleri toplar, her talebin kaynağını ve UTM\'sini saklar, satışları ise net durumlarla yürütür: onay bekliyor, onaylandı, iptal edildi, iade. Her karar günlüğe yazılır — kimin neyi ne zaman değiştirdiği görünür.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '5', l: 'satış durumu: yeni, bekliyor, onaylandı, iptal, iade' },
    { v: '14', l: 'gün karar verilmezse satış bekleyenler özetine düşer (ayarlanabilir)' },
    { v: '3', l: 'yönetici başına sonuç: kazanılan, kaybedilen, tekrar satış' },
    { v: '30', l: 'gün içinde silinen talepler çöp kutusundan geri yüklenebilir' },
  ],
  prob: {
    k: '01 · Sorun',
    t: 'Talepler beş siteden ve üç mesajlaşma uygulamasından geliyor. Rapor elle hazırlanıyor.',
    d: 'Bir site WordPress\'te, mağaza WooCommerce\'te, müşteriler WhatsApp ve Telegram\'dan yazıyor. Talepler e-posta ile sohbetler arasında kayboluyor, müşterinin hangi reklamdan geldiğini kimse bilmiyor, sipariş kararı — onaylandı mı reddedildi mi — yöneticinin aklında kalıyor. Ay sonunda rakamlar beş yerden toplanıyor ve hangisinin doğru olduğu tartışılıyor. Lumiva hepsini tek geçmişi olan tek bir huniye toplar.',
  },
  sites: {
    k: '02 · Çoklu site',
    t: 'İstediğiniz kadar site — tek talep tabanı.',
    lede: 'Tüm sitelerinizi, açılış sayfalarınızı ve mağazalarınızı bağlayın. Talepler ortak listeye düşer ama her birinin nereden geldiği görünür.',
    items: [
      { b: 'Her sitenin kendi anahtarı', s: ' — site alan adıyla eklenir ve formlar ile API için ayrı bir anahtar alır. Site sayısında sınır yoktur.' },
      { b: 'Sahte taleplere karşı koruma', s: ' — talep yalnızca o anahtar için kayıtlı alan adından gelirse kabul edilir. Başka bir site sizin adınıza talep gönderemez.' },
      { b: 'Site kartta kalır', s: ' — her talepte site, kanal, kaynak ve UTM etiketleri saklanır; site bazlı raporu elle hazırlamaya gerek kalmaz.' },
      { b: 'Açma ve kapatma', s: ' — site geçmişi silinmeden geçici olarak kapatılabilir, WordPress eklentisi modülleri (formlar, bağlayıcı) her site için ayrı açılabilir.' },
      { b: 'Satış kanalı olarak mağazalar', s: ' — bağlanan her WooCommerce mağazası kendi tutarları ve sipariş sayısıyla ayrı bir satış kanalı olur.' },
    ],
    vis: {
      h: 'Bağlı siteler',
      inbox: 'Gelen talepler',
      now: 'az önce', min: 'dk',
      off: 'kapalı',
      leads: [
        { n: 'Anna Kovaleva', site: 0, src: 'Google Ads', utm: 'utm_campaign=autumn' },
        { n: 'Mert Yılmaz', site: 1, src: 'WhatsApp', utm: 'utm_source=wa' },
        { n: 'İlya Petrov', site: 2, src: 'Meta Ads', utm: 'utm_campaign=promo' },
        { n: 'Elif Demir', site: 0, src: 'Instagram', utm: 'utm_medium=social' },
        { n: 'Oleg Smirnov', site: 1, src: 'Telegram', utm: 'utm_source=tg' },
      ],
    },
  },
  channels: {
    k: '03 · Kanallar',
    t: 'Tüm kanallardan talepler — kaynağıyla birlikte.',
    d: 'Müşteri talebi nerede bırakırsa bıraksın — sitede, mesajlaşma uygulamasında veya mağazada — CRM\'de anında kanal ve kaynağıyla görünür.',
    items: [
      { t: 'Siteler ve formlar', d: 'Gömülebilir formlar, WordPress ve Contact Form 7, herhangi bir açılış sayfasından POST isteği.', ic: 'grid' },
      { t: 'WhatsApp Business', d: 'Mesajlar talebe dönüşür, doğrudan müşteri kartından yanıt verilebilir.', ic: 'chat' },
      { t: 'Telegram', d: 'Bot ve CRM içinde yazışma, yeni başvurular doğrudan huniye düşer.', ic: 'chat' },
      { t: 'Instagram ve Facebook', d: 'Reklamlardan ve mesajlardan gelen talepler, kampanya ve kaynağıyla.', ic: 'target' },
      { t: 'Site sohbeti', d: 'Yapay zekâ danışmanlı widget: ziyaretçi iletişim bilgisi bırakır, talep oluşur.', ic: 'mail' },
      { t: 'Mağazalar', d: 'WooCommerce ve Shopify siparişleri ile Lumiva vitrini — tutar ve durumla satış olarak.', ic: 'box' },
      { t: 'Rezervasyonlar', d: 'Online randevu ve oda rezervasyonları müşterinin talebine ve kişisine otomatik bağlanır.', ic: 'cal' },
      { t: 'İçe aktarma ve API', d: 'CSV/Excel yükleme ve botlardan, servislerden, n8n/Make/Zapier\'den API ile talep alımı.', ic: 'bolt' },
    ],
  },
  appr: {
    k: '04 · Onay ve ret',
    t: 'Her satışın net bir durumu ve kararı var.',
    lede: 'Yeni sipariş onay bekler. Yönetici tek tıkla onaylar veya iptal eder; CRM kararı kaydeder ve sonraki adımları başlatır.',
    items: [
      { b: 'Beş durum', s: ' — yeni, onay bekliyor, onaylandı, iptal edildi ve iade. Durum kartta veya doğrudan listede değiştirilir.' },
      { b: 'Karar günlükte', s: ' — durumu kimin, neyden neye ve ne zaman değiştirdiği kaydedilir. Siparişi kimin iptal ettiği tartışılmaz.' },
      { b: 'Durum değişikliğinde otomasyonlar', s: ' — onay veya iptalde müşteriye e-posta, görev, Telegram mesajı veya webhook.' },
      { b: 'Mağazaya geri', s: ' — WooCommerce siparişlerinde yeni durum mağazaya geri gönderilir.' },
      { b: 'Bağlantıyla ödeme', s: ' — satış kartından iyzico, PayTR veya YooKassa ile ödeme bağlantısı oluşturulur.' },
    ],
    vis: {
      deal: 'Sipariş #4821 · Çift kişilik oda',
      amount: '€640',
      meta: ['hotel.example.com', 'Booking · direct', 'utm_campaign=autumn'],
      st: { new: 'Yeni', pending: 'Bekliyor', confirmed: 'Onaylandı', cancelled: 'İptal', refunded: 'İade' },
      log: { created: 'Sipariş siteden oluşturuldu', pending: 'Bekliyor → ödeme kontrolü', confirmed: 'Bekliyor → Onaylandı', cancelled: 'Bekliyor → İptal' },
      by: 'Anna K.',
      auto: 'Otomasyon: müşteriye e-posta gönderildi',
      woo: 'Durum mağazaya gönderildi',
      mail: '"Müşteriyi ara" görevi oluşturuldu',
    },
  },
  track: {
    k: '05 · Takip',
    t: 'Hiçbir talep iz bırakmadan kaybolmaz.',
    d: 'Reklama ilk tıklamadan ödemeye kadar her talebin ve satışın geçmişi vardır; bekleyenleri müşteriden önce görürsünüz.',
    items: [
      { t: 'Kaynak ve UTM', d: 'utm_source, utm_medium, utm_campaign, utm_content ve utm_term her talepte saklanır.', ic: 'target' },
      { t: 'Talep geçmişi', d: 'Durum, sorumlu ve alan değişiklikleri kart akışında, tarih ve yazarla.', ic: 'clock' },
      { t: 'Kartta yazışma', d: 'Müşterinin WhatsApp, Telegram ve e-posta mesajları kanaldan bağımsız tek akışta.', ic: 'chat' },
      { t: 'İşlem günlüğü', d: 'Satışlarda ve taleplerde kim neyi değiştirdi — tarih, saat ve eski değerle.', ic: 'log' },
      { t: 'Bekleyen satışlar', d: 'N günden uzun süredir karar verilmeyen satışların günlük özeti: e-posta, Telegram veya görev.', ic: 'bell' },
      { t: 'Bekleyen talepler', d: 'Hunide uzun süredir ilerlemeyen talepler için aynı özet.', ic: 'bell' },
    ],
  },
  pair: {
    mgr: { title: 'Yöneticilere göre sonuçlar · örnek', won: 'kazanılan', lost: 'kaybedilen', rep: 'tekrar', rows: [['Anna Kovaleva', 24, 6, 5], ['Mert Yılmaz', 19, 9, 3], ['İlya Petrov', 15, 7, 2], ['Elif Demir', 12, 4, 4]] },
    ch: { title: 'Kanallara göre satışlar · örnek', ok: 'onaylandı', cancel: 'iptal', refund: 'iade', rows: [['Site', 82, 14, 4], ['WooCommerce', 74, 20, 6], ['B2B iş ortakları', 88, 10, 2], ['OTA', 69, 25, 6]] },
  },
  steps: {
    k: '06 · Nasıl çalışır',
    t: 'Talepten onaylanmış satışa.',
    d: 'Her talebin geçtiği beş adım. Hiçbir şeyi elle taşımanız gerekmez.',
    n: 'Adım',
    items: [
      { t: 'Talep geldi', d: 'Herhangi bir siteden veya kanaldan. CRM site, kaynak ve UTM\'yi saklar, e-posta ve telefona göre mükerrerleri kontrol eder.' },
      { t: 'Nitelendirme', d: 'Talep bir sorumlu ve "İşlemde" durumu alır. Yapay zekâ çalışanı talebi ayıklayıp yönetici atayabilir.' },
      { t: 'Satış', d: 'Talepten tutar ve kanalla bir satış oluşturulur — onay bekler.' },
      { t: 'Karar', d: 'Onayla veya iptal et. Karar günlüğe yazılır ve otomasyonları başlatır.' },
      { t: 'Kontrol', d: 'Yönetici ve kanal analitiği, bekleyen satışlar özeti ve CSV/Excel aktarımı.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs e-posta ve tablolardaki talepler',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Birden fazla site', lumiva: 'Tüm siteler tek tabanda, her talepte site görünür', typical: 'Her site için ayrı posta kutusu veya tablo' },
      { metric: 'Talep kaynağı', lumiva: 'Kanal, kampanya ve UTM her talepte saklanır', typical: 'Kaynak sistemler arasında kaybolur' },
      { metric: 'Sipariş kararı', lumiva: 'Durum ve günlük: kim ne zaman onayladı veya iptal etti', typical: 'Yöneticinin sohbetinde kalan anlaşma' },
      { metric: 'Bekleyen satışlar', lumiva: 'Karar verilmeyen siparişlerin günlük özeti', typical: 'Müşteri gidince öğrenilir' },
      { metric: 'Yönetici sonuçları', lumiva: 'Her yönetici için kazanılan, kaybedilen ve tekrar satışlar', typical: 'Ayda bir elle tutulan tablolar' },
    ],
  },
  ai: {
    k: 'Bu çözüm için yapay zekâ çalışanı',
    name: 'Sofia AI',
    job: 'Satış yöneticisi',
    text: 'Toplantılar arasında huniyi izler: ilerlemeyen fırsatları bulur, takip mesajı hazırlar ve yöneticiye sonraki adım için görev açar. Müşteriye e-postalar yalnızca onayınızdan sonra gider.',
    list: ['Bekleyen fırsatları bulur', 'Takip e-postası hazırlar', 'Yöneticiye görev açar'],
    hire: 'Yapay zekâ çalışanları hakkında',
    aura: '"Satış ekibi" panosu',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Siteler ve kanallar',
        items: [
          { q: 'Kaç site bağlayabiliriz?', a: 'Site sayısında sınır yoktur. Her site kendi alan adıyla eklenir ve ayrı bir anahtar alır. Tüm sitelerden gelen talepler ortak listeye düşer, ancak her talep hangi siteden geldiğini saklar — kartta görünür.' },
          { q: 'WordPress veya başka bir platformdaki siteyi nasıl bağlarız?', a: 'WordPress için Lumiva eklentisi var: Contact Form 7 ve diğer formlardan gelen talepleri, WooCommerce için ayrıca siparişleri aktarır. Diğer siteler için gömülebilir Lumiva formu veya site anahtarıyla API\'ye basit bir POST isteği yeterlidir — açılış sayfasından, bottan veya n8n/Make/Zapier\'den.' },
          { q: 'Biri sitemiz adına sahte talep gönderebilir mi?', a: 'Herkese açık talep alımı, isteğin o anahtar için kaydettiğiniz alan adından geldiğini kontrol eder. Başka alan adlarından gelen istekler reddedilir. Anahtar sızarsa site kapatılabilir veya anahtar yenilenebilir.' },
          { q: 'Talepler başka hangi kanallardan gelir?', a: 'WhatsApp Business, Telegram, Instagram ve Facebook, site sohbeti, online randevu ve rezervasyonlar, Lumiva vitrini, WooCommerce ve Shopify mağazaları, CSV/Excel içe aktarma ve API. Her talep kanalını ve kaynağını saklar.' },
          { q: 'Müşteri hem siteden hem WhatsApp\'tan yazdı. İki talep mi olur?', a: 'Lumiva e-posta, telefon ve ada göre mükerrerleri arar ve eşleşme nedeniyle gruplar halinde gösterir. Tek tıkla birleştirilir, gerekirse birleştirme geri alınır. Gece otomatik birleştirme de açılabilir.' },
        ],
      },
      {
        g: 'Takip',
        items: [
          { q: 'Talepte kaynak hakkında hangi veriler saklanır?', a: 'Site, kanal (form, mesajlaşma, mağaza, API) ve kaynak ile beş UTM etiketi: utm_source, utm_medium, utm_campaign, utm_content ve utm_term. Böylece raporlarda yalnızca kaç talep geldiği değil, hangi kampanyadan geldiği de görünür.' },
          { q: 'Belirli bir talebin geçmişini nerede görürüz?', a: 'Talep kartında geçmiş akışı var: durum, sorumlu ve alan değişiklikleri tarih ve yazarla, ayrıca müşterinin WhatsApp, Telegram ve e-posta yazışmaları. Satışlarda durum değişiklikleri işlem günlüğüne yazılır: kim, ne zaman, hangi durumdan hangisine.' },
          { q: 'Kimsenin karar vermediği satışları nasıl öğreniriz?', a: '"Bekleyen satışlar" otomasyonunu açın. Günde bir kez "Yeni" ve "Bekliyor" durumunda, belirlenen süreden (varsayılan 14 gün) uzun süredir değişmeyen satışları toplar ve özet gönderir — e-posta, Telegram veya sorumluya görev olarak. Talepler için de aynısı var.' },
          { q: 'Kendi raporumuz için veri aktarabilir miyiz?', a: 'Evet. Satış analitiği CSV veya Excel olarak dışa aktarılabilir, yeni talepler API ile CRM\'e gönderilebilir.' },
        ],
      },
      {
        g: 'Onay ve ret',
        items: [
          { q: 'Satış onayı nasıl işler?', a: 'Satışın beş durumu vardır: yeni, onay bekliyor, onaylandı, iptal edildi ve iade. Siteden veya mağazadan gelen yeni sipariş karar bekler; yönetici kartta veya doğrudan listede onaylar ya da iptal eder.' },
          { q: 'Satış onaylandığında veya iptal edildiğinde ne olur?', a: 'Durum değişikliği işlem günlüğüne yazılır ve "satış durumu değişti" olayına bağlı otomasyonları başlatır: müşteriye e-posta, görev, Telegram mesajı, etiket veya harici sisteme webhook. WooCommerce siparişlerinde yeni durum mağazaya geri gönderilir.' },
          { q: 'Onaylanan satış için ödeme alabilir miyiz?', a: 'Evet. Satış kartından bağlı sağlayıcı — iyzico, PayTR veya YooKassa — üzerinden ödeme bağlantısı oluşturulur. Ödemeler ayrı bir ödeme günlüğünde görünür.' },
          { q: 'Kaç satışın iptal edildiğini veya iade edildiğini görebilir miyiz?', a: 'Evet. Satış analitiğinde onaylanan, iptal edilen ve iade edilen satışlar kanal, pazar ve döneme göre ayrı sayılır.' },
          { q: 'Satışları kimin onaylayıp iptal edebileceğini sınırlayabilir miyiz?', a: 'Evet. Erişim hakları role göre ayarlanır: kimin satışları düzenleyebileceği, çalışanın yalnızca kendi kayıtlarını mı yoksa tümünü mü gördüğü, tutarların ve iletişim bilgilerinin gizlenip gizlenmediği.' },
        ],
      },
      {
        g: 'Ekip ve analitik',
        items: [
          { q: 'Yöneticilere göre sonuçları görebilir miyiz?', a: 'Evet. Yönetici raporu, seçilen dönemde her çalışan için kazanılan ve kaybedilen talepleri ve tekrar satışları gösterir. Kaybedilen talepler ayrıca toplanır: sayı, kaybedilen tutar ve trend.' },
          { q: 'Haftalık satış toplantıları için uygun mu?', a: 'Evet. Toplantılar için "Satış ekibi" şablonundan bir Aura panosu kurun: ciro, huni, ekip hedefi ve yönetici sıralaması tek ekranda — ofis TV\'sine de yansıtılabilir.' },
          { q: 'Kendi verilerimizle deneyebilir miyiz?', a: 'Evet. Kayıt, Enterprise planını 14 gün ücretsiz ve kartsız verir. Müşterileri ve talepleri Excel veya CSV\'den yükleyin, sitelerinizi birkaç dakikada bağlayın.' },
        ],
      },
    ],
  },
  cta: { k: 'Görmeye hazır mısınız?', t: 'Sitelerinizi bağlayalım ve huniyi 30 dakikada kendi verilerinizle gösterelim.' },
};

export const SALES_T: Record<'ru' | 'en' | 'tr', SalesText> = { ru, en, tr };
