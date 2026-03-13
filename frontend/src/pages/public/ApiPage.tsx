import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function ApiPage() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout
      pageKey="api"
      title={t('publicPages.api.title')}
      subtitle={t('publicPages.api.subtitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-400 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]">
          <h3 className="text-sm font-semibold text-slate-900">{t('publicPages.api.blocks.endpointsTitle')}</h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            {(t('publicPages.api.blocks.endpoints', { returnObjects: true }) as string[]).map((row) => (
              <li key={row} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {row}
              </li>
            ))}
          </ul>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 200 80"
            className="pointer-events-none absolute right-0 top-0 h-20 w-56 opacity-20"
          >
            <path d="M0 65 C 45 15, 95 15, 140 48 S 180 78, 200 20" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            {t('publicPages.api.blocks.requestExample')}
          </div>
          <pre className="mt-3 overflow-x-auto text-xs text-slate-200">{`GET /v1/leads?status=in_progress
Authorization: Bearer <token>
X-Api-Token: <tenant-token>`}</pre>
        </article>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        API покрывает ключевые сущности CRM: лиды, сделки, статусы, компании, контакты и биллинг. Для безопасной
        интеграции используются tenant-ключи, JWT авторизация и проверка подписи webhook-событий. Это позволяет
        подключать внешние формы, телефонию, сайты и автоматизаторы без потери целостности данных.
      </div>
    </PublicPageLayout>
  );
}
