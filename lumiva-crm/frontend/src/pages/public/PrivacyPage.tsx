import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPageLayout } from './PublicPageLayout';

export default function PrivacyPage() {
  const { t } = useTranslation();
  const items = t('publicPages.privacy.items', { returnObjects: true }) as string[];
  return (
    <PublicPageLayout
      pageKey="privacy"
      title={t('publicPages.privacy.title')}
      subtitle={t('publicPages.privacy.subtitle')}
    >
      <div className="space-y-3 text-sm text-slate-700">
        {items.map((text) => (
          <p
            key={text}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-400 hover:shadow-[0_16px_35px_rgba(15,23,42,0.08)]"
          >
            {text}
          </p>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        При необходимости подписывается отдельное соглашение об обработке данных (DPA), а также настраивается
        регламент хранения и удаления по политике клиента. Для команд с повышенными требованиями к безопасности
        возможна дополнительная сегментация прав доступа и аудит действий пользователей.
      </div>
    </PublicPageLayout>
  );
}
