import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountrySelect } from '../CountrySelect';
import { DateInput } from '../../../components/ui/DateInput';
import { fmtDate, money } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { GuestBadges, RevenueText, useLoc } from './GuestShared';
import {
  anonymizeGuestProfile,
  fetchGuestProfile,
  mergeGuestProfiles,
  updateGuestProfile,
  HOTEL_GUEST_PREFERENCES,
  type HotelGuestProfileFull,
  type HotelGuestProfileInput,
} from '../../../api/hotels';
import '../hotels-design.css';

type Draft = Required<Pick<HotelGuestProfileInput, 'fullName' | 'email' | 'phone' | 'country' | 'language' | 'birthDate' | 'gender' | 'documentType' | 'documentNumber' | 'documentExpiry' | 'vip' | 'blacklisted' | 'blacklistReason' | 'preferences' | 'allergies' | 'notes' | 'marketingConsent'>>;
const toDraft = (p: HotelGuestProfileFull): Draft => ({
  fullName: p.fullName, email: p.email, phone: p.phone, country: p.country, language: p.language, birthDate: p.birthDate, gender: p.gender,
  documentType: p.documentType, documentNumber: p.documentNumber, documentExpiry: p.documentExpiry, vip: p.vip, blacklisted: p.blacklisted,
  blacklistReason: p.blacklistReason, preferences: p.preferences || [], allergies: p.allergies, notes: p.notes, marketingConsent: p.marketingConsent,
});
const LANGS = ['ru', 'en', 'tr', 'de', 'uk', 'ar', 'fr', 'es', 'it', 'pl', 'nl'];

