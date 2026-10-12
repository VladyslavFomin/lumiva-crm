/* Страница «О нас» (ru/en/tr). Основа — проверенные 2026-10-02 тексты publicPages.about (история 2022–2026,
 * стек, ценности). Добавлено только проверяемое: ИИ-отделы и Aura (2026), хранение и резервные копии
 * (сервер в ЕС; шифрованный бэкап каждую ночь + копия во внешнем облаке; еженедельная проверка восстановления;
 * мониторинг каждые 5 минут). Из макета НЕ берём: 500+ клиентов, 99.9% uptime, 7 лет, РФ/152-ФЗ, Kubernetes,
 * бэкапы каждые 6 часов, «ответ за час», «персональный менеджер». */

type Lang = 'ru' | 'en' | 'tr';
type Card = { t: string; d: string; ic: string };

export type AboutText = {
  kick: string;
  t1: string;
  t2: string;
  sub: string;
  cta1: string;
  cta2: string;
  stats: Array<{ v: string; l: string }>;
  missionK: string;
  mission: string;
  missionA: string;
  valuesK: string;
  valuesT: string;
  values: Array<[string, string, string]>;
  today: { k: string; t: string; d: string; items: Card[] };
  histK: string;
  histT: string;
  now: string;
  history: Array<[string, string]>;
  data: { k: string; t: string; d: string; items: Card[] };
  techK: string;
  techT: string;
  techD: string;
  tech: Array<[string, string]>;
  cta: { k: string; t: string; demo: string; features: string };
};

const ru: AboutText = {
  kick: 'О компании',
  t1: 'Мы строим CRM,',
  t2: 'в которой работает ИИ-команда.',
  sub: 'Lumiva — CRM для малого и среднего бизнеса: продажи, маркетинг, склад и товары, бронирования и отели в одной системе. Рутину в ней берут ИИ-сотрудники и ИИ-отделы, а люди занимаются клиентами.',
  cta1: 'Попробовать 14 дней',
  cta2: 'Записаться на демо',
  stats: [
    { v: '12', l: 'модулей в одной системе — от лидов до отелей' },
    { v: '39', l: 'подключений: реклама, мессенджеры, магазины, платежи' },
    { v: '3', l: 'языка интерфейса: русский, английский и турецкий' },
    { v: '14', l: 'дней тарифа Enterprise бесплатно и без карты' },
  ],
  missionK: 'Миссия',
  mission: '«Каждая компания должна получать от CRM столько же, сколько от лучшего сотрудника: порядок, скорость и честные цифры.»',
  missionA: 'Команда Lumiva',
  valuesK: 'Ценности',
  valuesT: 'Во что мы верим.',
  values: [
    ['Простота', 'Продукт, которым хочется пользоваться каждый день. Без лишнего — только то, что реально нужно бизнесу.', 'clock'],
    ['ИИ там, где рутина', 'ИИ-сотрудники берут повторяющуюся работу, люди остаются на решениях. Каждое действие видно в журнале, рискованные — ждут согласования.', 'spark'],
    ['Надёжность', 'Изолированные данные каждой компании, роли и права доступа, двухфакторный вход и ежедневные резервные копии.', 'shield'],
    ['Партнёрство', 'Долгие отношения вместо разовой продажи. Каждый клиент — партнёр, а не просто пользователь.', 'users'],
  ],
  today: {
    k: 'Lumiva сегодня',
    t: 'Одна система вместо пяти.',
    d: 'Модули работают на общей базе клиентов и компаний — данные не нужно переносить между сервисами.',
    items: [
      { t: 'Продажи и лиды', d: 'Заявки с сайтов и мессенджеров, воронка, статусы продаж, отчёт по менеджерам.', ic: 'funnel' },
      { t: 'Маркетинг', d: 'Рекламные кабинеты, UTM, ROI по клиентам, SEO, соцсети и рассылки.', ic: 'target' },
      { t: 'Склад и товары', d: 'Каталог с вариантами, остатки по складам и дозаказ поставщику.', ic: 'box' },
      { t: 'Бронирования и отели', d: 'Онлайн-запись, лист ожидания и система резервации номеров.', ic: 'cal' },
      { t: 'ИИ-команда', d: 'ИИ-ассистент, ИИ-сотрудники, ИИ-отделы и дашборды Aura по одному предложению.', ic: 'spark' },
      { t: 'Для Турции и России', d: 'Интерфейс на трёх языках, оплаты через iyzico, PayTR и ЮKassa, Яндекс Директ и VK Реклама.', ic: 'chat' },
    ],
  },
  histK: 'История',
  histT: 'Как мы развивались.',
  now: 'Сейчас',
  history: [
    ['2022', 'Основание компании. Первые прототипы CRM.'],
    ['2023', 'Запуск бета-версии и первые клиенты.'],
    ['2024', 'Публичный релиз. Рабочие области и автоматизации.'],
    ['2025', 'Интеграции с мессенджерами, рекламой и другими CRM. ИИ-ассистент.'],
    ['2026', 'Новый дизайн, ИИ-сотрудники и ИИ-отделы, дашборды Aura, бронирования и отели, интерфейс на турецком языке.'],
  ],
  data: {
    k: 'Данные и надёжность',
    t: 'Где живут ваши данные.',
    d: 'Без громких сертификатов — только то, что действительно настроено и работает каждый день.',
    items: [
      { t: 'Серверы в ЕС', d: 'CRM работает на сервере в Европейском союзе (Литва).', ic: 'grid' },
      { t: 'Бэкап каждую ночь', d: 'Резервная копия базы и файлов создаётся каждую ночь и шифруется.', ic: 'clock' },
      { t: 'Вторая копия вне сервера', d: 'Зашифрованные копии отправляются во внешнее облачное хранилище и сверяются по контрольным суммам.', ic: 'box' },
      { t: 'Проверка восстановления', d: 'Раз в неделю резервная копия автоматически восстанавливается в отдельной среде — чтобы убедиться, что она рабочая.', ic: 'check' },
      { t: 'Мониторинг', d: 'Доступность CRM и сайта проверяется каждые 5 минут, о сбоях команда узнаёт сразу.', ic: 'bell' },
      { t: 'Доступ', d: 'Данные компаний изолированы, права задаются ролями, есть двухфакторный вход и журнал действий.', ic: 'shield' },
    ],
  },
  techK: 'Технологии',
  techT: 'На чём работает Lumiva.',
  techD: 'Современный стек без экзотики — его легко поддерживать и развивать.',
  tech: [
    ['Платформа', 'React 19, TypeScript и Tailwind CSS на клиенте; NestJS, TypeORM и PostgreSQL на сервере.'],
    ['ИИ-слой', 'Модели OpenAI и Anthropic — в том числе по вашему ключу. Роли и права агентов, журнал действий и согласования.'],
    ['Инфраструктура', 'Docker, Nginx, GitHub Actions, HTTPS. Ночные шифрованные бэкапы и мониторинг каждые 5 минут.'],
  ],
  cta: { k: 'Познакомимся?', t: 'Покажем Lumiva на ваших задачах за 30 минут.', demo: 'Записаться на демо', features: 'Все функции' },
};

