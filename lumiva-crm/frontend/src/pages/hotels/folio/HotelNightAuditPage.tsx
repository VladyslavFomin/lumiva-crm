import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { ApiError } from '../../../api/client';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { fmtDate, money } from '../partners/partnerUtils';
import {
  downloadAuthed,
  fetchHotels,
  fetchNightAuditStatus,
  runNightAudit,
  saveNightAuditSettings,
  sendNightAuditReport,
  type Hotel,
  type HotelAuditBrief,
  type HotelNightAuditStatus,
} from '../../../api/hotels';
import '../hotels-design.css';

const TZ = ['Europe/Istanbul', 'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'Asia/Almaty', 'Asia/Tbilisi'];

export const HotelNightAuditPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.audit.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr' : i18n.language?.startsWith('en') ? 'en' : 'ru';
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU';
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [st, setSt] = useState<HotelNightAuditStatus | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [opts, setOpts] = useState({ autoNoShow: false, noShowFee: 'none' as 'none' | 'first_night', ignoreDepartures: false, ignoreOpenShift: false });
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<HotelNightAuditStatus['settings'] | null>(null);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';

  useEffect(() => { fetchHotels().then(setHotels).catch((e) => setFailed(e.message)); }, []);
  const load = useCallback(() => {
    if (!hotelId) return Promise.resolve();
    return fetchNightAuditStatus(hotelId).then((s) => { setSt(s); setSettings(s.settings); setFailed(null); }).catch((e) => setFailed(e.message));
  }, [hotelId]);
  useEffect(() => { setSt(null); void load(); }, [load]);

  const run = async () => {
    if (!st) return;
    const ok = await showConfirm(k('runConfirm', { date: fmtDate(st.auditDate, loc) }), { title: k('runTitle'), confirmLabel: k('run'), cancelLabel: t('crm.hotels.common.cancel') });
    if (!ok) return;
    setBusy(true);
    try {
      await runNightAudit({ hotelId, ...opts });
      showAlert(k('done', { date: fmtDate(st.auditDate, loc) }), { variant: 'success' });
      setOpts({ autoNoShow: false, noShowFee: 'none', ignoreDepartures: false, ignoreOpenShift: false });
    } catch (e) {
      const err = e as ApiError;
      showAlert(hotelErrorText(t, e, k('runError')) + (err?.payload?.list?.length ? `: ${err.payload.list.map((x: HotelAuditBrief) => x.guestName).join(', ')}` : ''), { variant: 'error' });
    } finally {
      setBusy(false);
      void load();
    }
  };
  const saveSettings = () => {
    if (!settings) return;
    saveNightAuditSettings({ hotelId, ...settings }).then((s) => { setSt(s); setSettings(s.settings); showAlert(k('settingsSaved'), { variant: 'success' }); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  };
  const list = (rows: HotelAuditBrief[], extra?: (r: HotelAuditBrief) => React.ReactNode) => (
    <ul className="na-list">
      {rows.map((r) => (
        <li key={r.id}>
          <a href={`/hotels/reservations?reservation=${r.id}`} onClick={(e) => { e.preventDefault(); navigate(`/hotels/reservations?reservation=${r.id}`); }}>{r.guestName}</a>
          <span>{fmtDate(r.checkIn, loc)} – {fmtDate(r.checkOut, loc)}{r.bookingCode ? ` · ${r.bookingCode}` : ''}</span>
          {extra?.(r)}
        </li>
      ))}
    </ul>
  );
  const cur = settings?.currency;

  return (
    <MainLayout>
      <PageHelpButton topic="hotelNightAudit" />
      <div className="px-scope">
        <HotelsSubnav active="nightAudit" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{st ? k('kicker', { date: fmtDate(st.auditDate, loc) }) : k('title')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        {failed ? <div className="htl-empty"><h4>{k('loadError')}</h4><p>{failed}</p></div> : !st ? (
          <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div>
        ) : (
          <div className="na-grid">
            <div className="htl-panel">
              <div className="na-day">
                <span>{k('openDay')}</span>
                <b>{fmtDate(st.auditDate, loc)}</b>
                <em>{st.lastAuditDate ? k('lastClosed', { date: fmtDate(st.lastAuditDate, loc) }) : k('neverRun')}</em>
              </div>
              {!st.canRun && <div className="htl-life-hint"><div>{k('notYet')}</div></div>}
              <div className="na-checks">
                <div className={`chk ${st.checks.pendingArrivals.length ? 'bad' : 'ok'}`}>
                  <b>{k('checks.arrivals', { count: st.checks.pendingArrivals.length })}</b>
                  {st.checks.pendingArrivals.length > 0 && list(st.checks.pendingArrivals)}
                  {st.checks.pendingArrivals.length > 0 && (
                    <div className="opt">
                      <label className="hk-check inline"><input type="checkbox" checked={opts.autoNoShow} onChange={(e) => setOpts({ ...opts, autoNoShow: e.target.checked })} /><span>{k('autoNoShow')}</span></label>
                      {opts.autoNoShow && (
                        <div className="htl-seg">
                          <button type="button" className={opts.noShowFee === 'none' ? 'on' : ''} onClick={() => setOpts({ ...opts, noShowFee: 'none' })}>{k('noFee')}</button>
                          <button type="button" className={opts.noShowFee === 'first_night' ? 'on' : ''} onClick={() => setOpts({ ...opts, noShowFee: 'first_night' })}>{k('firstNight')}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={`chk ${st.checks.pendingDepartures.length ? 'bad' : 'ok'}`}>
                  <b>{k('checks.departures', { count: st.checks.pendingDepartures.length })}</b>
                  {st.checks.pendingDepartures.length > 0 && list(st.checks.pendingDepartures)}
                  {st.checks.pendingDepartures.length > 0 && (
                    <div className="opt"><label className="hk-check inline"><input type="checkbox" checked={opts.ignoreDepartures} onChange={(e) => setOpts({ ...opts, ignoreDepartures: e.target.checked })} /><span>{k('ignoreDepartures')}</span></label></div>
                  )}
                </div>
                <div className={`chk ${st.checks.unpaidDepartures.length ? 'warn' : 'ok'}`}>
                  <b>{k('checks.unpaid', { count: st.checks.unpaidDepartures.length })}</b>
                  {st.checks.unpaidDepartures.length > 0 && list(st.checks.unpaidDepartures, (r) => <strong>{money(r.balance || 0, cur, loc)}</strong>)}
                </div>
                <div className={`chk ${st.checks.openShift ? 'bad' : 'ok'}`}>
                  <b>{st.checks.openShift ? k('checks.shiftOpen') : k('checks.shiftClosed')}</b>
                  {st.checks.openShift && (
                    <div className="opt">
                      <button className="btn btn-sm" onClick={() => navigate(`/hotels/cashier?hotelId=${hotelId}`)}>{k('toCashier')}</button>
                      <label className="hk-check inline"><input type="checkbox" checked={opts.ignoreOpenShift} onChange={(e) => setOpts({ ...opts, ignoreOpenShift: e.target.checked })} /><span>{k('ignoreShift')}</span></label>
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy || !st.canRun} onClick={() => void run()}>
                <Ic d={HTL_ICON.check} size={14} />{k('run')}
              </button>
              <p className="htl-fd-note" style={{ marginTop: 8 }}>{k('runHint')}</p>
            </div>

            {settings && (
              <div className="htl-panel">
                <div className="htl-folio-sec" style={{ marginTop: 0 }}>{k('settings')}</div>
                <label className="hk-check"><input type="checkbox" checked={settings.nightAuditAuto} onChange={(e) => setSettings({ ...settings, nightAuditAuto: e.target.checked })} /><span><b>{k('auto')}</b><em>{k('autoHint')}</em></span></label>
                <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 10 }}>
                  <div className="htl-f"><label>{k('time')}</label><input type="time" value={settings.nightAuditTime} onChange={(e) => setSettings({ ...settings, nightAuditTime: e.target.value })} /></div>
                  <div className="htl-f"><label>{k('timezone')}</label>
                    <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                      {[...new Set([settings.timezone, ...TZ])].map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('emails')}</label><input value={settings.nightAuditEmails} placeholder="gm@hotel.com, finance@hotel.com" onChange={(e) => setSettings({ ...settings, nightAuditEmails: e.target.value })} /><div className="htl-hint">{k('emailsHint')}</div></div>
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={saveSettings}>{t('crm.hotels.common.save')}</button>
              </div>
            )}

            <div className="htl-panel na-history">
              <div className="htl-folio-sec" style={{ marginTop: 0 }}>{k('history')}</div>
              {!st.history.length ? <div className="htl-sub">{k('noHistory')}</div> : (
                <div className="bk-table-wrap">
                  <table className="bk-table">
                    <thead><tr><th>{k('col.day')}</th><th>{k('col.occ')}</th><th>ADR</th><th>RevPAR</th><th>{k('col.revenue')}</th><th>{k('col.moves')}</th><th>{k('col.payments')}</th><th /></tr></thead>
                    <tbody>
                      {st.history.map((a) => {
                        const s = a.snapshot;
                        return (
                          <tr key={a.id}>
                            <td><b>{fmtDate(a.businessDate, loc)}</b><div className="htl-sub">{a.mode === 'auto' ? k('modeAuto') : k('modeManual')}{a.reportSentAt ? ` · ${k('sent')}` : ''}</div></td>
                            <td>{s.occupancyPct}%<div className="htl-sub">{s.sold}/{s.available}{s.comp ? ` · ${k('compShort', { n: s.comp })}` : ''}</div></td>
                            <td>{money(s.adr, s.currency, loc)}</td>
                            <td>{money(s.revpar, s.currency, loc)}</td>
                            <td><b>{money(s.totalRevenue, s.currency, loc)}</b><div className="htl-sub">{k('revSplit', { room: money(s.roomRevenue, s.currency, loc), extras: money(s.extrasRevenue, s.currency, loc) })}</div></td>
                            <td className="htl-sub">{k('movesLine', { arr: s.arrivals, dep: s.departures, noShows: s.noShows })}</td>
                            <td>{money(s.paymentsTotal, s.currency, loc)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="htl-fd-acts">
                                <button className="btn btn-sm" onClick={() => downloadAuthed(`/hotels/night-audit/audits/${a.id}/report.pdf?lang=${lang}`, `night-audit-${a.businessDate}.pdf`).catch(() => showAlert(k('saveError'), { variant: 'error' }))}><Ic d={HTL_ICON.download} size={12} />PDF</button>
                                <button className="btn btn-sm" onClick={() => sendNightAuditReport(a.id).then((r) => { showAlert(r.sent ? k('sentOk') : k('noRecipients'), { variant: r.sent ? 'success' : 'error' }); void load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))}>{k('send')}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
