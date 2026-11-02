import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import {
  closeShift,
  createExtra,
  deleteExtra,
  fetchCashierSettings,
  fetchCurrentShift,
  fetchExtras,
  fetchHotels,
  fetchShiftDetail,
  fetchShifts,
  openShift,
  saveCashierSettings,
  updateExtra,
  HOTEL_EXTRA_CATEGORIES,
  type Hotel,
  type HotelCashShift,
  type HotelExtraService,
  type HotelShiftPayment,
} from '../../../api/hotels';
import { useTenantComponents } from '../../../hooks/useTenantComponents';
import { EInvoiceTab } from './EInvoiceTab';
import '../hotels-design.css';

type Tab = 'shift' | 'history' | 'extras' | 'fees' | 'einvoice';
const TABS: Tab[] = ['shift', 'history', 'extras', 'fees', 'einvoice'];

const useCk = () => {
  const { t, i18n } = useTranslation();
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  return { t, loc, k: (key: string, o?: Record<string, unknown>) => t(`crm.hotels.cashier.${key}`, o) };
};

export const HotelCashierPage: React.FC = () => {
  const { k, t } = useCk();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const { isEnabled } = useTenantComponents();
  const tabs = TABS.filter((x) => x !== 'einvoice' || isEnabled('hotels_einvoice'));
  const tab = (tabs.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'shift') as Tab;
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const hotel = hotels.find((h) => h.id === hotelId);
  const setParam = (patch: Record<string, string>) => setSp({ ...Object.fromEntries(sp.entries()), ...patch });
  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);
  return (
    <MainLayout>
      <PageHelpButton topic="hotelCashier" />
      <div className="px-scope">
        <HotelsSubnav active="cashier" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setParam({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {tabs.map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setParam({ tab: x })}>{k(`tabs.${x}`)}</div>)}
          </div>
        </div>
        {!hotelId ? <div className="htl-empty"><h4>{t('crm.hotels.rack.noHotels')}</h4></div>
          : tab === 'shift' ? <ShiftTab hotelId={hotelId} currency={hotel?.currency} />
          : tab === 'history' ? <HistoryTab hotelId={hotelId} currency={hotel?.currency} />
          : tab === 'extras' ? <ExtrasTab hotelId={hotelId} currency={hotel?.currency} />
          : tab === 'einvoice' ? <EInvoiceTab hotelId={hotelId} />
          : <FeesTab hotelId={hotelId} />}
      </div>
    </MainLayout>
  );
};

