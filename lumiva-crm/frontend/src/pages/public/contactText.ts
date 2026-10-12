/**
 * Тексты «Контактов» (contact-v2.html). Выдуманное в макете убрано: «ответим в течение часа»,
 * «среднее время ответа — 47 минут», «14 дней после звонка». Реальные факты: заявка уходит в pl1 +
 * Telegram команды (demo-requests), график Пн–Пт 9:00–18:00 МСК, ИИ-консультант чата на сайте
 * (chat_operator тенанта admin, режим auto) отвечает после того, как посетитель оставит имя и контакт,
 * пробный период 14 дней открывается самостоятельной регистрацией без звонка.
 */
import type { SolQA } from './solutionKit';

export type ContactTopic = 'demo' | 'pricing' | 'integration' | 'support';

export type ContactText = {
  kick: string;
  t1: string;
  t2: string;
  sub: string;
  formT: string;
  topics: Record<ContactTopic, string>;
  name: string;
  namePh: string;
  email: string;
  emailPh: string;
  company: string;
  companyPh: string;
  phone: string;
  phonePh: string;
  team: string;
  teamOpts: string[];
  msg: string;
  msgPh: string;
  send: string;
  cons1: string;
  cons2: string;
  okT: string;
  okD: (name: string, email: string) => string;
  again: string;
  err: string;
  benT: string;
  ben: string[];
  waysT: string;
  hoursT: string;
  hoursD: string;
  openOn: string;
  openOff: string;
  aiT: string;
  aiD: string;
  aiBtn: string;
  next: { k: string; t: string; d: string; n: string; items: Array<{ t: string; d: string }> };
  faq: { k: string; t: string; note: string; write: string; groups: Array<{ g: string; items: SolQA[] }> };
  cta: { k: string; t: string; demo: string; tryFree: string };
};

