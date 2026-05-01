import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from './PublicPageLayout';

const FAQS = [
  {
    category: 'Общее',
    items: [
      {
        q: 'Что такое Lumiva CRM?',
        a: 'Lumiva CRM — это облачная платформа для управления клиентами, проектами и продажами. Включает CRM, рабочие области (no-code таблицы), автоматизации, аналитику и интеграции с популярными сервисами.',
      },
      {
        q: 'Для какого бизнеса подходит Lumiva?',
        a: 'Для малого и среднего бизнеса: от фрилансеров и стартапов до команд 50–200 человек. Используется в продажах, маркетинге, проектном управлении и клиентском сервисе.',
      },
      {
        q: 'Нужно ли устанавливать что-то на компьютер?',
        a: 'Нет. Lumiva CRM работает полностью в браузере. Также есть мобильное приложение для iOS и Android. Никакой установки и обслуживания серверов не требуется.',
      },
    ],
  },
  {
    category: 'Тарифы и оплата',
    items: [
      {
        q: 'Есть ли бесплатный период?',
        a: 'Да. После регистрации аккаунт работает в ограниченном режиме бессрочно. Для активации всех модулей нужно выбрать тариф.',
      },
      {
        q: 'Как устроена оплата?',
        a: 'Оплата за пользователя в месяц. При выборе годового тарифа действует автоматическая скидка 10–20% в зависимости от плана. Принимаем карты, банковский перевод.',
      },
      {
        q: 'Можно ли отменить подписку?',
        a: 'Да, в любой момент. После отмены аккаунт переходит в ограниченный режим, данные сохраняются 30 дней.',
      },
      {
        q: 'Есть ли скидки для НКО и учебных заведений?',
        a: 'Да. Напишите нам на hello@lumiva.agency с подтверждающими документами — рассмотрим индивидуальные условия.',
      },
    ],
  },
  {
    category: 'Технические вопросы',
    items: [
      {
        q: 'Как защищены мои данные?',
        a: 'Каждый клиент работает в изолированном аккаунте (мультитенантная архитектура). Все данные шифруются при передаче (TLS 1.3) и хранении. Регулярные бэкапы.',
      },
      {
        q: 'Есть ли API для интеграций?',
        a: 'Да. Lumiva CRM предоставляет REST API с аутентификацией по токену. Документация доступна в разделе API после регистрации.',
      },
      {
        q: 'Можно ли импортировать данные из другой CRM?',
        a: 'Да. Поддерживается импорт из Excel/CSV. Также есть прямые коннекторы для AmoCRM, Bitrix24 и HubSpot.',
      },
      {
        q: 'Какой SLA у платформы?',
        a: 'Гарантируем 99.9% uptime для коммерческих планов. Уведомления о плановых работах — минимум за 24 часа.',
      },
    ],
  },
  {
    category: 'Интеграции',
    items: [
      {
        q: 'Какие интеграции поддерживаются?',
        a: 'Google Analytics 4, Meta Ads, Google Ads, Mailchimp, WooCommerce, AmoCRM, Bitrix24, HubSpot, Telegram, WhatsApp, Slack, Google Sheets, WordPress CF7, Zapier, 1С, SAP, Jira, OpenAI и другие.',
      },
      {
        q: 'Как подключить Telegram-бота?',
        a: 'В разделе «Telegram» создайте бота, вставьте токен от @BotFather. После подключения все сообщения клиентов попадают в CRM и можно отвечать прямо из интерфейса.',
      },
      {
        q: 'Поддерживается ли webhooks?',
        a: 'Да. Можно настроить входящие вебхуки для WordPress Contact Form 7, AmoCRM, WhatsApp и кастомных источников.',
      },
    ],
  },
];

const AccordionItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-slate-900">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 transition-transform ${open ? 'rotate-45' : ''}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-slate-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? FAQS.filter((g) => g.category === activeCategory) : FAQS;

  return (
    <PublicPageLayout
      pageKey="faq"
      title="Часто задаваемые вопросы"
      subtitle="Ответы на самые популярные вопросы о Lumiva CRM. Не нашли ответ? Напишите нам."
    >
      {/* Category filter */}
      <div className="mt-8 mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeCategory === null
              ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]'
              : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          Все
        </button>
        {FAQS.map((g) => (
          <button
            key={g.category}
            onClick={() => setActiveCategory(activeCategory === g.category ? null : g.category)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeCategory === g.category
                ? 'bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {g.category}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {filtered.map((group) => (
            <div key={group.category} className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">{group.category}</div>
              {group.items.map((item) => (
                <AccordionItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Не нашли ответ?</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Наша команда поддержки ответит в течение 24 часов в рабочие дни.
            </p>
            <Link to="/contact" className="block w-full text-center py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-black-hover transition-all">
              Написать нам
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Полезные ссылки</h4>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Возможности', to: '/features' },
                { label: 'Тарифы', to: '/pricing' },
                { label: 'Интеграции', to: '/integrations' },
                { label: 'API документация', to: '/api-integration' },
                { label: 'История обновлений', to: '/changelog' },
              ].map((l) => (
                <Link key={l.label} to={l.to} className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
