/**
 * «Решения · Бронирования» (solution-v2.html, ключ booking). Проверено по backend/src/bookings:
 * проекты с типом бизнеса/поясом/валютой и правилами (мин. время до записи, горизонт, шаг слота, буфер,
 * дедлайны отмены/переноса, овербукинг), локации с часами и «особыми датами», услуги (длительность/цена),
 * ресурсы (тип/кол-во/вместимость/услуги/график), графики и отгулы сотрудников + проверка конфликтов,
 * 10 статусов брони, 7 статусов оплаты, 8 источников, журнал брони (создание/статус/перенос/сотрудник/ресурс/
 * уведомление/заметка), связь с лидом и контактом, лист ожидания с приоритетом (слот предлагают вручную →
 * перевод в бронь), импорт броней из файла, API-приём с токеном, ИИ-консультант записывает из WhatsApp/
 * Telegram/чата сайта, автоматизации на создание/перенос/смену статуса/запись в лист ожидания, аналитика.
 * Макет врал: «отмена автоматически предлагается листу ожидания», «напоминание за день и за час»,
 * «−38% неявок», «82% загрузка», «перенос за наш счёт» — убрано.
 */
import type { SolQA, SolCard } from './solutionKit';
import type { SolFeedT, SolTblT } from './solutionExtras';

export type BookingText = {
  crumbs: [string, string];
  kicker: string;
  t1: string;
  t2: string;
  sub: string;
  tryFree: string;
  demo: string;
  demoNote: string;
  stats: Array<{ v: string; l: string }>;
  how: { k: string; t: string; d: string; ai: string; doing: string[]; flow: Array<[string, string]> };
  vis: { day: string; staff: string[]; svc: string[]; free: string; incoming: string; check: string; ok: string; busy: string; demo: string };
  prob: { k: string; t: string; d: string };
  feats: { k: string; t: string; d: string; items: SolCard[] };
  tbl: SolTblT;
  rules: { k: string; t: string; d: string; items: SolCard[] };
  anal: { k: string; t: string; d: string; items: SolCard[] };
  feed: SolFeedT;
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: SolQA[] }> };
  more: { k: string; t: string };
  cta: { k: string; t: string };
};

