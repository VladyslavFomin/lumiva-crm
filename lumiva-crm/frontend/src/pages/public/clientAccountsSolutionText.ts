/* Тексты страницы «Решения → Счета клиентов» (ru/en/tr). Только реальные возможности (backend modules/ccp):
 * личный кабинет клиента на WordPress (плагин CCP), подключение сайта по токену, несколько порталов; двусторонняя
 * синхронизация клиентов, операций и переводов (сайт → CRM через ingest, CRM → сайт при создании/правке, свежая
 * синхронизация по запросу); клиент: балансы и IBAN/номера счетов в EUR и USD, телефон, ссылка на аналитику, список
 * файлов, Telegram chat id, инвест-профиль (стиль, годовой %, доход в месяц %, кредитное плечо, погашение в месяц %,
 * списание за обслуживание в месяц %); операции (расход EUR/USD, дата, описание, статус); переводы между клиентами
 * (из валюты → в валюту, курс, зачислено); статусы «в работе / выполнено / ошибка»; аналитика клиента (балансы,
 * расходы, входящие/исходящие/чистые переводы, инвестиции по видам, ожидаемый доход, обслуживание, кредит, ожидаемый
 * чистый результат в месяц и год); тариф Enterprise.
 * НЕТ: других валют, лимитов и холдов, PDF-выписок и актов сверки, банковского API, связи со сделками, ИИ-роли. */

type Item = { b: string; s: string };
type QA = { q: string; a: string };
type Card = { t: string; d: string; ic: string };

export type ClientAccountsText = {
  crumbs: [string, string];
  kicker: string;
  t1: string;
  t2: string;
  sub: string;
  tryFree: string;
  demo: string;
  demoNote: string;
  stats: Array<{ v: string; l: string }>;
  hero: { client: string; acc: string; active: string; bal: string; ops: string; rows: Array<[string, string, string, string]> };
  prob: { k: string; t: string; d: string };
  card: {
    k: string; t: string; lede: string; items: Item[];
    vis: { client: string; email: string; balances: string; profile: string; prof: Array<[string, string]>; ops: string; st: { progress: string; done: string; fail: string }; rows: Array<[string, string, number]> };
  };
  ops: { k: string; t: string; d: string; items: Card[] };
  sync: {
    k: string; t: string; lede: string; items: Item[];
    vis: { crm: string; portal: string; log: string; rows: Array<[string, string]> };
  };
  analytics: {
    k: string; t: string; lede: string; items: Item[];
    vis: { h: string; kpis: Array<[string, string]>; in: string; out: string; net: string; months: string[] };
  };
  access: { k: string; t: string; d: string; items: Card[] };
  pair: { spend: { title: string; eur: string; usd: string; rows: Array<[string, number, number]> }; tr: { title: string; inc: string; out: string; rows: Array<[string, number, number]> } };
  steps: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  compare: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string };
};

