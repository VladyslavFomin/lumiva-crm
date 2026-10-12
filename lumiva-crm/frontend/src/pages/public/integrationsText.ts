/* Страница «Интеграции» (ru/en/tr). Каталог — из backend integrations/catalog/integration-hub-catalog.ts
 * (lifecycle live/beta + capabilities) плюс реальные подключения вне каталога: телефония Twilio, Search Console +
 * PageSpeed (SEO), Anthropic (свой ключ), Notion / Canva / GitHub (подключения ИИ-отделов, Enterprise+).
 * Не выдумывать: TikTok, myTarget, Salesforce, Zoho, Viber, Sipuni, Zadarma, Mango, UIS, Roistat, Calltouch, Albato —
 * их нет. Нет «подключим за 5 дней», «98.9%», «80+». */

export type Lang = 'ru' | 'en' | 'tr';
export type Cap = 'leads' | 'actions' | 'webhook' | 'oauth' | 'sales' | 'sheets' | 'calendar';
export type CatKey = 'ads' | 'comms' | 'crm' | 'shop' | 'work' | 'ai';
export type Status = 'live' | 'beta' | 'office';

export type Conn = {
  id: string;
  name: string;
  cat: CatKey;
  letter: string;
  bg: string;
  fg: string;
  svg?: 'meta' | 'google' | 'woo' | 'vk' | 'yandex' | 'telegram';
  status: Status;
  caps: Cap[];
  d: Record<Lang, string>;
};