const ru: BookingText = {
  crumbs: ['Решения', 'Бронирования'],
  kicker: 'Решение · Бронирования',
  t1: 'Расписание, в котором',
  t2: 'нет двойных записей.',
  sub: 'Услуги, сотрудники, кабинеты и оборудование — в одном каталоге. Lumiva проверяет график, отгулы, буферы и занятость ресурсов до того, как запись сохранится, а ИИ-консультант записывает клиентов прямо из WhatsApp, Telegram и чата на сайте.',
  tryFree: 'Попробовать 14 дней',
  demo: 'Запросить демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '10', l: 'статусов записи — от черновика до неявки' },
    { v: '8', l: 'источников брони: сайт, звонок, мессенджеры, импорт' },
    { v: '7', l: 'правил записи на каждый проект' },
    { v: '3', l: 'канала, где ИИ записывает клиента сам' },
  ],
  how: {
    k: 'Как это работает',
    t: 'Запись проходит проверку, прежде чем попасть в расписание.',
    d: 'Неважно, кто создаёт бронь — администратор, ИИ-консультант или внешний сайт через API. Перед сохранением система сверяет часы работы локации, график и отгулы сотрудника, уже занятые записи с буферами, свободные ресурсы и правила проекта.',
    ai: 'ИИ-консультант',
    doing: ['Считает свободные слоты мастера', 'Уточняет услугу и время у клиента', 'Создаёт бронь и привязывает лид'],
    flow: [
      ['Запись', 'Сайт, мессенджер, звонок'],
      ['Проверка', 'График, ресурс, буфер'],
      ['Подтверждение', 'Вручную или сразу'],
      ['Визит', 'Пришёл, завершена, неявка'],
    ],
  },
  vis: {
    day: 'Вторник · расписание',
    staff: ['Мария', 'Лена', 'Павел'],
    svc: ['Стрижка', 'Маникюр', 'Окрашивание', 'Массаж', 'Педикюр', 'Укладка'],
    free: 'свободно',
    incoming: 'WhatsApp · «Можно к Лене завтра в 14?»',
    check: 'Проверка: график · отгулы · буфер 10 мин · кабинет',
    ok: 'Бронь создана · лид привязан',
    busy: '14:00 занято — предложено 15:00',
    demo: 'Пример на демо-данных',
  },
  prob: {
    k: 'Задача',
    t: 'Расписание в таблице не знает, что мастер в отпуске, а кабинет уже занят.',
    d: 'Записи принимают администратор, мессенджеры и сайт — и каждый видит свою часть картины. Отсюда двойные записи на одно время, клиенты, записанные к сотруднику в его выходной, и отмены, о которых никто не узнал вовремя. Lumiva держит всё в одном расписании и не даёт сохранить запись, которая с ним конфликтует.',
  },
  feats: {
    k: 'Возможности',
    t: 'Всё, что нужно для записи клиентов.',
    d: 'Один модуль подходит салону, клинике, студии, ресторану или консультациям — тип бизнеса задаётся в проекте.',
    items: [
      { t: 'Каталог услуг', d: 'Длительность, цена и привязка к сотрудникам и ресурсам. Из каталога строятся слоты для записи.', ic: 'grid' },
      { t: 'Локации и часы работы', d: 'Несколько филиалов со своим часовым поясом, графиком и «особыми датами» — праздниками и сокращёнными днями.', ic: 'target' },
      { t: 'Графики сотрудников', d: 'Недельная доступность, отгулы и отпуска. При отгуле записи сотрудника можно переназначить на коллегу.', ic: 'users' },
      { t: 'Ресурсы', d: 'Кабинеты, кресла, оборудование — с количеством, вместимостью и своим графиком. Один ресурс не уйдёт в две записи сразу.', ic: 'box' },
      { t: 'Лист ожидания', d: 'Клиенты, которым не хватило места, стоят в очереди с приоритетом. Освободился слот — предложите его и переведите заявку в бронь в один клик.', ic: 'bell' },
      { t: 'Связь с CRM', d: 'Каждая бронь находит или создаёт контакт и лид, а в карточке лида видна вся история записей клиента.', ic: 'leads' },
    ],
  },
  tbl: {
    k: 'Записи',
    t: 'Статус визита и статус оплаты — отдельно.',
    d: 'У каждой брони свой жизненный цикл визита и своя оплата: депозит, полная оплата, частичный возврат. В списке видно, кто пришёл, кто не явился и где деньги ещё не получены.',
    head: ['Клиент', 'Время', 'Сотрудник', 'Статус', 'Оплата'],
    rows: [
      ['Анна К.|Стрижка + укладка', '10:00', 'Мария', 'ok:Подтверждена', 'ok:Оплачено'],
      ['Ольга П.|Маникюр', '11:30', 'Лена', 'ok:Подтверждена', 'warn:Депозит'],
      ['Ирина С.|Окрашивание', '13:00', 'Мария', 'warn:Ожидает', 'bad:Не оплачено'],
      ['Дмитрий В.|Стрижка мужская', '13:30', 'Лена', 'info:Пришёл', 'ok:Оплачено'],
      ['Светлана О.|Массаж 60 мин', '15:00', 'Павел', 'bad:Не явился', 'bad:Не оплачено'],
      ['Екатерина Б.|Педикюр', '16:00', 'Лена', 'ok:Завершена', 'ok:Оплачено'],
    ],
    note: 'Пример на демо-данных. Статусы: черновик, ожидает, подтверждена, пришёл, в процессе, завершена, отменена клиентом или компанией, отклонена, не явился.',
  },
  rules: {
    k: 'Правила записи',
    t: 'Вы решаете, как и когда клиенты могут записываться.',
    d: 'Правила задаются на уровне проекта и одинаково работают для администратора, ИИ-консультанта и API.',
    items: [
      { t: 'Минимум до визита', d: 'Нельзя записаться «через пять минут» — задайте, за сколько минут до начала закрывается запись.', ic: 'clock' },
      { t: 'Горизонт записи', d: 'На сколько дней вперёд открыто расписание: неделя, месяц или квартал.', ic: 'cal' },
      { t: 'Шаг слота и буфер', d: 'Сетка записи (например, каждые 15 минут) и пауза между визитами на уборку или подготовку.', ic: 'grid' },
      { t: 'Дедлайны отмены и переноса', d: 'Позже заданного срока клиент — и ИИ от его имени — не сможет отменить или перенести запись.', ic: 'shield' },
      { t: 'Подтверждение', d: 'Брони подтверждаются администратором вручную или сразу автоматически.', ic: 'check' },
      { t: 'Овербукинг', d: 'Включается осознанно — для бизнесов, где допускается запись сверх вместимости.', ic: 'filter' },
    ],
  },
  anal: {
    k: 'Аналитика',
    t: 'Где расписание зарабатывает, а где простаивает.',
    d: 'Отчёты по броням за выбранный период, с выручкой в одной валюте по ежедневному курсу.',
    items: [
      { t: 'Загрузка', d: 'Доля занятого времени от рабочего — по всей сети и по каждому филиалу.', ic: 'chart' },
      { t: 'Теплокарта', d: 'Какие дни недели и часы забиты, а какие пустуют — видно, когда запускать акции.', ic: 'grid' },
      { t: 'Загрузка сотрудников', d: 'Сколько записей и часов у каждого сотрудника — для графиков и мотивации.', ic: 'users' },
      { t: 'Топ услуг', d: 'Какие услуги приносят больше записей и выручки.', ic: 'target' },
      { t: 'Источники', d: 'Откуда приходят брони: сайт, звонок, WhatsApp, Telegram, API, импорт.', ic: 'funnel' },
      { t: 'Клиенты под риском', d: 'Постоянные клиенты, которые не записывались больше 60 дней, — кого стоит позвать обратно.', ic: 'bell' },
    ],
  },
  feed: {
    k: 'Журнал брони',
    t: 'У каждой записи — своя история.',
    d: 'Создание, смена статуса, перенос, смена сотрудника или ресурса, отправленные уведомления и заметки сохраняются с автором и временем. Если клиент спорит, когда и с кем был записан, ответ в карточке брони.',
    rows: [
      ['сегодня 09:14', 'Бронь создана ИИ-консультантом · WhatsApp, Анна К., 10:00', 'создана', true],
      ['сегодня 08:50', 'Статус: отменена клиентом · Светлана О., 15:00', 'отмена', false],
      ['вчера 18:20', 'Перенос · Ирина С., 12:00 → 13:00', 'перенос', true],
      ['вчера 17:02', 'Сотрудник изменён · Мария → Лена', 'сотрудник', true],
      ['вчера 16:05', 'Статус: завершена · Екатерина Б.', 'готово', true],
    ],
    note: 'Пример на демо-данных.',
  },
  ai: {
    k: 'ИИ-сотрудник для этого решения',
    name: 'ИИ-консультант',
    job: 'Запись из чатов',
    text: 'Отвечает клиентам в WhatsApp, Telegram и онлайн-чате сайта и записывает их сам, если включить это в настройках. Свободное время считает только по реальному расписанию, а перед созданием брони переспрашивает клиента и получает подтверждение. Отменить или перенести можно только запись этого же клиента и только в пределах дедлайнов проекта.',
    list: ['Подбирает свободный слот', 'Подтверждает время с клиентом', 'Создаёт бронь в расписании'],
    hire: 'Об ИИ-сотрудниках',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Расписание и записи',
        items: [
          { q: 'Как система не допускает двойных записей?', a: 'Перед сохранением брони проверяются часы работы локации и особые даты, график и отгулы сотрудника, уже занятые записи с учётом буфера и занятость ресурса. Если слот конфликтует, запись не сохранится — если в проекте не включён овербукинг.' },
          { q: 'Подходит ли модуль не только салонам?', a: 'Да. Тип бизнеса задаётся в проекте: салон, клиника, студия, ресторан, консультации. Модель данных одна — услуги, сотрудники и ресурсы, — поэтому настраивается под любой бизнес с записью на время.' },
          { q: 'Можно ли вести несколько филиалов?', a: 'Да. У каждой локации свой адрес, часовой пояс, часы работы и особые даты, а аналитика показывает загрузку и по сети, и по филиалам.' },
          { q: 'Что будет с записями, если сотрудник заболел?', a: 'Отметьте отгул в его графике — новые записи на эти дни не пройдут проверку. Уже созданные брони можно переназначить на другого сотрудника, и это попадёт в журнал брони.' },
        ],
      },
      {
        g: 'Клиенты и каналы',
        items: [
          { q: 'Откуда приходят брони?', a: 'Их создаёт администратор вручную, ИИ-консультант из WhatsApp, Telegram и чата на сайте, внешний сайт или форма через API с токеном, а также импорт из файла. У каждой брони сохраняется источник.' },
          { q: 'Есть ли готовый виджет записи для сайта?', a: 'Готового встраиваемого виджета пока нет. Записи с сайта принимаются через API — запрос с токеном из настроек модуля — или через ИИ-консультанта в онлайн-чате, который ставится на сайт одной строкой кода.' },
          { q: 'Связываются ли брони с лидами?', a: 'Да. Бронь находит существующий контакт и лид по телефону или email или создаёт новые. В карточке лида видна вся история записей клиента.' },
          { q: 'Как работает лист ожидания?', a: 'Клиент встаёт в очередь с приоритетом и желаемым временем. Когда освобождается подходящий слот, администратор предлагает его и одним действием переводит заявку в бронь. Автоматически слот листу ожидания не предлагается.' },
        ],
      },
      {
        g: 'Уведомления и оплата',
        items: [
          { q: 'Как клиент и сотрудники узнают о записи?', a: 'Через автоматизации: на создание брони, перенос, смену статуса и новую заявку в листе ожидания можно отправить email, сообщение в Telegram или уведомление в CRM. В тексте доступны переменные — имя клиента, услуга, дата, сотрудник. Уведомление сотрудникам о новой брони создаётся автоматически.' },
          { q: 'Будет ли напоминание клиенту за день до визита?', a: 'Отдельного напоминания «за N часов до визита» сейчас нет. Автоматизации срабатывают на события брони и могут выполняться с паузой между шагами, но не отсчитывают время от начала визита.' },
          { q: 'Как учитывается оплата?', a: 'У брони отдельный статус оплаты: не требуется, не оплачено, депозит, оплачено, частичный возврат, возврат, ошибка. Выручка в аналитике пересчитывается в одну валюту по ежедневному курсу.' },
        ],
      },
      {
        g: 'Запуск',
        items: [
          { q: 'Можно ли перенести записи из другой системы?', a: 'Да. Брони импортируются из файла: сначала предпросмотр и сопоставление колонок, затем загрузка.' },
          { q: 'Кто видит и меняет брони?', a: 'Доступ к модулю регулируется ролями CRM. Модуль включается для компании отдельно — если он не нужен, он не мешает в меню.' },
          { q: 'Сколько стоит?', a: 'Бронирования доступны во всех тарифах, начиная со Standard. Запись ИИ-консультантом из WhatsApp, Telegram и онлайн-чата требует тарифа Professional, потому что эти каналы входят в него. 14 дней пробного периода — со всеми модулями, без карты.' },
        ],
      },
    ],
  },
  more: { k: 'Другие решения', t: 'Lumiva закрывает весь бизнес.' },
  cta: { k: '14 дней бесплатно', t: 'Соберите расписание без двойных записей уже на этой неделе.' },
};

