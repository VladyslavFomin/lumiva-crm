import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from './PublicPageLayout';

type ChangeType = 'new' | 'improved' | 'fixed' | 'security';

interface ChangeItem {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  highlight?: string;
  changes: ChangeItem[];
}

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string }> = {
  new:      { label: 'Новое',       color: 'bg-emerald-100 text-emerald-700' },
  improved: { label: 'Улучшение',   color: 'bg-blue-100 text-blue-700' },
  fixed:    { label: 'Исправлено',  color: 'bg-amber-100 text-amber-700' },
  security: { label: 'Безопасность', color: 'bg-red-100 text-red-700' },
};

const RELEASES: Release[] = [
  {
    version: '2.5.0',
    date: '18 апреля 2026',
    highlight: 'Новый дизайн и маркетинговые страницы',
    changes: [
      { type: 'new',      text: 'Единая дизайн-система: компоненты Button, Card, Badge, Modal, Input' },
      { type: 'new',      text: 'Страницы: Функции, О нас, Контакты, FAQ, Условия, История обновлений' },
      { type: 'new',      text: 'Обновлённый футер с навигацией по разделам' },
      { type: 'improved', text: 'Кнопки и формы теперь выглядят единообразно во всей CRM' },
      { type: 'improved', text: 'Rate limiting: защита API от перегрузки (20 req/s, 100 req/10s)' },
      { type: 'security', text: 'JWT_SECRET больше не имеет fallback значения — обязателен в окружении' },
      { type: 'security', text: 'Добавлены HTTP-заголовки безопасности через Helmet' },
      { type: 'security', text: 'CORS origins вынесены в переменную окружения CORS_ORIGINS' },
      { type: 'fixed',    text: 'synchronize: false в продакшне — схема больше не изменяется автоматически' },
    ],
  },
  {
    version: '2.4.2',
    date: '5 апреля 2026',
    changes: [
      { type: 'fixed',    text: 'Исправлена загрузка файлов в рабочих областях при большом объёме' },
      { type: 'fixed',    text: 'Устранён баг с дублированием уведомлений в Telegram-боте' },
      { type: 'improved', text: 'Ускорена загрузка страницы лидов на 40% за счёт оптимизации запросов' },
    ],
  },
  {
    version: '2.4.0',
    date: '20 марта 2026',
    highlight: 'AI-ассистент и улучшения Workspace',
    changes: [
      { type: 'new',      text: 'AI-ассистент: анализ лидов и автоматическое заполнение полей' },
      { type: 'new',      text: 'Рабочие области: Gantt-диаграмма для отслеживания зависимостей задач' },
      { type: 'new',      text: 'Workspace: сохранённые представления с фильтрами и сортировкой' },
      { type: 'improved', text: 'Мобильная версия интерфейса: адаптация для экранов < 768px' },
      { type: 'improved', text: 'Новые типы полей в рабочих областях: формула, рейтинг, прогресс' },
      { type: 'fixed',    text: 'Исправлен импорт из Excel с русскими заголовками столбцов' },
    ],
  },
  {
    version: '2.3.0',
    date: '1 февраля 2026',
    highlight: 'Интеграция с Meta Ads и Google Ads',
    changes: [
      { type: 'new',      text: 'Интеграция Meta Ads: импорт кампаний и конверсий' },
      { type: 'new',      text: 'Интеграция Google Ads: синхронизация расходов и кликов' },
      { type: 'new',      text: 'Маркетинг: дашборд сравнения каналов привлечения' },
      { type: 'improved', text: 'Аналитика: экспорт отчётов в Excel с форматированием' },
      { type: 'security', text: 'Обновлены зависимости: устранены 3 CVE в пакетах' },
    ],
  },
  {
    version: '2.2.0',
    date: '15 декабря 2025',
    highlight: 'Telegram CRM и онлайн-чат',
    changes: [
      { type: 'new',      text: 'Telegram CRM: чаты с клиентами прямо в CRM через ботов' },
      { type: 'new',      text: 'Онлайн-чат: виджет для сайта с историей переписки' },
      { type: 'new',      text: 'WhatsApp: приём входящих сообщений через webhook' },
      { type: 'improved', text: 'Email: массовая рассылка с отслеживанием открытий' },
      { type: 'fixed',    text: 'Исправлен счётчик непрочитанных сообщений в сайдбаре' },
    ],
  },
  {
    version: '2.1.0',
    date: '10 октября 2025',
    highlight: 'Рабочие области v2',
    changes: [
      { type: 'new',      text: 'Рабочие области: Kanban и Календарь помимо таблицы' },
      { type: 'new',      text: 'Кастомные поля: связи между таблицами (entity ref)' },
      { type: 'new',      text: 'Автоматизации: триггеры по событиям в рабочих областях' },
      { type: 'improved', text: 'Производительность: кеширование данных таблиц' },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <PublicPageLayout
      pageKey="changelog"
      title="История обновлений"
      subtitle="Что нового в Lumiva CRM. Мы постоянно улучшаем платформу на основе обратной связи клиентов."
    >
      <div className="mt-8 flex flex-wrap gap-2 mb-8">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{RELEASES.length} релизов</span>
      </div>

      <div className="relative">
        <div className="absolute left-[1.875rem] top-0 bottom-0 w-px bg-border-default hidden sm:block" />
        <div className="flex flex-col gap-8">
          {RELEASES.map((release, ri) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ri * 0.05, duration: 0.35 }}
              className="flex gap-6 items-start"
            >
              {/* Version badge */}
              <div className="shrink-0 w-[3.75rem] flex flex-col items-center gap-1 z-10">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center text-[10px] font-bold shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
                  v{release.version.split('.').slice(0, 2).join('.')}
                </div>
              </div>

              {/* Release card */}
              <div className="flex-1 card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900">v{release.version}</span>
                      {ri === 0 && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white">Последняя</span>
                      )}
                    </div>
                    {release.highlight && (
                      <div className="text-sm font-medium text-slate-900">{release.highlight}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">{release.date}</div>
                </div>

                <div className="flex flex-col gap-2">
                  {release.changes.map((change, ci) => {
                    const cfg = TYPE_CONFIG[change.type];
                    return (
                      <div key={ci} className="flex items-start gap-2.5 text-xs">
                        <span className={`shrink-0 mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-slate-500 leading-relaxed">{change.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Subscribe CTA */}
      <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-2">Будьте в курсе</div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Следите за обновлениями</h3>
        <p className="text-sm text-slate-500 mb-6">Подпишитесь на Telegram-канал или RSS, чтобы узнавать о новых функциях первыми.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="https://t.me/lumiva_crm" className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:bg-black-hover transition-all">
            Telegram-канал
          </a>
          <Link to="/contact" className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 hover:border-slate-300 transition-all">
            Предложить функцию
          </Link>
        </div>
      </div>
    </PublicPageLayout>
  );
}