export const CONNECTORS: Conn[] = [
  // реклама и аналитика
  { id: 'google_ads', name: 'Google Ads', cat: 'ads', letter: 'G', bg: '#fff', fg: '#4285f4', svg: 'google', status: 'beta', caps: ['oauth', 'actions'], d: { ru: 'Расходы, показы, клики и кампании', en: 'Spend, impressions, clicks and campaigns', tr: 'Harcama, gösterim, tıklama ve kampanyalar' } },
  { id: 'meta_ads', name: 'Meta Ads', cat: 'ads', letter: '∞', bg: '#fff', fg: '#0866ff', svg: 'meta', status: 'beta', caps: ['oauth', 'actions'], d: { ru: 'Facebook и Instagram, несколько кабинетов', en: 'Facebook and Instagram, several ad accounts', tr: 'Facebook ve Instagram, birden fazla hesap' } },
  { id: 'yandex_direct', name: 'Яндекс Директ', cat: 'ads', letter: 'Я', bg: '#fff', fg: '#fc3f1d', svg: 'yandex', status: 'beta', caps: [], d: { ru: 'Расходы и статистика кампаний', en: 'Spend and campaign stats', tr: 'Harcama ve kampanya istatistikleri' } },
  { id: 'vk_ads', name: 'VK Реклама', cat: 'ads', letter: 'VK', bg: '#fff', fg: '#0077ff', svg: 'vk', status: 'beta', caps: [], d: { ru: 'Расходы и результаты кампаний VK', en: 'VK campaign spend and results', tr: 'VK kampanya harcama ve sonuçları' } },
  { id: 'google_analytics', name: 'Google Analytics 4', cat: 'ads', letter: 'G4', bg: '#f9ab00', fg: '#fff', status: 'beta', caps: ['oauth', 'actions'], d: { ru: 'Сессии, страны и выручка по GA4', en: 'Sessions, countries and GA4 revenue', tr: 'Oturumlar, ülkeler ve GA4 cirosu' } },
  { id: 'yandex_metrika', name: 'Яндекс Метрика', cat: 'ads', letter: 'YM', bg: '#fc3f1d', fg: '#fff', status: 'beta', caps: [], d: { ru: 'Визиты и переходы по UTM-ссылкам', en: 'Visits and UTM link clicks', tr: 'Ziyaretler ve UTM bağlantı geçişleri' } },
  { id: 'search_console', name: 'Search Console + PageSpeed', cat: 'ads', letter: 'SC', bg: '#1a73e8', fg: '#fff', status: 'live', caps: [], d: { ru: 'Клики из поиска, позиции и скорость сайта', en: 'Search clicks, positions and site speed', tr: 'Arama tıklamaları, sıralama ve site hızı' } },
  // мессенджеры и связь
  { id: 'whatsapp', name: 'WhatsApp Business', cat: 'comms', letter: 'WA', bg: '#25d366', fg: '#fff', status: 'beta', caps: ['leads', 'webhook', 'actions'], d: { ru: 'Сообщения в лиды, ответы из карточки', en: 'Messages to leads, replies from the card', tr: 'Mesajlar talebe, karttan yanıt' } },
  { id: 'telegram', name: 'Telegram', cat: 'comms', letter: 'TG', bg: '#fff', fg: '#29a9eb', svg: 'telegram', status: 'live', caps: ['leads', 'webhook', 'actions'], d: { ru: 'Боты, переписка и уведомления', en: 'Bots, chats and notifications', tr: 'Botlar, yazışma ve bildirimler' } },
  { id: 'email', name: 'Email', cat: 'comms', letter: '@', bg: '#111113', fg: '#c8f560', status: 'live', caps: ['leads', 'actions'], d: { ru: 'Почтовые ящики, письма и рассылки', en: 'Mailboxes, emails and campaigns', tr: 'Posta kutuları, e-postalar ve kampanyalar' } },
  { id: 'sms', name: 'SMS', cat: 'comms', letter: 'SMS', bg: '#111113', fg: '#c8f560', status: 'live', caps: ['actions'], d: { ru: 'SMS из карточки и автоматизаций', en: 'SMS from the card and automations', tr: 'Karttan ve otomasyonlardan SMS' } },
  { id: 'twilio', name: 'Twilio · телефония', cat: 'comms', letter: 'TW', bg: '#f22f46', fg: '#fff', status: 'live', caps: ['webhook'], d: { ru: 'Звонки в клик, запись и расшифровка', en: 'Click-to-call, recording and transcription', tr: 'Tek tıkla arama, kayıt ve döküm' } },
  { id: 'lumiva_online_chat', name: 'Онлайн-чат Lumiva', cat: 'comms', letter: 'LC', bg: '#111113', fg: '#fff', status: 'live', caps: ['leads'], d: { ru: 'Виджет на сайт с ИИ-консультантом', en: 'Website widget with an AI consultant', tr: 'Yapay zekâ danışmanlı site widget\'ı' } },
  { id: 'slack', name: 'Slack', cat: 'comms', letter: '#', bg: '#4a154b', fg: '#fff', status: 'beta', caps: ['actions', 'webhook', 'leads'], d: { ru: 'Сообщения в каналы из автоматизаций', en: 'Channel messages from automations', tr: 'Otomasyonlardan kanal mesajları' } },
  { id: 'ms_teams', name: 'Microsoft Teams', cat: 'comms', letter: 'T', bg: '#5059c9', fg: '#fff', status: 'live', caps: ['actions'], d: { ru: 'Уведомления команде из автоматизаций', en: 'Team notifications from automations', tr: 'Otomasyonlardan ekip bildirimleri' } },
  // CRM и ERP
  { id: 'amocrm', name: 'amoCRM', cat: 'crm', letter: 'am', bg: '#2a5bd7', fg: '#fff', status: 'beta', caps: ['actions', 'webhook', 'leads'], d: { ru: 'Передача и приём сделок', en: 'Sending and receiving deals', tr: 'Satış gönderme ve alma' } },
  { id: 'bitrix', name: 'Bitrix24', cat: 'crm', letter: 'B24', bg: '#2fc7f7', fg: '#fff', status: 'beta', caps: ['actions'], d: { ru: 'Передача лидов и задач', en: 'Sending leads and tasks', tr: 'Talep ve görev aktarımı' } },
  { id: 'hubspot', name: 'HubSpot', cat: 'crm', letter: 'HS', bg: '#ff7a59', fg: '#fff', status: 'beta', caps: ['actions'], d: { ru: 'Передача контактов и сделок', en: 'Sending contacts and deals', tr: 'Kişi ve satış aktarımı' } },
  { id: '1c', name: '1С', cat: 'crm', letter: '1С', bg: '#ffd400', fg: '#c4141b', status: 'beta', caps: ['webhook', 'sales', 'leads'], d: { ru: 'Приём продаж и данных по вебхуку', en: 'Receiving sales and data via webhook', tr: 'Webhook ile satış ve veri alımı' } },
  { id: 'sap', name: 'SAP', cat: 'crm', letter: 'SAP', bg: '#0070f2', fg: '#fff', status: 'beta', caps: ['webhook', 'leads'], d: { ru: 'Приём данных по вебхуку', en: 'Receiving data via webhook', tr: 'Webhook ile veri alımı' } },
  // магазины и платежи
  { id: 'woocommerce', name: 'WooCommerce', cat: 'shop', letter: 'Woo', bg: '#fff', fg: '#7f54b3', svg: 'woo', status: 'live', caps: ['sales'], d: { ru: 'Заказы как продажи, статус обратно', en: 'Orders as sales, status sent back', tr: 'Siparişler satış olarak, durum geri' } },
  { id: 'shopify', name: 'Shopify', cat: 'shop', letter: 'S', bg: '#95bf47', fg: '#fff', status: 'beta', caps: ['sales'], d: { ru: 'Заказы как продажи и лиды', en: 'Orders as sales and leads', tr: 'Siparişler satış ve talep olarak' } },
  { id: 'wordpress_cf7', name: 'WordPress · CF7', cat: 'shop', letter: 'WP', bg: '#21759b', fg: '#fff', status: 'live', caps: ['leads', 'webhook'], d: { ru: 'Заявки из форм сайта', en: 'Requests from website forms', tr: 'Site formlarından talepler' } },
  { id: 'lumiva_client_cabinet', name: 'Личный кабинет Lumiva', cat: 'shop', letter: 'LK', bg: '#111113', fg: '#c8f560', status: 'live', caps: [], d: { ru: 'Счета клиентов на вашем сайте', en: 'Client accounts on your website', tr: 'Sitenizde müşteri hesapları' } },
  { id: 'iyzico', name: 'iyzico', cat: 'shop', letter: 'iy', bg: '#1e64ff', fg: '#fff', status: 'beta', caps: [], d: { ru: 'Ссылки на оплату для Турции', en: 'Payment links for Turkey', tr: 'Türkiye için ödeme bağlantıları' } },
  { id: 'paytr', name: 'PayTR', cat: 'shop', letter: 'PT', bg: '#0b2a4a', fg: '#fff', status: 'beta', caps: [], d: { ru: 'Ссылки на оплату для Турции', en: 'Payment links for Turkey', tr: 'Türkiye için ödeme bağlantıları' } },
  { id: 'yookassa', name: 'ЮKassa', cat: 'shop', letter: 'Ю', bg: '#0070f0', fg: '#fff', status: 'beta', caps: [], d: { ru: 'Ссылки на оплату для России', en: 'Payment links for Russia', tr: 'Rusya için ödeme bağlantıları' } },
  // работа и продуктивность
  { id: 'google_calendar', name: 'Google Calendar', cat: 'work', letter: '31', bg: '#fff', fg: '#3b78e7', status: 'beta', caps: ['oauth', 'calendar', 'actions'], d: { ru: 'Встречи и задачи в календаре', en: 'Meetings and tasks in the calendar', tr: 'Takvimde toplantılar ve görevler' } },
  { id: 'outlook', name: 'Outlook Calendar', cat: 'work', letter: 'O', bg: '#0078d4', fg: '#fff', status: 'beta', caps: ['oauth', 'calendar', 'actions'], d: { ru: 'Синхронизация календаря Microsoft', en: 'Microsoft calendar sync', tr: 'Microsoft takvim senkronizasyonu' } },
  { id: 'google_sheets', name: 'Google Sheets', cat: 'work', letter: 'GS', bg: '#1f9d55', fg: '#fff', status: 'live', caps: ['oauth', 'sheets'], d: { ru: 'Таблицы рабочих областей ↔ Sheets', en: 'Workspace tables ↔ Sheets', tr: 'Çalışma alanı tabloları ↔ Sheets' } },
  { id: 'jira', name: 'Jira', cat: 'work', letter: 'J', bg: '#2684ff', fg: '#fff', status: 'beta', caps: ['actions', 'webhook'], d: { ru: 'Задачи из CRM в Jira и обратно', en: 'Tasks from the CRM to Jira and back', tr: 'CRM\'den Jira\'ya görevler ve geri' } },
  { id: 'mailchimp', name: 'Mailchimp', cat: 'work', letter: 'MC', bg: '#ffe01b', fg: '#241c15', status: 'beta', caps: ['actions'], d: { ru: 'Контакты в списки рассылок', en: 'Contacts to mailing lists', tr: 'Kişiler e-posta listelerine' } },
  { id: 'notion', name: 'Notion', cat: 'work', letter: 'N', bg: '#111', fg: '#fff', status: 'office', caps: [], d: { ru: 'Документы для ИИ-отделов', en: 'Documents for AI departments', tr: 'Yapay zekâ departmanları için belgeler' } },
  { id: 'canva', name: 'Canva', cat: 'work', letter: 'C', bg: '#00c4cc', fg: '#fff', status: 'office', caps: [], d: { ru: 'Дизайны для контент-отдела', en: 'Designs for the content department', tr: 'İçerik departmanı için tasarımlar' } },
  { id: 'github', name: 'GitHub', cat: 'work', letter: 'GH', bg: '#24292f', fg: '#fff', status: 'office', caps: [], d: { ru: 'Задачи и ревью для отдела разработки', en: 'Issues and reviews for the dev department', tr: 'Geliştirme departmanı için görevler ve inceleme' } },
  // no-code и ИИ
  { id: 'zapier', name: 'Zapier', cat: 'ai', letter: 'Z', bg: '#ff4a00', fg: '#fff', status: 'beta', caps: ['actions', 'webhook', 'leads'], d: { ru: 'Тысячи сервисов через сценарии', en: 'Thousands of apps through zaps', tr: 'Senaryolarla binlerce servis' } },
  { id: 'make', name: 'Make', cat: 'ai', letter: 'M', bg: '#6d00cc', fg: '#fff', status: 'beta', caps: ['actions', 'webhook', 'leads'], d: { ru: 'Визуальные сценарии обмена данными', en: 'Visual data exchange scenarios', tr: 'Görsel veri alışverişi senaryoları' } },
  { id: 'openai', name: 'OpenAI', cat: 'ai', letter: 'AI', bg: '#111', fg: '#fff', status: 'beta', caps: ['actions'], d: { ru: 'Свой ключ для ИИ-ассистента и сотрудников', en: 'Your own key for the AI assistant and employees', tr: 'Yapay zekâ asistanı ve çalışanları için kendi anahtarınız' } },
  { id: 'anthropic', name: 'Anthropic Claude', cat: 'ai', letter: 'A', bg: '#d97757', fg: '#fff', status: 'live', caps: [], d: { ru: 'Свой ключ для ИИ-ассистента и сотрудников', en: 'Your own key for the AI assistant and employees', tr: 'Yapay zekâ asistanı ve çalışanları için kendi anahtarınız' } },
];