const en: BookingText = {
  crumbs: ['Solutions', 'Bookings'],
  kicker: 'Solution · Bookings',
  t1: 'A schedule with',
  t2: 'no double bookings.',
  sub: 'Services, staff, rooms and equipment in one catalog. Lumiva checks schedules, time off, buffers and resource availability before a booking is saved, and the AI consultant books clients straight from WhatsApp, Telegram and your site chat.',
  tryFree: 'Try 14 days',
  demo: 'Request a demo',
  demoNote: 'Demo data example',
  stats: [
    { v: '10', l: 'booking statuses — from draft to no-show' },
    { v: '8', l: 'booking sources: site, phone, messengers, import' },
    { v: '7', l: 'booking rules per project' },
    { v: '3', l: 'channels where AI books clients itself' },
  ],
  how: {
    k: 'How it works',
    t: 'Every booking is checked before it lands in the schedule.',
    d: 'Whether it’s an admin, the AI consultant or an external site via the API, the system checks location hours, the staff member’s schedule and time off, existing bookings with buffers, free resources and the project rules before saving.',
    ai: 'AI consultant',
    doing: ['Finds the staff member’s free slots', 'Confirms service and time with the client', 'Creates the booking and links the lead'],
    flow: [
      ['Booking', 'Site, messenger, phone'],
      ['Check', 'Schedule, resource, buffer'],
      ['Confirmation', 'Manual or instant'],
      ['Visit', 'Checked in, done, no-show'],
    ],
  },
  vis: {
    day: 'Tuesday · schedule',
    staff: ['Maria', 'Lena', 'Pavel'],
    svc: ['Haircut', 'Manicure', 'Colour', 'Massage', 'Pedicure', 'Styling'],
    free: 'free',
    incoming: 'WhatsApp · “Can I see Lena tomorrow at 2?”',
    check: 'Check: schedule · time off · 10-min buffer · room',
    ok: 'Booking created · lead linked',
    busy: '2:00 taken — 3:00 offered',
    demo: 'Demo data example',
  },
  prob: {
    k: 'The problem',
    t: 'A spreadsheet schedule doesn’t know the stylist is on leave or the room is taken.',
    d: 'Bookings come from the front desk, messengers and the website, and each sees only part of the picture. That means double bookings, clients booked on a staff member’s day off and cancellations nobody notices in time. Lumiva keeps one schedule and won’t save a booking that conflicts with it.',
  },
  feats: {
    k: 'Capabilities',
    t: 'Everything you need to book clients.',
    d: 'One module fits a salon, clinic, studio, restaurant or consulting business — the business type is set per project.',
    items: [
      { t: 'Service catalog', d: 'Duration, price and links to staff and resources. Booking slots are built from the catalog.', ic: 'grid' },
      { t: 'Locations and hours', d: 'Several branches, each with its own time zone, hours and special dates — holidays and short days.', ic: 'target' },
      { t: 'Staff schedules', d: 'Weekly availability, time off and holidays. When someone is off, their bookings can be reassigned to a colleague.', ic: 'users' },
      { t: 'Resources', d: 'Rooms, chairs, equipment — with quantity, capacity and their own schedule. One resource never goes to two bookings at once.', ic: 'box' },
      { t: 'Waitlist', d: 'Clients who missed a slot wait in a prioritised queue. When a slot frees up, offer it and turn the request into a booking in one click.', ic: 'bell' },
      { t: 'Linked to the CRM', d: 'Every booking finds or creates a contact and a lead, and the lead card shows the client’s full booking history.', ic: 'leads' },
    ],
  },
  tbl: {
    k: 'Bookings',
    t: 'Visit status and payment status — kept separate.',
    d: 'Each booking has its own visit lifecycle and its own payment: deposit, paid in full, partial refund. The list shows who came, who didn’t and where money is still outstanding.',
    head: ['Client', 'Time', 'Staff', 'Status', 'Payment'],
    rows: [
      ['Anna K.|Haircut + styling', '10:00', 'Maria', 'ok:Confirmed', 'ok:Paid'],
      ['Olga P.|Manicure', '11:30', 'Lena', 'ok:Confirmed', 'warn:Deposit'],
      ['Irina S.|Colour', '13:00', 'Maria', 'warn:Pending', 'bad:Unpaid'],
      ['Dmitry V.|Men’s haircut', '13:30', 'Lena', 'info:Checked in', 'ok:Paid'],
      ['Svetlana O.|60-min massage', '15:00', 'Pavel', 'bad:No-show', 'bad:Unpaid'],
      ['Ekaterina B.|Pedicure', '16:00', 'Lena', 'ok:Completed', 'ok:Paid'],
    ],
    note: 'Demo data example. Statuses: draft, pending, confirmed, checked in, in progress, completed, cancelled by client or business, rejected, no-show.',
  },
  rules: {
    k: 'Booking rules',
    t: 'You decide how and when clients can book.',
    d: 'Rules are set per project and apply equally to admins, the AI consultant and the API.',
    items: [
      { t: 'Minimum notice', d: 'No “in five minutes” bookings — set how many minutes before the start booking closes.', ic: 'clock' },
      { t: 'Booking horizon', d: 'How many days ahead the schedule is open: a week, a month or a quarter.', ic: 'cal' },
      { t: 'Slot step and buffer', d: 'The booking grid (e.g. every 15 minutes) and a pause between visits for cleaning or prep.', ic: 'grid' },
      { t: 'Cancel and reschedule deadlines', d: 'After the set deadline the client — and the AI on their behalf — can’t cancel or move the booking.', ic: 'shield' },
      { t: 'Confirmation', d: 'Bookings are confirmed manually by an admin or instantly and automatically.', ic: 'check' },
      { t: 'Overbooking', d: 'Turned on deliberately — for businesses where booking above capacity is allowed.', ic: 'filter' },
    ],
  },
  anal: {
    k: 'Analytics',
    t: 'Where the schedule earns and where it sits idle.',
    d: 'Booking reports for the chosen period, with revenue in one currency at the daily rate.',
    items: [
      { t: 'Occupancy', d: 'Booked time as a share of working time — across the network and per branch.', ic: 'chart' },
      { t: 'Heatmap', d: 'Which weekdays and hours are packed and which are empty — so you know when to run promotions.', ic: 'grid' },
      { t: 'Staff utilisation', d: 'Bookings and hours per staff member — for scheduling and motivation.', ic: 'users' },
      { t: 'Top services', d: 'Which services bring the most bookings and revenue.', ic: 'target' },
      { t: 'Sources', d: 'Where bookings come from: site, phone, WhatsApp, Telegram, API, import.', ic: 'funnel' },
      { t: 'Clients at risk', d: 'Regular clients who haven’t booked for over 60 days — the ones worth inviting back.', ic: 'bell' },
    ],
  },
  feed: {
    k: 'Booking log',
    t: 'Every booking has its own history.',
    d: 'Creation, status changes, rescheduling, staff or resource changes, notifications sent and notes are stored with author and time. If a client disputes when and with whom they were booked, the answer is in the booking card.',
    rows: [
      ['today 09:14', 'Booking created by AI consultant · WhatsApp, Anna K., 10:00', 'created', true],
      ['today 08:50', 'Status: cancelled by client · Svetlana O., 15:00', 'cancelled', false],
      ['yesterday 18:20', 'Rescheduled · Irina S., 12:00 → 13:00', 'moved', true],
      ['yesterday 17:02', 'Staff changed · Maria → Lena', 'staff', true],
      ['yesterday 16:05', 'Status: completed · Ekaterina B.', 'done', true],
    ],
    note: 'Demo data example.',
  },
  ai: {
    k: 'AI employee for this solution',
    name: 'AI consultant',
    job: 'Booking from chats',
    text: 'Replies to clients in WhatsApp, Telegram and your site’s online chat and books them itself when this is enabled in settings. It counts free time only from the real schedule and asks the client to confirm before creating a booking. It can cancel or move only that same client’s booking, and only within the project deadlines.',
    list: ['Finds a free slot', 'Confirms the time with the client', 'Creates the booking in the schedule'],
    hire: 'About AI employees',
  },
  faq: {
    k: 'FAQ',
    t: 'Answers to common questions',
    note: 'Didn’t find the answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Schedule and bookings',
        items: [
          { q: 'How does the system prevent double bookings?', a: 'Before a booking is saved, it checks location hours and special dates, the staff member’s schedule and time off, existing bookings including buffers, and resource availability. If the slot conflicts, the booking won’t save — unless overbooking is enabled for the project.' },
          { q: 'Is it only for salons?', a: 'No. The business type is set per project: salon, clinic, studio, restaurant, consulting. The data model is the same — services, staff and resources — so it fits any business that books by time.' },
          { q: 'Can I run several branches?', a: 'Yes. Each location has its own address, time zone, hours and special dates, and analytics shows occupancy for the whole network and per branch.' },
          { q: 'What happens to bookings if a staff member is ill?', a: 'Mark time off in their schedule — new bookings for those days won’t pass the check. Existing bookings can be reassigned to another staff member, and that is recorded in the booking log.' },
        ],
      },
      {
        g: 'Clients and channels',
        items: [
          { q: 'Where do bookings come from?', a: 'An admin creates them manually, the AI consultant books from WhatsApp, Telegram and the site chat, an external site or form sends them via the API with a token, and they can be imported from a file. The source of every booking is stored.' },
          { q: 'Is there a ready-made booking widget for my site?', a: 'Not yet. Bookings from your site come in through the API — a request with a token from the module settings — or through the AI consultant in the online chat, which is added to a site with one line of code.' },
          { q: 'Are bookings linked to leads?', a: 'Yes. A booking finds an existing contact and lead by phone or email, or creates new ones. The lead card shows the client’s full booking history.' },
          { q: 'How does the waitlist work?', a: 'The client joins a prioritised queue with a preferred time. When a suitable slot frees up, an admin offers it and turns the request into a booking in one action. Slots are not offered to the waitlist automatically.' },
        ],
      },
      {
        g: 'Notifications and payment',
        items: [
          { q: 'How do the client and staff learn about a booking?', a: 'Through automations: on booking creation, rescheduling, status change and a new waitlist entry you can send an email, a Telegram message or a CRM notification. Templates support variables — client name, service, date, staff member. A staff notification for new bookings is set up automatically.' },
          { q: 'Will the client get a reminder the day before?', a: 'There is no “N hours before the visit” reminder at the moment. Automations fire on booking events and can wait between steps, but they don’t count time from the visit start.' },
          { q: 'How is payment tracked?', a: 'Each booking has its own payment status: not required, unpaid, deposit, paid, partially refunded, refunded, failed. Revenue in analytics is converted into one currency at the daily rate.' },
        ],
      },
      {
        g: 'Getting started',
        items: [
          { q: 'Can I move bookings from another system?', a: 'Yes. Bookings are imported from a file: preview and column mapping first, then the upload.' },
          { q: 'Who can see and change bookings?', a: 'Access to the module is controlled by CRM roles. The module is enabled per company — if you don’t need it, it stays out of the menu.' },
          { q: 'How much does it cost?', a: 'Bookings is available on every plan from Standard up. AI booking from WhatsApp, Telegram and the online chat needs the Professional plan, which includes those channels. The 14-day trial includes every module, no card required.' },
        ],
      },
    ],
  },
  more: { k: 'Other solutions', t: 'Lumiva covers the whole business.' },
  cta: { k: '14 days free', t: 'Build a schedule with no double bookings this week.' },
};

