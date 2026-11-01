import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { GuestBadges, GuestPreferences } from './guests/GuestShared';
import { HousekeepingBadge } from './HotelDetailPage';
import { CountrySelect } from './CountrySelect';
import { CancelReservationDialog, NoShowDialog, hotelErrorText } from './ReservationLifecycle';
import { addDaysIso, fmtDate, money, todayIso } from './partners/partnerUtils';
import {
  bulkNoShow,
  checkInReservation,
  checkOutReservation,
  fetchFrontDeskToday,
  fetchHotels,
  fetchRack,
  fetchRoomTypes,
  updateReservation,
  walkIn,
  fetchQuote,
  type HotelQuote,
  HOTEL_BOARD_TYPES,
  type Hotel,
  type HotelFrontDeskToday,
  type HotelRack,
  type HotelReservation,
  type HotelRoomType,
} from '../../api/hotels';
import './hotels-design.css';
import { DateInput } from '../../components/ui/DateInput';
import { GuestsPicker } from './pricing/GuestsPicker';
import { useHotelLive } from './useHotelLive';

type Tab = 'arrivals' | 'departures' | 'inHouse' | 'notArrived' | 'options';
const BLOCKING = new Set(['confirmed', 'pending', 'checked_in']);
const nightsOf = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));
const paidOf = (r: HotelReservation) => (r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

export const HotelFrontDeskPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const fd = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.frontDesk.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [date, setDate] = useState(todayIso());
  const [hotelId, setHotelId] = useState('');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [data, setData] = useState<HotelFrontDeskToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [racks, setRacks] = useState<Record<string, HotelRack>>({});
  const [tab, setTab] = useState<Tab>('arrivals');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unitPick, setUnitPick] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: 'cancel' | 'noShow'; r: HotelReservation } | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const isToday = date === todayIso();

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);
  const unitById = useMemo(() => {
    const m = new Map<string, HotelRack['units'][number]>();
    Object.values(racks).forEach((rk) => rk.units.forEach((u) => m.set(u.id, u)));
    return m;
  }, [racks]);
  const cur = (r: { hotelId: string }) => hotelById.get(r.hotelId)?.currency;

  useEffect(() => {
    fetchHotels()
      .then(async (h) => {
        setHotels(h);
        setRoomTypes((await Promise.all(h.map((x) => fetchRoomTypes(x.id)))).flat());
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    return fetchFrontDeskToday(date, hotelId || undefined)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message || fd('error')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, hotelId]);

  useEffect(() => { void load(); setSelected(new Set()); }, [load]);
  // заезды/выезды других сотрудников и статусы уборки — сразу у всех
  useHotelLive(['reservation', 'unit', 'housekeeping'], () => void load());

  // шахматка нужных отелей на 31 день — номера, их статус уборки и занятость для выбора номера при заселении
  useEffect(() => {
    const ids = hotelId ? [hotelId] : hotels.map((h) => h.id);
    if (!ids.length) return;
    Promise.all(ids.map((id) => fetchRack(id, addDaysIso(date, -1), 31).then((r) => [id, r] as const).catch(() => null)))
      .then((list) => setRacks(Object.fromEntries(list.filter((x): x is readonly [string, HotelRack] => !!x))));
  }, [hotelId, hotels, date, data]);

  const freeUnitsFor = (r: HotelReservation) => {
    const rk = racks[r.hotelId];
    if (!rk) return [];
    return rk.units.filter((u) => u.roomTypeId === r.roomTypeId && u.active && u.housekeepingStatus !== 'out_of_order' &&
      !rk.reservations.some((o) => o.id !== r.id && o.roomUnitId === u.id && BLOCKING.has(o.status) && o.checkIn < r.checkOut && o.checkOut > r.checkIn));
  };

  const run = (id: string, fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusyId(id);
    return fn()
      .then(() => { showAlert(ok, { variant: 'success' }); return load(); })
      .catch((e) => showAlert(hotelErrorText(t, e, fail), { variant: 'error' }))
      .finally(() => setBusyId(null));
  };

  const doCheckIn = (r: HotelReservation) => {
    const unitId = unitPick[r.id] ?? r.roomUnitId ?? '';
    if (!unitId) { showAlert(fd('pickRoomFirst'), { variant: 'error' }); return; }
    void run(r.id, () => checkInReservation(r.id, unitId), fd('checkedIn', { name: r.guestName }), fd('arrivals.checkInError'));
  };

  const doCheckOut = async (r: HotelReservation) => {
    const due = Number(r.total) + (Number(r.extrasTotal) || 0) - paidOf(r);
    if (due > 0.009) {
      const ok = await showConfirm(fd('dueConfirm', { due: money(due, cur(r), lang), name: r.guestName }), { title: fd('dueTitle'), confirmLabel: fd('departures.checkOut'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
      if (!ok) return;
    }
    void run(r.id, () => checkOutReservation(r.id), fd('checkedOut', { name: r.guestName }), fd('departures.checkOutError'));
  };

  const doBulkNoShow = async (feeMode: 'none' | 'first_night') => {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await showConfirm(fd(feeMode === 'none' ? 'bulk.confirmNoFee' : 'bulk.confirmFee', { count: ids.length }), { title: fd('bulk.title'), confirmLabel: fd('bulk.apply'), cancelLabel: t('crm.hotels.common.cancel') });
    if (!ok) return;
    setBusyId('bulk');
    try {
      const res = await bulkNoShow(ids, feeMode);
      showAlert(fd('bulk.done', { done: res.done.length, failed: res.failed.length }), { variant: res.failed.length ? 'error' : 'success' });
      setSelected(new Set());
      await load();
    } catch (e) {
      showAlert(hotelErrorText(t, e, fd('bulk.error')), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const roomCell = (r: HotelReservation) => {
    const u = r.roomUnitId ? unitById.get(r.roomUnitId) : null;
    return (
      <div className="htl-fd-room">
        {u ? <span className="u"><HousekeepingBadge status={u.housekeepingStatus} title={t(`crm.hotels.detail.housekeeping.${u.housekeepingStatus}`)} />{u.label}</span> : <span className="none">{fd('noRoom')}</span>}
        <em>{roomTypeById.get(r.roomTypeId)?.name || '—'}{!hotelId && hotelById.get(r.hotelId) ? ` · ${hotelById.get(r.hotelId)!.name}` : ''}</em>
      </div>
    );
  };

  const guestCell = (r: HotelReservation) => {
    const gp = r.guestProfileId ? data?.guestProfiles?.[r.guestProfileId] : undefined;
    return (
    <div className="htl-fd-guest">
      <span className="gp-name"><b>{r.guestName}</b>{gp && <GuestBadges g={gp} compact />}</span>
      {gp && (gp.preferences.length > 0 || gp.allergies) && <GuestPreferences list={gp.preferences} allergies={gp.allergies} />}
      <em>
        {r.bookingCode ? `${r.bookingCode} · ` : ''}{fd('paxShort', { pax: r.pax, children: r.children || 0 })}{r.boardType ? ` · ${r.boardType}` : ''}
        {r.isComplimentary ? ` · ${fd('comp')}` : ''}{r.source === 'walk_in' ? ` · walk-in` : ''}
      </em>
    </div>
    );
  };

  const payCell = (r: HotelReservation) => {
    const total = (Number(r.total) || 0) + (Number(r.extrasTotal) || 0);
    const paid = paidOf(r);
    const due = total - paid;
    return (
      <div className="htl-fd-pay">
        <b>{money(paid, cur(r), lang)} / {money(total, cur(r), lang)}</b>
        {due > 0.009 ? <span className="due">{fd('due', { due: money(due, cur(r), lang) })}</span> : total > 0 ? <span className="ok">{fd('paidFull')}</span> : null}
      </div>
    );
  };

  const datesCell = (r: HotelReservation) => (
    <div className="htl-fd-dates">
      <b>{fmtDate(r.checkIn, lang)} – {fmtDate(r.checkOut, lang)}</b>
      <em>{fd('nights', { count: nightsOf(r.checkIn, r.checkOut) })}</em>
    </div>
  );

  const roomPicker = (r: HotelReservation) => {
    const free = freeUnitsFor(r);
    const value = unitPick[r.id] ?? r.roomUnitId ?? '';
    return (
      <select className="htl-fd-pick" value={value} onChange={(e) => setUnitPick((p) => ({ ...p, [r.id]: e.target.value }))}>
        <option value="">{fd('pickRoom', { type: roomTypeById.get(r.roomTypeId)?.name || '—' })}</option>
        {r.roomUnitId && !free.some((u) => u.id === r.roomUnitId) && unitById.get(r.roomUnitId) && (
          <option value={r.roomUnitId}>{unitById.get(r.roomUnitId)!.label}</option>
        )}
        {free.map((u) => <option key={u.id} value={u.id}>{u.label} · {t(`crm.hotels.detail.housekeeping.${u.housekeepingStatus}`)}</option>)}
      </select>
    );
  };

  const arrivalActions = (r: HotelReservation) => (
    <div className="htl-fd-acts">
      {roomPicker(r)}
      <button className="btn btn-sm btn-primary" disabled={busyId === r.id || r.checkIn > todayIso()} onClick={() => doCheckIn(r)} title={r.checkIn > todayIso() ? fd('futureHint') : undefined}>
        <Ic d={HTL_ICON.check} size={12} />{fd('arrivals.checkIn')}
      </button>
      {r.checkIn <= todayIso() && <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => setDialog({ kind: 'noShow', r })}>{fd('noShow')}</button>}
      <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => setDialog({ kind: 'cancel', r })}>{fd('cancel')}</button>
    </div>
  );

  const counts = {
    arrivals: data?.arrivals.length ?? 0,
    departures: (data?.departures.length ?? 0) + (data?.overdue.length ?? 0),
    inHouse: data?.inHouse.length ?? 0,
    notArrived: data?.noShowCandidates.length ?? 0,
    options: data?.optionsExpiring.length ?? 0,
  };
  const arrTotal = counts.arrivals + (data?.arrived.length ?? 0);
  const depTotal = (data?.departures.length ?? 0) + (data?.departed.length ?? 0);

  const table = (rows: HotelReservation[], cols: Array<'check' | 'guest' | 'room' | 'dates' | 'pay' | 'option'>, actions: (r: HotelReservation) => React.ReactNode, empty: string, warnIds?: Set<string>) => (
    <div className="bk-table-wrap">
      <table className="bk-table htl-fd-table">
        <thead>
          <tr>
            {cols.includes('check') && (
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label={fd('selectAll')} />
              </th>
            )}
            {cols.includes('guest') && <th>{fd('col.guest')}</th>}
            {cols.includes('room') && <th>{fd('col.room')}</th>}
            {cols.includes('dates') && <th>{fd('col.dates')}</th>}
            {cols.includes('option') && <th>{fd('col.option')}</th>}
            {cols.includes('pay') && <th>{fd('col.payment')}</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={warnIds?.has(r.id) ? 'warn' : undefined}>
              {cols.includes('check') && (
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} aria-label={r.guestName} /></td>
              )}
              {cols.includes('guest') && <td>{guestCell(r)}</td>}
              {cols.includes('room') && <td>{roomCell(r)}</td>}
              {cols.includes('dates') && <td>{datesCell(r)}{warnIds?.has(r.id) && <span className="htl-fd-flag">{fd('overdueFlag')}</span>}</td>}
              {cols.includes('option') && (
                <td>
                  <div className="htl-fd-dates">
                    <b>{r.optionUntil ? new Date(r.optionUntil).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</b>
                    <em>{r.optionUntil && Date.parse(r.optionUntil) < Date.now() ? fd('optionExpired') : fd('optionAuto')}</em>
                  </div>
                </td>
              )}
              {cols.includes('pay') && <td>{payCell(r)}</td>}
              <td style={{ textAlign: 'right' }}>{actions(r)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="htl-fd-empty">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const tabs: Array<{ key: Tab; label: string; n: number }> = [
    { key: 'arrivals', label: fd('tabs.arrivals'), n: counts.arrivals },
    { key: 'departures', label: fd('tabs.departures'), n: counts.departures },
    { key: 'inHouse', label: fd('tabs.inHouse'), n: counts.inHouse },
    { key: 'notArrived', label: fd('tabs.notArrived'), n: counts.notArrived },
    { key: 'options', label: fd('tabs.options'), n: counts.options },
  ];

  return (
    <MainLayout>
      <PageHelpButton topic="hotelFrontDesk" />
      <div className="px-scope">
        <HotelsSubnav active="frontdesk" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.frontDesk.kicker', { count: data?.inHouseCount ?? 0 })}</div>
            <h1>{t('crm.hotels.frontDesk.title')}</h1>
            <p className="sub">{fd('subtitle2')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate(hotelId ? `/hotels/rack?hotelId=${hotelId}` : '/hotels/rack')}>{fd('toRack')}</button>
            <button className="btn btn-primary" disabled={!hotels.length} onClick={() => setWalkInOpen(true)}><Ic d={HTL_ICON.plus} size={14} />{fd('walkIn.button')}</button>
          </div>
        </div>

        <div data-tour="frontdesk-filters" className="htl-toolbar">
          <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, -1))} aria-label={fd('prevDay')}>‹</button>
          <DateInput className="htl-date" value={date} onChange={(v) => v && setDate(v)}  inline clearable={false} />
          <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, 1))} aria-label={fd('nextDay')}>›</button>
          {!isToday && <button className="btn btn-sm" onClick={() => setDate(todayIso())}>{fd('today')}</button>}
          <select className="htl-select" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            <option value="">{t('crm.hotels.frontDesk.allHotels')}</option>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>

        {error ? (
          <div className="htl-empty"><h4>{fd('error')}</h4><p>{error}</p><button className="btn" onClick={() => void load()}>{fd('retry')}</button></div>
        ) : !data ? (
          <div className="htl-rack-skel">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>
        ) : (
          <>
            <div className="htl-rack-kpis htl-fd-kpis">
              <div>
                <span>{fd('kpi.arrivals')}</span><b>{data.arrived.length}<small> / {arrTotal}</small></b>
                <i className="bar"><i style={{ width: `${arrTotal ? (data.arrived.length / arrTotal) * 100 : 0}%` }} /></i>
              </div>
              <div>
                <span>{fd('kpi.departures')}</span><b>{data.departed.length}<small> / {depTotal}</small></b>
                <i className="bar"><i style={{ width: `${depTotal ? (data.departed.length / depTotal) * 100 : 0}%` }} /></i>
              </div>
              <div><span>{fd('kpi.inHouse')}</span><b>{data.inHouse.length}</b></div>
              <div className={data.noShowCandidates.length ? 'alert' : ''}><span>{fd('kpi.notArrived')}</span><b>{data.noShowCandidates.length}</b></div>
              <div className={data.overdue.length ? 'alert' : ''}><span>{fd('kpi.overdue')}</span><b>{data.overdue.length}</b></div>
            </div>

            <div className="bk-savedviews htl-fd-tabs">
              {tabs.map((x) => (
                <div key={x.key} className={`bk-sv-tab${tab === x.key ? ' active' : ''}`} onClick={() => { setTab(x.key); setSelected(new Set()); }}>
                  {x.label}<span className="n">{x.n}</span>
                </div>
              ))}
            </div>

            <div data-tour="frontdesk-arrivals">
              {tab === 'arrivals' && table(data.arrivals, ['guest', 'room', 'dates', 'pay'], arrivalActions, fd('arrivals.empty'))}
            </div>
            <div data-tour="frontdesk-departures">
              {tab === 'departures' && table(
                [...data.overdue, ...data.departures],
                ['guest', 'room', 'dates', 'pay'],
                (r) => (
                  <div className="htl-fd-acts">
                    <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => void doCheckOut(r)}><Ic d={HTL_ICON.check} size={12} />{fd('departures.checkOut')}</button>
                    <button className="btn btn-sm" onClick={() => navigate(`/hotels/reservations?reservation=${r.id}`)}>{fd('open')}</button>
                  </div>
                ),
                fd('departures.empty'),
                new Set(data.overdue.map((r) => r.id)),
              )}
            </div>
            {tab === 'inHouse' && table(
              data.inHouse,
              ['guest', 'room', 'dates', 'pay'],
              (r) => (
                <div className="htl-fd-acts">
                  <button className="btn btn-sm" onClick={() => navigate(`/hotels/reservations?reservation=${r.id}`)}>{fd('open')}</button>
                  <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => void doCheckOut(r)}>{fd('earlyCheckOut')}</button>
                </div>
              ),
              fd('inHouseEmpty'),
            )}
            {tab === 'notArrived' && (
              <>
                {selected.size > 0 && (
                  <div className="htl-fd-bulk">
                    <b>{fd('bulk.selected', { count: selected.size })}</b>
                    <button className="btn btn-sm" disabled={busyId === 'bulk'} onClick={() => void doBulkNoShow('first_night')}>{fd('bulk.withFee')}</button>
                    <button className="btn btn-sm" disabled={busyId === 'bulk'} onClick={() => void doBulkNoShow('none')}>{fd('bulk.noFee')}</button>
                    <button className="btn btn-sm" onClick={() => setSelected(new Set())}>{fd('bulk.clear')}</button>
                  </div>
                )}
                <p className="htl-fd-note">{fd('notArrivedHint')}</p>
                {table(data.noShowCandidates, ['check', 'guest', 'room', 'dates', 'pay'], arrivalActions, fd('notArrivedEmpty'))}
              </>
            )}
            {tab === 'options' && (
              <>
                <p className="htl-fd-note">{fd('optionsHint')}</p>
                {table(
                  data.optionsExpiring,
                  ['guest', 'room', 'dates', 'option', 'pay'],
                  (r) => (
                    <div className="htl-fd-acts">
                      <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => void run(r.id, () => updateReservation(r.id, { status: 'confirmed' }), fd('optionConfirmed'), fd('optionError'))}>{fd('confirmOption')}</button>
                      <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => setDialog({ kind: 'cancel', r })}>{fd('releaseOption')}</button>
                    </div>
                  ),
                  fd('optionsEmpty'),
                )}
              </>
            )}
          </>
        )}

        {dialog?.kind === 'cancel' && (
          <CancelReservationDialog reservation={dialog.r} currency={cur(dialog.r)} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); }} />
        )}
        {dialog?.kind === 'noShow' && (
          <NoShowDialog reservation={dialog.r} currency={cur(dialog.r)} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); }} />
        )}
        {walkInOpen && (
          <WalkInSheet
            hotels={hotels}
            roomTypes={roomTypes}
            defaultHotelId={hotelId || hotels[0]?.id || ''}
            onClose={() => setWalkInOpen(false)}
            onDone={() => { setWalkInOpen(false); setDate(todayIso()); setTab('inHouse'); void load(); }}
          />
        )}
      </div>
    </MainLayout>
  );
};