const en: AboutText = {
  kick: 'About us',
  t1: 'We build a CRM',
  t2: 'where an AI team does the work.',
  sub: 'Lumiva is a CRM for small and mid-sized businesses: sales, marketing, stock and products, bookings and hotels in one system. AI employees and AI departments take the routine, and people focus on clients.',
  cta1: 'Try 14 days',
  cta2: 'Book a demo',
  stats: [
    { v: '12', l: 'modules in one system — from leads to hotels' },
    { v: '39', l: 'connections: ads, messengers, stores, payments' },
    { v: '3', l: 'interface languages: Russian, English and Turkish' },
    { v: '14', l: 'days of the Enterprise plan free, no card' },
  ],
  missionK: 'Mission',
  mission: '"Every company should get as much from its CRM as from its best employee: order, speed and honest numbers."',
  missionA: 'The Lumiva team',
  valuesK: 'Values',
  valuesT: 'What we believe in.',
  values: [
    ['Simplicity', 'A product people want to use every day. Nothing extra — only what a business actually needs.', 'clock'],
    ['AI where the routine is', 'AI employees take repetitive work, people stay on decisions. Every action is visible in the log, risky ones wait for approval.', 'spark'],
    ['Reliability', 'Isolated data for every company, roles and permissions, two-factor sign-in and daily backups.', 'shield'],
    ['Partnership', 'Long relationships instead of one-off sales. Every client is a partner, not just a user.', 'users'],
  ],
  today: {
    k: 'Lumiva today',
    t: 'One system instead of five.',
    d: 'Modules share one base of clients and companies — no moving data between services.',
    items: [
      { t: 'Sales and leads', d: 'Requests from websites and messengers, pipeline, sale statuses, manager report.', ic: 'funnel' },
      { t: 'Marketing', d: 'Ad accounts, UTM, ROI by client, SEO, social media and campaigns.', ic: 'target' },
      { t: 'Stock and products', d: 'A catalogue with variants, stock by warehouse and supplier reordering.', ic: 'box' },
      { t: 'Bookings and hotels', d: 'Online booking, a waitlist and a room reservation system.', ic: 'cal' },
      { t: 'AI team', d: 'AI assistant, AI employees, AI departments and Aura dashboards from a single sentence.', ic: 'spark' },
      { t: 'For Turkey and Russia', d: 'Three interface languages, payments via iyzico, PayTR and YooKassa, Yandex Direct and VK Ads.', ic: 'chat' },
    ],
  },
  histK: 'History',
  histT: 'How we grew.',
  now: 'Now',
  history: [
    ['2022', 'Company founded. First CRM prototypes.'],
    ['2023', 'Beta launch and the first customers.'],
    ['2024', 'Public release. Workspaces and automations.'],
    ['2025', 'Integrations with messengers, ad platforms and other CRMs. AI assistant.'],
    ['2026', 'New design, AI employees and AI departments, Aura dashboards, bookings and hotels, Turkish interface.'],
  ],
  data: {
    k: 'Data and reliability',
    t: 'Where your data lives.',
    d: 'No loud certificates — only what is actually set up and running every day.',
    items: [
      { t: 'Servers in the EU', d: 'The CRM runs on a server in the European Union (Lithuania).', ic: 'grid' },
      { t: 'Backup every night', d: 'A backup of the database and files is created every night and encrypted.', ic: 'clock' },
      { t: 'Second copy off the server', d: 'Encrypted copies are sent to external cloud storage and verified by checksums.', ic: 'box' },
      { t: 'Restore testing', d: 'Once a week a backup is automatically restored into a separate environment to make sure it works.', ic: 'check' },
      { t: 'Monitoring', d: 'CRM and website availability is checked every 5 minutes, and the team learns about outages right away.', ic: 'bell' },
      { t: 'Access', d: 'Company data is isolated, rights are set by roles, with two-factor sign-in and an activity log.', ic: 'shield' },
    ],
  },
  techK: 'Technology',
  techT: 'What Lumiva runs on.',
  techD: 'A modern stack without exotics — easy to maintain and grow.',
  tech: [
    ['Platform', 'React 19, TypeScript and Tailwind CSS on the client; NestJS, TypeORM and PostgreSQL on the server.'],
    ['AI layer', 'OpenAI and Anthropic models — including with your own key. Agent roles and rights, activity log and approvals.'],
    ['Infrastructure', 'Docker, Nginx, GitHub Actions, HTTPS. Nightly encrypted backups and monitoring every 5 minutes.'],
  ],
  cta: { k: 'Shall we meet?', t: 'We\'ll show Lumiva on your tasks in 30 minutes.', demo: 'Book a demo', features: 'All features' },
};

