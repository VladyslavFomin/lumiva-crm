// src/pages/TenantInactivePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearSession } from '../auth/session';
import {
  clearTenantInactiveReason,
  readTenantInactiveReason,
} from '../api/client';

interface BlockReason {
  reason?: string;
  message?: string;
  activeUntil?: string | null;
  ts?: number;
}

export const TenantInactivePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState<BlockReason | null>(null);

  useEffect(() => {
    setReason(readTenantInactiveReason());
    clearSession();
  }, []);

  const locale = useMemo(() => {
    if (i18n.language === 'tr') return 'tr-TR';
    if (i18n.language === 'en') return 'en-US';
    return 'ru-RU';
  }, [i18n.language]);

  const prettyReason = () => {
    if (!reason?.reason) return t('crm.inactive.defaultReason');
    if (reason.reason === 'expired') {
      return t('crm.inactive.reasonExpired');
    }
    return t('crm.inactive.reasonBlocked');
  };

  const activeUntilText =
    reason?.activeUntil &&
    new Date(reason.activeUntil).toLocaleDateString(locale);

  const handleBack = () => {
    clearTenantInactiveReason();
    window.location.href = '/';
  };

  const supportSubject = encodeURIComponent(t('crm.inactive.contact.subject'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 flex items-center justify-center px-4 py-10">
      <div className="relative max-w-3xl w-full">
        <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-sky-200 blur-3xl opacity-70" />
        <div className="absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-indigo-200 blur-3xl opacity-70" />

        <div className="relative rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t('crm.inactive.badge')}
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-4">
                {t('crm.inactive.title')}
              </h1>
              <p className="text-slate-600 mt-2 max-w-2xl">
                {prettyReason()} {t('crm.inactive.description')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t('crm.inactive.fields.reason')}
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">
                  {reason?.message || prettyReason()}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t('crm.inactive.fields.activeUntil')}
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">
                  {activeUntilText || t('crm.inactive.empty')}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {t('crm.inactive.fields.lastCheck')}
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">
                  {reason?.ts
                    ? new Date(reason.ts).toLocaleString(locale)
                    : t('crm.inactive.empty')}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-2">
              <div className="text-sm text-slate-600">
                {t('crm.inactive.contact.text', { email: 'support@lumiva.agency' })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  className="btn-primary"
                  href={`mailto:support@lumiva.agency?subject=${supportSubject}`}
                >
                  {t('crm.inactive.contact.write')}
                </a>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:-translate-y-[1px] transition"
                >
                  {t('crm.inactive.contact.home')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantInactivePage;