/** Карточка гостя: данные и предпочтения (правка), статистика, история проживаний, возможные дубли, анонимизация */
export const HotelGuestProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guests.${key}`, o);
  const loc = useLoc();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [p, setP] = useState<HotelGuestProfileFull | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetchGuestProfile(id).then((x) => { setP(x); setD(toDraft(x)); }).catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || !d) return <MainLayout><div className="px-scope"><HotelsSubnav active="guests" /></div></MainLayout>;

  const set = (x: Partial<Draft>) => setD({ ...d, ...x });
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(p));
  const anonymized = !!p.anonymizedAt;
  const errors = [
    !d.fullName?.trim() && k('err.name'),
    d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) && k('err.email'),
    d.blacklisted && !d.blacklistReason?.trim() && k('err.blacklistReason'),
  ].filter(Boolean) as string[];
  const save = () => {
    setBusy(true);
    updateGuestProfile(p.id, { ...d, email: d.email?.trim() || null, phone: d.phone?.trim() || null })
      .then(() => { showAlert(k('saved'), { variant: 'success' }); return load(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const togglePref = (x: string) => set({ preferences: d.preferences.includes(x) ? d.preferences.filter((y) => y !== x) : [...d.preferences, x] });

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="guests" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" /><button type="button" className="lnk" onClick={() => navigate('/hotels/guests')}>{k('title')}</button></div>
            <h1 className="gp-h1">{p.fullName} <GuestBadges g={{ vip: p.vip, blacklisted: p.blacklisted, stats: p.stats }} /></h1>
            <p className="sub">{anonymized ? k('anonymizedNote', { date: fmtDate(p.anonymizedAt, loc) }) : k('since', { date: fmtDate(p.createdAt, loc) })}</p>
          </div>
          <div className="htl-hero-r">
            {!anonymized && (
              <button className="btn btn-danger" disabled={busy} onClick={async () => {
                if (!(await showConfirm(k('anonymizeBody'), { title: k('anonymize'), confirmLabel: k('anonymize'), danger: true }))) return;
                anonymizeGuestProfile(p.id).then(() => { showAlert(k('anonymized'), { variant: 'success' }); load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
              }}>{k('anonymize')}</button>
            )}
            {!anonymized && <button className="btn btn-primary" disabled={!dirty || busy || errors.length > 0} onClick={save}><Ic d={HTL_ICON.check} size={14} />{k('save')}</button>}
          </div>
        </div>

        {p.blacklisted && <div className="pe-box warn gp-black">{k('blacklistBanner', { reason: p.blacklistReason || '—' })}</div>}
        {errors.length > 0 && dirty && <div className="pe-box warn">{errors.map((x) => <div key={x}>{x}</div>)}</div>}

        <div className="htl-cols">
          <div className="htl-col-main">
            <div className="htl-panel">
              <h3 className="htl-h3">{k('secContacts')}</h3>
              <fieldset disabled={anonymized} className="gp-fs">
                <div className="htl-form" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
                  <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.fullName')}</label><input value={d.fullName || ''} onChange={(e) => set({ fullName: e.target.value })} /></div>
                  <div className="htl-f"><label>{k('f.language')}</label>
                    <select value={d.language || ''} onChange={(e) => set({ language: e.target.value || null })}>
                      <option value="">—</option>
                      {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="htl-f"><label>Email</label><input value={d.email || ''} onChange={(e) => set({ email: e.target.value })} /></div>
                  <div className="htl-f"><label>{k('f.phone')}</label><input value={d.phone || ''} onChange={(e) => set({ phone: e.target.value })} /></div>
                  <div className="htl-f"><label>{k('f.country')}</label><CountrySelect value={d.country} onChange={(c) => set({ country: c })} /></div>
                  <div className="htl-f"><label>{k('f.birthDate')}</label><DateInput value={d.birthDate || ''} onChange={(v) => set({ birthDate: v || null })} /></div>
                  <div className="htl-f"><label>{k('f.gender')}</label>
                    <div className="htl-seg">
                      {(['M', 'F'] as const).map((x) => <button key={x} type="button" className={d.gender === x ? 'on' : ''} onClick={() => set({ gender: d.gender === x ? null : x })}>{k(`gender.${x}`)}</button>)}
                    </div>
                  </div>
                  <label className="rtp-check gp-consent"><input type="checkbox" checked={d.marketingConsent} onChange={(e) => set({ marketingConsent: e.target.checked })} />{k('f.marketingConsent')}</label>
                </div>
              </fieldset>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('secDocument')}</h3>
              <fieldset disabled={anonymized} className="gp-fs">
                <div className="htl-form" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
                  <div className="htl-f"><label>{k('f.documentType')}</label>
                    <select value={d.documentType || ''} onChange={(e) => set({ documentType: (e.target.value || null) as Draft['documentType'] })}>
                      <option value="">—</option>
                      {(['passport', 'id_card', 'other'] as const).map((x) => <option key={x} value={x}>{k(`doc.${x}`)}</option>)}
                    </select>
                  </div>
                  <div className="htl-f"><label>{k('f.documentNumber')}</label><input className="mono" value={d.documentNumber || ''} onChange={(e) => set({ documentNumber: e.target.value })} /></div>
                  <div className="htl-f"><label>{k('f.documentExpiry')}</label><DateInput value={d.documentExpiry || ''} onChange={(v) => set({ documentExpiry: v || null })} /></div>
                </div>
                {d.documentExpiry && p.stats.nextStay && d.documentExpiry < p.stats.nextStay && <div className="pe-box warn" style={{ marginTop: 10 }}>{k('docExpires')}</div>}
              </fieldset>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('secPreferences')}</h3>
              <fieldset disabled={anonymized} className="gp-fs">
                <div className="rtp-chips">
                  {HOTEL_GUEST_PREFERENCES.map((x) => <button key={x} type="button" className={`rtp-chip${d.preferences.includes(x) ? ' on' : ''}`} onClick={() => togglePref(x)}>{k(`pref.${x}`)}</button>)}
                </div>
                <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 12 }}>
                  <div className="htl-f"><label>{k('f.allergies')}</label><input value={d.allergies || ''} onChange={(e) => set({ allergies: e.target.value })} placeholder={k('f.allergiesPh')} /></div>
                  <div className="htl-f" />
                  <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.notes')}</label><textarea rows={3} value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder={k('f.notesPh')} /></div>
                </div>
              </fieldset>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('secStatus')}</h3>
              <fieldset disabled={anonymized} className="gp-fs">
                <label className="rtp-check"><input type="checkbox" checked={d.vip} onChange={(e) => set({ vip: e.target.checked })} />{k('f.vip')}</label>
                <label className="rtp-check" style={{ marginTop: 8 }}><input type="checkbox" checked={d.blacklisted} onChange={(e) => set({ blacklisted: e.target.checked })} />{k('f.blacklisted')}</label>
                {d.blacklisted && <div className="htl-f" style={{ marginTop: 8 }}><label>{k('f.blacklistReason')} *</label><input value={d.blacklistReason || ''} onChange={(e) => set({ blacklistReason: e.target.value })} /></div>}
              </fieldset>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('secStays', { count: p.stays.length })}</h3>
              {!p.stays.length ? <p className="htl-sub">{k('noStays')}</p> : (
                <div className="bk-table-wrap">
                  <table className="bk-table">
                    <thead><tr><th>{k('col.dates')}</th><th>{k('col.hotel')}</th><th>{k('col.room')}</th><th>{k('col.status')}</th><th>{k('col.role')}</th><th className="num">{k('col.total')}</th></tr></thead>
                    <tbody>
                      {p.stays.map((s) => (
                        <tr key={s.id} className="clickable" onClick={() => navigate(`/hotels/reservations?reservation=${s.id}`)}>
                          <td className="mono">{fmtDate(s.checkIn, loc)} – {fmtDate(s.checkOut, loc)}</td>
                          <td>{s.hotelName}</td>
                          <td>{s.roomTypeName}{s.roomNumber ? <div className="htl-sub">№ {s.roomNumber}</div> : null}</td>
                          <td><span className={`gp-status s-${s.status}`}>{t(`crm.hotels.reservations.status.${s.status}`)}</span></td>
                          <td className="htl-sub">{s.isContact ? k('roleContact') : k('roleGuest', { name: s.guestName })}</td>
                          <td className="num mono">{money(Number(s.total), s.currency, loc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="htl-col-side">
            <div className="htl-panel gp-stats">
              <h3 className="htl-h3">{k('secStats')}</h3>
              <div><span>{k('st.stays')}</span><b>{p.stats.stays}</b></div>
              <div><span>{k('st.nights')}</span><b>{p.stats.nights}</b></div>
              <div><span>{k('st.revenue')}</span><b><RevenueText revenue={p.stats.revenue} /></b></div>
              <div><span>{k('st.adr')}</span><b>{p.stats.nights ? <RevenueText revenue={Object.fromEntries(Object.entries(p.stats.revenue).map(([c, v]) => [c, v / p.stats.nights]))} /> : '—'}</b></div>
              <div><span>{k('st.last')}</span><b>{p.stats.lastStay ? fmtDate(p.stats.lastStay, loc) : '—'}</b></div>
              <div><span>{k('st.next')}</span><b>{p.stats.nextStay ? fmtDate(p.stats.nextStay, loc) : '—'}</b></div>
              <div><span>{k('st.cancelled')}</span><b>{p.stats.cancelled}</b></div>
            </div>
            {!!p.duplicates.length && (
              <div className="htl-panel">
                <h3 className="htl-h3">{k('secDuplicates')}</h3>
                <p className="htl-sub">{k('dupHint')}</p>
                {p.duplicates.map((x) => (
                  <div key={x.id} className="gp-dupline">
                    <div>
                      <button type="button" className="lnk" onClick={() => navigate(`/hotels/guests/${x.id}`)}>{x.fullName}</button>
                      <div className="htl-sub">{k(`reason.${x.reason}`)} · {[x.email, x.phone, x.documentNumber].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    <button className="btn btn-sm" disabled={busy || anonymized} onClick={async () => {
                      if (!(await showConfirm(k('mergeBody', { name: p.fullName, count: 1 }), { title: k('merge'), confirmLabel: k('merge') }))) return;
                      setBusy(true);
                      mergeGuestProfiles(p.id, [x.id]).then(() => { showAlert(k('merged'), { variant: 'success' }); return load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' })).finally(() => setBusy(false));
                    }}>{k('mergeHere')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