const tr: AboutText = {
  kick: 'Hakkımızda',
  t1: 'İçinde yapay zekâ ekibinin',
  t2: 'çalıştığı bir CRM yapıyoruz.',
  sub: 'Lumiva, küçük ve orta ölçekli işletmeler için bir CRM: satış, pazarlama, depo ve ürünler, rezervasyonlar ve oteller tek sistemde. Rutini yapay zekâ çalışanları ve departmanları üstlenir, insanlar müşterilerle ilgilenir.',
  cta1: '14 gün deneyin',
  cta2: 'Demo ayarlayın',
  stats: [
    { v: '12', l: 'modül tek sistemde — taleplerden otellere' },
    { v: '39', l: 'bağlantı: reklam, mesajlaşma, mağazalar, ödemeler' },
    { v: '3', l: 'arayüz dili: Rusça, İngilizce ve Türkçe' },
    { v: '14', l: 'gün Enterprise planı ücretsiz ve kartsız' },
  ],
  missionK: 'Misyon',
  mission: '"Her şirket CRM\'inden en iyi çalışanı kadar fayda almalı: düzen, hız ve dürüst rakamlar."',
  missionA: 'Lumiva ekibi',
  valuesK: 'Değerler',
  valuesT: 'Neye inanıyoruz.',
  values: [
    ['Sadelik', 'Her gün kullanmak istenen bir ürün. Fazlası yok — yalnızca işin gerçekten ihtiyacı olan.', 'clock'],
    ['Rutinin olduğu yerde yapay zekâ', 'Yapay zekâ çalışanları tekrarlayan işi üstlenir, insanlar kararlarda kalır. Her işlem günlükte görünür, riskli olanlar onay bekler.', 'spark'],
    ['Güvenilirlik', 'Her şirketin verileri ayrı, roller ve yetkiler, iki faktörlü giriş ve günlük yedekler.', 'shield'],
    ['Ortaklık', 'Tek seferlik satış yerine uzun ilişkiler. Her müşteri bir kullanıcı değil, bir ortaktır.', 'users'],
  ],
  today: {
    k: 'Bugün Lumiva',
    t: 'Beş yerine tek sistem.',
    d: 'Modüller ortak müşteri ve şirket tabanında çalışır — verileri servisler arasında taşımaya gerek yok.',
    items: [
      { t: 'Satış ve talepler', d: 'Sitelerden ve mesajlaşmadan talepler, huni, satış durumları, yönetici raporu.', ic: 'funnel' },
      { t: 'Pazarlama', d: 'Reklam hesapları, UTM, müşteri bazında ROI, SEO, sosyal medya ve kampanyalar.', ic: 'target' },
      { t: 'Depo ve ürünler', d: 'Varyantlı katalog, depolara göre stok ve tedarikçiye yeniden sipariş.', ic: 'box' },
      { t: 'Rezervasyonlar ve oteller', d: 'Online randevu, bekleme listesi ve oda rezervasyon sistemi.', ic: 'cal' },
      { t: 'Yapay zekâ ekibi', d: 'Yapay zekâ asistanı, çalışanları, departmanları ve tek cümleden Aura panoları.', ic: 'spark' },
      { t: 'Türkiye ve Rusya için', d: 'Üç arayüz dili, iyzico, PayTR ve YooKassa ile ödemeler, Yandex Direct ve VK Ads.', ic: 'chat' },
    ],
  },
  histK: 'Tarihçe',
  histT: 'Nasıl büyüdük.',
  now: 'Şimdi',
  history: [
    ['2022', 'Şirketin kuruluşu. İlk CRM prototipleri.'],
    ['2023', 'Beta sürümü ve ilk müşteriler.'],
    ['2024', 'Herkese açık sürüm. Çalışma alanları ve otomasyonlar.'],
    ['2025', 'Mesajlaşma, reklam ve diğer CRM\'lerle entegrasyonlar. Yapay zekâ asistanı.'],
    ['2026', 'Yeni tasarım, yapay zekâ çalışanları ve departmanları, Aura panoları, rezervasyonlar ve oteller, Türkçe arayüz.'],
  ],
  data: {
    k: 'Veri ve güvenilirlik',
    t: 'Verileriniz nerede yaşıyor.',
    d: 'Gösterişli sertifikalar yok — yalnızca gerçekten kurulu olan ve her gün çalışan şeyler.',
    items: [
      { t: 'AB\'de sunucular', d: 'CRM, Avrupa Birliği\'nde (Litvanya) bir sunucuda çalışır.', ic: 'grid' },
      { t: 'Her gece yedek', d: 'Veritabanı ve dosyaların yedeği her gece oluşturulur ve şifrelenir.', ic: 'clock' },
      { t: 'Sunucu dışında ikinci kopya', d: 'Şifreli kopyalar harici bulut depolamaya gönderilir ve sağlama toplamlarıyla doğrulanır.', ic: 'box' },
      { t: 'Geri yükleme testi', d: 'Haftada bir yedek, çalıştığından emin olmak için ayrı bir ortama otomatik olarak geri yüklenir.', ic: 'check' },
      { t: 'İzleme', d: 'CRM ve sitenin erişilebilirliği her 5 dakikada kontrol edilir, ekip kesintileri hemen öğrenir.', ic: 'bell' },
      { t: 'Erişim', d: 'Şirket verileri ayrıdır, yetkiler rollerle belirlenir, iki faktörlü giriş ve işlem günlüğü vardır.', ic: 'shield' },
    ],
  },
  techK: 'Teknoloji',
  techT: 'Lumiva neyle çalışıyor.',
  techD: 'Egzotik olmayan modern bir yığın — bakımı ve geliştirmesi kolay.',
  tech: [
    ['Platform', 'İstemcide React 19, TypeScript ve Tailwind CSS; sunucuda NestJS, TypeORM ve PostgreSQL.'],
    ['Yapay zekâ katmanı', 'OpenAI ve Anthropic modelleri — kendi anahtarınızla da. Ajan rolleri ve yetkileri, işlem günlüğü ve onaylar.'],
    ['Altyapı', 'Docker, Nginx, GitHub Actions, HTTPS. Gecelik şifreli yedekler ve her 5 dakikada izleme.'],
  ],
  cta: { k: 'Tanışalım mı?', t: 'Lumiva\'yı 30 dakikada kendi işleriniz üzerinde gösterelim.', demo: 'Demo ayarlayın', features: 'Tüm özellikler' },
};

export const ABOUT_T: Record<Lang, AboutText> = { ru, en, tr };
