import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function ScenariosPage() {
  const { t } = useTranslation();
  const scenarios = t('publicPages.scenarios.items', { returnObjects: true }) as Array<{
    title: string;
    text: string;
  }>;

  return (
    <PublicPageLayout
      pageKey="scenarios"
      title={t('publicPages.scenarios.title')}
      subtitle={t('publicPages.scenarios.subtitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <article
            key={scenario.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all hover:border-slate-400 hover:shadow-[0_20px_45px_rgba(15,23,42,0.1)]"
          >
            <h3 className="text-sm font-semibold text-slate-900">{scenario.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{scenario.text}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        Сценарии можно комбинировать: например, добавить обязательный SLA для входящих лидов, а затем запускать
        автоматическую реактивацию для тех, кто не дошел до оплаты. Все действия фиксируются в CRM, поэтому вы видите
        полную цепочку от первого касания до выручки.
      </div>
    </PublicPageLayout>
  );
}
