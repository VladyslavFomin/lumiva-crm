import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { DateInput } from '../../../components/ui/DateInput';
import { money, todayIso, addDaysIso } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  createExtra,
  createPosCheck,
  createPosOutlet,
  deletePosOutlet,
  fetchExtras,
  fetchHotels,
  fetchPosChecks,
  fetchPosGuests,
  fetchPosOutlets,
  fetchPosReport,
  savePosSettings,
  updateExtra,
  updatePosOutlet,
  voidPosCheck,
  HOTEL_POS_KINDS,
  type Hotel,
  type HotelExtraService,
  type HotelPosCheck,
  type HotelPosGuest,
  type HotelPosKind,
  type HotelPosOutlet,
  type HotelPosReportRow,
} from '../../../api/hotels';
import '../hotels-design.css';

type Tab = 'till' | 'checks' | 'report' | 'settings';

/**
 * Точки продаж: касса точки (позиции → на номер заселённого гостя или оплата на месте), чеки дня со сторно,
 * отчёт по точкам, настройка точек, позиций («всё включено») и лимита на номер.
 */
export const HotelPosPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pos.${key}`, o);
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [tab, setTab] = useState<Tab>('till');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPosOutlets>> | null>(null);
  const [outletId, setOutletId] = useState('');
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  useEffect(() => { fetchHotels().then((h) => { setHotels(h); if (h[0]) setHotelId(h[0].id); }).catch(err); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    if (!hotelId) return;
    fetchPosOutlets(hotelId).then((d) => { setData(d); setOutletId((cur) => (d.outlets.some((o) => o.id === cur && o.active) ? cur : d.outlets.find((o) => o.active)?.id || '')); }).catch(err);
  };
  useEffect(load, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const outlet = data?.outlets.find((o) => o.id === outletId) || null;
  const active = (data?.outlets || []).filter((o) => o.active);

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="pos" />
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
        <div className="htl-toolbar">
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['till', 'checks', 'report', 'settings'] as Tab[]).map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)}>{k(`tab.${x}`)}</div>)}
          </div>
          {(tab === 'till' || tab === 'checks') && active.length > 0 && (
            <div className="rtp-chips">{active.map((o) => <button key={o.id} type="button" className={`rtp-chip${o.id === outletId ? ' on' : ''}`} onClick={() => setOutletId(o.id)}>{o.name}</button>)}</div>
          )}
        </div>
        {!data ? null : !active.length && tab !== 'settings' && tab !== 'report' ? (
          <div className="htl-empty"><h4>{k('noOutlets')}</h4><p>{k('noOutletsHint')}</p><button className="btn btn-primary" onClick={() => setTab('settings')}>{k('setup')}</button></div>
        ) : tab === 'till' && outlet ? (
          <Till key={outlet.id} hotelId={hotelId} outlet={outlet} currency={data.currency} onPosted={() => undefined} />
        ) : tab === 'checks' && outlet ? (
          <Checks hotelId={hotelId} outlet={outlet} currency={data.currency} businessDate={data.businessDate} />
        ) : tab === 'report' ? (
          <Report hotelId={hotelId} currency={data.currency} businessDate={data.businessDate} />
        ) : tab === 'settings' ? (
          <Settings hotelId={hotelId} data={data} onChanged={load} />
        ) : null}
      </div>
    </MainLayout>
  );
};

/** Касса точки: плитки позиций, корзина, кому — номер гостя или оплата на месте */
const Till: React.FC<{ hotelId: string; outlet: HotelPosOutlet; currency: string; onPosted: () => void }> = ({ hotelId, outlet, currency, onPosted }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pos.${key}`, o);
  const loc = useLoc();
  const { showAlert, showConfirm } = useAlertModal();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'room' | 'pay'>('room');
  const [q, setQ] = useState('');
  const [guests, setGuests] = useState<HotelPosGuest[]>([]);
  const [guest, setGuest] = useState<HotelPosGuest | null>(null);
  const [pay, setPay] = useState('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const items = outlet.items.filter((i) => i.active);
  useEffect(() => {
    if (mode !== 'room') return;
    const h = window.setTimeout(() => fetchPosGuests(hotelId, q).then(setGuests).catch(() => setGuests([])), 250);
    return () => window.clearTimeout(h);
  }, [q, mode, hotelId]);
  const lines = items.filter((i) => cart[i.id]).map((i) => {
    const included = mode === 'room' && !!guest?.allInclusive && !!i.aiIncluded;
    return { item: i, qty: cart[i.id], included, amount: included ? 0 : cart[i.id] * Number(i.price) };
  });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const add = (id: string, d: number) => setCart((c) => { const n = { ...c, [id]: Math.max(0, (c[id] || 0) + d) }; if (!n[id]) delete n[id]; return n; });
  const post = async (override = false) => {
    setBusy(true);
    try {
      const c = await createPosCheck({ outletId: outlet.id, lines: lines.map((l) => ({ extraServiceId: l.item.id, quantity: l.qty })), reservationId: mode === 'room' ? guest?.reservationId : null, paymentMethod: mode === 'pay' ? pay : null, note, overrideLimit: override });
      showAlert(k('posted', { n: c.number, amount: money(Number(c.total), currency, loc) }), { variant: 'success' });
      setCart({}); setNote(''); setGuest(null); setQ('');
      onPosted();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'HOTEL_POS_LIMIT' && !override) {
        setBusy(false);
        if (await showConfirm(k('limitBody', { limit: money(guest?.creditLimit || 0, currency, loc) }), { title: k('limitTitle'), confirmLabel: k('limitOverride') })) return post(true);
        return;
      }
      showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pos-till">
      <div className="pos-items">
        {!items.length ? <div className="htl-empty"><h4>{k('noItems')}</h4><p>{k('noItemsHint')}</p></div> : items.map((i) => (
          <button key={i.id} type="button" className={`pos-tile${cart[i.id] ? ' on' : ''}`} onClick={() => add(i.id, 1)}>
            <b>{i.name}</b>
            <span>{money(Number(i.price), currency, loc)}</span>
            {i.aiIncluded && <em>{k('aiTag')}</em>}
            {cart[i.id] ? <i>{cart[i.id]}</i> : null}
          </button>
        ))}
      </div>
      <div className="pos-cart">
        <div className="htl-seg pos-mode">
          <button type="button" className={mode === 'room' ? 'on' : ''} onClick={() => setMode('room')}>{k('toRoom')}</button>
          <button type="button" className={mode === 'pay' ? 'on' : ''} onClick={() => { setMode('pay'); setGuest(null); }}>{k('payNow')}</button>
        </div>
        {mode === 'room' ? (
          guest ? (
            <div className={`pos-guest on${guest.allInclusive ? ' ai' : ''}`}>
              <div><b>{guest.roomLabel ? `№ ${guest.roomLabel} · ` : ''}{guest.guestName}</b><span>{guest.boardType || '—'}{guest.allInclusive ? ` · ${k('aiGuest')}` : ''}</span></div>
              <span className="htl-sub">{k('owed', { amount: money(guest.extrasOwed, currency, loc) })}{guest.creditLimit !== null ? ` · ${k('limit', { amount: money(guest.creditLimit, currency, loc) })}` : ''}</span>
              <button type="button" className="lnk" onClick={() => setGuest(null)}>{k('change')}</button>
            </div>
          ) : (
            <>
              <div className="bk-search"><Ic d={HTL_ICON.search} size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={k('searchPh')} autoFocus /></div>
              <div className="pos-guests">
                {guests.map((g) => (
                  <button key={g.reservationId} type="button" className="pos-guest" onClick={() => setGuest(g)}>
                    <div><b>{g.roomLabel ? `№ ${g.roomLabel} · ` : ''}{g.guestName}</b><span>{g.boardType || '—'}{g.allInclusive ? ` · ${k('aiGuest')}` : ''}</span></div>
                  </button>
                ))}
                {!guests.length && <div className="htl-sub" style={{ padding: 8 }}>{k('noGuests')}</div>}
              </div>
            </>
          )
        ) : (
          <div className="htl-seg">{['cash', 'card', 'other'].map((m) => <button key={m} type="button" className={pay === m ? 'on' : ''} onClick={() => setPay(m)}>{t(`crm.hotels.reservations.paymentMethods.${m}`, { defaultValue: m })}</button>)}</div>
        )}
        <div className="pos-lines">
          {!lines.length ? <div className="htl-sub">{k('emptyCart')}</div> : lines.map((l) => (
            <div key={l.item.id} className="pos-line">
              <span className="pos-qty"><button type="button" onClick={() => add(l.item.id, -1)}>−</button><b>{l.qty}</b><button type="button" onClick={() => add(l.item.id, 1)}>+</button></span>
              <span className="pos-name">{l.item.name}{l.included && <em>{k('included')}</em>}</span>
              <b className="mono">{money(l.amount, currency, loc)}</b>
            </div>
          ))}
        </div>
        <input className="pos-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={k('notePh')} />
        <div className="pos-total"><span>{k('total')}</span><b>{money(total, currency, loc)}</b></div>
        <button type="button" className="btn btn-primary pos-go" disabled={busy || !lines.length || (mode === 'room' ? !guest : !(total > 0))} onClick={() => post()}>
          <Ic d={HTL_ICON.check} size={14} />{mode === 'room' ? k('postRoom') : k('postPay')}
        </button>
      </div>
    </div>
  );
};

