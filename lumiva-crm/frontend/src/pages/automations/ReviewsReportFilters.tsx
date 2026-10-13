import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRepSetup, REP_PLATFORMS, type RepSetup } from '../../api/hotelReputation';
import { PLATFORM_META } from '../hotels/reputation/ReputationShared';

/** Фильтры отчёта «Отзывы» в действии «Отправить отчёт»: бренд, отель, площадка (пусто — все). */
export const ReviewsReportFilters: React.FC<{
  value: { brandId: string; hotelId: string; platform: string };
  onChange: (key: 'reviewsBrandId' | 'reviewsHotelId' | 'reviewsPlatform', v: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState<RepSetup | null>(null);
  useEffect(() => {
    fetchRepSetup().then(setSetup).catch(() => setSetup({ brands: [], hotels: [] }));
  }, []);
  const hotels = (setup?.hotels || []).filter((h) => !value.brandId || h.brandId === value.brandId);
  return (
    <>
      <div className="cfg-field">
        <label className="cfg-field-label">{t('crm.automations.form.report.reviews.brand')}</label>
        <select className="cfg-select" value={value.brandId} onChange={(e) => onChange('reviewsBrandId', e.target.value)}>
          <option value="">{t('crm.automations.form.report.reviews.all')}</option>
          {setup?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="cfg-field">
        <label className="cfg-field-label">{t('crm.automations.form.report.reviews.hotel')}</label>
        <select className="cfg-select" value={value.hotelId} onChange={(e) => onChange('reviewsHotelId', e.target.value)}>
          <option value="">{t('crm.automations.form.report.reviews.all')}</option>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="cfg-field">
        <label className="cfg-field-label">{t('crm.automations.form.report.reviews.platform')}</label>
        <select className="cfg-select" value={value.platform} onChange={(e) => onChange('reviewsPlatform', e.target.value)}>
          <option value="">{t('crm.automations.form.report.reviews.all')}</option>
          {REP_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
        </select>
      </div>
    </>
  );
};
