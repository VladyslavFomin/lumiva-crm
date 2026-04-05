import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const DashboardQuickActions: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    { to: '/leads/new', labelKey: 'crm.dashboard.quickActions.newLead' },
    { to: '/leads/calendar', labelKey: 'crm.dashboard.quickActions.leadsCalendar' },
    { to: '/leads/board', labelKey: 'crm.dashboard.quickActions.leadsBoard' },
    { to: '/projects/board', labelKey: 'crm.dashboard.quickActions.projects' },
    { to: '/workspace', labelKey: 'crm.dashboard.quickActions.workspaces' },
  ] as const;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {items.map(({ to, labelKey }) => (
        <Link
          key={to}
          to={to}
          className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.03] transition hover:border-teal-300/80 hover:bg-teal-50/40 hover:text-teal-900"
        >
          {t(labelKey)}
        </Link>
      ))}
    </div>
  );
};