export const CATS: CatKey[] = ['ads', 'comms', 'crm', 'shop', 'work', 'ai'];
export const HUB_IDS = ['google_ads', 'meta_ads', 'whatsapp', 'telegram', 'amocrm', 'woocommerce', 'google_sheets', 'zapier'];

type QA = { q: string; a: string };
export type IntText = {
  kick: string;
  h1a: string;
  h1b: string;
  sub: string;
  cta1: string;
  cta2: string;
  stats: Array<{ v: string; l: string }>;
  all: string;
  cats: Record<CatKey, string>;
  search: string;
  empty: string;
  emptyLink: string;
  st: Record<Status, string>;
  caps: Record<Cap, string>;
  legend: string;
  hub: { h: string; sync: string; note: string; events: string[] };
  what: { k: string; t: string; d: string; items: Array<{ t: string; d: string; ic: string }> };
  how: { k: string; t: string; items: Array<[string, string, string]> };
  api: { k: string; t: string; d: string; items: Array<{ t: string; d: string; ic: string }> };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: QA[] }> };
  cta: { k: string; t: string; b1: string; b2: string };
};

const ru: IntText = {
  kick: 'Интеграции',
  h1a: 'Ваши данные — там,',
  h1b: 'где нужно бизнесу.',
  sub: 'Подключите к CRM рекламные кабинеты, мессенджеры, почту и телефонию, магазины и платёжные системы, другие CRM, календари и таблицы. Заявки приходят сами, автоматизации отправляют данные дальше, а расходы и продажи считаются в одном месте.',
  cta1: 'Смотреть каталог',
  cta2: 'Запросить интеграцию',
  stats: [
    { v: '40', l: 'подключений в каталоге — реклама, связь, CRM, магазины, работа и ИИ' },
    { v: '4', l: 'рекламных кабинета: Google Ads, Meta, Яндекс Директ, VK Реклама' },
    { v: '3', l: 'платёжные системы для ссылок на оплату: iyzico, PayTR, ЮKassa' },
    { v: '7', l: 'видов возможностей: от приёма лидов до синхронизации таблиц и календаря' },
  ],
  all: 'Все',
  cats: { ads: 'Реклама и аналитика', comms: 'Мессенджеры и связь', crm: 'CRM и ERP', shop: 'Магазины и платежи', work: 'Работа и команды', ai: 'No-code и ИИ' },
  search: 'Найти подключение',
  empty: 'Ничего не нашли.',
  emptyLink: 'Напишите, что нужно подключить',
  st: { live: 'работает', beta: 'бета', office: 'ИИ-отделы' },
  caps: { leads: 'Лиды', actions: 'Автоматизации', webhook: 'Вебхук', oauth: 'Вход в аккаунт', sales: 'Продажи', sheets: 'Таблицы', calendar: 'Календарь' },
  legend: '«Бета» — подключение работает, но мы ещё дорабатываем сценарии. «ИИ-отделы» — подключение для ИИ-отделов на тарифах Enterprise и Ultimate.',
  hub: { h: 'Lumiva CRM · интеграции', sync: 'Синхронизация', note: 'Пример событий', events: ['лид создан', 'расход обновлён', 'сообщение получено', 'заказ стал продажей', 'строка таблицы обновлена', 'задача отправлена'] },
  what: {
    k: 'Что умеет интеграция',
    t: 'Семь способов связать CRM с другими сервисами.',
    d: 'У каждого подключения в каталоге отмечено, что именно оно умеет. Вот что означают эти метки.',
    items: [
      { t: 'Лиды', d: 'Обращения из сервиса сами становятся лидами — с каналом и источником.', ic: 'funnel' },
      { t: 'Автоматизации', d: 'Сценарии CRM отправляют в сервис сообщения, задачи, контакты или сделки.', ic: 'bolt' },
      { t: 'Вебхук', d: 'Сервис сам сообщает CRM о событиях — без ожидания и ручных выгрузок.', ic: 'pipe' },
      { t: 'Вход в аккаунт', d: 'Подключение через официальный вход в аккаунт сервиса (OAuth), без копирования ключей.', ic: 'shield' },
      { t: 'Продажи', d: 'Заказы и продажи из магазина или учётной системы попадают в раздел продаж.', ic: 'chart' },
      { t: 'Таблицы', d: 'Таблицы рабочих областей синхронизируются с внешними таблицами по расписанию.', ic: 'grid' },
      { t: 'Календарь', d: 'Встречи и задачи CRM появляются во внешнем календаре.', ic: 'cal' },
    ],
  },
  how: {
    k: 'Как устроено подключение',
    t: 'Четыре слоя надёжности.',
    items: [
      ['Подключение в один экран', 'В разделе «Интеграции» CRM видно, что подключено, что требует входа в аккаунт и что ещё не настроено.', 'zap'],
      ['Вход вместо ключей', 'Google, Meta, календари и таблицы подключаются через официальный вход в аккаунт; токены обновляются автоматически.', 'shield'],
      ['Защищённые вебхуки', 'Входящие запросы WhatsApp, WooCommerce и платёжных систем проверяются по подписи, а частота запросов ограничена.', 'check'],
      ['Контроль доступа', 'О скором истечении доступа к кабинету Meta CRM предупреждает заранее, а кто может подключать сервисы — решают права ролей.', 'eye'],
    ],
  },
  api: {
    k: 'Нет нужного подключения?',
    t: 'API и вебхуки — для всего остального.',
    d: 'Если сервиса нет в каталоге, данные всё равно можно связать с CRM.',
    items: [
      { t: 'Приём лидов по API', d: 'POST-запрос с токеном сайта — с любого сайта, лендинга, бота или из n8n.', ic: 'funnel' },
      { t: 'Вебхуки из автоматизаций', d: 'Сценарий CRM отправляет данные на ваш адрес при любом событии.', ic: 'pipe' },
      { t: 'Zapier и Make', d: 'Тысячи сервисов через готовые no-code-сценарии.', ic: 'bolt' },
      { t: 'Каталог и остатки', d: 'Публичный API каталога, фиды Google Merchant и CSV для WooCommerce, вебхуки товаров.', ic: 'box' },
    ],
  },
  faq: {
    k: 'FAQ',
    t: 'Ответы на частые вопросы',
    note: 'Не нашли ответ?',
    write: 'Напишите нам',
    groups: [
      {
        g: 'Подключение',
        items: [
          { q: 'Как подключить сервис?', a: 'В CRM откройте раздел «Интеграции», выберите сервис и следуйте подсказкам. Google, Meta, календари и Google Sheets подключаются через вход в аккаунт сервиса, остальные — по ключу доступа или адресу вебхука, который CRM показывает в настройках.' },
          { q: 'Нужен ли программист?', a: 'Для подключений из каталога — нет. Программист может понадобиться, только если вы связываете CRM с собственной системой через API или вебхуки.' },
          { q: 'Что значит «бета»?', a: 'Подключение работает и им можно пользоваться, но мы ещё расширяем его сценарии и дорабатываем по отзывам клиентов. Отметка «работает» стоит у подключений, которые давно используются без изменений.' },
          { q: 'Что значит «ИИ-отделы»?', a: 'Notion, Canva и GitHub подключаются к ИИ-отделам: например, контент-отдел использует Canva, а отдел разработки — GitHub. ИИ-отделы доступны на тарифах Enterprise и Ultimate.' },
        ],
      },
      {
        g: 'Реклама, связь и продажи',
        items: [
          { q: 'Какие рекламные кабинеты подключаются?', a: 'Google Ads, Meta Ads (несколько кабинетов), Яндекс Директ и VK Реклама. Расходы подтягиваются автоматически и пересчитываются в одну валюту. Для веб-аналитики — Google Analytics 4 и Яндекс Метрика, для SEO — Search Console и PageSpeed.' },
          { q: 'Какие мессенджеры и каналы связи есть?', a: 'WhatsApp Business, Telegram, почтовые ящики, SMS, онлайн-чат Lumiva на сайте и телефония Twilio со звонками в клик, записью и расшифровкой. Для уведомлений команды — Slack и Microsoft Teams.' },
          { q: 'Можно связать CRM с другим CRM?', a: 'Да. Для amoCRM, Bitrix24 и HubSpot автоматизации передают лиды, контакты и сделки; из amoCRM данные можно и принимать. 1С и SAP отправляют данные в CRM по вебхуку.' },
          { q: 'Какие магазины и платёжные системы подключаются?', a: 'Заказы WooCommerce и Shopify становятся продажами, формы WordPress (Contact Form 7) — лидами. Ссылки на оплату формируются через iyzico и PayTR для Турции и ЮKassa для России.' },
        ],
      },
      {
        g: 'Данные и безопасность',
        items: [
          { q: 'Как защищены входящие данные?', a: 'Входящие вебхуки WhatsApp, WooCommerce и платёжных систем проверяются по подписи, а частота входящих запросов ограничена. Заявки с сайта принимаются только с домена, указанного для токена.' },
          { q: 'Кто может подключать сервисы?', a: 'Это задаётся правами ролей. Обычные сотрудники пользуются подключёнными интеграциями, но не меняют их настройки, если у них нет такого права.' },
          { q: 'Что будет, если доступ к кабинету истечёт?', a: 'Для кабинетов Meta CRM заранее присылает напоминание, чтобы вы успели обновить доступ. Подключения через вход в аккаунт Google и Microsoft обновляют токены автоматически.' },
        ],
      },
      {
        g: 'Если сервиса нет в каталоге',
        items: [
          { q: 'Нужного сервиса нет — что делать?', a: 'Есть три пути: Zapier или Make с тысячами готовых сервисов, приём лидов по API с токеном сайта (подойдёт и n8n) и вебхуки из автоматизаций CRM. Если нужна прямая интеграция — напишите нам, мы учитываем такие запросы при планировании.' },
          { q: 'Можно попробовать интеграции бесплатно?', a: 'Да. Регистрация даёт 14 дней тарифа Enterprise бесплатно и без карты — в нём доступны все интеграции, включая подключения ИИ-отделов.' },
        ],
      },
    ],
  },
  cta: { k: 'Не нашли нужное подключение?', t: 'Напишите, какой сервис нужен, — подскажем, как связать его с CRM уже сейчас.', b1: 'Запросить интеграцию', b2: 'Попробовать бесплатно' },
};

