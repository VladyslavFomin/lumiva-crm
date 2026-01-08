// src/pages/AccessDeniedPage.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../layout/MainLayout';

export const AccessDeniedPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="h-full flex items-center justify-center py-10">
        <div className="rounded-3xl border border-rose-100 bg-white px-6 py-8 shadow-sm text-center max-w-xl">
          <div className="text-2xl font-semibold text-rose-600 mb-2">
            {t('crm.errors.accessDeniedTitle')}
          </div>
          <p className="text-sm text-slate-600">
            {t('crm.errors.accessDeniedText')}
          </p>
        </div>
      </div>
    </MainLayout>
  );
};
