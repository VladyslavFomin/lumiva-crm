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

/* ─── Translations ─── */
const T = {
  ru: {
    kicker: 'ТАРИФЫ · ОБНОВЛЕНО ОКТЯБРЬ 2026',
    title1: 'Платите за команду,',
    title2: 'а не за функции.',
    sub: 'Начните с 14 дней Enterprise бесплатно — без карты. Дальше выберите тариф: они различаются модулями, объёмом хранилища и уровнем поддержки.',
    monthly: 'Ежемесячно',
    yearly: 'Ежегодно',
    save: 'до −20%',
    perMonth: '/ мес',
    perMonthYearly: '/ мес, при годовой',
    onRequest: 'По запросу',
    tryFree: '14 дней бесплатно',
    startFree: 'Начать бесплатно',
    contactUs: 'Связаться',
    calcTitle: 'Посчитайте стоимость для вашей команды.',
    calcSub: 'Укажите число пользователей — увидите подходящий тариф и итоговую сумму.',
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
    cmpSub: 'Что входит в каждый тариф — без мелкого шрифта.',
    faqKicker: 'ВОПРОСЫ',
    faqTitle: 'Частые вопросы.',
    faqSub: 'Если чего-то не хватает — ',
    faqLink: 'полный FAQ',
    faqOr: ' или напишите нам.',
    ctaKicker: 'ГОТОВЫ ПОПРОБОВАТЬ?',
    ctaTitle: '14 дней на Enterprise. Без карты.',
    ctaCreate: 'Создать аккаунт',
    ctaDemo: 'Демо',
    fromYear: 'от €151/год',
    currency: '€',
    planAddons: [
      { k: 'calls', l: 'IP-телефония и звонки', p: '+€14/мес · в Ultimate включено' },
    ],
  },
  en: {
    kicker: 'PRICING · UPDATED OCTOBER 2026',
    title1: 'Pay for your team,',
    title2: 'not for features.',
    sub: 'Start with 14 days of Enterprise for free — no card required. Then pick a plan: they differ by modules, storage and support level.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'up to −20%',
    perMonth: '/ mo',
    perMonthYearly: '/ mo, billed yearly',
    onRequest: 'On request',
    tryFree: '14 days free',
    startFree: 'Start free',
    contactUs: 'Contact us',
    calcTitle: 'Estimate the cost for your team.',
    calcSub: 'Set the number of users — see the matching plan and the total.',
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
    calcExtraModules: 'Add-ons',
    cmpKicker: 'COMPARISON',
    cmpTitle: 'Everything in one table.',
    cmpSub: 'What each plan includes — no small print.',
    faqKicker: 'FAQ',
    faqTitle: 'Common questions.',
    faqSub: "If something's missing — ",
    faqLink: 'full FAQ',
    faqOr: ' or write to us.',
    ctaKicker: 'READY TO START?',
    ctaTitle: '14 days on Enterprise. No card required.',
    ctaCreate: 'Create account',
    ctaDemo: 'Book a demo',
    fromYear: 'from €151/yr',
    currency: '€',
    planAddons: [
      { k: 'calls', l: 'IP telephony & calls', p: '+€14/mo · included in Ultimate' },
    ],
  },
  tr: {
    kicker: 'FİYATLANDIRMA · EKİM 2026',
    title1: 'Ekibiniz için ödeyin,',
    title2: 'özellikler için değil.',
    sub: '14 gün boyunca Enterprise planını ücretsiz deneyin — kart gerekmez. Ardından bir plan seçin: planlar modüller, depolama alanı ve destek düzeyiyle ayrılır.',
    monthly: 'Aylık',
    yearly: 'Yıllık',
    save: '−20%\'ye kadar',
    perMonth: '/ ay',
    perMonthYearly: '/ ay, yıllık ödeme',
    onRequest: 'Teklif alın',
    tryFree: '14 gün ücretsiz',
    startFree: 'Ücretsiz başla',
    contactUs: 'İletişime geç',
    calcTitle: 'Ekibiniz için maliyeti hesaplayın.',
    calcSub: 'Kullanıcı sayısını seçin — uygun planı ve toplam tutarı görün.',
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
    calcExtraModules: 'Eklentiler',
    cmpKicker: 'KARŞILAŞTIRMA',
    cmpTitle: 'Her şey tek tabloda.',
    cmpSub: 'Her plana neler dahil — küçük punto yok.',
    faqKicker: 'SORULAR',
    faqTitle: 'Sık sorulan sorular.',
    faqSub: 'Bir şey eksikse — ',
    faqLink: 'tam SSS',
    faqOr: ' veya bize yazın.',
    ctaKicker: 'BAŞLAMAYA HAZIR MISINIZ?',
    ctaTitle: "Enterprise'da 14 gün. Kart gerekmez.",
    ctaCreate: 'Hesap oluştur',
    ctaDemo: 'Demo ayarla',
    fromYear: '€151/yıldan',
    currency: '€',
    planAddons: [
      { k: 'calls', l: 'IP telefon ve aramalar', p: '+€14/ay · Ultimate\'ta dahil' },
    ],
  },
};