const ru: ClientAccountsText = {
  crumbs: ['Решения', 'Счета клиентов'],
  kicker: 'Решение · Счета клиентов',
  t1: 'Финансовый профиль каждого клиента —',
  t2: 'в CRM и в его личном кабинете.',
  sub: 'Балансы в EUR и USD, реквизиты, операции, переводы между счетами с курсом и инвестиционный профиль клиента — в одной карточке CRM. Данные синхронизируются в обе стороны с личным кабинетом клиента на вашем сайте WordPress: команда и клиент видят одни и те же цифры.',
  tryFree: 'Попробовать бесплатно',
  demo: 'Записаться на демо',
  demoNote: 'Пример на демо-данных',
  stats: [
    { v: '2', l: 'валюты счёта — EUR и USD: у каждой свой баланс, IBAN и номер счёта' },
    { v: '3', l: 'статуса операции и перевода: в работе, выполнено, ошибка' },
    { v: '2', l: 'направления синхронизации: из личного кабинета в CRM и обратно' },
    { v: '6', l: 'параметров инвестиционного и кредитного профиля клиента' },
  ],
  hero: {
    client: 'ООО «Северный ветер»',
    acc: 'Счёт клиента · личный кабинет',
    active: 'Синхронизирован',
    bal: 'Баланс',
    ops: 'Последние операции',
    rows: [
      ['Перевод EUR → USD', 'курс 1,08 · зачислено $5 400', '−€5 000', 'done'],
      ['Оплата услуг', 'сегодня · в работе', '−€1 860', 'progress'],
      ['Входящий перевод', 'от клиента #1042', '+$2 150', 'done'],
    ],
  },
  prob: {
    k: '01 · Задача',
    t: 'Деньги клиента живут в трёх местах одновременно.',
    d: 'Баланс — в личном кабинете на сайте, история операций — в таблице у бухгалтера, параметры кредита и инвестиций — в переписке менеджера. Клиент спрашивает «сколько у меня на счёте и что со вчерашним переводом», а ответ собирают по кусочкам. В Lumiva карточка клиента в CRM и его личный кабинет на сайте — это одни и те же данные.',
  },
  card: {
    k: '02 · Карточка клиента',
    t: 'Всё о деньгах клиента — на одном экране.',
    lede: 'Балансы, реквизиты, профиль и операции клиента собраны в карточке CRM — менеджеру не нужно открывать сайт или просить выгрузку.',
    items: [
      { b: 'Балансы в EUR и USD', s: ' — отдельно по каждой валюте, с IBAN и номером счёта для каждой.' },
      { b: 'Контакты и материалы', s: ' — email, телефон, ссылка на аналитику клиента, список файлов и Telegram для связи.' },
      { b: 'Инвестиционный профиль', s: ' — стиль инвестирования, годовая доходность и доход в месяц в процентах.' },
      { b: 'Кредит и обслуживание', s: ' — кредитное плечо, ежемесячное погашение и списание за обслуживание счёта в процентах.' },
      { b: 'Операции и переводы', s: ' — вся история клиента в карточке, с суммами, валютами и статусами.' },
    ],
    vis: {
      client: 'ООО «Северный ветер»',
      email: 'finance@example.com',
      balances: 'Балансы',
      profile: 'Профиль',
      prof: [['Стиль', 'умеренный'], ['Доходность', '9% в год'], ['Плечо', '1:2'], ['Обслуживание', '0,2% в мес.']],
      ops: 'Операции',
      st: { progress: 'в работе', done: 'выполнено', fail: 'ошибка' },
      rows: [['Оплата услуг', 'EUR', -1860], ['Пополнение счёта', 'USD', 4200], ['Комиссия банка', 'EUR', -35]],
    },
  },
  ops: {
    k: '03 · Операции и переводы',
    t: 'Каждое движение денег — с суммой, валютой и статусом.',
    d: 'Операции и переводы создаются в CRM или в личном кабинете и сразу видны с обеих сторон.',
    items: [
      { t: 'Операции', d: 'Расходы клиента в EUR или USD с датой, названием, описанием и статусом.', ic: 'log' },
      { t: 'Переводы между клиентами', d: 'Отправитель, получатель, сумма, назначение и заметка — с привязкой к обоим клиентам.', ic: 'pipe' },
      { t: 'Конвертация', d: 'Перевод из EUR в USD и обратно: курс и итоговая сумма зачисления сохраняются в переводе.', ic: 'chart' },
      { t: 'Статусы', d: '«В работе», «Выполнено» или «Ошибка» — и клиент видит то же самое в личном кабинете.', ic: 'check' },
      { t: 'Журнал всех операций', d: 'Отдельный экран со всеми операциями и переводами всех клиентов, с поиском и фильтрами.', ic: 'grid' },
      { t: 'Правка из CRM', d: 'Ошиблись в сумме или статусе — правка в CRM уходит в личный кабинет клиента.', ic: 'bolt' },
    ],
  },
  sync: {
    k: '04 · Синхронизация с личным кабинетом',
    t: 'CRM и личный кабинет — одни и те же данные.',
    lede: 'Личный кабинет клиента работает на вашем сайте WordPress, а Lumiva держит его данные в синхроне с CRM в обе стороны.',
    items: [
      { b: 'Подключение по токену', s: ' — сайт с личным кабинетом подключается к CRM ключом доступа, без программистов.' },
      { b: 'Несколько порталов', s: ' — если у вас несколько сайтов с кабинетами, каждый подключается отдельно, а клиенты фильтруются по сайту.' },
      { b: 'Из кабинета в CRM', s: ' — новые клиенты, изменения балансов, операции и переводы приходят в CRM автоматически.' },
      { b: 'Из CRM в кабинет', s: ' — клиент, операция или перевод, созданные или исправленные в CRM, появляются у клиента в кабинете.' },
      { b: 'Свежие данные по запросу', s: ' — аналитику клиента можно обновить прямо с сайта одной кнопкой.' },
    ],
    vis: {
      crm: 'Lumiva CRM',
      portal: 'Личный кабинет · WordPress',
      log: 'Синхронизация',
      rows: [['→ CRM', 'Новый клиент · finance@example.com'], ['→ кабинет', 'Операция «Оплата услуг» · €1 860'], ['→ CRM', 'Статус перевода: выполнено'], ['→ кабинет', 'Баланс EUR обновлён']],
    },
  },
  analytics: {
    k: '05 · Аналитика клиента',
    t: 'Куда уходят деньги и сколько принесут.',
    lede: 'По каждому клиенту CRM считает балансы, расходы, переводы и ожидаемый результат по инвестициям, кредиту и обслуживанию.',
    items: [
      { b: 'Балансы и расходы', s: ' — текущие балансы в EUR и USD и сумма расходов по операциям.' },
      { b: 'Переводы', s: ' — входящие, исходящие и чистый поток за период.' },
      { b: 'Инвестиции', s: ' — сумма инвестиций по видам операций, стиль и ожидаемая доходность.' },
      { b: 'Ожидаемый результат', s: ' — доход по инвестициям, погашение кредита и списание за обслуживание в месяц, итог за месяц и за год.' },
    ],
    vis: { h: 'Аналитика · ООО «Северный ветер»', kpis: [['Баланс', '€48 200'], ['Расходы', '€6 940'], ['Ожидаемо в месяц', '+€310']], in: 'входящие', out: 'исходящие', net: 'чистый поток', months: ['Июл', 'Авг', 'Сен', 'Окт'] },
  },
  access: {
    k: '06 · Доступ и работа команды',
    t: 'Финансы клиентов — только тем, кому нужно.',
    d: 'Модуль встроен в CRM: права, вкладки аналитики и поиск работают так же, как в остальных разделах.',
    items: [
      { t: 'Права по ролям', d: 'Доступ к счетам клиентов открывается только нужным ролям — остальные сотрудники раздел не видят.', ic: 'shield' },
      { t: 'Поиск и фильтры', d: 'Список клиентов с поиском по имени и email и фильтром по подключённому сайту.', ic: 'filter' },
      { t: 'Аналитика по кнопке', d: 'Страница аналитики клиента обновляется прямо с сайта одной кнопкой — без ожидания синхронизации.', ic: 'chart' },
      { t: 'Тариф Enterprise', d: 'Счета клиентов входят в тариф Enterprise и выше — и доступны в 14-дневном пробном периоде.', ic: 'spark' },
    ],
  },
  pair: {
    spend: { title: 'Расходы клиентов по месяцам · пример', eur: 'EUR', usd: 'USD', rows: [['Июль', 18400, 9200], ['Август', 21600, 11800], ['Сентябрь', 19900, 14300], ['Октябрь', 24100, 12600]] },
    tr: { title: 'Переводы по месяцам · пример', inc: 'входящие', out: 'исходящие', rows: [['Июль', 32000, 21500], ['Август', 28400, 26100], ['Сентябрь', 41200, 30800], ['Октябрь', 37600, 24900]] },
  },
  steps: {
    k: '07 · Как это работает',
    t: 'От подключения сайта до полной картины по клиенту.',
    d: 'Четыре шага — и финансовый профиль клиента виден команде в CRM и самому клиенту в кабинете.',
    n: 'Шаг',
    items: [
      { t: 'Подключите сайт', d: 'Сайт с личным кабинетом на WordPress подключается к CRM по ключу доступа.' },
      { t: 'Получите клиентов', d: 'Клиенты, балансы в EUR и USD и реквизиты подтягиваются в CRM.' },
      { t: 'Ведите операции', d: 'Операции и переводы с курсом и статусом — из CRM или из кабинета, видно с обеих сторон.' },
      { t: 'Смотрите аналитику', d: 'Расходы, переводы и ожидаемый результат по каждому клиенту — в его карточке.' },
    ],
  },
  compare: {
    k: 'Сравнение',
    t: 'Lumiva vs таблица у бухгалтера',
    metric: 'Задача',
    a: 'Lumiva',
    b: 'Обычно',
    rows: [
      { metric: 'Баланс клиента', lumiva: 'В карточке CRM и в кабинете клиента — одни цифры', typical: 'Своя версия у бухгалтера, менеджера и клиента' },
      { metric: 'Переводы с конвертацией', lumiva: 'Курс и зачисленная сумма сохраняются в переводе', typical: 'Курс в комментарии или в голове' },
      { metric: 'Статус операции', lumiva: '«В работе», «выполнено», «ошибка» — видит и клиент', typical: 'Клиент звонит узнать, прошёл ли перевод' },
      { metric: 'Ожидаемый доход', lumiva: 'Считается по профилю клиента автоматически', typical: 'Пересчёт вручную в отдельной таблице' },
    ],
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Как устроен модуль',
        items: [
          { q: 'Что такое «Счета клиентов» в Lumiva?', a: 'Это финансовый профиль клиента в CRM, связанный с личным кабинетом клиента на вашем сайте WordPress. В CRM видны балансы, реквизиты, операции, переводы и аналитика, а клиент видит свои данные в кабинете — обе стороны синхронизированы.' },
          { q: 'Нужен ли сайт с личным кабинетом?', a: 'Да. Модуль работает в связке с личным кабинетом клиентов на WordPress: клиенты, операции и переводы хранятся и там, и в CRM. Сайт подключается к CRM по ключу доступа; можно подключить несколько сайтов.' },
          { q: 'В какую сторону идёт синхронизация?', a: 'В обе. Новые клиенты, изменения балансов, операции и переводы из кабинета приходят в CRM. То, что вы создали или исправили в CRM, уходит в кабинет клиента. Аналитику клиента можно в любой момент обновить с сайта.' },
          { q: 'На каком тарифе доступен модуль?', a: 'На тарифе Enterprise и выше. В 14-дневном пробном периоде, который даётся при регистрации, он тоже доступен.' },
        ],
      },
      {
        g: 'Балансы, операции и переводы',
        items: [
          { q: 'Какие валюты поддерживаются?', a: 'EUR и USD. У каждой валюты свой баланс, IBAN и номер счёта. Другие валюты в счетах клиентов пока не поддерживаются.' },
          { q: 'Как работают переводы с конвертацией?', a: 'В переводе указываются отправитель, получатель, сумма, исходная и целевая валюта и курс. Lumiva сохраняет итоговую сумму зачисления, поэтому всегда видно, сколько ушло и сколько пришло.' },
          { q: 'Какие статусы бывают у операций?', a: '«В работе», «Выполнено» и «Ошибка». Статус можно поменять в CRM — клиент увидит обновление в своём кабинете.' },
          { q: 'Есть ли лимиты, холды и автоблокировка?', a: 'Нет. Кредитное плечо и параметры погашения хранятся в профиле клиента и участвуют в расчётах аналитики, но лимитов, резервирования средств и автоматической блокировки операций в модуле нет.' },
        ],
      },
      {
        g: 'Аналитика и отчёты',
        items: [
          { q: 'Что показывает аналитика клиента?', a: 'Текущие балансы в EUR и USD, сумму расходов, входящие, исходящие и чистые переводы, инвестиции по видам операций, а также ожидаемый результат: доход по инвестициям, погашение кредита и списание за обслуживание — за месяц и за год.' },
          { q: 'Можно сформировать PDF-выписку или акт сверки?', a: 'Нет, генерации выписок и актов сверки в PDF в модуле нет. Данные операций и переводов доступны в журнале с поиском и фильтрами.' },
          { q: 'Подтягиваются ли операции из банка автоматически?', a: 'Нет, прямого подключения к банкам нет. Операции попадают в CRM из личного кабинета на сайте или создаются вручную в CRM.' },
        ],
      },
      {
        g: 'Доступ и начало работы',
        items: [
          { q: 'Кто из сотрудников видит счета клиентов?', a: 'Только те, кому открыт этот раздел в правах роли. Остальные сотрудники раздел не видят.' },
          { q: 'Связаны ли счета клиентов со сделками и контактами CRM?', a: 'Пока это отдельный раздел: клиенты счетов ведутся по данным личного кабинета и не связываются автоматически с контактами и сделками CRM.' },
          { q: 'Как начать?', a: 'Зарегистрируйтесь — 14 дней тарифа Enterprise бесплатно и без карты, — подключите сайт с личным кабинетом по ключу доступа, и клиенты подтянутся в CRM. Если нужна помощь с подключением, запишитесь на демо.' },
        ],
      },
    ],
  },
  cta: { k: 'Готовы посмотреть?', t: 'Подключим ваш личный кабинет и покажем счета клиентов в CRM за 30 минут.' },
};