const ru: ContactText = {
  kick: 'Контакты',
  t1: 'Расскажите о задаче —',
  t2: 'ответим в течение рабочего дня.',
  sub: 'Покажем, как Lumiva закроет ваши процессы — продажи, склад, бронирования, отели или документы — и какие ИИ-сотрудники возьмут на себя рутину.',
  formT: 'Заявка на демо',
  topics: { demo: 'Демо', pricing: 'Тарифы', integration: 'Интеграция', support: 'Поддержка' },
  name: 'Имя',
  namePh: 'Анна Смирнова',
  email: 'Email',
  emailPh: 'anna@company.com',
  company: 'Компания',
  companyPh: 'Название компании',
  phone: 'Телефон',
  phonePh: '+7 900 000-00-00',
  team: 'Размер команды',
  teamOpts: ['1–5', '6–20', '21–50', '50+'],
  msg: 'Сообщение',
  msgPh: 'Какие процессы хотите автоматизировать? Чем пользуетесь сейчас?',
  send: 'Отправить заявку',
  cons1: 'Нажимая кнопку, вы соглашаетесь с',
  cons2: 'политикой конфиденциальности',
  okT: 'Заявка отправлена',
  okD: (n, e) => `Спасибо${n ? ', ' + n : ''}! Заявка уже у команды — ответим на ${e || 'вашу почту'} в течение рабочего дня.`,
  again: 'Отправить ещё одну',
  err: 'Не получилось отправить заявку. Попробуйте ещё раз или напишите на hello@lumiva.agency.',
  benT: 'Что вы получите',
  ben: [
    'Демо на ваших сценариях, а не общая презентация',
    'Подбор тарифа под размер команды и нужные модули',
    'План переноса данных из таблиц или текущей CRM',
    'Подбор ИИ-сотрудников под ваши процессы',
    'Ответы на вопросы по интеграциям и оплате',
  ],
  waysT: 'Другие способы связи',
  hoursT: 'Ответим в течение рабочего дня',
  hoursD: 'Пн–Пт, 9:00–18:00 по Москве',
  openOn: 'Сейчас на связи',
  openOff: 'Ответим в рабочее время',
  aiT: 'Вопрос вне рабочего времени?',
  aiD: 'ИИ-консультант в чате на сайте отвечает сразу — оставьте имя и контакт, и он передаст диалог менеджеру.',
  aiBtn: 'Открыть чат',
  next: {
    k: 'Что дальше',
    t: 'От заявки до работающей CRM.',
    d: 'Без долгих созвонов и обязательств. Если удобнее разобраться самому — пробный доступ открывается сразу после регистрации.',
    n: 'Шаг',
    items: [
      { t: 'Заявка', d: 'Заявка сразу приходит команде. Тема, размер команды и сообщение помогают подготовиться заранее.' },
      { t: 'Ответ', d: 'В течение рабочего дня пишем на почту или в удобный мессенджер и договариваемся о времени.' },
      { t: 'Демо', d: 'Показываем модули, которые вам нужны, и разбираем ваши процессы: воронки, склад, брони, документы.' },
      { t: 'Запуск', d: 'Открываем рабочее пространство, помогаем перенести данные и настроить первых ИИ-сотрудников.' },
    ],
  },
  faq: {
    k: 'Вопросы',
    t: 'Частые вопросы перед заявкой.',
    note: 'Не нашли ответа? Напишите в форме',
    write: 'выше',
    groups: [
      {
        g: 'Заявка и демо',
        items: [
          { q: 'Сколько стоит демо?', a: 'Демо бесплатное и ни к чему не обязывает. Показываем систему и отвечаем на вопросы, договор подписывать не нужно.' },
          { q: 'Как быстро вы ответите?', a: 'В течение рабочего дня: понедельник–пятница, 9:00–18:00 по Москве. Если вы написали вечером или в выходные — ответим в следующий рабочий день. Быстрый ответ в любое время даёт ИИ-консультант в чате на сайте.' },
          { q: 'Можно попробовать без демо?', a: 'Да. После регистрации открывается 14-дневный пробный период с полным набором модулей. Звонок для этого не нужен, карта тоже.' },
          { q: 'Какие данные нужны в заявке?', a: 'Обязательны только имя и email. Компания, телефон, размер команды и описание задачи необязательны, но помогают подготовить демо под вас.' },
        ],
      },
      {
        g: 'Переход и запуск',
        items: [
          { q: 'Поможете перенести данные?', a: 'Да. Лиды импортируются из CSV, товары — из файла с сопоставлением колонок, а таблицы произвольной структуры — в Рабочее пространство с ИИ-разбором колонок. На демо подскажем, как перенести именно ваши данные.' },
          { q: 'Сколько занимает запуск?', a: 'Рабочее пространство создаётся сразу. Базовая настройка — воронки, статусы, сотрудники и права — обычно занимает несколько дней, всё зависит от количества модулей и интеграций.' },
          { q: 'Нужен ли разработчик?', a: 'Нет. Модули, автоматизации, формы и интеграции настраиваются в интерфейсе. Для собственных доработок есть API и вебхуки.' },
        ],
      },
      {
        g: 'Тарифы и данные',
        items: [
          { q: 'Как устроены тарифы?', a: 'Тарифы отличаются набором модулей, лимитами пользователей и хранилища, а также доступными ИИ-сотрудниками. На демо подберём тариф под вашу команду. Оплата — картой, в рублях, лирах или евро в зависимости от страны.' },
          { q: 'Где хранятся данные?', a: 'CRM работает на сервере в Европейском союзе. Каждую ночь делается зашифрованная резервная копия, и её вторая копия хранится во внешнем облаке.' },
          { q: 'Это подходит для Турции и России?', a: 'Да. Интерфейс доступен на русском, английском и турецком, есть оплата через iyzico, PayTR и ЮKassa, а также интеграции с Telegram, WhatsApp, Яндекс Директом и VK Рекламой.' },
        ],
      },
    ],
  },
  cta: { k: 'Без ожидания', t: 'Не хотите ждать ответа? Откройте 14 дней доступа прямо сейчас.', demo: 'Все функции', tryFree: 'Попробовать бесплатно' },
};