const en: IntText = {
  kick: 'Integrations',
  h1a: 'Your data — where',
  h1b: 'the business needs it.',
  sub: 'Connect ad accounts, messengers, email and telephony, stores and payment systems, other CRMs, calendars and spreadsheets to the CRM. Leads arrive on their own, automations send data onwards, and spend and sales are counted in one place.',
  cta1: 'Browse the catalogue',
  cta2: 'Request an integration',
  stats: [
    { v: '40', l: 'connections in the catalogue — ads, communication, CRM, stores, work and AI' },
    { v: '4', l: 'ad platforms: Google Ads, Meta, Yandex Direct, VK Ads' },
    { v: '3', l: 'payment systems for payment links: iyzico, PayTR, YooKassa' },
    { v: '7', l: 'kinds of capabilities: from lead capture to spreadsheet and calendar sync' },
  ],
  all: 'All',
  cats: { ads: 'Ads and analytics', comms: 'Messengers and calls', crm: 'CRM and ERP', shop: 'Stores and payments', work: 'Work and teams', ai: 'No-code and AI' },
  search: 'Find a connection',
  empty: 'Nothing found.',
  emptyLink: 'Tell us what you need to connect',
  st: { live: 'live', beta: 'beta', office: 'AI departments' },
  caps: { leads: 'Leads', actions: 'Automations', webhook: 'Webhook', oauth: 'Sign-in', sales: 'Sales', sheets: 'Sheets', calendar: 'Calendar' },
  legend: '"Beta" means the connection works, but we are still extending its scenarios. "AI departments" means a connection for AI departments on the Enterprise and Ultimate plans.',
  hub: { h: 'Lumiva CRM · integrations', sync: 'Sync', note: 'Example events', events: ['lead created', 'spend updated', 'message received', 'order became a sale', 'sheet row updated', 'task sent'] },
  what: {
    k: 'What an integration does',
    t: 'Seven ways to connect the CRM with other services.',
    d: 'Every connection in the catalogue is labelled with what it can do. Here is what the labels mean.',
    items: [
      { t: 'Leads', d: 'Requests from the service become leads on their own — with channel and source.', ic: 'funnel' },
      { t: 'Automations', d: 'CRM scenarios send messages, tasks, contacts or deals to the service.', ic: 'bolt' },
      { t: 'Webhook', d: 'The service tells the CRM about events itself — no waiting and no manual exports.', ic: 'pipe' },
      { t: 'Sign-in', d: 'Connect through the service\'s official account sign-in (OAuth), without copying keys.', ic: 'shield' },
      { t: 'Sales', d: 'Orders and sales from a store or accounting system land in the sales section.', ic: 'chart' },
      { t: 'Sheets', d: 'Workspace tables sync with external spreadsheets on a schedule.', ic: 'grid' },
      { t: 'Calendar', d: 'CRM meetings and tasks appear in an external calendar.', ic: 'cal' },
    ],
  },
  how: {
    k: 'How a connection works',
    t: 'Four layers of reliability.',
    items: [
      ['Connect from one screen', 'The CRM Integrations section shows what is connected, what needs a sign-in and what is not set up yet.', 'zap'],
      ['Sign-in instead of keys', 'Google, Meta, calendars and spreadsheets connect through the official account sign-in; tokens refresh automatically.', 'shield'],
      ['Protected webhooks', 'Inbound requests from WhatsApp, WooCommerce and payment systems are checked by signature, and request rate is limited.', 'check'],
      ['Access control', 'The CRM warns in advance when Meta ad account access is about to expire, and role permissions decide who can connect services.', 'eye'],
    ],
  },
  api: {
    k: 'No connection you need?',
    t: 'API and webhooks — for everything else.',
    d: 'If a service is not in the catalogue, you can still connect its data to the CRM.',
    items: [
      { t: 'Lead intake via API', d: 'A POST request with the site token — from any website, landing page, bot or n8n.', ic: 'funnel' },
      { t: 'Webhooks from automations', d: 'A CRM scenario sends data to your URL on any event.', ic: 'pipe' },
      { t: 'Zapier and Make', d: 'Thousands of services through ready-made no-code scenarios.', ic: 'bolt' },
      { t: 'Catalogue and stock', d: 'Public catalogue API, Google Merchant feeds and CSV for WooCommerce, product webhooks.', ic: 'box' },
    ],
  },
  faq: {
    k: 'FAQ',
    t: 'Frequently asked questions',
    note: 'Didn\'t find an answer?',
    write: 'Write to us',
    groups: [
      {
        g: 'Connecting',
        items: [
          { q: 'How do we connect a service?', a: 'In the CRM open the Integrations section, choose the service and follow the prompts. Google, Meta, calendars and Google Sheets connect through the service\'s account sign-in, the rest with an access key or a webhook URL the CRM shows in settings.' },
          { q: 'Do we need a developer?', a: 'Not for connections from the catalogue. A developer may be needed only if you connect the CRM to your own system via the API or webhooks.' },
          { q: 'What does "beta" mean?', a: 'The connection works and you can use it, but we are still extending its scenarios and refining it based on client feedback. "Live" marks connections that have been in use unchanged for a long time.' },
          { q: 'What does "AI departments" mean?', a: 'Notion, Canva and GitHub connect to AI departments: for example, the content department uses Canva and the development department uses GitHub. AI departments are available on the Enterprise and Ultimate plans.' },
        ],
      },
      {
        g: 'Ads, communication and sales',
        items: [
          { q: 'Which ad platforms can be connected?', a: 'Google Ads, Meta Ads (several ad accounts), Yandex Direct and VK Ads. Spend syncs automatically and is converted to one currency. For web analytics — Google Analytics 4 and Yandex Metrica, for SEO — Search Console and PageSpeed.' },
          { q: 'Which messengers and channels are there?', a: 'WhatsApp Business, Telegram, mailboxes, SMS, the Lumiva website chat and Twilio telephony with click-to-call, recording and transcription. For team notifications — Slack and Microsoft Teams.' },
          { q: 'Can we connect the CRM to another CRM?', a: 'Yes. For amoCRM, Bitrix24 and HubSpot, automations send leads, contacts and deals; data from amoCRM can also be received. 1C and SAP send data to the CRM via webhook.' },
          { q: 'Which stores and payment systems connect?', a: 'WooCommerce and Shopify orders become sales, WordPress forms (Contact Form 7) become leads. Payment links are created through iyzico and PayTR for Turkey and YooKassa for Russia.' },
        ],
      },
      {
        g: 'Data and security',
        items: [
          { q: 'How is inbound data protected?', a: 'Inbound webhooks from WhatsApp, WooCommerce and payment systems are checked by signature, and the rate of inbound requests is limited. Website leads are accepted only from the domain registered for the token.' },
          { q: 'Who can connect services?', a: 'That is set by role permissions. Regular employees use connected integrations but cannot change their settings unless they have that right.' },
          { q: 'What happens if account access expires?', a: 'For Meta ad accounts the CRM sends a reminder in advance so you can renew access in time. Google and Microsoft sign-in connections refresh their tokens automatically.' },
        ],
      },
      {
        g: 'If a service is not in the catalogue',
        items: [
          { q: 'The service we need is missing — what now?', a: 'There are three ways: Zapier or Make with thousands of ready services, lead intake via the API with a site token (n8n works too) and webhooks from CRM automations. If you need a direct integration, write to us — we take such requests into account when planning.' },
          { q: 'Can we try integrations for free?', a: 'Yes. Sign-up gives 14 days of the Enterprise plan for free, no card — every integration is available, including AI department connections.' },
        ],
      },
    ],
  },
  cta: { k: 'Didn\'t find the connection you need?', t: 'Tell us which service you need — we\'ll show how to connect it to the CRM today.', b1: 'Request an integration', b2: 'Try for free' },
};