/** Walk-in за один шаг: номер свободный на все ночи, гость, цена, оплата — бронь создаётся сразу заселённой */
const WalkInSheet: React.FC<{
  hotels: Hotel[];
  roomTypes: HotelRoomType[];
  defaultHotelId: string;
  onClose: () => void;
  onDone: () => void;
}> = ({ hotels, roomTypes, defaultHotelId, onClose, onDone }) => {
  const { t, i18n } = useTranslation();
  const w = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.frontDesk.walkIn.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(defaultHotelId);
  const [nights, setNights] = useState('1');
  const [rack, setRack] = useState<HotelRack | null>(null);
  const [unitId, setUnitId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCountry, setGuestCountry] = useState<string | null>(null);
  const [adults, setAdults] = useState(1);
  const [childAges, setChildAges] = useState<Array<number | null>>([]);
  const [boardType, setBoardType] = useState('');
  const [price, setPrice] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const n = Math.max(1, Math.min(90, Math.round(Number(nights) || 1)));
  const hotel = hotels.find((h) => h.id === hotelId);

  useEffect(() => {
    if (!hotelId) return;
    setRack(null);
    fetchRack(hotelId, today, n).then(setRack).catch(() => setRack(null));
  }, [hotelId, n, today]);

  const free = useMemo(() => {
    if (!rack) return [];
    const out = today;
    const end = addDaysIso(today, n);
    return rack.units.filter((u) => u.active && u.housekeepingStatus !== 'out_of_order' &&
      !rack.reservations.some((o) => o.roomUnitId === u.id && BLOCKING.has(o.status) && o.checkIn < end && o.checkOut > out));
  }, [rack, n, today]);

  useEffect(() => {
    if (unitId && !free.some((u) => u.id === unitId)) setUnitId('');
  }, [free, unitId]);

  const unit = free.find((u) => u.id === unitId);
  // цена по прайсу (сезон по рынку гостя, календарь, база) — подсказка; пустое поле → сервер посчитает так же
  const [quote, setQuote] = useState<HotelQuote | null>(null);
  useEffect(() => {
    setQuote(null);
    if (!unit) return;
    fetchQuote({ roomTypeId: unit.roomTypeId, checkIn: today, checkOut: addDaysIso(today, n), guestCountry: guestCountry || undefined, adults, childAges })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [unitId, n, guestCountry, adults, childAges.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const quoteMissing = !!quote?.warnings.some((w) => w.code === 'no_price' || w.code === 'no_occupancy');

  const total = price ? (Number(price) || 0) * n : quote && !quoteMissing ? quote.total : 0;
  const submit = () => {
    if (!unitId) { showAlert(w('needRoom'), { variant: 'error' }); return; }
    if (!guestName.trim()) { showAlert(t('crm.hotels.lifecycle.errors.HOTEL_WALKIN_NAME_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    walkIn({
      hotelId, roomUnitId: unitId, nights: n, guestName: guestName.trim(), guestPhone: guestPhone || null, guestCountry,
      adults, childAges, grossPerNight: price || undefined, boardType: boardType || null,
      payment: Number(payAmount) > 0 ? { amount: payAmount, method: payMethod } : null,
    })
      .then(() => { showAlert(w('done', { name: guestName.trim(), room: unit?.label || '' }), { variant: 'success' }); onDone(); })
      .catch((e) => showAlert(hotelErrorText(t, e, w('error')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const byType = roomTypes.filter((rt) => rt.hotelId === hotelId).map((rt) => ({ rt, units: free.filter((u) => u.roomTypeId === rt.id) })).filter((x) => x.units.length);

  return (
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet">
        <div className="htl-sheet-head">
          <div>
            <h3>{w('title')}</h3>
            <div className="htl-sub" style={{ marginTop: 4 }}>{w('subtitle', { from: fmtDate(today, lang), to: fmtDate(addDaysIso(today, n), lang) })}</div>
          </div>
          <button onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-f"><label>{w('hotel')}</label>
              <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setUnitId(''); setPrice(''); }}>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{w('nights')}</label><input type="number" min={1} max={90} value={nights} onChange={(e) => setNights(e.target.value)} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{w('room')} *</label>
              {!rack ? <div className="htl-hint">{t('crm.hotels.common.loading')}</div> : !byType.length ? (
                <div className="htl-hint">{w('noFree')}</div>
              ) : (
                <div className="htl-fd-units">
                  {byType.map(({ rt, units }) => (
                    <div key={rt.id} className="grp">
                      <span className="t">{rt.name}</span>
                      <div className="list">
                        {units.map((u) => (
                          <button key={u.id} type="button" className={`u${unitId === u.id ? ' on' : ''}`} onClick={() => setUnitId(u.id)} title={t(`crm.hotels.detail.housekeeping.${u.housekeepingStatus}`)}>
                            <HousekeepingBadge status={u.housekeepingStatus} />{u.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {unit?.housekeepingStatus === 'dirty' && <div className="htl-hint" style={{ color: '#7a4a09' }}>{t('crm.hotels.rack.sheet.dirtyWarning')}</div>}
            </div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{w('guestName')} *</label><input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoFocus /></div>
            <div className="htl-f"><label>{w('phone')}</label><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
            <div className="htl-f"><label>{w('country')}</label><CountrySelect value={guestCountry} onChange={setGuestCountry} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{t('crm.hotels.guestsPicker.title')}</label>
              <GuestsPicker adults={adults} childAges={childAges} childMaxAge={hotel?.childMaxAge || 12} onChange={(a, ages) => { setAdults(a); setChildAges(ages); }} />
              {quote?.warnings.some((x) => x.code === 'no_occupancy') && (
                <div className="gp-note warn">{t('crm.hotels.guestsPicker.noMatch', { adults: quote.guests?.adults ?? adults, children: quote.guests?.children ?? 0 })}</div>
              )}
            </div>
            <div className="htl-f"><label>{w('board')}</label>
              <select value={boardType} onChange={(e) => setBoardType(e.target.value)}>
                <option value="">—</option>
                {HOTEL_BOARD_TYPES.map((b) => <option key={b} value={b}>{b} · {t(`crm.hotels.board.${b}`)}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{w('price', { currency: hotel?.currency || '' })}</label><input type="number" min={0} step="0.01" value={price} placeholder={quote && !quoteMissing ? String(quote.average) : ''} onChange={(e) => setPrice(e.target.value)} />
              <div className="htl-hint">{quote && !quoteMissing ? w('priceAuto', { price: quote.average }) : quote ? w('priceMissing') : ''}</div></div>
            <div className="htl-f"><label>{w('payAmount')}</label><input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={total ? String(total) : ''} /></div>
            <div className="htl-f"><label>{w('payMethod')}</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {['cash', 'card', 'bank_transfer', 'other'].map((m) => <option key={m} value={m}>{t(`crm.hotels.reservations.paymentMethods.${m}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="htl-life-hint" style={{ marginTop: 14 }}>{w('total', { total: money(total, hotel?.currency, lang), n })}</div>
        </div>
        <div className="htl-sheet-foot">
          <button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !unitId || !guestName.trim()} onClick={submit}><Ic d={HTL_ICON.check} size={14} />{w('submit')}</button>
        </div>
      </div>
    </div>
  );
};
