/* Тексты страницы «Решения → Аналитика» (ru/en/tr). Только реальные возможности:
 * аналитика модулей с блоками (метрики, формулы, линии, кольца, столбцы, тепловая карта, воронка, рейтинг,
 * таблица, заметка; в проектах/рабочих областях ещё сводная и карта — 12 типов), изменение ширины/высоты блоков,
 * пользовательские вкладки со своими блоками и фильтрами, валюта отчёта, сравнение периодов, экспорт CSV/Excel;
 * BI-дашборд по всем модулям с трендами, воронкой, командой и сигналами риска; Aura (30 виджетов, 8 источников,
 * 5 стилей, правки в чате, права по ролям, ТВ-ссылка с паролем и сроком, автообновление);
 * регулярные отчёты автоматизаций: продажи/проекты/задачи/маркетинг/бронирования/отели, день/неделя/месяц,
 * email с PDF/XLSX/CSV или Telegram; ИИ-аналитик CRM (отчёт за вчера, только чтение). */

type Item = { b: string; s: string };
type QA = { q: string; a: string };
type Card = { t: string; d: string; ic: string };

export type AnalyticsText = {
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
  builder: {
    k: string; t: string; lede: string; items: Item[];
    vis: { tabs: string[]; addTab: string; lib: string; blocks: string[]; resize: string };
  };
  modules: { k: string; t: string; d: string; items: Card[] };
  aura: { k: string; t: string; lede: string; items: Item[]; vis: { prompts: string[]; steps: string[] } };
  reports: {
    k: string; t: string; lede: string; items: Item[];
    vis: { h: string; type: string; types: string[]; freq: string; freqs: string[]; to: string; tos: string[]; mail: string; subject: string; sent: string };
  };
  trust: { k: string; t: string; d: string; items: Card[] };
  pair: { src: { title: string; leads: string; won: string; rows: Array<[string, number, number]> }; team: { title: string; calls: string; deals: string; rows: Array<[string, number, number]> } };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  ai: { k: string; name: string; job: string; text: string; list: string[]; hire: string; aura: string };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

const ru: AnalyticsText = {
  crumbs: ['Решения', 'Аналитика'],
  kicker: 'Решение · Аналитика и BI',
  t1: 'Отчёты, которые собираются сами —',
  t2: 'из живых данных CRM.',
  sub: 'Лиды, продажи, проекты, бронирования, звонки и реклама уже лежат в Lumiva — аналитика строится прямо на них. Соберите свой экран из блоков, попросите Aura собрать дашборд словами или получайте отчёт на почту каждый понедельник. Выгружать данные в Excel, чтобы посчитать итог, больше не нужно.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '12', l: 'типов блоков: от метрик и формул до сводной таблицы и карты' },
    { v: '6', l: 'видов регулярных отчётов: продажи, проекты, задачи, маркетинг, бронирования, отели' },
    { v: '3', l: 'формата вложений в отчёте на почту: PDF, Excel и CSV' },
    { v: '5', l: 'стилей дашбордов Aura — от монохрома до ТВ-экрана в офисе' },
  ],
  prob: {
    k: '01 · Задача',
    t: 'Каждый новый отчёт — это выгрузка в Excel и полдня работы.',
    d: 'Руководителю нужен один график «выручка по менеджерам за неделю». Его собирают вручную: выгрузка из CRM, сводная таблица, пересчёт валют, скриншот в презентацию. К следующей планёрке цифры уже устарели, а у отдела продаж и маркетинга опять разные итоги. В Lumiva отчёт строится на тех же данных, с которыми работает команда, и обновляется сам.',
  },
  builder: {
    k: '02 · Конструктор аналитики',
    t: 'Свой экран аналитики — из готовых блоков.',
    lede: 'В аналитике лидов, продаж, проектов и рабочих областей экран собирается из блоков, как из конструктора. Ничего программировать не нужно.',
    items: [
      { b: 'Библиотека блоков', s: ' — метрики, формулы, линии, кольца, столбцы, тепловая карта, воронка, рейтинг менеджеров, таблица и заметка; в проектах и рабочих областях — ещё сводная таблица и карта.' },
      { b: 'Размер под задачу', s: ' — блок растягивается по ширине и высоте за край, раскладка сохраняется.' },
      { b: 'Свои вкладки', s: ' — «Обзор», «По менеджерам», «По каналам»: у каждой вкладки свои блоки и свои фильтры. Новую вкладку можно начать с нуля или копией текущей.' },
      { b: 'Период и сравнение', s: ' — единый выбор периода с быстрыми диапазонами и сравнением с прошлым периодом.' },
      { b: 'Валюта отчёта', s: ' — суммы в разных валютах пересчитываются в одну, итог не складывает евро с лирами.' },
      { b: 'Экспорт', s: ' — выгрузка данных отчёта в CSV или Excel, если они всё-таки нужны вне CRM.' },
    ],
    vis: { tabs: ['Обзор', 'По менеджерам'], addTab: 'Вкладка', lib: 'Библиотека блоков', blocks: ['Метрика', 'Линия', 'Воронка', 'Рейтинг', 'Тепловая карта', 'Формула'], resize: 'тяните за край' },
  },
  modules: {
    k: '03 · Аналитика в каждом модуле',
    t: 'Цифры там, где идёт работа.',
    d: 'У каждого модуля CRM своя аналитика — и сводный BI-дашборд, который собирает их на одном экране.',
    items: [
      { t: 'Лиды', d: 'Поток заявок, источники и каналы, статусы, скорость реакции, рейтинг менеджеров и тепловая карта по времени.', ic: 'funnel' },
      { t: 'Продажи', d: 'Подтверждённые, отменённые и возвраты по каналам, рынкам и агентам, сохранённые наборы фильтров и экспорт.', ic: 'chart' },
      { t: 'Менеджеры', d: 'Выигранные и проигранные лиды и повторные продажи по каждому сотруднику за период.', ic: 'users' },
      { t: 'Проекты и рабочие области', d: 'Свои таблицы и поля — свои отчёты: формулы, сводные таблицы, карта и вкладки под каждую задачу.', ic: 'grid' },
      { t: 'Компании', d: 'Выручка по проектам каждой компании и рейтинг клиентов.', ic: 'box' },
      { t: 'Бронирования и отели', d: 'Загрузка, отмены и неявки, выручка по услугам, номерам и периодам.', ic: 'cal' },
      { t: 'Телефония', d: 'Звонки и SMS, доля принятых, средняя длительность, загрузка по часам, менеджеры и тональность разговоров.', ic: 'bell' },
      { t: 'Маркетинг и трафик', d: 'Показы, клики, лиды и расход по рекламным каналам, ROI по клиентам и SEO.', ic: 'target' },
      { t: 'BI-дашборд', d: 'Все модули на одном экране: тренды к прошлому периоду, каналы, воронка, топ компаний, команда и сигналы риска.', ic: 'spark' },
    ],
  },
  aura: {
    k: '04 · Lumiva Aura',
    t: 'Дашборд по одному предложению.',
    lede: 'Не хотите собирать вручную — опишите словами. Aura уточнит данные, период и зрителя, предложит стиль и соберёт дашборд на живых данных CRM.',
    items: [
      { b: '30 виджетов на 8 источниках', s: ' — лиды, сделки, команда, звонки, бронирования, склад, финансы и маркетинг.' },
      { b: 'Правки в чате', s: ' — «добавь воронку», «сравни с прошлым месяцем»: дашборд меняется по запросу.' },
      { b: '5 стилей и ТВ-режим', s: ' — экран можно вывести в офисе без меню, по ссылке с паролем и сроком действия.' },
      { b: 'Права из ролей CRM', s: ' — каждый видит только те источники и суммы, к которым у него есть доступ.' },
      { b: 'Автообновление', s: ' — данные обновляются сами: раз в минуту, 5 или 15 минут или раз в час.' },
    ],
    vis: {
      prompts: ['Экран на ТВ в офис: звонки и выручка за сегодня', 'Дашборд для планёрки: выручка, воронка и кто отстаёт от плана'],
      steps: ['Читаю запрос', 'Подключаю данные CRM', 'Подбираю виджеты', 'Применяю стиль'],
    },
  },
  reports: {
    k: '05 · Регулярные отчёты',
    t: 'Отчёт сам приходит на почту или в Telegram.',
    lede: 'Настройте один раз — и CRM будет присылать отчёт по расписанию, с вложениями, которые удобно переслать руководителю или бухгалтеру.',
    items: [
      { b: 'Шесть видов отчётов', s: ' — продажи, проекты, задачи, маркетинг, бронирования и отели.' },
      { b: 'Любое расписание', s: ' — каждый день, раз в неделю в нужный день или раз в месяц.' },
      { b: 'Вложения', s: ' — PDF для чтения, Excel и CSV для своих расчётов.' },
      { b: 'Почта или Telegram', s: ' — отчёт уходит на нужные адреса или сообщением в Telegram.' },
      { b: 'ИИ-отчёты', s: ' — ИИ-аналитик присылает ежедневную сводку за вчера, ИИ по SEO — еженедельный отчёт по поиску и сайту.' },
    ],
    vis: { h: 'Регулярный отчёт', type: 'Отчёт', types: ['Продажи', 'Бронирования', 'Маркетинг'], freq: 'Расписание', freqs: ['Каждый понедельник, 09:00', 'Каждый день, 08:00', '1-е число месяца'], to: 'Куда', tos: ['Email · руководитель', 'Telegram', 'Email · бухгалтерия'], mail: 'Входящие', subject: 'Отчёт за период', sent: 'отправлено' },
  },
  trust: {
    k: '06 · Цифрам можно верить',
    t: 'Одни данные — одни итоги у всей команды.',
    d: 'Отчёты считаются из тех же записей, с которыми работают менеджеры. Нет копий в таблицах — нет споров, чьи цифры правильнее.',
    items: [
      { t: 'Валюта отчёта', d: 'Продажи, бронирования и расходы в разных валютах пересчитываются в одну по курсу.', ic: 'chart' },
      { t: 'Сравнение периодов', d: 'Каждая цифра — с изменением к прошлому периоду, а не сама по себе.', ic: 'clock' },
      { t: 'Видимость по ролям', d: 'Менеджер видит свои записи или все — как настроено в правах; суммы и контакты можно скрыть.', ic: 'shield' },
      { t: 'Сигналы риска', d: 'BI-дашборд сам подсвечивает низкие остатки, рост отмен, негативные звонки и проигранные лиды.', ic: 'bell' },
      { t: 'ИИ считает кодом', d: 'ИИ-ассистент отвечает по данным CRM, а итоги считает программа — модель их не придумывает.', ic: 'spark' },
      { t: 'Журнал действий', d: 'Если цифра изменилась, видно, кто и когда поменял исходную запись.', ic: 'log' },
    ],
  },
  pair: {
    src: { title: 'Лиды по источникам · пример', leads: 'лидов', won: 'выиграно', rows: [['Сайт', 148, 21], ['WhatsApp', 96, 18], ['Instagram', 71, 9], ['Telegram', 58, 7]] },
    team: { title: 'Команда за неделю · пример', calls: 'звонков', deals: 'сделок', rows: [['Анна Ковалёва', 64, 12], ['Мерт Йылмаз', 51, 9], ['Илья Петров', 43, 7], ['Элиф Демир', 38, 6]] },
  },
  steps: {
    k: '07 · Как это работает',
    t: 'От данных в CRM до отчёта на почте.',
    d: 'Ничего не нужно выгружать — аналитика уже работает на ваших записях.',
    n: 'Шаг',
    items: [
      { t: 'Данные уже в CRM', d: 'Лиды, продажи, проекты, брони, звонки и реклама попадают в Lumiva из сайтов, мессенджеров и интеграций.' },
      { t: 'Соберите экран', d: 'Выберите блоки из библиотеки, растяните их и разложите по вкладкам.' },
      { t: 'Или попросите Aura', d: 'Опишите дашборд словами — Aura соберёт его и поправит по запросу.' },
      { t: 'Настройте рассылку', d: 'Отчёт по продажам или бронированиям — на почту с PDF и Excel или в Telegram по расписанию.' },
      { t: 'Обсуждайте одни цифры', d: 'Планёрка по общему дашборду, а не по трём разным таблицам.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs отчёты в Excel',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Новый отчёт', lumiva: 'Блок из библиотеки или запрос в Aura', typical: 'Выгрузка, сводная таблица, полдня работы' },
      { metric: 'Актуальность', lumiva: 'Считается из живых данных CRM', typical: 'Устаревает к следующей планёрке' },
      { metric: 'Валюты', lumiva: 'Пересчёт в валюту отчёта по курсу', typical: 'Курс вручную, ошибки в итоге' },
      { metric: 'Регулярная рассылка', lumiva: 'Почта или Telegram по расписанию, PDF/Excel/CSV', typical: 'Кто-то должен не забыть отправить' },
      { metric: 'Доступ', lumiva: 'Каждый видит данные по своим правам', typical: 'Файл пересылают всем целиком' },
    ],
  },
  ai: {
    k: 'ИИ-сотрудник для этого решения',
    name: 'Leo AI',
    job: 'Аналитик CRM',
    text: 'Каждый день собирает показатели за вчера по выбранным вами блокам — продажи, оплаты, лиды, брони, задачи, обращения, маркетинг, — сравнивает с позавчера и пишет короткий вывод. Работает только на чтение: ничего не меняет в CRM, только присылает отчёт на почту и в уведомления.',
    list: ['Собирает показатели за вчера', 'Сравнивает с позавчера', 'Пишет короткий вывод'],
    hire: 'Об ИИ-сотрудниках',
    aura: 'Попробовать Aura',
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Конструктор и дашборды',
        items: [
          { q: 'Какие блоки есть в конструкторе аналитики?', a: 'Метрики и формулы, линии, кольцевые и столбчатые диаграммы, тепловая карта, воронка, рейтинг менеджеров, таблица и заметка. В аналитике проектов и рабочих областей есть ещё сводная таблица и карта — всего 12 типов блоков.' },
          { q: 'Можно менять размер и порядок блоков?', a: 'Да. Блок растягивается по ширине и высоте за край, а раскладка сохраняется. Для разных задач удобно завести отдельные вкладки — у каждой свои блоки и фильтры.' },
          { q: 'Чем BI-дашборд отличается от аналитики модуля?', a: 'Аналитика модуля — подробный разбор лидов, продаж или проектов. BI-дашборд — сводка по всем модулям на одном экране: тренды к прошлому периоду, каналы, воронка, топ компаний, активность команды и сигналы риска.' },
          { q: 'Что такое Aura и чем она отличается от конструктора?', a: 'В конструкторе вы собираете экран сами. Aura собирает дашборд по описанию словами: уточняет данные, период и зрителя, предлагает стиль и правит результат по просьбе в чате. Дашборд можно открыть в CRM или вывести на ТВ в офисе.' },
          { q: 'Можно вывести дашборд на экран в офисе?', a: 'Да. У дашборда Aura есть ТВ-режим без меню и публичная ссылка, которую можно закрыть паролем и ограничить сроком действия. Данные обновляются автоматически.' },
        ],
      },
      {
        g: 'Отчёты и рассылки',
        items: [
          { q: 'Какие отчёты можно получать по расписанию?', a: 'Продажи, проекты, задачи, маркетинг, бронирования и отели. Расписание — каждый день, раз в неделю в выбранный день или раз в месяц.' },
          { q: 'В каком виде приходит отчёт?', a: 'На почту — письмом с вложениями: PDF для чтения, Excel и CSV для своих расчётов. Отчёт можно отправить и сообщением в Telegram.' },
          { q: 'Можно выгрузить данные аналитики?', a: 'Да. Данные отчётов выгружаются в CSV, а аналитика продаж — ещё и в Excel.' },
          { q: 'Что присылает ИИ-аналитик?', a: 'ИИ-аналитик CRM каждый день собирает показатели за вчера по выбранным блокам (продажи, оплаты, лиды, брони, отели, задачи, обращения, маркетинг), сравнивает с позавчера и присылает короткий вывод с таблицей на почту и в уведомления. Он работает только на чтение и ничего не меняет в данных.' },
        ],
      },
      {
        g: 'Точность и доступ',
        items: [
          { q: 'Откуда берутся данные? Нужно ли что-то загружать?', a: 'Аналитика строится на записях, которые уже есть в CRM: лиды с сайтов и мессенджеров, продажи из магазинов и интеграций, брони, звонки, расходы рекламных кабинетов. Ничего выгружать и загружать вручную не нужно.' },
          { q: 'Как считаются суммы в разных валютах?', a: 'Суммы пересчитываются в выбранную валюту отчёта по курсу, поэтому итог не складывает евро с лирами. В Aura всё приводится к основной валюте компании.' },
          { q: 'Менеджер увидит чужие продажи в отчётах?', a: 'Только если у него есть такое право. Видимость настраивается по ролям: свои записи или все; суммы и контакты можно скрыть. Дашборды Aura учитывают те же права.' },
          { q: 'Можно ли спросить цифры у ИИ?', a: 'Да. ИИ-ассистент отвечает на вопросы вроде «сколько продаж было на прошлой неделе по каналам». Итоги считает программа по реальным данным, а не языковая модель — поэтому они совпадают с отчётами.' },
        ],
      },
      {
        g: 'Начало работы',
        items: [
          { q: 'Сколько времени занимает настройка?', a: 'Стандартная аналитика модулей работает сразу после того, как в CRM появились данные. Свой экран из блоков или дашборд Aura собирается за несколько минут.' },
          { q: 'Можно попробовать на своих данных?', a: 'Да. Регистрация даёт 14 дней тарифа Enterprise бесплатно и без карты. Лиды и клиентов можно загрузить из Excel или CSV, а сайты и рекламные кабинеты подключить за несколько минут.' },
        ],
      },
    ],
  },
  cta: { k: 'Готовы посмотреть?', t: 'Соберём первый дашборд на ваших данных за 30 минут.' },
};