const en: ClientAccountsText = {
  crumbs: ['Solutions', 'Client accounts'],
  kicker: 'Solution · Client accounts',
  t1: 'Every client\'s financial profile —',
  t2: 'in the CRM and in their personal account.',
  sub: 'EUR and USD balances, bank details, operations, transfers between accounts with exchange rates and the client\'s investment profile — in one CRM card. The data syncs both ways with the client\'s personal account on your WordPress site: your team and the client see the same numbers.',
  tryFree: 'Try for free',
  demo: 'Book a demo',
  demoNote: 'Example with demo data',
  stats: [
    { v: '2', l: 'account currencies — EUR and USD: each with its own balance, IBAN and account number' },
    { v: '3', l: 'operation and transfer statuses: in progress, done, failed' },
    { v: '2', l: 'sync directions: from the personal account to the CRM and back' },
    { v: '6', l: 'parameters of the client\'s investment and credit profile' },
  ],
  hero: {
    client: 'North Wind LLC',
    acc: 'Client account · personal portal',
    active: 'Synced',
    bal: 'Balance',
    ops: 'Recent operations',
    rows: [
      ['Transfer EUR → USD', 'rate 1.08 · credited $5,400', '−€5,000', 'done'],
      ['Service payment', 'today · in progress', '−€1,860', 'progress'],
      ['Incoming transfer', 'from client #1042', '+$2,150', 'done'],
    ],
  },
  prob: {
    k: '01 · The problem',
    t: 'A client\'s money lives in three places at once.',
    d: 'The balance is in the personal account on the website, the operation history in the accountant\'s spreadsheet, and credit and investment terms in a manager\'s chat. A client asks "how much is in my account and what happened to yesterday\'s transfer", and the answer is pieced together. In Lumiva the client card in the CRM and their personal account on the website are the same data.',
  },
  card: {
    k: '02 · Client card',
    t: 'Everything about a client\'s money — on one screen.',
    lede: 'Balances, bank details, profile and operations are gathered in the CRM card — a manager does not need to open the website or ask for an export.',
    items: [
      { b: 'EUR and USD balances', s: ' — separately for each currency, with an IBAN and account number for each.' },
      { b: 'Contacts and materials', s: ' — email, phone, a link to the client\'s analytics, a file list and Telegram for contact.' },
      { b: 'Investment profile', s: ' — investment style, annual return and monthly income in percent.' },
      { b: 'Credit and servicing', s: ' — credit leverage, monthly repayment and the monthly account servicing charge in percent.' },
      { b: 'Operations and transfers', s: ' — the client\'s full history in the card, with amounts, currencies and statuses.' },
    ],
    vis: {
      client: 'North Wind LLC',
      email: 'finance@example.com',
      balances: 'Balances',
      profile: 'Profile',
      prof: [['Style', 'moderate'], ['Return', '9% a year'], ['Leverage', '1:2'], ['Servicing', '0.2% a month']],
      ops: 'Operations',
      st: { progress: 'in progress', done: 'done', fail: 'failed' },
      rows: [['Service payment', 'EUR', -1860], ['Account top-up', 'USD', 4200], ['Bank fee', 'EUR', -35]],
    },
  },
  ops: {
    k: '03 · Operations and transfers',
    t: 'Every money movement — with amount, currency and status.',
    d: 'Operations and transfers are created in the CRM or in the personal account and are visible on both sides right away.',
    items: [
      { t: 'Operations', d: 'Client spending in EUR or USD with date, title, description and status.', ic: 'log' },
      { t: 'Transfers between clients', d: 'Sender, recipient, amount, purpose and a note — linked to both clients.', ic: 'pipe' },
      { t: 'Conversion', d: 'A transfer from EUR to USD and back: the rate and the credited amount are kept in the transfer.', ic: 'chart' },
      { t: 'Statuses', d: '"In progress", "Done" or "Failed" — and the client sees the same in their personal account.', ic: 'check' },
      { t: 'Log of all operations', d: 'A separate screen with every operation and transfer of every client, with search and filters.', ic: 'grid' },
      { t: 'Edit from the CRM', d: 'Got an amount or status wrong? The fix in the CRM goes to the client\'s personal account.', ic: 'bolt' },
    ],
  },
  sync: {
    k: '04 · Sync with the personal account',
    t: 'The CRM and the personal account — the same data.',
    lede: 'The client\'s personal account runs on your WordPress site, and Lumiva keeps its data in sync with the CRM both ways.',
    items: [
      { b: 'Connect by token', s: ' — the site with personal accounts connects to the CRM with an access key, no developers needed.' },
      { b: 'Several portals', s: ' — if you have several sites with personal accounts, each connects separately and clients are filtered by site.' },
      { b: 'From the portal to the CRM', s: ' — new clients, balance changes, operations and transfers arrive in the CRM automatically.' },
      { b: 'From the CRM to the portal', s: ' — a client, operation or transfer created or corrected in the CRM appears in the client\'s personal account.' },
      { b: 'Fresh data on request', s: ' — refresh a client\'s analytics straight from the website with one button.' },
    ],
    vis: {
      crm: 'Lumiva CRM',
      portal: 'Personal account · WordPress',
      log: 'Sync',
      rows: [['→ CRM', 'New client · finance@example.com'], ['→ portal', 'Operation "Service payment" · €1,860'], ['→ CRM', 'Transfer status: done'], ['→ portal', 'EUR balance updated']],
    },
  },
  analytics: {
    k: '05 · Client analytics',
    t: 'Where the money goes and what it will bring.',
    lede: 'For each client the CRM calculates balances, spending, transfers and the expected result from investments, credit and servicing.',
    items: [
      { b: 'Balances and spending', s: ' — current EUR and USD balances and total spending across operations.' },
      { b: 'Transfers', s: ' — incoming, outgoing and net flow for the period.' },
      { b: 'Investments', s: ' — investment amount by operation type, style and expected return.' },
      { b: 'Expected result', s: ' — investment income, credit repayment and the servicing charge per month, the total per month and per year.' },
    ],
    vis: { h: 'Analytics · North Wind LLC', kpis: [['Balance', '€48,200'], ['Spending', '€6,940'], ['Expected monthly', '+€310']], in: 'incoming', out: 'outgoing', net: 'net flow', months: ['Jul', 'Aug', 'Sep', 'Oct'] },
  },
  access: {
    k: '06 · Access and teamwork',
    t: 'Client finances — only for those who need them.',
    d: 'The module is built into the CRM: permissions, analytics tabs and search work just like everywhere else.',
    items: [
      { t: 'Role-based access', d: 'Client accounts are opened only to the roles that need them — other employees do not see the section.', ic: 'shield' },
      { t: 'Search and filters', d: 'A client list with search by name and email and a filter by connected site.', ic: 'filter' },
      { t: 'Analytics on demand', d: 'A client\'s analytics page refreshes straight from the website with one button — no waiting for sync.', ic: 'chart' },
      { t: 'Enterprise plan', d: 'Client accounts are part of the Enterprise plan and above — and available in the 14-day trial.', ic: 'spark' },
    ],
  },
  pair: {
    spend: { title: 'Client spending by month · example', eur: 'EUR', usd: 'USD', rows: [['July', 18400, 9200], ['August', 21600, 11800], ['September', 19900, 14300], ['October', 24100, 12600]] },
    tr: { title: 'Transfers by month · example', inc: 'incoming', out: 'outgoing', rows: [['July', 32000, 21500], ['August', 28400, 26100], ['September', 41200, 30800], ['October', 37600, 24900]] },
  },
  steps: {
    k: '07 · How it works',
    t: 'From connecting the site to a full client picture.',
    d: 'Four steps — and the client\'s financial profile is visible to the team in the CRM and to the client in their account.',
    n: 'Step',
    items: [
      { t: 'Connect the site', d: 'The WordPress site with personal accounts connects to the CRM with an access key.' },
      { t: 'Get your clients', d: 'Clients, their EUR and USD balances and bank details are pulled into the CRM.' },
      { t: 'Record operations', d: 'Operations and transfers with rate and status — from the CRM or the portal, visible on both sides.' },
      { t: 'See analytics', d: 'Spending, transfers and expected result for each client — in their card.' },
    ],
  },
  compare: {
    k: 'Comparison',
    t: 'Lumiva vs the accountant\'s spreadsheet',
    metric: 'Task',
    a: 'Lumiva',
    b: 'Usually',
    rows: [
      { metric: 'Client balance', lumiva: 'The same numbers in the CRM card and the client\'s portal', typical: 'Different versions for accountant, manager and client' },
      { metric: 'Transfers with conversion', lumiva: 'Rate and credited amount kept in the transfer', typical: 'The rate in a comment or in someone\'s head' },
      { metric: 'Operation status', lumiva: '"In progress", "done", "failed" — the client sees it too', typical: 'The client calls to ask if the transfer went through' },
      { metric: 'Expected income', lumiva: 'Calculated from the client profile automatically', typical: 'Recalculated by hand in a separate sheet' },
    ],
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'How the module works',
        items: [
          { q: 'What are "Client accounts" in Lumiva?', a: 'A client\'s financial profile in the CRM, connected to the client\'s personal account on your WordPress site. The CRM shows balances, bank details, operations, transfers and analytics, and the client sees their data in the personal account — both sides are in sync.' },
          { q: 'Do we need a site with personal accounts?', a: 'Yes. The module works together with client personal accounts on WordPress: clients, operations and transfers are stored both there and in the CRM. The site connects to the CRM with an access key; several sites can be connected.' },
          { q: 'Which way does sync go?', a: 'Both ways. New clients, balance changes, operations and transfers from the portal arrive in the CRM. What you create or correct in the CRM goes to the client\'s personal account. A client\'s analytics can be refreshed from the site at any time.' },
          { q: 'Which plan includes the module?', a: 'Enterprise and above. It is also available in the 14-day trial you get on sign-up.' },
        ],
      },
      {
        g: 'Balances, operations and transfers',
        items: [
          { q: 'Which currencies are supported?', a: 'EUR and USD. Each currency has its own balance, IBAN and account number. Other currencies are not supported in client accounts yet.' },
          { q: 'How do transfers with conversion work?', a: 'A transfer records the sender, recipient, amount, source and target currency and the rate. Lumiva keeps the credited amount, so you always see how much left and how much arrived.' },
          { q: 'What statuses do operations have?', a: '"In progress", "Done" and "Failed". Change the status in the CRM and the client sees the update in their personal account.' },
          { q: 'Are there limits, holds and automatic blocking?', a: 'No. Credit leverage and repayment terms are stored in the client profile and used in analytics calculations, but the module has no limits, fund reservations or automatic blocking of operations.' },
        ],
      },
      {
        g: 'Analytics and reports',
        items: [
          { q: 'What does client analytics show?', a: 'Current EUR and USD balances, total spending, incoming, outgoing and net transfers, investments by operation type, and the expected result: investment income, credit repayment and the servicing charge — per month and per year.' },
          { q: 'Can we generate a PDF statement or a reconciliation report?', a: 'No, the module does not generate PDF statements or reconciliation reports. Operations and transfers are available in the log with search and filters.' },
          { q: 'Are bank operations imported automatically?', a: 'No, there is no direct bank connection. Operations reach the CRM from the personal account on the website or are created manually in the CRM.' },
        ],
      },
      {
        g: 'Access and getting started',
        items: [
          { q: 'Which employees see client accounts?', a: 'Only those whose role has access to this section. Other employees do not see it.' },
          { q: 'Are client accounts linked to CRM deals and contacts?', a: 'Not yet — it is a separate section: account clients are kept from the personal-account data and are not linked automatically to CRM contacts and deals.' },
          { q: 'How do we start?', a: 'Sign up — 14 days of the Enterprise plan free, no card — connect the site with personal accounts using an access key, and clients will be pulled into the CRM. If you need help connecting, book a demo.' },
        ],
      },
    ],
  },
  cta: { k: 'Ready to see it?', t: 'We\'ll connect your personal accounts and show client accounts in the CRM in 30 minutes.' },
};

