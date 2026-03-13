import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function DevelopmentPage() {
  const { t } = useTranslation();
  const cards = t('publicPages.development.cards', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;

  return (
    <PublicPageLayout
      pageKey="development"
      title={t('publicPages.development.title')}
      subtitle={t('publicPages.development.subtitle')}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((item) => (
          <article
            key={item.title}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)]"
          >
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.text}</p>
            <div className="mt-3 h-[2px] w-0 bg-slate-900 transition-all group-hover:w-10" />
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {t('publicPages.development.timelineTitle')}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {(t('publicPages.development.timeline', { returnObjects: true }) as string[]).map((step) => (
            <div key={step} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
              {step}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        <p>
          Мы внедряем CRM по принципу «процессы сначала». Это означает, что карточки лида, этапы сделки, задачи и отчеты
          проектируются под фактическую работу команды, а не под универсальный шаблон. На выходе вы получаете систему,
          в которой менеджеры работают быстрее, руководители видят узкие места, а маркетинг понимает, какие каналы дают
          прибыль, а не только трафик.
        </p>
      </div>
    </PublicPageLayout>
  );
}
