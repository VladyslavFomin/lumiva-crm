import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingLocations, type BookingLocation, type BookingResourceItem, type Reservation } from '../../api/bookings';
import {
  fetchFloor,
  fetchVerticalSettings,
  seatTable,
  releaseTable,
  moveTable,
  type FloorState,
  type FloorTable,
} from '../../api/bookingVerticals';
import { Seats, DecorView } from './floorShapes';
import { RestaurantBookingModal } from './RestaurantBookingModal';
import { BkDrawer, BkModal, EmptyState, MiniKpi, errMsg, fmtMoney, fmtTime, useDateLocale, ymdLocal } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const STATES: FloorTable['state'][] = ['free', 'soon', 'reserved', 'seated', 'billed'];
const STATE_COLORS: Record<string, string> = { free: '#9ccdb0', soon: '#e7c27a', reserved: '#8fb2dc', seated: '#b49ae0', billed: '#f0a35e' };

export const RestaurantFloorPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [floor, setFloor] = useState<FloorState | null>(null);
  const [zoneId, setZoneId] = useState('');
  const [live, setLive] = useState(true);
  const [date, setDate] = useState(ymdLocal(new Date()));
  const [time, setTime] = useState('19:00');
  const [selected, setSelected] = useState<string | null>(null);
  const [turnMinutes, setTurnMinutes] = useState(120);
  const [bookOpen, setBookOpen] = useState<{ tableId?: string } | null>(null);
  const [seatOpen, setSeatOpen] = useState<{ tableId: string; reservation?: Reservation } | null>(null);
  const [seatGuests, setSeatGuests] = useState(2);
  const [seatName, setSeatName] = useState('');
  const [seatMinutes, setSeatMinutes] = useState(120);
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [assignRes, setAssignRes] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fittedZone = useRef<string>('');

  useEffect(() => {
    fetchBookingLocations()
      .then((l) => {
        setLocations(l);
        setLocationId((cur) => cur || l[0]?.id || '');
      })
      .catch(() => undefined);
    fetchVerticalSettings().then((s) => setTurnMinutes(s.turnMinutes)).catch(() => undefined);
  }, []);

  const at = live ? undefined : new Date(`${date}T${time}:00`).toISOString();
  const load = useCallback(() => {
    if (!locationId) return;
    fetchFloor(locationId, at)
      .then((f) => {
        setFloor(f);
        setZoneId((cur) => (cur && f.zones.some((z) => z.id === cur) ? cur : f.zones[0]?.id || ''));
      })
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));
  }, [locationId, at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    if (!live) return;
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load, live]);

  const zone = floor?.zones.find((z) => z.id === zoneId) || null;

  // план целиком в ширину экрана (телефон/узкое окно) — при первом показе зала, дальше масштаб ручной
  useEffect(() => {
    if (!zone || fittedZone.current === zone.id || !wrapRef.current) return;
    fittedZone.current = zone.id;
    const w = wrapRef.current.clientWidth - 2;
    // подгоняем по фактической расстановке (столы + декор), а не по всему холсту — иначе на
    // телефоне план из 3 столов в углу холста 1000px сжимается до нечитаемых 36%
    const right = Math.max(
      200,
      ...zone.tables.map((t) => (t.posX || 0) + (t.width || 80) + 24),
      ...zone.decor.map((d) => d.x + d.w + 12),
    );
    const extent = Math.min(zone.width, right);
    if (w > 0 && w < extent) setZoom(Math.max(0.35, Math.floor((w / extent) * 100) / 100));
    else setZoom(1);
  }, [zone]);
  const stateOf = useMemo(() => new Map((floor?.tables || []).map((s) => [s.tableId, s])), [floor]);
  const allTables = useMemo(() => (floor?.zones || []).flatMap((z) => z.tables), [floor]);
  const selTable = allTables.find((x) => x.id === selected) || null;
  const selState = selected ? stateOf.get(selected) : undefined;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      load();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openSeat = (tableId: string, reservation?: Reservation) => {
    setSeatGuests(reservation?.participants || 2);
    setSeatName(reservation?.customerName || '');
    // гости «с улицы» за стол, у которого скоро бронь, — сидят только до этой брони
    const next = stateOf.get(tableId)?.next;
    const untilNext = next ? Math.floor((new Date(next.startAt).getTime() - Date.now()) / 60_000 / 15) * 15 : Infinity;
    setSeatMinutes(Math.max(15, Math.min(turnMinutes, untilNext)));
    setSeatOpen({ tableId, reservation });
  };

  const doSeat = async () => {
    if (!seatOpen) return;
    setBusy(true);
    try {
      const res = await seatTable(seatOpen.tableId, seatOpen.reservation ? { reservationId: seatOpen.reservation.id, guests: seatGuests } : { guests: seatGuests, customerName: seatName || undefined, durationMinutes: seatMinutes });
      setSeatOpen(null);
      showAlert(t('crm.bookings.v.floor.seated'), { variant: 'success' });
      navigate(`/bookings/orders/${res.order.id}`);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const tableSub = (st?: FloorTable) => {
    if (!st) return '';
    if (st.order) return fmtMoney(st.order.total, st.order.currency, locale);
    if (st.current) return `${fmtTime(st.current.startAt, locale)} · ${st.current.customerName || ''}`;
    if (st.next) return `${t('crm.bookings.v.floor.nextAt')} ${fmtTime(st.next.startAt, locale)}`;
    return '';
  };

  // временная шкала дня 10:00–24:00 для карточки стола
  const dayBar = (st: FloorTable) => {
    const base = new Date(`${floor?.date || date}T10:00:00`).getTime();
    const span = 14 * 3600_000;
    const pct = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - base) / span) * 100));
    const nowPct = ((new Date(floor?.at || Date.now()).getTime() - base) / span) * 100;
    return (
      <div className="fl-tl">
        {st.timeline.map((b) => (
          <div key={b.id} className={`b${b.status === 'checked_in' || b.status === 'in_progress' ? ' seated' : ''}`} style={{ left: `${pct(b.startAt)}%`, width: `${Math.max(1.5, pct(b.endAt) - pct(b.startAt))}%` }} title={`${fmtTime(b.startAt, locale)}–${fmtTime(b.endAt, locale)} ${b.customerName || ''}`} />
        ))}
        {nowPct >= 0 && nowPct <= 100 && <div className="now" style={{ left: `${nowPct}%` }} />}
      </div>
    );
  };

  const freeTablesFor = (guests: number) =>
    allTables.filter((tb) => tb.active && stateOf.get(tb.id)?.state === 'free' && (tb.capacity || 0) >= guests);

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="floor" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.floor.kicker')}</div>
            <h1>{t('crm.bookings.v.floor.title')}</h1>
            <p className="sub">{t('crm.bookings.v.floor.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/bookings/floor/editor')}>
              <Ic d={BK_ICON.edit} size={13} /> {t('crm.bookings.v.floor.editLayout')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setBookOpen({})} disabled={!locationId}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.floor.bookTable')}
            </button>
          </div>
        </div>

        <div className="fl-toolbar">
          {locations.length > 1 && (
            <select className="bk-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <div className="bk-seg">
            <button className={live ? 'on' : ''} onClick={() => setLive(true)}>{t('crm.bookings.v.floor.now')}</button>
            <button className={!live ? 'on' : ''} onClick={() => setLive(false)}>{t('crm.bookings.v.floor.atTime')}</button>
          </div>
          {!live && (
            <>
              <input className="bk-select" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input className="bk-select" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </>
          )}
          <div style={{ flex: 1 }} />
          <div className="fl-legend">
            {STATES.map((s) => (
              <span key={s}><i style={{ borderColor: STATE_COLORS[s], background: `${STATE_COLORS[s]}33` }} />{t(`crm.bookings.v.floor.state.${s}`)}</span>
            ))}
          </div>
        </div>

        {floor && floor.zones.length > 0 && (
          <div className="bk-savedviews">
            {floor.zones.map((z) => (
              <div key={z.id} className={`bk-sv-tab${z.id === zoneId ? ' active' : ''}`} onClick={() => setZoneId(z.id)}>
                {z.name} · {z.tables.filter((x) => x.active).length}
              </div>
            ))}
          </div>
        )}

        {floor && floor.zones.length === 0 && (
          <div className="bk-panel">
            <EmptyState
              title={t('crm.bookings.v.floor.emptyTitle')}
              text={t('crm.bookings.v.floor.emptyText')}
              action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings/floor/editor')}>{t('crm.bookings.v.floor.createLayout')}</button>}
            />
          </div>
        )}

        {floor && zone && (
          <div className="fl-layout">
            <div>
              <div className="fl-canvas-wrap" ref={wrapRef}>
                <div className="fl-canvas" style={{ width: zone.width * zoom, height: zone.height * zoom }}>
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: zone.width, height: zone.height, position: 'relative' }}>
                    {zone.decor.map((d) => <DecorView key={d.id} d={d} label={t(`crm.bookings.v.editor.decor.${d.kind}`)} />)}
                    {zone.tables.map((tb) => {
                      const st = stateOf.get(tb.id);
                      const w = tb.width || 80;
                      const h = tb.height || 80;
                      return (
                        <div key={tb.id} style={{ position: 'absolute', left: tb.posX || 0, top: tb.posY || 0, width: w, height: h, transform: tb.rotation ? `rotate(${tb.rotation}deg)` : undefined }}>
                          <Seats shape={tb.shape || 'square'} w={w} h={h} seats={tb.capacity || 0} />
                          <button
                            type="button"
                            className={`fl-table ${tb.shape || 'square'} st-${st?.state || 'free'}${selected === tb.id ? ' sel' : ''}`}
                            style={{ left: 0, top: 0, width: w, height: h }}
                            onClick={() => setSelected(tb.id)}
                          >
                            <span className="n" style={{ transform: tb.rotation ? `rotate(${-tb.rotation}deg)` : undefined }}>{tb.name}</span>
                            <span className="c" style={{ transform: tb.rotation ? `rotate(${-tb.rotation}deg)` : undefined }}>{tb.capacity || 0}</span>
                            {h >= 60 && <span className="s">{tableSub(st)}</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}>−</button>
                <span className="bk-hint">{Math.round(zoom * 100)}%</span>
                <button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>+</button>
              </div>
            </div>

            <div className="fl-side">
              <div className="bk-mini-kpis" style={{ margin: 0, gridTemplateColumns: '1fr 1fr' }}>
                <MiniKpi label={t('crm.bookings.v.floor.kpiFree')} value={`${floor.stats.free}/${floor.stats.tables}`} tone="good" />
                <MiniKpi label={t('crm.bookings.v.floor.kpiOccupied')} value={floor.stats.occupied} />
                <MiniKpi label={t('crm.bookings.v.floor.kpiGuests')} value={`${floor.stats.guestsNow}/${floor.stats.seatsTotal}`} />
                <MiniKpi label={t('crm.bookings.v.floor.kpiToday')} value={floor.stats.reservationsToday} />
              </div>
              <div className="bk-panel" style={{ marginTop: 12 }}>
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.floor.unseated')}</div><span className="bk-hint">{floor.unseated.length}</span></div>
                <div className="bk-panel-body" style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {floor.unseated.length === 0 && <div className="bk-hint" style={{ padding: '10px 18px' }}>{t('crm.bookings.v.floor.unseatedEmpty')}</div>}
                  {floor.unseated.map((r) => (
                    <div key={r.id} className="bk-today-row" style={{ gridTemplateColumns: '48px 1fr auto' }}>
                      <div className="time">{fmtTime(r.startAt, locale)}</div>
                      <div className="bk-today-main">
                        <div className="cust">{r.customerName || '—'}</div>
                        <div className="meta">{t('crm.bookings.v.common.guests', { count: r.participants })}{r.customerPhone ? ` · ${r.customerPhone}` : ''}</div>
                      </div>
                      <button className="btn btn-sm" onClick={() => setAssignRes(r)}>{t('crm.bookings.v.floor.assign')}</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* карточка стола */}
      <BkDrawer
        open={!!selTable}
        kicker={selState ? t(`crm.bookings.v.floor.state.${selState.state}`) : ''}
        title={selTable ? `${t('crm.bookings.v.floor.table')} ${selTable.name}` : ''}
        onClose={() => setSelected(null)}
        footer={
          selTable && selState && (
            <>
              {selState.state === 'free' || selState.state === 'soon' ? (
                <button className="btn btn-primary btn-sm" disabled={busy || !selTable.active} onClick={() => openSeat(selTable.id)}>{t('crm.bookings.v.floor.seatWalkin')}</button>
              ) : null}
              {selState.current && selState.current.status !== 'checked_in' && selState.current.status !== 'in_progress' && !selState.order && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => openSeat(selTable.id, selState.current!)}>{t('crm.bookings.v.floor.seatReservation')}</button>
              )}
              {!selState.current && selState.next && selState.state === 'soon' && (
                <button className="btn btn-sm" disabled={busy} onClick={() => openSeat(selTable.id, selState.next!)}>{t('crm.bookings.v.floor.seatNext')}</button>
              )}
              {selState.order && (
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/bookings/orders/${selState.order!.id}`)}>{t('crm.bookings.v.floor.openOrder', { number: selState.order.number })}</button>
              )}
              {(selState.state === 'seated' || selState.state === 'billed') && (
                <>
                  <button className="btn btn-sm" disabled={busy} onClick={() => setMoveOpen(selTable.id)}>{t('crm.bookings.v.floor.move')}</button>
                  <button className="btn btn-sm" disabled={busy || !!selState.order} title={selState.order ? t('crm.bookings.v.floor.releaseBlocked') : undefined} onClick={() => run(() => releaseTable(selTable.id), t('crm.bookings.v.floor.released'))}>{t('crm.bookings.v.floor.release')}</button>
                </>
              )}
              <button className="btn btn-sm" onClick={() => setBookOpen({ tableId: selTable.id })}>{t('crm.bookings.v.floor.bookThis')}</button>
            </>
          )
        }
      >
        {selTable && selState && (
          <>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.floor.seatsLabel')}</span><span className="v">{selTable.minCapacity ? `${selTable.minCapacity}–` : ''}{selTable.capacity}</span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.floor.shapeLabel')}</span><span className="v">{t(`crm.bookings.v.editor.shape.${selTable.shape || 'square'}`)}</span></div>
            {selState.current && (
              <div className="bk-note" style={{ marginTop: 12 }}>
                <div className="hd"><b>{t('crm.bookings.v.floor.currentBooking')}</b><span>{fmtTime(selState.current.startAt, locale)}–{fmtTime(selState.current.endAt, locale)}</span></div>
                <div className="body">
                  <a style={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/bookings/reservations/${selState.current!.id}`)}>{selState.current.customerName || '—'}</a>
                  {' · '}{t('crm.bookings.v.common.guests', { count: selState.current.participants })}
                  {selState.current.customerPhone ? ` · ${selState.current.customerPhone}` : ''}
                  {selState.current.customFields?.comment && <div className="bk-hint" style={{ marginTop: 4 }}>{selState.current.customFields.comment}</div>}
                </div>
              </div>
            )}
            {selState.next && (
              <div className="bk-note">
                <div className="hd"><b>{t('crm.bookings.v.floor.nextBooking')}</b><span>{fmtTime(selState.next.startAt, locale)}</span></div>
                <div className="body">
                  <a style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/reservations/${selState.next!.id}`)}>{selState.next.customerName || '—'}</a> · {t('crm.bookings.v.common.guests', { count: selState.next.participants })}
                </div>
              </div>
            )}
            {selState.order && (
              <div className="bk-note">
                <div className="hd"><b>{t('crm.bookings.v.floor.orderLabel', { number: selState.order.number })}</b><span className={`bk-badge ord-${selState.order.status}`}>{t(`crm.bookings.v.orders.status.${selState.order.status}`)}</span></div>
                <div className="body bk-money">{fmtMoney(selState.order.total, selState.order.currency, locale)} · {t('crm.bookings.v.common.guests', { count: selState.order.guests })} · {t('crm.bookings.v.floor.since', { time: fmtTime(selState.order.createdAt, locale) })}</div>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div className="bk-hint">{t('crm.bookings.v.floor.dayTimeline', { count: selState.reservationsToday })}</div>
              {dayBar(selState)}
              <div style={{ display: 'flex', justifyContent: 'space-between' }} className="bk-hint"><span>10:00</span><span>17:00</span><span>24:00</span></div>
            </div>
          </>
        )}
      </BkDrawer>

      {/* посадка */}
      <BkModal
        open={!!seatOpen}
        title={seatOpen?.reservation ? t('crm.bookings.v.floor.seatReservationTitle') : t('crm.bookings.v.floor.seatWalkinTitle')}
        onClose={() => setSeatOpen(null)}
        footer={
          <>
            <button className="btn btn-sm" onClick={() => setSeatOpen(null)}>{t('crm.bookings.v.common.cancel')}</button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={doSeat}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.floor.seatAndOpen')}</button>
          </>
        }
      >
        <div className="bk-row2">
          <div className="bk-field">
            <label>{t('crm.bookings.v.rbook.guests')}</label>
            <input type="number" min={1} value={seatGuests} onChange={(e) => setSeatGuests(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          {!seatOpen?.reservation && (
            <div className="bk-field">
              <label>{t('crm.bookings.v.floor.walkinName')}</label>
              <input value={seatName} onChange={(e) => setSeatName(e.target.value)} placeholder={t('crm.bookings.v.floor.walkinNamePh')} />
            </div>
          )}
        </div>
        {!seatOpen?.reservation && (
          <div className="bk-field">
            <label>{t('crm.bookings.v.rbook.duration')}</label>
            <select value={seatMinutes} onChange={(e) => setSeatMinutes(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 150, 180, 240].concat(seatMinutes, turnMinutes).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>{t('crm.bookings.v.common.minutesShort', { count: m })}</option>
              ))}
            </select>
            {seatOpen && stateOf.get(seatOpen.tableId)?.next && (
              <div className="bk-hint" style={{ marginTop: 4, color: '#c08319' }}>{t('crm.bookings.v.floor.nextBookingAt', { time: fmtTime(stateOf.get(seatOpen.tableId)!.next!.startAt, locale) })}</div>
            )}
          </div>
        )}
        {seatOpen && (allTables.find((x) => x.id === seatOpen.tableId)?.capacity || 0) < seatGuests && (
          <div className="bk-hint" style={{ color: '#c08319' }}>{t('crm.bookings.v.floor.overCapacity')}</div>
        )}
        <div className="bk-hint">{seatOpen?.reservation ? t('crm.bookings.v.floor.seatHintBooked') : t('crm.bookings.v.floor.seatHint')}</div>
      </BkModal>

      {/* назначить стол брони без стола */}
      <BkModal open={!!assignRes} title={t('crm.bookings.v.floor.assignTitle', { name: assignRes?.customerName || '' })} onClose={() => setAssignRes(null)}>
        <div className="bk-hint" style={{ marginBottom: 10 }}>{t('crm.bookings.v.floor.assignHint', { count: assignRes?.participants || 1 })}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {assignRes && freeTablesFor(assignRes.participants).map((tb: BookingResourceItem) => (
            <button key={tb.id} className="btn btn-sm" disabled={busy} onClick={() => { const r = assignRes; setAssignRes(null); openSeat(tb.id, r); }}>
              {tb.name} · {tb.capacity}
            </button>
          ))}
          {assignRes && freeTablesFor(assignRes.participants).length === 0 && <div className="bk-hint">{t('crm.bookings.v.floor.noFreeTables')}</div>}
        </div>
      </BkModal>

      {/* пересадка */}
      <BkModal open={!!moveOpen} title={t('crm.bookings.v.floor.moveTitle')} onClose={() => setMoveOpen(null)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allTables.filter((tb) => tb.id !== moveOpen && tb.active && stateOf.get(tb.id)?.state !== 'seated' && stateOf.get(tb.id)?.state !== 'billed').map((tb) => (
            <button key={tb.id} className="btn btn-sm" disabled={busy} onClick={() => { const from = moveOpen!; setMoveOpen(null); setSelected(tb.id); run(() => moveTable(from, tb.id), t('crm.bookings.v.floor.moved')); }}>
              {tb.name} · {tb.capacity}
            </button>
          ))}
        </div>
      </BkModal>

      <RestaurantBookingModal
        open={!!bookOpen}
        locations={locations}
        defaultLocationId={locationId}
        defaultTableId={bookOpen?.tableId}
        defaultStart={live ? undefined : new Date(`${date}T${time}:00`)}
        turnMinutes={turnMinutes}
        onClose={() => setBookOpen(null)}
        onCreated={load}
      />
    </MainLayout>
  );
};
