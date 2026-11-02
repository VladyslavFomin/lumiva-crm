import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { fmtDate, money } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  decideUpsell,
  fetchExtras,
  fetchHotels,
  fetchPrecheckins,
  fetchUpsellRequests,
  precheckinLink,
  precheckinSend,
  savePrecheckinSettings,
  updateExtra,
  type Hotel,
  type HotelExtraService,
  type HotelPrecheckinRow,
  type HotelUpsellRequest,
  installJourneyPresets,
  type HotelPrecheckinAuto,
} from '../../../api/hotels';
import '../hotels-design.css';

type Tab = 'arrivals' | 'requests' | 'settings';

/** Онлайн-регистрация до заезда и допродажи: кто заполнил, ссылки гостям, заявки на апгрейд / услуги, настройки */
export const HotelPrecheckinPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.precheckin.${key}`, o);
  const loc = useLoc();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [tab, setTab] = useState<Tab>('arrivals');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPrecheckins>> | null>(null);
  const [reqs, setReqs] = useState<HotelUpsellRequest[]>([]);
  const [reqStatus, setReqStatus] = useState('requested');
  const [busy, setBusy] = useState<string | null>(null);
  const hotel = hotels.find((h) => h.id === hotelId);
  const cur = (hotel?.currency || '').toUpperCase();
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });

  useEffect(() => { fetchHotels().then((h) => { setHotels(h); if (h[0]) setHotelId(h[0].id); }).catch(err); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    if (!hotelId) return;
    fetchPrecheckins({ hotelId }).then(setData).catch(err);
    fetchUpsellRequests({ hotelId, status: reqStatus || undefined }).then(setReqs).catch(err);
  };
  useEffect(load, [hotelId, reqStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (r: HotelPrecheckinRow) => {
    setBusy(r.reservationId);
    try {
      const l = await precheckinLink(r.reservationId);
      try { await navigator.clipboard.writeText(l.url); showAlert(k('copied'), { variant: 'success' }); } catch { window.prompt(k('copyPrompt'), l.url); }
      load();
    } catch (e) { err(e); } finally { setBusy(null); }
  };
  const send = async (r: HotelPrecheckinRow) => {
    setBusy(r.reservationId);
    try { const x = await precheckinSend(r.reservationId); showAlert(k('sent', { email: x.sentTo }), { variant: 'success' }); load(); } catch (e) { err(e); } finally { setBusy(null); }
  };
  const decide = async (q: HotelUpsellRequest, approve: boolean) => {
    setBusy(q.id);
    try { await decideUpsell(q.id, approve); showAlert(approve ? k('approved') : k('declined'), { variant: 'success' }); load(); } catch (e) { err(e); } finally { setBusy(null); }
  };
  const items = data?.items || [];
  const done = items.filter((x) => x.status === 'completed').length;
  const pending = reqs.filter((q) => q.status === 'requested');

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="precheckin" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <select className="htl-select" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </div>
        </div>

        <div className="htl-kpis">
          <div className="htl-kpi"><div className="l">{k('kpi.arrivals')}</div><div className="v">{items.length}</div><div className="d">{data ? `${fmtDate(data.from, loc)} – ${fmtDate(data.to, loc)}` : ''}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.done')}</div><div className="v">{items.length ? `${Math.round((done / items.length) * 100)}%` : '—'}</div><div className="d">{k('kpi.doneOf', { done, total: items.length })}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.requests')}</div><div className="v">{tab === 'requests' && reqStatus === 'requested' ? pending.length : items.reduce((s, x) => s + x.upsells.requested, 0)}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.auto')}</div><div className="v">{data?.auto?.active ? k('daysBefore', { count: data.auto.offsetDays }) : k('off')}</div></div>
        </div>

        <div className="htl-toolbar">
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['arrivals', 'requests', 'settings'] as Tab[]).map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)}>{k(`tab.${x}`)}{x === 'requests' && items.some((i) => i.upsells.requested) ? ` · ${items.reduce((s, i) => s + i.upsells.requested, 0)}` : ''}</div>)}
          </div>
          {tab === 'requests' && (
            <select className="htl-select" value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
              {['requested', 'approved', 'declined', ''].map((s) => <option key={s} value={s}>{k(`rs.${s || 'all'}`)}</option>)}
            </select>
          )}
        </div>

        {tab === 'arrivals' && (!items.length ? (
          <div className="htl-empty"><h4>{k('emptyArrivals')}</h4><p>{k('emptyArrivalsHint')}</p></div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead><tr><th>{k('col.guest')}</th><th>{k('col.arrival')}</th><th>{k('col.room')}</th><th>{k('col.status')}</th><th>{k('col.guests')}</th><th>{k('col.arrivalInfo')}</th><th /></tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.reservationId}>
                    <td><button type="button" className="lnk" onClick={() => navigate(`/hotels/reservations?reservation=${r.reservationId}`)}><b>{r.guestName}</b></button><div className="htl-sub">{r.guestEmail || k('noEmail')}</div></td>
                    <td className="mono">{fmtDate(r.checkIn, loc)}</td>
                    <td>{r.roomTypeName}</td>
                    <td><span className={`pcs s-${r.status || 'none'}`}>{k(`st.${r.status || 'none'}`)}</span>{r.sentAt && <div className="htl-sub">{k('sentAt', { date: new Date(r.sentAt).toLocaleDateString(loc) })}</div>}</td>
                    <td className="mono">{r.guestsFilled} / {r.pax}</td>
                    <td>
                      {r.eta ? `${r.eta}${r.flight ? ` · ${r.flight}` : ''}` : '—'}
                      {r.needTransfer && <div className="htl-sub">{k('transfer')}</div>}
                      {r.requestsText && <div className="htl-sub" title={r.requestsText}>{r.requestsText.slice(0, 60)}</div>}
                      {r.upsells.requested > 0 && <div className="pcs-req">{k('requestsN', { count: r.upsells.requested })}</div>}
                    </td>
                    <td className="pc-actions">
                      <button className="btn btn-sm" disabled={busy === r.reservationId} onClick={() => copy(r)}>{k('copyLink')}</button>
                      {r.guestEmail && r.status !== 'completed' && <button className="btn btn-sm" disabled={busy === r.reservationId} onClick={() => send(r)}>{r.sentAt ? k('resend') : k('send')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'requests' && (!reqs.length ? (
          <div className="htl-empty"><h4>{k('emptyRequests')}</h4><p>{k('emptyRequestsHint')}</p></div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead><tr><th>{k('col.request')}</th><th>{k('col.guest')}</th><th>{k('col.arrival')}</th><th className="num">{k('col.amount')}</th><th>{k('col.status')}</th><th /></tr></thead>
              <tbody>
                {reqs.map((q) => (
                  <tr key={q.id}>
                    <td><b>{q.kind === 'upgrade' ? k('upgradeTo', { name: q.name }) : q.kind === 'extra' ? q.name : k(`kind.${q.kind}`)}</b>{q.kind === 'extra' && q.quantity > 1 && <div className="htl-sub">× {q.quantity}</div>}</td>
                    <td><button type="button" className="lnk" onClick={() => navigate(`/hotels/reservations?reservation=${q.reservationId}`)}>{q.guestName}</button></td>
                    <td className="mono">{q.checkIn ? fmtDate(q.checkIn, loc) : '—'}</td>
                    <td className="num mono">{money(q.amount, cur, loc)}</td>
                    <td><span className={`pcs s-${q.status}`}>{k(`rs.${q.status}`)}</span></td>
                    <td className="pc-actions">
                      {q.status === 'requested' && (
                        <>
                          <button className="btn btn-sm btn-primary" disabled={busy === q.id} onClick={() => decide(q, true)}><Ic d={HTL_ICON.check} size={12} />{k('approve')}</button>
                          <button className="btn btn-sm" disabled={busy === q.id} onClick={() => decide(q, false)}>{k('decline')}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'settings' && hotelId && <PrecheckinSettings hotelId={hotelId} currency={cur} auto={data?.auto ?? null} upgrades={data?.upgrades ?? true} onSaved={load} />}
      </div>
    </MainLayout>
  );
};

/** Автоотправка, апгрейды, какие услуги продавать онлайн и как считать их цену */
const PrecheckinSettings: React.FC<{ hotelId: string; currency: string; auto: HotelPrecheckinAuto | null; upgrades: boolean; onSaved: () => void }> = ({ hotelId, currency, auto, upgrades, onSaved }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.precheckin.${key}`, o);
  const loc = useLoc();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [up, setUp] = useState(upgrades);
  const [extras, setExtras] = useState<HotelExtraService[]>([]);
  useEffect(() => { setUp(upgrades); }, [upgrades]);
  const loadExtras = () => fetchExtras(hotelId).then(setExtras).catch(() => setExtras([]));
  useEffect(() => { void loadExtras(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const patchExtra = (x: HotelExtraService, dto: Partial<HotelExtraService>) => updateExtra(x.id, dto).then(() => loadExtras()).catch(err);
  const lang = i18n.language?.startsWith('tr') ? 'tr' : i18n.language?.startsWith('en') ? 'en' : 'ru';
  // автоотправка ссылки — автоматизация «путь гостя»; нет её — ставим готовый сценарий и открываем на проверку
  const openAuto = () => {
    if (auto) { navigate(`/app/automations/${auto.automationId}`); return; }
    installJourneyPresets(lang, ['pre_arrival']).then((r) => { onSaved(); if (r.created[0]) navigate(`/app/automations/${r.created[0].id}`); }).catch(err);
  };
  return (
    <div className="htl-cols">
      <div className="htl-col-main">
        <div className="htl-panel">
          <h3 className="htl-h3">{k('setLink')}</h3>
          <div className="pc-auto">
            <div>
              <b>{auto ? auto.name : k('autoNone')}</b>
              <span className="htl-sub">{auto ? (auto.active ? k('autoOn', { count: auto.offsetDays, time: auto.sendTime }) : k('autoOff')) : k('autoNoneHint')}</span>
            </div>
            <button type="button" className="btn btn-sm" onClick={openAuto}>{auto ? k('autoOpen') : k('autoCreate')}</button>
          </div>
          <div className="htl-hint">{k('autoMovedHint')}</div>
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 12 }}>
            <label className="rtp-check"><input type="checkbox" checked={up} onChange={(e) => setUp(e.target.checked)} />{k('upgrades')}</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => savePrecheckinSettings(hotelId, { precheckinUpgrades: up }).then(() => { showAlert(k('saved'), { variant: 'success' }); onSaved(); }).catch(err)}>{k('save')}</button>
          </div>
        </div>
        <div className="htl-panel">
          <h3 className="htl-h3">{k('setExtras')}</h3>
          <p className="htl-sub">{k('setExtrasHint')}</p>
          {!extras.length ? <p className="htl-sub">{k('noExtras')}</p> : (
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead><tr><th>{k('col.online')}</th><th>{k('col.service')}</th><th className="num">{k('col.price')}</th><th>{k('col.priceMode')}</th><th>{k('col.description')}</th></tr></thead>
                <tbody>
                  {extras.map((x) => (
                    <tr key={x.id}>
                      <td><input type="checkbox" checked={!!x.sellOnline} onChange={(e) => patchExtra(x, { sellOnline: e.target.checked })} aria-label={x.name} /></td>
                      <td><b>{x.name}</b></td>
                      <td className="num mono">{money(Number(x.price), currency, loc)}</td>
                      <td>
                        <select value={x.priceMode || 'per_stay'} onChange={(e) => patchExtra(x, { priceMode: e.target.value as HotelExtraService['priceMode'] })}>
                          {(['per_stay', 'per_night', 'per_person'] as const).map((m) => <option key={m} value={m}>{k(`pm.${m}`)}</option>)}
                        </select>
                      </td>
                      <td><input className="pc-desc" defaultValue={x.description || ''} placeholder={k('descPh')} onBlur={(e) => e.target.value !== (x.description || '') && patchExtra(x, { description: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="htl-hint" style={{ marginTop: 8 }}>{k('extrasCatalogHint')}</div>
        </div>
      </div>
    </div>
  );
};