const tr: IntText = {
  kick: 'Entegrasyonlar',
  h1a: 'Verileriniz —',
  h1b: 'işin ihtiyaç duyduğu yerde.',
  sub: 'Reklam hesaplarını, mesajlaşma uygulamalarını, e-posta ve telefonu, mağazaları ve ödeme sistemlerini, diğer CRM\'leri, takvimleri ve tabloları CRM\'e bağlayın. Talepler kendiliğinden gelir, otomasyonlar verileri iletir, harcamalar ve satışlar tek yerde hesaplanır.',
  cta1: 'Kataloğa göz atın',
  cta2: 'Entegrasyon isteyin',
  stats: [
    { v: '40', l: 'katalogda bağlantı — reklam, iletişim, CRM, mağazalar, iş ve yapay zekâ' },
    { v: '4', l: 'reklam platformu: Google Ads, Meta, Yandex Direct, VK Ads' },
    { v: '3', l: 'ödeme bağlantıları için ödeme sistemi: iyzico, PayTR, YooKassa' },
    { v: '7', l: 'yetenek türü: talep alımından tablo ve takvim senkronizasyonuna' },
  ],
  all: 'Tümü',
  cats: { ads: 'Reklam ve analitik', comms: 'Mesajlaşma ve iletişim', crm: 'CRM ve ERP', shop: 'Mağazalar ve ödemeler', work: 'İş ve ekipler', ai: 'No-code ve yapay zekâ' },
  search: 'Bağlantı bul',
  empty: 'Hiçbir şey bulunamadı.',
  emptyLink: 'Neyi bağlamanız gerektiğini yazın',
  st: { live: 'çalışıyor', beta: 'beta', office: 'Yapay zekâ departmanları' },
  caps: { leads: 'Talepler', actions: 'Otomasyonlar', webhook: 'Webhook', oauth: 'Hesapla giriş', sales: 'Satışlar', sheets: 'Tablolar', calendar: 'Takvim' },
  legend: '"Beta" — bağlantı çalışıyor ama senaryolarını hâlâ geliştiriyoruz. "Yapay zekâ departmanları" — Enterprise ve Ultimate planlarındaki yapay zekâ departmanları için bağlantı.',
  hub: { h: 'Lumiva CRM · entegrasyonlar', sync: 'Senkronizasyon', note: 'Örnek olaylar', events: ['talep oluşturuldu', 'harcama güncellendi', 'mesaj alındı', 'sipariş satışa dönüştü', 'tablo satırı güncellendi', 'görev gönderildi'] },
  what: {
    k: 'Entegrasyon ne yapar',
    t: 'CRM\'i diğer servislere bağlamanın yedi yolu.',
    d: 'Katalogdaki her bağlantının tam olarak ne yapabildiği işaretlidir. Etiketlerin anlamı şöyle.',
    items: [
      { t: 'Talepler', d: 'Servisten gelen başvurular kanal ve kaynağıyla kendiliğinden talebe dönüşür.', ic: 'funnel' },
      { t: 'Otomasyonlar', d: 'CRM senaryoları servise mesaj, görev, kişi veya satış gönderir.', ic: 'bolt' },
      { t: 'Webhook', d: 'Servis olayları CRM\'e kendisi bildirir — beklemeden ve elle aktarmadan.', ic: 'pipe' },
      { t: 'Hesapla giriş', d: 'Anahtar kopyalamadan, servisin resmi hesap girişiyle (OAuth) bağlantı.', ic: 'shield' },
      { t: 'Satışlar', d: 'Mağazadan veya muhasebe sisteminden siparişler ve satışlar satış bölümüne düşer.', ic: 'chart' },
      { t: 'Tablolar', d: 'Çalışma alanı tabloları harici tablolarla programa göre senkronize olur.', ic: 'grid' },
      { t: 'Takvim', d: 'CRM toplantıları ve görevleri harici takvimde görünür.', ic: 'cal' },
    ],
  },
  how: {
    k: 'Bağlantı nasıl çalışır',
    t: 'Dört güvenilirlik katmanı.',
    items: [
      ['Tek ekrandan bağlantı', 'CRM\'in Entegrasyonlar bölümünde neyin bağlı olduğu, neyin hesap girişi gerektirdiği ve neyin henüz ayarlanmadığı görünür.', 'zap'],
      ['Anahtar yerine giriş', 'Google, Meta, takvimler ve tablolar resmi hesap girişiyle bağlanır; tokenlar otomatik yenilenir.', 'shield'],
      ['Korumalı webhook\'lar', 'WhatsApp, WooCommerce ve ödeme sistemlerinden gelen istekler imzayla doğrulanır, istek sıklığı sınırlanır.', 'check'],
      ['Erişim kontrolü', 'CRM, Meta reklam hesabı erişiminin süresi dolmadan önceden uyarır; servisleri kimin bağlayabileceğine rol yetkileri karar verir.', 'eye'],
    ],
  },
  api: {
    k: 'İhtiyacınız olan bağlantı yok mu?',
    t: 'Geri kalan her şey için API ve webhook\'lar.',
    d: 'Servis katalogda yoksa da verilerini CRM\'e bağlayabilirsiniz.',
    items: [
      { t: 'API ile talep alımı', d: 'Site anahtarıyla POST isteği — herhangi bir siteden, açılış sayfasından, bottan veya n8n\'den.', ic: 'funnel' },
      { t: 'Otomasyonlardan webhook\'lar', d: 'CRM senaryosu her olayda verileri adresinize gönderir.', ic: 'pipe' },
      { t: 'Zapier ve Make', d: 'Hazır no-code senaryolarla binlerce servis.', ic: 'bolt' },
      { t: 'Katalog ve stok', d: 'Herkese açık katalog API\'si, Google Merchant feed\'leri ve WooCommerce için CSV, ürün webhook\'ları.', ic: 'box' },
    ],
  },
  faq: {
    k: 'SSS',
    t: 'Sık sorulan sorular',
    note: 'Yanıt bulamadınız mı?',
    write: 'Bize yazın',
    groups: [
      {
        g: 'Bağlantı',
        items: [
          { q: 'Bir servisi nasıl bağlarız?', a: 'CRM\'de Entegrasyonlar bölümünü açın, servisi seçin ve yönergeleri izleyin. Google, Meta, takvimler ve Google Sheets servisin hesap girişiyle, diğerleri erişim anahtarı veya CRM\'in ayarlarda gösterdiği webhook adresiyle bağlanır.' },
          { q: 'Geliştiriciye ihtiyaç var mı?', a: 'Katalogdaki bağlantılar için hayır. Geliştirici yalnızca CRM\'i API veya webhook\'larla kendi sisteminize bağlıyorsanız gerekebilir.' },
          { q: '"Beta" ne demek?', a: 'Bağlantı çalışıyor ve kullanılabilir, ancak senaryolarını genişletiyor ve müşteri geri bildirimlerine göre geliştiriyoruz. "Çalışıyor" işareti uzun süredir değişmeden kullanılan bağlantılardadır.' },
          { q: '"Yapay zekâ departmanları" ne demek?', a: 'Notion, Canva ve GitHub yapay zekâ departmanlarına bağlanır: örneğin içerik departmanı Canva\'yı, geliştirme departmanı GitHub\'ı kullanır. Yapay zekâ departmanları Enterprise ve Ultimate planlarında mevcuttur.' },
        ],
      },
      {
        g: 'Reklam, iletişim ve satışlar',
        items: [
          { q: 'Hangi reklam platformları bağlanabilir?', a: 'Google Ads, Meta Ads (birden fazla hesap), Yandex Direct ve VK Ads. Harcamalar otomatik senkronize olur ve tek para birimine çevrilir. Web analitiği için Google Analytics 4 ve Yandex Metrica, SEO için Search Console ve PageSpeed.' },
          { q: 'Hangi mesajlaşma ve iletişim kanalları var?', a: 'WhatsApp Business, Telegram, posta kutuları, SMS, sitede Lumiva sohbeti ve tek tıkla arama, kayıt ve dökümlü Twilio telefonu. Ekip bildirimleri için Slack ve Microsoft Teams.' },
          { q: 'CRM\'i başka bir CRM\'e bağlayabilir miyiz?', a: 'Evet. amoCRM, Bitrix24 ve HubSpot için otomasyonlar talepleri, kişileri ve satışları gönderir; amoCRM\'den veri de alınabilir. 1C ve SAP verileri webhook ile CRM\'e gönderir.' },
          { q: 'Hangi mağazalar ve ödeme sistemleri bağlanır?', a: 'WooCommerce ve Shopify siparişleri satışa, WordPress formları (Contact Form 7) talebe dönüşür. Ödeme bağlantıları Türkiye için iyzico ve PayTR, Rusya için YooKassa ile oluşturulur.' },
        ],
      },
      {
        g: 'Veri ve güvenlik',
        items: [
          { q: 'Gelen veriler nasıl korunuyor?', a: 'WhatsApp, WooCommerce ve ödeme sistemlerinden gelen webhook\'lar imzayla doğrulanır, gelen isteklerin sıklığı sınırlanır. Site talepleri yalnızca anahtar için kayıtlı alan adından kabul edilir.' },
          { q: 'Servisleri kim bağlayabilir?', a: 'Bu rol yetkileriyle belirlenir. Normal çalışanlar bağlı entegrasyonları kullanır ama bu yetkileri yoksa ayarlarını değiştiremez.' },
          { q: 'Hesap erişiminin süresi dolarsa ne olur?', a: 'Meta reklam hesapları için CRM erişimi zamanında yenileyebilmeniz için önceden hatırlatma gönderir. Google ve Microsoft giriş bağlantıları tokenlarını otomatik yeniler.' },
        ],
      },
      {
        g: 'Servis katalogda yoksa',
        items: [
          { q: 'İhtiyacımız olan servis yok — ne yapmalı?', a: 'Üç yol var: binlerce hazır servisle Zapier veya Make, site anahtarıyla API üzerinden talep alımı (n8n de uygun) ve CRM otomasyonlarından webhook\'lar. Doğrudan entegrasyon gerekiyorsa bize yazın — planlamada bu tür talepleri dikkate alıyoruz.' },
          { q: 'Entegrasyonları ücretsiz deneyebilir miyiz?', a: 'Evet. Kayıt, Enterprise planını 14 gün ücretsiz ve kartsız verir — yapay zekâ departmanı bağlantıları dahil tüm entegrasyonlar kullanılabilir.' },
        ],
      },
    ],
  },
  cta: { k: 'İhtiyacınız olan bağlantıyı bulamadınız mı?', t: 'Hangi servise ihtiyacınız olduğunu yazın — bugün CRM\'e nasıl bağlayacağınızı gösterelim.', b1: 'Entegrasyon isteyin', b2: 'Ücretsiz deneyin' },
};

export const INT_T: Record<Lang, IntText> = { ru, en, tr };
