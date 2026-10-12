/**
 * «Решения · Система резервации» (solution-v2.html, ключ hotels). Проверено по backend/src/hotels:
 * отели (звёзды, время заезда/выезда, цель выручки сезона, пороги риска 45/65 %, овербукинг), типы номеров
 * (кол-во, базовая цена, стоп-продажа), физические номера с уборкой clean/dirty/inspected/out_of_order,
 * типы размещения с коэффициентом и платными детьми, рынки/группы рынков, агентства, периоды, дневные ставки
 * по группам рынков (budget/avg/gross/скидка/net), цена по рынку, точечные даты (цена/блок/скидка/мин. ночей),
 * брони (рынок, агентство, номер, PP/ночь, скидка, статусы confirmed/pending/checked_in/checked_out/cancelled,
 * оплата full/partial/none/refunded, платежи, депозит, ранний заезд/поздний выезд, список гостей с паспортами),
 * фолио PDF, стойка «сегодня», импорт броней/цен/инфо из Excel, фото и фактшит, XML/JSON-фид по токену,
 * публичный API поиска/брони/проверки по коду, аналитика (KPI, пейсинг 90/60/30/14/7/0 к цели, воронка выручки
 * к цели сезона, типы номеров с ADR, рынки, агентства, гости, заезды с теплокартой риска), автоматизации
 * (новая бронь, статус, смена цены, стоп-продажа, мало мест — тип номера заполнен выше порога), ИИ-ассистент броней.
 * Макет врал: «алерт о недозагрузке» (алерт есть только о высокой заполняемости), «−27 %», «81 номер», «за наш счёт».
 */
import type { SolQA, SolCard } from './solutionKit';
import type { SolFeedT, SolTblT } from './solutionExtras';

export type HotelText = {
  crumbs: [string, string];
  kicker: string;
  t1: string;
  t2: string;
  sub: string;
  tryFree: string;
  demo: string;
  demoNote: string;
  stats: Array<{ v: string; l: string }>;
  pace: { t: string; target: string; actual: string; days: string; gap: string; behind: string };
  how: { k: string; t: string; d: string; ai: string; doing: string[]; flow: Array<[string, string]> };
  heat: { t: string; months: string[]; rooms: string[]; legend: [string, string, string] };
  prob: { k: string; t: string; d: string };
  feats: { k: string; t: string; d: string; items: SolCard[] };
  tbl: SolTblT;
  rates: { k: string; t: string; d: string; items: SolCard[] };
  desk: { k: string; t: string; d: string; items: SolCard[] };
  feed: SolFeedT;
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: SolQA[] }> };
  more: { k: string; t: string };
  cta: { k: string; t: string };
};

