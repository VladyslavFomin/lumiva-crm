import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

/* ─── Icons ─── */
const CheckIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 9l-7 7-7-7" />
  </svg>
);

/* ─── Translations ─── */
const T = {
  ru: {
    kicker: 'ТАРИФЫ · ОБНОВЛЕНО АПРЕЛЬ 2026',
    title1: 'Платите за команду,',
    title2: 'а не за функции.',
    sub: 'Все 9 модулей доступны на всех тарифах. Разница — в лимитах, каналах и уровне поддержки. Никаких скрытых блокировок.',
    monthly: 'Ежемесячно',
    yearly: 'Ежегодно',
    save: '−20%',
    perMonth: '/ мес',
    perMonthYearly: '/ мес, при годовой',
    onRequest: 'По запросу',
    tryFree: '14 дней бесплатно',
    startFree: 'Начать бесплатно',
    contactUs: 'Связаться',
    calcTitle: 'Подберите тариф под вашу команду.',
    calcSub: 'Двигайте слайдеры — увидите итоговую сумму и подходящий тариф.',
    calcKicker: 'КАЛЬКУЛЯТОР',
    calcUsers: 'Активных пользователей',
    calcLeads: 'Лидов в месяц',
    calcAddons: 'ДОПОЛНИТЕЛЬНО',
    calcTotal: 'В МЕСЯЦ',
    calcYearly: 'при годовой оплате',
    calcMonthly: 'ежемесячно',
    calcApply: 'Оформить',
    calcTalk: 'Обсудить с менеджером',
    calcBaseCost: 'Базовая стоимость',
    calcExtraUsers: 'Доп. пользователи',
    calcExtraLeads: 'Сверх лимита лидов',
    calcExtraModules: 'Доп. модули',
    cmpKicker: 'СРАВНЕНИЕ',
    cmpTitle: 'Всё в одной таблице.',
    cmpSub: 'Полное сравнение по 40+ параметрам. Что включено — без мелкого шрифта.',
    faqKicker: 'ВОПРОСЫ',
    faqTitle: 'Частые вопросы.',
    faqSub: 'Если чего-то не хватает — ',
    faqLink: 'полный FAQ',
    faqOr: ' или напишите нам.',
    ctaKicker: 'ГОТОВЫ ПОПРОБОВАТЬ?',
    ctaTitle: '14 дней на Enterprise. Без карты. Без звонков.',
    ctaCreate: 'Создать аккаунт',
    ctaDemo: 'Демо',
    fromYear: 'от €624/год',
    currency: '€',
    planAddons: [
      { k: 'wa',    l: 'WhatsApp Business API',  p: '+€9/мес на Standard' },
      { k: 'calls', l: 'IP-телефония и звонки',  p: '+€14/мес' },
      { k: 'bi',    l: 'Расширенный BI',         p: '+€19/мес на Standard' },
    ],
  },
  en: {
    kicker: 'PRICING · UPDATED APRIL 2026',
    title1: 'Pay for your team,',
    title2: 'not for features.',
    sub: 'All 9 modules are available on every plan. The difference is in limits, channels and support level. No hidden feature locks.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: '−20%',
    perMonth: '/ mo',
    perMonthYearly: '/ mo, billed yearly',
    onRequest: 'On request',
    tryFree: '14 days free',
    startFree: 'Start free',
    contactUs: 'Contact us',
    calcTitle: 'Find the right plan for your team.',
    calcSub: 'Move the sliders — see the total and the recommended plan.',
    calcKicker: 'CALCULATOR',
    calcUsers: 'Active users',
    calcLeads: 'Leads per month',
    calcAddons: 'ADD-ONS',
    calcTotal: 'PER MONTH',
    calcYearly: 'billed yearly',
    calcMonthly: 'billed monthly',
    calcApply: 'Get started',
    calcTalk: 'Talk to sales',
    calcBaseCost: 'Base plan',
    calcExtraUsers: 'Extra users',
    calcExtraLeads: 'Leads overage',
    calcExtraModules: 'Add-on modules',
    cmpKicker: 'COMPARISON',
    cmpTitle: 'Everything in one table.',
    cmpSub: 'Full comparison across 40+ parameters. No small print.',
    faqKicker: 'FAQ',
    faqTitle: 'Common questions.',
    faqSub: "If something's missing — ",
    faqLink: 'full FAQ',
    faqOr: ' or write to us.',
    ctaKicker: 'READY TO START?',
    ctaTitle: '14 days on Enterprise. No card. No calls.',
    ctaCreate: 'Create account',
    ctaDemo: 'Book a demo',
    fromYear: 'from €624/yr',
    currency: '€',
    planAddons: [
      { k: 'wa',    l: 'WhatsApp Business API',  p: '+€9/mo on Standard' },
      { k: 'calls', l: 'IP telephony & calls',   p: '+€14/mo' },
      { k: 'bi',    l: 'Advanced BI',            p: '+€19/mo on Standard' },
    ],
  },
  tr: {
    kicker: 'FİYATLANDIRMA · NİSAN 2026',
    title1: 'Ekibiniz için ödeyin,',
    title2: 'özellikler için değil.',
    sub: 'Tüm 9 modül her planda mevcuttur. Fark limit, kanal ve destek düzeyindedir. Gizli kilitler yok.',
    monthly: 'Aylık',
    yearly: 'Yıllık',
    save: '−20%',
    perMonth: '/ ay',
    perMonthYearly: '/ ay, yıllık ödeme',
    onRequest: 'Teklif alın',
    tryFree: '14 gün ücretsiz',
    startFree: 'Ücretsiz başla',
    contactUs: 'İletişime geç',
    calcTitle: 'Ekibinize uygun planı bulun.',
    calcSub: 'Kaydırıcıları hareket ettirin — toplam tutarı ve önerilen planı görün.',
    calcKicker: 'HESAP MAKİNESİ',
    calcUsers: 'Aktif kullanıcı',
    calcLeads: 'Aylık lead',
    calcAddons: 'EKLENTİLER',
    calcTotal: 'AYLIK',
    calcYearly: 'yıllık ödeme',
    calcMonthly: 'aylık ödeme',
    calcApply: 'Başla',
    calcTalk: 'Satış ekibiyle görüş',
    calcBaseCost: 'Temel plan',
    calcExtraUsers: 'Ekstra kullanıcılar',
    calcExtraLeads: 'Lead aşımı',
    calcExtraModules: 'Ek modüller',
    cmpKicker: 'KARŞILAŞTIRMA',
    cmpTitle: 'Her şey tek tabloda.',
    cmpSub: '40+ parametreyle tam karşılaştırma. Küçük punto yok.',
    faqKicker: 'SORULAR',
    faqTitle: 'Sık sorulan sorular.',
    faqSub: 'Bir şey eksikse — ',
    faqLink: 'tam SSS',
    faqOr: ' veya bize yazın.',
    ctaKicker: 'BAŞLAMAYA HAZIR MISINIZ?',
    ctaTitle: "Enterprise'da 14 gün. Kart yok. Arama yok.",
    ctaCreate: 'Hesap oluştur',
    ctaDemo: 'Demo ayarla',
    fromYear: '€624/yıldan',
    currency: '€',
    planAddons: [
      { k: 'wa',    l: 'WhatsApp Business API',  p: 'Standard\'da +€9/ay' },
      { k: 'calls', l: 'IP telefon ve aramalar', p: '+€14/ay' },
      { k: 'bi',    l: 'Gelişmiş BI',            p: 'Standard\'da +€19/ay' },
    ],
  },
};

