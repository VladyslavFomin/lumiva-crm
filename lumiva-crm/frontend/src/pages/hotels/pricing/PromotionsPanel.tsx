import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { DateInput } from '../../../components/ui/DateInput';
import {
  checkPromotions,
  createPromotion,
  deletePromotion,
  fetchMarketGroups,
  fetchPromotions,
  fetchRatePlans,
  fetchRoomTypes,
  updatePromotion,
  HOTEL_PROMOTION_TYPES,
  type HotelMarketGroup,
  type HotelPromotion,
  type HotelPromotionCheck,
  type HotelPromotionInput,
  type HotelPromotionType,
  type HotelRatePlan,
  type HotelRoomType,
} from '../../../api/hotels';

type Draft = {
  type: HotelPromotionType;
  name: string;
  description: string;
  benefit: 'percent' | 'free';
  discountPct: string;
  freeNights: string;
  bookFrom: string;
  bookTo: string;
  minDaysBefore: string;
  maxDaysBefore: string;
  stayFrom: string;
  stayTo: string;
  stayRule: 'nights' | 'arrival';
  minNights: string;
  maxNights: string;
  combinable: boolean;
  prepaymentPct: string;
  prepayDue: 'date' | 'days';
  prepaymentDueDate: string;
  prepaymentDueDays: string;
  marketGroupIds: string[];
  roomTypeIds: string[];
  ratePlanIds: string[];
  sellDirect: boolean;
  sellWebsite: boolean;
  active: boolean;
};

const n = (v: string) => Number(String(v).replace(',', '.'));
const optInt = (v: string) => (v.trim() === '' ? null : Math.round(n(v)));
const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, d: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

const empty = (type: HotelPromotionType = 'early_booking'): Draft => ({
  type, name: '', description: '', benefit: 'percent', discountPct: '', freeNights: '1',
  bookFrom: '', bookTo: '', minDaysBefore: '', maxDaysBefore: type === 'last_minute' ? '7' : '',
  stayFrom: '', stayTo: '', stayRule: 'nights', minNights: type === 'long_stay' ? '7' : '1', maxNights: '',
  combinable: type === 'early_booking', prepaymentPct: '', prepayDue: 'date', prepaymentDueDate: '', prepaymentDueDays: '0',
  marketGroupIds: [], roomTypeIds: [], ratePlanIds: [], sellDirect: true, sellWebsite: true, active: true,
});

const toDraft = (p: HotelPromotion): Draft => ({
  type: p.type, name: p.name, description: p.description || '',
  benefit: p.freeNights > 0 ? 'free' : 'percent', discountPct: Number(p.discountPct) ? String(Number(p.discountPct)) : '', freeNights: String(p.freeNights || 1),
  bookFrom: p.bookFrom || '', bookTo: p.bookTo || '', minDaysBefore: p.minDaysBefore === null ? '' : String(p.minDaysBefore), maxDaysBefore: p.maxDaysBefore === null ? '' : String(p.maxDaysBefore),
  stayFrom: p.stayFrom || '', stayTo: p.stayTo || '', stayRule: p.stayRule, minNights: String(p.minNights), maxNights: p.maxNights ? String(p.maxNights) : '',
  combinable: p.combinable, prepaymentPct: Number(p.prepaymentPct) ? String(Number(p.prepaymentPct)) : '',
  prepayDue: p.prepaymentDueDate || p.prepaymentDueDays === null ? 'date' : 'days', prepaymentDueDate: p.prepaymentDueDate || '', prepaymentDueDays: String(p.prepaymentDueDays ?? 0),
  marketGroupIds: p.marketGroupIds || [], roomTypeIds: p.roomTypeIds || [], ratePlanIds: p.ratePlanIds || [],
  sellDirect: p.sellDirect, sellWebsite: p.sellWebsite, active: p.active,
});

