// src/dashboard/widgets/HotelsReviewsWidget.tsx — репутация отелей по отзывам (Отели → Отзывы)
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchRepHotelsSummary, type RepHotelsSummary } from '../../api/hotelReputation';

export const HotelsReviewsWidget: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<RepHotelsSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchRepHotelsSummary()
      .then((res) => alive && setData(res))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <div className="text-[11px] text-neutral-400 italic py-2">{t('crm.common.loadError', { defaultValue: 'Failed to load' })}</div>;
  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-2 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-[68px] bg-neutral-100 rounded-2xl" />)}
      </div>
    );
  }
  const tile = (label: string, value: React.ReactNode, accent?: boolean) => (
    <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold tracking-[-0.03em] ${accent ? 'text-[#cc2f47]' : 'text-[#222]'}`}>{value}</div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {tile(t('crm.dashboard.hotelsReviewsWidget.avg'), data.totals.avg90 != null ? `${data.totals.avg90}` : '—')}
        {tile(t('crm.dashboard.hotelsReviewsWidget.week'), data.totals.n7)}
        {tile(t('crm.dashboard.hotelsReviewsWidget.openNeg'), data.totals.openNeg, data.totals.openNeg > 0)}
      </div>
      <div className="text-[11px] text-neutral-500">{t('crm.dashboard.hotelsReviewsWidget.hint', { n: data.totals.n90 })}</div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/hotels/reviews?reply=none" className="inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white text-[#222] text-[11px] font-semibold py-2.5 hover:border-[#222] transition-colors">{t('crm.dashboard.hotelsReviewsWidget.openUnanswered')}</Link>
        <Link to="/hotels/reviews/dashboard" className="inline-flex items-center justify-center rounded-2xl border border-[#222] bg-[#222] text-white text-[11px] font-semibold py-2.5 hover:bg-neutral-800 transition-colors">{t('crm.dashboard.hotelsReviewsWidget.openFull')}</Link>
      </div>
    </div>
  );
};