const en: AnalyticsText = {
  crumbs: ['Solutions', 'Analytics'],
  kicker: 'Solution · Analytics and BI',
  t1: 'Reports that build themselves —',
  t2: 'from live CRM data.',
  sub: 'Leads, sales, projects, bookings, calls and ads already live in Lumiva — analytics is built right on top of them. Assemble your own screen from blocks, ask Aura to build a dashboard in words, or get a report by email every Monday. No more exporting to Excel just to count a total.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '12', l: 'block types: from metrics and formulas to pivot tables and maps' },
    { v: '6', l: 'kinds of scheduled reports: sales, projects, tasks, marketing, bookings, hotels' },
    { v: '3', l: 'attachment formats in email reports: PDF, Excel and CSV' },
    { v: '5', l: 'Aura dashboard styles — from monochrome to an office TV screen' },
  ],
  prob: {
    k: '01 · The problem',
    t: 'Every new report means an Excel export and half a day of work.',
    d: 'A manager needs one chart — "revenue by sales rep this week". It gets built by hand: CRM export, pivot table, currency conversion, screenshot into a deck. By the next meeting the numbers are stale, and sales and marketing have different totals again. In Lumiva the report is built on the same data the team works with and updates itself.',
  },
  builder: {
    k: '02 · Analytics builder',
    t: 'Your own analytics screen — from ready-made blocks.',
    lede: 'In leads, sales, projects and workspace analytics the screen is assembled from blocks like a construction kit. No coding needed.',
    items: [
      { b: 'Block library', s: ' — metrics, formulas, lines, donuts, bars, heatmap, funnel, manager ranking, table and note; projects and workspaces also have a pivot table and a map.' },
      { b: 'Sized for the job', s: ' — drag a block\'s edge to change width and height; the layout is saved.' },
      { b: 'Your own tabs', s: ' — "Overview", "By manager", "By channel": each tab has its own blocks and filters. Start a new tab empty or as a copy of the current one.' },
      { b: 'Period and comparison', s: ' — one period picker with quick ranges and comparison to the previous period.' },
      { b: 'Report currency', s: ' — amounts in different currencies are converted to one, so totals never add euros to lira.' },
      { b: 'Export', s: ' — export report data to CSV or Excel when you do need it outside the CRM.' },
    ],
    vis: { tabs: ['Overview', 'By manager'], addTab: 'Tab', lib: 'Block library', blocks: ['Metric', 'Line', 'Funnel', 'Ranking', 'Heatmap', 'Formula'], resize: 'drag the edge' },
  },
  modules: {
    k: '03 · Analytics in every module',
    t: 'Numbers where the work happens.',
    d: 'Every CRM module has its own analytics — plus a BI dashboard that brings them together on one screen.',
    items: [
      { t: 'Leads', d: 'Lead flow, sources and channels, statuses, response speed, manager ranking and a time heatmap.', ic: 'funnel' },
      { t: 'Sales', d: 'Confirmed, cancelled and refunded by channel, market and agent, saved filter sets and export.', ic: 'chart' },
      { t: 'Managers', d: 'Won and lost leads and repeat sales for each employee over the period.', ic: 'users' },
      { t: 'Projects and workspaces', d: 'Your own tables and fields, your own reports: formulas, pivots, a map and tabs for each task.', ic: 'grid' },
      { t: 'Companies', d: 'Project revenue for each company and a client ranking.', ic: 'box' },
      { t: 'Bookings and hotels', d: 'Occupancy, cancellations and no-shows, revenue by service, room and period.', ic: 'cal' },
      { t: 'Telephony', d: 'Calls and SMS, pickup rate, average duration, hourly load, managers and conversation sentiment.', ic: 'bell' },
      { t: 'Marketing and traffic', d: 'Impressions, clicks, leads and spend by ad channel, ROI by client and SEO.', ic: 'target' },
      { t: 'BI dashboard', d: 'All modules on one screen: trends vs the previous period, channels, funnel, top companies, team and risk signals.', ic: 'spark' },
    ],
  },
  aura: {
    k: '04 · Lumiva Aura',
    t: 'A dashboard from a single sentence.',
    lede: 'Don\'t want to build it by hand? Describe it in words. Aura clarifies data, period and audience, suggests a style and builds the dashboard on live CRM data.',
    items: [
      { b: '30 widgets on 8 sources', s: ' — leads, deals, team, calls, bookings, stock, finance and marketing.' },
      { b: 'Edit in chat', s: ' — "add a funnel", "compare with last month": the dashboard changes on request.' },
      { b: '5 styles and TV mode', s: ' — show it in the office without menus, via a link with a password and an expiry date.' },
      { b: 'Rights from CRM roles', s: ' — everyone sees only the sources and amounts they have access to.' },
      { b: 'Auto-refresh', s: ' — data refreshes on its own: every minute, 5 or 15 minutes, or hourly.' },
    ],
    vis: {
      prompts: ['Office TV screen: calls and revenue today', 'Stand-up dashboard: revenue, pipeline and who is behind plan'],
      steps: ['Reading the request', 'Connecting CRM data', 'Choosing widgets', 'Applying the style'],
    },
  },
  reports: {
    k: '05 · Scheduled reports',
    t: 'The report arrives by email or Telegram on its own.',
    lede: 'Set it up once and the CRM sends the report on schedule, with attachments that are easy to forward to a manager or an accountant.',
    items: [
      { b: 'Six kinds of reports', s: ' — sales, projects, tasks, marketing, bookings and hotels.' },
      { b: 'Any schedule', s: ' — daily, weekly on the day you choose, or monthly.' },
      { b: 'Attachments', s: ' — PDF to read, Excel and CSV for your own calculations.' },
      { b: 'Email or Telegram', s: ' — the report goes to the right addresses or as a Telegram message.' },
      { b: 'AI reports', s: ' — the AI analyst sends a daily summary of yesterday, the SEO AI a weekly search and site report.' },
    ],
    vis: { h: 'Scheduled report', type: 'Report', types: ['Sales', 'Bookings', 'Marketing'], freq: 'Schedule', freqs: ['Every Monday, 09:00', 'Every day, 08:00', '1st of the month'], to: 'Send to', tos: ['Email · manager', 'Telegram', 'Email · accounting'], mail: 'Inbox', subject: 'Report for the period', sent: 'sent' },
  },
  trust: {
    k: '06 · Numbers you can trust',
    t: 'One dataset — one set of totals for the whole team.',
    d: 'Reports are calculated from the same records managers work with. No copies in spreadsheets — no arguments about whose numbers are right.',
    items: [
      { t: 'Report currency', d: 'Sales, bookings and spend in different currencies are converted to one at the exchange rate.', ic: 'chart' },
      { t: 'Period comparison', d: 'Every number comes with its change vs the previous period, not on its own.', ic: 'clock' },
      { t: 'Role-based visibility', d: 'A manager sees their own records or all of them, as set in permissions; amounts and contacts can be hidden.', ic: 'shield' },
      { t: 'Risk signals', d: 'The BI dashboard highlights low stock, rising cancellations, negative calls and lost leads by itself.', ic: 'bell' },
      { t: 'AI computes with code', d: 'The AI assistant answers from CRM data, and totals are computed by the program — the model does not make them up.', ic: 'spark' },
      { t: 'Activity log', d: 'If a number changed, you can see who changed the source record and when.', ic: 'log' },
    ],
  },
  pair: {
    src: { title: 'Leads by source · example', leads: 'leads', won: 'won', rows: [['Website', 148, 21], ['WhatsApp', 96, 18], ['Instagram', 71, 9], ['Telegram', 58, 7]] },
    team: { title: 'Team this week · example', calls: 'calls', deals: 'deals', rows: [['Anna Kovaleva', 64, 12], ['Mert Yilmaz', 51, 9], ['Ilya Petrov', 43, 7], ['Elif Demir', 38, 6]] },
  },
  steps: {
    k: '07 · How it works',
    t: 'From CRM data to a report in your inbox.',
    d: 'Nothing to export — analytics already runs on your records.',
    n: 'Step',
    items: [
      { t: 'Data is already in the CRM', d: 'Leads, sales, projects, bookings, calls and ads arrive in Lumiva from sites, messengers and integrations.' },
      { t: 'Build a screen', d: 'Pick blocks from the library, resize them and arrange them in tabs.' },
      { t: 'Or ask Aura', d: 'Describe the dashboard in words — Aura builds it and adjusts it on request.' },
      { t: 'Set up delivery', d: 'A sales or bookings report by email with PDF and Excel, or to Telegram, on schedule.' },
      { t: 'Discuss the same numbers', d: 'Stand-ups around a shared dashboard, not three different spreadsheets.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs reports in Excel',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'A new report', lumiva: 'A block from the library or a request to Aura', typical: 'Export, pivot table, half a day of work' },
      { metric: 'Freshness', lumiva: 'Computed from live CRM data', typical: 'Out of date by the next meeting' },
      { metric: 'Currencies', lumiva: 'Converted to the report currency at the rate', typical: 'Manual rates and wrong totals' },
      { metric: 'Regular delivery', lumiva: 'Email or Telegram on schedule, PDF/Excel/CSV', typical: 'Someone has to remember to send it' },
      { metric: 'Access', lumiva: 'Everyone sees data by their own rights', typical: 'The whole file is forwarded to everyone' },
    ],
  },
  ai: {
    k: 'AI employee for this solution',
    name: 'Leo AI',
    job: 'CRM analyst',
    text: 'Every day collects yesterday\'s numbers for the blocks you choose — sales, payments, leads, bookings, tasks, support, marketing — compares them with the day before and writes a short summary. Works read-only: changes nothing in the CRM, only sends the report by email and to notifications.',
    list: ['Collects yesterday\'s numbers', 'Compares with the day before', 'Writes a short summary'],
    hire: 'About AI employees',
    aura: 'Try Aura',
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Builder and dashboards',
        items: [
          { q: 'Which blocks does the analytics builder have?', a: 'Metrics and formulas, lines, donut and bar charts, heatmap, funnel, manager ranking, table and note. Projects and workspace analytics also have a pivot table and a map — 12 block types in total.' },
          { q: 'Can we change block size and order?', a: 'Yes. Drag a block\'s edge to change width and height; the layout is saved. For different tasks, create separate tabs — each with its own blocks and filters.' },
          { q: 'How is the BI dashboard different from module analytics?', a: 'Module analytics is a detailed view of leads, sales or projects. The BI dashboard is a summary of all modules on one screen: trends vs the previous period, channels, funnel, top companies, team activity and risk signals.' },
          { q: 'What is Aura and how is it different from the builder?', a: 'In the builder you assemble the screen yourself. Aura builds a dashboard from a description in words: it clarifies data, period and audience, suggests a style and edits the result when you ask in chat. Open the dashboard in the CRM or show it on the office TV.' },
          { q: 'Can we show a dashboard on an office screen?', a: 'Yes. Aura dashboards have a TV mode without menus and a public link that can be password-protected and limited by an expiry date. Data refreshes automatically.' },
        ],
      },
      {
        g: 'Reports and delivery',
        items: [
          { q: 'Which reports can we get on a schedule?', a: 'Sales, projects, tasks, marketing, bookings and hotels. The schedule can be daily, weekly on a chosen day, or monthly.' },
          { q: 'What does the report look like?', a: 'By email — a message with attachments: PDF to read, Excel and CSV for your own calculations. The report can also be sent as a Telegram message.' },
          { q: 'Can we export analytics data?', a: 'Yes. Report data exports to CSV, and sales analytics to Excel as well.' },
          { q: 'What does the AI analyst send?', a: 'Every day the CRM AI analyst collects yesterday\'s numbers for the chosen blocks (sales, payments, leads, bookings, hotels, tasks, support, marketing), compares them with the day before and sends a short summary with a table by email and to notifications. It works read-only and changes nothing in the data.' },
        ],
      },
      {
        g: 'Accuracy and access',
        items: [
          { q: 'Where does the data come from? Do we need to upload anything?', a: 'Analytics is built on records already in the CRM: leads from sites and messengers, sales from stores and integrations, bookings, calls, ad platform spend. Nothing needs to be exported or uploaded by hand.' },
          { q: 'How are amounts in different currencies counted?', a: 'Amounts are converted to the chosen report currency at the exchange rate, so totals never add euros to lira. In Aura everything is brought to the company\'s primary currency.' },
          { q: 'Will a manager see other people\'s sales in reports?', a: 'Only if they have that permission. Visibility is set per role: own records or all; amounts and contacts can be hidden. Aura dashboards respect the same rights.' },
          { q: 'Can we ask the AI for numbers?', a: 'Yes. The AI assistant answers questions like "how many sales did we have last week by channel". Totals are computed by the program from real data, not by the language model — so they match the reports.' },
        ],
      },
      {
        g: 'Getting started',
        items: [
          { q: 'How long does setup take?', a: 'Standard module analytics works as soon as data appears in the CRM. Your own block screen or an Aura dashboard takes a few minutes.' },
          { q: 'Can we try it on our own data?', a: 'Yes. Sign-up gives 14 days of the Enterprise plan for free, no card required. Upload leads and clients from Excel or CSV and connect sites and ad accounts in a few minutes.' },
        ],
      },
    ],
  },
  cta: { k: 'Ready to see it?', t: 'We\'ll build your first dashboard on your data in 30 minutes.' },
};