const ru: HotelText = {
  crumbs: ['Решения', 'Система резервации'],
  kicker: 'Решение · Система резервации',
  t1: 'Видите отставание от плана',
  t2: 'за месяцы до заезда.',
  sub: 'Пейсинг по датам заезда, заполняемость по типам номеров и месяцам, тарифы по рынкам и агентствам, стойка регистрации и фолио гостя — в одной системе. Отставание от целевого темпа видно, пока ещё есть время поменять цену или открыть продажи на нужных рынках.',
  tryFree: 'Попробовать 14 дней',
  demo: 'Запросить демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '6', l: 'контрольных точек пейсинга: от 90 дней до заезда' },
    { v: '5', l: 'статусов брони — от ожидания до выезда' },
    { v: '4', l: 'статуса уборки у каждого номера' },
    { v: '3', l: 'языка в системе: русский, английский, турецкий' },
  ],
  pace: { t: 'Пейсинг · сезон', target: 'Цель', actual: 'Факт', days: 'дней до заезда', gap: 'отставание', behind: 'Нужно продавать быстрее' },
  how: {
    k: 'Как это работает',
    t: 'От тарифа до выезда гостя — один процесс.',
    d: 'Тарифы и стоп-продажи задаются по датам, рынкам и агентствам. Брони приходят вручную, импортом из Excel или через API, цена подставляется сама по рынку и типу размещения. На заезде гость получает номер, на выезде — фолио в PDF, а аналитика сразу показывает, как это сказалось на плане сезона.',
    ai: 'ИИ-ассистент броней',
    doing: ['Сверяет даты и тип номера в заявке', 'Готовит ответ гостю на его языке', 'Собирает отчёт по броням за день'],
    flow: [
      ['Тариф', 'Рынок, агентство, даты'],
      ['Бронь', 'Вручную, Excel или API'],
      ['Заезд', 'Номер, гости, оплата'],
      ['Аналитика', 'Пейсинг и план сезона'],
    ],
  },
  heat: {
    t: 'Заполняемость по типам номеров',
    months: ['Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт'],
    rooms: ['Standard Twin', 'Standard Double', 'Deluxe Sea View', 'Junior Suite', 'Family Room'],
    legend: ['ниже 45 % — риск', '45–65 % — внимание', 'выше 65 %'],
  },
  prob: {
    k: 'Задача',
    t: 'Итоговая загрузка показывает проблему, когда исправлять уже поздно.',
    d: 'Тип номера весь сезон продаётся медленнее плана, но в общем отчёте это прячется за хорошими цифрами по другим номерам. Замечают, когда до заезда неделя, и поднимать продажи уже нечем. Lumiva сравнивает факт с целевым темпом на каждой точке до заезда и показывает заполняемость по каждому типу номера и месяцу отдельно.',
  },
  feats: {
    k: 'Возможности',
    t: 'Всё, что нужно отделу бронирования.',
    d: 'Несколько отелей в одной системе — каждый со своей валютой, временем заезда и выезда, целью сезона и порогами риска.',
    items: [
      { t: 'Номерной фонд', d: 'Типы номеров с количеством, базовой ценой, удобствами и фото. Стоп-продажа на тип целиком или на отдельные даты.', ic: 'grid' },
      { t: 'Физические номера', d: 'Номера с номерами комнат и статусом уборки: чистый, грязный, проверен, не работает. При заезде гость получает конкретный номер.', ic: 'box' },
      { t: 'Пейсинг по датам заезда', d: 'Факт продаж сравнивается с целевым темпом за 90, 60, 30, 14, 7 дней и в день заезда. Цели задаются для каждого отеля.', ic: 'chart' },
      { t: 'Риск по месяцам', d: 'Теплокарта заполняемости по типам номеров и месяцам с вашими порогами — видно, где продажи отстают.', ic: 'target' },
      { t: 'Брони и оплаты', d: 'Рынок, агентство, цена за ночь и на человека, скидка, депозит, платежи по способам, ранний заезд и поздний выезд.', ic: 'leads' },
      { t: 'Гости', d: 'Список гостей в брони: гражданство, паспорт, срок действия, возраст — для регистрации и отчётов.', ic: 'users' },
    ],
  },
  tbl: {
    k: 'Типы номеров',
    t: 'Загрузка и средняя цена — по каждому типу номера.',
    d: 'Общая загрузка отеля прячет то, что происходит с конкретными номерами. В аналитике каждый тип номера показан отдельно: сколько продано, какая заполняемость и средняя цена за ночь (ADR).',
    head: ['Тип номера', 'Номеров', 'Продано', 'Загрузка', 'ADR'],
    occ: 3,
    rows: [
      ['Standard Twin|2 взрослых', '30', '26', '87', '€82'],
      ['Standard Double|2 взрослых', '20', '17', '85', '€88'],
      ['Deluxe Sea View|2+1', '15', '10', '67', '€132'],
      ['Junior Suite|2+2', '10', '4', '40', '€210'],
      ['Family Room|2+2', '6', '5', '83', '€168'],
    ],
    note: 'Пример на демо-данных.',
  },
  rates: {
    k: 'Тарифы',
    t: 'Цены по рынкам, агентствам и датам — без ручного пересчёта.',
    d: 'Модель цен повторяет то, как работают отели с туроператорами: периоды, рынки, группы рынков и ставки на человека.',
    items: [
      { t: 'Периоды и дневные ставки', d: 'Ставка на каждый день по группе рынков: budget, средняя и gross на человека, скидка и net.', ic: 'cal' },
      { t: 'Рынки и агентства', d: 'Цена номера по рынку, рынки объединяются в группы, у брони сохраняются рынок и агентство.', ic: 'target' },
      { t: 'Типы размещения', d: 'Коэффициенты для одноместного, двухместного размещения и платных детей — цена считается от базы.', ic: 'users' },
      { t: 'Точечные даты', d: 'На конкретную дату: своя цена, скидка, минимум ночей или закрытие продаж.', ic: 'filter' },
      { t: 'Автоподстановка цены', d: 'При создании брони цена за ночь подставляется сама по типу номера, рынку и датам.', ic: 'bolt' },
      { t: 'Импорт из Excel', d: 'Прайс-листы, цены номеров, брони и информация об отеле загружаются из файлов с предпросмотром.', ic: 'log' },
    ],
  },
  desk: {
    k: 'Стойка регистрации',
    t: 'День отеля на одном экране.',
    d: 'Заезды, выезды и гости в отеле на сегодня — без поиска по списку броней.',
    items: [
      { t: 'Заезды и выезды', d: 'Кто приезжает и уезжает сегодня, сколько гостей сейчас в отеле.', ic: 'clock' },
      { t: 'Номер при заезде', d: 'При заселении выбирается номер нужного типа — номер, занятый на эти даты другой бронью, выбрать нельзя.', ic: 'box' },
      { t: 'Фолио в PDF', d: 'Счёт гостя с проживанием и платежами формируется в один клик.', ic: 'log' },
      { t: 'Уборка', d: 'Статус каждого номера обновляется со стойки: чистый, грязный, проверен, не работает.', ic: 'check' },
    ],
  },
  feed: {
    k: 'Автоматизации',
    t: 'События отеля запускают действия сами.',
    d: 'Новая бронь, смена статуса, изменение цены, стоп-продажа и высокая заполняемость типа номера — на каждое событие можно отправить письмо, сообщение в Telegram или уведомление в CRM. В тексте доступны переменные: гость, тип номера, даты.',
    rows: [
      ['сегодня 11:40', 'Мало мест · Standard Twin, июль — заполнено 87 % при пороге 65 %', 'мало мест', false],
      ['сегодня 09:15', 'Новая бронь · Deluxe Sea View, агентство, рынок DE', 'новая', true],
      ['вчера 17:30', 'Цена изменена · Standard Twin, группа рынков EU', 'цена', true],
      ['вчера 14:02', 'Стоп-продажа · Family Room, 12–15 июля', 'стоп', false],
      ['2 дня назад', 'Статус: заселён · бронь #4482', 'заезд', true],
    ],
    note: 'Пример на демо-данных. Уведомление «мало мест» приходит, когда тип номера за месяц заезда заполнен выше порога отеля.',
  },
  ai: {
    k: 'ИИ-сотрудник для этого решения',
    name: 'ИИ-ассистент броней',
    job: 'Отдел бронирования',
    text: 'Подключается к новым броням отеля и сообщениям в Telegram и WhatsApp. Проверяет даты и тип номера, готовит официальные ответы гостям и агентствам на русском, турецком или английском и собирает ежедневный отчёт по броням. Письма уходят после вашего согласования.',
    list: ['Проверяет даты и номер', 'Готовит ответ гостю', 'Собирает отчёт за день'],
    hire: 'Об ИИ-сотрудниках',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Пейсинг и аналитика',
        items: [
          { q: 'Что такое пейсинг и зачем он нужен?', a: 'Это сравнение того, сколько номеров уже продано на дату заезда, с тем, сколько должно было быть продано к этому моменту. Lumiva проверяет темп за 90, 60, 30, 14 и 7 дней до заезда и в день заезда и показывает отставание в процентах и сколько номеров в день нужно продавать, чтобы догнать план.' },
          { q: 'Можно ли задать свои цели пейсинга?', a: 'Да. Целевой процент на каждой точке задаётся для каждого отеля. По умолчанию: 10 % за 90 дней, 40 % за 60, 65 % за 30, 80 % за 14, 92 % за 7 и 100 % в день заезда.' },
          { q: 'Что показывает аналитика ещё?', a: 'Ключевые показатели и заполняемость сегодня, воронку выручки к цели сезона (оплачено, ожидает оплаты, осталось продать), разбивку по типам номеров с ADR, по рынкам, агентствам и гостям, а также заезды с теплокартой риска по месяцам.' },
          { q: 'Будет ли уведомление, если номер продаётся плохо?', a: 'Отдельного уведомления о недозагрузке нет — недозагрузку показывают пейсинг и теплокарта риска в аналитике. Автоматическое уведомление «мало мест» приходит в обратном случае, когда тип номера за месяц заполнился выше порога отеля.' },
        ],
      },
      {
        g: 'Тарифы и брони',
        items: [
          { q: 'Как устроены цены?', a: 'Есть базовая цена типа номера, цены по рынкам, дневные ставки по группам рынков (budget, средняя, gross, скидка, net), коэффициенты типов размещения и точечные даты со своей ценой, скидкой, минимумом ночей или закрытием. При создании брони цена подставляется сама.' },
          { q: 'Можно ли загрузить прайс туроператора из Excel?', a: 'Да. Прайс-листы, цены номеров, брони и информация об отеле импортируются из файлов: сначала предпросмотр, затем загрузка.' },
          { q: 'Как учитываются оплаты?', a: 'Статус оплаты брони — полная, частичная, без оплаты, возврат. В брони хранятся депозит и список платежей с датой, суммой и способом, а фолио гостя выгружается в PDF.' },
          { q: 'Синхронизируется ли система с Booking.com и другими каналами?', a: 'Нет, channel manager не подключён. Booking.com и другие площадки ведутся как агентства: у брони сохраняется источник, а цены можно задавать по агентствам и рынкам. Для партнёров есть фид номеров и цен в XML и JSON по секретной ссылке.' },
        ],
      },
      {
        g: 'Операционная работа',
        items: [
          { q: 'Есть ли стойка регистрации?', a: 'Да. На экране «сегодня» — заезды, выезды и число гостей в отеле. При заселении бронь получает конкретный номер, а статус уборки номера меняется прямо со стойки.' },
          { q: 'Можно ли вести несколько отелей?', a: 'Да. У каждого отеля своя валюта, время заезда и выезда, цель выручки на сезон, пороги риска и настройка овербукинга. Аналитику можно смотреть по одному отелю или по всем.' },
          { q: 'Можно ли принимать брони с сайта отеля?', a: 'Есть публичный API: список отелей, поиск свободных номеров на даты, создание брони и проверка брони гостем по коду и email. Онлайн-оплата брони через него пока работает только в тестовом режиме.' },
        ],
      },
      {
        g: 'Запуск',
        items: [
          { q: 'Как перенести текущие брони?', a: 'Через импорт из Excel с предпросмотром и сопоставлением колонок. Так же загружаются прайс-листы и информация об отеле.' },
          { q: 'Сколько стоит?', a: 'Система резервации доступна во всех тарифах, начиная со Standard. ИИ-ассистент броней — с тарифа Professional. 14 дней пробного периода — со всеми модулями, без карты.' },
        ],
      },
    ],
  },
  more: { k: 'Другие решения', t: 'Lumiva закрывает весь бизнес.' },
  cta: { k: '14 дней бесплатно', t: 'Узнайте об отставании от плана сезона, пока его ещё можно догнать.' },
};