const tr: BookingText = {
  crumbs: ['Çözümler', 'Rezervasyonlar'],
  kicker: 'Çözüm · Rezervasyonlar',
  t1: 'Çifte randevunun',
  t2: 'olmadığı bir takvim.',
  sub: 'Hizmetler, personel, odalar ve ekipman tek katalogda. Lumiva, randevu kaydedilmeden önce çalışma planlarını, izinleri, tamponları ve kaynak müsaitliğini kontrol eder; yapay zekâ danışmanı ise müşterileri doğrudan WhatsApp, Telegram ve site sohbetinden randevuya alır.',
  tryFree: '14 gün deneyin',
  demo: 'Demo isteyin',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '10', l: 'randevu durumu — taslaktan gelmedi’ye kadar' },
    { v: '8', l: 'randevu kaynağı: site, telefon, mesajlaşma, içe aktarma' },
    { v: '7', l: 'proje başına randevu kuralı' },
    { v: '3', l: 'YZ’nin müşteriyi kendisinin kaydettiği kanal' },
  ],
  how: {
    k: 'Nasıl çalışır',
    t: 'Her randevu takvime girmeden önce kontrol edilir.',
    d: 'Randevuyu ister yönetici, ister yapay zekâ danışmanı, ister API üzerinden harici bir site oluştursun; sistem kaydetmeden önce şube çalışma saatlerini, personelin planını ve izinlerini, tamponlu mevcut randevuları, boş kaynakları ve proje kurallarını kontrol eder.',
    ai: 'YZ danışmanı',
    doing: ['Personelin boş saatlerini hesaplar', 'Hizmet ve saati müşteriyle netleştirir', 'Randevu oluşturur ve lead’e bağlar'],
    flow: [
      ['Randevu', 'Site, mesajlaşma, telefon'],
      ['Kontrol', 'Plan, kaynak, tampon'],
      ['Onay', 'Manuel veya anında'],
      ['Ziyaret', 'Geldi, tamamlandı, gelmedi'],
    ],
  },
  vis: {
    day: 'Salı · takvim',
    staff: ['Maria', 'Lena', 'Pavel'],
    svc: ['Saç kesimi', 'Manikür', 'Boya', 'Masaj', 'Pedikür', 'Fön'],
    free: 'boş',
    incoming: 'WhatsApp · “Yarın 14’te Lena’ya gelebilir miyim?”',
    check: 'Kontrol: plan · izin · 10 dk tampon · oda',
    ok: 'Randevu oluşturuldu · lead bağlandı',
    busy: '14:00 dolu — 15:00 önerildi',
    demo: 'Demo verilerle örnek',
  },
  prob: {
    k: 'Sorun',
    t: 'Tablodaki takvim, uzmanın izinde ya da odanın dolu olduğunu bilmez.',
    d: 'Randevular resepsiyondan, mesajlaşma uygulamalarından ve siteden gelir; her biri resmin yalnızca bir kısmını görür. Sonuç: aynı saate çifte randevu, personelin izin gününe yazılan müşteriler ve zamanında fark edilmeyen iptaller. Lumiva tek bir takvim tutar ve onunla çakışan randevunun kaydedilmesine izin vermez.',
  },
  feats: {
    k: 'Özellikler',
    t: 'Müşteri randevusu için gereken her şey.',
    d: 'Tek modül salon, klinik, stüdyo, restoran veya danışmanlık için uygundur — işletme türü projede belirlenir.',
    items: [
      { t: 'Hizmet kataloğu', d: 'Süre, fiyat ve personel ile kaynaklara bağlantı. Randevu aralıkları katalogdan oluşturulur.', ic: 'grid' },
      { t: 'Şubeler ve çalışma saatleri', d: 'Her biri kendi saat dilimi, çalışma saatleri ve özel günleriyle (tatiller, kısa günler) birden fazla şube.', ic: 'target' },
      { t: 'Personel planları', d: 'Haftalık müsaitlik, izinler ve tatiller. Biri izindeyken randevuları bir meslektaşa aktarılabilir.', ic: 'users' },
      { t: 'Kaynaklar', d: 'Odalar, koltuklar, ekipman — adet, kapasite ve kendi planıyla. Bir kaynak aynı anda iki randevuya gitmez.', ic: 'box' },
      { t: 'Bekleme listesi', d: 'Yer bulamayan müşteriler öncelikli sırada bekler. Bir saat boşalınca önerin ve talebi tek tıkla randevuya dönüştürün.', ic: 'bell' },
      { t: 'CRM ile bağlantı', d: 'Her randevu bir kişi ve lead bulur ya da oluşturur; lead kartında müşterinin tüm randevu geçmişi görünür.', ic: 'leads' },
    ],
  },
  tbl: {
    k: 'Randevular',
    t: 'Ziyaret durumu ve ödeme durumu — ayrı ayrı.',
    d: 'Her randevunun kendi ziyaret yaşam döngüsü ve kendi ödemesi vardır: kapora, tam ödeme, kısmi iade. Listede kimin geldiği, kimin gelmediği ve paranın nerede henüz alınmadığı görünür.',
    head: ['Müşteri', 'Saat', 'Personel', 'Durum', 'Ödeme'],
    rows: [
      ['Anna K.|Saç kesimi + fön', '10:00', 'Maria', 'ok:Onaylandı', 'ok:Ödendi'],
      ['Olga P.|Manikür', '11:30', 'Lena', 'ok:Onaylandı', 'warn:Kapora'],
      ['Irina S.|Boya', '13:00', 'Maria', 'warn:Bekliyor', 'bad:Ödenmedi'],
      ['Dmitry V.|Erkek saç kesimi', '13:30', 'Lena', 'info:Geldi', 'ok:Ödendi'],
      ['Svetlana O.|60 dk masaj', '15:00', 'Pavel', 'bad:Gelmedi', 'bad:Ödenmedi'],
      ['Ekaterina B.|Pedikür', '16:00', 'Lena', 'ok:Tamamlandı', 'ok:Ödendi'],
    ],
    note: 'Demo verilerle örnek. Durumlar: taslak, bekliyor, onaylandı, geldi, devam ediyor, tamamlandı, müşteri veya işletme tarafından iptal, reddedildi, gelmedi.',
  },
  rules: {
    k: 'Randevu kuralları',
    t: 'Müşterilerin nasıl ve ne zaman randevu alacağına siz karar verirsiniz.',
    d: 'Kurallar proje düzeyinde belirlenir ve yönetici, YZ danışmanı ve API için aynı şekilde çalışır.',
    items: [
      { t: 'Minimum süre', d: '“Beş dakika sonra” randevu yok — randevunun başlangıçtan kaç dakika önce kapanacağını belirleyin.', ic: 'clock' },
      { t: 'Randevu ufku', d: 'Takvimin kaç gün ileriye açık olduğu: bir hafta, bir ay veya bir çeyrek.', ic: 'cal' },
      { t: 'Aralık adımı ve tampon', d: 'Randevu ızgarası (ör. 15 dakikada bir) ve temizlik ya da hazırlık için ziyaretler arası mola.', ic: 'grid' },
      { t: 'İptal ve erteleme süreleri', d: 'Belirlenen süreden sonra müşteri — ve onun adına YZ — randevuyu iptal edemez veya taşıyamaz.', ic: 'shield' },
      { t: 'Onay', d: 'Randevular yönetici tarafından manuel ya da anında otomatik onaylanır.', ic: 'check' },
      { t: 'Overbooking', d: 'Bilinçli olarak açılır — kapasite üstü randevunun kabul edildiği işletmeler için.', ic: 'filter' },
    ],
  },
  anal: {
    k: 'Analitik',
    t: 'Takvim nerede kazandırıyor, nerede boş duruyor.',
    d: 'Seçilen döneme ait randevu raporları; gelir günlük kurla tek para biriminde.',
    items: [
      { t: 'Doluluk', d: 'Dolu zamanın çalışma süresine oranı — tüm ağda ve her şubede.', ic: 'chart' },
      { t: 'Isı haritası', d: 'Hangi gün ve saatlerin dolu, hangilerinin boş olduğu — kampanya zamanı belli olur.', ic: 'grid' },
      { t: 'Personel kullanımı', d: 'Her personelin randevu ve saat sayısı — planlama ve motivasyon için.', ic: 'users' },
      { t: 'En iyi hizmetler', d: 'En çok randevu ve gelir getiren hizmetler.', ic: 'target' },
      { t: 'Kaynaklar', d: 'Randevuların nereden geldiği: site, telefon, WhatsApp, Telegram, API, içe aktarma.', ic: 'funnel' },
      { t: 'Risk altındaki müşteriler', d: '60 günden uzun süredir randevu almayan düzenli müşteriler — geri çağırmaya değer olanlar.', ic: 'bell' },
    ],
  },
  feed: {
    k: 'Randevu günlüğü',
    t: 'Her randevunun kendi geçmişi var.',
    d: 'Oluşturma, durum değişiklikleri, erteleme, personel veya kaynak değişikliği, gönderilen bildirimler ve notlar yazar ve zamanla saklanır. Müşteri ne zaman ve kime yazıldığını tartışırsa yanıt randevu kartındadır.',
    rows: [
      ['bugün 09:14', 'Randevu YZ danışmanı tarafından oluşturuldu · WhatsApp, Anna K., 10:00', 'oluşturuldu', true],
      ['bugün 08:50', 'Durum: müşteri iptal etti · Svetlana O., 15:00', 'iptal', false],
      ['dün 18:20', 'Ertelendi · Irina S., 12:00 → 13:00', 'erteleme', true],
      ['dün 17:02', 'Personel değişti · Maria → Lena', 'personel', true],
      ['dün 16:05', 'Durum: tamamlandı · Ekaterina B.', 'tamam', true],
    ],
    note: 'Demo verilerle örnek.',
  },
  ai: {
    k: 'Bu çözüm için YZ çalışanı',
    name: 'YZ danışmanı',
    job: 'Sohbetlerden randevu',
    text: 'WhatsApp, Telegram ve sitenizin çevrimiçi sohbetinde müşterilere yanıt verir ve ayarlarda açıldığında randevuyu kendisi oluşturur. Boş zamanı yalnızca gerçek takvimden hesaplar ve randevu oluşturmadan önce müşteriden onay alır. Yalnızca aynı müşterinin randevusunu ve yalnızca proje süreleri içinde iptal edebilir veya taşıyabilir.',
    list: ['Boş bir saat bulur', 'Saati müşteriyle onaylar', 'Randevuyu takvime ekler'],
    hire: 'YZ çalışanları hakkında',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Takvim ve randevular',
        items: [
          { q: 'Sistem çifte randevuyu nasıl önler?', a: 'Randevu kaydedilmeden önce şube saatleri ve özel günler, personelin planı ve izinleri, tamponlar dahil mevcut randevular ve kaynak müsaitliği kontrol edilir. Saat çakışıyorsa — projede overbooking açık değilse — randevu kaydedilmez.' },
          { q: 'Yalnızca salonlar için mi?', a: 'Hayır. İşletme türü projede belirlenir: salon, klinik, stüdyo, restoran, danışmanlık. Veri modeli aynıdır — hizmetler, personel ve kaynaklar — bu yüzden zamana göre randevu alan her işletmeye uyar.' },
          { q: 'Birden fazla şube yönetebilir miyim?', a: 'Evet. Her şubenin kendi adresi, saat dilimi, çalışma saatleri ve özel günleri vardır; analitik doluluğu hem tüm ağ hem şube bazında gösterir.' },
          { q: 'Personel hastalanırsa randevulara ne olur?', a: 'Planına izin girin — o günler için yeni randevular kontrolden geçmez. Mevcut randevular başka bir personele aktarılabilir ve bu, randevu günlüğüne kaydedilir.' },
        ],
      },
      {
        g: 'Müşteriler ve kanallar',
        items: [
          { q: 'Randevular nereden gelir?', a: 'Yönetici manuel oluşturur, YZ danışmanı WhatsApp, Telegram ve site sohbetinden kaydeder, harici bir site veya form API üzerinden token ile gönderir ya da dosyadan içe aktarılır. Her randevunun kaynağı saklanır.' },
          { q: 'Site için hazır bir randevu widget’ı var mı?', a: 'Henüz yok. Sitenizden gelen randevular API üzerinden — modül ayarlarındaki token ile bir istek — ya da siteye tek satır kodla eklenen çevrimiçi sohbetteki YZ danışmanı aracılığıyla alınır.' },
          { q: 'Randevular lead’lere bağlanıyor mu?', a: 'Evet. Randevu, telefon veya e-postayla mevcut kişi ve lead’i bulur ya da yenilerini oluşturur. Lead kartında müşterinin tüm randevu geçmişi görünür.' },
          { q: 'Bekleme listesi nasıl çalışır?', a: 'Müşteri tercih ettiği saatle öncelikli sıraya girer. Uygun bir saat boşalınca yönetici bunu önerir ve talebi tek işlemle randevuya dönüştürür. Boşalan saat bekleme listesine otomatik olarak önerilmez.' },
        ],
      },
      {
        g: 'Bildirimler ve ödeme',
        items: [
          { q: 'Müşteri ve personel randevudan nasıl haberdar olur?', a: 'Otomasyonlarla: randevu oluşturma, erteleme, durum değişikliği ve yeni bekleme listesi kaydında e-posta, Telegram mesajı veya CRM bildirimi gönderilebilir. Metinlerde değişkenler kullanılabilir — müşteri adı, hizmet, tarih, personel. Yeni randevular için personel bildirimi otomatik kurulur.' },
          { q: 'Müşteriye ziyaretten bir gün önce hatırlatma gider mi?', a: 'Şu anda “ziyaretten N saat önce” hatırlatması yok. Otomasyonlar randevu olaylarında çalışır ve adımlar arasında bekleyebilir, ancak süreyi ziyaret başlangıcından saymaz.' },
          { q: 'Ödeme nasıl takip edilir?', a: 'Her randevunun ayrı bir ödeme durumu vardır: gerekmiyor, ödenmedi, kapora, ödendi, kısmi iade, iade, hata. Analitikteki gelir günlük kurla tek para birimine çevrilir.' },
        ],
      },
      {
        g: 'Başlangıç',
        items: [
          { q: 'Randevuları başka bir sistemden taşıyabilir miyim?', a: 'Evet. Randevular dosyadan içe aktarılır: önce önizleme ve sütun eşleştirme, sonra yükleme.' },
          { q: 'Randevuları kim görür ve değiştirir?', a: 'Modüle erişim CRM rolleriyle yönetilir. Modül şirket bazında açılır — ihtiyacınız yoksa menüde yer kaplamaz.' },
          { q: 'Ücreti nedir?', a: 'Rezervasyonlar, Standard’dan itibaren tüm paketlerde mevcuttur. WhatsApp, Telegram ve çevrimiçi sohbetten YZ ile randevu, bu kanalları içeren Professional paketi gerektirir. 14 günlük deneme tüm modülleri içerir, kart gerekmez.' },
        ],
      },
    ],
  },
  more: { k: 'Diğer çözümler', t: 'Lumiva tüm işi kapsar.' },
  cta: { k: '14 gün ücretsiz', t: 'Çifte randevusuz takviminizi bu hafta kurun.' },
};

export const BOOKING_T: Record<'ru' | 'en' | 'tr', BookingText> = { ru, en, tr };
