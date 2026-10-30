import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountryMultiSelect } from '../CountrySelect';
import { fmtDate, todayIso, addDaysIso } from './partnerUtils';
import {
  createContract,
  deleteContract,
  duplicateContract,
  fetchContract,
  fetchContractUsage,
  fetchHotels,
  fetchPartners,
  fetchRoomTypes,
  updateContract,
  HOTEL_BOARD_TYPES,
  type Hotel,
  type HotelAgency,
  type HotelContract,
  type HotelContractRoom,
  type HotelContractUsage,
  type HotelContractPromotion,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';
import { ChildPolicyEditor } from '../pricing/ChildPolicyEditor';

type Draft = Omit<HotelContract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

const newDraft = (agencyId: string, hotelId: string, commissionPct: string): Draft => {
  const y = new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0);
  return {
    agencyId,
    hotelId,
    name: `${y}`,
    code: null,
    status: 'draft',
    validFrom: `${y}-04-01`,
    validTo: `${y}-10-31`,
    bookingFrom: null,
    bookingTo: null,
    pricing: 'commission',
    commissionPct,
    boardType: 'AI',
    currency: null,
    releaseDays: 7,
    guaranteed: false,
    allowOverAllotment: true,
    minStay: 1,
    marketCountries: [],
    rooms: [],
    cancellationPolicy: [
      { daysBefore: 14, penaltyType: 'percent', value: 50 },
      { daysBefore: 3, penaltyType: 'percent', value: 100 },
    ],
    childPolicy: [
      { ageFrom: 0, ageTo: 2, type: 'free', value: 0 },
      { ageFrom: 2, ageTo: 12, type: 'percent', value: 50 },
    ],
    promotions: [],
    notes: null,
  };
};

const F: React.FC<{ label: string; children: React.ReactNode; span?: number; hint?: string }> = ({ label, children, span = 1, hint }) => (
  <div className="htl-f" style={{ gridColumn: `span ${span}` }}>
    <label>{label}</label>
    {children}
    {hint && <div className="htl-hint">{hint}</div>}
  </div>
);

