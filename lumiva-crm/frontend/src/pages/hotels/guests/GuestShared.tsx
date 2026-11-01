import React from 'react';
import { useTranslation } from 'react-i18next';
import { money } from '../partners/partnerUtils';
import type { HotelGuestBrief, HotelGuestStats } from '../../../api/hotels';

export const useLoc = () => {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
};

/** Выручка по валютам отелей: «1 200 € · 45 000 ₺» (суммы в разных валютах не складываем) */
export const RevenueText: React.FC<{ revenue: Record<string, number> | null | undefined }> = ({ revenue }) => {
  const loc = useLoc();
  const parts = Object.entries(revenue || {}).filter(([, v]) => v > 0);
  if (!parts.length) return <>—</>;
  return <>{parts.map(([cur, v]) => money(v, cur && cur !== '—' ? cur : null, loc)).join(' · ')}</>;
};

/** Метки гостя: VIP, чёрный список, «N-й раз» */
export const GuestBadges: React.FC<{ g: Pick<HotelGuestBrief, 'vip' | 'blacklisted'> & { stays?: number; stats?: HotelGuestStats }; compact?: boolean }> = ({ g, compact }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const stays = g.stays ?? g.stats?.stays ?? 0;
  return (
    <span className="gp-badges">
      {g.blacklisted && <span className="gp-badge black">{k('badge.blacklist')}</span>}
      {g.vip && <span className="gp-badge vip">VIP</span>}
      {stays >= 1 && <span className="gp-badge repeat" title={k('badge.repeatTitle', { count: stays })}>{compact ? `×${stays}` : k('badge.repeat', { count: stays })}</span>}
    </span>
  );
};

/** Предпочтения гостя чипами */
export const GuestPreferences: React.FC<{ list: string[] | null | undefined; allergies?: string | null }> = ({ list, allergies }) => {
  const { t } = useTranslation();
  if (!list?.length && !allergies) return null;
  return (
    <span className="gp-prefs">
      {(list || []).map((p) => <span key={p}>{t(`crm.hotels.guests.pref.${p}`)}</span>)}
      {allergies && <span className="warn">{t('crm.hotels.guests.allergiesShort', { text: allergies })}</span>}
    </span>
  );
};
