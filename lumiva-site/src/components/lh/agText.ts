/* Новые тексты редизайна (макет lumiva-agency-home-v2). Всё остальное — из i18n/*.json (home.*, nav.*, footer.*). */
export type AgLang = 'en' | 'ru' | 'tr'

type Prompt = { p: string; who: string; rows: [string, string, '' | 'up' | 'dn'][] }
type Crew = { role: string; name: string; job: string; list: string[] }

type AgText = {
  navAi: string
  pillTag: string
  dash: { projects: string; projectsSub: string; roas: string; roasSub: string; cac: string; cacSub: string; nps: string; npsSub: string; chart: string; leads: string; mix: string; mixNames: string[] }
  fl: { aiDoing: string[]; roasSub: string; cacSub: string }
  clients: string
  ai: { kick: string; title: string; text: string; list: string[]; btn: string; steps: string[]; tabs: string[]; note: string; working: string; prompts: Prompt[] }
  crew: { kick: string; title: string; text: string; status: string; items: Crew[] }
  procW: string[]
  local: { kick: string }
  cases: { empty: string }
  contact: { kick: string; err: string; sending: string }
  footer: { tagline: string; studio: string; local: string; contacts: string }
  drawer: { contacts: string }
}

export const AG_TEXT: Record<AgLang, AgText> = {
  en: {
    navAi: 'AI',
    pillTag: 'Q3 2026',
    dash: {
      projects: 'Projects', projectsSub: 'in 7 years', roas: 'ROAS growth', roasSub: 'average after Q1', cac: 'CAC', cacSub: 'after rebranding',
      nps: 'NPS 2025', npsSub: 'best in 7 years', chart: 'ROAS · RIGEL Athletics · 6 months', leads: 'Leads · Northwind', mix: 'Channel mix', mixNames: ['Search', 'Social', 'SEO', 'CRM'],
    },
    fl: { aiDoing: ['Weekly ROAS report ready', 'CPC spike flagged on Meta', 'Funnel drop-off summary'], roasSub: 'RIGEL Athletics · six months', cacSub: 'Helios Energy configurator' },
    clients: 'Clients',
    ai: {
      kick: 'AI Stack',
      title: 'AI in every workflow',
      text: 'Tools we build into client projects and run inside our own process. AI does the first draft and the routine checks — strategists, designers and analysts make the decisions.',
      list: ['Ad account audits in minutes, not days', 'Weekly reports written in plain language', 'Copy and creative variants for A/B tests', 'Review replies in Turkish, English and Russian'],
      btn: 'Explore Lumiva CRM',
      steps: ['Reading the request', 'Connecting data', 'Analysing', 'Ready for review'],
      tabs: ['Ads audit', 'Weekly report', 'Ad copy', 'Reviews'],
      note: 'Example output · reviewed by the team before it ships',
      working: 'Working…',
      prompts: [
        { p: 'Find wasted spend in our Google Ads account', who: 'Mira AI · Analytics', rows: [['Search terms with no conversions', '14 found', 'dn'], ['Broad-match groups to pause', '3 groups', ''], ['Budget to move to best campaign', '+22%', 'up']] },
        { p: 'Weekly report: ROAS, CAC and funnel drop-off', who: 'Mira AI · Analytics', rows: [['ROAS vs. last week', '↑ 0.3', 'up'], ['CAC by channel', '4 channels', ''], ['Biggest drop-off', 'Cart → Checkout', 'dn']] },
        { p: 'Draft 5 ad headlines for a hotel in Antalya', who: 'Lina AI · Content', rows: [['Sea view, breakfast included', 'v1', ''], ['Book direct — best rate in Antalya', 'v2', ''], ['3 more variants ready for A/B', 'v3–v5', 'up']] },
        { p: 'Reply to new guest reviews in TR, EN and RU', who: 'Vera AI · Reviews', rows: [['Reviews translated', '9', ''], ['Reply drafts for approval', '9', 'up'], ['Negative topics flagged', 'Wi-Fi, check-in', 'dn']] },
      ],
    },
    crew: {
      kick: 'AI team',
      title: 'AI employees working for your growth',
      text: 'Each one has a role, access rules and an action log. Anything sensitive goes to a human for approval.',
      status: 'Working',
      items: [
        { role: 'lead_manager', name: 'AI Employees', job: 'Qualify leads, answer chats and book calls inside Lumiva CRM', list: ['Qualifying a lead from Meta Ads', 'Answering a website chat', 'Booking a discovery call'] },
        { role: 'marketing_analyst', name: 'AI Analytics', job: 'Anomaly alerts and weekly summaries on ROAS, CAC and funnel', list: ['Checking ROAS by channel', 'Flagging a CPC spike', 'Writing the weekly summary'] },
        { role: 'marketing_manager', name: 'AI Content', job: 'Drafts of ad copy, SEO texts and A/B variants', list: ['Drafting ad headlines', 'Writing meta descriptions', 'Preparing A/B variants'] },
        { role: 'reviews_manager', name: 'Review Management', job: 'Reads reviews in any language, translates and drafts replies', list: ['Translating a review from Turkish', 'Drafting a reply', 'Tagging review topics'] },
      ],
    },
    procW: ['Week 1', 'Week 2', 'Sprints', 'Monthly'],
    local: { kick: 'Local Expertise' },
    cases: { empty: 'Case studies are loading…' },
    contact: { kick: 'Contact', err: 'Could not send. Please email vlad@lumiva.agency or try again.', sending: 'Sending…' },
    footer: { tagline: 'Lumiva — Brand & Marketing Studio.', studio: 'Studio', local: 'Antalya & Turkey', contacts: 'Contacts' },
    drawer: { contacts: 'Contacts' },
  },
  ru: {
    navAi: 'ИИ',
    pillTag: 'Q3 2026',
    dash: {
      projects: 'Проекты', projectsSub: 'за 7 лет', roas: 'Рост ROAS', roasSub: 'в среднем после Q1', cac: 'CAC', cacSub: 'после ребрендинга',
      nps: 'NPS 2025', npsSub: 'лучший за 7 лет', chart: 'ROAS · RIGEL Athletics · 6 месяцев', leads: 'Лиды · Northwind', mix: 'Каналы', mixNames: ['Поиск', 'Соцсети', 'SEO', 'CRM'],
    },
    fl: { aiDoing: ['Недельный отчёт по ROAS готов', 'Скачок CPC в Meta отмечен', 'Сводка по провалам воронки'], roasSub: 'RIGEL Athletics · полгода', cacSub: 'Конфигуратор Helios Energy' },
    clients: 'Клиенты',
    ai: {
      kick: 'ИИ-стек',
      title: 'ИИ в каждом процессе',
      text: 'Инструменты, которые мы встраиваем в проекты клиентов и используем сами. ИИ делает черновик и рутинные проверки — решения принимают стратеги, дизайнеры и аналитики.',
      list: ['Аудит рекламного кабинета за минуты, а не дни', 'Недельные отчёты простым языком', 'Варианты текстов и креативов для A/B-тестов', 'Ответы на отзывы на турецком, английском и русском'],
      btn: 'Посмотреть Lumiva CRM',
      steps: ['Читаем запрос', 'Подключаем данные', 'Анализируем', 'Готово к проверке'],
      tabs: ['Аудит рекламы', 'Недельный отчёт', 'Тексты', 'Отзывы'],
      note: 'Пример результата · команда проверяет перед отправкой',
      working: 'Работаем…',
      prompts: [
        { p: 'Найди слитый бюджет в нашем Google Ads', who: 'Mira AI · Аналитика', rows: [['Запросы без конверсий', 'найдено 14', 'dn'], ['Группы широкого соответствия на паузу', '3 группы', ''], ['Бюджет в лучшую кампанию', '+22%', 'up']] },
        { p: 'Недельный отчёт: ROAS, CAC и провалы воронки', who: 'Mira AI · Аналитика', rows: [['ROAS к прошлой неделе', '↑ 0,3', 'up'], ['CAC по каналам', '4 канала', ''], ['Главный провал', 'Корзина → Оплата', 'dn']] },
        { p: 'Напиши 5 заголовков объявлений для отеля в Анталье', who: 'Lina AI · Контент', rows: [['Вид на море, завтрак включён', 'v1', ''], ['Бронируйте напрямую — лучшая цена', 'v2', ''], ['Ещё 3 варианта для A/B', 'v3–v5', 'up']] },
        { p: 'Ответь на новые отзывы гостей на TR, EN и RU', who: 'Vera AI · Отзывы', rows: [['Отзывов переведено', '9', ''], ['Черновиков ответа на согласование', '9', 'up'], ['Негативные темы', 'Wi-Fi, заселение', 'dn']] },
      ],
    },
    crew: {
      kick: 'ИИ-команда',
      title: 'ИИ-сотрудники, которые работают на ваш рост',
      text: 'У каждого — роль, правила доступа и журнал действий. Всё чувствительное уходит человеку на согласование.',
      status: 'Работает',
      items: [
        { role: 'lead_manager', name: 'ИИ-сотрудники', job: 'Квалифицируют лиды, отвечают в чатах и записывают на звонок в Lumiva CRM', list: ['Квалифицирует лид из Meta Ads', 'Отвечает в чате на сайте', 'Записывает на созвон'] },
        { role: 'marketing_analyst', name: 'ИИ-аналитика', job: 'Сигналы об аномалиях и недельные сводки по ROAS, CAC и воронке', list: ['Проверяет ROAS по каналам', 'Отмечает скачок CPC', 'Пишет недельную сводку'] },
        { role: 'marketing_manager', name: 'ИИ-контент', job: 'Черновики объявлений, SEO-текстов и вариантов для A/B', list: ['Пишет заголовки объявлений', 'Готовит meta description', 'Собирает варианты для A/B'] },
        { role: 'reviews_manager', name: 'Работа с отзывами', job: 'Читает отзывы на любом языке, переводит и готовит ответы', list: ['Переводит отзыв с турецкого', 'Готовит ответ', 'Размечает темы отзывов'] },
      ],
    },
    procW: ['Неделя 1', 'Неделя 2', 'Спринты', 'Ежемесячно'],
    local: { kick: 'Локальная экспертиза' },
    cases: { empty: 'Загружаем кейсы…' },
    contact: { kick: 'Контакты', err: 'Не удалось отправить. Напишите на vlad@lumiva.agency или попробуйте ещё раз.', sending: 'Отправляем…' },
    footer: { tagline: 'Lumiva — Brand & Marketing Studio.', studio: 'Студия', local: 'Анталья и Турция', contacts: 'Контакты' },
    drawer: { contacts: 'Контакты' },
  },
  tr: {
    navAi: 'Yapay zekâ',
    pillTag: 'Q3 2026',
    dash: {
      projects: 'Projeler', projectsSub: '7 yılda', roas: 'ROAS artışı', roasSub: 'Q1 sonrası ortalama', cac: 'CAC', cacSub: 'yeniden markalaşma sonrası',
      nps: 'NPS 2025', npsSub: '7 yılın en iyisi', chart: 'ROAS · RIGEL Athletics · 6 ay', leads: 'Lead · Northwind', mix: 'Kanal dağılımı', mixNames: ['Arama', 'Sosyal', 'SEO', 'CRM'],
    },
    fl: { aiDoing: ['Haftalık ROAS raporu hazır', "Meta'da CPC artışı işaretlendi", 'Huni kayıpları özeti'], roasSub: 'RIGEL Athletics · altı ay', cacSub: 'Helios Energy yapılandırıcısı' },
    clients: 'Müşteriler',
    ai: {
      kick: 'Yapay zekâ',
      title: 'Her süreçte yapay zekâ',
      text: 'Müşteri projelerine entegre ettiğimiz ve kendi sürecimizde kullandığımız araçlar. İlk taslağı ve rutin kontrolleri yapay zekâ yapar — kararları stratejistler, tasarımcılar ve analistler verir.',
      list: ['Reklam hesabı denetimi günler değil dakikalar içinde', 'Sade dille yazılmış haftalık raporlar', 'A/B testleri için metin ve kreatif varyantları', 'Türkçe, İngilizce ve Rusça yorum yanıtları'],
      btn: "Lumiva CRM'i keşfedin",
      steps: ['İstek okunuyor', 'Veriler bağlanıyor', 'Analiz ediliyor', 'İncelemeye hazır'],
      tabs: ['Reklam denetimi', 'Haftalık rapor', 'Reklam metni', 'Yorumlar'],
      note: 'Örnek çıktı · gönderilmeden önce ekip tarafından kontrol edilir',
      working: 'Çalışıyor…',
      prompts: [
        { p: 'Google Ads hesabımızdaki boşa harcamayı bul', who: 'Mira AI · Analitik', rows: [['Dönüşümsüz arama terimleri', '14 bulundu', 'dn'], ['Durdurulacak geniş eşleme grupları', '3 grup', ''], ['En iyi kampanyaya aktarılacak bütçe', '+%22', 'up']] },
        { p: 'Haftalık rapor: ROAS, CAC ve huni kayıpları', who: 'Mira AI · Analitik', rows: [['Geçen haftaya göre ROAS', '↑ 0,3', 'up'], ['Kanallara göre CAC', '4 kanal', ''], ['En büyük kayıp', 'Sepet → Ödeme', 'dn']] },
        { p: "Antalya'daki bir otel için 5 reklam başlığı yaz", who: 'Lina AI · İçerik', rows: [['Deniz manzarası, kahvaltı dahil', 'v1', ''], ["Doğrudan rezervasyon — Antalya'nın en iyi fiyatı", 'v2', ''], ['A/B için 3 varyant daha', 'v3–v5', 'up']] },
        { p: 'Yeni misafir yorumlarını TR, EN ve RU dillerinde yanıtla', who: 'Vera AI · Yorumlar', rows: [['Çevrilen yorumlar', '9', ''], ['Onay bekleyen yanıt taslakları', '9', 'up'], ['Olumsuz konular', 'Wi-Fi, check-in', 'dn']] },
      ],
    },
    crew: {
      kick: 'Yapay zekâ ekibi',
      title: 'Büyümeniz için çalışan yapay zekâ çalışanları',
      text: 'Her birinin bir rolü, erişim kuralları ve işlem günlüğü var. Hassas her şey onay için bir insana gider.',
      status: 'Çalışıyor',
      items: [
        { role: 'lead_manager', name: 'Yapay zekâ çalışanları', job: "Lumiva CRM içinde lead'leri nitelendirir, sohbetleri yanıtlar ve görüşme planlar", list: ["Meta Ads'ten gelen lead nitelendiriliyor", 'Site sohbeti yanıtlanıyor', 'Keşif görüşmesi planlanıyor'] },
        { role: 'marketing_analyst', name: 'Yapay zekâ analitiği', job: 'ROAS, CAC ve huni için anomali uyarıları ve haftalık özetler', list: ['Kanallara göre ROAS kontrolü', 'CPC artışı işaretleniyor', 'Haftalık özet yazılıyor'] },
        { role: 'marketing_manager', name: 'Yapay zekâ içerik', job: 'Reklam metni, SEO metinleri ve A/B varyant taslakları', list: ['Reklam başlıkları yazılıyor', 'Meta açıklamaları yazılıyor', 'A/B varyantları hazırlanıyor'] },
        { role: 'reviews_manager', name: 'Yorum yönetimi', job: 'Yorumları her dilde okur, çevirir ve yanıt taslağı hazırlar', list: ['Türkçe bir yorum çevriliyor', 'Yanıt taslağı hazırlanıyor', 'Yorum konuları etiketleniyor'] },
      ],
    },
    procW: ['1. hafta', '2. hafta', 'Sprintler', 'Aylık'],
    local: { kick: 'Yerel uzmanlık' },
    cases: { empty: 'Vakalar yükleniyor…' },
    contact: { kick: 'İletişim', err: 'Gönderilemedi. Lütfen vlad@lumiva.agency adresine yazın veya tekrar deneyin.', sending: 'Gönderiliyor…' },
    footer: { tagline: 'Lumiva — Brand & Marketing Studio.', studio: 'Stüdyo', local: 'Antalya ve Türkiye', contacts: 'İletişim' },
    drawer: { contacts: 'İletişim' },
  },
}

export const agLang = (l?: string): AgLang => (l?.startsWith('ru') ? 'ru' : l?.startsWith('tr') ? 'tr' : 'en')
