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
        className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-center text-[11px] font-semibold text-[#222] shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:border-[#222] hover:bg-neutral-50"
        >
          {t(labelKey)}
        </Link>
      ))}
    </div>
  );
};
