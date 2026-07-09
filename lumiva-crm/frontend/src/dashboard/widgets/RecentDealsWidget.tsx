// src/dashboard/widgets/RecentDealsWidget.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRecentSales, type RecentSaleItem } from '../../api/dashboardWidgets';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  new: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-rose-100 text-rose-700',
  refunded: 'bg-neutral-100 text-neutral-600',
  other: 'bg-neutral-100 text-neutral-600',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-neutral-100 text-neutral-600';
}

export const RecentDealsWidget: React.FC = () => {
  const { t } = useTranslation();
  const [sales, setSales] = useState<RecentSaleItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getRecentSales(7)
      .then((res) => { if (alive) setSales(res.sales); })
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

  if (sales === null) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-neutral-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-[12px] text-neutral-400 italic py-2">
        {t('crm.dashboard.widgets.recentDealsEmpty', { defaultValue: 'No deals yet' })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {sales.map((sale, i) => (
        <Link
          key={sale.id}
          to={`/sales/${sale.id}`}
          className="flex items-center gap-2 py-2 hover:bg-neutral-50 rounded-lg px-1 transition-colors group"
          style={{ borderBottom: i < sales.length - 1 ? '1px solid #f5f5f5' : 'none' }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#222] truncate group-hover:text-neutral-700">
              {sale.name || t('crm.dashboard.widgets.recentDealsFallbackName', { defaultValue: 'Sale' })}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {sale.createdAt
                ? new Date(sale.createdAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })
                : '—'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sale.amount != null && (
              <span className="font-mono text-[11px] font-medium text-[#222]">
                {sale.amount.toLocaleString()} {sale.currency || ''}
              </span>
            )}
            <span
              className={`text-[9.5px] font-semibold uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${statusColor(sale.status)}`}
            >
              {sale.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};