type Lang = 'ru' | 'en' | 'tr';

/* ─── Plan data ─── */
function getPlans(lang: Lang) {
  if (lang === 'en') return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'For quick team launch. Core CRM for daily sales and marketing.',
      prices: { m: 14, y: 11 }, cta: { label: 'Start free', primary: false },
      feats: [
        { b: 'Leads, contacts, companies, deals' }, { b: 'Pipeline & basic analytics' },
        { b: 'Marketing + UTM tags' }, { b: 'Email templates & campaigns' },
        { b: 'Projects and tasks' }, { b: 'CF7 / WooCommerce integrations' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'For growth and automation. Scale your process and control.',
      prices: { m: 23, y: 18 }, cta: { label: 'Start free', primary: false },
      feats: [
        { b: 'Everything in Standard' }, { b: 'Automation & trigger scenarios' },
        { b: 'Telegram and chat module' }, { b: 'SMM and advanced integrations' },
        { b: 'Sales pipeline + KPI analytics' }, { b: 'Advanced roles and team workflows' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'POPULAR', featured: true,
      sub: 'Maximum control, security, and deep analytics for leadership teams.',
      prices: { m: 40, y: 32 }, cta: { label: '14 days free', primary: true, white: true },
      feats: [
        { b: 'Everything in Professional' }, { b: 'Client Accounts & portals' },
        { b: 'Deep BI analytics', s: 'by departments' }, { b: 'Implementation planning', s: 'for your process' },
        { b: 'Sales optimization consulting' }, { b: '24/7 support with SLA' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Premium package with consulting and custom implementation support.',
      prices: { m: 52, y: 42 }, cta: { label: 'Contact us', primary: false },
      feats: [
        { b: 'Everything in Enterprise' }, { b: 'Business-tailored architecture' },
        { b: 'Priority technical support 24/7' }, { b: 'Dedicated consulting & roadmap' },
        { b: 'Migration and release support' }, { b: 'Expert support for complex integrations' },
        { b: 'Custom domain', s: 'crm.yourcompany.com' },
      ],
      addons: '+ €5/mo per additional user',
    },
  ];
  if (lang === 'tr') return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'Hızlı ekip başlangıcı için. Günlük satış ve pazarlama için CRM.',
      prices: { m: 14, y: 11 }, cta: { label: 'Ücretsiz başla', primary: false },
      feats: [
        { b: 'Lead, kişi, şirket ve fırsat' }, { b: 'Pipeline ve temel analitik' },
        { b: 'Pazarlama + UTM etiketleri' }, { b: 'Email şablonları ve gönderimler' },
        { b: 'Projeler ve görevler' }, { b: 'CF7 / WooCommerce entegrasyonları' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'Büyüme ve otomasyon için. Süreç kontrolünü güçlendirin.',
      prices: { m: 23, y: 18 }, cta: { label: 'Ücretsiz başla', primary: false },
      feats: [
        { b: 'Standard içindeki her şey' }, { b: 'Otomasyon ve tetikleyici senaryolar' },
        { b: 'Telegram ve sohbet modülü' }, { b: 'SMM ve gelişmiş entegrasyonlar' },
        { b: 'Satış pipeline + KPI analitiği' }, { b: 'Gelişmiş rol ve ekip süreçleri' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'POPÜLER', featured: true,
      sub: 'Yönetim için maksimum kontrol, güvenlik ve derin analitik.',
      prices: { m: 40, y: 32 }, cta: { label: '14 gün ücretsiz', primary: true, white: true },
      feats: [
        { b: 'Professional içindeki her şey' }, { b: 'Client Accounts ve müşteri portalları' },
        { b: 'Departman bazlı derin BI analitiği' }, { b: 'Özel kurulum planı' },
        { b: 'Satış optimizasyon danışmanlığı' }, { b: 'SLA ile 7/24 destek' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Danışmanlık ve özelleştirme desteği içeren premium paket.',
      prices: { m: 52, y: 42 }, cta: { label: 'İletişime geç', primary: false },
      feats: [
        { b: 'Enterprise içindeki her şey' }, { b: 'İşinize özel mimari' },
        { b: 'Öncelikli teknik destek 7/24' }, { b: 'Özel danışmanlık ve roadmap' },
        { b: 'Migrasyon ve release desteği' }, { b: 'Karmaşık entegrasyonlar için uzman destek' },
        { b: 'Özel domain', s: 'crm.sirketiniz.com' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
  ];
  // ru default
  return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'Для быстрого запуска команды. Базовый CRM для ежедневной работы.',
      prices: { m: 14, y: 11 }, cta: { label: 'Начать бесплатно', primary: false },
      feats: [
        { b: 'Лиды, контакты, компании, сделки' }, { b: 'Воронка продаж и базовая аналитика' },
        { b: 'Маркетинг и UTM-метки' }, { b: 'Email шаблоны и отправки' },
        { b: 'Проекты и задачи' }, { b: 'Интеграции CF7 / WooCommerce' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'Для роста и автоматизации. Масштабируйте и усиливайте управляемость.',
      prices: { m: 23, y: 18 }, cta: { label: 'Начать бесплатно', primary: false },
      feats: [
        { b: 'Всё из Standard' }, { b: 'Автоматизации и триггерные сценарии' },
        { b: 'Telegram и чат-модуль' }, { b: 'SMM и расширенные интеграции' },
        { b: 'Sales pipeline + KPI аналитика' }, { b: 'Расширенные права и процессы команд' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'ПОПУЛЯРНЫЙ', featured: true,
      sub: 'Максимум контроля, безопасности и глубокой аналитики для руководителей.',
      prices: { m: 40, y: 32 }, cta: { label: '14 дней бесплатно', primary: true, white: true },
      feats: [
        { b: 'Всё из Professional' }, { b: 'Client Accounts и клиентские порталы' },
        { b: 'Глубокая BI/аналитика', s: 'по отделам' }, { b: 'Планирование внедрения', s: 'под ваш процесс' },
        { b: 'Консалтинг по оптимизации продаж' }, { b: 'Поддержка 24/7 с SLA' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Премиальный пакет с сопровождением, консалтингом и кастомизацией.',
      prices: { m: 52, y: 42 }, cta: { label: 'Связаться', primary: false },
      feats: [
        { b: 'Всё из Enterprise' }, { b: 'Индивидуальная архитектура под бизнес' },
        { b: 'Приоритетная техническая линия 24/7' }, { b: 'Выделенный консалтинг и roadmap' },
        { b: 'Миграция и сопровождение релизов' }, { b: 'Экспертная поддержка сложных интеграций' },
        { b: 'Личный домен', s: 'crm.вашакомпания.рф' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
  ];
}

function getCmpSections(lang: Lang) {
  const e = lang === 'en', tr = lang === 'tr';
  const U = e ? 'Unlimited' : tr ? 'Limitsiz' : 'Без лимита';
  const C = e ? 'Custom' : tr ? 'Özel' : 'Кастомные';
  return [
    { name: e ? 'Data & Sources' : tr ? 'Veri ve Kaynaklar' : 'Данные и источники', rows: [
      { f: e ? 'Leads/mo' : tr ? 'Aylık lead' : 'Лиды в месяц', d: e ? 'included' : tr ? 'dahil' : 'включено', vals: [e ? '5,000' : tr ? '5.000' : '5 000', e ? '25,000' : tr ? '25.000' : '25 000', U, U] },
      { f: e ? 'Integrations' : tr ? 'Entegrasyonlar' : 'Интеграции', d: e ? 'connectors' : tr ? 'bağlayıcılar' : 'коннекторов', vals: ['10', '50+', '80+', '80+ + ' + C] },
      { f: e ? 'Deduplication' : tr ? 'Yineleme kaldırma' : 'Дедупликация', vals: ['✓', '✓', '✓', '✓'] },
      { f: e ? 'Scoring' : tr ? 'Skorlama' : 'Скоринг', d: e ? 'rules + ML' : tr ? 'kurallar + ML' : 'правила + ML', vals: [e ? 'Basic' : tr ? 'Temel' : 'Базовый', '✓', e ? 'Advanced' : tr ? 'Gelişmiş' : 'Advanced', e ? 'Advanced + custom' : tr ? 'Gelişmiş + özel' : 'Advanced + кастом'] },
      { f: e ? 'Enrichment' : tr ? 'Zenginleştirme' : 'Обогащение', vals: ['—', '—', '✓', '✓'] },
    ]},
    { name: e ? 'Sales' : tr ? 'Satış' : 'Продажи', rows: [
      { f: e ? 'Pipelines' : tr ? 'Pipeline sayısı' : 'Воронок', vals: ['1', '3', '∞', '∞'] },
      { f: e ? 'Pipeline stages' : tr ? 'Aşama sayısı' : 'Стадий в воронке', vals: [e ? 'Up to 7' : tr ? '7\'ye kadar' : 'До 7', e ? 'Up to 32' : tr ? '32\'ye kadar' : 'До 32', U, U] },
      { f: e ? 'Forecasts' : tr ? 'Tahminler' : 'Форкасты', vals: ['—', '✓', '✓ + ML', '✓ + ML'] },
      { f: e ? 'Auto-tasks' : tr ? 'Otomatik görevler' : 'Авто-задачи', vals: [e ? 'Basic' : tr ? 'Temel' : 'Базовые', '✓', '✓', '✓'] },
      { f: e ? 'Mobile app' : tr ? 'Mobil uygulama' : 'Мобильное приложение', vals: ['✓', '✓', '✓', '✓ + MDM'] },
    ]},
    { name: e ? 'Communications' : tr ? 'İletişim' : 'Коммуникации', rows: [
      { f: 'Email / SMS / Telegram', vals: ['✓', '✓', '✓', '✓'] },
      { f: 'WhatsApp Business', vals: ['—', '✓', '✓', '✓'] },
      { f: e ? 'IP telephony' : tr ? 'IP telefon' : 'Звонки (IP-телефония)', vals: ['—', '✓', '✓', e ? '✓ + 3yr rec.' : tr ? '✓ + 3 yıl kayıt' : '✓ + запись 3 года'] },
      { f: e ? 'Push (web + mobile)' : tr ? 'Push (web + mobil)' : 'Push (web + mobile)', vals: ['—', '✓', '✓', '✓'] },
      { f: e ? 'Templates' : tr ? 'Şablonlar' : 'Шаблоны', vals: ['20', U, U, U] },
    ]},
    { name: e ? 'Automation' : tr ? 'Otomasyon' : 'Автоматизация', rows: [
      { f: e ? 'Scenarios' : tr ? 'Senaryo sayısı' : 'Сценарии', vals: ['5', '∞', '∞', '∞'] },
      { f: e ? 'Triggers' : tr ? 'Tetikleyiciler' : 'Триггеры', vals: ['12', '80+', '80+', '80+ + ' + C] },
      { f: e ? 'A/B tests' : tr ? 'A/B testler' : 'A/B тесты', vals: ['—', '✓', '✓', '✓'] },
      { f: 'Webhooks', vals: [e ? '10/mo' : tr ? '10/ay' : '10/мес', U, U, U] },
      { f: e ? 'Playbooks library' : tr ? 'Hazır oyun kitapları' : 'Готовые плейбуки', vals: ['12', '120+', '120+', e ? '120+ + custom' : tr ? '120+ + özel' : '120+ + кастом'] },
    ]},
    { name: e ? 'Analytics' : tr ? 'Analitik' : 'Аналитика', rows: [
      { f: e ? 'Dashboards' : tr ? 'Dashboard sayısı' : 'Готовых дашбордов', vals: ['5', '80+', '80+', '80+ + ' + C] },
      { f: e ? 'Report builder' : tr ? 'Rapor oluşturucu' : 'Конструктор отчётов', vals: ['—', '✓', '✓', '✓ + SQL'] },
      { f: e ? 'Attribution' : tr ? 'Atıf' : 'Атрибуция', vals: [e ? 'Last-click' : tr ? 'Son tıklama' : 'Last-click', e ? 'All models' : tr ? 'Tüm modeller' : 'Все модели', e ? 'All + MMM' : tr ? 'Tümü + MMM' : 'Все + MMM', e ? 'All + custom' : tr ? 'Tümü + özel' : 'Все + кастом'] },
      { f: e ? 'PDF/CSV export' : tr ? 'PDF/CSV dışa aktarma' : 'Экспорт PDF/CSV', vals: ['✓', '✓', '✓', '✓'] },
      { f: e ? 'Scheduled reports' : tr ? 'Zamanlanmış raporlar' : 'Отчёты по расписанию', vals: ['—', '✓', '✓', '✓'] },
    ]},
    { name: e ? 'Security & Access' : tr ? 'Güvenlik ve Erişim' : 'Безопасность и доступы', rows: [
      { f: '2FA', vals: ['✓', '✓', '✓', '✓'] },
      { f: 'SSO / SAML', vals: ['—', '—', '✓', '✓'] },
      { f: 'RBAC', d: e ? 'flexible roles' : tr ? 'esnek roller' : 'гибкие роли', vals: [e ? '3 roles' : tr ? '3 rol' : '3 роли', C, e ? C + ' + hier.' : tr ? C + ' + hiyerarşi' : C + ' + иерархия', e ? C + ' + hier.' : tr ? C + ' + hiyerarşi' : C + ' + иерархия'] },
      { f: e ? 'Audit log' : tr ? 'Denetim günlüğü' : 'Журнал аудита', vals: [e ? '30 days' : tr ? '30 gün' : '30 дней', e ? '1 year' : tr ? '1 yıl' : '1 год', e ? '7 years' : tr ? '7 yıl' : '7 лет', e ? '7 years' : tr ? '7 yıl' : '7 лет'] },
      { f: 'SOC 2 Type II', vals: ['✓', '✓', '✓', '✓'] },
      { f: e ? 'Client portals' : tr ? 'Müşteri portalları' : 'Клиентские порталы', vals: ['—', '—', '✓', '✓'] },
    ]},
    { name: e ? 'Support' : tr ? 'Destek' : 'Поддержка', rows: [
      { f: e ? 'Channel' : tr ? 'Kanal' : 'Канал', vals: ['Email', e ? 'Chat' : tr ? 'Sohbet' : 'Чат', e ? 'Chat 24/7' : tr ? '7/24 sohbet' : 'Чат 24/7', e ? 'Dedicated CSM' : tr ? 'Özel CSM' : 'Выделенный CSM'] },
      { f: 'SLA', vals: [e ? '48h' : tr ? '48s' : '48ч', e ? '8h' : tr ? '8s' : '8ч', e ? '4h' : tr ? '4s' : '4ч', e ? '1h' : tr ? '1s' : '1ч'] },
      { f: e ? 'Training' : tr ? 'Eğitim' : 'Обучение', vals: [e ? 'Docs' : tr ? 'Dökümantasyon' : 'Документация', e ? 'Webinars' : tr ? 'Web seminerler' : 'Вебинары', e ? 'Webinars + Academy' : tr ? 'Akademi' : 'Академия', e ? 'Onsite + workshops' : tr ? 'Yerinde + atölyeler' : 'Онсайт + воркшопы'] },
      { f: e ? 'Consulting' : tr ? 'Danışmanlık' : 'Консалтинг', vals: ['—', '—', '✓', e ? '✓ dedicated' : tr ? '✓ özel' : '✓ выделенный'] },
    ]},
  ];
}

function getFaqs(lang: Lang) {
  if (lang === 'en') return [
    { q: 'Can I change my plan?', a: 'Yes, at any time. Upgrade takes effect immediately with prorated billing. Downgrade takes effect at the start of the next billing period, no penalties.' },
    { q: 'How are leads counted?', a: 'A lead is a unique contact that enters the system in a month. If the same contact comes in again in the same month, it does not increment the counter. The counter resets on the 1st.' },
    { q: 'What happens if I exceed the lead limit?', a: "We don't shut anything down. Overages are billed at plan rate: €5 per 1,000 additional leads. You can set a hard limit in settings." },
    { q: 'Is there a free trial?', a: 'Standard and Professional start free — the account runs in a limited mode until you pick a plan. Enterprise includes a 14-day trial with full access, no card required.' },
    { q: 'Does the price include VAT?', a: 'Prices shown are exclusive of VAT/taxes. Applicable taxes will be added at checkout based on your location.' },
    { q: 'What payment methods are accepted?', a: 'Card, bank transfer, SEPA, crypto (USDT, USDC), Stripe for international clients.' },
    { q: 'Where is data stored?', a: 'Your choice: Moscow (152-FZ), Frankfurt (GDPR) or Istanbul. Enterprise — any cloud or on-prem.' },
    { q: 'Are there discounts?', a: 'Annual billing — 20% off. Startups under 2 years — 40%. Non-profits — 50%. Team training — free.' },
  ];
  if (lang === 'tr') return [
    { q: 'Planımı değiştirebilir miyim?', a: 'Evet, istediğiniz zaman. Yükseltme hemen geçerli olur, orantılı faturalandırma ile. Düşürme bir sonraki dönemin başında geçerli olur, ceza yok.' },
    { q: 'Leadler nasıl sayılır?', a: 'Bir lead, bir ayda sisteme giren benzersiz bir kişidir. Aynı kişi aynı ay tekrar gelirse sayaç artmaz. Sayaç 1\'inde sıfırlanır.' },
    { q: 'Lead limitini aşarsam ne olur?', a: 'Hiçbir şeyi kapatmıyoruz. Aşımlar plan fiyatıyla faturalandırılır: her ek 1.000 lead için €5. Ayarlarda sert limit belirleyebilirsiniz.' },
    { q: 'Ücretsiz deneme var mı?', a: 'Standard ve Professional ücretsiz başlar — bir plan seçene kadar hesap sınırlı modda çalışır. Enterprise, kart gerektirmeyen 14 günlük tam erişimli bir deneme içerir.' },
    { q: 'Fiyata KDV dahil mi?', a: 'Gösterilen fiyatlar KDV hariçtir. Ödeme sırasında konumunuza göre geçerli vergiler eklenir.' },
    { q: 'Hangi ödeme yöntemleri kabul ediliyor?', a: 'Kart, banka havalesi, kripto (USDT, USDC), uluslararası müşteriler için Stripe.' },
    { q: 'Veriler nerede saklanır?', a: 'Seçiminize göre: Moskova (152-FZ), Frankfurt (GDPR) veya İstanbul. Enterprise — herhangi bir bulut veya şirket içi.' },
    { q: 'İndirim var mı?', a: 'Yıllık ödeme — %20 indirim. 2 yıldan genç girişimler — %40. Sivil toplum kuruluşları — %50. Ekip eğitimi — ücretsiz.' },
  ];
  return [
    { q: 'Могу ли я сменить тариф?', a: 'Да, в любой момент. Повышение — сразу, с пропорциональной оплатой разницы. Понижение — с начала следующего периода, без штрафов.' },
    { q: 'Как считаются лиды?', a: 'Лид — это уникальный контакт, пришедший в систему за месяц. Если один контакт приходит повторно в том же месяце, он не увеличивает счётчик. Счётчик обнуляется 1-го числа.' },
    { q: 'Что, если я превысил лимит лидов?', a: 'Мы не отключаем ничего. Превышение оплачивается по тарифу: €5 за каждые следующие 1 000 лидов. Вы можете поставить жёсткий лимит в настройках.' },
    { q: 'Есть ли бесплатный период?', a: 'Standard и Professional можно начать бесплатно — аккаунт работает в ограниченном режиме, пока вы не выберете тариф. Для Enterprise доступен 14-дневный пробный период с полным доступом, без привязки карты.' },
    { q: 'Включён ли НДС?', a: 'Цены указаны без НДС. Для юрлиц РФ выставляем счёт с НДС 20%. Для международных клиентов — без НДС.' },
    { q: 'Какие способы оплаты?', a: 'Карта, безналичный расчёт по счёту, СБП, криптовалюта (USDT, USDC), Stripe для международных клиентов.' },
    { q: 'Где хранятся данные?', a: 'По выбору: Москва (152-ФЗ), Франкфурт (GDPR) или Стамбул. Enterprise — любое собственное облако или on-prem.' },
    { q: 'Есть ли скидки?', a: 'Годовая оплата — 20% скидка. Стартапы до 2 лет — 40%. Некоммерческие организации — 50%. Обучение команды — бесплатно.' },
  ];
}

/* ─── Calculator ─── */
function Calculator({ period, lang }: { period: 'm' | 'y'; lang: Lang }) {
  const tx = T[lang];
  const [users, setUsers] = useState(8);
  const [leads, setLeads] = useState(20000);
  const [addons, setAddons] = useState({ wa: true, calls: false, bi: true });

  // All plans in EUR, +€5 per extra user
  const EXTRA_USER_RATE = period === 'y' ? 4 : 5; // €5/mo monthly, €4/mo yearly
  const { basePlan, baseCost, userCost, leadsCost, addonsCost, total } = useMemo(() => {
    const plans = getPlans(lang);
    // Plan selection: Standard→Professional→Enterprise→Ultimate by user count
    let planIdx = 0;
    if (users > 20) planIdx = 3;      // Ultimate
    else if (users > 10) planIdx = 2; // Enterprise
    else if (users > 3) planIdx = 1;  // Professional
    const plan = plans[planIdx];
    const basePlan = plan.name;
    const baseCost = period === 'y' ? (plan.prices.y ?? 0) : (plan.prices.m ?? 0);
    // Extra users above plan included count
    const includedUsers = planIdx === 0 ? 3 : planIdx === 1 ? 10 : planIdx === 2 ? 20 : 30;
    const userCost = users > includedUsers ? (users - includedUsers) * EXTRA_USER_RATE : 0;
    // Lead overage (€5 per 1000 over limit)
    const leadLimits = [5000, 25000, 100000, 200000];
    const leadLim = leadLimits[planIdx];
    const leadsCost = leads > leadLim ? Math.ceil((leads - leadLim) / 1000) * 5 : 0;
    // Add-ons (EUR prices)
    const addonPrices = { wa: 9, calls: 14, bi: 19 };
    let addonsCost = 0;
    if (addons.wa) addonsCost += addonPrices.wa;
    if (addons.calls) addonsCost += addonPrices.calls;
    if (addons.bi && planIdx === 0) addonsCost += addonPrices.bi;
    return { basePlan, baseCost, userCost, leadsCost, addonsCost, total: baseCost + userCost + leadsCost + addonsCost };
  }, [users, leads, addons, period, lang, EXTRA_USER_RATE]);

  const fmt = (n: number) => '€' + n.toLocaleString('en-US');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e7e7e7', borderRadius: 12, overflow: 'hidden' }}
      className="calc-grid">
      <div style={{ padding: '40px 32px', borderRight: '1px solid #e7e7e7' }}>
        <div className="lv-kicker">{tx.calcKicker}</div>
        <h3 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, color: '#222' }}>
          {tx.calcTitle}
        </h3>
        <p style={{ fontSize: 13, color: '#555', marginTop: 10, lineHeight: 1.55 }}>{tx.calcSub}</p>

        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: '#555', marginBottom: 8 }}>
            <span>{tx.calcUsers}</span>
            <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, color: '#222' }}>{users}</span>
          </div>
          <input type="range" min="1" max="60" step="1" value={users} onChange={e => setUsers(+e.target.value)} className="lv-range" />
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: '#555', marginBottom: 8 }}>
            <span>{tx.calcLeads}</span>
            <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, color: '#222' }}>{leads.toLocaleString()}</span>
          </div>
          <input type="range" min="500" max="200000" step="500" value={leads} onChange={e => setLeads(+e.target.value)} className="lv-range" />
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#888', letterSpacing: '0.1em', marginBottom: 12 }}>{tx.calcAddons}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tx.planAddons.map(a => (
              <label key={a.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #e7e7e7', borderRadius: 8, cursor: 'pointer', background: (addons as Record<string, boolean>)[a.k] ? '#f5f5f5' : '#fff' }}>
                <input type="checkbox" checked={(addons as Record<string, boolean>)[a.k]} onChange={e => setAddons({ ...addons, [a.k]: e.target.checked })} style={{ accentColor: '#222', width: 15, height: 15 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{a.l}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#888', marginTop: 2 }}>{a.p}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '40px 32px', background: '#fafafa' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#888', letterSpacing: '0.1em' }}>
          {tx.calcTotal} · {period === 'y' ? tx.calcYearly.toUpperCase() : tx.calcMonthly.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, color: '#222' }}>
          {lang === 'ru' ? 'Тариф' : lang === 'tr' ? 'Plan' : 'Plan'} <strong>{basePlan}</strong>
          {users > 1 ? ` · ${users} ${lang === 'ru' ? 'чел.' : lang === 'tr' ? 'kişi' : 'users'}` : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28 }}>
          {[
            { label: tx.calcBaseCost, val: fmt(baseCost) },
            userCost > 0 ? { label: tx.calcExtraUsers, val: '+' + fmt(userCost) } : null,
            leadsCost > 0 ? { label: tx.calcExtraLeads, val: '+' + fmt(leadsCost) } : null,
            addonsCost > 0 ? { label: tx.calcExtraModules, val: '+' + fmt(addonsCost) } : null,
          ].filter(Boolean).map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', paddingBottom: 14, borderBottom: '1px dashed #e7e7e7' }}>
              <span>{row!.label}</span>
              <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#222' }}>{row!.val}</strong>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, paddingTop: 24, borderTop: '1px solid #e7e7e7', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#888', letterSpacing: '0.1em' }}>{tx.calcTotal}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{period === 'y' ? tx.calcYearly : tx.calcMonthly}</div>
          </div>
          <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, color: '#222' }}>
            {fmt(total)}
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/?mode=signup" className="lv-btn lv-btn-primary lv-btn-lg">
            {tx.calcApply} <ArrowIcon />
          </Link>
          <Link to="/contact" className="lv-btn lv-btn-lg">
            {tx.calcTalk}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function PricingPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];
  const [period, setPeriod] = useState<'m' | 'y'>('m');
  const plans = getPlans(lang);
  const cmpSections = getCmpSections(lang);
  const faqs = getFaqs(lang);

  const fmt = (n: number | null) => {
    if (n === null) return null;
    return n.toLocaleString('en-US');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderCell(v: string): any {
    if (v === '✓') return <span style={{ color: '#222' }}><CheckIcon /></span>;
    if (v === '—') return <span style={{ color: '#b5b5b5' }}>—</span>;
    return <span style={{ color: '#222' }}>{v}</span>;
  }

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      {/* Google Fonts */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />

      <style>{`
        .lv-kicker { display: inline-flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; }
        .lv-kicker .dot { width: 6px; height: 6px; border-radius: 50%; background: #222; flex-shrink: 0; }
        .lv-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; font-size: 13.5px; font-weight: 500; border-radius: 999px; border: 1px solid #e7e7e7; background: #fff; color: #222; cursor: pointer; text-decoration: none; line-height: 1; transition: background .15s, border-color .15s; font-family: inherit; white-space: nowrap; }
        .lv-btn:hover { border-color: #222; }
        .lv-btn-primary { background: #222; color: #fff; border-color: #222; }
        .lv-btn-primary:hover { background: #000; border-color: #000; }
        .lv-btn-white { background: #fff; color: #222; border-color: #fff; }
        .lv-btn-white:hover { background: #f0f0f0; }
        .lv-btn-lg { padding: 14px 22px; font-size: 14.5px; }
        .lv-btn-sm { padding: 7px 12px; font-size: 12.5px; }
        .lv-range { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; background: #e7e7e7; outline: none; cursor: pointer; border-radius: 1px; }
        .lv-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #222; cursor: pointer; border: 3px solid #fff; box-shadow: 0 0 0 1px #222; }
        .lv-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #222; cursor: pointer; border: 3px solid #fff; box-shadow: 0 0 0 1px #222; }
        .calc-grid { }
        @media (max-width: 1100px) { .plans-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        .cmp-table-wrap { overflow: hidden; }
        @media (max-width: 800px) { .calc-grid { grid-template-columns: 1fr !important; } .plans-grid { grid-template-columns: 1fr !important; } .cmp-table-wrap { overflow-x: auto !important; overflow-y: visible !important; } .faq-grid { grid-template-columns: 1fr !important; } .cta-strip { flex-direction: column !important; padding: 36px 24px !important; } .hero-kicker-row { flex-wrap: wrap; gap: 8px; } }
        .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #e7e7e7; border-radius: 12px; overflow: visible; }
        .plans-grid-inner { border: 1px solid #e7e7e7; border-radius: 12px; overflow: hidden; display: contents; }
        .plan { padding: 36px 32px; border-right: 1px solid #e7e7e7; display: flex; flex-direction: column; position: relative; }
        .plan:last-child { border-right: 0; }
        .plan.featured { background: #222; color: #fff; }
        .feat-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #555; line-height: 1.5; }
        .feat-row .ic { flex-shrink: 0; margin-top: 2px; }
        .feat-row b { font-weight: 500; }
        .plan.featured .feat-row { color: rgba(255,255,255,0.8); }
        .plan.featured .feat-row b { color: #fff; }
        .cmp-table { width: 100%; border-collapse: collapse; }
        .cmp-table th, .cmp-table td { text-align: left; padding: 14px 18px; font-size: 13.5px; border-bottom: 1px solid #e7e7e7; vertical-align: middle; }
        .cmp-table thead th { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #888; letter-spacing: 0.1em; text-transform: uppercase; padding-top: 20px; padding-bottom: 16px; background: #fafafa; }
        .cmp-table thead th.col-plan { color: #222; text-align: center; font-size: 13.5px; font-family: 'Inter Tight', sans-serif; font-weight: 500; letter-spacing: -0.01em; text-transform: none; }
        .cmp-table thead th.col-featured { background: #222; color: #fff; }
        .cmp-table td.center { text-align: center; }
        .cmp-table tr.section-row td { background: #f5f5f5; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #888; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 18px; }
        .cmp-table td.feat-col { color: #222; font-weight: 500; }
        .cmp-table td.feat-col .desc { display: block; color: #888; font-weight: 400; font-size: 12px; margin-top: 2px; letter-spacing: 0; }
        .cmp-table td.center.col-featured-bg { background: rgba(0,0,0,0.02); }
        .cmp-table tr:last-child td { border-bottom: 0; }
        .faq-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #e7e7e7; border-radius: 12px; overflow: hidden; }
        .faq-item { padding: 28px; border-right: 1px solid #e7e7e7; border-bottom: 1px solid #e7e7e7; }
        .faq-item:nth-child(2n) { border-right: 0; }
        .faq-item:nth-last-child(-n+2) { border-bottom: 0; }
        .section-head { display: grid; grid-template-columns: 200px 1fr; gap: 32px; margin-bottom: 48px; align-items: baseline; }
        @media (max-width: 800px) { .section-head { grid-template-columns: 1fr; gap: 12px; } }
        .cta-strip { border: 1px solid #e7e7e7; border-radius: 12px; padding: 56px 48px; display: flex; align-items: center; justify-content: space-between; gap: 32px; background: #fff; position: relative; overflow: hidden; }
        .cta-strip::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, #f0f0f0 1px, transparent 1px); background-size: 48px 100%; opacity: .4; pointer-events: none; }
        .cta-strip > * { position: relative; }
        input[type=checkbox] { accent-color: #222; }
        @media (max-width: 800px) { .plan { border-right: 0 !important; border-bottom: 1px solid #e7e7e7; } .plan:last-child { border-bottom: 0; } }
      `}</style>

      <PublicHeader activeKey="pricing" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 32px' }}
        >
          <div className="lv-kicker"><span className="dot" />{tx.kicker}</div>
          <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 1, letterSpacing: '-0.04em', fontWeight: 500, marginTop: 28, maxWidth: 900, color: '#222' }}>
            {tx.title1}<br />
            <em style={{ color: '#888', fontStyle: 'normal', fontWeight: 400 }}>{tx.title2}</em>
          </h1>
          <p style={{ fontSize: 17, color: '#555', maxWidth: 560, marginTop: 20, lineHeight: 1.55 }}>{tx.sub}</p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', border: '1px solid #e7e7e7', borderRadius: 999, padding: 4, background: '#fff', marginTop: 28 }}>
            <button onClick={() => setPeriod('m')} className={`lv-btn lv-btn-sm${period === 'm' ? ' lv-btn-primary' : ''}`} style={{ borderRadius: 999 }}>
              {tx.monthly}
            </button>
            <button onClick={() => setPeriod('y')} className={`lv-btn lv-btn-sm${period === 'y' ? ' lv-btn-primary' : ''}`} style={{ borderRadius: 999, gap: 6 }}>
              {tx.yearly}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '2px 6px', borderRadius: 999, background: period === 'y' ? 'rgba(255,255,255,0.18)' : '#f5f5f5', color: period === 'y' ? '#fff' : '#222', letterSpacing: '0.05em' }}>{tx.save}</span>
            </button>
          </div>
        </motion.section>

        {/* ── Plans ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ paddingBottom: 80 }}
        >
          <div className="plans-grid" style={{ border: '1px solid #e7e7e7', borderRadius: 12, overflow: 'hidden' }}>
            {plans.map((p) => (
              <div key={p.id} className={`plan${p.featured ? ' featured' : ''}`}>
                {p.badge && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, background: 'rgba(255,255,255,0.18)', color: '#fff', marginBottom: 12 }}>
                    {p.badge}
                  </div>
                )}
                <div className="lv-kicker"><span className="dot" style={{ background: p.featured ? '#fff' : '#222' }} /><span style={{ color: p.featured ? 'rgba(255,255,255,0.6)' : '#888' }}>{p.name.toUpperCase()}</span></div>
                <h3 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, color: p.featured ? '#fff' : '#222' }}>{p.name}</h3>
                <p style={{ fontSize: 13, color: p.featured ? 'rgba(255,255,255,0.65)' : '#555', marginTop: 10, lineHeight: 1.55, minHeight: 58 }}>{p.sub}</p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 20 }}>
                  {p.prices[period] === null ? (
                    <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 40, fontWeight: 500, color: p.featured ? '#fff' : '#222' }}>{tx.onRequest}</span>
                  ) : (
                    <>
                      <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 56, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1, color: p.featured ? '#fff' : '#222' }}>{fmt(p.prices[period])}</span>
                      <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, color: p.featured ? 'rgba(255,255,255,0.6)' : '#888' }}>€</span>
                      <span style={{ fontSize: 13, color: p.featured ? 'rgba(255,255,255,0.5)' : '#888', marginLeft: 4 }}>{period === 'y' ? tx.perMonthYearly : tx.perMonth}</span>
                    </>
                  )}
                </div>

                <Link
                  to={p.id === 'enterprise' ? '/contact' : '/?mode=signup'}
                  className={`lv-btn lv-btn-lg${!p.featured ? ' lv-btn-primary' : ' lv-btn-white'}`}
                  style={{ marginTop: 24 }}
                >
                  {p.cta.label} <ArrowIcon />
                </Link>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28, flex: 1 }}>
                  {p.feats.map((f, i) => (
                    <div key={i} className="feat-row">
                      <span className="ic" style={{ color: p.featured ? '#fff' : '#222' }}><CheckIcon /></span>
                      <span><b>{f.b}</b>{(f as { b: string; s?: string }).s && <> · <span style={{ fontWeight: 400 }}>{(f as { b: string; s?: string }).s}</span></>}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${p.featured ? 'rgba(255,255,255,0.15)' : '#e7e7e7'}`, fontSize: 11.5, color: p.featured ? 'rgba(255,255,255,0.45)' : '#888' }}>
                  {p.addons}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Calculator ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingBottom: 80 }}
        >
          <div className="section-head">
            <div><div className="lv-kicker"><span className="dot" />{tx.calcKicker}</div></div>
            <div>
              <h2 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 500, letterSpacing: '-0.028em', lineHeight: 1.05, color: '#222' }}>{tx.calcTitle}</h2>
              <p style={{ marginTop: 18, color: '#555', fontSize: 15.5, maxWidth: 500, lineHeight: 1.55 }}>{tx.calcSub}</p>
            </div>
          </div>
          <Calculator period={period} lang={lang} />
        </motion.section>

        {/* ── Comparison ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingBottom: 80 }}
        >
          <div className="section-head">
            <div><div className="lv-kicker"><span className="dot" />{tx.cmpKicker}</div></div>
            <div>
              <h2 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 500, letterSpacing: '-0.028em', lineHeight: 1.05, color: '#222' }}>{tx.cmpTitle}</h2>
              <p style={{ marginTop: 18, color: '#555', fontSize: 15.5, maxWidth: 500, lineHeight: 1.55 }}>{tx.cmpSub}</p>
            </div>
          </div>
          <div style={{ border: '1px solid #e7e7e7', borderRadius: 12, background: '#fff' }} className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>{lang === 'ru' ? 'ПАРАМЕТР' : lang === 'tr' ? 'PARAMETRE' : 'FEATURE'}</th>
                  <th className="col-plan" style={{ textAlign: 'center' }}>Standard</th>
                  <th className="col-plan" style={{ textAlign: 'center' }}>Professional</th>
                  <th className="col-plan col-featured" style={{ textAlign: 'center' }}>Enterprise</th>
                  <th className="col-plan" style={{ textAlign: 'center' }}>Ultimate</th>
                </tr>
              </thead>
              <tbody>
                {cmpSections.map(sec => (
                  <React.Fragment key={sec.name}>
                    <tr className="section-row"><td colSpan={5}>{sec.name}</td></tr>
                    {sec.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="feat-col">{r.f}{r.d && <span className="desc">{r.d}</span>}</td>
                        {r.vals.map((v, vi) => (
                          <td key={vi} className={`center${vi === 2 ? ' col-featured-bg' : ''}`}>{renderCell(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── FAQ ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingBottom: 80 }}
        >
          <div className="section-head">
            <div><div className="lv-kicker"><span className="dot" />{tx.faqKicker}</div></div>
            <div>
              <h2 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 500, letterSpacing: '-0.028em', lineHeight: 1.05, color: '#222' }}>{tx.faqTitle}</h2>
              <p style={{ marginTop: 18, color: '#555', fontSize: 15.5, lineHeight: 1.55 }}>
                {tx.faqSub}
                <Link to="/faq" style={{ textDecoration: 'underline', color: '#222' }}>{tx.faqLink}</Link>
                {tx.faqOr}
              </p>
            </div>
          </div>
          <div className="faq-grid">
            {faqs.map((f, i) => (
              <div key={i} className="faq-item">
                <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 10, color: '#222' }}>{f.q}</div>
                <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── CTA strip ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ paddingBottom: 80 }}
        >
          <div className="cta-strip">
            <div>
              <div className="lv-kicker"><span className="dot" />{tx.ctaKicker}</div>
              <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, lineHeight: 1.1, maxWidth: 560, color: '#222' }}>
                {tx.ctaTitle}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/?mode=signup" className="lv-btn lv-btn-primary lv-btn-lg">
                {tx.ctaCreate} <ArrowIcon />
              </Link>
              <Link to="/contact" className="lv-btn lv-btn-lg">
                {tx.ctaDemo}
              </Link>
            </div>
          </div>
        </motion.section>

      </div>

      <PublicFooter />
    </div>
  );
}
