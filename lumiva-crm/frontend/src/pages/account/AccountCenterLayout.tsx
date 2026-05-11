// src/pages/account/AccountCenterLayout.tsx
import React from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { getStoredUser } from '../../auth/session';

const BASE = '/profile';

function navClass(active: boolean) {
  return [
    'flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors border',
    active
      ? 'border-[#222222]/20 bg-[#222222] text-white shadow-sm'
      : 'border-transparent text-slate-600 hover:text-[#222222] hover:bg-slate-50',
  ].join(' ');
}

export const AccountCenterLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const pathNorm =
    location.pathname.replace(/^\/app(?=\/|$)/, '') || '/';
  const user = getStoredUser();
  const role = String(user?.role || '').toLowerCase();
  const isOwnerLike =
    role === 'owner' || role === 'admin' || role === 'superadmin';
  const isManagerLike =
    isOwnerLike || role === 'manager';

  const main = [
    { to: `${BASE}/overview`, end: true, label: t('crm.account.nav.overview') },
    { to: `${BASE}/personal`, end: false, label: t('crm.account.nav.personal') },
    { to: `${BASE}/security`, end: false, label: t('crm.account.nav.security') },
    { to: `${BASE}/preferences`, end: false, label: t('crm.account.nav.preferences') },
  ];

  // Настройки компании видны только owner/admin/manager
  // Права доступа — только owner/admin
  const workspace = [
    ...(isManagerLike
      ? [
          { to: '/app/settings', norm: '/settings', label: t('crm.account.nav.company') },
          { to: '/app/settings/api', norm: '/settings/api', label: t('crm.account.nav.api') },
          { to: '/app/billing', norm: '/billing', label: t('crm.account.nav.billing') },
          { to: '/app/staff', norm: '/staff', label: t('crm.account.nav.staff') },
        ]
      : []),
    ...(isOwnerLike
      ? [
          {
            to: '/app/staff/permissions',
            norm: '/staff/permissions',
            label: t('crm.account.nav.permissions'),
          },
        ]
      : []),
  ];

  return (
    <MainLayout>
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#222222]/55">
            {t('crm.account.kicker')}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {t('crm.account.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
            {t('crm.account.subtitle')}
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside className="w-full lg:w-60 shrink-0 space-y-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2 px-1">
                {t('crm.account.nav.groupAccount')}
              </div>
              <nav className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                {main.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => navClass(isActive)}
                  >
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2 px-1">
                {t('crm.account.nav.groupWorkspace')}
              </div>
              <nav className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                {workspace.map((item) => {
                  const active =
                    pathNorm === item.norm || pathNorm.startsWith(`${item.norm}/`);
                  return (
                    <Link key={item.to} to={item.to} className={navClass(active)}>
                      <span className="truncate">{item.label}</span>
                      <span className="ml-auto text-[11px] opacity-60">↗</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="flex-1 min-w-0 w-full rounded-2xl border border-slate-200 bg-white p-5 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
            <Outlet />
          </section>
        </div>
      </div>
    </MainLayout>
  );
};