const tr: AnalyticsText = {
  crumbs: ['Çözümler', 'Analitik'],
  kicker: 'Çözüm · Analitik ve BI',
  t1: 'Kendi kendine oluşan raporlar —',
  t2: 'canlı CRM verilerinden.',
  sub: 'Talepler, satışlar, projeler, rezervasyonlar, aramalar ve reklamlar zaten Lumiva\'da — analitik doğrudan bunların üzerine kurulur. Ekranınızı bloklardan oluşturun, Aura\'dan kelimelerle pano isteyin veya her pazartesi raporu e-postayla alın. Toplamı hesaplamak için artık Excel\'e aktarmanız gerekmez.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '12', l: 'blok türü: metrik ve formüllerden pivot tablo ve haritaya' },
    { v: '6', l: 'düzenli rapor türü: satış, projeler, görevler, pazarlama, rezervasyonlar, oteller' },
    { v: '3', l: 'e-posta raporunda ek formatı: PDF, Excel ve CSV' },
    { v: '5', l: 'Aura pano stili — monokromdan ofis TV ekranına' },
  ],
  prob: {
    k: '01 · Sorun',
    t: 'Her yeni rapor, Excel\'e aktarma ve yarım günlük iş demek.',
    d: 'Yöneticinin tek bir grafiğe ihtiyacı var: "bu hafta yöneticilere göre ciro". Elle hazırlanıyor: CRM\'den aktarma, pivot tablo, kur çevirme, sunuma ekran görüntüsü. Bir sonraki toplantıya kadar rakamlar eskiyor, satış ve pazarlamanın toplamları yine farklı. Lumiva\'da rapor ekibin çalıştığı verilerle kurulur ve kendiliğinden güncellenir.',
  },
  builder: {
    k: '02 · Analitik oluşturucu',
    t: 'Kendi analitik ekranınız — hazır bloklardan.',
    lede: 'Talep, satış, proje ve çalışma alanı analitiğinde ekran bir yapı seti gibi bloklardan oluşturulur. Kod yazmaya gerek yok.',
    items: [
      { b: 'Blok kütüphanesi', s: ' — metrikler, formüller, çizgi, halka, sütun, ısı haritası, huni, yönetici sıralaması, tablo ve not; projelerde ve çalışma alanlarında ayrıca pivot tablo ve harita.' },
      { b: 'İhtiyaca göre boyut', s: ' — bloğun kenarından sürükleyerek genişlik ve yükseklik değiştirilir, düzen kaydedilir.' },
      { b: 'Kendi sekmeleriniz', s: ' — "Genel", "Yöneticilere göre", "Kanallara göre": her sekmenin kendi blokları ve filtreleri var. Yeni sekme boş veya mevcut sekmenin kopyası olarak başlar.' },
      { b: 'Dönem ve karşılaştırma', s: ' — hızlı aralıklar ve önceki dönemle karşılaştırma içeren tek dönem seçici.' },
      { b: 'Rapor para birimi', s: ' — farklı para birimlerindeki tutarlar tek birime çevrilir, toplam euro ile lirayı toplamaz.' },
      { b: 'Dışa aktarma', s: ' — rapor verilerini CRM dışında gerekirse CSV veya Excel olarak aktarın.' },
    ],
    vis: { tabs: ['Genel', 'Yöneticilere göre'], addTab: 'Sekme', lib: 'Blok kütüphanesi', blocks: ['Metrik', 'Çizgi', 'Huni', 'Sıralama', 'Isı haritası', 'Formül'], resize: 'kenardan sürükleyin' },
  },
  modules: {
    k: '03 · Her modülde analitik',
    t: 'Rakamlar işin yapıldığı yerde.',
    d: 'Her CRM modülünün kendi analitiği var — ve hepsini tek ekranda toplayan bir BI panosu.',
    items: [
      { t: 'Talepler', d: 'Talep akışı, kaynaklar ve kanallar, durumlar, yanıt hızı, yönetici sıralaması ve saat ısı haritası.', ic: 'funnel' },
      { t: 'Satışlar', d: 'Kanal, pazar ve acenteye göre onaylanan, iptal edilen ve iadeler, kayıtlı filtre setleri ve dışa aktarma.', ic: 'chart' },
      { t: 'Yöneticiler', d: 'Dönem içinde her çalışan için kazanılan ve kaybedilen talepler ve tekrar satışlar.', ic: 'users' },
      { t: 'Projeler ve çalışma alanları', d: 'Kendi tablolarınız ve alanlarınız — kendi raporlarınız: formüller, pivotlar, harita ve her iş için sekmeler.', ic: 'grid' },
      { t: 'Şirketler', d: 'Her şirketin proje cirosu ve müşteri sıralaması.', ic: 'box' },
      { t: 'Rezervasyonlar ve oteller', d: 'Doluluk, iptaller ve gelmeyenler, hizmet, oda ve döneme göre ciro.', ic: 'cal' },
      { t: 'Telefon', d: 'Aramalar ve SMS, yanıtlanma oranı, ortalama süre, saatlik yoğunluk, yöneticiler ve konuşma tonu.', ic: 'bell' },
      { t: 'Pazarlama ve trafik', d: 'Reklam kanallarına göre gösterim, tıklama, talep ve harcama, müşteri bazında ROI ve SEO.', ic: 'target' },
      { t: 'BI panosu', d: 'Tüm modüller tek ekranda: önceki döneme göre trendler, kanallar, huni, en iyi şirketler, ekip ve risk sinyalleri.', ic: 'spark' },
    ],
  },
  aura: {
    k: '04 · Lumiva Aura',
    t: 'Tek cümleden pano.',
    lede: 'Elle kurmak istemiyor musunuz? Kelimelerle anlatın. Aura veriyi, dönemi ve izleyiciyi netleştirir, stil önerir ve panoyu canlı CRM verileriyle kurar.',
    items: [
      { b: '8 kaynakta 30 widget', s: ' — talepler, satışlar, ekip, aramalar, rezervasyonlar, stok, finans ve pazarlama.' },
      { b: 'Sohbetle düzenleme', s: ' — "huni ekle", "geçen ayla karşılaştır": pano isteğe göre değişir.' },
      { b: '5 stil ve TV modu', s: ' — ofiste menüsüz gösterin, şifreli ve süreli bir bağlantıyla.' },
      { b: 'CRM rollerinden yetkiler', s: ' — herkes yalnızca erişimi olan kaynakları ve tutarları görür.' },
      { b: 'Otomatik yenileme', s: ' — veriler kendiliğinden yenilenir: her dakika, 5 veya 15 dakikada ya da saatte bir.' },
    ],
    vis: {
      prompts: ['Ofis TV ekranı: bugünkü aramalar ve ciro', 'Toplantı panosu: ciro, huni ve plandan geride kalanlar'],
      steps: ['İstek okunuyor', 'CRM verileri bağlanıyor', 'Widget seçiliyor', 'Stil uygulanıyor'],
    },
  },
  reports: {
    k: '05 · Düzenli raporlar',
    t: 'Rapor e-postaya veya Telegram\'a kendiliğinden gelir.',
    lede: 'Bir kez ayarlayın; CRM raporu programa göre, yöneticiye veya muhasebeye kolayca iletilecek eklerle gönderir.',
    items: [
      { b: 'Altı rapor türü', s: ' — satış, projeler, görevler, pazarlama, rezervasyonlar ve oteller.' },
      { b: 'Her türlü program', s: ' — her gün, seçtiğiniz günde haftada bir veya ayda bir.' },
      { b: 'Ekler', s: ' — okumak için PDF, kendi hesaplarınız için Excel ve CSV.' },
      { b: 'E-posta veya Telegram', s: ' — rapor gerekli adreslere veya Telegram mesajı olarak gider.' },
      { b: 'Yapay zekâ raporları', s: ' — yapay zekâ analisti dünün günlük özetini, SEO yapay zekâsı haftalık arama ve site raporunu gönderir.' },
    ],
    vis: { h: 'Düzenli rapor', type: 'Rapor', types: ['Satış', 'Rezervasyonlar', 'Pazarlama'], freq: 'Program', freqs: ['Her pazartesi, 09:00', 'Her gün, 08:00', 'Ayın 1\'i'], to: 'Alıcı', tos: ['E-posta · yönetici', 'Telegram', 'E-posta · muhasebe'], mail: 'Gelen kutusu', subject: 'Dönem raporu', sent: 'gönderildi' },
  },
  trust: {
    k: '06 · Güvenilir rakamlar',
    t: 'Tek veri — tüm ekip için tek toplam.',
    d: 'Raporlar yöneticilerin çalıştığı kayıtlardan hesaplanır. Tablolarda kopya yok — kimin rakamının doğru olduğu tartışması da yok.',
    items: [
      { t: 'Rapor para birimi', d: 'Farklı para birimlerindeki satışlar, rezervasyonlar ve harcamalar kurla tek birime çevrilir.', ic: 'chart' },
      { t: 'Dönem karşılaştırması', d: 'Her rakam tek başına değil, önceki döneme göre değişimiyle gösterilir.', ic: 'clock' },
      { t: 'Role göre görünürlük', d: 'Yönetici yetkilerde ayarlandığı gibi kendi kayıtlarını veya tümünü görür; tutarlar ve iletişim bilgileri gizlenebilir.', ic: 'shield' },
      { t: 'Risk sinyalleri', d: 'BI panosu düşük stokları, artan iptalleri, olumsuz aramaları ve kaybedilen talepleri kendisi vurgular.', ic: 'bell' },
      { t: 'Yapay zekâ kodla hesaplar', d: 'Yapay zekâ asistanı CRM verileriyle yanıt verir, toplamları program hesaplar — model uydurmaz.', ic: 'spark' },
      { t: 'İşlem günlüğü', d: 'Bir rakam değiştiyse kaynak kaydı kimin ve ne zaman değiştirdiği görünür.', ic: 'log' },
    ],
  },
  pair: {
    src: { title: 'Kaynağa göre talepler · örnek', leads: 'talep', won: 'kazanıldı', rows: [['Site', 148, 21], ['WhatsApp', 96, 18], ['Instagram', 71, 9], ['Telegram', 58, 7]] },
    team: { title: 'Bu hafta ekip · örnek', calls: 'arama', deals: 'satış', rows: [['Anna Kovaleva', 64, 12], ['Mert Yılmaz', 51, 9], ['İlya Petrov', 43, 7], ['Elif Demir', 38, 6]] },
  },
  steps: {
    k: '07 · Nasıl çalışır',
    t: 'CRM verisinden e-postadaki rapora.',
    d: 'Hiçbir şeyi dışa aktarmanız gerekmez — analitik zaten kayıtlarınızda çalışıyor.',
    n: 'Adım',
    items: [
      { t: 'Veriler zaten CRM\'de', d: 'Talepler, satışlar, projeler, rezervasyonlar, aramalar ve reklamlar sitelerden, mesajlaşmadan ve entegrasyonlardan Lumiva\'ya gelir.' },
      { t: 'Ekranı kurun', d: 'Kütüphaneden blokları seçin, boyutlandırın ve sekmelere yerleştirin.' },
      { t: 'Veya Aura\'ya sorun', d: 'Panoyu kelimelerle anlatın — Aura kurar ve isteğe göre düzenler.' },
      { t: 'Gönderimi ayarlayın', d: 'Satış veya rezervasyon raporu programa göre PDF ve Excel ile e-postaya veya Telegram\'a.' },
      { t: 'Aynı rakamları konuşun', d: 'Toplantılar üç farklı tablo yerine ortak bir pano üzerinden.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs Excel\'deki raporlar',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Yeni rapor', lumiva: 'Kütüphaneden bir blok veya Aura\'ya bir istek', typical: 'Aktarma, pivot tablo, yarım gün iş' },
      { metric: 'Güncellik', lumiva: 'Canlı CRM verilerinden hesaplanır', typical: 'Bir sonraki toplantıya kadar eskir' },
      { metric: 'Para birimleri', lumiva: 'Rapor para birimine kurla çevrilir', typical: 'Elle kur ve hatalı toplamlar' },
      { metric: 'Düzenli gönderim', lumiva: 'Programa göre e-posta veya Telegram, PDF/Excel/CSV', typical: 'Birinin göndermeyi hatırlaması gerekir' },
      { metric: 'Erişim', lumiva: 'Herkes verileri kendi yetkisiyle görür', typical: 'Dosyanın tamamı herkese iletilir' },
    ],
  },
  ai: {
    k: 'Bu çözüm için yapay zekâ çalışanı',
    name: 'Leo AI',
    job: 'CRM analisti',
    text: 'Her gün seçtiğiniz bloklar için dünün rakamlarını toplar — satışlar, ödemeler, talepler, rezervasyonlar, görevler, destek, pazarlama —, önceki günle karşılaştırır ve kısa bir özet yazar. Yalnızca okuma yetkisiyle çalışır: CRM\'de hiçbir şeyi değiştirmez, raporu e-postaya ve bildirimlere gönderir.',
    list: ['Dünün rakamlarını toplar', 'Önceki günle karşılaştırır', 'Kısa özet yazar'],
    hire: 'Yapay zekâ çalışanları hakkında',
    aura: 'Aura\'yı deneyin',
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Oluşturucu ve panolar',
        items: [
          { q: 'Analitik oluşturucuda hangi bloklar var?', a: 'Metrikler ve formüller, çizgi, halka ve sütun grafikler, ısı haritası, huni, yönetici sıralaması, tablo ve not. Proje ve çalışma alanı analitiğinde ayrıca pivot tablo ve harita var — toplam 12 blok türü.' },
          { q: 'Blokların boyutunu ve sırasını değiştirebilir miyiz?', a: 'Evet. Bloğun kenarından sürükleyerek genişlik ve yükseklik değiştirilir, düzen kaydedilir. Farklı işler için ayrı sekmeler açın — her birinin kendi blokları ve filtreleri olur.' },
          { q: 'BI panosu modül analitiğinden nasıl farklı?', a: 'Modül analitiği taleplerin, satışların veya projelerin ayrıntılı incelemesidir. BI panosu tüm modüllerin tek ekrandaki özetidir: önceki döneme göre trendler, kanallar, huni, en iyi şirketler, ekip etkinliği ve risk sinyalleri.' },
          { q: 'Aura nedir ve oluşturucudan farkı ne?', a: 'Oluşturucuda ekranı kendiniz kurarsınız. Aura panoyu kelimelerle yapılan tariften kurar: veriyi, dönemi ve izleyiciyi netleştirir, stil önerir ve sohbette istediğinizde sonucu düzenler. Panoyu CRM\'de açın veya ofis TV\'sinde gösterin.' },
          { q: 'Panoyu ofisteki ekranda gösterebilir miyiz?', a: 'Evet. Aura panolarının menüsüz TV modu ve şifreyle korunabilen, süresi sınırlanabilen herkese açık bir bağlantısı var. Veriler otomatik yenilenir.' },
        ],
      },
      {
        g: 'Raporlar ve gönderim',
        items: [
          { q: 'Hangi raporları programa göre alabiliriz?', a: 'Satış, projeler, görevler, pazarlama, rezervasyonlar ve oteller. Program her gün, seçilen günde haftada bir veya ayda bir olabilir.' },
          { q: 'Rapor nasıl görünür?', a: 'E-postada ekli bir mesaj: okumak için PDF, kendi hesaplarınız için Excel ve CSV. Rapor Telegram mesajı olarak da gönderilebilir.' },
          { q: 'Analitik verilerini dışa aktarabilir miyiz?', a: 'Evet. Rapor verileri CSV olarak, satış analitiği ayrıca Excel olarak aktarılır.' },
          { q: 'Yapay zekâ analisti ne gönderir?', a: 'CRM yapay zekâ analisti her gün seçilen bloklar (satışlar, ödemeler, talepler, rezervasyonlar, oteller, görevler, destek, pazarlama) için dünün rakamlarını toplar, önceki günle karşılaştırır ve tablolu kısa bir özeti e-postaya ve bildirimlere gönderir. Yalnızca okuma yetkisiyle çalışır ve verilerde hiçbir şeyi değiştirmez.' },
        ],
      },
      {
        g: 'Doğruluk ve erişim',
        items: [
          { q: 'Veriler nereden geliyor? Bir şey yüklememiz gerekiyor mu?', a: 'Analitik CRM\'de zaten olan kayıtlara dayanır: sitelerden ve mesajlaşmadan gelen talepler, mağazalardan ve entegrasyonlardan satışlar, rezervasyonlar, aramalar, reklam harcamaları. Elle hiçbir şey aktarmanız veya yüklemeniz gerekmez.' },
          { q: 'Farklı para birimlerindeki tutarlar nasıl hesaplanır?', a: 'Tutarlar kurla seçilen rapor para birimine çevrilir, böylece toplam euro ile lirayı toplamaz. Aura\'da her şey şirketin ana para birimine getirilir.' },
          { q: 'Yönetici raporlarda başkalarının satışlarını görür mü?', a: 'Yalnızca bu yetkisi varsa. Görünürlük role göre ayarlanır: kendi kayıtları veya tümü; tutarlar ve iletişim bilgileri gizlenebilir. Aura panoları aynı yetkileri uygular.' },
          { q: 'Rakamları yapay zekâya sorabilir miyiz?', a: 'Evet. Yapay zekâ asistanı "geçen hafta kanallara göre kaç satış oldu" gibi sorulara yanıt verir. Toplamları dil modeli değil, gerçek verilerden program hesaplar — bu yüzden raporlarla örtüşür.' },
        ],
      },
      {
        g: 'Başlangıç',
        items: [
          { q: 'Kurulum ne kadar sürer?', a: 'Standart modül analitiği CRM\'de veri oluşur oluşmaz çalışır. Bloklardan kendi ekranınız veya bir Aura panosu birkaç dakikada kurulur.' },
          { q: 'Kendi verilerimizle deneyebilir miyiz?', a: 'Evet. Kayıt, Enterprise planını 14 gün ücretsiz ve kartsız verir. Talepleri ve müşterileri Excel veya CSV\'den yükleyin, siteleri ve reklam hesaplarını birkaç dakikada bağlayın.' },
        ],
      },
    ],
  },
  cta: { k: 'Görmeye hazır mısınız?', t: 'İlk panonuzu 30 dakikada kendi verilerinizle kuralım.' },
};

export const ANALYTICS_T: Record<'ru' | 'en' | 'tr', AnalyticsText> = { ru, en, tr };