const Checks: React.FC<{ hotelId: string; outlet: HotelPosOutlet; currency: string; businessDate: string }> = ({ hotelId, outlet, currency, businessDate }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pos.${key}`, o);
  const loc = useLoc();
  const { showAlert } = useAlertModal();
  const [date, setDate] = useState(businessDate || todayIso());
  const [list, setList] = useState<HotelPosCheck[]>([]);
  const load = () => fetchPosChecks({ hotelId, outletId: outlet.id, date }).then(setList).catch(() => setList([]));
  useEffect(() => { void load(); }, [outlet.id, date]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="htl-toolbar"><DateInput className="htl-date" value={date} onChange={(v) => v && setDate(v)} inline clearable={false} /></div>
      {!list.length ? <div className="htl-empty"><h4>{k('noChecks')}</h4></div> : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>#</th><th>{k('col.time')}</th><th>{k('col.to')}</th><th>{k('col.items')}</th><th className="num">{k('col.total')}</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={c.status === 'voided' ? 'grp-off' : ''}>
                  <td className="mono">{c.number}</td>
                  <td className="mono">{new Date(c.createdAt).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{c.reservationId ? `№ ${c.roomLabel || '—'} · ${c.guestName}` : t(`crm.hotels.reservations.paymentMethods.${c.paymentMethod}`, { defaultValue: c.paymentMethod || '' })}</td>
                  <td>{c.lines.map((l) => `${l.name} × ${l.quantity}${l.included ? ` (${k('included')})` : ''}`).join(', ')}{c.voidReason && <div className="htl-sub">{k('voidedBecause', { reason: c.voidReason })}</div>}</td>
                  <td className="num mono">{money(Number(c.total), currency, loc)}</td>
                  <td>{c.status === 'posted' && <button className="btn btn-sm" onClick={() => { const r = window.prompt(k('voidPrompt')); if (r && r.trim()) voidPosCheck(c.id, r).then(() => { showAlert(k('voided'), { variant: 'success' }); void load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' })); }}>{k('void')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const Report: React.FC<{ hotelId: string; currency: string; businessDate: string }> = ({ hotelId, currency, businessDate }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pos.${key}`, o);
  const loc = useLoc();
  const [from, setFrom] = useState(addDaysIso(businessDate || todayIso(), -6));
  const [to, setTo] = useState(businessDate || todayIso());
  const [rows, setRows] = useState<HotelPosReportRow[]>([]);
  useEffect(() => { if (from <= to) fetchPosReport({ hotelId, from, to }).then(setRows).catch(() => setRows([])); }, [hotelId, from, to]);
  const sum = (key: keyof HotelPosReportRow) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const m = (v: number) => money(v, currency, loc);
  return (
    <>
      <div className="htl-toolbar">
        <DateInput className="htl-date" value={from} onChange={(v) => v && setFrom(v)} inline clearable={false} />
        <span>—</span>
        <DateInput className="htl-date" value={to} onChange={(v) => v && setTo(v)} inline clearable={false} />
      </div>
      <div className="bk-table-wrap">
        <table className="bk-table">
          <thead><tr><th>{k('col.outlet')}</th><th className="num">{k('col.checks')}</th><th className="num">{k('col.room')}</th><th className="num">{k('col.cash')}</th><th className="num">{k('col.card')}</th><th className="num">{k('col.other')}</th><th className="num">{k('col.revenue')}</th><th className="num">{k('col.included')}</th><th className="num">{k('col.voided')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.outletId}><td><b>{r.name}</b><div className="htl-sub">{k(`kind.${r.kind}`)}</div></td><td className="num mono">{r.checks}</td><td className="num mono">{m(r.room)}</td><td className="num mono">{m(r.cash)}</td><td className="num mono">{m(r.card)}</td><td className="num mono">{m(r.other)}</td><td className="num mono"><b>{m(r.total)}</b></td><td className="num mono htl-sub">{m(r.included)}</td><td className="num mono">{r.voided}</td></tr>
            ))}
            {rows.length > 1 && <tr className="pos-sum"><td>{k('totalAll')}</td><td className="num mono">{sum('checks')}</td><td className="num mono">{m(sum('room'))}</td><td className="num mono">{m(sum('cash'))}</td><td className="num mono">{m(sum('card'))}</td><td className="num mono">{m(sum('other'))}</td><td className="num mono"><b>{m(sum('total'))}</b></td><td className="num mono">{m(sum('included'))}</td><td className="num mono">{sum('voided')}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="htl-hint" style={{ marginTop: 8 }}>{k('reportHint')}</div>
    </>
  );
};