/** Даты диапазона включительно. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDaysIso(d, 1)) out.push(d);
  return out;
}

const RoomDatesEditor: React.FC<{ line: HotelContractRoom; onChange: (l: HotelContractRoom) => void }> = ({ line, onChange }) => {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`crm.hotels.contracts.${k}`);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rooms, setRooms] = useState('0');
  const overrides = Object.entries(line.dateOverrides || {}).sort(([a], [b]) => a.localeCompare(b));
  const range = from && to && to >= from ? datesBetween(from, to) : from ? [from] : [];
  return (
    <div className="htl-dates-ed">
      <div className="htl-toolbar" style={{ margin: 0 }}>
        <DateInput className="htl-date" value={from} onChange={(v) => setFrom(v)}  inline clearable={false} />
        <span className="htl-sub">—</span>
        <DateInput className="htl-date" value={to} onChange={(v) => setTo(v)}  inline clearable={false} />
        <input type="number" min={0} className="htl-date" style={{ width: 80 }} value={rooms} onChange={(e) => setRooms(e.target.value)} />
        <button
          type="button"
          className="btn btn-sm"
          disabled={!range.length}
          onClick={() => onChange({ ...line, dateOverrides: { ...line.dateOverrides, ...Object.fromEntries(range.map((d) => [d, Number(rooms) || 0])) } })}
        >
          {c('setAllotment')}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!range.length}
          onClick={() => onChange({ ...line, stopDates: [...new Set([...(line.stopDates || []), ...range])].sort() })}
        >
          {c('addStop')}
        </button>
      </div>
      {(overrides.length > 0 || line.stopDates?.length > 0) && (
        <div className="htl-chips">
          {overrides.map(([d, n]) => (
            <span key={d} className="htl-chip">
              {fmtDate(d, i18n.language)}: <b>{n}</b>
              <button
                type="button"
                onClick={() => {
                  const next = { ...line.dateOverrides };
                  delete next[d];
                  onChange({ ...line, dateOverrides: next });
                }}
              >
                ×
              </button>
            </span>
          ))}
          {(line.stopDates || []).map((d) => (
            <span key={`s${d}`} className="htl-chip stop">
              {c('stop')} {fmtDate(d, i18n.language)}
              <button type="button" onClick={() => onChange({ ...line, stopDates: line.stopDates.filter((x) => x !== d) })}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const HotelContractPage: React.FC = () => {
  const { id = 'new' } = useParams();
  const [sp] = useSearchParams();
  const isNew = id === 'new';
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.contracts.${k}`, o);
  const lang = i18n.language;
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [partners, setPartners] = useState<HotelAgency[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [saved, setSaved] = useState<HotelContract | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [usage, setUsage] = useState<HotelContractUsage | null>(null);
  const [openDates, setOpenDates] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetchPartners(), fetchHotels()])
      .then(async ([ps, hs]) => {
        setPartners(ps);
        setHotels(hs);
        if (isNew) {
          const agencyId = sp.get('agencyId') || ps[0]?.id || '';
          const partner = ps.find((x) => x.id === agencyId);
          setDraft(newDraft(agencyId, sp.get('hotelId') || hs[0]?.id || '', partner?.commissionPct || '0'));
        } else {
          const x = await fetchContract(id);
          setSaved(x);
          setDraft(x);
          fetchContractUsage(id, todayIso(), addDaysIso(todayIso(), 60)).then(setUsage).catch(() => undefined);
        }
      })
      .catch((e) => showAlert(e.message, { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (draft?.hotelId) fetchRoomTypes(draft.hotelId).then(setRoomTypes).catch(() => setRoomTypes([]));
  }, [draft?.hotelId]);

  const partner = partners.find((x) => x.id === draft?.agencyId);
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const lineOf = (rtId: string) => draft?.rooms.find((r) => r.roomTypeId === rtId);
  const setLine = (rtId: string, patch: Partial<HotelContractRoom> | null) =>
    setDraft((d) => {
      if (!d) return d;
      if (patch === null) return { ...d, rooms: d.rooms.filter((r) => r.roomTypeId !== rtId) };
      const exists = d.rooms.some((r) => r.roomTypeId === rtId);
      const base: HotelContractRoom = { roomTypeId: rtId, allotment: 0, releaseDays: null, rate: null, dateOverrides: {}, stopDates: [] };
      return { ...d, rooms: exists ? d.rooms.map((r) => (r.roomTypeId === rtId ? { ...r, ...patch } : r)) : [...d.rooms, { ...base, ...patch }] };
    });
  const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft);
  const rtName = useMemo(() => new Map(roomTypes.map((r) => [r.id, r.name])), [roomTypes]);

  const save = async () => {
    if (!draft) return;
    if (!draft.agencyId || !draft.hotelId) return showAlert(c('pickPartnerHotel'), { variant: 'error' });
    setBusy(true);
    try {
      if (isNew) {
        const x = await createContract(draft);
        showAlert(c('created'), { variant: 'success' });
        navigate(`/hotels/contracts/${x.id}`, { replace: true });
      } else {
        const x = await updateContract(id, draft);
        setSaved(x);
        setDraft(x);
        fetchContractUsage(id, todayIso(), addDaysIso(todayIso(), 60)).then(setUsage).catch(() => undefined);
        showAlert(c('saved'), { variant: 'success' });
      }
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <MainLayout>
        <div className="px-scope"><HotelsSubnav active="partners" /><div className="htl-sub" style={{ padding: 24 }}>{t('crm.hotels.common.loading')}</div></div>
      </MainLayout>
    );
  }

  const totalAllot = draft.rooms.reduce((s, r) => s + (Number(r.allotment) || 0), 0);

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="partners" />
        <div className="htl-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              <button className="htl-crumb" onClick={() => navigate('/hotels/partners')}>{t('crm.hotels.partners.title')}</button>
              {partner && (
                <>
                  {' · '}
                  <button className="htl-crumb" onClick={() => navigate(`/hotels/partners/${partner.id}?tab=contracts`)}>{partner.name}</button>
                </>
              )}
            </div>
            <h1>{isNew ? c('newTitle') : draft.name}</h1>
            <p className="sub">
              {hotels.find((h) => h.id === draft.hotelId)?.name || '—'} · {fmtDate(draft.validFrom, lang)} — {fmtDate(draft.validTo, lang)} · {c('allotTotal', { n: totalAllot })}
            </p>
          </div>
          <div className="htl-hero-r">
            {!isNew && (
              <>
                <button className="btn" onClick={() => duplicateContract(id).then((x) => navigate(`/hotels/contracts/${x.id}`)).catch((e) => showAlert(e.message, { variant: 'error' }))}>
                  <Ic d={HTL_ICON.copy} size={13} />{c('duplicate')}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (!window.confirm(c('deleteConfirm'))) return;
                    deleteContract(id)
                      .then((r) => {
                        showAlert(r.cancelled ? c('cancelledMsg') : c('deletedMsg'), { variant: 'success' });
                        navigate(`/hotels/partners/${draft.agencyId}?tab=contracts`);
                      })
                      .catch((e) => showAlert(e.message, { variant: 'error' }));
                  }}
                >
                  {c('delete')}
                </button>
              </>
            )}
            <button className="btn btn-primary" disabled={!dirty || busy} onClick={save}>
              <Ic d={HTL_ICON.check} size={14} />{isNew ? c('create') : t('crm.hotels.common.save')}
            </button>
          </div>
        </div>

        <div className="htl-cols">
          <div className="htl-col-main">
            <div className="htl-panel">
              <h3 className="htl-h3">{c('secMain')}</h3>
              <div className="htl-form" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                <F label={c('partner')}>
                  <select value={draft.agencyId} onChange={(e) => set({ agencyId: e.target.value })} disabled={!isNew}>
                    {partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </F>
                <F label={c('hotel')}>
                  <select value={draft.hotelId} onChange={(e) => set({ hotelId: e.target.value, rooms: [] })} disabled={!isNew}>
                    {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </F>
                <F label={c('name')}><input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></F>
                <F label={c('code')}><input value={draft.code || ''} onChange={(e) => set({ code: e.target.value || null })} placeholder="S26-TUI" /></F>
                <F label={c('validFrom')}><DateInput value={draft.validFrom} onChange={(v) => set({ validFrom: v })} /></F>
                <F label={c('validTo')}><DateInput value={draft.validTo} onChange={(v) => set({ validTo: v })} /></F>
                <F label={c('bookingFrom')} hint={c('bookingWindowHint')}><DateInput value={draft.bookingFrom || ''} onChange={(v) => set({ bookingFrom: v || null })} /></F>
                <F label={c('bookingTo')}><DateInput value={draft.bookingTo || ''} onChange={(v) => set({ bookingTo: v || null })} /></F>
                <F label={c('statusLabel')}>
                  <select value={draft.status} onChange={(e) => set({ status: e.target.value as Draft['status'] })}>
                    {(['draft', 'active', 'expired', 'cancelled'] as const).map((s) => <option key={s} value={s}>{c(`status.${s}`)}</option>)}
                  </select>
                </F>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{c('secTerms')}</h3>
              <div className="htl-form" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                <F label={c('pricingLabel')} hint={draft.pricing === 'net' ? c('pricingNetHint') : c('pricingCommissionHint')}>
                  <div className="htl-seg">
                    {(['commission', 'net'] as const).map((x) => (
                      <button key={x} type="button" className={draft.pricing === x ? 'on' : ''} onClick={() => set({ pricing: x })}>{c(`pricing.${x}`)}</button>
                    ))}
                  </div>
                </F>
                <F label={c('commission')}>
                  <input type="number" min={0} max={100} step="0.5" value={draft.commissionPct} disabled={draft.pricing === 'net'} onChange={(e) => set({ commissionPct: e.target.value })} />
                </F>
                <F label={c('board')}>
                  <select value={draft.boardType} onChange={(e) => set({ boardType: e.target.value as Draft['boardType'] })}>
                    {HOTEL_BOARD_TYPES.map((b) => <option key={b} value={b}>{b} · {t(`crm.hotels.board.${b}`)}</option>)}
                  </select>
                </F>
                <F label={c('currency')}><input value={draft.currency || ''} maxLength={3} placeholder={partner?.currency || 'EUR'} style={{ textTransform: 'uppercase' }} onChange={(e) => set({ currency: e.target.value || null })} /></F>
                <F label={c('release')} hint={c('releaseHint')}><input type="number" min={0} max={365} value={draft.releaseDays} onChange={(e) => set({ releaseDays: Number(e.target.value) })} /></F>
                <F label={c('minStay')}><input type="number" min={1} max={60} value={draft.minStay} onChange={(e) => set({ minStay: Number(e.target.value) })} /></F>
                <F label={c('guaranteed')} hint={c('guaranteedHint')}>
                  <label className="htl-check"><input type="checkbox" checked={draft.guaranteed} onChange={(e) => set({ guaranteed: e.target.checked })} />{c('guaranteedOn')}</label>
                </F>
                <F label={c('overAllotment')} hint={c('overAllotmentHint')}>
                  <label className="htl-check"><input type="checkbox" checked={draft.allowOverAllotment} onChange={(e) => set({ allowOverAllotment: e.target.checked })} />{c('overAllotmentOn')}</label>
                </F>
                <F label={c('markets')} span={4} hint={c('marketsHint')}>
                  <CountryMultiSelect value={draft.marketCountries} onChange={(v) => set({ marketCountries: v })} placeholder={c('allCountries')} />
                </F>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{c('secRooms')}</h3>
              <p className="htl-sub" style={{ margin: '-4px 0 10px' }}>{draft.pricing === 'net' ? c('roomsHintNet') : c('roomsHintCommission')}</p>
              {roomTypes.length === 0 ? (
                <div className="htl-sub">{c('noRoomTypes')}</div>
              ) : (
                <div className="bk-table-wrap">
                  <table className="bk-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }} />
                        <th>{c('col.roomType')}</th>
                        <th>{c('col.allotmentPerNight')}</th>
                        <th>{c('col.releaseOverride')}</th>
                        <th>{draft.pricing === 'net' ? c('col.netRate') : c('col.grossRate')}</th>
                        <th>{c('col.specialDates')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomTypes.map((rt) => {
                        const line = lineOf(rt.id);
                        return (
                          <React.Fragment key={rt.id}>
                            <tr className={line ? undefined : 'muted'}>
                              <td><input type="checkbox" checked={!!line} onChange={(e) => setLine(rt.id, e.target.checked ? {} : null)} /></td>
                              <td style={{ fontWeight: 600 }}>{rt.name}<div className="htl-sub">{c('capacity', { n: rt.quantity })}</div></td>
                              <td><input className="htl-cell-in" type="number" min={0} disabled={!line} value={line?.allotment ?? ''} onChange={(e) => setLine(rt.id, { allotment: Number(e.target.value) })} /></td>
                              <td><input className="htl-cell-in" type="number" min={0} disabled={!line} placeholder={String(draft.releaseDays)} value={line?.releaseDays ?? ''} onChange={(e) => setLine(rt.id, { releaseDays: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                              <td><input className="htl-cell-in" type="number" min={0} disabled={!line} placeholder={c('fromPricelist')} value={line?.rate ?? ''} onChange={(e) => setLine(rt.id, { rate: e.target.value === '' ? null : e.target.value })} /></td>
                              <td>
                                {line && (
                                  <button type="button" className="btn btn-sm" onClick={() => setOpenDates(openDates === rt.id ? null : rt.id)}>
                                    {c('dates', { n: Object.keys(line.dateOverrides || {}).length + (line.stopDates || []).length })}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {line && openDates === rt.id && (
                              <tr>
                                <td />
                                <td colSpan={5}><RoomDatesEditor line={line} onChange={(l) => setLine(rt.id, l)} /></td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="htl-grid2">
              <div className="htl-panel">
                <h3 className="htl-h3">{c('secCancel')}</h3>
                {draft.cancellationPolicy.map((r, i) => (
                  <div key={i} className="htl-rule">
                    <span>{c('cancelLess')}</span>
                    <input type="number" min={0} value={r.daysBefore} onChange={(e) => set({ cancellationPolicy: draft.cancellationPolicy.map((x, j) => (j === i ? { ...x, daysBefore: Number(e.target.value) } : x)) })} />
                    <span>{c('daysPenalty')}</span>
                    <input type="number" min={0} value={r.value} onChange={(e) => set({ cancellationPolicy: draft.cancellationPolicy.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })} />
                    <select value={r.penaltyType} onChange={(e) => set({ cancellationPolicy: draft.cancellationPolicy.map((x, j) => (j === i ? { ...x, penaltyType: e.target.value as 'percent' | 'nights' } : x)) })}>
                      <option value="percent">%</option>
                      <option value="nights">{c('nights')}</option>
                    </select>
                    <button type="button" className="btn-icon" onClick={() => set({ cancellationPolicy: draft.cancellationPolicy.filter((_, j) => j !== i) })}><Ic d={HTL_ICON.x} size={13} /></button>
                  </div>
                ))}
                <div className="htl-hint" style={{ marginBottom: 8 }}>{draft.cancellationPolicy.length ? c('cancelHint') : c('cancelFree')}</div>
                <button type="button" className="btn btn-sm" onClick={() => set({ cancellationPolicy: [...draft.cancellationPolicy, { daysBefore: 7, penaltyType: 'percent', value: 50 }] })}>
                  <Ic d={HTL_ICON.plus} size={12} />{c('addRule')}
                </button>
              </div>
              <div className="htl-panel">
                <h3 className="htl-h3">{c('secChildren')}</h3>
                <p className="htl-sub" style={{ margin: '-4px 0 10px' }}>{t('crm.hotels.childPolicy.contractHint')}</p>
                <ChildPolicyEditor value={draft.childPolicy} onChange={(v) => set({ childPolicy: v })} />
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{c('secPromos')}</h3>
              <p className="htl-sub" style={{ margin: '-4px 0 10px' }}>{c('promosHint')}</p>
              {(draft.promotions || []).length > 0 && (
                <div className="bk-table-wrap" style={{ marginBottom: 10 }}>
                  <table className="bk-table">
                    <thead>
                      <tr>
                        <th>{c('promo.type')}</th>
                        <th>{c('promo.name')}</th>
                        <th>{c('promo.discount')}</th>
                        <th>{c('promo.bookBy')}</th>
                        <th>{c('promo.stayFrom')}</th>
                        <th>{c('promo.stayTo')}</th>
                        <th>{c('promo.minNights')}</th>
                        <th>{c('promo.combinable')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {draft.promotions.map((pr, i) => {
                        const up = (patch: Partial<HotelContractPromotion>) => set({ promotions: draft.promotions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                        return (
                          <tr key={pr.id}>
                            <td>
                              <select className="htl-cell-in" style={{ maxWidth: 170 }} value={pr.type} onChange={(e) => up({ type: e.target.value as HotelContractPromotion['type'] })}>
                                {(['early_booking', 'spo', 'long_stay'] as const).map((x) => <option key={x} value={x}>{c(`promoType.${x}`)}</option>)}
                              </select>
                            </td>
                            <td><input className="htl-cell-in" style={{ maxWidth: 180, fontFamily: 'inherit' }} value={pr.name} onChange={(e) => up({ name: e.target.value })} /></td>
                            <td><input className="htl-cell-in" style={{ maxWidth: 70 }} type="number" min={0} max={90} value={pr.discountPct} onChange={(e) => up({ discountPct: Number(e.target.value) })} /></td>
                            <td><DateInput className="htl-cell-in" style={{ maxWidth: 140 }} value={pr.bookBy || ''} disabled={pr.type !== 'early_booking'} onChange={(v) => up({ bookBy: v || null })} /></td>
                            <td><DateInput className="htl-cell-in" style={{ maxWidth: 140 }} value={pr.stayFrom || ''} onChange={(v) => up({ stayFrom: v || null })} /></td>
                            <td><DateInput className="htl-cell-in" style={{ maxWidth: 140 }} value={pr.stayTo || ''} onChange={(v) => up({ stayTo: v || null })} /></td>
                            <td><input className="htl-cell-in" style={{ maxWidth: 60 }} type="number" min={1} value={pr.minNights} onChange={(e) => up({ minNights: Number(e.target.value) })} /></td>
                            <td><input type="checkbox" checked={pr.combinable} onChange={(e) => up({ combinable: e.target.checked })} /></td>
                            <td><button type="button" className="btn-icon" onClick={() => set({ promotions: draft.promotions.filter((_, j) => j !== i) })}><Ic d={HTL_ICON.x} size={13} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['early_booking', 'spo', 'long_stay'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      set({
                        promotions: [
                          ...(draft.promotions || []),
                          {
                            id: `p${Date.now().toString(36)}`,
                            type: x,
                            name: c(`promoType.${x}`),
                            discountPct: x === 'early_booking' ? 15 : 10,
                            bookBy: x === 'early_booking' ? addDaysIso(draft.validFrom, -90) : null,
                            stayFrom: null,
                            stayTo: null,
                            minNights: x === 'long_stay' ? 10 : 1,
                            combinable: x === 'long_stay',
                          },
                        ],
                      })
                    }
                  >
                    <Ic d={HTL_ICON.plus} size={12} />{c(`promoType.${x}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{c('notes')}</h3>
              <textarea className="htl-textarea" rows={3} value={draft.notes || ''} onChange={(e) => set({ notes: e.target.value || null })} />
            </div>
          </div>

          <div className="htl-col-side">
            <div className="htl-panel">
              <h3 className="htl-h3">{c('summary')}</h3>
              <dl className="htl-dl">
                <dt>{c('pricingLabel')}</dt><dd>{draft.pricing === 'net' ? c('pricing.net') : `${c('pricing.commission')} ${Number(draft.commissionPct)}%`}</dd>
                <dt>{c('board')}</dt><dd>{draft.boardType}</dd>
                <dt>{c('release')}</dt><dd>{draft.releaseDays} {t('crm.hotels.partners.days')}</dd>
                <dt>{c('allotment')}</dt><dd>{totalAllot} {c('perNight')}</dd>
                <dt>{c('guaranteed')}</dt><dd>{draft.guaranteed ? c('yes') : c('no')}</dd>
                <dt>{c('overAllotment')}</dt><dd>{draft.allowOverAllotment ? c('yes') : c('no')}</dd>
              </dl>
            </div>
            {usage && (
              <div className="htl-panel">
                <h3 className="htl-h3">{c('usageTitle')}</h3>
                <p className="htl-sub" style={{ marginTop: -4 }}>{c('usageSub')}</p>
                {usage.rows.length === 0 && <div className="htl-sub">{c('usageEmpty')}</div>}
                {usage.rows.map((r) => (
                  <div key={r.roomTypeId} className="htl-usage">
                    <div className="htl-usage-head">
                      <b>{rtName.get(r.roomTypeId) || '—'}</b>
                      <span className="mono">{r.totalSold}/{r.totalAllotment} · {r.utilizationPct}%</span>
                    </div>
                    <div className="htl-strip">
                      {r.days.map((d) => (
                        <span
                          key={d.date}
                          title={`${fmtDate(d.date, lang)}: ${d.sold}/${d.allotment}${d.released ? ` · ${c('released')}` : ''}${d.stop ? ` · ${c('stop')}` : ''}`}
                          className={d.stop ? 'stop' : d.released ? 'rel' : d.allotment === 0 ? 'none' : d.sold >= d.allotment ? 'full' : d.sold > 0 ? 'part' : 'free'}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="htl-legend">
                  <span><i className="free" />{c('lgFree')}</span>
                  <span><i className="part" />{c('lgPart')}</span>
                  <span><i className="full" />{c('lgFull')}</span>
                  <span><i className="rel" />{c('released')}</span>
                  <span><i className="stop" />{c('stop')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
