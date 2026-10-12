// Страница «Функции» — дизайн Claude Design features-v2.html (lp-features.jsx), тексты модулей — проверенные (T).
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';
import { Icon, useScrollReveal } from '../landing/LandingSections';
import type { LandingDemoText } from '../landing/landingDemo';
import { FeatureVisual, type FLang } from './featuresVisuals';
import '../landing/lp-kit.css';

type Lang = FLang;

/* ─── Translations (тексты модулей прошли проверку на соответствие продукту) ─── */
const T = {
  ru: {
    kicker: 'ФУНКЦИИ · 12 МОДУЛЕЙ · ОДНА ПЛАТФОРМА',
    title1: 'Каждый модуль — как отдельный продукт.',
    title2: 'Вместе — одна платформа.',
    sub: 'Лиды, сделки, коммуникации, маркетинг, проекты, бронирования и AI работают на одной базе контактов и компаний — данные не нужно склеивать между сервисами.',
    tocLabel: 'Перейти к разделу',
    tryFree: 'Попробовать бесплатно',
    allIntegrations: 'Все интеграции',
    salesScenarios: 'Решение для продаж',
    readyScenarios: 'Готовые сценарии',
    analyticsLink: 'Решение для аналитики',
    apiDocs: 'Документация API',
    marketingLink: 'Решение для маркетинга',
    bookingLink: 'Бронирования',
    hotelsLink: 'Система резервации',
    ctaKicker: 'ГОТОВЫ ПОСМОТРЕТЬ?',
    ctaTitle: 'Покажем CRM на ваших задачах за 30 минут.',
    ctaBtn: 'Попробовать',
    ctaDemo: 'Записаться на демо',
    statsItems: [
      { v: '30+', l: 'готовых интеграций' },
      { v: '3', l: 'языка интерфейса: русский, английский, турецкий' },
      { v: '14', l: 'дней бесплатно на тарифе Enterprise' },
      { v: '24ч', l: 'интервал резервного копирования базы' },
    ],
    tabTryFree: 'Попробовать бесплатно',
    modules: [
      { n: '01', t: 'Лиды и источники', lede: 'Заявки с сайта, форм, мессенджеров и магазинов попадают в CRM сразу с источником и UTM-метками.' },
      { n: '02', t: 'Воронка и канбан', lede: 'Лиды и сделки на канбан-доске и в списке: статусы, ответственные, задачи и история по каждой карточке.' },
      { n: '03', t: 'Коммуникации', lede: 'WhatsApp, Telegram, email, SMS, звонки и чат на сайте — переписка с клиентом в одной ленте внутри карточки.' },
      { n: '04', t: 'Маркетинг и реклама', lede: 'UTM-ссылки, расходы из рекламных кабинетов и выручка по каналам — видно, какая реклама приносит продажи.' },
      { n: '05', t: 'Автоматизации', lede: 'Конструктор сценариев без кода: триггер → условия → действия, с задержками и согласованием.' },
      { n: '06', t: 'Аналитика и BI', lede: 'Готовые отчёты по лидам, продажам, менеджерам и проектам, плюс собственный BI-дашборд.' },
      { n: '07', t: 'API и webhooks', lede: 'REST API с токенами доступа, приём лидов с любого сайта и исходящие webhooks из автоматизаций.' },
      { n: '08', t: 'Безопасность', lede: 'Роли и права доступа, двухфакторная аутентификация, журнал действий и изоляция данных каждой компании.' },
      { n: '09', t: 'Рабочие области (no-code)', lede: 'Таблицы, Kanban, Календарь и Gantt в одном модуле. Формулы, рейтинги, связи между таблицами и автоматизации по событиям — без кода.' },
      { n: '10', t: 'AI-ассистент', lede: 'Чат с доступом к данным вашей CRM: отвечает на вопросы, меняет цены, тарифы и брони по команде прямо в интерфейсе.' },
      { n: '11', t: 'AI-сотрудники', lede: 'Ролевые AI-агенты — менеджер лидов, продаж, маркетинга, аналитик, SEO — с настраиваемой автономностью: от подсказок до действий с очередью на согласование.' },
      { n: '12', t: 'Бронирования, отели и товары', lede: 'Онлайн-запись, система резервации для отелей, каталог товаров и склад — в той же CRM, что и лиды.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: 'Формы и сайты', s: ' — встраиваемые формы, WordPress / Contact Form 7, WooCommerce и Shopify.' },
        { a: 'B', b: 'Мессенджеры и чат', s: ' — обращения из WhatsApp, Telegram и онлайн-чата сразу становятся лидами.' },
        { a: 'C', b: 'UTM и источник', s: ' — у каждого лида сохраняются канал, кампания и страница входа.' },
        { a: 'D', b: 'Поиск дублей', s: ' — совпадения по email, телефону и названию, слияние в один клик с отменой.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Канбан и список', s: ' — перетаскивание между статусами, фильтры, сохранённые виды.' },
        { a: 'B', b: 'Ответственные и доступы', s: ' — менеджер видит свои лиды или все, по настройкам прав.' },
        { a: 'C', b: 'Задачи и календарь', s: ' — звонки, встречи и напоминания привязаны к лиду или сделке.' },
        { a: 'D', b: 'Корзина и архив', s: ' — удалённые лиды можно восстановить в течение 30 дней.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Мессенджеры', s: ' — WhatsApp Business и Telegram-боты, ответы прямо из CRM.' },
        { a: 'B', b: 'Единая лента', s: ' — вся переписка по клиенту в карточке лида, независимо от канала.' },
        { a: 'C', b: 'Email и SMS', s: ' — подключение почтовых ящиков, шаблоны, массовые рассылки.' },
        { a: 'D', b: 'Телефония', s: ' — звонки из карточки, запись разговоров и AI-расшифровка.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Рекламные кабинеты', s: ' — Google Ads, Meta Ads, Яндекс Директ и VK Реклама: расходы подтягиваются автоматически.' },
        { a: 'B', b: 'UTM-конструктор', s: ' — шаблоны ссылок, чтобы метки у команды были одинаковыми.' },
        { a: 'C', b: 'ROI по каналам', s: ' — расходы сопоставляются с лидами и выручкой.' },
        { a: 'D', b: 'Сегменты и рассылки', s: ' — выборки клиентов и email-кампании по ним.' },
      ], cta: 'marketingLink' },
      { bullets: [
        { a: 'A', b: 'Триггеры', s: ' — новый лид, смена статуса, изменение поля, расписание.' },
        { a: 'B', b: 'Действия', s: ' — задача, ответственный, статус, тег, письмо, SMS, Telegram, Slack, webhook.' },
        { a: 'C', b: 'Передача в другие системы', s: ' — amoCRM, Bitrix24, HubSpot, Mailchimp, Jira, Google Calendar.' },
        { a: 'D', b: 'Задержки и согласование', s: ' — шаги с паузой и подтверждением человеком перед выполнением.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: 'Отчёты по модулям', s: ' — лиды, продажи, проекты, рабочие области, бронирования.' },
        { a: 'B', b: 'Менеджеры', s: ' — выигранные и проигранные сделки, повторные продажи по каждому.' },
        { a: 'C', b: 'BI-дашборд', s: ' — собственные виджеты и сравнение периодов.' },
        { a: 'D', b: 'Экспорт и рассылка отчётов', s: ' — выгрузка в CSV/Excel и отчёты на почту по расписанию.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST API', s: ' — лиды, товары, бронирования и пользовательские объекты по API-токену.' },
        { a: 'B', b: 'Приём лидов', s: ' — POST-запрос с любого сайта, лендинга или бота.' },
        { a: 'C', b: 'Webhooks', s: ' — автоматизация отправляет данные на ваш URL при любом событии.' },
        { a: 'D', b: 'No-code', s: ' — подключение через Zapier, Make или n8n.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'Роли и права', s: ' — доступ к модулям, видимость «свои / все», скрытие сумм и контактов.' },
        { a: 'B', b: 'Двухфакторная аутентификация', s: ' — вход с кодом из приложения-аутентификатора.' },
        { a: 'C', b: 'Журнал действий', s: ' — кто и что изменил, с датой и временем.' },
        { a: 'D', b: 'Инфраструктура', s: ' — HTTPS, серверы в ЕС, ежедневные резервные копии.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Четыре вида', s: ' — таблица, Kanban, календарь и Gantt над одними данными.' },
        { a: 'B', b: 'Формулы и связи', s: ' — вычисляемые поля и ссылки между таблицами.' },
        { a: 'C', b: 'Импорт с AI', s: ' — загрузка Excel/CSV, AI разбирает объединённые ячейки и «грязные» таблицы.' },
        { a: 'D', b: 'Автообновление', s: ' — таблицы подтягивают данные из интеграций по расписанию.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Ответы по данным', s: ' — «сколько лидов пришло из Instagram за неделю?»' },
        { a: 'B', b: 'Действия по команде', s: ' — изменить цену, тариф номера или бронь.' },
        { a: 'C', b: 'Свой ключ', s: ' — можно подключить собственный ключ OpenAI или Anthropic.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Роли по отделам', s: ' — у каждого агента свои права, триггеры и инструкции.' },
        { a: 'B', b: 'Согласование', s: ' — рискованные действия ждут подтверждения человека.' },
        { a: 'C', b: 'Отчёты', s: ' — аналитик присылает ежедневный отчёт за вчера.' },
        { a: 'D', b: 'Консультант на сайте', s: ' — AI отвечает посетителям и записывает их в бронирования.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Бронирования', s: ' — услуги, ресурсы, расписание, лист ожидания, онлайн-запись.' },
        { a: 'B', b: 'Отели (PMS)', s: ' — номера, шахматка, ресепшн, тарифы по рынкам.' },
        { a: 'C', b: 'Товары и склад', s: ' — каталог, цены, штрихкоды и остатки по складам.' },
      ], cta: 'bookingLink' },
    ],
  },
  en: {
    kicker: 'FEATURES · 12 MODULES · ONE PLATFORM',
    title1: 'Every module — a product on its own.',
    title2: 'Together — one platform.',
    sub: 'Leads, deals, communications, marketing, projects, bookings and AI share one base of contacts and companies — no gluing data between services.',
    tocLabel: 'Jump to section',
    tryFree: 'Try for free',
    allIntegrations: 'All integrations',
    salesScenarios: 'Sales solution',
    readyScenarios: 'Ready playbooks',
    analyticsLink: 'Analytics solution',
    apiDocs: 'API documentation',
    marketingLink: 'Marketing solution',
    bookingLink: 'Bookings',
    hotelsLink: 'Reservation system',
    ctaKicker: 'READY TO SEE IT?',
    ctaTitle: 'We\'ll show the CRM on your use case in 30 minutes.',
    ctaBtn: 'Try it',
    ctaDemo: 'Book a demo',
    statsItems: [
      { v: '30+', l: 'ready-made integrations' },
      { v: '3', l: 'interface languages: Russian, English, Turkish' },
      { v: '14', l: 'days free on the Enterprise plan' },
      { v: '24h', l: 'database backup interval' },
    ],
    tabTryFree: 'Try for free',
    modules: [
      { n: '01', t: 'Leads & sources', lede: 'Requests from your website, forms, messengers and stores land in the CRM with source and UTM tags attached.' },
      { n: '02', t: 'Pipeline & Kanban', lede: 'Leads and deals on a Kanban board and in a list: statuses, owners, tasks and history on every card.' },
      { n: '03', t: 'Communications', lede: 'WhatsApp, Telegram, email, SMS, calls and website chat — the whole conversation in one feed inside the card.' },
      { n: '04', t: 'Marketing & ads', lede: 'UTM links, ad spend from ad accounts and revenue by channel — see which ads actually bring sales.' },
      { n: '05', t: 'Automations', lede: 'No-code scenario builder: trigger → conditions → actions, with delays and approvals.' },
      { n: '06', t: 'Analytics & BI', lede: 'Ready-made reports on leads, sales, managers and projects, plus your own BI dashboard.' },
      { n: '07', t: 'API & webhooks', lede: 'REST API with access tokens, lead intake from any website and outgoing webhooks from automations.' },
      { n: '08', t: 'Security', lede: 'Roles and permissions, two-factor authentication, an action log and data isolation for every company.' },
      { n: '09', t: 'Workspaces (no-code)', lede: 'Tables, Kanban, Calendar and Gantt in one module. Formulas, ratings, table relations and event-based automations — no code.' },
      { n: '10', t: 'AI assistant', lede: 'A chat with access to your CRM data: answers questions and changes prices, rates and bookings on command right in the interface.' },
      { n: '11', t: 'AI employees', lede: 'Role-based AI agents — lead, sales and marketing managers, analyst, SEO — with adjustable autonomy: from suggestions to actions with an approval queue.' },
      { n: '12', t: 'Bookings, hotels & products', lede: 'Online booking, a hotel reservation system, product catalog and warehouse — in the same CRM as your leads.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: 'Forms & websites', s: ' — embeddable forms, WordPress / Contact Form 7, WooCommerce and Shopify.' },
        { a: 'B', b: 'Messengers & chat', s: ' — WhatsApp, Telegram and website chat messages become leads instantly.' },
        { a: 'C', b: 'UTM & source', s: ' — every lead keeps its channel, campaign and landing page.' },
        { a: 'D', b: 'Duplicate search', s: ' — matches by email, phone and name, one-click merge with undo.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Kanban & list', s: ' — drag between statuses, filters, saved views.' },
        { a: 'B', b: 'Owners & access', s: ' — a manager sees own leads or all of them, depending on permissions.' },
        { a: 'C', b: 'Tasks & calendar', s: ' — calls, meetings and reminders linked to a lead or deal.' },
        { a: 'D', b: 'Trash & archive', s: ' — deleted leads can be restored within 30 days.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Messengers', s: ' — WhatsApp Business and Telegram bots, reply straight from the CRM.' },
        { a: 'B', b: 'Unified feed', s: ' — the whole conversation with a client in the lead card, whatever the channel.' },
        { a: 'C', b: 'Email & SMS', s: ' — connected mailboxes, templates, bulk campaigns.' },
        { a: 'D', b: 'Telephony', s: ' — calls from the card, call recording and AI transcription.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Ad accounts', s: ' — Google Ads, Meta Ads, Yandex Direct and VK Ads: spend is pulled in automatically.' },
        { a: 'B', b: 'UTM builder', s: ' — link templates so the whole team tags links the same way.' },
        { a: 'C', b: 'ROI by channel', s: ' — spend is matched with leads and revenue.' },
        { a: 'D', b: 'Segments & campaigns', s: ' — customer selections and email campaigns to them.' },
      ], cta: 'marketingLink' },
      { bullets: [
        { a: 'A', b: 'Triggers', s: ' — new lead, status change, field update, schedule.' },
        { a: 'B', b: 'Actions', s: ' — task, owner, status, tag, email, SMS, Telegram, Slack, webhook.' },
        { a: 'C', b: 'Hand-off to other systems', s: ' — amoCRM, Bitrix24, HubSpot, Mailchimp, Jira, Google Calendar.' },
        { a: 'D', b: 'Delays & approval', s: ' — steps that wait or need a human to confirm before running.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: 'Module reports', s: ' — leads, sales, projects, workspaces, bookings.' },
        { a: 'B', b: 'Managers', s: ' — won and lost deals, repeat sales for each manager.' },
        { a: 'C', b: 'BI dashboard', s: ' — your own widgets and period comparison.' },
        { a: 'D', b: 'Export & report emails', s: ' — CSV/Excel export and scheduled reports by email.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST API', s: ' — leads, products, bookings and custom objects via API token.' },
        { a: 'B', b: 'Lead intake', s: ' — a POST request from any website, landing page or bot.' },
        { a: 'C', b: 'Webhooks', s: ' — an automation sends data to your URL on any event.' },
        { a: 'D', b: 'No-code', s: ' — connect via Zapier, Make or n8n.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'Roles & permissions', s: ' — module access, "own / all" visibility, hiding amounts and contacts.' },
        { a: 'B', b: 'Two-factor authentication', s: ' — sign-in with a code from an authenticator app.' },
        { a: 'C', b: 'Action log', s: ' — who changed what, with date and time.' },
        { a: 'D', b: 'Infrastructure', s: ' — HTTPS, servers in the EU, daily backups.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Four views', s: ' — table, Kanban, calendar and Gantt over the same data.' },
        { a: 'B', b: 'Formulas & relations', s: ' — computed fields and links between tables.' },
        { a: 'C', b: 'AI import', s: ' — upload Excel/CSV, AI handles merged cells and messy sheets.' },
        { a: 'D', b: 'Auto-refresh', s: ' — tables pull data from integrations on a schedule.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Answers from your data', s: ' — "how many leads came from Instagram this week?"' },
        { a: 'B', b: 'Actions on command', s: ' — change a price, a room rate or a booking.' },
        { a: 'C', b: 'Your own key', s: ' — connect your own OpenAI or Anthropic key.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Department roles', s: ' — each agent has its own permissions, triggers and instructions.' },
        { a: 'B', b: 'Approval', s: ' — risky actions wait for a human to confirm.' },
        { a: 'C', b: 'Reports', s: ' — the analyst sends a daily report for yesterday.' },
        { a: 'D', b: 'Website consultant', s: ' — AI answers visitors and books them into Bookings.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Bookings', s: ' — services, resources, schedule, waitlist, online booking.' },
        { a: 'B', b: 'Hotels (PMS)', s: ' — rooms, occupancy grid, front desk, market rates.' },
        { a: 'C', b: 'Products & warehouse', s: ' — catalog, prices, barcodes and stock by warehouse.' },
      ], cta: 'bookingLink' },
    ],
  },
  tr: {
    kicker: 'ÖZELLİKLER · 12 MODÜL · TEK PLATFORM',
    title1: 'Her modül — kendi başına bir ürün.',
    title2: 'Birlikte — tek platform.',
    sub: 'Lead\'ler, fırsatlar, iletişim, pazarlama, projeler, rezervasyonlar ve AI aynı kişi ve şirket tabanında çalışır — servisler arasında veri birleştirmeye gerek yok.',
    tocLabel: 'Bölüme git',
    tryFree: 'Ücretsiz deneyin',
    allIntegrations: 'Tüm entegrasyonlar',
    salesScenarios: 'Satış çözümü',
    readyScenarios: 'Hazır senaryolar',
    analyticsLink: 'Analitik çözümü',
    apiDocs: 'API dokümantasyonu',
    marketingLink: 'Pazarlama çözümü',
    bookingLink: 'Rezervasyonlar',
    hotelsLink: 'Rezervasyon sistemi',
    ctaKicker: 'GÖRMEYE HAZIR MISINIZ?',
    ctaTitle: 'CRM\'i 30 dakikada kendi işiniz üzerinde gösterelim.',
    ctaBtn: 'Deneyin',
    ctaDemo: 'Demo ayarlayın',
    statsItems: [
      { v: '30+', l: 'hazır entegrasyon' },
      { v: '3', l: 'arayüz dili: Rusça, İngilizce, Türkçe' },
      { v: '14', l: 'gün Enterprise planı ücretsiz' },
      { v: '24s', l: 'veritabanı yedekleme aralığı' },
    ],
    tabTryFree: 'Ücretsiz deneyin',
    modules: [
      { n: '01', t: 'Lead\'ler ve kaynaklar', lede: 'Web sitesi, form, mesajlaşma uygulaması ve mağazalardan gelen talepler kaynak ve UTM etiketleriyle CRM\'e düşer.' },
      { n: '02', t: 'Pipeline ve Kanban', lede: 'Lead ve fırsatlar Kanban panosunda ve listede: durumlar, sorumlular, görevler ve her kartın geçmişi.' },
      { n: '03', t: 'İletişim', lede: 'WhatsApp, Telegram, e-posta, SMS, aramalar ve site sohbeti — müşteriyle tüm yazışma kartın içinde tek akışta.' },
      { n: '04', t: 'Pazarlama ve reklam', lede: 'UTM linkleri, reklam hesaplarından harcamalar ve kanal bazında gelir — hangi reklamın satış getirdiğini görün.' },
      { n: '05', t: 'Otomasyonlar', lede: 'Kodsuz senaryo oluşturucu: tetikleyici → koşullar → eylemler, gecikme ve onay adımlarıyla.' },
      { n: '06', t: 'Analitik ve BI', lede: 'Lead, satış, yönetici ve projeler için hazır raporlar ve kendi BI paneliniz.' },
      { n: '07', t: 'API ve webhook', lede: 'Erişim anahtarlı REST API, herhangi bir siteden lead alımı ve otomasyonlardan giden webhook\'lar.' },
      { n: '08', t: 'Güvenlik', lede: 'Roller ve yetkiler, iki faktörlü doğrulama, işlem günlüğü ve her şirketin verilerinin ayrılması.' },
      { n: '09', t: 'Çalışma alanları (no-code)', lede: 'Tablo, Kanban, Takvim ve Gantt tek modülde. Formüller, puanlar, tablolar arası bağlantılar ve olay bazlı otomasyonlar — kodsuz.' },
      { n: '10', t: 'AI asistan', lede: 'CRM verilerinize erişimi olan sohbet: soruları yanıtlar, fiyatları, oda fiyatlarını ve rezervasyonları komutla değiştirir.' },
      { n: '11', t: 'AI çalışanlar', lede: 'Rol bazlı AI ajanları — lead, satış ve pazarlama yöneticisi, analist, SEO — ayarlanabilir özerklikle: önerilerden onay kuyruklu eylemlere.' },
      { n: '12', t: 'Rezervasyonlar, oteller ve ürünler', lede: 'Online randevu, otel rezervasyon sistemi, ürün kataloğu ve depo — lead\'lerle aynı CRM\'de.' },
    ],
    spots: [
      { bullets: [
        { a: 'A', b: 'Formlar ve siteler', s: ' — gömülebilir formlar, WordPress / Contact Form 7, WooCommerce ve Shopify.' },
        { a: 'B', b: 'Mesajlaşma ve sohbet', s: ' — WhatsApp, Telegram ve site sohbeti mesajları anında lead olur.' },
        { a: 'C', b: 'UTM ve kaynak', s: ' — her lead kanalını, kampanyasını ve giriş sayfasını saklar.' },
        { a: 'D', b: 'Mükerrer arama', s: ' — e-posta, telefon ve isim eşleşmeleri, geri alınabilir tek tıkla birleştirme.' },
      ], cta: 'allIntegrations' },
      { bullets: [
        { a: 'A', b: 'Kanban ve liste', s: ' — durumlar arası sürükleme, filtreler, kayıtlı görünümler.' },
        { a: 'B', b: 'Sorumlular ve erişim', s: ' — yönetici yetkiye göre kendi lead\'lerini veya tümünü görür.' },
        { a: 'C', b: 'Görevler ve takvim', s: ' — arama, toplantı ve hatırlatmalar lead\'e veya fırsata bağlı.' },
        { a: 'D', b: 'Çöp kutusu ve arşiv', s: ' — silinen lead\'ler 30 gün içinde geri yüklenebilir.' },
      ], cta: 'salesScenarios' },
      { bullets: [
        { a: 'A', b: 'Mesajlaşma', s: ' — WhatsApp Business ve Telegram botları, doğrudan CRM\'den yanıt.' },
        { a: 'B', b: 'Tek akış', s: ' — kanal fark etmeksizin müşteriyle tüm yazışma lead kartında.' },
        { a: 'C', b: 'E-posta ve SMS', s: ' — bağlı posta kutuları, şablonlar, toplu gönderimler.' },
        { a: 'D', b: 'Telefon', s: ' — karttan arama, görüşme kaydı ve AI transkripsiyonu.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Reklam hesapları', s: ' — Google Ads, Meta Ads, Yandex Direct ve VK Ads: harcamalar otomatik çekilir.' },
        { a: 'B', b: 'UTM oluşturucu', s: ' — ekibin linkleri aynı şekilde etiketlemesi için şablonlar.' },
        { a: 'C', b: 'Kanal bazında ROI', s: ' — harcamalar lead ve gelirle eşleştirilir.' },
        { a: 'D', b: 'Segmentler ve kampanyalar', s: ' — müşteri seçimleri ve onlara e-posta kampanyaları.' },
      ], cta: 'marketingLink' },
      { bullets: [
        { a: 'A', b: 'Tetikleyiciler', s: ' — yeni lead, durum değişikliği, alan güncellemesi, zamanlama.' },
        { a: 'B', b: 'Eylemler', s: ' — görev, sorumlu, durum, etiket, e-posta, SMS, Telegram, Slack, webhook.' },
        { a: 'C', b: 'Diğer sistemlere aktarım', s: ' — amoCRM, Bitrix24, HubSpot, Mailchimp, Jira, Google Calendar.' },
        { a: 'D', b: 'Gecikme ve onay', s: ' — bekleyen veya çalışmadan önce insan onayı gereken adımlar.' },
      ], cta: 'readyScenarios' },
      { bullets: [
        { a: 'A', b: 'Modül raporları', s: ' — lead\'ler, satışlar, projeler, çalışma alanları, rezervasyonlar.' },
        { a: 'B', b: 'Yöneticiler', s: ' — her yönetici için kazanılan ve kaybedilen fırsatlar, tekrar satışlar.' },
        { a: 'C', b: 'BI paneli', s: ' — kendi widget\'larınız ve dönem karşılaştırması.' },
        { a: 'D', b: 'Dışa aktarma ve rapor e-postaları', s: ' — CSV/Excel aktarımı ve zamanlanmış e-posta raporları.' },
      ], cta: 'analyticsLink' },
      { bullets: [
        { a: 'A', b: 'REST API', s: ' — API anahtarıyla lead, ürün, rezervasyon ve özel nesneler.' },
        { a: 'B', b: 'Lead alımı', s: ' — herhangi bir site, landing veya bottan POST isteği.' },
        { a: 'C', b: 'Webhook', s: ' — otomasyon herhangi bir olayda verileri URL\'nize gönderir.' },
        { a: 'D', b: 'No-code', s: ' — Zapier, Make veya n8n ile bağlantı.' },
      ], cta: 'apiDocs' },
      { bullets: [
        { a: 'A', b: 'Roller ve yetkiler', s: ' — modül erişimi, "kendi / tümü" görünürlüğü, tutar ve iletişim gizleme.' },
        { a: 'B', b: 'İki faktörlü doğrulama', s: ' — kimlik doğrulayıcı uygulamadaki kodla giriş.' },
        { a: 'C', b: 'İşlem günlüğü', s: ' — kim neyi değiştirdi, tarih ve saatiyle.' },
        { a: 'D', b: 'Altyapı', s: ' — HTTPS, AB\'de sunucular, günlük yedekler.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Dört görünüm', s: ' — aynı veriler üzerinde tablo, Kanban, takvim ve Gantt.' },
        { a: 'B', b: 'Formüller ve bağlantılar', s: ' — hesaplanan alanlar ve tablolar arası linkler.' },
        { a: 'C', b: 'AI ile içe aktarma', s: ' — Excel/CSV yükleyin, AI birleştirilmiş hücreleri ve dağınık tabloları çözer.' },
        { a: 'D', b: 'Otomatik yenileme', s: ' — tablolar entegrasyonlardan zamanlanmış veri çeker.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Verilerden yanıtlar', s: ' — "bu hafta Instagram\'dan kaç lead geldi?"' },
        { a: 'B', b: 'Komutla eylemler', s: ' — fiyatı, oda fiyatını veya rezervasyonu değiştirin.' },
        { a: 'C', b: 'Kendi anahtarınız', s: ' — kendi OpenAI veya Anthropic anahtarınızı bağlayın.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Departman rolleri', s: ' — her ajanın kendi yetkileri, tetikleyicileri ve talimatları var.' },
        { a: 'B', b: 'Onay', s: ' — riskli eylemler insan onayını bekler.' },
        { a: 'C', b: 'Raporlar', s: ' — analist dün için günlük rapor gönderir.' },
        { a: 'D', b: 'Site danışmanı', s: ' — AI ziyaretçileri yanıtlar ve rezervasyona kaydeder.' },
      ]},
      { bullets: [
        { a: 'A', b: 'Rezervasyonlar', s: ' — hizmetler, kaynaklar, takvim, bekleme listesi, online randevu.' },
        { a: 'B', b: 'Oteller (PMS)', s: ' — odalar, doluluk tablosu, resepsiyon, pazar bazlı fiyatlar.' },
        { a: 'C', b: 'Ürünler ve depo', s: ' — katalog, fiyatlar, barkodlar ve depo bazında stok.' },
      ], cta: 'bookingLink' },
    ],
  },
};


const PAGE = {
  ru: { crumb: 'Функции', module: 'Модуль', aiK: 'Сверху — ИИ-слой', aiT: 'Модули работают сами, когда в штате есть ИИ.', aiD: 'Aura собирает дашборды из данных модулей, ИИ-сотрудники ведут лидов и отвечают клиентам, ИИ-отделы связывают каналы и сервисы.', aiEmp: 'ИИ-сотрудники', aiDept: 'ИИ-отделы' },
  en: { crumb: 'Features', module: 'Module', aiK: 'On top — the AI layer', aiT: 'Modules run themselves when AI is on the team.', aiD: 'Aura builds dashboards from module data, AI employees work leads and answer clients, AI departments connect channels and services.', aiEmp: 'AI employees', aiDept: 'AI departments' },
  tr: { crumb: 'Özellikler', module: 'Modül', aiK: 'Üstte — yapay zekâ katmanı', aiT: 'Ekipte yapay zekâ varsa modüller kendi kendine çalışır.', aiD: 'Aura modül verilerinden panolar kurar, yapay zekâ çalışanları talepleri yürütür ve müşterilere yanıt verir, yapay zekâ departmanları kanalları ve servisleri bağlar.', aiEmp: 'Yapay zekâ çalışanları', aiDept: 'Yapay zekâ departmanları' },
};

const CTA_LINKS: Record<string, string> = {
  allIntegrations: '/integrations',
  salesScenarios: '/solutions/sales',
  readyScenarios: '/scenarios',
  marketingLink: '/solutions/marketing',
  bookingLink: '/solutions/booking',
  hotelsLink: '/solutions/hotels',
  analyticsLink: '/solutions/analytics',
  apiDocs: '/api-integration',
};

function useInViewOnce<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.25) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return v;
}