/** Точки, их позиции (из каталога кассы), «всё включено», лимит на номер */
const Settings: React.FC<{ hotelId: string; data: { outlets: HotelPosOutlet[]; creditLimit: number | null; currency: string; businessDate: string }; onChanged: () => void }> = ({ hotelId, data, onChanged }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pos.${key}`, o);
  const loc = useLoc();
  const { showAlert, showConfirm } = useAlertModal();
  const [extras, setExtras] = useState<HotelExtraService[]>([]);
  const [newOutlet, setNewOutlet] = useState({ name: '', kind: 'restaurant' as HotelPosKind });
  const [limit, setLimit] = useState(data.creditLimit === null ? '' : String(data.creditLimit));
  const [newItem, setNewItem] = useState<Record<string, { name: string; price: string; ai: boolean }>>({});
  const loadExtras = () => fetchExtras(hotelId, true).then(setExtras).catch(() => setExtras([]));
  useEffect(() => { void loadExtras(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const done = () => { onChanged(); void loadExtras(); };
  const free = useMemo(() => extras.filter((x) => !x.outletId && x.active), [extras]);
  return (
    <div className="htl-cols">
      <div className="htl-col-main">
        <div className="htl-panel">
          <h3 className="htl-h3">{k('secOutlets')}</h3>
          <div className="pos-newrow">
            <input value={newOutlet.name} onChange={(e) => setNewOutlet({ ...newOutlet, name: e.target.value })} placeholder={k('outletPh')} />
            <select value={newOutlet.kind} onChange={(e) => setNewOutlet({ ...newOutlet, kind: e.target.value as HotelPosKind })}>{HOTEL_POS_KINDS.map((x) => <option key={x} value={x}>{k(`kind.${x}`)}</option>)}</select>
            <button className="btn btn-primary btn-sm" disabled={!newOutlet.name.trim()} onClick={() => createPosOutlet({ hotelId, ...newOutlet }).then(() => { setNewOutlet({ name: '', kind: 'restaurant' }); done(); }).catch(err)}><Ic d={HTL_ICON.plus} size={12} />{k('addOutlet')}</button>
          </div>
          {data.outlets.map((o) => {
            const ni = newItem[o.id] || { name: '', price: '', ai: false };
            return (
              <div key={o.id} className={`pos-outlet${o.active ? '' : ' off'}`}>
                <div className="pos-outlet-head">
                  <b>{o.name}</b><span className="rtp-tag">{k(`kind.${o.kind}`)}</span>
                  <label className="htl-check"><input type="checkbox" checked={o.active} onChange={(e) => updatePosOutlet(o.id, { active: e.target.checked }).then(done).catch(err)} />{k('active')}</label>
                  <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={async () => { if (await showConfirm(k('deleteBody'), { title: k('delete'), confirmLabel: k('delete'), danger: true })) deletePosOutlet(o.id).then(done).catch(err); }}>{k('delete')}</button>
                </div>
                <table className="bk-table">
                  <thead><tr><th>{k('col.item')}</th><th className="num">{k('col.price')}</th><th>{k('col.ai')}</th><th /></tr></thead>
                  <tbody>
                    {o.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.name}{!i.active && <span className="rtp-tag" style={{ marginLeft: 6 }}>{k('off')}</span>}</td>
                        <td className="num mono">{money(Number(i.price), data.currency, loc)}</td>
                        <td><input type="checkbox" checked={!!i.aiIncluded} onChange={(e) => updateExtra(i.id, { aiIncluded: e.target.checked }).then(done).catch(err)} aria-label={k('col.ai')} /></td>
                        <td><button className="lnk" onClick={() => updateExtra(i.id, { outletId: null }).then(done).catch(err)}>{k('unlink')}</button></td>
                      </tr>
                    ))}
                    <tr>
                      <td><input value={ni.name} placeholder={k('itemPh')} onChange={(e) => setNewItem({ ...newItem, [o.id]: { ...ni, name: e.target.value } })} /></td>
                      <td><input inputMode="decimal" value={ni.price} placeholder="0" onChange={(e) => setNewItem({ ...newItem, [o.id]: { ...ni, price: e.target.value } })} /></td>
                      <td><input type="checkbox" checked={ni.ai} onChange={(e) => setNewItem({ ...newItem, [o.id]: { ...ni, ai: e.target.checked } })} aria-label={k('col.ai')} /></td>
                      <td><button className="btn btn-sm" disabled={!ni.name.trim() || !(Number(ni.price.replace(',', '.')) > 0)} onClick={() => createExtra({ hotelId, name: ni.name, price: ni.price.replace(',', '.'), category: o.kind === 'minibar' ? 'minibar' : o.kind === 'spa' ? 'spa' : 'fnb', outletId: o.id, aiIncluded: ni.ai }).then(() => { setNewItem({ ...newItem, [o.id]: { name: '', price: '', ai: false } }); done(); }).catch(err)}>{k('addItem')}</button></td>
                    </tr>
                  </tbody>
                </table>
                {free.length > 0 && (
                  <select className="pos-attach" value="" onChange={(e) => e.target.value && updateExtra(e.target.value, { outletId: o.id }).then(done).catch(err)}>
                    <option value="">{k('attach')}</option>
                    {free.map((x) => <option key={x.id} value={x.id}>{x.name} · {money(Number(x.price), data.currency, loc)}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
        <div className="htl-panel">
          <h3 className="htl-h3">{k('secLimit')}</h3>
          <div className="pos-newrow">
            <input inputMode="decimal" value={limit} placeholder={k('noLimit')} onChange={(e) => setLimit(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => savePosSettings(hotelId, limit.trim() ? Number(limit.replace(',', '.')) : null).then(() => { showAlert(k('saved'), { variant: 'success' }); onChanged(); }).catch(err)}>{k('save')}</button>
          </div>
          <div className="htl-hint">{k('limitHint')}</div>
        </div>
      </div>
    </div>
  );
};
