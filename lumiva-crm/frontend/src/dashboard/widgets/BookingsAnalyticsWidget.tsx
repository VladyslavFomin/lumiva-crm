// src/dashboard/widgets/BookingsAnalyticsWidget.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchBookingAnalyticsSummary, type BookingAnalyticsSummary } from '../../api/bookings';

export const BookingsAnalyticsWidget: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [data, setData] = useState<BookingAnalyticsSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchBookingAnalyticsSummary()
      .then((res) => { if (alive) setData(res); })
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
      <div className="grid grid-cols-2 gap-2 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-[68px] bg-neutral-100 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.bookingsAnalyticsWidget.kpiReservations')}</div>
          <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{data.totalReservations}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.bookingsAnalyticsWidget.kpiOccupancy')}</div>
          <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{data.occupancyRate}%</div>
        </div>
      </div>
      <div className="text-[11px] text-neutral-500">
        {t('crm.dashboard.bookingsAnalyticsWidget.avgCheck')}: <span className="font-medium text-[#222]">{data.avgCheck.toLocaleString(locale)}</span>
      </div>
      <Link to="/bookings/analytics" className="inline-flex items-center justify-center w-full rounded-2xl border border-[#222] bg-[#222] text-white text-[11px] font-semibold py-2.5 hover:bg-neutral-800 transition-colors">{t('crm.dashboard.bookingsAnalyticsWidget.openFull')}</Link>
    </div>
  );
};