const en: HotelText = {
  crumbs: ['Solutions', 'Hotels/PMS'],
  kicker: 'Solution · Hotels/PMS',
  t1: 'Spot the gap to plan',
  t2: 'months before arrival.',
  sub: 'Pacing by arrival date, occupancy by room type and month, rates by market and agency, a front desk and guest folios — in one system. You see a shortfall against the target pace while there is still time to change prices or open sales in the right markets.',
  tryFree: 'Try 14 days',
  demo: 'Request a demo',
  demoNote: 'Demo data example',
  stats: [
    { v: '6', l: 'pacing checkpoints, from 90 days before arrival' },
    { v: '5', l: 'reservation statuses — from pending to checked out' },
    { v: '4', l: 'housekeeping statuses for every room' },
    { v: '3', l: 'interface languages: Russian, English, Turkish' },
  ],
  pace: { t: 'Pacing · season', target: 'Target', actual: 'Actual', days: 'days before arrival', gap: 'behind', behind: 'Sell faster' },
  how: {
    k: 'How it works',
    t: 'From rate to check-out — one process.',
    d: 'Rates and stop sales are set by dates, markets and agencies. Reservations come in manually, from Excel or via the API, and the price fills in by market and occupancy type. At check-in the guest gets a room, at check-out a PDF folio — and analytics immediately shows how it affected the season plan.',
    ai: 'AI reservation assistant',
    doing: ['Checks the dates and room type in a request', 'Drafts a reply in the guest’s language', 'Builds the daily reservation report'],
    flow: [
      ['Rate', 'Market, agency, dates'],
      ['Reservation', 'Manual, Excel or API'],
      ['Check-in', 'Room, guests, payment'],
      ['Analytics', 'Pacing and season plan'],
    ],
  },
  heat: {
    t: 'Occupancy by room type',
    months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    rooms: ['Standard Twin', 'Standard Double', 'Deluxe Sea View', 'Junior Suite', 'Family Room'],
    legend: ['below 45% — risk', '45–65% — watch', 'above 65%'],
  },
  prob: {
    k: 'The problem',
    t: 'Total occupancy shows the problem when it’s too late to fix.',
    d: 'A room type sells slower than plan all season, but the overall report hides it behind good numbers elsewhere. It gets noticed a week before arrival, when there’s nothing left to boost sales with. Lumiva compares actuals with the target pace at every checkpoint before arrival and shows occupancy for each room type and month separately.',
  },
  feats: {
    k: 'Capabilities',
    t: 'Everything a reservations team needs.',
    d: 'Several hotels in one system — each with its own currency, check-in and check-out times, season target and risk thresholds.',
    items: [
      { t: 'Room inventory', d: 'Room types with quantity, base price, amenities and photos. Stop sale for a whole type or specific dates.', ic: 'grid' },
      { t: 'Physical rooms', d: 'Rooms with room numbers and housekeeping status: clean, dirty, inspected, out of order. The guest gets a specific room at check-in.', ic: 'box' },
      { t: 'Pacing by arrival date', d: 'Actual sales are compared with the target pace at 90, 60, 30, 14 and 7 days and on the arrival day. Targets are set per hotel.', ic: 'chart' },
      { t: 'Risk by month', d: 'An occupancy heatmap by room type and month with your thresholds — you see where sales lag.', ic: 'target' },
      { t: 'Reservations and payments', d: 'Market, agency, price per night and per person, discount, deposit, payments by method, early check-in and late check-out.', ic: 'leads' },
      { t: 'Guests', d: 'A guest list per reservation: citizenship, passport, expiry date, age — for registration and reports.', ic: 'users' },
    ],
  },
  tbl: {
    k: 'Room types',
    t: 'Occupancy and average rate — per room type.',
    d: 'Total hotel occupancy hides what happens to specific rooms. Analytics shows each room type separately: rooms sold, occupancy and the average daily rate (ADR).',
    head: ['Room type', 'Rooms', 'Sold', 'Occupancy', 'ADR'],
    occ: 3,
    rows: [
      ['Standard Twin|2 adults', '30', '26', '87', '€82'],
      ['Standard Double|2 adults', '20', '17', '85', '€88'],
      ['Deluxe Sea View|2+1', '15', '10', '67', '€132'],
      ['Junior Suite|2+2', '10', '4', '40', '€210'],
      ['Family Room|2+2', '6', '5', '83', '€168'],
    ],
    note: 'Demo data example.',
  },
  rates: {
    k: 'Rates',
    t: 'Prices by market, agency and date — no manual recalculation.',
    d: 'The pricing model follows how hotels work with tour operators: periods, markets, market groups and per-person rates.',
    items: [
      { t: 'Periods and daily rates', d: 'A rate for every day per market group: budget, average and gross per person, discount and net.', ic: 'cal' },
      { t: 'Markets and agencies', d: 'Room price per market, markets grouped together, and the market and agency stored on each reservation.', ic: 'target' },
      { t: 'Occupancy types', d: 'Coefficients for single and double occupancy and paid children — the price is derived from the base.', ic: 'users' },
      { t: 'Specific dates', d: 'For a given date: its own price, discount, minimum nights or closed sales.', ic: 'filter' },
      { t: 'Price auto-fill', d: 'When a reservation is created, the nightly price fills in by room type, market and dates.', ic: 'bolt' },
      { t: 'Excel import', d: 'Price lists, room prices, reservations and hotel information load from files with a preview.', ic: 'log' },
    ],
  },
  desk: {
    k: 'Front desk',
    t: 'The hotel’s day on one screen.',
    d: 'Today’s arrivals, departures and in-house guests — without searching the reservation list.',
    items: [
      { t: 'Arrivals and departures', d: 'Who arrives and leaves today and how many guests are in the hotel now.', ic: 'clock' },
      { t: 'Room at check-in', d: 'At check-in you pick a room of the right type — a room taken by another reservation for those dates can’t be chosen.', ic: 'box' },
      { t: 'PDF folio', d: 'The guest bill with stay and payments is generated in one click.', ic: 'log' },
      { t: 'Housekeeping', d: 'Each room’s status is updated from the desk: clean, dirty, inspected, out of order.', ic: 'check' },
    ],
  },
  feed: {
    k: 'Automations',
    t: 'Hotel events trigger actions on their own.',
    d: 'New reservation, status change, price change, stop sale and high occupancy of a room type — each event can send an email, a Telegram message or a CRM notification. Templates support variables: guest, room type, dates.',
    rows: [
      ['today 11:40', 'Low availability · Standard Twin, July — 87% full vs 65% threshold', 'low avail.', false],
      ['today 09:15', 'New reservation · Deluxe Sea View, agency, market DE', 'new', true],
      ['yesterday 17:30', 'Price changed · Standard Twin, market group EU', 'price', true],
      ['yesterday 14:02', 'Stop sale · Family Room, 12–15 July', 'stop', false],
      ['2 days ago', 'Status: checked in · reservation #4482', 'check-in', true],
    ],
    note: 'Demo data example. The “low availability” notice fires when a room type is filled above the hotel threshold for the arrival month.',
  },
  ai: {
    k: 'AI employee for this solution',
    name: 'AI reservation assistant',
    job: 'Reservations team',
    text: 'Picks up new hotel reservations and Telegram and WhatsApp messages. It checks dates and room types, drafts formal replies to guests and agencies in Russian, Turkish or English, and builds a daily reservation report. Emails go out after your approval.',
    list: ['Checks dates and room', 'Drafts a reply to the guest', 'Builds the daily report'],
    hire: 'About AI employees',
  },
  faq: {
    k: 'FAQ',
    t: 'Answers to common questions',
    note: 'Didn’t find the answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Pacing and analytics',
        items: [
          { q: 'What is pacing and why does it matter?', a: 'It compares how many rooms are already sold for an arrival date with how many should have been sold by now. Lumiva checks the pace at 90, 60, 30, 14 and 7 days before arrival and on the arrival day, and shows the gap in percent and how many rooms a day you need to sell to catch up.' },
          { q: 'Can I set my own pacing targets?', a: 'Yes. The target percentage at each checkpoint is set per hotel. Defaults: 10% at 90 days, 40% at 60, 65% at 30, 80% at 14, 92% at 7 and 100% on arrival day.' },
          { q: 'What else does analytics show?', a: 'Key metrics and today’s occupancy, a revenue funnel to the season target (paid, awaiting payment, left to sell), breakdowns by room type with ADR, by market, agency and guests, and arrivals with a monthly risk heatmap.' },
          { q: 'Will I get notified if a room type sells badly?', a: 'There’s no separate under-occupancy notice — pacing and the risk heatmap in analytics show it. The automatic “low availability” notice works the other way round, firing when a room type is filled above the hotel threshold for the month.' },
        ],
      },
      {
        g: 'Rates and reservations',
        items: [
          { q: 'How do prices work?', a: 'There’s a room-type base price, prices per market, daily rates per market group (budget, average, gross, discount, net), occupancy-type coefficients and specific dates with their own price, discount, minimum nights or closure. The price fills in automatically when a reservation is created.' },
          { q: 'Can I upload a tour operator price list from Excel?', a: 'Yes. Price lists, room prices, reservations and hotel information are imported from files: preview first, then upload.' },
          { q: 'How are payments tracked?', a: 'A reservation’s payment status is full, partial, none or refunded. It stores the deposit and a list of payments with date, amount and method, and the guest folio exports to PDF.' },
          { q: 'Does it sync with Booking.com and other channels?', a: 'No, there is no channel manager. Booking.com and other platforms are handled as agencies: the reservation keeps its source, and prices can be set per agency and market. Partners get a room and rate feed in XML and JSON via a secret link.' },
        ],
      },
      {
        g: 'Operations',
        items: [
          { q: 'Is there a front desk view?', a: 'Yes. The “today” screen shows arrivals, departures and the number of in-house guests. At check-in the reservation gets a specific room, and housekeeping status is changed right from the desk.' },
          { q: 'Can I run several hotels?', a: 'Yes. Each hotel has its own currency, check-in and check-out times, season revenue target, risk thresholds and overbooking setting. Analytics can show one hotel or all of them.' },
          { q: 'Can I take reservations from the hotel website?', a: 'There’s a public API: hotel list, availability search for dates, reservation creation and a guest lookup by code and email. Online payment through it currently works in test mode only.' },
        ],
      },
      {
        g: 'Getting started',
        items: [
          { q: 'How do I move existing reservations?', a: 'Through Excel import with preview and column mapping. Price lists and hotel information load the same way.' },
          { q: 'How much does it cost?', a: 'Hotels/PMS is available on every plan from Standard up. The AI reservation assistant needs the Professional plan. The 14-day trial includes every module, no card required.' },
        ],
      },
    ],
  },
  more: { k: 'Other solutions', t: 'Lumiva covers the whole business.' },
  cta: { k: '14 days free', t: 'See the gap to your season plan while you can still close it.' },
};