type Lang = 'ru' | 'en' | 'tr';

/* Годовая цена = месячная × (1 − скидка); скидки совпадают с BillingService.getYearlyDiscount
   (Standard 10%, Professional 12%, Enterprise 15%, Ultimate 20%). */
const PRICES = {
  standard: { m: 14, y: 12.6 },
  professional: { m: 23, y: 20.24 },
  enterprise: { m: 40, y: 34 },
  ultimate: { m: 52, y: 41.6 },
};

/* ─── Plan data ─── */
function getPlans(lang: Lang) {
  if (lang === 'en') return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'Core CRM for daily sales and marketing work.',
      prices: PRICES.standard, cta: { label: 'Start free', primary: false },
      feats: [
        { b: 'Leads, contacts, companies, deals' }, { b: 'Projects, tasks and no-code workspaces' },
        { b: 'Marketing, UTM and email campaigns' }, { b: 'Bookings, hotels, products, warehouse' },
        { b: 'Automations and AI assistant' }, { b: 'File storage', s: '3 GB' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'For teams that talk to customers in messengers.',
      prices: PRICES.professional, cta: { label: 'Start free', primary: false },
      feats: [
        { b: 'Everything in Standard' }, { b: 'Telegram, WhatsApp and website chat' },
        { b: 'SMM and Google reviews monitoring' }, { b: 'AI employees: analyst and SEO' },
        { b: 'Branded email' }, { b: 'File storage', s: '5 GB' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'POPULAR', featured: true,
      sub: 'Client finances, portals and help with implementation.',
      prices: PRICES.enterprise, cta: { label: '14 days free', primary: true, white: true },
      feats: [
        { b: 'Everything in Professional' }, { b: 'Client Accounts & client portals' },
        { b: 'Implementation planning', s: 'for your process' }, { b: 'Priority support' },
        { b: 'File storage', s: '10 GB' },
      ],
      addons: '+ €5/mo per additional user',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Premium package with telephony, custom domain and consulting.',
      prices: PRICES.ultimate, cta: { label: 'Contact us', primary: false },
      feats: [
        { b: 'Everything in Enterprise' }, { b: 'IP telephony included' },
        { b: 'Custom domain', s: 'crm.yourcompany.com' }, { b: 'Custom development for your business' },
        { b: 'Dedicated manager and consulting' }, { b: 'Migration from another CRM' },
        { b: 'File storage', s: 'by agreement' },
      ],
      addons: '+ €5/mo per additional user',
    },
  ];
  if (lang === 'tr') return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'Günlük satış ve pazarlama işleri için temel CRM.',
      prices: PRICES.standard, cta: { label: 'Ücretsiz başla', primary: false },
      feats: [
        { b: 'Lead, kişi, şirket ve fırsatlar' }, { b: 'Projeler, görevler ve no-code çalışma alanları' },
        { b: 'Pazarlama, UTM ve e-posta kampanyaları' }, { b: 'Rezervasyonlar, oteller, ürünler, depo' },
        { b: 'Otomasyonlar ve AI asistan' }, { b: 'Dosya depolama', s: '3 GB' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'Müşterileriyle mesajlaşma uygulamalarında konuşan ekipler için.',
      prices: PRICES.professional, cta: { label: 'Ücretsiz başla', primary: false },
      feats: [
        { b: 'Standard içindeki her şey' }, { b: 'Telegram, WhatsApp ve site sohbeti' },
        { b: 'SMM ve Google yorum takibi' }, { b: 'AI çalışanlar: analist ve SEO' },
        { b: 'Markalı e-posta' }, { b: 'Dosya depolama', s: '5 GB' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'POPÜLER', featured: true,
      sub: 'Müşteri finansları, portallar ve kurulum desteği.',
      prices: PRICES.enterprise, cta: { label: '14 gün ücretsiz', primary: true, white: true },
      feats: [
        { b: 'Professional içindeki her şey' }, { b: 'Client Accounts ve müşteri portalları' },
        { b: 'Sürecinize özel kurulum planı' }, { b: 'Öncelikli destek' },
        { b: 'Dosya depolama', s: '10 GB' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Telefon, özel domain ve danışmanlık içeren premium paket.',
      prices: PRICES.ultimate, cta: { label: 'İletişime geç', primary: false },
      feats: [
        { b: 'Enterprise içindeki her şey' }, { b: 'IP telefon dahil' },
        { b: 'Özel domain', s: 'crm.sirketiniz.com' }, { b: 'İşinize özel geliştirme' },
        { b: 'Kişisel yönetici ve danışmanlık' }, { b: 'Başka CRM\'den taşıma' },
        { b: 'Dosya depolama', s: 'anlaşmaya göre' },
      ],
      addons: 'Her ek kullanıcı için + €5/ay',
    },
  ];
  // ru default
  return [
    { id: 'standard', name: 'Standard', badge: null,
      sub: 'Базовый CRM для ежедневной работы продаж и маркетинга.',
      prices: PRICES.standard, cta: { label: 'Начать бесплатно', primary: false },
      feats: [
        { b: 'Лиды, контакты, компании, сделки' }, { b: 'Проекты, задачи и no-code рабочие области' },
        { b: 'Маркетинг, UTM и email-рассылки' }, { b: 'Бронирования, отели, товары, склад' },
        { b: 'Автоматизации и AI-ассистент' }, { b: 'Хранилище файлов', s: '3 ГБ' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'professional', name: 'Professional', badge: null,
      sub: 'Для команд, которые общаются с клиентами в мессенджерах.',
      prices: PRICES.professional, cta: { label: 'Начать бесплатно', primary: false },
      feats: [
        { b: 'Всё из Standard' }, { b: 'Telegram, WhatsApp и онлайн-чат на сайте' },
        { b: 'SMM и мониторинг отзывов Google' }, { b: 'AI-сотрудники: аналитик и SEO' },
        { b: 'Брендированные письма' }, { b: 'Хранилище файлов', s: '5 ГБ' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'enterprise', name: 'Enterprise', badge: 'ПОПУЛЯРНЫЙ', featured: true,
      sub: 'Финансы клиентов, клиентские порталы и помощь с внедрением.',
      prices: PRICES.enterprise, cta: { label: '14 дней бесплатно', primary: true, white: true },
      feats: [
        { b: 'Всё из Professional' }, { b: 'Client Accounts и клиентские порталы' },
        { b: 'Планирование внедрения', s: 'под ваш процесс' }, { b: 'Приоритетная поддержка' },
        { b: 'Хранилище файлов', s: '10 ГБ' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
    { id: 'ultimate', name: 'Ultimate', badge: null,
      sub: 'Премиальный пакет: телефония, свой домен и консалтинг.',
      prices: PRICES.ultimate, cta: { label: 'Связаться', primary: false },
      feats: [
        { b: 'Всё из Enterprise' }, { b: 'IP-телефония включена' },
        { b: 'Личный домен', s: 'crm.вашакомпания.com' }, { b: 'Доработки под ваш бизнес' },
        { b: 'Персональный менеджер и консалтинг' }, { b: 'Миграция из другой CRM' },
        { b: 'Хранилище файлов', s: 'по договорённости' },
      ],
      addons: '+ €5/мес за каждого дополнительного пользователя',
    },
  ];
}

/* Строки сравнения отражают реальные ограничения тарифов — backend/src/tenants/plan-entitlements.ts
   (COMPONENT_MIN_PLAN / MODULE_MIN_PLAN) и tenants/storage-quota.util.ts. */
function getCmpSections(lang: Lang) {
  const e = lang === 'en', tr = lang === 'tr';
  const Y = '✓', N = '—';
  return [
    { name: e ? 'CRM & modules' : tr ? 'CRM ve modüller' : 'CRM и модули', rows: [
      { f: e ? 'Leads, contacts, companies, deals' : tr ? 'Lead, kişi, şirket, fırsat' : 'Лиды, контакты, компании, сделки', vals: [Y, Y, Y, Y] },
      { f: e ? 'Projects, tasks, Kanban, calendar' : tr ? 'Projeler, görevler, Kanban, takvim' : 'Проекты, задачи, Kanban, календарь', vals: [Y, Y, Y, Y] },
      { f: e ? 'No-code workspaces' : tr ? 'No-code çalışma alanları' : 'No-code рабочие области', d: e ? 'tables, Kanban, Gantt' : tr ? 'tablolar, Kanban, Gantt' : 'таблицы, Kanban, Gantt', vals: [Y, Y, Y, Y] },
      { f: e ? 'Bookings and hotels (PMS)' : tr ? 'Rezervasyonlar ve oteller (PMS)' : 'Бронирования и отели (PMS)', vals: [Y, Y, Y, Y] },
      { f: e ? 'Products and warehouse' : tr ? 'Ürünler ve depo' : 'Товары и склад', vals: [Y, Y, Y, Y] },
      { f: e ? 'Duplicate merge' : tr ? 'Mükerrer kayıt birleştirme' : 'Поиск и слияние дублей', vals: [Y, Y, Y, Y] },
      { f: 'Client Accounts', d: e ? 'client finances and portals' : tr ? 'müşteri finansları ve portallar' : 'финансы клиентов и порталы', vals: [N, N, Y, Y] },
    ]},
    { name: e ? 'Communications' : tr ? 'İletişim' : 'Коммуникации', rows: [
      { f: e ? 'Email and SMS' : tr ? 'E-posta ve SMS' : 'Email и SMS', vals: [Y, Y, Y, Y] },
      { f: e ? 'Telegram and WhatsApp' : tr ? 'Telegram ve WhatsApp' : 'Telegram и WhatsApp', vals: [N, Y, Y, Y] },
      { f: e ? 'Website chat with AI operator' : tr ? 'AI operatörlü site sohbeti' : 'Онлайн-чат на сайте с AI-оператором', vals: [N, Y, Y, Y] },
      { f: e ? 'IP telephony' : tr ? 'IP telefon' : 'IP-телефония', d: e ? 'calls, recording, transcription' : tr ? 'arama, kayıt, transkripsiyon' : 'звонки, запись, расшифровка', vals: ['+€14', '+€14', '+€14', Y] },
    ]},
    { name: e ? 'Automation & AI' : tr ? 'Otomasyon ve AI' : 'Автоматизация и AI', rows: [
      { f: e ? 'Automations' : tr ? 'Otomasyonlar' : 'Автоматизации', d: e ? 'triggers, conditions, delays, approval' : tr ? 'tetikleyici, koşul, gecikme, onay' : 'триггеры, условия, задержки, согласование', vals: [Y, Y, Y, Y] },
      { f: e ? 'AI assistant in chat' : tr ? 'Sohbette AI asistan' : 'AI-ассистент в чате', vals: [Y, Y, Y, Y] },
      { f: e ? 'AI employees' : tr ? 'AI çalışanlar' : 'AI-сотрудники', vals: [e ? 'Basic roles' : tr ? 'Temel roller' : 'Базовые роли', e ? 'All roles' : tr ? 'Tüm roller' : 'Все роли', e ? 'All roles' : tr ? 'Tüm roller' : 'Все роли', e ? 'All roles' : tr ? 'Tüm roller' : 'Все роли'] },
      { f: e ? 'Your own OpenAI / Anthropic key' : tr ? 'Kendi OpenAI / Anthropic anahtarınız' : 'Свой ключ OpenAI / Anthropic', vals: [Y, Y, Y, Y] },
    ]},
    { name: e ? 'Data & security' : tr ? 'Veri ve güvenlik' : 'Данные и безопасность', rows: [
      { f: e ? 'File storage' : tr ? 'Dosya depolama' : 'Хранилище файлов', vals: [e ? '3 GB' : tr ? '3 GB' : '3 ГБ', e ? '5 GB' : tr ? '5 GB' : '5 ГБ', e ? '10 GB' : tr ? '10 GB' : '10 ГБ', e ? 'By agreement' : tr ? 'Anlaşmaya göre' : 'По договорённости'] },
      { f: e ? 'Roles and access rights' : tr ? 'Roller ve erişim hakları' : 'Роли и права доступа', vals: [Y, Y, Y, Y] },
      { f: e ? 'Two-factor authentication' : tr ? 'İki faktörlü doğrulama' : 'Двухфакторная аутентификация', vals: [Y, Y, Y, Y] },
      { f: e ? 'Action audit log' : tr ? 'İşlem denetim günlüğü' : 'Журнал действий', vals: [Y, Y, Y, Y] },
      { f: e ? 'API tokens and webhooks' : tr ? 'API anahtarları ve webhook' : 'API-токены и webhooks', vals: [Y, Y, Y, Y] },
      { f: e ? 'Custom domain' : tr ? 'Özel domain' : 'Свой домен', vals: [N, N, N, Y] },
    ]},
    { name: e ? 'Support' : tr ? 'Destek' : 'Поддержка', rows: [
      { f: e ? 'Channel' : tr ? 'Kanal' : 'Канал', vals: ['Email', e ? 'Email + chat' : tr ? 'E-posta + sohbet' : 'Email + чат', e ? 'Priority' : tr ? 'Öncelikli' : 'Приоритетная', e ? 'Dedicated manager' : tr ? 'Kişisel yönetici' : 'Персональный менеджер'] },
      { f: e ? 'Implementation help' : tr ? 'Kurulum desteği' : 'Помощь с внедрением', vals: [N, N, Y, Y] },
      { f: e ? 'Migration from another CRM' : tr ? 'Başka CRM\'den taşıma' : 'Миграция из другой CRM', vals: [N, N, N, Y] },
    ]},
  ];
}

function getFaqs(lang: Lang) {
  if (lang === 'en') return [
    { q: 'Is there a free trial?', a: 'Yes. Every new account gets 14 days of the Enterprise plan with full access. No card required. When the trial ends, pick a plan — your data stays in place.' },
    { q: 'What happens after the trial?', a: 'If you don\'t pay, access to the CRM is paused until you choose a plan. Nothing is deleted.' },
    { q: 'Can I change my plan?', a: 'Yes, at any time from the Billing section inside the CRM. The new plan applies right after payment.' },
    { q: 'What payment methods are accepted?', a: 'Bank card. In Turkey payments go through iyzico or PayTR, in Russia through YooKassa, elsewhere through Stripe. The provider is chosen automatically by your account language.' },
    { q: 'How much does yearly billing save?', a: 'Standard −10%, Professional −12%, Enterprise −15%, Ultimate −20% compared with monthly billing.' },
    { q: 'Where is data stored?', a: 'On servers in the European Union (Lithuania). The database is backed up every night.' },
    { q: 'Can I import data from spreadsheets or another CRM?', a: 'Yes. Leads, products and workspace tables can be imported from Excel and CSV; AI helps to parse messy spreadsheets. On Ultimate we migrate your data for you.' },
    { q: 'Do prices include taxes?', a: 'The final amount, including any applicable taxes, is shown on the payment page before you pay.' },
  ];
  if (lang === 'tr') return [
    { q: 'Ücretsiz deneme var mı?', a: 'Evet. Her yeni hesap 14 gün boyunca Enterprise planına tam erişim alır. Kart gerekmez. Deneme bitince bir plan seçin — verileriniz yerinde kalır.' },
    { q: 'Deneme süresi bitince ne olur?', a: 'Ödeme yapılmazsa CRM erişimi bir plan seçene kadar duraklatılır. Hiçbir veri silinmez.' },
    { q: 'Planımı değiştirebilir miyim?', a: 'Evet, istediğiniz zaman CRM içindeki Ödeme bölümünden. Yeni plan ödemeden hemen sonra geçerli olur.' },
    { q: 'Hangi ödeme yöntemleri kabul ediliyor?', a: 'Banka kartı. Türkiye\'de ödemeler iyzico veya PayTR, Rusya\'da YooKassa, diğer ülkelerde Stripe üzerinden alınır. Sağlayıcı hesap dilinize göre otomatik seçilir.' },
    { q: 'Yıllık ödemede ne kadar tasarruf ederim?', a: 'Aylık ödemeye göre Standard −%10, Professional −%12, Enterprise −%15, Ultimate −%20.' },
    { q: 'Veriler nerede saklanır?', a: 'Avrupa Birliği\'ndeki (Litvanya) sunucularda. Veritabanının her gece yedeği alınır.' },
    { q: 'Tablolardan veya başka bir CRM\'den veri aktarabilir miyim?', a: 'Evet. Lead\'ler, ürünler ve çalışma alanı tabloları Excel ve CSV\'den aktarılabilir; AI dağınık tabloları ayrıştırmaya yardım eder. Ultimate planında taşımayı biz yaparız.' },
    { q: 'Fiyatlara vergi dahil mi?', a: 'Varsa vergiler dahil nihai tutar, ödemeden önce ödeme sayfasında gösterilir.' },
  ];
  return [
    { q: 'Есть ли бесплатный период?', a: 'Да. Каждый новый аккаунт получает 14 дней тарифа Enterprise с полным доступом. Карта не нужна. Когда пробный период закончится, выберите тариф — данные останутся на месте.' },
    { q: 'Что будет после пробного периода?', a: 'Если не оплатить тариф, доступ к CRM приостанавливается до выбора тарифа. Данные не удаляются.' },
    { q: 'Могу ли я сменить тариф?', a: 'Да, в любой момент в разделе «Оплата» внутри CRM. Новый тариф начинает действовать сразу после оплаты.' },
    { q: 'Какие способы оплаты?', a: 'Банковская карта. В Турции оплата проходит через iyzico или PayTR, в России — через ЮKassa, в остальных странах — через Stripe. Платёжная система выбирается автоматически по языку аккаунта.' },
    { q: 'Сколько экономит годовая оплата?', a: 'По сравнению с помесячной: Standard −10%, Professional −12%, Enterprise −15%, Ultimate −20%.' },
    { q: 'Где хранятся данные?', a: 'На серверах в Евросоюзе (Литва). Каждую ночь делается резервная копия базы данных.' },
    { q: 'Можно ли перенести данные из таблиц или другой CRM?', a: 'Да. Лиды, товары и таблицы рабочих областей импортируются из Excel и CSV, а AI помогает разобрать «грязные» таблицы. На тарифе Ultimate перенос делаем мы.' },
    { q: 'Включены ли налоги в цену?', a: 'Итоговая сумма с учётом применимых налогов показывается на странице оплаты до того, как вы платите.' },
  ];
}

/* ─── Calculator ─── */
function Calculator({ period, lang }: { period: 'm' | 'y'; lang: Lang }) {
  const tx = T[lang];
  const [users, setUsers] = useState(8);
  const [addons, setAddons] = useState({ calls: false });

  // All plans in EUR, +€5 per extra user
  const EXTRA_USER_RATE = period === 'y' ? 4 : 5; // €5/mo monthly, €4/mo yearly
  const { basePlan, baseCost, userCost, addonsCost, total } = useMemo(() => {
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
    // Телефония — платное дополнение (€14/мес), в Ultimate включена бесплатно
    const addonsCost = addons.calls && planIdx !== 3 ? 14 : 0;
    return { basePlan, baseCost, userCost, addonsCost, total: baseCost + userCost + addonsCost };
  }, [users, addons, period, lang, EXTRA_USER_RATE]);

  const fmt = (n: number) => '€' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

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
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
        @media (max-width: 800px) { .calc-grid { grid-template-columns: 1fr !important; } .plans-grid { grid-template-columns: 1fr !important; } .cmp-table-wrap { overflow-x: auto !important; overflow-y: visible !important; } .cmp-table { min-width: 620px; } .cmp-table th, .cmp-table td { padding: 12px 10px; font-size: 12.5px; } .cmp-table td.feat-col, .cmp-table thead th:first-child { position: sticky; left: 0; z-index: 1; background: #fff; box-shadow: 1px 0 0 #e7e7e7; } .cmp-table thead th:first-child { background: #fafafa; } .cmp-table tr.section-row td { position: static; } .faq-grid { grid-template-columns: 1fr !important; } .cta-strip { flex-direction: column !important; padding: 36px 24px !important; } .hero-kicker-row { flex-wrap: wrap; gap: 8px; } }
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
                  to={p.id === 'ultimate' ? '/contact' : '/?mode=signup'}
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
