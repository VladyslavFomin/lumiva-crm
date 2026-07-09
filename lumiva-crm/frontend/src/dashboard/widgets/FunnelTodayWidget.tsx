// src/dashboard/widgets/FunnelTodayWidget.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunnelToday, type FunnelStatusItem } from '../../api/dashboardWidgets';

export const FunnelTodayWidget: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<FunnelStatusItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getFunnelToday()
      .then((res) => { if (alive) setData(res.statuses); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <div className="text-[11px] text-neutral-400 italic py-2">
        {t('crm.common.loadError', { defaultValue: 'Failed to load' })}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 bg-neutral-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-[12px] text-neutral-400 italic py-2">
        {t('crm.dashboard.widgets.funnelTodayEmpty', { defaultValue: 'No leads today' })}
      </div>
    );
  }

  const total = data.reduce((s, r) => s + r.count, 0);
  const maxCount = Math.max(...data.map((r) => r.count), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((row) => {
        const pct = Math.round((row.count / maxCount) * 100);
        const barPct = Math.max(8, pct);
        return (
          <div key={row.status} className="flex items-center gap-2">
            <div className="w-[120px] shrink-0 text-[11.5px] text-[#222] truncate font-medium">
              {row.status}
            </div>
            <div className="flex-1 h-[7px] bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#222] rounded-full transition-all duration-500"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="w-8 text-right font-mono text-[11px] text-neutral-500 shrink-0">
              {row.count}
            </div>
          </div>
        );
      })}
      <div className="mt-1 text-[10px] text-neutral-400 font-mono uppercase tracking-[0.1em]">
        {t('crm.dashboard.widgets.funnelTodayTotal', {
          defaultValue: 'Total: {{count}}',
          count: total,
        })}
      </div>
    </div>
  );
};