const tr: HotelText = {
  crumbs: ['Çözümler', 'Otel/PMS'],
  kicker: 'Çözüm · Otel/PMS',
  t1: 'Plandan geride kaldığınızı',
  t2: 'girişten aylar önce görün.',
  sub: 'Giriş tarihine göre pacing, oda tipi ve aya göre doluluk, pazar ve acenteye göre fiyatlar, resepsiyon ve misafir folyosu — tek sistemde. Hedef hıza göre geride kalma, fiyatı değiştirmek veya doğru pazarlarda satışı açmak için hâlâ zaman varken görünür.',
  tryFree: '14 gün deneyin',
  demo: 'Demo isteyin',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '6', l: 'pacing kontrol noktası, girişten 90 gün önceden' },
    { v: '5', l: 'rezervasyon durumu — beklemeden çıkışa' },
    { v: '4', l: 'her oda için kat hizmetleri durumu' },
    { v: '3', l: 'arayüz dili: Türkçe, İngilizce, Rusça' },
  ],
  pace: { t: 'Pacing · sezon', target: 'Hedef', actual: 'Gerçek', days: 'gün kala', gap: 'geride', behind: 'Daha hızlı satılmalı' },
  how: {
    k: 'Nasıl çalışır',
    t: 'Fiyattan misafir çıkışına — tek süreç.',
    d: 'Fiyatlar ve satış durdurmalar tarihe, pazara ve acenteye göre belirlenir. Rezervasyonlar manuel, Excel’den veya API ile gelir; fiyat pazar ve konaklama tipine göre kendiliğinden dolar. Girişte misafir odasını, çıkışta PDF folyosunu alır; analitik bunun sezon planını nasıl etkilediğini hemen gösterir.',
    ai: 'YZ rezervasyon asistanı',
    doing: ['Talepteki tarihleri ve oda tipini kontrol eder', 'Misafirin dilinde yanıt hazırlar', 'Günlük rezervasyon raporunu toplar'],
    flow: [
      ['Fiyat', 'Pazar, acente, tarihler'],
      ['Rezervasyon', 'Manuel, Excel veya API'],
      ['Giriş', 'Oda, misafirler, ödeme'],
      ['Analitik', 'Pacing ve sezon planı'],
    ],
  },
  heat: {
    t: 'Oda tipine göre doluluk',
    months: ['May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki'],
    rooms: ['Standard Twin', 'Standard Double', 'Deluxe Sea View', 'Junior Suite', 'Family Room'],
    legend: ['%45 altı — risk', '%45–65 — dikkat', '%65 üstü'],
  },
  prob: {
    k: 'Sorun',
    t: 'Toplam doluluk, sorunu düzeltmek için çok geç olduğunda gösterir.',
    d: 'Bir oda tipi tüm sezon plandan yavaş satılır, ama genel rapor bunu diğer odaların iyi rakamlarının arkasına saklar. Girişe bir hafta kala fark edilir ve satışları artıracak bir şey kalmamıştır. Lumiva gerçekleşeni girişten önceki her kontrol noktasında hedef hızla karşılaştırır ve her oda tipi ile ayın doluluğunu ayrı gösterir.',
  },
  feats: {
    k: 'Özellikler',
    t: 'Rezervasyon ekibinin ihtiyacı olan her şey.',
    d: 'Tek sistemde birden fazla otel — her biri kendi para birimi, giriş-çıkış saatleri, sezon hedefi ve risk eşikleriyle.',
    items: [
      { t: 'Oda envanteri', d: 'Adet, baz fiyat, olanaklar ve fotoğraflarla oda tipleri. Tüm tip veya belirli tarihler için satış durdurma.', ic: 'grid' },
      { t: 'Fiziksel odalar', d: 'Oda numaraları ve kat hizmetleri durumu: temiz, kirli, kontrol edildi, hizmet dışı. Misafir girişte belirli bir oda alır.', ic: 'box' },
      { t: 'Giriş tarihine göre pacing', d: 'Gerçekleşen satış 90, 60, 30, 14, 7 gün kala ve giriş günündeki hedef hızla karşılaştırılır. Hedefler otel bazında belirlenir.', ic: 'chart' },
      { t: 'Aylara göre risk', d: 'Eşiklerinizle oda tipi ve aya göre doluluk ısı haritası — satışların nerede geride kaldığı görünür.', ic: 'target' },
      { t: 'Rezervasyonlar ve ödemeler', d: 'Pazar, acente, gecelik ve kişi başı fiyat, indirim, depozito, yönteme göre ödemeler, erken giriş ve geç çıkış.', ic: 'leads' },
      { t: 'Misafirler', d: 'Rezervasyondaki misafir listesi: uyruk, pasaport, geçerlilik tarihi, yaş — kayıt ve raporlar için.', ic: 'users' },
    ],
  },
  tbl: {
    k: 'Oda tipleri',
    t: 'Her oda tipi için doluluk ve ortalama fiyat.',
    d: 'Otelin toplam doluluğu belirli odalarda olanları gizler. Analitik her oda tipini ayrı gösterir: satılan oda, doluluk ve ortalama gecelik fiyat (ADR).',
    head: ['Oda tipi', 'Oda', 'Satılan', 'Doluluk', 'ADR'],
    occ: 3,
    rows: [
      ['Standard Twin|2 yetişkin', '30', '26', '87', '€82'],
      ['Standard Double|2 yetişkin', '20', '17', '85', '€88'],
      ['Deluxe Sea View|2+1', '15', '10', '67', '€132'],
      ['Junior Suite|2+2', '10', '4', '40', '€210'],
      ['Family Room|2+2', '6', '5', '83', '€168'],
    ],
    note: 'Demo verilerle örnek.',
  },
  rates: {
    k: 'Fiyatlar',
    t: 'Pazara, acenteye ve tarihe göre fiyatlar — elle yeniden hesaplama yok.',
    d: 'Fiyat modeli otellerin tur operatörleriyle çalışma biçimini izler: dönemler, pazarlar, pazar grupları ve kişi başı fiyatlar.',
    items: [
      { t: 'Dönemler ve günlük fiyatlar', d: 'Pazar grubuna göre her gün için fiyat: budget, ortalama ve kişi başı gross, indirim ve net.', ic: 'cal' },
      { t: 'Pazarlar ve acenteler', d: 'Pazara göre oda fiyatı, gruplanan pazarlar; her rezervasyonda pazar ve acente saklanır.', ic: 'target' },
      { t: 'Konaklama tipleri', d: 'Tek ve çift kişilik konaklama ile ücretli çocuklar için katsayılar — fiyat bazdan hesaplanır.', ic: 'users' },
      { t: 'Belirli tarihler', d: 'Belirli bir tarih için: kendi fiyatı, indirimi, minimum gece veya kapalı satış.', ic: 'filter' },
      { t: 'Otomatik fiyat', d: 'Rezervasyon oluşturulurken gecelik fiyat oda tipi, pazar ve tarihlere göre kendiliğinden dolar.', ic: 'bolt' },
      { t: 'Excel’den içe aktarma', d: 'Fiyat listeleri, oda fiyatları, rezervasyonlar ve otel bilgileri önizlemeyle dosyadan yüklenir.', ic: 'log' },
    ],
  },
  desk: {
    k: 'Resepsiyon',
    t: 'Otelin günü tek ekranda.',
    d: 'Bugünkü girişler, çıkışlar ve oteldeki misafirler — rezervasyon listesinde arama yapmadan.',
    items: [
      { t: 'Girişler ve çıkışlar', d: 'Bugün kim geliyor, kim ayrılıyor ve şu an otelde kaç misafir var.', ic: 'clock' },
      { t: 'Girişte oda', d: 'Girişte doğru tipte bir oda seçilir — bu tarihlerde başka bir rezervasyonla dolu oda seçilemez.', ic: 'box' },
      { t: 'PDF folyo', d: 'Konaklama ve ödemeleri içeren misafir faturası tek tıkla oluşturulur.', ic: 'log' },
      { t: 'Kat hizmetleri', d: 'Her odanın durumu resepsiyondan güncellenir: temiz, kirli, kontrol edildi, hizmet dışı.', ic: 'check' },
    ],
  },
  feed: {
    k: 'Otomasyonlar',
    t: 'Otel olayları eylemleri kendiliğinden başlatır.',
    d: 'Yeni rezervasyon, durum değişikliği, fiyat değişikliği, satış durdurma ve bir oda tipinin yüksek doluluğu — her olayda e-posta, Telegram mesajı veya CRM bildirimi gönderilebilir. Metinlerde değişkenler kullanılabilir: misafir, oda tipi, tarihler.',
    rows: [
      ['bugün 11:40', 'Az yer · Standard Twin, temmuz — %65 eşiğe karşı %87 dolu', 'az yer', false],
      ['bugün 09:15', 'Yeni rezervasyon · Deluxe Sea View, acente, pazar DE', 'yeni', true],
      ['dün 17:30', 'Fiyat değişti · Standard Twin, pazar grubu EU', 'fiyat', true],
      ['dün 14:02', 'Satış durduruldu · Family Room, 12–15 temmuz', 'stop', false],
      ['2 gün önce', 'Durum: giriş yaptı · rezervasyon #4482', 'giriş', true],
    ],
    note: 'Demo verilerle örnek. “Az yer” bildirimi, bir oda tipi giriş ayı için otel eşiğinin üzerinde dolduğunda gelir.',
  },
  ai: {
    k: 'Bu çözüm için YZ çalışanı',
    name: 'YZ rezervasyon asistanı',
    job: 'Rezervasyon ekibi',
    text: 'Yeni otel rezervasyonlarını ve Telegram ile WhatsApp mesajlarını takip eder. Tarihleri ve oda tiplerini kontrol eder, misafirlere ve acentelere Türkçe, Rusça veya İngilizce resmi yanıtlar hazırlar ve günlük rezervasyon raporu oluşturur. E-postalar onayınızdan sonra gider.',
    list: ['Tarihleri ve odayı kontrol eder', 'Misafire yanıt hazırlar', 'Günlük raporu toplar'],
    hire: 'YZ çalışanları hakkında',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Pacing ve analitik',
        items: [
          { q: 'Pacing nedir ve neden gerekli?', a: 'Bir giriş tarihi için şu ana kadar satılan oda sayısını, bu noktada satılmış olması gereken sayıyla karşılaştırır. Lumiva hızı girişe 90, 60, 30, 14 ve 7 gün kala ve giriş gününde kontrol eder; geride kalmayı yüzde olarak ve planı yakalamak için günde kaç oda satılması gerektiğini gösterir.' },
          { q: 'Kendi pacing hedeflerimi belirleyebilir miyim?', a: 'Evet. Her kontrol noktasındaki hedef yüzde otel bazında belirlenir. Varsayılanlar: 90 günde %10, 60’ta %40, 30’da %65, 14’te %80, 7’de %92 ve giriş gününde %100.' },
          { q: 'Analitik başka neler gösterir?', a: 'Temel göstergeler ve bugünkü doluluk, sezon hedefine gelir hunisi (ödenen, ödeme bekleyen, satılacak kalan), ADR ile oda tipi, pazar, acente ve misafir kırılımları ile aylık risk ısı haritalı girişler.' },
          { q: 'Bir oda tipi kötü satılırsa bildirim gelir mi?', a: 'Ayrı bir düşük doluluk bildirimi yok — bunu analitikteki pacing ve risk ısı haritası gösterir. Otomatik “az yer” bildirimi ise tersine, bir oda tipi ay için otel eşiğinin üzerinde dolduğunda gelir.' },
        ],
      },
      {
        g: 'Fiyatlar ve rezervasyonlar',
        items: [
          { q: 'Fiyatlar nasıl çalışır?', a: 'Oda tipinin baz fiyatı, pazara göre fiyatlar, pazar gruplarına göre günlük fiyatlar (budget, ortalama, gross, indirim, net), konaklama tipi katsayıları ve kendi fiyatı, indirimi, minimum gecesi veya kapanışı olan belirli tarihler vardır. Rezervasyon oluşturulurken fiyat otomatik dolar.' },
          { q: 'Tur operatörü fiyat listesini Excel’den yükleyebilir miyim?', a: 'Evet. Fiyat listeleri, oda fiyatları, rezervasyonlar ve otel bilgileri dosyadan içe aktarılır: önce önizleme, sonra yükleme.' },
          { q: 'Ödemeler nasıl takip edilir?', a: 'Rezervasyonun ödeme durumu tam, kısmi, ödenmedi veya iade şeklindedir. Depozito ve tarih, tutar ve yöntemle ödeme listesi saklanır; misafir folyosu PDF olarak alınır.' },
          { q: 'Booking.com ve diğer kanallarla senkronize olur mu?', a: 'Hayır, kanal yöneticisi bağlı değil. Booking.com ve diğer platformlar acente olarak yönetilir: rezervasyonun kaynağı saklanır, fiyatlar acente ve pazara göre belirlenebilir. Ortaklar için gizli bağlantıyla XML ve JSON oda-fiyat beslemesi vardır.' },
        ],
      },
      {
        g: 'Operasyon',
        items: [
          { q: 'Resepsiyon ekranı var mı?', a: 'Evet. “Bugün” ekranı girişleri, çıkışları ve oteldeki misafir sayısını gösterir. Girişte rezervasyon belirli bir oda alır, kat hizmetleri durumu doğrudan resepsiyondan değiştirilir.' },
          { q: 'Birden fazla otel yönetebilir miyim?', a: 'Evet. Her otelin kendi para birimi, giriş-çıkış saatleri, sezon gelir hedefi, risk eşikleri ve overbooking ayarı vardır. Analitik tek bir oteli veya hepsini gösterebilir.' },
          { q: 'Otel sitesinden rezervasyon alabilir miyim?', a: 'Herkese açık bir API var: otel listesi, tarihlere göre müsaitlik arama, rezervasyon oluşturma ve misafirin kod ile e-postayla rezervasyon sorgulaması. Bunun üzerinden çevrimiçi ödeme şu an yalnızca test modunda çalışır.' },
        ],
      },
      {
        g: 'Başlangıç',
        items: [
          { q: 'Mevcut rezervasyonları nasıl taşırım?', a: 'Önizleme ve sütun eşleştirmeli Excel içe aktarmayla. Fiyat listeleri ve otel bilgileri de aynı şekilde yüklenir.' },
          { q: 'Ücreti nedir?', a: 'Otel/PMS, Standard’dan itibaren tüm paketlerde mevcuttur. YZ rezervasyon asistanı Professional paketi gerektirir. 14 günlük deneme tüm modülleri içerir, kart gerekmez.' },
        ],
      },
    ],
  },
  more: { k: 'Diğer çözümler', t: 'Lumiva tüm işi kapsar.' },
  cta: { k: '14 gün ücretsiz', t: 'Sezon planındaki açığı hâlâ kapatabilecekken görün.' },
};

export const HOTEL_T: Record<'ru' | 'en' | 'tr', HotelText> = { ru, en, tr };