const tr: ClientAccountsText = {
  crumbs: ['Çözümler', 'Müşteri hesapları'],
  kicker: 'Çözüm · Müşteri hesapları',
  t1: 'Her müşterinin finansal profili —',
  t2: 'CRM\'de ve kendi hesabında.',
  sub: 'EUR ve USD bakiyeleri, banka bilgileri, işlemler, kurla hesaplar arası transferler ve müşterinin yatırım profili — tek bir CRM kartında. Veriler WordPress sitenizdeki müşteri paneliyle iki yönlü senkronize olur: ekibiniz ve müşteri aynı rakamları görür.',
  tryFree: 'Ücretsiz deneyin',
  demo: 'Demo ayarlayın',
  demoNote: 'Demo verilerle örnek',
  stats: [
    { v: '2', l: 'hesap para birimi — EUR ve USD: her birinin kendi bakiyesi, IBAN\'ı ve hesap numarası' },
    { v: '3', l: 'işlem ve transfer durumu: işlemde, tamamlandı, hata' },
    { v: '2', l: 'senkronizasyon yönü: müşteri panelinden CRM\'e ve geri' },
    { v: '6', l: 'müşterinin yatırım ve kredi profili parametresi' },
  ],
  hero: {
    client: 'Kuzey Rüzgârı Ltd.',
    acc: 'Müşteri hesabı · kişisel panel',
    active: 'Senkronize',
    bal: 'Bakiye',
    ops: 'Son işlemler',
    rows: [
      ['Transfer EUR → USD', 'kur 1,08 · yatırılan $5.400', '−€5.000', 'done'],
      ['Hizmet ödemesi', 'bugün · işlemde', '−€1.860', 'progress'],
      ['Gelen transfer', 'müşteri #1042\'den', '+$2.150', 'done'],
    ],
  },
  prob: {
    k: '01 · Sorun',
    t: 'Müşterinin parası aynı anda üç yerde yaşıyor.',
    d: 'Bakiye sitedeki kişisel panelde, işlem geçmişi muhasebecinin tablosunda, kredi ve yatırım koşulları yöneticinin yazışmalarında. Müşteri "hesabımda ne kadar var, dünkü transfer ne oldu" diye soruyor, yanıt parça parça toplanıyor. Lumiva\'da CRM\'deki müşteri kartı ve sitedeki kişisel paneli aynı veridir.',
  },
  card: {
    k: '02 · Müşteri kartı',
    t: 'Müşterinin parasıyla ilgili her şey — tek ekranda.',
    lede: 'Bakiyeler, banka bilgileri, profil ve işlemler CRM kartında toplanır — yöneticinin siteyi açması veya dışa aktarma istemesi gerekmez.',
    items: [
      { b: 'EUR ve USD bakiyeleri', s: ' — her para birimi için ayrı, her biri için IBAN ve hesap numarasıyla.' },
      { b: 'İletişim ve materyaller', s: ' — e-posta, telefon, müşteri analitiği bağlantısı, dosya listesi ve iletişim için Telegram.' },
      { b: 'Yatırım profili', s: ' — yatırım tarzı, yıllık getiri ve yüzde olarak aylık gelir.' },
      { b: 'Kredi ve hizmet', s: ' — kredi kaldıracı, aylık geri ödeme ve yüzde olarak aylık hesap hizmet kesintisi.' },
      { b: 'İşlemler ve transferler', s: ' — tutar, para birimi ve durumlarla müşterinin tüm geçmişi kartta.' },
    ],
    vis: {
      client: 'Kuzey Rüzgârı Ltd.',
      email: 'finance@example.com',
      balances: 'Bakiyeler',
      profile: 'Profil',
      prof: [['Tarz', 'ılımlı'], ['Getiri', 'yılda %9'], ['Kaldıraç', '1:2'], ['Hizmet', 'ayda %0,2']],
      ops: 'İşlemler',
      st: { progress: 'işlemde', done: 'tamamlandı', fail: 'hata' },
      rows: [['Hizmet ödemesi', 'EUR', -1860], ['Hesaba yatırma', 'USD', 4200], ['Banka komisyonu', 'EUR', -35]],
    },
  },
  ops: {
    k: '03 · İşlemler ve transferler',
    t: 'Her para hareketi — tutar, para birimi ve durumla.',
    d: 'İşlemler ve transferler CRM\'de veya kişisel panelde oluşturulur ve iki tarafta da anında görünür.',
    items: [
      { t: 'İşlemler', d: 'Tarih, başlık, açıklama ve durumla EUR veya USD cinsinden müşteri harcamaları.', ic: 'log' },
      { t: 'Müşteriler arası transferler', d: 'Gönderen, alıcı, tutar, amaç ve not — iki müşteriye de bağlı.', ic: 'pipe' },
      { t: 'Dönüştürme', d: 'EUR\'dan USD\'ye ve geri transfer: kur ve yatırılan tutar transferde saklanır.', ic: 'chart' },
      { t: 'Durumlar', d: '"İşlemde", "Tamamlandı" veya "Hata" — müşteri de kişisel panelinde aynısını görür.', ic: 'check' },
      { t: 'Tüm işlemler günlüğü', d: 'Tüm müşterilerin tüm işlem ve transferlerini arama ve filtrelerle gösteren ayrı ekran.', ic: 'grid' },
      { t: 'CRM\'den düzeltme', d: 'Tutarı veya durumu yanlış mı girdiniz? CRM\'deki düzeltme müşterinin paneline gider.', ic: 'bolt' },
    ],
  },
  sync: {
    k: '04 · Kişisel panelle senkronizasyon',
    t: 'CRM ve kişisel panel — aynı veri.',
    lede: 'Müşterinin kişisel paneli WordPress sitenizde çalışır, Lumiva verilerini CRM ile iki yönlü senkronize tutar.',
    items: [
      { b: 'Anahtarla bağlantı', s: ' — kişisel panelli site CRM\'e erişim anahtarıyla bağlanır, geliştirici gerekmez.' },
      { b: 'Birden fazla portal', s: ' — kişisel panelli birkaç siteniz varsa her biri ayrı bağlanır, müşteriler siteye göre filtrelenir.' },
      { b: 'Panelden CRM\'e', s: ' — yeni müşteriler, bakiye değişiklikleri, işlemler ve transferler CRM\'e otomatik gelir.' },
      { b: 'CRM\'den panele', s: ' — CRM\'de oluşturulan veya düzeltilen müşteri, işlem veya transfer müşterinin panelinde görünür.' },
      { b: 'İstek üzerine güncel veri', s: ' — müşteri analitiği tek düğmeyle doğrudan siteden güncellenir.' },
    ],
    vis: {
      crm: 'Lumiva CRM',
      portal: 'Kişisel panel · WordPress',
      log: 'Senkronizasyon',
      rows: [['→ CRM', 'Yeni müşteri · finance@example.com'], ['→ panel', '"Hizmet ödemesi" işlemi · €1.860'], ['→ CRM', 'Transfer durumu: tamamlandı'], ['→ panel', 'EUR bakiyesi güncellendi']],
    },
  },
  analytics: {
    k: '05 · Müşteri analitiği',
    t: 'Para nereye gidiyor, ne getirecek.',
    lede: 'CRM her müşteri için bakiyeleri, harcamaları, transferleri ve yatırım, kredi ve hizmetten beklenen sonucu hesaplar.',
    items: [
      { b: 'Bakiyeler ve harcamalar', s: ' — güncel EUR ve USD bakiyeleri ve işlemlerdeki toplam harcama.' },
      { b: 'Transferler', s: ' — dönem için gelen, giden ve net akış.' },
      { b: 'Yatırımlar', s: ' — işlem türüne göre yatırım tutarı, tarz ve beklenen getiri.' },
      { b: 'Beklenen sonuç', s: ' — aylık yatırım geliri, kredi geri ödemesi ve hizmet kesintisi, aylık ve yıllık toplam.' },
    ],
    vis: { h: 'Analitik · Kuzey Rüzgârı Ltd.', kpis: [['Bakiye', '€48.200'], ['Harcama', '€6.940'], ['Aylık beklenen', '+€310']], in: 'gelen', out: 'giden', net: 'net akış', months: ['Tem', 'Ağu', 'Eyl', 'Eki'] },
  },
  access: {
    k: '06 · Erişim ve ekip çalışması',
    t: 'Müşteri finansları — yalnızca ihtiyacı olanlara.',
    d: 'Modül CRM\'e yerleşiktir: yetkiler, analitik sekmeleri ve arama her yerdeki gibi çalışır.',
    items: [
      { t: 'Role göre erişim', d: 'Müşteri hesapları yalnızca ihtiyacı olan rollere açılır — diğer çalışanlar bölümü görmez.', ic: 'shield' },
      { t: 'Arama ve filtreler', d: 'Ad ve e-postaya göre arama ve bağlı siteye göre filtreli müşteri listesi.', ic: 'filter' },
      { t: 'Düğmeyle analitik', d: 'Müşterinin analitik sayfası tek düğmeyle doğrudan siteden güncellenir — senkronizasyonu beklemeden.', ic: 'chart' },
      { t: 'Enterprise planı', d: 'Müşteri hesapları Enterprise ve üzeri planlara dahildir — 14 günlük denemede de kullanılabilir.', ic: 'spark' },
    ],
  },
  pair: {
    spend: { title: 'Aylara göre müşteri harcamaları · örnek', eur: 'EUR', usd: 'USD', rows: [['Temmuz', 18400, 9200], ['Ağustos', 21600, 11800], ['Eylül', 19900, 14300], ['Ekim', 24100, 12600]] },
    tr: { title: 'Aylara göre transferler · örnek', inc: 'gelen', out: 'giden', rows: [['Temmuz', 32000, 21500], ['Ağustos', 28400, 26100], ['Eylül', 41200, 30800], ['Ekim', 37600, 24900]] },
  },
  steps: {
    k: '07 · Nasıl çalışır',
    t: 'Siteyi bağlamaktan müşterinin tam resmine.',
    d: 'Dört adım — müşterinin finansal profili ekibe CRM\'de, müşteriye panelinde görünür.',
    n: 'Adım',
    items: [
      { t: 'Siteyi bağlayın', d: 'Kişisel panelli WordPress sitesi erişim anahtarıyla CRM\'e bağlanır.' },
      { t: 'Müşterileri alın', d: 'Müşteriler, EUR ve USD bakiyeleri ve banka bilgileri CRM\'e aktarılır.' },
      { t: 'İşlemleri yürütün', d: 'Kur ve durumla işlemler ve transferler — CRM\'den veya panelden, iki tarafta da görünür.' },
      { t: 'Analitiği görün', d: 'Her müşterinin harcamaları, transferleri ve beklenen sonucu — kartında.' },
    ],
  },
  compare: {
    k: 'Karşılaştırma',
    t: 'Lumiva vs muhasebecinin tablosu',
    metric: 'Görev',
    a: 'Lumiva',
    b: 'Genelde',
    rows: [
      { metric: 'Müşteri bakiyesi', lumiva: 'CRM kartında ve müşteri panelinde aynı rakamlar', typical: 'Muhasebeci, yönetici ve müşteride farklı sürümler' },
      { metric: 'Dönüştürmeli transferler', lumiva: 'Kur ve yatırılan tutar transferde saklanır', typical: 'Kur bir yorumda veya birinin aklında' },
      { metric: 'İşlem durumu', lumiva: '"İşlemde", "tamamlandı", "hata" — müşteri de görür', typical: 'Müşteri transferin geçip geçmediğini sormak için arar' },
      { metric: 'Beklenen gelir', lumiva: 'Müşteri profilinden otomatik hesaplanır', typical: 'Ayrı tabloda elle yeniden hesaplanır' },
    ],
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Modül nasıl çalışır',
        items: [
          { q: 'Lumiva\'da "Müşteri hesapları" nedir?', a: 'WordPress sitenizdeki müşteri kişisel paneline bağlı, CRM\'deki müşteri finansal profilidir. CRM bakiyeleri, banka bilgilerini, işlemleri, transferleri ve analitiği gösterir; müşteri verilerini kendi panelinde görür — iki taraf senkronizedir.' },
          { q: 'Kişisel panelli bir site gerekli mi?', a: 'Evet. Modül WordPress\'teki müşteri kişisel panelleriyle birlikte çalışır: müşteriler, işlemler ve transferler hem orada hem CRM\'de saklanır. Site CRM\'e erişim anahtarıyla bağlanır; birden fazla site bağlanabilir.' },
          { q: 'Senkronizasyon hangi yönde?', a: 'İki yönde. Panelden yeni müşteriler, bakiye değişiklikleri, işlemler ve transferler CRM\'e gelir. CRM\'de oluşturduğunuz veya düzelttiğiniz şey müşterinin paneline gider. Müşteri analitiği istediğiniz zaman siteden güncellenebilir.' },
          { q: 'Modül hangi planda?', a: 'Enterprise ve üzeri. Kayıtta verilen 14 günlük denemede de kullanılabilir.' },
        ],
      },
      {
        g: 'Bakiyeler, işlemler ve transferler',
        items: [
          { q: 'Hangi para birimleri destekleniyor?', a: 'EUR ve USD. Her para biriminin kendi bakiyesi, IBAN\'ı ve hesap numarası vardır. Müşteri hesaplarında diğer para birimleri henüz desteklenmiyor.' },
          { q: 'Dönüştürmeli transferler nasıl çalışır?', a: 'Transferde gönderen, alıcı, tutar, kaynak ve hedef para birimi ile kur belirtilir. Lumiva yatırılan tutarı saklar, böylece ne kadar çıktığı ve ne kadar geldiği her zaman görünür.' },
          { q: 'İşlemlerin hangi durumları var?', a: '"İşlemde", "Tamamlandı" ve "Hata". Durumu CRM\'de değiştirin, müşteri güncellemeyi kendi panelinde görür.' },
          { q: 'Limitler, blokajlar ve otomatik engelleme var mı?', a: 'Hayır. Kredi kaldıracı ve geri ödeme koşulları müşteri profilinde saklanır ve analitik hesaplarında kullanılır, ancak modülde limit, fon rezervasyonu veya işlemlerin otomatik engellenmesi yoktur.' },
        ],
      },
      {
        g: 'Analitik ve raporlar',
        items: [
          { q: 'Müşteri analitiği neyi gösterir?', a: 'Güncel EUR ve USD bakiyeleri, toplam harcama, gelen, giden ve net transferler, işlem türüne göre yatırımlar ve beklenen sonuç: yatırım geliri, kredi geri ödemesi ve hizmet kesintisi — aylık ve yıllık.' },
          { q: 'PDF ekstre veya mutabakat raporu oluşturabilir miyiz?', a: 'Hayır, modül PDF ekstre veya mutabakat raporu oluşturmaz. İşlemler ve transferler arama ve filtrelerle günlükte mevcuttur.' },
          { q: 'Banka işlemleri otomatik aktarılıyor mu?', a: 'Hayır, bankalara doğrudan bağlantı yok. İşlemler CRM\'e sitedeki kişisel panelden gelir veya CRM\'de elle oluşturulur.' },
        ],
      },
      {
        g: 'Erişim ve başlangıç',
        items: [
          { q: 'Hangi çalışanlar müşteri hesaplarını görür?', a: 'Yalnızca rolünde bu bölüme erişim olanlar. Diğer çalışanlar bölümü görmez.' },
          { q: 'Müşteri hesapları CRM satışları ve kişileriyle bağlantılı mı?', a: 'Henüz değil — ayrı bir bölümdür: hesap müşterileri kişisel panel verilerinden tutulur ve CRM kişileri ve satışlarıyla otomatik bağlanmaz.' },
          { q: 'Nasıl başlarız?', a: 'Kaydolun — Enterprise planı 14 gün ücretsiz ve kartsız —, kişisel panelli siteyi erişim anahtarıyla bağlayın, müşteriler CRM\'e aktarılır. Bağlantı için yardım gerekirse demo ayarlayın.' },
        ],
      },
    ],
  },
  cta: { k: 'Görmeye hazır mısınız?', t: 'Kişisel panelinizi bağlayalım ve müşteri hesaplarını 30 dakikada CRM\'de gösterelim.' },
};

export const CLIENT_ACCOUNTS_T: Record<'ru' | 'en' | 'tr', ClientAccountsText> = { ru, en, tr };
