import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function SolutionsPage() {
  const { t } = useTranslation();
  const items = t('publicPages.solutions.items', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;
  return (
    <PublicPageLayout
      pageKey="solutions"
      title={t('publicPages.solutions.title')}
      subtitle={t('publicPages.solutions.subtitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-400 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]"
          >
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        Для каждой компании формируется отдельный tenant с собственными настройками, составом модулей и доступами.
        Это дает возможность запускать CRM поэтапно: сначала отдел продаж, затем маркетинг, затем проектный блок и
        аналитику. Масштабирование происходит без полного переезда на новую систему.
      </div>
    </PublicPageLayout>
  );
}
