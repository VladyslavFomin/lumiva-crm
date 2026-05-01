import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

type Lang = 'ru' | 'en' | 'tr';

/* ─── Icons ─── */
type IP = { className?: string };
const IC = {
  Sales:    ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  Table:    ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>,
  Analytics:({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V8m4 8V5m4 11v-5M3 20h18"/></svg>,
  Automation:({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  Database: ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.657-4.03 3-9 3S3 13.657 3 12M21 5v14c0 1.657-4.03 3-9 3S3 20.657 3 19V5"/></svg>,
  Lock:     ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Code:     ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M10 20l4-16M18 8l4 4-4 4M6 16l-4-4 4-4"/></svg>,
  Globe:    ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  Mail:     ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  Shield:   ({ className='w-5 h-5' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Arrow:    ({ className='w-4 h-4' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>,
  Check:    ({ className='w-3 h-3' }: IP) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>,
};

/* ─── Translations ─── */
const T = {
  ru: {
    kicker: 'ФУНКЦИИ · 9 МОДУЛЕЙ · 180+ ВОЗМОЖНОСТЕЙ',
    title1: 'Каждый модуль — как отдельный продукт.',
    title2: 'Вместе — одна платформа.',
    sub: 'Все девять модулей разрабатывали внутри, на одной модели данных. Поэтому они работают как одно целое.',
    tocLabel: 'Перейти к разделу',
    tryFree: 'Попробовать бесплатно',
    allIntegrations: 'Все интеграции',
    salesScenarios: 'Решение для продаж',
    readyScenarios: 'Готовые сценарии',
    analyticsLink: 'Решение для аналитики',
    apiDocs: 'Документация API',
    ctaKicker: 'ГОТОВЫ ПОСМОТРЕТЬ?',
    ctaTitle: 'Демо с вашими данными за 30 минут.',
    ctaBtn: 'Попробовать',
    ctaDemo: 'Записаться на демо',
    statsItems: [
      { v: '180+', l: 'атрибутов на контакте и сделке' },
      { v: '80+', l: 'встроенных интеграций' },
      { v: '120+', l: 'готовых плейбуков автоматизации' },
      { v: '99.99%', l: 'uptime, гарантированный SLA' },
    ],
    tabTryFree: 'Попробовать бесплатно',
    modules: [
      { n: '01', t: 'Данные и источники', lede: '80+ готовых коннекторов, единая модель, дедупликация и скоринг — из коробки.' },
      { n: '02', t: 'Воронка и канбан', lede: 'Drag-n-drop сценарии продаж, форкасты на 90 дней, авто-задачи менеджерам.' },
      { n: '03', t: 'Коммуникации', lede: 'Email, SMS, push, WhatsApp, Telegram и звонки — в одном потоке с полной атрибуцией.' },
      { n: '04', t: 'Сегменты и аудитории', lede: 'Конструктор на 180+ атрибутах и событиях. Живая синхронизация с рекламными кабинетами.' },
      { n: '05', t: 'Атрибуция', lede: 'Шесть моделей атрибуции, включая data-driven. Считаем ROI по каждой кампании, каналу и креативу.' },
      { n: '06', t: 'Автоматизация', lede: 'Визуальный редактор плейбуков: триггеры, ветвления, A/B, задержки и webhooks.' },
      { n: '07', t: 'BI-дашборды', lede: '80+ готовых виджетов и конструктор. Экспорт в PDF, подписки по расписанию для команд.' },
      { n: '08', t: 'API и webhooks', lede: 'REST, GraphQL и потоковое API. SDK для Python, Node и Go. Интеграции с Zapier, Make, n8n.' },
      { n: '09', t: 'Безопасность', lede: 'SOC 2 Type II, ISO 27001, GDPR, 152-ФЗ. SSO, RBAC, полный журнал аудита.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: '80+ коннекторов', s: '— Яндекс Директ, VK, Google, Meta, TikTok, AmoCRM, HubSpot, Bitrix24 и другие.' },
        { a: 'B', b: 'Единая модель', s: '— лид, контакт, компания, сделка. Кастомные атрибуты и вычисляемые поля.' },
        { a: 'C', b: 'Дедупликация', s: '— по email, телефону, ID, fuzzy match. Правила слияния дубликатов.' },
        { a: 'D', b: 'Скоринг', s: '— правила и ML-модели. Лид превращается в MQL автоматически.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Неограниченные воронки', s: '— разные типы сделок, разные команды, разные метрики.' },
        { a: 'B', b: 'Канбан и списки', s: '— drag-n-drop, группировки по менеджеру, источнику, приоритету.' },
        { a: 'C', b: 'Форкасты', s: '— прогноз закрытия на 30/60/90 дней с доверительным интервалом.' },
        { a: 'D', b: 'Авто-задачи', s: '— при смене статуса, просрочке, появлении события.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Восемь каналов', s: '— Email, SMS, push (web+mobile), WhatsApp Business, Telegram, звонки.' },
        { a: 'B', b: 'Единая лента', s: '— все переписки по контакту в одном потоке, независимо от канала.' },
        { a: 'C', b: 'Шаблоны и персонализация', s: '— переменные, блоки, A/B темы.' },
        { a: 'D', b: 'Запись звонков', s: '— транскрибация, поиск по диалогам, теги.' },
      ]},
      { bullets: [
        { a: 'A', b: '180+ атрибутов', s: '— демография, активность, события, метки, UTM, кастомные поля.' },
        { a: 'B', b: 'RFM и когорты', s: '— встроенные отчёты, без ручного SQL.' },
        { a: 'C', b: 'Синхронизация с Ads', s: '— lookalike и retargeting в Яндекс, Meta, TikTok, VK, Google.' },
        { a: 'D', b: 'Живые сегменты', s: '— обновление каждые 5 минут, без копирования данных.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Шесть моделей', s: '— first click, last click, linear, time-decay, position-based, data-driven.' },
        { a: 'B', b: 'Сравнение сценариев', s: '— два канала / креатива / кампании рядом, на одной шкале.' },
        { a: 'C', b: 'Окно атрибуции', s: '— от 1 до 90 дней, отдельно по каналам.' },
        { a: 'D', b: 'Multi-touch reports', s: '— полный путь клиента от первого касания до сделки.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Визуальный редактор', s: '— триггер → условие → действие → задержка. Без кода.' },
        { a: 'B', b: '80+ триггеров', s: '— события, поля, расписание, webhooks, внешний API.' },
        { a: 'C', b: 'A/B в ветках', s: '— разделяйте аудиторию, сравнивайте результаты с автостатистикой.' },
        { a: 'D', b: 'Плейбуки-библиотека', s: '— 120+ готовых сценариев под ваши процессы.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: '80+ виджетов', s: '— воронки, когорты, тепловые карты, геомапы, гистограммы, KPI-тайлы.' },
        { a: 'B', b: 'Конструктор', s: '— без ограничений на сложность, с фильтрами, срезами, drill-down.' },
        { a: 'C', b: 'Экспорт', s: '— PDF, CSV, Excel, Google Sheets. Подписки по расписанию в email/TG.' },
        { a: 'D', b: 'Встраивание', s: '— iframe, embed-code, SSO-виджеты в ваш админ.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST + GraphQL', s: '— полный CRUD по любой сущности, фильтры, пагинация, bulk-операции.' },
        { a: 'B', b: 'SDK', s: '— Python, Node.js, Go, Ruby, PHP. OpenAPI-схема и postman-коллекция.' },
        { a: 'C', b: 'Webhooks', s: '— подписка на 40+ событий, с подписью HMAC и retry-стратегией.' },
        { a: 'D', b: 'No-code', s: '— готовые apps в Zapier, Make, n8n. Обратные интеграции в 1 клик.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'SOC 2 Type II, ISO 27001', s: '— валидные сертификаты, отчёты по запросу.' },
        { a: 'B', b: 'Шифрование', s: '— TLS 1.3 в пути, AES-256 в покое, ключи в HSM, ротация каждые 90 дней.' },
        { a: 'C', b: 'SSO и 2FA', s: '— SAML 2.0, SCIM, OIDC. MFA для всех или для ролей.' },
        { a: 'D', b: 'Аудит', s: '— полный журнал действий, экспорт в SIEM, хранение до 7 лет.' },
      ]},
    ],
  },
  en: {
    kicker: 'FEATURES · 9 MODULES · 180+ CAPABILITIES',
    title1: 'Every module — a product on its own.',
    title2: 'Together — one platform.',
    sub: 'All nine modules were built in-house on a single data model. That\'s why they work as one coherent whole.',
    tocLabel: 'Jump to section',
    tryFree: 'Try for free',
    allIntegrations: 'All integrations',
    salesScenarios: 'Sales solution',
    readyScenarios: 'Ready playbooks',
    analyticsLink: 'Analytics solution',
    apiDocs: 'API documentation',
    ctaKicker: 'READY TO SEE IT?',
    ctaTitle: 'Live demo with your data in 30 minutes.',
    ctaBtn: 'Try it',
    ctaDemo: 'Book a demo',
    statsItems: [
      { v: '180+', l: 'attributes per contact and deal' },
      { v: '80+', l: 'built-in integrations' },
      { v: '120+', l: 'ready automation playbooks' },
      { v: '99.99%', l: 'uptime, guaranteed SLA' },
    ],
    tabTryFree: 'Try for free',
    modules: [
      { n: '01', t: 'Data & Sources', lede: '80+ ready connectors, unified model, deduplication and scoring — out of the box.' },
      { n: '02', t: 'Pipeline & Kanban', lede: 'Drag-n-drop sales scenarios, 90-day forecasts, auto-tasks for managers.' },
      { n: '03', t: 'Communications', lede: 'Email, SMS, push, WhatsApp, Telegram and calls — one stream with full attribution.' },
      { n: '04', t: 'Segments & Audiences', lede: 'Builder with 180+ attributes and events. Live sync with ad cabinets.' },
      { n: '05', t: 'Attribution', lede: 'Six attribution models including data-driven. ROI per campaign, channel and creative.' },
      { n: '06', t: 'Automation', lede: 'Visual playbook editor: triggers, branches, A/B, delays and webhooks.' },
      { n: '07', t: 'BI Dashboards', lede: '80+ ready widgets and a builder. PDF export, scheduled subscriptions for teams.' },
      { n: '08', t: 'API & Webhooks', lede: 'REST, GraphQL and streaming API. SDKs for Python, Node and Go. Zapier, Make, n8n.' },
      { n: '09', t: 'Security', lede: 'SOC 2 Type II, ISO 27001, GDPR. SSO, RBAC, full audit log.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: '80+ connectors', s: '— Yandex Direct, VK, Google, Meta, TikTok, AmoCRM, HubSpot, Bitrix24 and more.' },
        { a: 'B', b: 'Unified model', s: '— lead, contact, company, deal. Custom attributes and computed fields.' },
        { a: 'C', b: 'Deduplication', s: '— by email, phone, ID, fuzzy match. Your merge rules.' },
        { a: 'D', b: 'Scoring', s: '— rules and ML models. Lead becomes MQL automatically at threshold.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Unlimited pipelines', s: '— different deal types, teams and metrics.' },
        { a: 'B', b: 'Kanban & lists', s: '— drag-n-drop, group by manager, source, priority.' },
        { a: 'C', b: 'Forecasts', s: '— 30/60/90-day close prediction with confidence interval.' },
        { a: 'D', b: 'Auto-tasks', s: '— on status change, overdue, new event.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Eight channels', s: '— Email, SMS, push (web+mobile), WhatsApp Business, Telegram, calls.' },
        { a: 'B', b: 'Unified feed', s: '— all contact conversations in one stream regardless of channel.' },
        { a: 'C', b: 'Templates & personalisation', s: '— variables, blocks, A/B subject lines.' },
        { a: 'D', b: 'Call recording', s: '— transcription, dialog search, tags.' },
      ]},
      { bullets: [
        { a: 'A', b: '180+ attributes', s: '— demographics, activity, events, tags, UTM, custom fields.' },
        { a: 'B', b: 'RFM & cohorts', s: '— built-in reports, no manual SQL.' },
        { a: 'C', b: 'Ads sync', s: '— lookalike and retargeting in Yandex, Meta, TikTok, VK, Google.' },
        { a: 'D', b: 'Live segments', s: '— update every 5 minutes, no data copying.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Six models', s: '— first click, last click, linear, time-decay, position-based, data-driven.' },
        { a: 'B', b: 'Scenario comparison', s: '— two channels / creatives / campaigns side by side on one scale.' },
        { a: 'C', b: 'Attribution window', s: '— 1 to 90 days, per channel.' },
        { a: 'D', b: 'Multi-touch reports', s: '— full customer journey from first touch to deal.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Visual editor', s: '— trigger → condition → action → delay. No code.' },
        { a: 'B', b: '80+ triggers', s: '— events, fields, schedule, webhooks, external API.' },
        { a: 'C', b: 'A/B in branches', s: '— split audience, compare results with auto-stats.' },
        { a: 'D', b: 'Playbook library', s: '— 120+ ready scenarios for your processes.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: '80+ widgets', s: '— funnels, cohorts, heatmaps, geomaps, histograms, KPI tiles.' },
        { a: 'B', b: 'Builder', s: '— no complexity limits, with filters, slices, drill-down.' },
        { a: 'C', b: 'Export', s: '— PDF, CSV, Excel, Google Sheets. Scheduled subscriptions via email/TG.' },
        { a: 'D', b: 'Embedding', s: '— iframe, embed-code, SSO widgets in your admin.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST + GraphQL', s: '— full CRUD on any entity, filters, pagination, bulk ops.' },
        { a: 'B', b: 'SDKs', s: '— Python, Node.js, Go, Ruby, PHP. OpenAPI schema and postman collection.' },
        { a: 'C', b: 'Webhooks', s: '— subscribe to 40+ events, HMAC signature, retry strategy.' },
        { a: 'D', b: 'No-code', s: '— ready apps in Zapier, Make, n8n. Reverse integrations in 1 click.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'SOC 2 Type II, ISO 27001', s: '— valid certificates, reports on request.' },
        { a: 'B', b: 'Encryption', s: '— TLS 1.3 in transit, AES-256 at rest, keys in HSM, 90-day rotation.' },
        { a: 'C', b: 'SSO & 2FA', s: '— SAML 2.0, SCIM, OIDC. MFA for all or by role.' },
        { a: 'D', b: 'Audit', s: '— complete action log, SIEM export, retention up to 7 years.' },
      ]},
    ],
  },
  tr: {
    kicker: 'ÖZELLİKLER · 9 MODÜL · 180+ YETKİNLİK',
    title1: 'Her modül — kendi başına bir ürün.',
    title2: 'Bir arada — tek platform.',
    sub: 'Dokuz modülün tamamı tek veri modeli üzerinde iç bünyede geliştirildi. Bu yüzden tek bir bütün gibi çalışır.',
    tocLabel: 'Bölüme git',
    tryFree: 'Ücretsiz dene',
    allIntegrations: 'Tüm entegrasyonlar',
    salesScenarios: 'Satış çözümü',
    readyScenarios: 'Hazır senaryolar',
    analyticsLink: 'Analitik çözümü',
    apiDocs: 'API belgeleri',
    ctaKicker: 'GÖRMEYE HAZIR MISINIZ?',
    ctaTitle: 'Verilerinizle 30 dakikada canlı demo.',
    ctaBtn: 'Deneyin',
    ctaDemo: 'Demo rezervasyonu',
    statsItems: [
      { v: '180+', l: 'kişi ve fırsat başına özellik' },
      { v: '80+', l: 'yerleşik entegrasyon' },
      { v: '120+', l: 'hazır otomasyon oyun kitabı' },
      { v: '99.99%', l: 'uptime, garantili SLA' },
    ],
    tabTryFree: 'Ücretsiz dene',
    modules: [
      { n: '01', t: 'Veri ve Kaynaklar', lede: '80+ hazır bağlayıcı, birleşik model, yineleme kaldırma ve skorlama — kutunun içinden.' },
      { n: '02', t: 'Pipeline ve Kanban', lede: 'Sürükle-bırak satış senaryoları, 90 günlük tahminler, yöneticilere otomatik görevler.' },
      { n: '03', t: 'İletişim', lede: 'Email, SMS, push, WhatsApp, Telegram ve aramalar — tam atıfla tek akışta.' },
      { n: '04', t: 'Segmentler ve Kitleler', lede: '180+ özellik ve etkinlikli oluşturucu. Reklam hesaplarıyla canlı senkronizasyon.' },
      { n: '05', t: 'Atıf', lede: 'Data-driven dahil altı atıf modeli. Her kampanya, kanal ve kreatif için ROI.' },
      { n: '06', t: 'Otomasyon', lede: 'Görsel oyun kitabı düzenleyicisi: tetikleyiciler, dallanmalar, A/B, gecikmeler ve webhooks.' },
      { n: '07', t: 'BI Panelleri', lede: '80+ hazır widget ve oluşturucu. PDF dışa aktarma, ekipler için zamanlanmış abonelikler.' },
      { n: '08', t: 'API ve Webhooklar', lede: 'REST, GraphQL ve akış API. Python, Node ve Go için SDK. Zapier, Make, n8n.' },
      { n: '09', t: 'Güvenlik', lede: 'SOC 2 Type II, ISO 27001, GDPR. SSO, RBAC, tam denetim günlüğü.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: '80+ bağlayıcı', s: '— Yandex Direct, Google, Meta, TikTok, AmoCRM, HubSpot, Bitrix24 ve diğerleri.' },
        { a: 'B', b: 'Birleşik model', s: '— lead, kişi, şirket, fırsat. Özel nitelikler ve hesaplanmış alanlar.' },
        { a: 'C', b: 'Yineleme kaldırma', s: '— email, telefon, ID, bulanık eşleşme. Kendi birleştirme kurallarınız.' },
        { a: 'D', b: 'Skorlama', s: '— kurallar ve ML modelleri. Lead eşikte otomatik MQL\'e dönüşür.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Limitsiz pipeline', s: '— farklı fırsat türleri, ekipler ve metrikler.' },
        { a: 'B', b: 'Kanban ve listeler', s: '— sürükle-bırak, yönetici/kaynak/önceliğe göre gruplama.' },
        { a: 'C', b: 'Tahminler', s: '— 30/60/90 günlük kapanış tahmini.' },
        { a: 'D', b: 'Otomatik görevler', s: '— durum değişiminde, gecikme veya yeni olayda.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Sekiz kanal', s: '— Email, SMS, push (web+mobil), WhatsApp Business, Telegram, aramalar.' },
        { a: 'B', b: 'Birleşik akış', s: '— kanaldan bağımsız tüm iletişimler tek akışta.' },
        { a: 'C', b: 'Şablonlar ve kişiselleştirme', s: '— değişkenler, bloklar, A/B konu satırları.' },
        { a: 'D', b: 'Arama kaydı', s: '— transkripsiyon, diyalog arama, etiketler.' },
      ]},
      { bullets: [
        { a: 'A', b: '180+ özellik', s: '— demografi, aktivite, etkinlikler, etiketler, UTM, özel alanlar.' },
        { a: 'B', b: 'RFM ve kohortlar', s: '— yerleşik raporlar, manuel SQL yok.' },
        { a: 'C', b: 'Reklam senkronizasyonu', s: '— Yandex, Meta, TikTok, Google\'da lookalike ve retargeting.' },
        { a: 'D', b: 'Canlı segmentler', s: '— 5 dakikada bir güncelleme, veri kopyalama yok.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Altı model', s: '— first click, last click, linear, time-decay, position-based, data-driven.' },
        { a: 'B', b: 'Senaryo karşılaştırma', s: '— iki kanal/kreatif/kampanya yan yana tek ölçekte.' },
        { a: 'C', b: 'Atıf penceresi', s: '— 1 ila 90 gün, kanal bazında.' },
        { a: 'D', b: 'Multi-touch raporlar', s: '— ilk dokunuştan anlaşmaya tam müşteri yolculuğu.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Görsel düzenleyici', s: '— tetikleyici → koşul → eylem → gecikme. Kodsuz.' },
        { a: 'B', b: '80+ tetikleyici', s: '— etkinlikler, alanlar, zamanlama, webhooks, harici API.' },
        { a: 'C', b: 'Dallarda A/B', s: '— kitleyi böl, otomatik istatistiklerle sonuçları karşılaştır.' },
        { a: 'D', b: 'Oyun kitabı kütüphanesi', s: '— süreçleriniz için 120+ hazır senaryo.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: '80+ widget', s: '— huniler, kohortlar, ısı haritaları, KPI tile\'ları.' },
        { a: 'B', b: 'Oluşturucu', s: '— karmaşıklık sınırı yok, filtreler, dilimler, drill-down.' },
        { a: 'C', b: 'Dışa aktarma', s: '— PDF, CSV, Excel, Google Sheets. Email/TG\'de zamanlanmış abonelikler.' },
        { a: 'D', b: 'Gömme', s: '— iframe, embed-code, yönetici panelinde SSO widget\'ları.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST + GraphQL', s: '— herhangi bir varlıkta tam CRUD, filtreler, sayfalama, toplu işlemler.' },
        { a: 'B', b: 'SDK\'lar', s: '— Python, Node.js, Go, Ruby, PHP. OpenAPI şeması ve postman koleksiyonu.' },
        { a: 'C', b: 'Webhooklar', s: '— 40+ olaya abone olma, HMAC imzası, yeniden deneme stratejisi.' },
        { a: 'D', b: 'Kodsuz', s: '— Zapier, Make, n8n\'de hazır uygulamalar. Tek tıkla ters entegrasyonlar.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'SOC 2 Type II, ISO 27001', s: '— geçerli sertifikalar, talep üzerine raporlar.' },
        { a: 'B', b: 'Şifreleme', s: '— iletimde TLS 1.3, beklemede AES-256, HSM\'de anahtarlar, 90 günlük rotasyon.' },
        { a: 'C', b: 'SSO ve 2FA', s: '— SAML 2.0, SCIM, OIDC. Tüm kullanıcılar veya roller için MFA.' },
        { a: 'D', b: 'Denetim', s: '— tam eylem günlüğü, SIEM dışa aktarma, 7 yıla kadar saklama.' },
      ]},
    ],
  },
};

/* ─── Tab section mockups (kept from original) ─── */
const KanbanMockup: React.FC<{ lang: Lang }> = ({ lang }) => {
  const cols = lang === 'en'
    ? [{ label: 'New', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400', cards: ['Petrov A.', 'OOO Alpha'] }, { label: 'In Progress', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', cards: ['GK Progress', 'IP Sidor', 'Chainikov I.'] }, { label: 'Won', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', cards: ['StroyGroup', 'IT-Start', 'MegaData'] }]
    : lang === 'tr'
    ? [{ label: 'Yeni', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400', cards: ['Petrov A.', 'OOO Alpha'] }, { label: 'Devam ediyor', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', cards: ['GK Progress', 'IP Sidor', 'Chainikov I.'] }, { label: 'Kazanıldı', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', cards: ['StroyGroup', 'IT-Start', 'MegaData'] }]
    : [{ label: 'Новые', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400', cards: ['Петров А.', 'ООО Альфа'] }, { label: 'В работе', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', cards: ['ГК Прогресс', 'ИП Сидор', 'Чайников И.'] }, { label: 'Выиграно', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', cards: ['СтройГрупп', 'ИТ-Старт', 'MegaData'] }];
  const title = lang === 'en' ? 'Kanban board' : lang === 'tr' ? 'Kanban panosu' : 'Канбан-доска';
  const meta = lang === 'en' ? '3 columns · 9 cards' : lang === 'tr' ? '3 sütun · 9 kart' : '3 колонки · 9 карточек';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-4">
      <div className="flex items-center justify-between mb-4"><span className="text-xs font-semibold text-slate-800">{title}</span><span className="text-[10px] text-slate-400">{meta}</span></div>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((col) => (
          <div key={col.label} className={`rounded-xl border p-2 ${col.color}`}>
            <div className="flex items-center gap-1.5 mb-2"><span className={`w-1.5 h-1.5 rounded-full ${col.dot}`}/><span className="text-[10px] font-semibold text-slate-700">{col.label}</span><span className="ml-auto text-[10px] text-slate-400">{col.cards.length}</span></div>
            {col.cards.map((c) => (<div key={c} className="mb-1 rounded-lg bg-white border border-slate-100 px-2 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm">{c}</div>))}
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsMockup: React.FC<{ lang: Lang }> = ({ lang }) => {
  const title = lang === 'en' ? 'Sales Analytics' : lang === 'tr' ? 'Satış Analitiği' : 'Аналитика продаж';
  const period = lang === 'en' ? 'April 2026' : lang === 'tr' ? 'Nisan 2026' : 'Апрель 2026';
  const metrics = lang === 'en'
    ? [{ label: 'Revenue', value: '€48K', delta: '+18%', pos: true }, { label: 'Deals', value: '43', delta: '+7', pos: true }, { label: 'Conv.', value: '34%', delta: '-2%', pos: false }]
    : lang === 'tr'
    ? [{ label: 'Gelir', value: '€48K', delta: '+18%', pos: true }, { label: 'Fırsatlar', value: '43', delta: '+7', pos: true }, { label: 'Dönüşüm', value: '34%', delta: '-2%', pos: false }]
    : [{ label: 'Выручка', value: '€48K', delta: '+18%', pos: true }, { label: 'Сделки', value: '43', delta: '+7', pos: true }, { label: 'Конверсия', value: '34%', delta: '-2%', pos: false }];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-4">
      <div className="flex items-center justify-between mb-4"><span className="text-xs font-semibold text-slate-800">{title}</span><span className="text-[10px] text-slate-400">{period}</span></div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {metrics.map((m) => (<div key={m.label} className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] text-slate-400">{m.label}</div><div className="text-sm font-bold text-slate-800 mt-0.5">{m.value}</div><div className={`text-[10px] font-medium ${m.pos ? 'text-emerald-600' : 'text-red-500'}`}>{m.delta}</div></div>))}
      </div>
      <div className="flex items-end gap-1 h-14">
        {[40,65,50,80,60,90,75,95,70,85,55,100].map((h, i) => (<motion.div key={i} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }} style={{ height: `${h}%`, transformOrigin: 'bottom' }} className="flex-1 rounded-t-sm bg-[#1e293b] opacity-80" />))}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 mt-1"><span>Jan</span><span>Apr</span><span>Dec</span></div>
    </div>
  );
};

/* ─── Spotlight visuals ─── */
const VisualSources: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>SOURCES · 24 CONNECTED</div>
    <div className="grid grid-cols-5 gap-1.5 mb-4">
      {['VK','GA','YD','Mk','Tg','Am','Hs','Sf','Zp','Wh','Sm','Ot','Ps','Tk','In','Li','Pp','St','Zo','Ir'].map(s => (<div key={s} className="aspect-square flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:bg-white transition-all cursor-default">{s}</div>))}
    </div>
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', marginBottom: 8 }}>TOP SOURCES / 7 DAYS</div>
      {[['YANDEX', '85%', '8.2K'], ['INSTAGRAM', '62%', '5.9K'], ['TG BOT', '44%', '4.2K'], ['FORMS', '28%', '2.7K']].map(([src, pct, cnt]) => (
        <div key={src} className="flex items-center gap-2 py-1.5 border-b border-dashed border-slate-200 last:border-0">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', width: 70 }}>{src}</span>
          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: pct }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-[#1e293b]" /></div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: '#222', width: 36, textAlign: 'right' }}>{cnt}</span>
        </div>
      ))}
    </div>
  </div>
);

const VisualChan: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>CHANNELS · 7 ACTIVE</div>
    {[
      { icon: <IC.Mail className="w-4 h-4" />, t: 'Email', s: '128,930 delivered · 41% open', v: '28%', k: 'CTR' },
      { icon: <IC.Globe className="w-4 h-4" />, t: 'WhatsApp Business', s: '6,840 active chats', v: '4.1m', k: 'ANS' },
      { icon: <IC.Globe className="w-4 h-4" />, t: 'Telegram', s: '32,114 subscribers · bot', v: '19%', k: 'CTR' },
      { icon: <IC.Globe className="w-4 h-4" />, t: 'Push (web + app)', s: '89,120 · iOS + Android', v: '12%', k: 'CTR' },
      { icon: <IC.Globe className="w-4 h-4" />, t: 'IP Telephony', s: '4,240 calls · 1.8min avg', v: '68%', k: 'PICK' },
    ].map(r => (
      <div key={r.t} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">{r.icon}</div>
        <div className="flex-1 min-w-0"><div className="text-xs font-medium text-slate-800">{r.t}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', marginTop: 1 }}>{r.s}</div></div>
        <div className="text-right shrink-0"><div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 16, fontWeight: 500, color: '#222' }}>{r.v}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#888' }}>{r.k}</div></div>
      </div>
    ))}
  </div>
);

const VisualSeg: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>SEGMENT BUILDER</div>
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} className="space-y-1.5">
      {[
        { op: 'WHERE', cond: 'country = "Germany"', active: false },
        { op: 'AND', cond: 'score >= 80', active: true },
        { op: 'AND', cond: 'source IN "Google" "Meta"', active: true },
        { op: 'AND', cond: 'event = "Pricing view" last 7d', active: true },
        { op: 'EXCLUDE', cond: 'clients from "Enterprise"', active: false },
      ].map((l, i) => (<div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${l.active ? 'bg-slate-50' : 'bg-white'}`}><span className="px-1.5 py-0.5 rounded bg-[#1e293b] text-white text-[10px] shrink-0" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{l.op}</span><span className="text-slate-600 text-[11px] truncate">{l.cond}</span></div>))}
    </div>
    <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
      <div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888' }}>IN SEGMENT</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', marginTop: 4 }}>UPDATES EVERY 5 MIN</div></div>
      <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', color: '#222' }}>4,281</div>
    </div>
  </div>
);

const VisualAttr: React.FC = () => {
  const [m, setM] = useState('data');
  const models = [{ k: 'first', l: 'FIRST', v: '38%' }, { k: 'last', l: 'LAST', v: '42%' }, { k: 'linear', l: 'LINEAR', v: '24%' }, { k: 'data', l: 'DATA-DRV', v: '31%' }];
  const data: Record<string, [string, number][]> = { first: [['Yandex', 65], ['Google', 22], ['Instagram', 8], ['Email', 5]], last: [['Yandex', 42], ['Instagram', 28], ['Email', 18], ['Google', 12]], linear: [['Yandex', 34], ['Google', 28], ['Instagram', 22], ['Email', 16]], data: [['Yandex', 38], ['Google', 26], ['Instagram', 24], ['Email', 12]] };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>ATTRIBUTION MODELS</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {models.map(md => (<button key={md.k} onClick={() => setM(md.k)} style={{ color: m === md.k ? '#fff' : '#475569' }} className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${m === md.k ? 'bg-[#1e293b] border-[#1e293b]' : 'bg-white border-slate-200'}`}><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.08em', opacity: m === md.k ? 0.7 : 1 }}>{md.l}</div><div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 500, marginTop: 4 }}>{md.v}</div></button>))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', marginBottom: 8 }}>CHANNEL CONTRIBUTION</div>
        {(data[m] || []).map(([name, val]) => (<div key={name} className="flex items-center gap-2 mb-2 last:mb-0"><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', width: 64 }}>{name.toUpperCase()}</span><div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><motion.div animate={{ width: `${val}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} className="h-full rounded-full bg-[#1e293b]" /></div><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, width: 32, textAlign: 'right', color: '#222' }}>{val}%</span></div>))}
      </div>
    </div>
  );
};

const VisualAuto: React.FC = () => (
  <div className="rounded-2xl bg-[#0f172a] p-5" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>PLAYBOOK · «B2B INBOUND»</div>
    <svg viewBox="0 0 440 300" className="w-full h-auto">
      <rect x="160" y="10" width="120" height="36" rx="4" fill="#fff" stroke="#fff" strokeWidth="1"/>
      <text x="220" y="33" textAnchor="middle" fontFamily="Inter" fontSize="11" fontWeight="500" fill="#111">Trigger: New lead</text>
      <path d="M220 46 L220 66" stroke="#555" strokeWidth="1.5" strokeDasharray="4 4"/>
      <rect x="160" y="66" width="120" height="36" rx="4" fill="#1a1a1a" stroke="#fff" strokeWidth="1"/>
      <text x="220" y="89" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="#fff">Scoring by rules</text>
      <path d="M220 102 L220 122" stroke="#555" strokeWidth="1.5" strokeDasharray="4 4"/>
      <polygon points="220,122 290,148 220,174 150,148" fill="#1a1a1a" stroke="#fff" strokeWidth="1"/>
      <text x="220" y="152" textAnchor="middle" fontFamily="Inter" fontSize="10.5" fill="#fff">score &gt;= 70?</text>
      <path d="M290 148 L360 148 L360 200" stroke="#555" strokeWidth="1.5" strokeDasharray="4 4" fill="none"/>
      <text x="305" y="142" fontFamily="JetBrains Mono" fontSize="9" fill="#fff">YES</text>
      <rect x="310" y="200" width="100" height="34" rx="4" fill="#fff"/>
      <text x="360" y="221" textAnchor="middle" fontFamily="Inter" fontSize="10.5" fontWeight="500" fill="#111">→ Manager</text>
      <path d="M150 148 L80 148 L80 200" stroke="#555" strokeWidth="1.5" strokeDasharray="4 4" fill="none"/>
      <text x="100" y="142" fontFamily="JetBrains Mono" fontSize="9" fill="#fff">NO</text>
      <rect x="30" y="200" width="100" height="34" rx="4" fill="#1a1a1a" stroke="#fff" strokeWidth="1"/>
      <text x="80" y="221" textAnchor="middle" fontFamily="Inter" fontSize="10.5" fill="#fff">Email nurture</text>
    </svg>
    <div className="flex justify-between mt-3 pt-3 border-t border-white/15" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>SCENARIO ACTIVE · 2,412 LEADS/MO</span>
      <span className="text-white">● RUN</span>
    </div>
  </div>
);

const VisualBI: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>DASHBOARD · GROWTH OVERVIEW</div>
    <div className="grid grid-cols-[1fr_100px] gap-2">
      <div className="space-y-2">
        <div className="rounded-xl border border-slate-100 p-3 bg-slate-50">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#888' }}>REVENUE / MTD</div>
          <svg viewBox="0 0 200 40" className="w-full mt-1">
            <polyline points="0,30 20,24 40,28 60,18 80,22 100,12 120,16 140,8 160,12 180,6 200,4" fill="none" stroke="#222" strokeWidth="1.5"/>
            <circle cx="200" cy="4" r="3" fill="#222"/>
          </svg>
          <div className="flex justify-between items-baseline mt-1">
            <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 500, color: '#222' }}>€128K</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#222' }}>+24%</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 bg-slate-50">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#888', marginBottom: 8 }}>FUNNEL / 30D</div>
          <div className="flex items-end gap-1 h-10">
            {[100,78,42,22,14].map((h, i) => (<div key={i} style={{ height: `${h}%`, opacity: 1 - i * 0.15 }} className="flex-1 rounded-t-sm bg-[#1e293b]" />))}
          </div>
          <div className="flex justify-between mt-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#888' }}>
            <span>LEAD</span><span>QL</span><span>SQL</span><span>OPP</span><span>WON</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {[{ l: 'CAC', v: '€49', d: '−12%', down: false }, { l: 'LTV/CAC', v: '5.4', d: '+0.6', down: false }, { l: 'CHURN', v: '1.8%', d: '+0.2%', down: true }].map(t => (<div key={t.l} className="rounded-xl border border-slate-100 p-2.5 bg-slate-50"><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#888' }}>{t.l}</div><div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 20, fontWeight: 500, color: '#222', lineHeight: 1, marginTop: 4 }}>{t.v}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.down ? '#ff4a3a' : '#222', marginTop: 4 }}>{t.d}</div></div>))}
      </div>
    </div>
  </div>
);

const VisualAPI: React.FC = () => {
  const [tab, setTab] = useState('js');
  const snippets: Record<string, string> = {
    js: `import { Lumiva } from '@lumiva/sdk';

const lv = new Lumiva({
  token: process.env.LV_TOKEN
});

await lv.leads.create({
  email: 'anna@example.com',
  source: 'web-form',
  utm: { source: 'google', campaign: 'q4-b2b' },
  score: 72,
});`,
    py: `from lumiva import Client

lv = Client(token=os.environ['LV_TOKEN'])

lv.leads.create(
    email='anna@example.com',
    source='web-form',
    utm={'source':'google', 'campaign':'q4-b2b'},
    score=72,
)`,
    curl: `curl -X POST https://api.lumiva.io/v1/leads \\
  -H "Authorization: Bearer $LV_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "anna@example.com",
    "source": "web-form",
    "score": 72
  }'`,
  };
  return (
    <div className="rounded-2xl bg-[#0f172a] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between mb-3">
        <div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>API · v1 · REST</div><div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 500, color: '#fff', marginTop: 4 }}>POST /v1/leads</div></div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#fff', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999 }}>200 OK · 42ms</span>
      </div>
      <div className="flex gap-0.5 mb-3">
        {[['js','Node.js'],['py','Python'],['curl','cURL']].map(([k, l]) => (<button key={k} onClick={() => setTab(k)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '5px 10px', background: 'none', border: 0, borderBottom: tab === k ? '1px solid #fff' : '1px solid transparent', color: tab === k ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', letterSpacing: '0.08em' }}>{l}</button>))}
      </div>
      <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.65, color: '#f4f4f4', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>{snippets[tab]}</pre>
      <div className="flex justify-between mt-3 pt-3 border-t border-white/15" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
        <span>SDK: Python, Node, Go, Ruby</span><span>600 req/min</span>
      </div>
    </div>
  );
};

const VisualSec: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', color: '#888', marginBottom: 12 }}>CERTIFICATIONS · UPDATED 01 · 2026</div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      {[
        { t: 'SOC 2 Type II', d: 'Security, availability & confidentiality audit for 12 months.', m: 'VALID · 2024 → 2026' },
        { t: 'ISO 27001:2022', d: 'International information security management standard.', m: 'VALID · 2023 → 2026' },
        { t: 'GDPR', d: 'DPA, DPIA, right to erasure, data portability, EU data centers.', m: 'COMPLIANT' },
        { t: '152-FZ', d: 'Personal data storage in Russia, security level 2.', m: 'REG. 77-19-00942' },
      ].map(c => (<div key={c.t} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-col gap-1"><div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 500, color: '#222' }}>{c.t}</div><div style={{ fontSize: 11, color: '#888', lineHeight: 1.45 }}>{c.d}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#aaa', marginTop: 'auto' }}>{c.m}</div></div>))}
    </div>
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
      <IC.Lock className="w-4 h-4 text-slate-500 shrink-0" />
      <div><div style={{ fontSize: 12.5, fontWeight: 500, color: '#222' }}>End-to-end encryption</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#888', marginTop: 2 }}>TLS 1.3 · AES-256 AT REST · KEYS IN HSM</div></div>
    </div>
  </div>
);

/* ─── Tab section features ─── */
function getTabFeatures(lang: Lang) {
  const isEn = lang === 'en', isTr = lang === 'tr';
  return [
    {
      category: isEn ? 'Sales' : isTr ? 'Satış' : 'Продажи',
      Icon: IC.Sales,
      title: isEn ? 'Lead & deal management' : isTr ? 'Lead ve fırsat yönetimi' : 'Управление лидами и сделками',
      description: isEn ? 'Full cycle from first contact to closed deal. Kanban board, list view, filters and auto-notifications.' : isTr ? 'İlk temastan kapalı fırsata tam döngü. Kanban panosu, liste görünümü, filtreler ve otomatik bildirimler.' : 'Полный цикл от первого контакта до закрытой сделки. Канбан-доска, список, фильтры и автоматические уведомления.',
      mockup: <KanbanMockup lang={lang} />,
      highlights: isEn ? ['Unlimited pipelines', 'Drag & drop board', 'Auto-assignment', 'Activity history'] : isTr ? ['Limitsiz huni', 'Sürükle & bırak', 'Otomatik atama', 'Aktivite geçmişi'] : ['Неограниченные воронки', 'Drag & drop доска', 'Автоназначение', 'История активности'],
    },
    {
      category: isEn ? 'Analytics' : isTr ? 'Analitik' : 'Аналитика',
      Icon: IC.Analytics,
      title: isEn ? 'Built-in analytics & dashboards' : isTr ? 'Yerleşik analitik ve paneller' : 'Встроенная аналитика и дашборды',
      description: isEn ? 'Dashboard with widgets, charts for leads, sales and companies. Integration with GA4, Meta Ads and Google Ads.' : isTr ? 'Widget\'lı panel, lead, satış ve şirket grafikleri. GA4, Meta Ads ve Google Ads entegrasyonu.' : 'Дашборд с виджетами, графики по лидам, продажам и компаниям. Интеграция с GA4, Meta Ads и Google Ads.',
      mockup: <AnalyticsMockup lang={lang} />,
      highlights: isEn ? ['Dashboard widgets', 'ROI analytics', 'GA4 integration', 'Period comparison'] : isTr ? ['Dashboard widget\'ları', 'ROI analitiği', 'GA4 entegrasyonu', 'Dönem karşılaştırma'] : ['Виджеты дашборда', 'ROI-аналитика', 'Интеграция GA4', 'Сравнение периодов'],
    },
    {
      category: isEn ? 'Automation' : isTr ? 'Otomasyon' : 'Автоматизация',
      Icon: IC.Automation,
      title: isEn ? 'Visual automation builder' : isTr ? 'Görsel otomasyon oluşturucu' : 'Визуальный конструктор автоматизаций',
      description: isEn ? 'Build action chains without code. Triggers, conditions, delays, email and notification sending.' : isTr ? 'Kodsuz eylem zincirleri oluşturun. Tetikleyiciler, koşullar, gecikmeler, email ve bildirim gönderme.' : 'Создавайте цепочки действий без кода. Триггеры, условия, задержки, отправка email и уведомлений.',
      mockup: <VisualAuto />,
      highlights: isEn ? ['No-code builder', 'Telegram notifications', 'Email triggers', 'Conditional branches'] : isTr ? ['Kodsuz oluşturucu', 'Telegram bildirimleri', 'Email tetikleyiciler', 'Koşullu dallar'] : ['No-code builder', 'Telegram уведомления', 'Email триггеры', 'Условные ветки'],
    },
    {
      category: isEn ? 'Database' : isTr ? 'Veritabanı' : 'База данных',
      Icon: IC.Database,
      title: isEn ? 'Contacts, companies & history' : isTr ? 'Kişiler, şirketler ve geçmiş' : 'Контакты, компании и история',
      description: isEn ? 'Unified customer base with links between contacts, companies, leads and deals. Complete interaction history.' : isTr ? 'Kişiler, şirketler, leadler ve fırsatlar arasında bağlantılarla birleşik müşteri tabanı.' : 'Единая база клиентов со связями между контактами, компаниями, лидами и сделками. Полная история взаимодействий.',
      mockup: <VisualSeg />,
      highlights: isEn ? ['Linked records', 'Custom tags', 'Full history', 'Search & filters'] : isTr ? ['Bağlantılı kayıtlar', 'Özel etiketler', 'Tam geçmiş', 'Arama ve filtreler'] : ['Связанные записи', 'Кастомные теги', 'Полная история', 'Поиск и фильтры'],
    },
  ];
}

const SPOT_VISUALS = [
  <VisualSources />, null /* KanbanMockup handled inline */, <VisualChan />, <VisualSeg />, <VisualAttr />, <VisualAuto />, <VisualBI />, <VisualAPI />, <VisualSec />,
];

export default function FeaturesPage() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'ru').slice(0, 2) as Lang) in T ? (i18n.language || 'ru').slice(0, 2) as Lang : 'ru';
  const tx = T[lang];
  const [activeTab, setActiveTab] = useState(0);
  const tabFeatures = getTabFeatures(lang);

  const ctaLinks: Record<string, string> = {
    allIntegrations: '/integrations',
    salesScenarios: '/solutions/sales',
    readyScenarios: '/scenarios',
    analyticsLink: '/solutions/analytics',
    apiDocs: '/api-integration',
  };

  return (
    <div style={{ background: '#fff', color: '#222', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
      <style>{`
        .lv-kicker-feat { display: inline-flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; }
        .lv-kicker-feat .dot { width: 6px; height: 6px; border-radius: 50%; background: #222; flex-shrink: 0; }
        .feat-toc { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #e7e7e7; border-bottom: 1px solid #e7e7e7; }
        @media (max-width: 800px) { .feat-toc { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .feat-toc { grid-template-columns: 1fr; } }
        .feat-toc-item { padding: 20px 24px; border-right: 1px solid #e7e7e7; display: flex; gap: 14px; align-items: center; text-decoration: none; color: #222; transition: background .15s; }
        .feat-toc-item:hover { background: #f9f9f9; }
        .feat-toc-item:nth-child(3n) { border-right: 0; }
        @media (max-width: 800px) { .feat-toc-item:nth-child(3n) { border-right: 1px solid #e7e7e7; } .feat-toc-item:nth-child(2n) { border-right: 0; } }
        .feat-spot { display: grid; grid-template-columns: 1fr 1.1fr; gap: 56px; padding: 96px 0; border-top: 1px solid #e7e7e7; align-items: center; }
        @media (max-width: 960px) { .feat-spot { grid-template-columns: 1fr; gap: 32px; padding: 64px 0; } .feat-spot.rev .spot-copy { order: 2; } }
        .feat-stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #e7e7e7; border-bottom: 1px solid #e7e7e7; margin-top: 80px; }
        @media (max-width: 800px) { .feat-stat-strip { grid-template-columns: repeat(2, 1fr); } }
        .feat-stat-cell { padding: 36px 28px; border-right: 1px solid #e7e7e7; }
        .feat-stat-cell:last-child { border-right: 0; }
        .feat-cta-strip { border: 1px solid #e7e7e7; border-radius: 12px; padding: 56px 48px; display: flex; align-items: center; justify-content: space-between; gap: 32px; position: relative; overflow: hidden; margin-top: 80px; }
        .feat-cta-strip::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, #f0f0f0 1px, transparent 1px); background-size: 48px 100%; opacity: .4; pointer-events: none; }
        .feat-cta-strip > * { position: relative; }
        @media (max-width: 700px) { .feat-cta-strip { flex-direction: column; padding: 36px 24px; } }
        .lv-btn-feat { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; font-size: 13.5px; font-weight: 500; border-radius: 999px; border: 1px solid #e7e7e7; background: #fff; color: #222; cursor: pointer; text-decoration: none; transition: border-color .15s; white-space: nowrap; }
        .lv-btn-feat:hover { border-color: #222; }
        .lv-btn-feat.primary { background: #222; color: #fff; border-color: #222; }
        .lv-btn-feat.primary:hover { background: #000; }
      `}</style>

      <PublicHeader activeKey="features" />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1280 }}>

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ padding: '72px 0 32px' }}
        >
          <div className="lv-kicker-feat"><span className="dot" />{tx.kicker}</div>
          <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1, letterSpacing: '-0.04em', fontWeight: 500, marginTop: 28, maxWidth: 900, color: '#222' }}>
            {tx.title1}<br />
            <em style={{ color: '#888', fontStyle: 'normal', fontWeight: 400 }}>{tx.title2}</em>
          </h1>
          <p style={{ fontSize: 17, color: '#555', maxWidth: 560, marginTop: 20, lineHeight: 1.55 }}>{tx.sub}</p>
        </motion.section>

        {/* ── Tab Section (kept from original) ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ paddingBottom: 80, borderTop: '1px solid #e7e7e7', paddingTop: 48 }}
        >
          {/* Tab buttons */}
          <div className="flex flex-wrap gap-2 mb-8">
            {tabFeatures.map((f, i) => {
              const active = activeTab === i;
              return (
                <motion.button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 13, fontWeight: 500, color: active ? '#fff' : '#475569' }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${active ? 'bg-[#0f172a] border border-[#0f172a] shadow-md' : 'bg-white border border-slate-200'}`}
                >
                  <f.Icon className="w-3.5 h-3.5" />
                  {f.category}
                </motion.button>
              );
            })}
          </div>

          {/* Active tab detail */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="grid gap-10 lg:grid-cols-[1fr_1.1fr] items-center"
            >
              <div>{tabFeatures[activeTab].mockup}</div>
              <div>
                <div className="lv-kicker-feat" style={{ marginBottom: 16 }}>
                  {React.createElement(tabFeatures[activeTab].Icon, { className: 'w-4 h-4' })}
                  {tabFeatures[activeTab].category}
                </div>
                <h2 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(24px, 2.8vw, 38px)', fontWeight: 500, letterSpacing: '-0.028em', lineHeight: 1.1, color: '#222' }}>
                  {tabFeatures[activeTab].title}
                </h2>
                <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, marginTop: 16, maxWidth: 480 }}>
                  {tabFeatures[activeTab].description}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {tabFeatures[activeTab].highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <IC.Check />
                      </span>
                      {h}
                    </div>
                  ))}
                </div>
                <Link to="/login" className="lv-btn-feat primary" style={{ marginTop: 28 }}>
                  {tx.tabTryFree} <IC.Arrow />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>

        {/* ── TOC Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="feat-toc"
        >
          {tx.modules.map((m) => (
            <a key={m.n} href={`#mod-${m.n}`} className="feat-toc-item">
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#aaa', letterSpacing: '0.08em', flexShrink: 0 }}>F / {m.n}</div>
              <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>{m.t}</div>
            </a>
          ))}
        </motion.div>

        {/* ── 9 Spotlight Sections ── */}
        {tx.modules.map((mod, idx) => {
          const spot = tx.spots[idx];
          const visual = idx === 1 ? <KanbanMockup lang={lang} /> : SPOT_VISUALS[idx];
          const rev = idx % 2 === 1;
          const ctaKey = spot?.cta;
          return (
            <motion.div
              key={mod.n}
              id={`mod-${mod.n}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
              className={`feat-spot${rev ? ' rev' : ''}`}
            >
              {!rev && <div>{visual}</div>}
              <div className="spot-copy">
                <div className="lv-kicker-feat" style={{ marginBottom: 20 }}>
                  <span className="dot" />MODULE · {mod.n}
                </div>
                <h2 style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(26px, 3.2vw, 40px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 500, maxWidth: 520, color: '#222' }}>{mod.t}</h2>
                <p style={{ fontSize: 16, color: '#555', lineHeight: 1.6, marginTop: 20, maxWidth: 500 }}>{mod.lede}</p>
                {spot && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {spot.bullets.map(b => (
                      <li key={b.a} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#555', lineHeight: 1.55 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#aaa', flexShrink: 0, width: 36 }}>{b.a}</span>
                        <span><strong style={{ color: '#222', fontWeight: 500 }}>{b.b}</strong>{b.s}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {ctaKey && ctaLinks[ctaKey] && (
                  <Link to={ctaLinks[ctaKey]} className="lv-btn-feat" style={{ marginTop: 32, borderBottomWidth: 1, borderRadius: 0, padding: '0 0 3px', border: 'none', borderBottom: '1px solid #222', fontSize: 14, display: 'inline-flex', gap: 8 }}>
                    {(tx as unknown as Record<string, string>)[ctaKey]} <IC.Arrow />
                  </Link>
                )}
              </div>
              {rev && <div>{visual}</div>}
            </motion.div>
          );
        })}

        {/* ── Stats Strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="feat-stat-strip"
        >
          {tx.statsItems.map((s) => (
            <div key={s.v} className="feat-stat-cell">
              <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(32px, 4.5vw, 48px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 12.5, color: '#555', marginTop: 12, lineHeight: 1.5 }}>{s.l}</div>
            </div>
          ))}
        </motion.div>

        {/* ── CTA Strip ── */}
        <div className="feat-cta-strip" style={{ marginBottom: 80 }}>
          <div>
            <div className="lv-kicker-feat"><span className="dot" />{tx.ctaKicker}</div>
            <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, lineHeight: 1.1, maxWidth: 560, color: '#222' }}>
              {tx.ctaTitle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/login" className="lv-btn-feat primary">{tx.ctaBtn} <IC.Arrow /></Link>
            <Link to="/contact" className="lv-btn-feat">{tx.ctaDemo}</Link>
          </div>
        </div>

      </div>

      <PublicFooter />
    </div>
  );
}
