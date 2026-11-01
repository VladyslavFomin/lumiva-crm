import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGuestBrief, lookupGuestProfiles, type HotelGuestBrief, type HotelGuestProfile } from '../../../api/hotels';
import { GuestBadges, GuestPreferences } from './GuestShared';

/**
 * Поле «Гость» в форме брони: пока профиль не выбран — подсказки по имени / email / телефону из базы гостей;
 * выбран — плашка профиля (VIP, сколько раз жил, предпочтения), чёрный список — предупреждением.
 */
export const GuestLookupField: React.FC<{
  name: string;
  onName: (v: string) => void;
  /** email / телефон из формы — тоже ищем по ним */
  email: string;
  phone: string;
  profileId: string | null;
  onPick: (p: HotelGuestProfile) => void;
  onUnlink: () => void;
}> = ({ name, onName, email, phone, profileId, onPick, onUnlink }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const [hits, setHits] = useState<HotelGuestProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<HotelGuestBrief | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileId) { setBrief(null); return; }
    fetchGuestBrief(profileId).then(setBrief).catch(() => setBrief(null));
  }, [profileId]);

  // ищем по последнему изменённому: имя (3+ символа), email, телефон
  const q = [email.includes('@') ? email : '', phone.replace(/\D/g, '').length >= 7 ? phone : '', name.trim().length >= 3 ? name : ''].find(Boolean) || '';
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (profileId || !q) { setHits([]); return; }
    timer.current = window.setTimeout(() => {
      lookupGuestProfiles(q).then((x) => setHits(x.filter((p) => !p.anonymizedAt))).catch(() => setHits([]));
    }, 300);
    return () => window.clearTimeout(timer.current);
  }, [q, profileId]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="gp-lookup" ref={box}>
      <input value={name} onChange={(e) => { onName(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {!profileId && open && hits.length > 0 && (
        <div className="gp-hits" role="listbox">
          <div className="gp-hits-head">{k('lookupFound', { count: hits.length })}</div>
          {hits.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => { onPick(p); setOpen(false); }}>
              <span className="gp-name"><b>{p.fullName}</b><GuestBadges g={p} compact /></span>
              <span className="htl-sub">{[p.email, p.phone, p.documentNumber].filter(Boolean).join(' · ') || '—'}</span>
            </button>
          ))}
        </div>
      )}
      {profileId && brief && (
        <div className={`gp-linked${brief.blacklisted ? ' black' : ''}`}>
          <div className="gp-linked-row">
            <span className="gp-name"><a href={`/hotels/guests/${brief.id}`} target="_blank" rel="noreferrer">{brief.fullName}</a><GuestBadges g={brief} /></span>
            <button type="button" className="lnk" onClick={onUnlink}>{k('unlink')}</button>
          </div>
          {brief.blacklisted && <div className="gp-linked-warn">{k('blacklistWarn', { reason: brief.blacklistReason || '—' })}</div>}
          <GuestPreferences list={brief.preferences} allergies={brief.allergies} />
          {brief.notes && <div className="htl-sub">{brief.notes}</div>}
        </div>
      )}
    </div>
  );
};

/** Сводка профиля гостя в карточке брони */
export const GuestBriefCard: React.FC<{ profileId: string | null | undefined }> = ({ profileId }) => {
  const { t } = useTranslation();
  const [brief, setBrief] = useState<HotelGuestBrief | null>(null);
  useEffect(() => {
    if (!profileId) { setBrief(null); return; }
    fetchGuestBrief(profileId).then(setBrief).catch(() => setBrief(null));
  }, [profileId]);
  if (!brief) return null;
  return (
    <div className={`gp-linked${brief.blacklisted ? ' black' : ''}`}>
      <div className="gp-linked-row">
        <span className="gp-name"><a href={`/hotels/guests/${brief.id}`}>{brief.fullName}</a><GuestBadges g={brief} /></span>
        <span className="htl-sub">{t('crm.hotels.guests.briefStays', { count: brief.stats?.stays ?? 0 })}</span>
      </div>
      {brief.blacklisted && <div className="gp-linked-warn">{t('crm.hotels.guests.blacklistWarn', { reason: brief.blacklistReason || '—' })}</div>}
      <GuestPreferences list={brief.preferences} allergies={brief.allergies} />
      {brief.notes && <div className="htl-sub">{brief.notes}</div>}
    </div>
  );
};
