import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchMe, type MeDto } from '../../../api/users';
import { getStoredTenantName } from '../../../auth/session';
import { resolvePublicAssetUrl } from '../../../api/client';

function formatDate(iso: string | null | undefined, locale: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

export const AccountOverviewTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale =
    i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const [me, setMe] = useState<MeDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((u) => {
        if (alive) setMe(u);
      })
      .catch((e) => {
        if (alive) setErr(e?.message || t('crm.account.personal.errors.load'));
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const tenantName = getStoredTenantName();
  const role = (me?.role || '').toLowerCase();
  const roleBadge =
    role === 'owner'
      ? t('crm.account.badges.owner')
      : role === 'admin'
        ? t('crm.account.badges.admin')
        : me?.role || '—';
  const status = (me?.status || 'active').toLowerCase();
  const statusLabel =
    status === 'disabled'
      ? t('crm.account.badges.disabled')
      : t('crm.account.badges.active');

  const avatarSrc = resolvePublicAssetUrl(me?.avatarUrl || null);

  return (
    <div className="space-y-6">
      {err && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {err}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t('crm.account.overview.cardIdentity')}
          </div>
          <div className="mt-4 flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-400">
                  {(me?.name?.[0] || me?.email?.[0] || '?').toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900 truncate">
                {me?.name || me?.email || '—'}
              </div>
              <div className="text-sm text-slate-600 truncate">{me?.email}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-800">
                  {roleBadge}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-800">
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t('crm.account.overview.cardTenant')}
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-[11px] text-slate-500">{t('crm.nav.settingsCompany')}</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {tenantName?.trim() || t('crm.account.overview.tenantNameFallback')}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-500">{t('crm.account.overview.memberSince')}</div>
                <div className="mt-0.5 text-slate-800">{formatDate(me?.createdAt, locale)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">{t('crm.account.overview.lastActive')}</div>
                <div className="mt-0.5 text-slate-800">
                  {me?.lastActiveAt ? formatDate(me.lastActiveAt, locale) : t('crm.account.overview.never')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-900">{t('crm.account.overview.quickLinks')}</div>
        <p className="mt-1 text-xs text-slate-500">{t('crm.account.overview.quickLinksHint')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/app/profile/personal"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:border-[#222222]/30 hover:bg-white"
          >
            {t('crm.account.nav.personal')} →
          </Link>
          <Link
            to="/app/profile/security"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:border-[#222222]/30 hover:bg-white"
          >
            {t('crm.account.nav.security')} →
          </Link>
          <Link
            to="/app/settings"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:border-[#222222]/30 hover:bg-white"
          >
            {t('crm.account.nav.company')} →
          </Link>
        </div>
      </div>
    </div>
  );
};