const PaymentsTable: React.FC<{ payments: HotelShiftPayment[]; currency?: string | null }> = ({ payments, currency }) => {
  const { k, t, loc } = useCk();
  const navigate = useNavigate();
  if (!payments.length) return <div className="htl-empty" style={{ padding: 24 }}><h4>{k('noPayments')}</h4></div>;
  return (
    <div className="bk-table-wrap">
      <table className="bk-table">
        <thead><tr><th>{k('col.time')}</th><th>{k('col.guest')}</th><th>{k('col.method')}</th><th>{k('col.note')}</th><th style={{ textAlign: 'right' }}>{k('col.amount')}</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} onClick={() => navigate(p.source === 'pos' ? '/hotels/pos' : `/hotels/reservations?reservation=${p.reservationId}`)} style={{ cursor: 'pointer' }}>
              <td>{p.createdAt ? new Date(p.createdAt).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : p.date}</td>
              <td>{p.source === 'pos' ? <><b>{p.guestName}</b><span className="htl-sub"> · {k('posCheck', { n: p.bookingCode })}</span></> : <><b>{p.guestName}</b>{p.bookingCode && <span className="htl-sub"> · {p.bookingCode}</span>}</>}</td>
              <td>{t(`crm.hotels.reservations.paymentMethods.${p.method}`, { defaultValue: p.method })}{p.voided ? ` · ${k('posVoid')}` : p.amount < 0 ? ` · ${t('crm.hotels.folio.refund')}` : ''}</td>
              <td style={{ color: 'var(--fg-2)' }}>{p.note || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: p.amount < 0 ? '#9a1f31' : undefined }}>{money(p.amount, currency, loc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Totals: React.FC<{ totals: Record<string, number>; currency?: string | null }> = ({ totals, currency }) => {
  const { t, loc } = useCk();
  const entries = Object.entries(totals);
  return (
    <div className="htl-rack-kpis" style={{ gridTemplateColumns: `repeat(${Math.max(entries.length, 1)}, minmax(0,1fr))` }}>
      {entries.length ? entries.map(([m, v]) => <div key={m}><span>{t(`crm.hotels.reservations.paymentMethods.${m}`, { defaultValue: m })}</span><b>{money(v, currency, loc)}</b></div>) : <div><span>—</span><b>0</b></div>}
    </div>
  );
};

const ShiftTab: React.FC<{ hotelId: string; currency?: string | null }> = ({ hotelId, currency }) => {
  const { k, t, loc } = useCk();
  const { showAlert, showPrompt } = useAlertModal();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchCurrentShift>> | null>(null);
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetchCurrentShift(hotelId).then(setData).catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hotelId]);
  useEffect(() => { setData(null); void load(); }, [load]);
  const open = () => {
    setBusy(true);
    openShift(hotelId, opening || '0').then(() => { setOpening(''); showAlert(k('opened'), { variant: 'success' }); return load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' })).finally(() => setBusy(false));
  };
  const close = async () => {
    const counted = await showPrompt({ title: k('closeTitle'), label: k('closeLabel', { expected: money(data?.expectedCash || 0, currency, loc) }), placeholder: '0', confirmLabel: k('close'), cancelLabel: t('crm.hotels.common.cancel') });
    if (counted === null) return;
    if (counted.trim() === '') { showAlert(k('errors.HOTEL_SHIFT_COUNT_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    closeShift(hotelId, counted)
      .then((s) => {
        const diff = Number(s.difference) || 0;
        showAlert(Math.abs(diff) < 0.01 ? k('closedOk') : k('closedDiff', { diff: money(diff, currency, loc) }), { variant: Math.abs(diff) < 0.01 ? 'success' : 'error' });
        return load();
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  if (!data) return <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div>;
  if (!data.shift) {
    return (
      <div className="htl-empty">
        <h4>{k('noShift')}</h4>
        <p>{k('noShiftHint')}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <input className="hk-cell wide" type="number" min={0} step="0.01" placeholder={k('openingCash')} value={opening} onChange={(e) => setOpening(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={open}><Ic d={HTL_ICON.plus} size={14} />{k('open')}</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="htl-sub">{k('openSince', { at: new Date(data.shift.openedAt).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), cash: money(Number(data.shift.openingCash), currency, loc) })}</div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => void close()}>{k('close')}</button>
      </div>
      <Totals totals={data.totals} currency={currency} />
      <p className="htl-fd-note" style={{ margin: '10px 0' }}>{k('expectedCash', { cash: money(data.expectedCash || 0, currency, loc) })}</p>
      <PaymentsTable payments={data.payments} currency={currency} />
    </>
  );
};

const HistoryTab: React.FC<{ hotelId: string; currency?: string | null }> = ({ hotelId, currency }) => {
  const { k, loc } = useCk();
  const [rows, setRows] = useState<HotelCashShift[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<HotelShiftPayment[] | null>(null);
  useEffect(() => { setRows(null); fetchShifts(hotelId).then(setRows).catch(() => setRows([])); }, [hotelId]);
  useEffect(() => { if (open) { setDetail(null); fetchShiftDetail(open).then((d) => setDetail(d.payments)).catch(() => setDetail([])); } }, [open]);
  if (!rows) return <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div>;
  if (!rows.length) return <div className="htl-empty"><h4>{k('noShifts')}</h4></div>;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  return (
    <div className="bk-table-wrap">
      <table className="bk-table">
        <thead><tr><th>{k('col.opened')}</th><th>{k('col.closed')}</th><th>{k('col.byMethod')}</th><th>{k('col.expected')}</th><th>{k('col.counted')}</th><th>{k('col.diff')}</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <React.Fragment key={s.id}>
              <tr onClick={() => setOpen(open === s.id ? null : s.id)} style={{ cursor: 'pointer' }}>
                <td>{fmt(s.openedAt)}</td>
                <td>{s.status === 'open' ? <span className="hk-task s-in_progress">{k('statusOpen')}</span> : fmt(s.closedAt)}</td>
                <td style={{ fontSize: 12, color: 'var(--fg-2)' }}>{s.totals ? Object.entries(s.totals).map(([m, v]) => `${m}: ${money(v, currency, loc)}`).join(' · ') : '—'}</td>
                <td>{s.expectedCash !== null ? money(Number(s.expectedCash), currency, loc) : '—'}</td>
                <td>{s.countedCash !== null ? money(Number(s.countedCash), currency, loc) : '—'}</td>
                <td style={{ fontWeight: 600, color: Math.abs(Number(s.difference) || 0) >= 0.01 ? '#9a1f31' : '#175c3d' }}>{s.difference !== null ? money(Number(s.difference), currency, loc) : '—'}</td>
              </tr>
              {open === s.id && <tr><td colSpan={6} style={{ background: 'var(--bg-muted)' }}>{detail ? <PaymentsTable payments={detail} currency={currency} /> : '…'}{s.note && <p className="htl-sub">{s.note}</p>}</td></tr>}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ExtrasTab: React.FC<{ hotelId: string; currency?: string | null }> = ({ hotelId, currency }) => {
  const { k, t } = useCk();
  const vatOn = useTenantComponents().isEnabled('hotels_einvoice');
  const { showAlert, showConfirm } = useAlertModal();
  const [rows, setRows] = useState<HotelExtraService[] | null>(null);
  const [draft, setDraft] = useState({ name: '', category: 'fnb', price: '' });
  const load = useCallback(() => fetchExtras(hotelId, true).then(setRows).catch(() => setRows([])), [hotelId]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
  const add = () => {
    if (!draft.name.trim()) { showAlert(k('errors.HOTEL_EXTRA_NAME_REQUIRED'), { variant: 'error' }); return; }
    createExtra({ hotelId, ...draft }).then(() => { setDraft({ name: '', category: draft.category, price: '' }); return load(); }).catch(err);
  };
  const save = (x: HotelExtraService, dto: Partial<HotelExtraService>) => updateExtra(x.id, dto).then(load).catch(err);
  const remove = async (x: HotelExtraService) => {
    const ok = await showConfirm(k('deleteExtraConfirm', { name: x.name }), { title: t('crm.hotels.common.delete'), confirmLabel: t('crm.hotels.common.delete'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
    if (ok) deleteExtra(x.id).then(load).catch(err);
  };
  return (
    <>
      <p className="htl-fd-note">{k('extrasHint')}</p>
      <div className="htl-folio-form" style={{ marginBottom: 12 }}>
        <input className="wide" placeholder={k('extraName')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{HOTEL_EXTRA_CATEGORIES.map((c) => <option key={c} value={c}>{k(`categories.${c}`)}</option>)}</select>
        <input className="sm" type="number" min={0} step="0.01" placeholder={k('price', { currency: currency || '' })} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <button className="btn btn-sm btn-primary" onClick={add}><Ic d={HTL_ICON.plus} size={12} />{k('addExtra')}</button>
      </div>
      {!rows ? <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div> : !rows.length ? <div className="htl-empty"><h4>{k('noExtras')}</h4></div> : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{k('extraName')}</th><th>{k('category')}</th><th>{k('price', { currency: currency || '' })}</th>{vatOn && <th>{t('crm.hotels.einvoice.extraVat')}</th>}<th>{k('active')}</th><th /></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className={x.active ? undefined : 'muted'}>
                  <td><input key={`n${x.id}${x.name}`} className="hk-cell wide" defaultValue={x.name} onBlur={(e) => e.target.value.trim() && e.target.value !== x.name && void save(x, { name: e.target.value })} /></td>
                  <td><select className="htl-fd-pick" value={x.category} onChange={(e) => void save(x, { category: e.target.value })}>{HOTEL_EXTRA_CATEGORIES.map((c) => <option key={c} value={c}>{k(`categories.${c}`)}</option>)}</select></td>
                  <td><input key={`p${x.id}${x.price}`} className="hk-cell" type="number" step="0.01" defaultValue={Number(x.price)} onBlur={(e) => Number(e.target.value) !== Number(x.price) && void save(x, { price: e.target.value })} /></td>
                  {vatOn && <td><input key={`v${x.id}${x.vatPct ?? ''}`} className="hk-cell" type="number" min={0} max={100} step="1" placeholder={t('crm.hotels.einvoice.extraVatDefault')} defaultValue={x.vatPct === null || x.vatPct === undefined ? '' : Number(x.vatPct)} onBlur={(e) => { const v = e.target.value === '' ? null : e.target.value; if (String(v ?? '') !== String(x.vatPct === null || x.vatPct === undefined ? '' : Number(x.vatPct))) void save(x, { vatPct: v }); }} aria-label={t('crm.hotels.einvoice.extraVat')} /></td>}
                  <td><input type="checkbox" checked={x.active} onChange={(e) => void save(x, { active: e.target.checked })} aria-label={k('active')} /></td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-sm" onClick={() => void remove(x)} aria-label={t('crm.hotels.common.delete')}><Ic d={HTL_ICON.x} size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const FeesTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { k, t } = useCk();
  const { showAlert } = useAlertModal();
  const [v, setV] = useState<{ earlyCheckInFeePct: string; lateCheckOutFeePct: string } | null>(null);
  useEffect(() => { setV(null); fetchCashierSettings(hotelId).then((s) => setV({ earlyCheckInFeePct: String(Number(s.earlyCheckInFeePct)), lateCheckOutFeePct: String(Number(s.lateCheckOutFeePct)) })).catch(() => setV({ earlyCheckInFeePct: '0', lateCheckOutFeePct: '0' })); }, [hotelId]);
  if (!v) return <div className="htl-rack-skel">{[0].map((i) => <div key={i} />)}</div>;
  const save = () => saveCashierSettings({ hotelId, ...v }).then(() => showAlert(k('feesSaved'), { variant: 'success' })).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  return (
    <div className="htl-panel" style={{ maxWidth: 640 }}>
      <p className="htl-fd-note">{k('feesHint')}</p>
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <div className="htl-f"><label>{k('earlyFee')}</label><input type="number" min={0} max={100} value={v.earlyCheckInFeePct} onChange={(e) => setV({ ...v, earlyCheckInFeePct: e.target.value })} /></div>
        <div className="htl-f"><label>{k('lateFee')}</label><input type="number" min={0} max={100} value={v.lateCheckOutFeePct} onChange={(e) => setV({ ...v, lateCheckOutFeePct: e.target.value })} /></div>
      </div>
      <div style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => void save()}>{t('crm.hotels.common.save')}</button></div>
    </div>
  );
};