const toInput = (d: Draft): HotelPromotionInput => {
  const prepay = n(d.prepaymentPct) > 0;
  return {
    type: d.type, name: d.name.trim(), description: d.description.trim() || null,
    discountPct: d.benefit === 'percent' ? d.discountPct || '0' : '0',
    freeNights: d.benefit === 'free' ? Math.round(n(d.freeNights)) || 0 : 0,
    bookFrom: d.bookFrom || null, bookTo: d.bookTo || null,
    minDaysBefore: optInt(d.minDaysBefore), maxDaysBefore: optInt(d.maxDaysBefore),
    stayFrom: d.stayFrom || null, stayTo: d.stayTo || null, stayRule: d.stayRule,
    minNights: Math.round(n(d.minNights)) || 1, maxNights: optInt(d.maxNights),
    combinable: d.combinable,
    prepaymentPct: prepay ? d.prepaymentPct : '0',
    prepaymentDueDate: prepay && d.prepayDue === 'date' ? d.prepaymentDueDate || null : null,
    prepaymentDueDays: prepay && d.prepayDue === 'days' ? Math.round(n(d.prepaymentDueDays)) || 0 : null,
    marketGroupIds: d.marketGroupIds, roomTypeIds: d.roomTypeIds, ratePlanIds: d.ratePlanIds,
    sellDirect: d.sellDirect, sellWebsite: d.sellWebsite, active: d.active,
  };
};

/**
 * Акции отеля для прямых продаж и сайта: раннее бронирование (EB), горящие, спецпредложения (SPO), длительное проживание.
 * Скидка входит в цену ночей брони; у партнёров (контракт, блок) и каналов — свои условия.
 */