function Stat({ v, l, on, i }: { v: string; l: string; on: boolean; i: number }) {
  const m = v.match(/^([^\d]*)(\d+)(.*)$/);
  const to = m ? Number(m[2]) : 0;
  const [x, setX] = useState(0);
  useEffect(() => {
    if (!on || !m) return;
    let raf = 0;
    let t0 = 0;
    const dur = 1300 + i * 140;
    const f = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setX(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, to]);
  return (
    <div className="lp-stat">
      <b>{m ? m[1] + Math.round(x) + m[3] : v}</b>
      <span>{l}</span>
    </div>
  );
}

function Stats({ items }: { items: Array<{ v: string; l: string }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInViewOnce(ref, 0.3);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (on) setSeen(true);
  }, [on]);
  return (
    <div ref={ref} className="lp-stats">
      {items.map((s, i) => (
        <Stat key={i} v={s.v} l={s.l} on={seen} i={i} />
      ))}
    </div>
  );
}

type Mod = { n: string; t: string; lede: string };
type Spot = { bullets: Array<{ a: string; b: string; s: string }>; cta?: string };

function FtMod({ idx, m, spot, lang, label, ctaText, setAct, demo }: { idx: number; m: Mod; spot: Spot; lang: Lang; label: string; ctaText?: string; setAct: (i: number) => void; demo: LandingDemoText }) {
  const ref = useRef<HTMLElement>(null);
  const on = useInViewOnce(ref, 0.35);
  useEffect(() => {
    if (on) setAct(idx);
  }, [on, idx, setAct]);
  return (
    <section className="ft-mod" id={'m-' + m.n} ref={ref}>
      <div className="ft-mod-t lh-rv">
        <div className="lp-kick">
          <span className="lp-dot" />
          {label} · {m.n}
        </div>
        <h2>{m.t}</h2>
        <p className="ft-lede">{m.lede}</p>
        <ul>
          {spot.bullets.map((b, k) => (
            <li key={b.b}>
              <i>{String(k + 1).padStart(2, '0')}</i>
              <span>
                <b>{b.b}</b>
                {b.s}
              </span>
            </li>
          ))}
        </ul>
        {spot.cta && ctaText && CTA_LINKS[spot.cta] && (
          <Link className="ft-cta" to={CTA_LINKS[spot.cta]}>
            {ctaText}
            <Icon name="arrow" size={13} />
          </Link>
        )}
      </div>
      <div className="ft-mod-v lh-rv">
        <FeatureVisual idx={idx} on={on} lang={lang} bullets={spot.bullets} demo={demo} />
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang: Lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = T[lang] as (typeof T)['ru'];
  const pg = PAGE[lang];
  const demo = t('landing.v5.demo', { returnObjects: true }) as LandingDemoText;
  const root = useRef<HTMLElement>(null);
  useScrollReveal(root);
  const [act, setAct] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  /* sticky-навигация модулей прилипает под шапку, высота которой меняется при прокрутке */
  useEffect(() => {
    const upd = () => {
      const h = document.querySelector('header');
      if (h) root.current?.style.setProperty('--ft-top', Math.round(h.getBoundingClientRect().height) + 'px');
    };
    upd();
    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    return () => {
      window.removeEventListener('scroll', upd);
      window.removeEventListener('resize', upd);
    };
  }, []);
  /* активная кнопка навигации — в видимой части полосы */
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('button.on');
    const box = navRef.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [act]);

  const go = (n: string) => {
    const el = document.getElementById('m-' + n);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
  };
  const signup = () => navigate('/?mode=signup');

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <PublicHeader activeKey="features" />
      <main className="lhv" ref={root}>
        <section className="lp-hero">
          <div className="lh-glow" />
          <div className="lp-hero-in">
            <div className="lp-hero-t">
              <nav className="lp-crumbs" aria-label="breadcrumb">
                <Link to="/">Lumiva CRM</Link>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span>{pg.crumb}</span>
              </nav>
              <div className="lp-kick">
                <span className="lp-dot" />
                {tx.kicker}
              </div>
              <h1 className="lp-h1">
                {tx.title1}
                <br />
                <em>{tx.title2}</em>
              </h1>
              <p className="lp-sub">{tx.sub}</p>
              <div className="lp-cta">
                <button type="button" className="lh-btn lg" onClick={signup}>
                  {tx.tryFree}
                  <Icon name="arrow" size={15} stroke={2} />
                </button>
                <Link className="lh-btn gh lg" to="/contact">
                  {tx.ctaDemo}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="ft-nav">
          <div className="ft-nav-in" ref={navRef}>
            {tx.modules.map((m, i) => (
              <button type="button" key={m.n} className={act === i ? 'on' : ''} onClick={() => go(m.n)}>
                <em>{m.n}</em>
                {m.t}
              </button>
            ))}
          </div>
        </div>

        <div className="ft-mods">
          {tx.modules.map((m, i) => {
            const spot = tx.spots[i] as Spot;
            return (
              <FtMod
                key={m.n}
                idx={i}
                m={m}
                spot={spot}
                lang={lang}
                label={pg.module}
                ctaText={spot.cta ? (tx as Record<string, unknown>)[spot.cta] as string : undefined}
                setAct={setAct}
                demo={demo}
              />
            );
          })}
        </div>

        <section className="lp-sec">
          <Stats items={tx.statsItems} />
        </section>

        <section className="lp-sec">
          <div className="lp-sh lh-rv">
            <div className="lp-kick">
              <span className="lp-dot" />
              {pg.aiK}
            </div>
            <h2>{pg.aiT}</h2>
            <p>{pg.aiD}</p>
            <div className="lp-cta c">
              <Link className="lh-btn" to="/#aura">
                <Icon name="spark" size={14} />
                Aura
              </Link>
              <Link className="lh-btn gh" to="/#crew">
                {pg.aiEmp}
              </Link>
              <Link className="lh-btn gh" to="/#depts">
                {pg.aiDept}
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-ctab lh-rv">
            <div className="lh-glow b" />
            <div>
              <div className="lp-kick">
                <span className="lp-dot" />
                {tx.ctaKicker}
              </div>
              <h2>{tx.ctaTitle}</h2>
            </div>
            <div className="lp-ctab-a">
              <Link className="lh-btn lg" to="/contact">
                {tx.ctaDemo}
                <Icon name="arrow" size={15} stroke={2} />
              </Link>
              <button type="button" className="lh-btn gh lg" onClick={signup}>
                {tx.tryFree}
              </button>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
