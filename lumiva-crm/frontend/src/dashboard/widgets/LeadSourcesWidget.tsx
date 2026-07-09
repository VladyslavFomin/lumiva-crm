// src/dashboard/widgets/LeadSourcesWidget.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getLeadSourcesWeekly, type LeadSourceItem } from '../../api/dashboardWidgets';

const COLORS = [
  '#222222',
  '#4B4B4B',
  '#737373',
  '#A0A0A0',
  '#C5C5C5',
  '#E0E0E0',
];

export const LeadSourcesWidget: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<LeadSourceItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getLeadSourcesWeekly()
      .then((res) => { if (alive) setData(res.sources); })
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
        {t('crm.dashboard.widgets.leadSourcesWeekEmpty', { defaultValue: 'No lead sources data' })}
      </div>
    );
  }

  const total = data.reduce((s, r) => s + r.count, 0);
  const chartData = data.slice(0, 6).map((r) => ({ name: r.source, value: r.count }));

  return (
    <div className="flex gap-3 h-full">
      {/* Donut chart */}
      <div className="w-[110px] shrink-0">
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={50}
              dataKey="value"
              strokeWidth={1}
              stroke="#fff"
            >
              {chartData.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                '',
              ]}
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid #e5e5e5',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col gap-1.5 justify-center min-w-0">
        {data.slice(0, 6).map((row, idx) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.source} className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: COLORS[idx % COLORS.length] }}
              />
              <span className="text-[11.5px] text-[#222] truncate flex-1">{row.source}</span>
              <span className="font-mono text-[10px] text-neutral-400 shrink-0">
                {row.count} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