export const PromotionsPanel: React.FC<{ hotelId: string; currency?: string | null }> = ({ hotelId, currency }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.promos.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [list, setList] = useState<HotelPromotion[] | null>(null);
  const [rooms, setRooms] = useState<HotelRoomType[]>([]);
  const [groups, setGroups] = useState<HotelMarketGroup[]>([]);
  const [plans, setPlans] = useState<HotelRatePlan[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!hotelId) return;
    fetchPromotions(hotelId).then(setList).catch((e) => { setList([]); showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }); });
    fetchRoomTypes(hotelId).then(setRooms).catch(() => setRooms([]));
    fetchMarketGroups(hotelId).then(setGroups).catch(() => setGroups([]));
    fetchRatePlans(hotelId).then(setPlans).catch(() => setPlans([]));
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const run = (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    return fn()
      .then(() => { if (ok) showAlert(ok, { variant: 'success' }); load(); return true; })
      .catch((e) => { showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }); return false; })
      .finally(() => setBusy(false));
  };
  const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(loc, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  const range = (a: string | null, b: string | null) => (a && b ? `${date(a)} – ${date(b)}` : a ? k('fromDate', { date: date(a) }) : b ? k('toDate', { date: date(b) }) : '');
  const benefit = (p: HotelPromotion) => (p.freeNights > 0 ? k('freeShort', { stay: p.minNights, pay: p.minNights - p.freeNights }) : `−${Number(p.discountPct)} %`);
  const bookText = (p: HotelPromotion) => {
    const parts = [range(p.bookFrom, p.bookTo)];
    if (p.minDaysBefore) parts.push(k('leadMin', { n: p.minDaysBefore }));
    if (p.maxDaysBefore !== null && p.maxDaysBefore !== undefined) parts.push(k('leadMax', { n: p.maxDaysBefore }));
    return parts.filter(Boolean).join(' · ') || k('anyBooking');
  };
  const stayText = (p: HotelPromotion) => range(p.stayFrom, p.stayTo) || k('anyStay');
  const prepText = (p: HotelPromotion) => {
    if (!(Number(p.prepaymentPct) > 0)) return '—';
    const pct = `${Number(p.prepaymentPct)} %`;
    return p.prepaymentDueDate ? k('prepUntil', { pct, date: date(p.prepaymentDueDate) }) : p.prepaymentDueDays ? k('prepAfter', { pct, n: p.prepaymentDueDays }) : k('prepNow', { pct });
  };
  const names = (ids: string[], src: Array<{ id: string; name?: string; code?: string }>) => ids.map((id) => src.find((x) => x.id === id)).map((x) => (x ? x.name || x.code : null)).filter(Boolean).join(', ');
  const sorted = useMemo(
    () => [...(list || [])].sort((a, b) => HOTEL_PROMOTION_TYPES.indexOf(a.type) - HOTEL_PROMOTION_TYPES.indexOf(b.type) || a.sortOrder - b.sortOrder),
    [list],
  );

  if (!list) return <div className="rtp-empty"><p>{k('loading')}</p></div>;

  return (
    <div className="rtp-wrap">
      <div className="rtp-bar">
        <p className="htl-sub">{k('lead')}</p>
        <div className="prm-add">
          {HOTEL_PROMOTION_TYPES.map((ty) => (
            <button key={ty} type="button" className={ty === 'early_booking' ? 'btn btn-primary' : 'btn'} onClick={() => setEdit({ id: null, draft: empty(ty) })}>
              <Ic d={HTL_ICON.plus} size={13} />{k(`type.${ty}`)}
            </button>
          ))}
        </div>
      </div>

      {!list.length ? (
        <div className="rtp-empty">
          <h4>{k('emptyTitle')}</h4>
          <p>{k('emptyText')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, draft: empty() })}><Ic d={HTL_ICON.plus} size={13} />{k('type.early_booking')}</button>
        </div>
      ) : (
        <div className="rtp-table-wrap">
          <table className="rtp-table">
            <thead>
              <tr>
                <th>{k('col.promo')}</th>
                <th>{k('col.benefit')}</th>
                <th>{k('col.booking')}</th>
                <th>{k('col.stay')}</th>
                <th>{k('col.prepay')}</th>
                <th>{k('col.where')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'off'} onClick={() => setEdit({ id: p.id, draft: toDraft(p) })}>
                  <td>
                    <div className="rtp-name">
                      <span className={`prm-type t-${p.type}`}>{k(`typeShort.${p.type}`)}</span>
                      <b>{p.name}</b>
                      {p.combinable && <span className="rtp-tag">{k('combinableTag')}</span>}
                      {p.origin === 'import' && <span className="rtp-tag">{k('importTag')}</span>}
                      {!p.active && <span className="rtp-tag">{k('off')}</span>}
                    </div>
                    {p.description ? <div className="htl-sub">{p.description}</div> : null}
                  </td>
                  <td className="mono prm-benefit">{benefit(p)}</td>
                  <td>{bookText(p)}</td>
                  <td>
                    {stayText(p)}
                    <div className="htl-sub">
                      {[(p.stayFrom || p.stayTo) && k(`rule.${p.stayRule}`), p.minNights > 1 && k('minNightsShort', { n: p.minNights }), p.maxNights && k('maxNightsShort', { n: p.maxNights })].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td>{prepText(p)}</td>
                  <td className="htl-sub">
                    {[
                      p.marketGroupIds.length ? names(p.marketGroupIds, groups) : k('allMarkets'),
                      p.roomTypeIds.length ? names(p.roomTypeIds, rooms) : null,
                      p.ratePlanIds.length ? names(p.ratePlanIds, plans.map((x) => ({ id: x.id, name: x.code }))) : null,
                      [p.sellDirect && k('whereDirect'), p.sellWebsite && k('whereWebsite')].filter(Boolean).join(' + '),
                    ].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length > 0 && rooms.length > 0 && <PromoCheck hotelId={hotelId} rooms={rooms} groups={groups} plans={plans} currency={currency} date={date} />}

      {edit && (
        <PromotionSheet
          rooms={rooms}
          groups={groups}
          plans={plans}
          initial={edit.draft}
          promo={edit.id ? list.find((p) => p.id === edit.id) || null : null}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={(d) => run(() => (edit.id ? updatePromotion(edit.id, toInput(d)) : createPromotion({ ...toInput(d), hotelId })), k('saved')).then((ok) => ok && setEdit(null))}
          onDelete={async () => {
            if (!edit.id) return;
            if (!(await showConfirm(k('deleteBody'), { title: k('delete'), confirmLabel: k('delete'), danger: true }))) return;
            const ok = await run(() => deletePromotion(edit.id!), k('deleted'));
            if (ok) setEdit(null);
          }}
        />
      )}
    </div>
  );
};

/** Проверка на примере брони: цена с акциями и без, и по каждой акции — сработала ли и почему нет */
const PromoCheck: React.FC<{
  hotelId: string;
  rooms: HotelRoomType[];
  groups: HotelMarketGroup[];
  plans: HotelRatePlan[];
  currency?: string | null;
  date: (iso: string) => string;
}> = ({ hotelId, rooms, groups, plans, currency, date }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.promos.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const today = isoToday();
  const [q, setQ] = useState({ roomTypeId: rooms.find((r) => r.isBaseRoomType)?.id || rooms[0]?.id || '', checkIn: addDays(today, 30), checkOut: addDays(today, 37), bookedOn: today, marketGroupId: '', ratePlanId: '', salesChannel: 'direct' as 'direct' | 'website' });
  const [res, setRes] = useState<HotelPromotionCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (p: Partial<typeof q>) => { setQ((x) => ({ ...x, ...p })); setRes(null); };
  const money = (v: number) => `${v.toLocaleString(loc, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
  const go = () => {
    if (!q.roomTypeId || !q.checkIn || !q.checkOut || q.checkOut <= q.checkIn) return;
    setLoading(true);
    setErr(null);
    checkPromotions({ hotelId, roomTypeId: q.roomTypeId, checkIn: q.checkIn, checkOut: q.checkOut, bookedOn: q.bookedOn || undefined, marketGroupId: q.marketGroupId || null, ratePlanId: q.ratePlanId || null, salesChannel: q.salesChannel, adults: 2 })
      .then(setRes)
      .catch((e) => { setRes(null); setErr(hotelErrorText(t, e, k('checkError'))); })
      .finally(() => setLoading(false));
  };
  const hasNoPrice = res?.warnings.some((w) => w.code === 'no_price');

  return (
    <div className="prm-check">
      <div className="prm-check-head">
        <h4>{k('checkTitle')}</h4>
        <span className="htl-sub">{k('checkHint')}</span>
      </div>
      <div className="prm-check-form">
        <div className="htl-f"><label>{k('checkRoom')}</label>
          <select value={q.roomTypeId} onChange={(e) => set({ roomTypeId: e.target.value })}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <div className="htl-f"><label>{k('checkIn')}</label><DateInput value={q.checkIn} clearable={false} onChange={(v) => set({ checkIn: v, checkOut: v && q.checkOut <= v ? addDays(v, 7) : q.checkOut })} /></div>
        <div className="htl-f"><label>{k('checkOut')}</label><DateInput value={q.checkOut} clearable={false} min={q.checkIn ? addDays(q.checkIn, 1) : undefined} onChange={(v) => set({ checkOut: v })} /></div>
        <div className="htl-f"><label>{k('checkBookedOn')}</label><DateInput value={q.bookedOn} clearable={false} onChange={(v) => set({ bookedOn: v })} /></div>
        <div className="htl-f"><label>{k('checkGroup')}</label>
          <select value={q.marketGroupId} onChange={(e) => set({ marketGroupId: e.target.value })}>
            <option value="">{k('checkNoGroup')}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="htl-f"><label>{k('checkPlan')}</label>
          <select value={q.ratePlanId} onChange={(e) => set({ ratePlanId: e.target.value })}>
            <option value="">{k('checkDefaultPlan')}</option>
            <option value="none">{k('checkNoPlan')}</option>
            {plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        <div className="htl-f"><label>{k('checkChannel')}</label>
          <div className="htl-seg">
            <button type="button" className={q.salesChannel === 'direct' ? 'on' : ''} onClick={() => set({ salesChannel: 'direct' })}>{k('whereDirect')}</button>
            <button type="button" className={q.salesChannel === 'website' ? 'on' : ''} onClick={() => set({ salesChannel: 'website' })}>{k('whereWebsite')}</button>
          </div>
        </div>
        <div className="htl-f prm-check-go"><button type="button" className="btn btn-primary" disabled={loading || !q.roomTypeId || q.checkOut <= q.checkIn} onClick={go}>{loading ? k('checking') : k('checkBtn')}</button></div>
      </div>
      {err && <div className="pe-box warn">{err}</div>}
      {res && (
        <div className="prm-check-res">
          {hasNoPrice ? (
            <div className="pe-box warn">{k('checkNoPrice')}</div>
          ) : (
            <div className="prm-sum">
              <div><span className="htl-sub">{k('sumBefore')}</span><b className={res.promoDiscount > 0 ? 'old' : ''}>{money(res.totalBeforePromo)}</b></div>
              <div><span className="htl-sub">{k('sumDiscount')}</span><b className={res.promoDiscount > 0 ? 'neg' : ''}>{res.promoDiscount > 0 ? `−${money(res.promoDiscount)}` : '—'}</b></div>
              <div><span className="htl-sub">{k('sumTotal')}</span><b>{money(res.total)}</b></div>
              <div><span className="htl-sub">{k('sumPrepay')}</span><b>{res.prepayment && res.prepayment.amount > 0 ? `${money(res.prepayment.amount)}${res.prepayment.dueDate ? ` · ${k('until', { date: date(res.prepayment.dueDate) })}` : ''}` : '—'}</b></div>
            </div>
          )}
          {res.warnings.some((w) => w.code === 'below_budget') && <div className="pe-box warn">{k('belowBudget', { count: res.warnings.find((w) => w.code === 'below_budget')!.dates.length })}</div>}
          <ul className="prm-status">
            {res.promotions.map((p) => (
              <li key={p.id} className={p.applied ? 'on' : ''}>
                <span className="prm-dot" aria-hidden="true" />
                <b>{p.name}</b>
                <span className="htl-sub">{p.applied ? k('applied', { amount: money(p.amount) }) : p.blockers.map((b) => k(`blocker.${b}`)).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const PromotionSheet: React.FC<{
  rooms: HotelRoomType[];
  groups: HotelMarketGroup[];
  plans: HotelRatePlan[];
  initial: Draft;
  promo: HotelPromotion | null;
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}> = ({ rooms, groups, plans, initial, promo, busy, onClose, onSave, onDelete }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.promos.${key}`, o);
  const [d, setD] = useState<Draft>(initial);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const intOk = (v: string, min: number, max: number) => v.trim() === '' || (Number.isInteger(n(v)) && n(v) >= min && n(v) <= max);
  const minN = Math.round(n(d.minNights)) || 1;
  const errors = [
    !d.name.trim() && k('err.name'),
    d.benefit === 'percent' && !(n(d.discountPct) > 0 && n(d.discountPct) <= 90) && k('err.discount'),
    d.benefit === 'free' && !(n(d.freeNights) >= 1 && n(d.freeNights) < minN) && k('err.free'),
    d.bookFrom && d.bookTo && d.bookTo < d.bookFrom && k('err.bookRange'),
    d.stayFrom && d.stayTo && d.stayTo < d.stayFrom && k('err.stayRange'),
    (!intOk(d.minDaysBefore, 0, 730) || !intOk(d.maxDaysBefore, 0, 730)) && k('err.days'),
    !intOk(d.minNights, 1, 60) && k('err.minNights'),
    d.maxNights.trim() !== '' && (!intOk(d.maxNights, 1, 365) || n(d.maxNights) < minN) && k('err.maxNights'),
    d.type === 'early_booking' && !d.bookTo && !(n(d.minDaysBefore) > 0) && k('err.eb'),
    d.type === 'last_minute' && d.maxDaysBefore.trim() === '' && k('err.lm'),
    d.type === 'long_stay' && minN < 2 && k('err.ls'),
    d.prepaymentPct.trim() !== '' && !(n(d.prepaymentPct) >= 0 && n(d.prepaymentPct) <= 100) && k('err.prepay'),
    n(d.prepaymentPct) > 0 && d.prepayDue === 'date' && !d.prepaymentDueDate && k('err.prepayDue'),
    !d.sellDirect && !d.sellWebsite && k('err.channel'),
  ].filter(Boolean) as string[];
  const toggle = (key: 'marketGroupIds' | 'roomTypeIds' | 'ratePlanIds', id: string) => set({ [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] } as Partial<Draft>);
  const example = d.benefit === 'free' ? k('freeExample', { stay: minN, pay: Math.max(0, minN - (Math.round(n(d.freeNights)) || 0)) }) : '';

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet" role="dialog" aria-modal="true">
        <div className="htl-sheet-head">
          <div>
            <h3>{promo ? promo.name : k('newTitle')}</h3>
            <div className="htl-sub" style={{ marginTop: 4 }}>{k(`typeHint.${d.type}`)}</div>
          </div>
          <button onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secMain')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('type.label')}</label>
              <div className="htl-seg prm-seg-wrap">
                {HOTEL_PROMOTION_TYPES.map((ty) => (
                  <button key={ty} type="button" className={d.type === ty ? 'on' : ''} onClick={() => set({ type: ty, ...(ty === 'long_stay' && minN < 2 ? { minNights: '7' } : {}), ...(ty === 'last_minute' && d.maxDaysBefore.trim() === '' ? { maxDaysBefore: '7' } : {}) })}>{k(`type.${ty}`)}</button>
                ))}
              </div>
            </div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('name')} *</label><input value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder={k(`namePh.${d.type}`)} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('description')}</label><textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secBenefit')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <div className="htl-seg">
                <button type="button" className={d.benefit === 'percent' ? 'on' : ''} onClick={() => set({ benefit: 'percent' })}>{k('benefitPercent')}</button>
                <button type="button" className={d.benefit === 'free' ? 'on' : ''} onClick={() => set({ benefit: 'free', ...(minN < 2 ? { minNights: '7' } : {}) })}>{k('benefitFree')}</button>
              </div>
            </div>
            {d.benefit === 'percent' ? (
              <div className="htl-f"><label>{k('discountPct')}</label><input inputMode="decimal" value={d.discountPct} onChange={(e) => set({ discountPct: e.target.value })} placeholder="20" /></div>
            ) : (
              <>
                <div className="htl-f"><label>{k('freeStay')}</label><input type="number" min={2} max={60} value={d.minNights} onChange={(e) => set({ minNights: e.target.value })} /></div>
                <div className="htl-f"><label>{k('freeNights')}</label><input type="number" min={1} max={14} value={d.freeNights} onChange={(e) => set({ freeNights: e.target.value })} /></div>
                <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{example}</div>
              </>
            )}

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secBooking')}</div>
            <div className="htl-f"><label>{k('bookFrom')}</label><DateInput value={d.bookFrom} max={d.bookTo || undefined} onChange={(v) => set({ bookFrom: v })} /></div>
            <div className="htl-f"><label>{k('bookTo')}</label><DateInput value={d.bookTo} min={d.bookFrom || undefined} onChange={(v) => set({ bookTo: v })} /></div>
            <div className="htl-f"><label>{k('minDaysBefore')}</label><input type="number" min={0} max={730} value={d.minDaysBefore} onChange={(e) => set({ minDaysBefore: e.target.value })} placeholder="—" /></div>
            <div className="htl-f"><label>{k('maxDaysBefore')}</label><input type="number" min={0} max={730} value={d.maxDaysBefore} onChange={(e) => set({ maxDaysBefore: e.target.value })} placeholder="—" /></div>
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k(`bookHint.${d.type}`)}</div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secStay')}</div>
            <div className="htl-f"><label>{k('stayFrom')}</label><DateInput value={d.stayFrom} max={d.stayTo || undefined} onChange={(v) => set({ stayFrom: v })} /></div>
            <div className="htl-f"><label>{k('stayTo')}</label><DateInput value={d.stayTo} min={d.stayFrom || undefined} onChange={(v) => set({ stayTo: v })} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('stayRuleLabel')}</label>
              <div className="htl-seg">
                <button type="button" className={d.stayRule === 'nights' ? 'on' : ''} onClick={() => set({ stayRule: 'nights' })}>{k('rule.nights')}</button>
                <button type="button" className={d.stayRule === 'arrival' ? 'on' : ''} onClick={() => set({ stayRule: 'arrival' })}>{k('rule.arrival')}</button>
              </div>
              <div className="htl-hint" style={{ marginTop: 6 }}>{k(`ruleHint.${d.stayRule}`)}</div>
            </div>
            {d.benefit === 'percent' && <div className="htl-f"><label>{k('minNights')}</label><input type="number" min={1} max={60} value={d.minNights} onChange={(e) => set({ minNights: e.target.value })} /></div>}
            <div className="htl-f"><label>{k('maxNights')}</label><input type="number" min={1} max={365} value={d.maxNights} onChange={(e) => set({ maxNights: e.target.value })} placeholder="—" /></div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secCombine')}</div>
            <label className="rtp-check"><input type="checkbox" checked={d.combinable} onChange={(e) => set({ combinable: e.target.checked })} />{k('combinable')}</label>
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('combineHint')}</div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secPrepay')}</div>
            <div className="htl-f"><label>{k('prepaymentPct')}</label><input inputMode="decimal" value={d.prepaymentPct} onChange={(e) => set({ prepaymentPct: e.target.value })} placeholder="—" /></div>
            {n(d.prepaymentPct) > 0 ? (
              <div className="htl-f"><label>{k('prepayDue')}</label>
                <div className="htl-seg" style={{ marginBottom: 6 }}>
                  <button type="button" className={d.prepayDue === 'date' ? 'on' : ''} onClick={() => set({ prepayDue: 'date' })}>{k('prepayDueDate')}</button>
                  <button type="button" className={d.prepayDue === 'days' ? 'on' : ''} onClick={() => set({ prepayDue: 'days' })}>{k('prepayDueDays')}</button>
                </div>
                {d.prepayDue === 'date'
                  ? <DateInput value={d.prepaymentDueDate} onChange={(v) => set({ prepaymentDueDate: v })} />
                  : <div className="rtp-inline"><input type="number" min={0} max={365} value={d.prepaymentDueDays} onChange={(e) => set({ prepaymentDueDays: e.target.value })} /><span className="htl-sub">{k('daysAfterBooking')}</span></div>}
              </div>
            ) : <div className="htl-f" />}
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('prepayHint')}</div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secWhere')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('markets')}</label>
              <div className="rtp-chips">
                <button type="button" className={`rtp-chip${!d.marketGroupIds.length ? ' on' : ''}`} onClick={() => set({ marketGroupIds: [] })}>{k('allMarkets')}</button>
                {groups.map((g) => <button key={g.id} type="button" className={`rtp-chip${d.marketGroupIds.includes(g.id) ? ' on' : ''}`} onClick={() => toggle('marketGroupIds', g.id)}>{g.name}</button>)}
              </div>
            </div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('rooms')}</label>
              <div className="rtp-chips">
                <button type="button" className={`rtp-chip${!d.roomTypeIds.length ? ' on' : ''}`} onClick={() => set({ roomTypeIds: [] })}>{k('allRooms')}</button>
                {rooms.map((r) => <button key={r.id} type="button" className={`rtp-chip${d.roomTypeIds.includes(r.id) ? ' on' : ''}`} onClick={() => toggle('roomTypeIds', r.id)}>{r.name}</button>)}
              </div>
            </div>
            {plans.length > 0 && (
              <div className="htl-f" style={{ gridColumn: 'span 2' }}>
                <label>{k('plans')}</label>
                <div className="rtp-chips">
                  <button type="button" className={`rtp-chip${!d.ratePlanIds.length ? ' on' : ''}`} onClick={() => set({ ratePlanIds: [] })}>{k('allPlans')}</button>
                  {plans.map((p) => <button key={p.id} type="button" className={`rtp-chip${d.ratePlanIds.includes(p.id) ? ' on' : ''}`} onClick={() => toggle('ratePlanIds', p.id)}>{p.code}</button>)}
                </div>
              </div>
            )}
            <label className="rtp-check"><input type="checkbox" checked={d.sellDirect} onChange={(e) => set({ sellDirect: e.target.checked })} />{k('sellDirect')}</label>
            <label className="rtp-check"><input type="checkbox" checked={d.sellWebsite} onChange={(e) => set({ sellWebsite: e.target.checked })} />{k('sellWebsite')}</label>
            <label className="rtp-check"><input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />{k('active')}</label>
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('partnersHint')}</div>
          </div>
          {errors.length > 0 && <div className="pe-box warn" style={{ marginTop: 12 }}>{errors.map((x) => <div key={x}>{x}</div>)}</div>}
        </div>
        <div className="htl-sheet-foot">
          {promo && <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete} style={{ marginRight: 'auto' }}>{k('delete')}</button>}
          <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || errors.length > 0} onClick={() => onSave(d)}><Ic d={HTL_ICON.check} size={14} />{k('save')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
