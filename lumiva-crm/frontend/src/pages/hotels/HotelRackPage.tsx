import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ApiError } from '../../api/client';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { HousekeepingBadge } from './HotelDetailPage';
import { ReservationModal } from './HotelReservationsPage';
import { CountryTag } from './CountrySelect';
import { ReservationHistoryList } from './ReservationHistory';
import { FolioPanel } from './folio/FolioPanel';
import { CancelReservationDialog, NoShowDialog } from './ReservationLifecycle';
import { addDaysIso, fmtDate, money, todayIso } from './partners/partnerUtils';
import {
  checkInReservation,
  checkOutReservation,
  fetchAgencies,
  fetchAllRoomTypes,
  fetchHotels,
  fetchRack,
  fetchReservationHistory,
  moveReservation,
  type Hotel,
  type HotelAgency,
  type HotelMoveConflict,
  type HotelRack,
  type HotelRackReservation,
  type HotelReservationHistoryEntry,
  type HotelReservationMoveInput,
  type HotelRoomType,
  type HotelRoomUnitHousekeepingStatus,
} from '../../api/hotels';
import './hotels-design.css';
import { DateInput } from '../../components/ui/DateInput';
import { useHotelLive } from './useHotelLive';

const SPANS = [7, 14, 30, 60] as const;
const COL_BY_SPAN: Record<number, number> = { 7: 104, 14: 60, 30: 40, 60: 30 };
const LEFT = 188;
const ROW_H = 34;
const POLL_MS = 30_000;

type Row =
  | { kind: 'group'; key: string; roomTypeId: string; name: string }
  | { kind: 'unit'; key: string; roomTypeId: string; unitId: string; label: string; hk: HotelRoomUnitHousekeepingStatus; note: string | null; active: boolean }
  | { kind: 'lane'; key: string; roomTypeId: string; lane: number; lanes: number };

type Drag = {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  moved: boolean;
  dayDelta: number;
  /** целевая строка: unitId, '' — «без номера» своего типа, undefined — вне сетки */
  targetUnit: string | undefined;
  targetRoomType: string | undefined;
};