const en: ContactText = {
  kick: 'Contact',
  t1: 'Tell us about your task —',
  t2: 'we reply within one business day.',
  sub: 'We’ll show how Lumiva covers your processes — sales, warehouse, bookings, hotels or documents — and which AI employees can take over the routine.',
  formT: 'Request a demo',
  topics: { demo: 'Demo', pricing: 'Pricing', integration: 'Integration', support: 'Support' },
  name: 'Name',
  namePh: 'Anna Smith',
  email: 'Email',
  emailPh: 'anna@company.com',
  company: 'Company',
  companyPh: 'Company name',
  phone: 'Phone',
  phonePh: '+90 500 000 00 00',
  team: 'Team size',
  teamOpts: ['1–5', '6–20', '21–50', '50+'],
  msg: 'Message',
  msgPh: 'Which processes do you want to automate? What do you use today?',
  send: 'Send request',
  cons1: 'By clicking the button you agree to the',
  cons2: 'privacy policy',
  okT: 'Request sent',
  okD: (n, e) => `Thank you${n ? ', ' + n : ''}! The team already has your request — we’ll reply to ${e || 'your email'} within one business day.`,
  again: 'Send another one',
  err: 'We couldn’t send the request. Please try again or write to hello@lumiva.agency.',
  benT: 'What you get',
  ben: [
    'A demo built around your scenarios, not a generic deck',
    'A plan matched to your team size and the modules you need',
    'A plan to move your data from spreadsheets or your current CRM',
    'AI employees picked for your processes',
    'Answers on integrations and payments',
  ],
  waysT: 'Other ways to reach us',
  hoursT: 'We reply within one business day',
  hoursD: 'Mon–Fri, 9:00–18:00 Moscow time (GMT+3)',
  openOn: 'Online now',
  openOff: 'We’ll reply during business hours',
  aiT: 'Question outside business hours?',
  aiD: 'The AI consultant in the site chat answers right away — leave your name and contact and it hands the conversation to a manager.',
  aiBtn: 'Open chat',
  next: {
    k: 'What happens next',
    t: 'From request to a working CRM.',
    d: 'No long calls and no commitments. If you’d rather explore on your own, trial access opens right after sign-up.',
    n: 'Step',
    items: [
      { t: 'Request', d: 'Your request reaches the team instantly. Topic, team size and message help us prepare in advance.' },
      { t: 'Reply', d: 'Within one business day we write by email or your preferred messenger and agree on a time.' },
      { t: 'Demo', d: 'We show the modules you need and walk through your processes: pipelines, stock, bookings, documents.' },
      { t: 'Launch', d: 'We open your workspace, help move your data and set up your first AI employees.' },
    ],
  },
  faq: {
    k: 'Questions',
    t: 'Common questions before you write.',
    note: 'Didn’t find the answer? Use the form',
    write: 'above',
    groups: [
      {
        g: 'Request and demo',
        items: [
          { q: 'How much does the demo cost?', a: 'The demo is free and comes with no obligation. We show the system and answer questions — no contract needed.' },
          { q: 'How fast will you reply?', a: 'Within one business day: Monday–Friday, 9:00–18:00 Moscow time (GMT+3). If you write in the evening or at the weekend, we reply on the next business day. For an instant answer at any time, use the AI consultant in the site chat.' },
          { q: 'Can I try it without a demo?', a: 'Yes. Signing up opens a 14-day trial with the full set of modules. No call and no card required.' },
          { q: 'What do I need to fill in?', a: 'Only your name and email are required. Company, phone, team size and a description of your task are optional, but they help us tailor the demo.' },
        ],
      },
      {
        g: 'Switching and launch',
        items: [
          { q: 'Will you help move our data?', a: 'Yes. Leads import from CSV, products from a file with column mapping, and spreadsheets of any structure go into Workspace with AI column mapping. In the demo we’ll show how to move your data specifically.' },
          { q: 'How long does launch take?', a: 'The workspace is created instantly. Basic setup — pipelines, statuses, staff and permissions — usually takes a few days, depending on the number of modules and integrations.' },
          { q: 'Do we need a developer?', a: 'No. Modules, automations, forms and integrations are configured in the interface. For custom work there is an API and webhooks.' },
        ],
      },
      {
        g: 'Plans and data',
        items: [
          { q: 'How do plans work?', a: 'Plans differ by modules, user and storage limits, and available AI employees. In the demo we’ll pick the right plan for your team. Payment is by card in rubles, lira or euros depending on your country.' },
          { q: 'Where is the data stored?', a: 'The CRM runs on a server in the European Union. An encrypted backup is made every night, and a second copy is kept in external cloud storage.' },
          { q: 'Does it work for Turkey and Russia?', a: 'Yes. The interface is available in Russian, English and Turkish, with payments via iyzico, PayTR and YooKassa, plus integrations with Telegram, WhatsApp, Yandex Direct and VK Ads.' },
        ],
      },
    ],
  },
  cta: { k: 'No waiting', t: 'Don’t want to wait for a reply? Start your 14 days of access right now.', demo: 'All features', tryFree: 'Try for free' },
};