const nightsOf = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));
const dayIndex = (from: string, d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && a2 > b1;
const BLOCKING = new Set(['confirmed', 'pending', 'checked_in']);

const BAR_ICON = {
  child: <><circle cx="12" cy="6" r="3" /><path d="M7 21v-6l-2-3 4-2h6l4 2-2 3v6" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  hourglass: <><path d="M6 3h12M6 21h12" /><path d="M7 3c0 5 10 5 10 9s-10 4-10 9" /><path d="M17 3c0 5-10 5-10 9s10 4 10 9" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1.5" /><path d="M3 12h18M12 8v13" /><path d="M12 8c-2-4-6-4-6-1.5S10 8 12 8zM12 8c2-4 6-4 6-1.5S14 8 12 8z" /></>,
};

/** Раскладка броней без номера по полосам, чтобы пересекающиеся не накладывались */
function packLanes(list: HotelRackReservation[]) {
  const lanes: string[][] = [];
  const laneOf = new Map<string, number>();
  const ends: string[] = [];
  for (const r of [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
    let i = ends.findIndex((end) => end <= r.checkIn);
    if (i < 0) { i = ends.length; ends.push(''); lanes.push([]); }
    ends[i] = r.checkOut;
    lanes[i].push(r.id);
    laneOf.set(r.id, i);
  }
  return { count: lanes.length, laneOf };
}

export const HotelRackPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.rack.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const navigate = useNavigate();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const [sp, setSp] = useSearchParams();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [allRoomTypes, setAllRoomTypes] = useState<HotelRoomType[]>([]);
  const [agencies, setAgencies] = useState<HotelAgency[]>([]);
  const [rack, setRack] = useState<HotelRack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => addDaysIso(todayIso(), -2));
  const [span, setSpan] = useState<number>(14);
  const [typeFilter, setTypeFilter] = useState('');
  const [hkFilter, setHkFilter] = useState<'' | HotelRoomUnitHousekeepingStatus>('');
  const [floorFilter, setFloorFilter] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [create, setCreate] = useState<{ roomTypeId: string; roomUnitId: string | null; checkIn: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<{ r: HotelRackReservation; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // ширина контейнера — колонки дат растягиваются на всю страницу, но не уже COL_BY_SPAN
  const [wrapW, setWrapW] = useState(0);
  const wrapObs = useRef<ResizeObserver | null>(null);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapObs.current?.disconnect();
    wrapObs.current = null;
    if (!el) return;
    setWrapW(el.clientWidth);
    wrapObs.current = new ResizeObserver(() => setWrapW(el.clientWidth));
    wrapObs.current.observe(el);
  }, []);

  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const col = Math.max(COL_BY_SPAN[span] || 60, Math.floor((wrapW - LEFT) / span));
  const today = todayIso();

  useEffect(() => {
    fetchHotels()
      .then(async (h) => {
        setHotels(h);
        setAllRoomTypes(await fetchAllRoomTypes(h));
        if (!h.length) setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
    fetchAgencies().then(setAgencies).catch(() => setAgencies([]));
  }, []);

  const load = useCallback(
    (silent = false) => {
      if (!hotelId) return Promise.resolve();
      if (!silent) setLoading(true);
      return fetchRack(hotelId, from, span)
        .then((r) => { setRack(r); setError(null); })
        .catch((e) => { if (!silent) setError(e.message || k('loadError')); })
        .finally(() => setLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hotelId, from, span],
  );

  useEffect(() => { void load(); }, [load]);

  // PMS-016: у всех пользователей шахматка обновляется сама — живой поток событий (+ редкий опрос как страховка)
  const live = useHotelLive(['reservation', 'unit', 'outage'], () => { if (!dragRef.current) void load(true); });
  const lockOf = useMemo(() => new Map(live.locks.map((l) => [l.reservationId, l])), [live.locks]);
  useEffect(() => {
    const tick = () => { if (!document.hidden && !dragRef.current) void load(true); };
    const id = window.setInterval(tick, live.connected ? POLL_MS * 4 : POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [load, live.connected]);

  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDaysIso(from, i)), [from, span]);
  const byId = useMemo(() => new Map((rack?.reservations || []).map((r) => [r.id, r])), [rack]);
  const unitById = useMemo(() => new Map((rack?.units || []).map((u) => [u.id, u])), [rack]);
  const agencyName = useMemo(() => new Map((rack?.agencies || []).map((a) => [a.id, a.name])), [rack]);
  const selected = selectedId ? byId.get(selectedId) || null : null;
  const cur = rack?.hotel.currency;

  const search = q.trim().toLowerCase();
  const matches = useCallback(
    (r: HotelRackReservation) =>
      !search ||
      r.guestName.toLowerCase().includes(search) ||
      (r.bookingCode || '').toLowerCase().includes(search) ||
      (r.guestPhone || '').toLowerCase().includes(search),
    [search],
  );

  // строки: тип → номера → полосы «без номера»
  const { rows, unassignedLane } = useMemo(() => {
    const out: Row[] = [];
    const laneMap = new Map<string, number>();
    if (!rack) return { rows: out, unassignedLane: laneMap };
    for (const rt of rack.roomTypes) {
      if (typeFilter && rt.id !== typeFilter) continue;
      const units = rack.units.filter((u) => u.roomTypeId === rt.id && (!hkFilter || u.housekeepingStatus === hkFilter) && (!floorFilter || (u.floor || '') === floorFilter));
      const unassigned = rack.reservations.filter((r) => r.roomTypeId === rt.id && (!r.roomUnitId || !unitById.has(r.roomUnitId)));
      if (!units.length && !unassigned.length && (hkFilter || floorFilter)) continue;
      out.push({ kind: 'group', key: `g-${rt.id}`, roomTypeId: rt.id, name: rt.name });
      if (unassigned.length) {
        const packed = packLanes(unassigned);
        packed.laneOf.forEach((lane, id) => laneMap.set(id, lane));
        for (let i = 0; i < packed.count; i++) out.push({ kind: 'lane', key: `l-${rt.id}-${i}`, roomTypeId: rt.id, lane: i, lanes: packed.count });
      }
      for (const u of units) out.push({ kind: 'unit', key: `u-${u.id}`, roomTypeId: rt.id, unitId: u.id, label: u.label, hk: u.housekeepingStatus, note: u.note, active: u.active });
    }
    return { rows: out, unassignedLane: laneMap };
  }, [rack, typeFilter, hkFilter, floorFilter, unitById]);

  /** Номер снят с продажи (OOO) в этот день — по периоду или по статусу «не работает» */
  const oooOn = useCallback(
    (unitId: string, d: string) => (rack?.outages || []).some((o) => o.roomUnitId === unitId && o.kind === 'ooo' && o.dateFrom <= d && (!o.dateTo || d < o.dateTo)),
    [rack],
  );
  const sellableOn = useCallback(
    (u: HotelRack['units'][number], d: string) => u.active && u.housekeepingStatus !== 'out_of_order' && !oooOn(u.id, d),
    [oooOn],
  );
  // свободно по типу и по отелю на каждую ночь: рабочие номера − брони (с номером и без)
  const freeByType = useMemo(() => {
    const m = new Map<string, number[]>();
    if (!rack) return m;
    for (const rt of rack.roomTypes) {
      const typeUnits = rack.units.filter((u) => u.roomTypeId === rt.id);
      m.set(rt.id, days.map((d) => typeUnits.filter((u) => sellableOn(u, d)).length - rack.reservations.filter((r) => r.roomTypeId === rt.id && BLOCKING.has(r.status) && r.checkIn <= d && r.checkOut > d).length));
    }
    return m;
  }, [rack, days, sellableOn]);
  const totals = useMemo(() => {
    if (!rack) return { free: [] as number[], occ: [] as number[] };
    const free = days.map((_, i) => [...freeByType.values()].reduce((s, arr) => s + arr[i], 0));
    const occ = days.map((d, i) => {
      const sellable = rack.units.filter((u) => sellableOn(u, d)).length;
      return sellable ? Math.round(((sellable - free[i]) / sellable) * 100) : 0;
    });
    return { free, occ };
  }, [rack, days, freeByType, sellableOn]);
  const floors = useMemo(() => [...new Set((rack?.units || []).map((u) => u.floor || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), [rack]);

  const roomLabel = (unitId: string | null) => (unitId ? unitById.get(unitId)?.label || '—' : k('noRoom'));
  const typeName = (id: string) => rack?.roomTypes.find((r) => r.id === id)?.name || '—';
  const errText = (e: unknown) => {
    const err = e as ApiError;
    return err?.code ? t(`crm.hotels.rack.errors.${err.code}`, { defaultValue: err.message }) : (err?.message || k('moveError'));
  };

  /** Перенос с подтверждением, причиной для заселённых и обменом при конфликте (E2E-15) */
  const doMove = async (r: HotelRackReservation, dto: HotelReservationMoveInput) => {
    const unitChange = dto.roomUnitId !== undefined && (dto.roomUnitId || null) !== r.roomUnitId;
    const checkIn = dto.checkIn ?? r.checkIn;
    const checkOut = dto.checkOut ?? (dto.checkIn ? addDaysIso(dto.checkIn, nightsOf(r.checkIn, r.checkOut)) : r.checkOut);
    const lines: string[] = [];
    if (unitChange) lines.push(k('confirm.room', { from: roomLabel(r.roomUnitId), to: roomLabel(dto.roomUnitId ?? null) }));
    if (unitChange && dto.roomUnitId && unitById.get(dto.roomUnitId)?.roomTypeId !== r.roomTypeId) {
      lines.push(k('confirm.typeChange', { from: typeName(r.roomTypeId), to: typeName(unitById.get(dto.roomUnitId)!.roomTypeId) }));
    }
    if (checkIn !== r.checkIn || checkOut !== r.checkOut) {
      lines.push(k('confirm.dates', { from: `${fmtDate(r.checkIn, lang)} – ${fmtDate(r.checkOut, lang)}`, to: `${fmtDate(checkIn, lang)} – ${fmtDate(checkOut, lang)}`, n: nightsOf(checkIn, checkOut) }));
    }
    let reason: string | undefined;
    if (r.status === 'checked_in' && unitChange) {
      const v = await showPrompt({ title: k('confirm.relocateTitle', { name: r.guestName }), label: `${lines.join('\n')}\n\n${k('confirm.reasonLabel')}`, placeholder: k('confirm.reasonPh'), confirmLabel: k('confirm.relocate'), cancelLabel: t('crm.hotels.common.cancel') });
      if (v === null) return;
      reason = v.trim();
      if (!reason) { showAlert(t('crm.hotels.rack.errors.HOTEL_MOVE_REASON_REQUIRED'), { variant: 'error' }); return; }
    } else {
      const ok = await showConfirm(lines.join('\n'), { title: k('confirm.title', { name: r.guestName }), confirmLabel: k('confirm.move'), cancelLabel: t('crm.hotels.common.cancel') });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await moveReservation(r.id, { ...dto, reason });
      showAlert(k('moved'), { variant: 'success' });
    } catch (e) {
      const err = e as ApiError;
      const payload = err?.payload as HotelMoveConflict | undefined;
      if (err?.code === 'HOTEL_MOVE_CONFLICT' && payload?.canSwap && payload.conflicts[0]) {
        const other = payload.conflicts[0];
        const ok = await showConfirm(
          k('swap.body', { other: other.guestName, dates: `${fmtDate(other.checkIn, lang)} – ${fmtDate(other.checkOut, lang)}`, room: roomLabel(r.roomUnitId) }),
          { title: k('swap.title'), confirmLabel: k('swap.confirm'), cancelLabel: t('crm.hotels.common.cancel') },
        );
        if (ok) {
          let swapReason = reason;
          if (!swapReason && other.status === 'checked_in') {
            const v = await showPrompt({ title: k('confirm.relocateTitle', { name: other.guestName }), label: k('confirm.reasonLabel'), placeholder: k('confirm.reasonPh'), confirmLabel: k('swap.confirm'), cancelLabel: t('crm.hotels.common.cancel') });
            swapReason = v?.trim() || undefined;
            if (!swapReason) { setBusy(false); await load(true); return; }
          }
          try {
            await moveReservation(r.id, { ...dto, reason: swapReason, swap: true });
            showAlert(k('swapped'), { variant: 'success' });
          } catch (e2) {
            showAlert(errText(e2), { variant: 'error' });
          }
        }
      } else if (err?.code === 'HOTEL_MOVE_CONFLICT' && payload?.conflicts?.length) {
        showAlert(k('conflictList', { list: payload.conflicts.map((c) => `${c.guestName} (${fmtDate(c.checkIn, lang)} – ${fmtDate(c.checkOut, lang)})`).join(', ') }), { variant: 'error' });
      } else {
        showAlert(errText(e), { variant: 'error' });
      }
    } finally {
      setBusy(false);
      await load(true);
    }
  };

  // ── перетаскивание ──
  const rowAt = (clientX: number, clientY: number): { unit: string | undefined; roomType: string | undefined } => {
    const el = document.elementsFromPoint(clientX, clientY).find((x) => (x as HTMLElement).dataset?.rackRow) as HTMLElement | undefined;
    const g = gridRef.current?.getBoundingClientRect();
    if (!el || !g || clientY < g.top || clientY > g.bottom) return { unit: undefined, roomType: undefined };
    return { unit: el.dataset.rackUnit ?? '', roomType: el.dataset.rackType };
  };

  const onBarDown = (e: React.PointerEvent, r: HotelRackReservation, mode: Drag['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const d: Drag = { id: r.id, mode, startX: e.clientX, startY: e.clientY, moved: false, dayDelta: 0, targetUnit: r.roomUnitId || '', targetRoomType: r.roomTypeId };
    dragRef.current = d;
    setDrag(d);
    setHover(null);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
      const next: Drag = { ...d, moved, dayDelta: Math.round(dx / col) };
      if (d.mode === 'move') {
        const t2 = rowAt(e.clientX, e.clientY);
        next.targetUnit = t2.unit;
        next.targetRoomType = t2.roomType;
      }
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      const r = byId.get(d.id);
      if (!r) return;
      if (!d.moved) { setSelectedId(r.id); return; }
      if (d.mode === 'resize') {
        const n = Math.max(1, nightsOf(r.checkIn, r.checkOut) + d.dayDelta);
        const checkOut = addDaysIso(r.checkIn, n);
        if (checkOut !== r.checkOut) void doMove(r, { checkOut });
        return;
      }
      if (d.targetUnit === undefined) return;
      const dto: HotelReservationMoveInput = {};
      if (d.dayDelta) {
        if (r.status === 'checked_in') { showAlert(t('crm.hotels.rack.errors.HOTEL_MOVE_IN_HOUSE_DATES'), { variant: 'error' }); return; }
        dto.checkIn = addDaysIso(r.checkIn, d.dayDelta);
      }
      const targetUnit = d.targetUnit || null;
      // «без номера» другого типа не бывает: тип меняется только через конкретный номер
      if (targetUnit !== r.roomUnitId && !(targetUnit === null && d.targetRoomType !== r.roomTypeId)) dto.roomUnitId = targetUnit;
      if (dto.checkIn || dto.roomUnitId !== undefined) void doMove(r, dto);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, col, byId]);

  /** Предпросмотр цели: где окажется полоса и свободно ли там (точная проверка — на сервере) */
  const ghost = useMemo(() => {
    if (!drag?.moved || !rack) return null;
    const r = byId.get(drag.id);
    if (!r) return null;
    const n = nightsOf(r.checkIn, r.checkOut);
    const checkIn = drag.mode === 'resize' ? r.checkIn : addDaysIso(r.checkIn, drag.dayDelta);
    const checkOut = drag.mode === 'resize' ? addDaysIso(r.checkIn, Math.max(1, n + drag.dayDelta)) : addDaysIso(checkIn, n);
    const unit = drag.mode === 'resize' ? r.roomUnitId || '' : drag.targetUnit;
    if (unit === undefined) return null;
    let ok = true;
    if (unit) {
      const u = unitById.get(unit);
      const oooHit = (rack.outages || []).some((o) => o.roomUnitId === unit && o.kind === 'ooo' && o.dateFrom < checkOut && (!o.dateTo || o.dateTo > checkIn));
      ok = !!u && u.active && !oooHit && u.housekeepingStatus !== 'out_of_order' && !rack.reservations.some((o) => o.id !== r.id && o.roomUnitId === unit && BLOCKING.has(o.status) && overlaps(checkIn, checkOut, o.checkIn, o.checkOut));
    } else if (drag.mode === 'move' && drag.targetRoomType !== r.roomTypeId) ok = false;
    if (r.status === 'checked_in' && checkIn !== r.checkIn) ok = false;
    return { r, unit, roomType: unit ? unitById.get(unit)?.roomTypeId : drag.targetRoomType, checkIn, checkOut, ok };
  }, [drag, rack, byId, unitById]);

  const barGeom = (checkIn: string, checkOut: string) => {
    const s = dayIndex(from, checkIn);
    const e = dayIndex(from, checkOut);
    // полоса от середины дня заезда до середины дня выезда — видно смену гостей в один день
    const left = Math.max(0, s * col + col / 2);
    const right = Math.min(span * col, e * col + col / 2);
    return { left, width: Math.max(8, right - left - 2), clipL: s * col + col / 2 < 0, clipR: e * col + col / 2 > span * col };
  };

  const renderBar = (r: HotelRackReservation) => {
    const g = barGeom(r.checkIn, r.checkOut);
    if (g.width <= 0 || g.left >= span * col) return null;
    const paid = Number(r.paidAmount) || 0;
    const total = (Number(r.total) || 0) + (Number(r.extrasTotal) || 0);
    const unpaid = r.status !== 'checked_out' && total > 0 && paid < total;
    const dim = !!search && !matches(r);
    const isDragging = drag?.id === r.id && drag.moved;
    return (
      <div
        key={r.id}
        className={`htl-rack-bar st-${r.status}${r.isComplimentary ? ' comp' : ''}${g.clipL ? ' clip-l' : ''}${g.clipR ? ' clip-r' : ''}${dim ? ' dim' : ''}${search && !dim ? ' hit' : ''}${isDragging ? ' dragging' : ''}${selectedId === r.id ? ' sel' : ''}${lockOf.has(r.id) ? ' locked' : ''}`}
        style={{ left: g.left, width: g.width }}
        title={lockOf.has(r.id) ? t('crm.hotels.live.editing', { name: lockOf.get(r.id)!.userName }) : undefined}
        onPointerDown={(e) => onBarDown(e, r, 'move')}
        onMouseEnter={(e) => !drag && setHover({ r, x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => !drag && setHover({ r, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHover(null)}
      >
        <span className="nm">{r.guestName}</span>
        {lockOf.get(r.id) && <span className="lock" title={t('crm.hotels.live.editing', { name: lockOf.get(r.id)!.userName })}>✎</span>}
        <span className="ico">
          {r.status === 'pending' && r.optionUntil && <span title={t('crm.hotels.lifecycle.optionUntilLine', { date: new Date(r.optionUntil).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}><Ic d={BAR_ICON.hourglass} size={11} sw={2} /></span>}
          {r.isComplimentary && <span title={t('crm.hotels.lifecycle.compTag')}><Ic d={BAR_ICON.gift} size={11} sw={2} /></span>}
          {r.children > 0 && <span title={k('icons.children', { n: r.children })}><Ic d={BAR_ICON.child} size={11} sw={2} /></span>}
          {unpaid && <span className="unpaid" title={k('icons.unpaid', { paid: money(paid, cur, lang), total: money(total, cur, lang) })}><Ic d={BAR_ICON.coin} size={11} sw={2} /></span>}
          {r.notes && <span title={r.notes}><Ic d={HTL_ICON.pencil} size={11} sw={2} /></span>}
          {(r.earlyCheckIn || r.lateCheckOut) && <span title={[r.earlyCheckIn ? k('icons.early') : '', r.lateCheckOut ? k('icons.late') : ''].filter(Boolean).join(' · ')}><Ic d={BAR_ICON.clock} size={11} sw={2} /></span>}
        </span>
        {r.status !== 'checked_out' && <span className="rz" onPointerDown={(e) => onBarDown(e, r, 'resize')} title={k('resizeHint')} />}
      </div>
    );
  };

  const onCellClick = (e: React.MouseEvent<HTMLDivElement>, row: Row) => {
    if (row.kind === 'group' || drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left) / col);
    const d = days[i];
    if (!d) return;
    if (row.kind === 'unit') {
      const u = unitById.get(row.unitId);
      if (!u?.active || u.housekeepingStatus === 'out_of_order' || oooOn(u.id, d)) return;
      const busyCell = rack?.reservations.some((r) => r.roomUnitId === row.unitId && BLOCKING.has(r.status) && r.checkIn <= d && r.checkOut > d);
      if (busyCell) return;
      setCreate({ roomTypeId: row.roomTypeId, roomUnitId: row.unitId, checkIn: d });
    } else {
      setCreate({ roomTypeId: row.roomTypeId, roomUnitId: null, checkIn: d });
    }
  };

  const dayHead = (d: string) => {
    const x = new Date(`${d}T00:00:00`);
    return { dd: x.getDate(), wd: x.toLocaleDateString(lang, { weekday: 'short' }).slice(0, 2), we: x.getDay() === 0 || x.getDay() === 6, first: x.getDate() === 1, mon: x.toLocaleDateString(lang, { month: 'short' }) };
  };
  const todayIdx = dayIndex(from, today);
  const gridW = span * col;
  const bgStyle: React.CSSProperties = {
    width: gridW,
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${col - 1}px, var(--line-3) ${col - 1}px, var(--line-3) ${col}px)`,
  };
  const weekendCols = days.map((d, i) => (dayHead(d).we ? i : -1)).filter((i) => i >= 0);

  const rowReservations = (row: Row) => {
    if (!rack) return [];
    if (row.kind === 'unit') return rack.reservations.filter((r) => r.roomUnitId === row.unitId);
    if (row.kind === 'lane') return rack.reservations.filter((r) => r.roomTypeId === row.roomTypeId && (!r.roomUnitId || !unitById.has(r.roomUnitId)) && unassignedLane.get(r.id) === row.lane);
    return [];
  };

  const stats = useMemo(() => {
    const list = rack?.reservations || [];
    return {
      arrivals: list.filter((r) => r.checkIn === today && (r.status === 'confirmed' || r.status === 'pending')).length,
      departures: list.filter((r) => r.checkOut === today && r.status === 'checked_in').length,
      inHouse: list.filter((r) => r.status === 'checked_in' && r.checkIn <= today && r.checkOut > today).length,
      unassigned: list.filter((r) => !r.roomUnitId && BLOCKING.has(r.status) && r.checkOut > today).length,
    };
  }, [rack, today]);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelRack" />
      <div className="px-scope">
        <HotelsSubnav active="rack" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{rack ? k('kicker', { hotel: rack.hotel.name }) : k('kickerEmpty')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate('/hotels/frontdesk')}>{k('toFrontDesk')}</button>
            <button className="btn btn-primary" disabled={!rack?.roomTypes.length} onClick={() => setCreate({ roomTypeId: rack!.roomTypes[0].id, roomUnitId: null, checkIn: today })}>
              <Ic d={HTL_ICON.plus} size={14} />{k('newReservation')}
            </button>
          </div>
        </div>

        {rack && (
          <div className="htl-rack-kpis">
            <div><span>{k('kpi.arrivals')}</span><b>{stats.arrivals}</b></div>
            <div><span>{k('kpi.departures')}</span><b>{stats.departures}</b></div>
            <div><span>{k('kpi.inHouse')}</span><b>{stats.inHouse}</b></div>
            <div><span>{k('kpi.unassigned')}</span><b>{stats.unassigned}</b></div>
            <div><span>{k('kpi.occupancyToday')}</span><b>{todayIdx >= 0 && todayIdx < span ? `${totals.occ[todayIdx]}%` : '—'}</b></div>
          </div>
        )}

        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setFrom(addDaysIso(from, -Math.max(1, Math.floor(span / 2))))} title={k('prev')}>‹</button>
          <DateInput className="htl-date" value={from} onChange={(v) => v && setFrom(v)}  inline clearable={false} />
          <button className="btn btn-sm" onClick={() => setFrom(addDaysIso(from, Math.max(1, Math.floor(span / 2))))} title={k('next')}>›</button>
          <button className="btn btn-sm" onClick={() => setFrom(addDaysIso(todayIso(), -2))}>{k('today')}</button>
          <span className={`htl-live${live.connected ? ' on' : ''}`} title={t(live.connected ? 'crm.hotels.live.onTitle' : 'crm.hotels.live.offTitle')}>{t(live.connected ? 'crm.hotels.live.on' : 'crm.hotels.live.off')}</span>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {SPANS.map((s) => (
              <div key={s} className={`bk-sv-tab${span === s ? ' active' : ''}`} onClick={() => setSpan(s)}>{k('days', { n: s })}</div>
            ))}
          </div>
          <select className="htl-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{k('allTypes')}</option>
            {rack?.roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
          </select>
          <select className="htl-select" value={hkFilter} onChange={(e) => setHkFilter(e.target.value as typeof hkFilter)}>
            <option value="">{k('allStatuses')}</option>
            {(['clean', 'dirty', 'inspected', 'out_of_order'] as const).map((s) => <option key={s} value={s}>{t(`crm.hotels.detail.housekeeping.${s}`)}</option>)}
          </select>
          {floors.length > 0 && (
            <select className="htl-select" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
              <option value="">{t('crm.hotels.hk.allFloors')}</option>
              {floors.map((f) => <option key={f} value={f}>{t('crm.hotels.hk.floor', { floor: f })}</option>)}
            </select>
          )}
          <div className="htl-rack-search">
            <Ic d={HTL_ICON.search} size={13} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={k('searchPh')} />
            {search && <span className="n">{(rack?.reservations || []).filter(matches).length}</span>}
          </div>
        </div>

        <div className="htl-rack-legend">
          {(['pending', 'confirmed', 'checked_in', 'checked_out'] as const).map((s) => (
            <span key={s}><i className={`sw st-${s}`} />{t(`crm.hotels.reservations.status.${s}`)}</span>
          ))}
          <span><i className="sw ooo" />{t('crm.hotels.detail.housekeeping.out_of_order')}</span>
          <span className="hint">{k('dragHint')}</span>
        </div>

        {!hotels.length && !loading ? (
          <div className="htl-empty"><h4>{k('noHotels')}</h4></div>
        ) : error ? (
          <div className="htl-empty"><h4>{k('loadError')}</h4><p>{error}</p><button className="btn" onClick={() => void load()}>{k('retry')}</button></div>
        ) : !rack ? (
          <div className="htl-rack-skel">{Array.from({ length: 8 }, (_, i) => <div key={i} />)}</div>
        ) : !rack.units.length && !rack.reservations.length ? (
          <div className="htl-empty">
            <h4>{k('noUnits')}</h4>
            <p>{k('noUnitsHint')}</p>
            <button className="btn" onClick={() => navigate(`/hotels/${hotelId}`)}>{k('toRooms')}</button>
          </div>
        ) : (
          <div ref={wrapRef} className={`htl-rack-wrap${busy || loading ? ' busy' : ''}${drag?.moved ? ' dragging' : ''}`}>
            <div className="htl-rack" ref={gridRef} style={{ width: LEFT + gridW }}>
              <div className="htl-rack-head">
                <div className="corner" style={{ width: LEFT }}>{k('room')}</div>
                <div className="days" style={{ width: gridW }}>
                  {days.map((d, i) => {
                    const h = dayHead(d);
                    return (
                      <div key={d} className={`d${h.we ? ' we' : ''}${d === today ? ' today' : ''}${h.first || i === 0 ? ' first' : ''}`} style={{ width: col }}>
                        {(h.first || i === 0) && <span className="mon">{h.mon}</span>}
                        <span className="wd">{h.wd}</span>
                        <span className="dd">{h.dd}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {rows.map((row) => {
                if (row.kind === 'group') {
                  const free = freeByType.get(row.roomTypeId) || [];
                  return (
                    <div key={row.key} className="htl-rack-row group">
                      <div className="lbl" style={{ width: LEFT }}>{row.name}</div>
                      <div className="cells" style={{ width: gridW }}>
                        {free.map((n, i) => (
                          <span key={i} className={`free${n <= 0 ? (n < 0 ? ' over' : ' zero') : ''}`} style={{ width: col }} title={k('freeTitle', { n })}>{n}</span>
                        ))}
                      </div>
                    </div>
                  );
                }
                const isTarget = ghost && (row.kind === 'unit' ? ghost.unit === row.unitId : ghost.unit === '' && ghost.roomType === row.roomTypeId && row.lane === 0);
                const ooo = row.kind === 'unit' && (row.hk === 'out_of_order' || !row.active);
                return (
                  <div
                    key={row.key}
                    className={`htl-rack-row ${row.kind}${ooo ? ' ooo' : ''}${isTarget ? (ghost!.ok ? ' tgt-ok' : ' tgt-bad') : ''}`}
                    data-rack-row="1"
                    data-rack-unit={row.kind === 'unit' ? row.unitId : ''}
                    data-rack-type={row.roomTypeId}
                    style={{ height: ROW_H }}
                  >
                    <div className="lbl" style={{ width: LEFT }}>
                      {row.kind === 'unit' ? (
                        <>
                          <HousekeepingBadge status={row.hk} title={t(`crm.hotels.detail.housekeeping.${row.hk}`)} />
                          <b>{row.label}</b>
                          {unitById.get(row.unitId)?.floor && <span className="tag">{t('crm.hotels.hk.floorShort', { floor: unitById.get(row.unitId)!.floor })}</span>}
                          {!row.active && <span className="tag">{k('inactive')}</span>}
                          {row.note && <span className="note" title={row.note}><Ic d={HTL_ICON.pencil} size={11} /></span>}
                        </>
                      ) : (
                        <span className="lane">{k('unassignedLane')}{row.lanes > 1 ? ` · ${row.lane + 1}` : ''}</span>
                      )}
                    </div>
                    <div className="cells" style={bgStyle} onClick={(e) => onCellClick(e, row)}>
                      {weekendCols.map((i) => <span key={`w${i}`} className="we-col" style={{ left: i * col, width: col }} />)}
                      {todayIdx >= 0 && todayIdx < span && <span className="today-col" style={{ left: todayIdx * col, width: col }} />}
                      {row.kind === 'unit' && (rack.outages || []).filter((o) => o.roomUnitId === row.unitId).map((o) => {
                        const s0 = Math.max(0, dayIndex(from, o.dateFrom));
                        const e0 = Math.min(span, o.dateTo ? dayIndex(from, o.dateTo) : span);
                        if (e0 <= s0) return null;
                        const label = `${t(`crm.hotels.hk.kinds.${o.kind}`)} · ${t(`crm.hotels.hk.outageReasons.${o.reason}`, { defaultValue: o.reason })}`;
                        return <div key={o.id} className={`htl-rack-out${o.kind === 'oos' ? ' oos' : ''}`} style={{ left: s0 * col + 1, width: (e0 - s0) * col - 2 }} title={o.note ? `${label}: ${o.note}` : label} onClick={(e) => e.stopPropagation()}>{label}</div>;
                      })}
                      {rowReservations(row).map(renderBar)}
                      {isTarget && ghost && (() => {
                        const g = barGeom(ghost.checkIn, ghost.checkOut);
                        return <div className={`htl-rack-ghost${ghost.ok ? '' : ' bad'}`} style={{ left: g.left, width: g.width }}>{fmtDate(ghost.checkIn, lang)} – {fmtDate(ghost.checkOut, lang)}</div>;
                      })()}
                    </div>
                  </div>
                );
              })}

              <div className="htl-rack-foot">
                <div className="htl-rack-row sum">
                  <div className="lbl" style={{ width: LEFT }}>{k('freeTotal')}</div>
                  <div className="cells" style={{ width: gridW }}>
                    {totals.free.map((n, i) => <span key={i} className={`free${n <= 0 ? (n < 0 ? ' over' : ' zero') : ''}`} style={{ width: col }}>{n}</span>)}
                  </div>
                </div>
                <div className="htl-rack-row sum">
                  <div className="lbl" style={{ width: LEFT }}>{k('occupancy')}</div>
                  <div className="cells" style={{ width: gridW }}>
                    {totals.occ.map((n, i) => <span key={i} className="occ" style={{ width: col }}>{n}%</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {hover && !drag && (
          <div className="htl-rack-tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: Math.min(hover.y + 14, window.innerHeight - 200) }}>
            <b>{hover.r.guestName}</b>
            <div>{fmtDate(hover.r.checkIn, lang)} – {fmtDate(hover.r.checkOut, lang)} · {k('nights', { count: nightsOf(hover.r.checkIn, hover.r.checkOut) })}</div>
            <div>{typeName(hover.r.roomTypeId)} · {roomLabel(hover.r.roomUnitId)}</div>
            <div>{k('paxLine', { pax: hover.r.pax, children: hover.r.children })}{hover.r.boardType ? ` · ${hover.r.boardType}` : ''}</div>
            {hover.r.agencyId && <div>{agencyName.get(hover.r.agencyId)}</div>}
            <div>{t(`crm.hotels.reservations.status.${hover.r.status}`)} · {money(Number(hover.r.paidAmount), cur, lang)} / {money((Number(hover.r.total) || 0) + (Number(hover.r.extrasTotal) || 0), cur, lang)}</div>
          </div>
        )}

        {selected && rack && (
          <RackSheet
            r={selected}
            rack={rack}
            agencyName={selected.agencyId ? agencyName.get(selected.agencyId) || null : null}
            lang={lang}
            onClose={() => setSelectedId(null)}
            onChanged={() => void load(true)}
            onUnassign={() => void doMove(selected, { roomUnitId: null })}
          />
        )}

        {create && rack && (
          <ReservationModal
            hotels={hotels}
            roomTypes={allRoomTypes}
            agencies={agencies}
            initial={null}
            prefill={{ hotelId: rack.hotel.id, roomTypeId: create.roomTypeId, roomUnitId: create.roomUnitId, checkIn: create.checkIn, checkOut: addDaysIso(create.checkIn, 1) }}
            saving={saving}
            setSaving={setSaving}
            onClose={() => setCreate(null)}
            onSaved={(r) => { setCreate(null); void load(true).then(() => setSelectedId(r.id)); }}
          />
        )}
      </div>
    </MainLayout>
  );
};

/** Боковая панель брони в шахматке: сводка, действия ресепшна, история изменений */
const RackSheet: React.FC<{
  r: HotelRackReservation;
  rack: HotelRack;
  agencyName: string | null;
  lang: string;
  onClose: () => void;
  onChanged: () => void;
  onUnassign: () => void;
}> = ({ r, rack, agencyName, lang, onClose, onChanged, onUnassign }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.rack.${key}`, o);
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [tab, setTab] = useState<'info' | 'folio' | 'history'>('info');
  const [history, setHistory] = useState<HotelReservationHistoryEntry[] | null>(null);
  const [unitId, setUnitId] = useState(r.roomUnitId || '');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'cancel' | 'noShow' | null>(null);
  const cur = rack.hotel.currency;
  const today = todayIso();
  const unit = r.roomUnitId ? rack.units.find((u) => u.id === r.roomUnitId) : null;

  useEffect(() => { setUnitId(r.roomUnitId || ''); }, [r.id, r.roomUnitId]);
  useEffect(() => {
    if (tab !== 'history') return;
    setHistory(null);
    fetchReservationHistory(r.id).then(setHistory).catch(() => setHistory([]));
  }, [tab, r.id, r.roomUnitId, r.checkIn, r.checkOut, r.status, r.paidAmount]);

  // свободные номера того же типа на даты брони — для заселения прямо из шахматки
  const freeUnits = rack.units.filter(
    (u) => u.roomTypeId === r.roomTypeId && u.active && u.housekeepingStatus !== 'out_of_order' &&
      !rack.reservations.some((o) => o.id !== r.id && o.roomUnitId === u.id && BLOCKING.has(o.status) && overlaps(r.checkIn, r.checkOut, o.checkIn, o.checkOut)),
  );
  const canCheckIn = (r.status === 'confirmed' || r.status === 'pending') && r.checkIn <= today;
  const canCheckOut = r.status === 'checked_in';
  const paid = Number(r.paidAmount) || 0;
  const total = (Number(r.total) || 0) + (Number(r.extrasTotal) || 0);

  const act = (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    fn()
      .then(() => { showAlert(okMsg, { variant: 'success' }); onChanged(); })
      .catch((e: ApiError) => showAlert(e?.code ? t(`crm.hotels.rack.errors.${e.code}`, { defaultValue: e.message }) : e.message, { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet">
        <div className="htl-sheet-head">
          <div>
            <div className="htl-sub" style={{ marginBottom: 4 }}>{r.bookingCode || k('sheet.noCode')}</div>
            <h3>{r.guestName}</h3>
            <span className={`htl-rack-badge st-${r.status}`}>{t(`crm.hotels.reservations.status.${r.status}`)}</span>
          </div>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">
          <div className="htl-seg" style={{ marginBottom: 16 }}>
            <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>{k('sheet.info')}</button>
            <button className={tab === 'folio' ? 'on' : ''} onClick={() => setTab('folio')}>{t('crm.hotels.folio.title')}</button>
            <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>{k('sheet.history')}</button>
          </div>

          {tab === 'info' ? (
            <>
              <div className="htl-rack-facts">
                <div><span>{k('sheet.dates')}</span><b>{fmtDate(r.checkIn, lang)} – {fmtDate(r.checkOut, lang)}</b><em>{k('nights', { count: nightsOf(r.checkIn, r.checkOut) })}</em></div>
                <div><span>{k('sheet.room')}</span><b>{unit ? unit.label : k('noRoom')}</b><em>{rack.roomTypes.find((x) => x.id === r.roomTypeId)?.name}</em></div>
                <div><span>{k('sheet.guests')}</span><b>{k('paxLine', { pax: r.pax, children: r.children })}</b><em>{[r.infants ? t('crm.hotels.guestsPicker.babyCot', { count: r.infants }) : '', r.boardType ? `${r.boardType} · ${t(`crm.hotels.board.${r.boardType}`)}` : ''].filter(Boolean).join(' · ') || '—'}</em></div>
                <div><span>{k('sheet.partner')}</span><b>{agencyName || k('sheet.direct')}</b><em>{r.voucherNo ? `${t('crm.hotels.reservations.drawer.voucher')} ${r.voucherNo}` : null}{r.voucherNo && r.guestCountry ? ' · ' : null}{r.guestCountry ? <CountryTag code={r.guestCountry} /> : r.voucherNo ? null : '—'}</em></div>
                <div><span>{k('sheet.payment')}</span><b>{money(paid, cur, lang)} / {money(total, cur, lang)}</b><em>{t(`crm.hotels.reservations.paidStatus.${r.paidStatus}`)}</em></div>
                <div><span>{k('sheet.contact')}</span><b>{r.guestPhone || '—'}</b><em>{r.guestEmail || '—'}</em></div>
              </div>
              {(r.earlyCheckIn || r.lateCheckOut) && (
                <div className="htl-chips" style={{ marginBottom: 12 }}>
                  {r.earlyCheckIn && <span className="htl-chip">{k('icons.early')}</span>}
                  {r.lateCheckOut && <span className="htl-chip">{k('icons.late')}</span>}
                </div>
              )}
              {r.notes && <div className="htl-rack-note">{r.notes}</div>}

              {canCheckIn && (
                <div className="htl-panel" style={{ marginTop: 12 }}>
                  <div className="htl-f">
                    <label>{k('sheet.checkInRoom')}</label>
                    <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                      <option value="">{k('sheet.pickRoom')}</option>
                      {freeUnits.map((u) => <option key={u.id} value={u.id}>{u.label} · {t(`crm.hotels.detail.housekeeping.${u.housekeepingStatus}`)}</option>)}
                    </select>
                    {!freeUnits.length && <div className="htl-hint">{k('sheet.noFreeRooms')}</div>}
                    {unitId && rack.units.find((u) => u.id === unitId)?.housekeepingStatus === 'dirty' && <div className="htl-hint">{k('sheet.dirtyWarning')}</div>}
                  </div>
                </div>
              )}
            </>
          ) : tab === 'folio' ? (
            <FolioPanel reservation={r} currency={cur} onChanged={onChanged} />
          ) : (
            <ReservationHistoryList entries={history} units={rack.units} roomTypes={rack.roomTypes} agencies={rack.agencies} lang={lang} />
          )}
        </div>
        <div className="htl-sheet-foot">
          <button className="btn" style={{ marginRight: 'auto' }} onClick={() => navigate(`/hotels/reservations?reservation=${r.id}`)}>{k('sheet.open')}</button>
          {r.roomUnitId && r.status !== 'checked_in' && r.status !== 'checked_out' && (
            <button className="btn" disabled={busy} onClick={onUnassign}>{k('sheet.unassign')}</button>
          )}
          {(r.status === 'confirmed' || r.status === 'pending') && r.checkIn <= today && (
            <button className="btn" disabled={busy} onClick={() => setDialog('noShow')}>{t('crm.hotels.frontDesk.noShow')}</button>
          )}
          {(r.status === 'confirmed' || r.status === 'pending') && (
            <button className="btn" disabled={busy} onClick={() => setDialog('cancel')}>{t('crm.hotels.frontDesk.cancel')}</button>
          )}
          {canCheckOut && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act(() => checkOutReservation(r.id), k('sheet.checkedOut'))}>{k('sheet.checkOut')}</button>
          )}
          {canCheckIn && (
            <button className="btn btn-primary" disabled={busy || !unitId} onClick={() => act(() => checkInReservation(r.id, unitId), k('sheet.checkedIn'))}>
              <Ic d={HTL_ICON.check} size={14} />{k('sheet.checkIn')}
            </button>
          )}
        </div>
      </div>
      {dialog === 'cancel' && <CancelReservationDialog reservation={r} currency={cur} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onChanged(); onClose(); }} />}
      {dialog === 'noShow' && <NoShowDialog reservation={r} currency={cur} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onChanged(); onClose(); }} />}
    </div>
  );
};