const tr: ContactText = {
  kick: 'İletişim',
  t1: 'Bize görevinizi anlatın —',
  t2: 'bir iş günü içinde yanıtlıyoruz.',
  sub: 'Lumiva’nın satış, depo, rezervasyon, otel veya belge süreçlerinizi nasıl kapsadığını ve rutini hangi yapay zekâ çalışanlarının üstleneceğini gösterelim.',
  formT: 'Demo talebi',
  topics: { demo: 'Demo', pricing: 'Fiyatlar', integration: 'Entegrasyon', support: 'Destek' },
  name: 'Ad',
  namePh: 'Ayşe Yılmaz',
  email: 'E-posta',
  emailPh: 'ayse@sirket.com',
  company: 'Şirket',
  companyPh: 'Şirket adı',
  phone: 'Telefon',
  phonePh: '+90 500 000 00 00',
  team: 'Ekip büyüklüğü',
  teamOpts: ['1–5', '6–20', '21–50', '50+'],
  msg: 'Mesaj',
  msgPh: 'Hangi süreçleri otomatikleştirmek istiyorsunuz? Şu an ne kullanıyorsunuz?',
  send: 'Talebi gönder',
  cons1: 'Butona tıklayarak şunu kabul etmiş olursunuz:',
  cons2: 'gizlilik politikası',
  okT: 'Talep gönderildi',
  okD: (n, e) => `Teşekkürler${n ? ', ' + n : ''}! Talebiniz ekibe ulaştı — ${e || 'e-posta adresinize'} bir iş günü içinde yanıt vereceğiz.`,
  again: 'Bir tane daha gönder',
  err: 'Talep gönderilemedi. Lütfen tekrar deneyin veya hello@lumiva.agency adresine yazın.',
  benT: 'Neler alırsınız',
  ben: [
    'Genel bir sunum değil, sizin senaryolarınıza göre demo',
    'Ekip büyüklüğüne ve gereken modüllere uygun paket',
    'Tablolardan veya mevcut CRM’den veri taşıma planı',
    'Süreçlerinize uygun yapay zekâ çalışanları',
    'Entegrasyonlar ve ödemeler hakkında yanıtlar',
  ],
  waysT: 'Diğer iletişim yolları',
  hoursT: 'Bir iş günü içinde yanıtlıyoruz',
  hoursD: 'Pzt–Cum, 9:00–18:00 (GMT+3)',
  openOn: 'Şu an çevrimiçi',
  openOff: 'Mesai saatlerinde yanıtlıyoruz',
  aiT: 'Mesai dışında bir sorunuz mu var?',
  aiD: 'Sitedeki sohbette yapay zekâ danışmanı hemen yanıtlar — adınızı ve iletişim bilginizi bırakın, görüşmeyi bir yöneticiye aktarsın.',
  aiBtn: 'Sohbeti aç',
  next: {
    k: 'Sonra ne olur',
    t: 'Talepten çalışan bir CRM’e.',
    d: 'Uzun görüşmeler ve taahhüt yok. Kendiniz keşfetmeyi tercih ederseniz deneme erişimi kayıttan hemen sonra açılır.',
    n: 'Adım',
    items: [
      { t: 'Talep', d: 'Talebiniz anında ekibe ulaşır. Konu, ekip büyüklüğü ve mesaj önceden hazırlanmamıza yardımcı olur.' },
      { t: 'Yanıt', d: 'Bir iş günü içinde e-posta veya tercih ettiğiniz mesajlaşma uygulamasıyla yazar, zaman belirleriz.' },
      { t: 'Demo', d: 'İhtiyacınız olan modülleri gösterir, süreçlerinizi birlikte inceleriz: huniler, stok, rezervasyonlar, belgeler.' },
      { t: 'Başlangıç', d: 'Çalışma alanınızı açar, verilerinizi taşımanıza ve ilk yapay zekâ çalışanlarını kurmanıza yardım ederiz.' },
    ],
  },
  faq: {
    k: 'Sorular',
    t: 'Talep öncesi sık sorulanlar.',
    note: 'Yanıt bulamadınız mı? Yukarıdaki',
    write: 'formu kullanın',
    groups: [
      {
        g: 'Talep ve demo',
        items: [
          { q: 'Demo ücretli mi?', a: 'Demo ücretsizdir ve hiçbir yükümlülük getirmez. Sistemi gösterir, sorularınızı yanıtlarız; sözleşme gerekmez.' },
          { q: 'Ne kadar hızlı yanıt veriyorsunuz?', a: 'Bir iş günü içinde: pazartesi–cuma, 9:00–18:00 (GMT+3). Akşam veya hafta sonu yazarsanız bir sonraki iş günü yanıtlarız. Her an anında yanıt için sitedeki sohbette yapay zekâ danışmanını kullanabilirsiniz.' },
          { q: 'Demo olmadan deneyebilir miyim?', a: 'Evet. Kayıt olduğunuzda tüm modülleri içeren 14 günlük deneme açılır. Görüşme ve kart gerekmez.' },
          { q: 'Formda neleri doldurmalıyım?', a: 'Yalnızca ad ve e-posta zorunludur. Şirket, telefon, ekip büyüklüğü ve görev açıklaması isteğe bağlıdır, ancak demoyu size göre hazırlamamıza yardımcı olur.' },
        ],
      },
      {
        g: 'Geçiş ve başlangıç',
        items: [
          { q: 'Verilerimizi taşımaya yardım ediyor musunuz?', a: 'Evet. Potansiyel müşteriler CSV’den, ürünler sütun eşleştirmeli bir dosyadan içe aktarılır; serbest yapılı tablolar ise yapay zekâ ile sütun eşleştirmeli Çalışma Alanı içe aktarımıyla gelir. Demoda sizin verilerinizi nasıl taşıyacağınızı gösteririz.' },
          { q: 'Başlangıç ne kadar sürer?', a: 'Çalışma alanı anında oluşturulur. Temel kurulum — huniler, durumlar, çalışanlar ve izinler — modül ve entegrasyon sayısına bağlı olarak genellikle birkaç gün sürer.' },
          { q: 'Geliştiriciye ihtiyacımız var mı?', a: 'Hayır. Modüller, otomasyonlar, formlar ve entegrasyonlar arayüzden ayarlanır. Özel geliştirmeler için API ve webhook’lar vardır.' },
        ],
      },
      {
        g: 'Paketler ve veriler',
        items: [
          { q: 'Paketler nasıl çalışır?', a: 'Paketler modüllere, kullanıcı ve depolama limitlerine ve kullanılabilir yapay zekâ çalışanlarına göre farklılaşır. Demoda ekibinize uygun paketi seçeriz. Ödeme, ülkenize göre lira, ruble veya euro ile kartla yapılır.' },
          { q: 'Veriler nerede saklanıyor?', a: 'CRM, Avrupa Birliği’ndeki bir sunucuda çalışır. Her gece şifreli yedek alınır ve ikinci bir kopya harici bulut depolamada tutulur.' },
          { q: 'Türkiye ve Rusya için uygun mu?', a: 'Evet. Arayüz Türkçe, İngilizce ve Rusça olarak kullanılabilir; iyzico, PayTR ve YooKassa ile ödeme ve Telegram, WhatsApp, Yandex Direct ve VK Ads entegrasyonları vardır.' },
        ],
      },
    ],
  },
  cta: { k: 'Beklemeden', t: 'Yanıt beklemek istemiyor musunuz? 14 günlük erişiminizi hemen başlatın.', demo: 'Tüm özellikler', tryFree: 'Ücretsiz deneyin' },
};

export const CONTACT_T: Record<'ru' | 'en' | 'tr', ContactText> = { ru, en, tr };
