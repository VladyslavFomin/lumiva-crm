import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../components/ui';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchHotels,
  fetchRoomTypes,
  fetchMarketGroups,
  createMarketGroup,
  updateMarketGroup,
  deleteMarketGroup,
  fetchPricingPeriods,
  createPricingPeriod,
  updatePricingPeriod,
  deletePricingPeriod,
  fetchDailyRates,
  bulkFillDailyRates,
  upsertDailyRate,
  fetchStopSaleDates,
  setStopSaleDate,
  previewPricingImport,
  applyPricingImport,
  type Hotel,
  type HotelRoomType,
  type HotelMarketGroup,
  type HotelPricingPeriod,
  type HotelDailyMarketRateRow,
  type HotelPricingImportPreview,
} from '../../api/hotels';
import './hotels-design.css';
import { DateInput } from '../../components/ui/DateInput';

function fmtEUR(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function listDatesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const EDITABLE_FIELDS = ['budgetPP', 'ppAvg', 'grossPP', 'discountPct'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
const FIELDS_PER_GROUP = EDITABLE_FIELDS.length;

interface CellPos {
  row: number;
  col: number;
}

/** Модалка периода (раньше — абсолютный поповер у чипа, вылезал за край экрана справа). */
const PeriodEditor: React.FC<{
  initial?: HotelPricingPeriod;
  onSave: (startDate: string, endDate: string) => void;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const { t } = useTranslation();
  const pe = (key: string) => t(`crm.hotels.pricing.periodEditor.${key}`);
  const [start, setStart] = useState(initial?.startDate || '');
  const [end, setEnd] = useState(initial?.endDate || '');
  const invalid = !!start && !!end && end < start;
  return (
    <SmallDialog
      title={initial ? pe('editTitle') : pe('newTitle')}
      onClose={onCancel}
      foot={
        <>
          <button type="button" className="btn" onClick={onCancel}>{pe('cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!start || !end || invalid} onClick={() => onSave(start, end)}>{pe('save')}</button>
        </>
      }
    >
      <div className="bk-row2">
        <div>
          <label>{pe('startLabel')}</label>
          <DateInput value={start} onChange={(v) => { setStart(v); if (v && (!end || end < v)) setEnd(v); }} clearable={false} />
        </div>
        <div>
          <label>{pe('endLabel')}</label>
          <DateInput value={end} min={start || undefined} onChange={(v) => setEnd(v)} clearable={false} />
        </div>
      </div>
      {invalid && <div className="htl-hint" style={{ color: 'var(--danger, #c0392b)' }}>{pe('endBeforeStart')}</div>}
    </SmallDialog>
  );
};

/** Новая группа рынков — вместо системного window.prompt. */
const MarketGroupDialog: React.FC<{ onSave: (name: string) => Promise<void>; onCancel: () => void }> = ({ onSave, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    onSave(name.trim()).finally(() => setBusy(false));
  };
  return (
    <SmallDialog
      title={t('crm.hotels.pricing.addMarketGroupTitle')}
      onClose={onCancel}
      foot={
        <>
          <button type="button" className="btn" onClick={onCancel}>{t('crm.hotels.pricing.periodEditor.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!name.trim() || busy} onClick={submit}>{t('crm.hotels.pricing.addGroupSave')}</button>
        </>
      }
    >
      <label>{t('crm.hotels.pricing.groupNameLabel')}</label>
      <input autoFocus value={name} maxLength={80} placeholder={t('crm.hotels.pricing.groupNamePh')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="htl-hint">{t('crm.hotels.pricing.groupNameHint')}</div>
    </SmallDialog>
  );
};

const SmallDialog: React.FC<{ title: string; onClose: () => void; foot: React.ReactNode; children: React.ReactNode }> = ({ title, onClose, foot, children }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('crm.hotels.pricing.periodEditor.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">{children}</div>
        <div className="bk-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  );
};

/** «Заполнить диапазон»: одни Brüt/İndirim (и при желании Bütçe/PP Ort.) на все даты периода для выбранных групп. */
const BulkFillDialog: React.FC<{
  groups: HotelMarketGroup[];
  defaultFrom: string;
  defaultTo: string;
  onSave: (dto: { marketGroupIds: string[]; from: string; to: string; weekdays: number[]; grossPP?: string; discountPct?: string; budgetPP?: string; ppAvg?: string }) => Promise<void>;
  onCancel: () => void;
}> = ({ groups, defaultFrom, defaultTo, onSave, onCancel }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pricing.bulk.${key}`, o);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [groupIds, setGroupIds] = useState<string[]>(groups.map((g) => g.id));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [vals, setVals] = useState({ grossPP: '', discountPct: '', budgetPP: '', ppAvg: '' });
  const [busy, setBusy] = useState(false);
  const dayNames = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language || 'ru', { weekday: 'short' }).replace('.', '')),
    [i18n.language],
  );
  const hasValue = Object.values(vals).some((v) => v.trim() !== '');
  const valid = !!from && !!to && to >= from && groupIds.length > 0 && weekdays.length > 0 && hasValue;
  const submit = () => {
    if (!valid || busy) return;
    setBusy(true);
    const dto: any = { marketGroupIds: groupIds, from, to, weekdays: weekdays.length === 7 ? [] : weekdays };
    (Object.keys(vals) as Array<keyof typeof vals>).forEach((f) => { if (vals[f].trim() !== '') dto[f] = vals[f].trim(); });
    onSave(dto).finally(() => setBusy(false));
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const net = vals.grossPP.trim() !== '' ? Number(vals.grossPP.replace(',', '.')) * (1 - Number((vals.discountPct || '0').replace(',', '.')) / 100) : null;
  return (
    <SmallDialog
      title={k('title')}
      onClose={onCancel}
      foot={
        <>
          <button type="button" className="btn" onClick={onCancel}>{t('crm.hotels.pricing.periodEditor.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={submit}>{k('apply')}</button>
        </>
      }
    >
      <div className="bk-row2">
        <div>
          <label>{t('crm.hotels.pricing.periodEditor.startLabel')}</label>
          <DateInput value={from} clearable={false} onChange={(v) => { setFrom(v); if (v && (!to || to < v)) setTo(v); }} />
        </div>
        <div>
          <label>{t('crm.hotels.pricing.periodEditor.endLabel')}</label>
          <DateInput value={to} min={from || undefined} clearable={false} onChange={(v) => setTo(v)} />
        </div>
      </div>
      <label>{k('groups')}</label>
      <div className="pp-chips">
        {groups.map((g) => (
          <button type="button" key={g.id} className={groupIds.includes(g.id) ? 'on' : ''} onClick={() => setGroupIds(toggle(groupIds, g.id))}>{g.name}</button>
        ))}
      </div>
      <label>{k('weekdays')}</label>
      <div className="pp-chips">
        {dayNames.map((d, i) => (
          <button type="button" key={d} className={weekdays.includes(i + 1) ? 'on' : ''} onClick={() => setWeekdays(toggle(weekdays, i + 1))}>{d}</button>
        ))}
      </div>
      <div className="bk-row2">
        <div><label>Brüt, €</label><input inputMode="decimal" value={vals.grossPP} onChange={(e) => setVals({ ...vals, grossPP: e.target.value })} placeholder={k('keep')} /></div>
        <div><label>İndirim, %</label><input inputMode="decimal" value={vals.discountPct} onChange={(e) => setVals({ ...vals, discountPct: e.target.value })} placeholder={k('keep')} /></div>
      </div>
      <div className="bk-row2">
        <div><label>Bütçe, € · {k('budgetShort')}</label><input inputMode="decimal" value={vals.budgetPP} onChange={(e) => setVals({ ...vals, budgetPP: e.target.value })} placeholder={k('keep')} /></div>
        <div />
      </div>
      <div className="htl-hint">
        {net !== null && Number.isFinite(net) ? k('netPreview', { net: net.toFixed(2) }) + ' · ' : ''}
        {k('hint')}
      </div>
    </SmallDialog>
  );
};

export const HotelPricingPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [marketGroups, setMarketGroups] = useState<HotelMarketGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [periods, setPeriods] = useState<HotelPricingPeriod[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [rows, setRows] = useState<HotelDailyMarketRateRow[]>([]);
  const [stoppedDates, setStoppedDates] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [baseRows, setBaseRows] = useState<HotelDailyMarketRateRow[]>([]);
  const [selAnchor, setSelAnchor] = useState<CellPos | null>(null);
  const [selFocus, setSelFocus] = useState<CellPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchHotels()
      .then((h) => {
        setHotels(h);
        if (h.length) setHotelId(h[0].id);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.error'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    fetchRoomTypes(hotelId)
      .then((rts) => {
        setRoomTypes(rts);
        if (rts.length) setRoomTypeId(rts[0].id);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.roomTypesError'), { variant: 'error' }));
    loadMarketGroups(hotelId);
    loadPeriods(hotelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const loadMarketGroups = (hId: string) => {
    fetchMarketGroups(hId)
      .then(setMarketGroups)
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.marketGroupsError'), { variant: 'error' }));
  };

  const addMarketGroup = (name: string) =>
    createMarketGroup(hotelId, name)
      .then(() => { setAddingGroup(false); loadMarketGroups(hotelId); })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.addGroupError'), { variant: 'error' }));

  const renameMarketGroup = (id: string, name: string) => {
    if (!name.trim()) {
      setEditingGroupId(null);
      return;
    }
    updateMarketGroup(id, name.trim())
      .then(() => loadMarketGroups(hotelId))
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.renameGroupError'), { variant: 'error' }))
      .finally(() => setEditingGroupId(null));
  };

  const removeMarketGroupAndRefresh = async (group: HotelMarketGroup) => {
    const ok = await showConfirm(t('crm.hotels.pricing.deleteGroupBody', { name: group.name }), {
      title: t('crm.hotels.pricing.deleteGroupTitle'),
      confirmLabel: t('crm.hotels.pricing.deleteGroupConfirm'),
      danger: true,
    });
    if (!ok) return;
    deleteMarketGroup(group.id)
      .then(() => {
        loadMarketGroups(hotelId);
        if (roomTypeId && visibleDays.length) fetchDailyRates(roomTypeId, visibleDays).then(setRows);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.deleteGroupError'), { variant: 'error' }));
  };

  const loadPeriods = (hId: string) => {
    fetchPricingPeriods(hId)
      .then((p) => {
        setPeriods(p);
        setSelectedPeriods(p.map((x) => x.id));
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.periodsError'), { variant: 'error' }));
  };

  const visibleDays = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    periods
      .filter((p) => selectedPeriods.includes(p.id))
      .forEach((p) => {
        for (const d of listDatesBetween(p.startDate, p.endDate)) {
          if (!seen.has(d)) {
            seen.add(d);
            out.push(d);
          }
        }
      });
    return out.sort();
  }, [periods, selectedPeriods]);

  useEffect(() => {
    if (!roomTypeId || !visibleDays.length) {
      setRows([]);
      setStoppedDates([]);
      return;
    }
    fetchDailyRates(roomTypeId, visibleDays)
      .then(setRows)
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.ratesError'), { variant: 'error' }));
    const base = roomTypes.find((r) => r.isBaseRoomType);
    if (base && base.id !== roomTypeId) fetchDailyRates(base.id, visibleDays).then(setBaseRows).catch(() => setBaseRows([]));
    else setBaseRows([]);
    fetchStopSaleDates(roomTypeId, visibleDays)
      .then(setStoppedDates)
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.stopDatesError'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId, visibleDays.join(','), roomTypes]);

  const toggleStopSaleDate = (date: string) => {
    if (!roomTypeId) return;
    const stopped = !stoppedDates.includes(date);
    setStopSaleDate(roomTypeId, date, stopped)
      .then(() => setStoppedDates((prev) => (stopped ? [...prev, date] : prev.filter((d) => d !== date))))
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.toggleStopError'), { variant: 'error' }));
  };

  const addPeriod = (startDate: string, endDate: string) => {
    createPricingPeriod(hotelId, { startDate, endDate })
      .then(() => {
        setEditing(null);
        loadPeriods(hotelId);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.createPeriodError'), { variant: 'error' }));
  };
  const savePeriod = (id: string, startDate: string, endDate: string) => {
    updatePricingPeriod(id, { startDate, endDate })
      .then(() => {
        setEditing(null);
        loadPeriods(hotelId);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.savePeriodError'), { variant: 'error' }));
  };
  const removePeriod = (id: string) => {
    deletePricingPeriod(id)
      .then(() => loadPeriods(hotelId))
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.removePeriodError'), { variant: 'error' }));
  };
  const toggleSelected = (id: string) =>
    setSelectedPeriods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const updateCell = (date: string, marketGroupId: string, field: EditableField, val: string) => {
    const dto: any = { [field]: val };
    upsertDailyRate(roomTypeId, marketGroupId, date, dto)
      .then(() => fetchDailyRates(roomTypeId, visibleDays).then(setRows))
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.saveCellError'), { variant: 'error' }));
  };

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isDragging]);

  const selBounds = useMemo(() => {
    if (!selAnchor || !selFocus) return null;
    return {
      r0: Math.min(selAnchor.row, selFocus.row),
      r1: Math.max(selAnchor.row, selFocus.row),
      c0: Math.min(selAnchor.col, selFocus.col),
      c1: Math.max(selAnchor.col, selFocus.col),
    };
  }, [selAnchor, selFocus]);

  const isCellSelected = (row: number, col: number) =>
    !!selBounds && row >= selBounds.r0 && row <= selBounds.r1 && col >= selBounds.c0 && col <= selBounds.c1;

  const handleCellMouseDown = (row: number, col: number, shiftKey: boolean) => {
    if (shiftKey && selAnchor) {
      setSelFocus({ row, col });
    } else {
      setSelAnchor({ row, col });
      setSelFocus({ row, col });
    }
    setIsDragging(true);
  };

  const cellValueAt = (row: number, col: number): string => {
    const group = marketGroups[Math.floor(col / FIELDS_PER_GROUP)];
    const g = rows[row]?.groups.find((x) => x.marketGroupId === group?.id);
    if (!g) return '';
    const field = EDITABLE_FIELDS[col % FIELDS_PER_GROUP];
    if (field === 'ppAvg') return g.ppActual !== null && g.ppActual !== undefined ? String(g.ppActual) : '';
    return (g as any)[field] ?? '';
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selBounds) {
      const lines: string[] = [];
      for (let r = selBounds.r0; r <= selBounds.r1; r++) {
        const cells: string[] = [];
        for (let c = selBounds.c0; c <= selBounds.c1; c++) cells.push(cellValueAt(r, c));
        lines.push(cells.join('\t'));
      }
      navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
    }
  };

  const handleGridPaste = (e: React.ClipboardEvent) => {
    if (!selAnchor) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
    if (!lines.length) return;
    const startRow = selBounds ? selBounds.r0 : selAnchor.row;
    const startCol = selBounds ? selBounds.c0 : selAnchor.col;
    const updates: Array<{ roomGroupId: string; date: string; field: EditableField; value: string }> = [];
    lines.forEach((line, ri) => {
      const cells = line.split('\t');
      cells.forEach((val, ci) => {
        const row = startRow + ri;
        const col = startCol + ci;
        if (row >= rows.length || col >= marketGroups.length * FIELDS_PER_GROUP) return;
        const group = marketGroups[Math.floor(col / FIELDS_PER_GROUP)];
        if (!group) return;
        // PP Ort. считается по броням — вставка в эту колонку пропускается
        if (EDITABLE_FIELDS[col % FIELDS_PER_GROUP] === 'ppAvg') return;
        updates.push({
          roomGroupId: group.id,
          date: rows[row].date,
          field: EDITABLE_FIELDS[col % FIELDS_PER_GROUP],
          value: val.trim(),
        });
      });
    });
    if (!updates.length) return;
    Promise.all(updates.map((u) => upsertDailyRate(roomTypeId, u.roomGroupId, u.date, { [u.field]: u.value } as any)))
      .then(() => fetchDailyRates(roomTypeId, visibleDays).then(setRows))
      .catch((err) => showAlert(err.message || t('crm.hotels.pricing.pasteError'), { variant: 'error' }));
  };

  // Как из таблицы получается цена брони (то же, что HotelsPricingService.dailyPrices)
  const roomType = roomTypes.find((r) => r.id === roomTypeId) || null;
  const baseType = roomTypes.find((r) => r.isBaseRoomType) || null;
  const isBase = !!roomType && (!baseType || baseType.id === roomType.id);
  const offset = Number(roomType?.ppNetOffset || 0);
  const hotel = hotels.find((h) => h.id === hotelId);
  const refGroupId = hotel?.referenceMarketGroupId && marketGroups.some((g) => g.id === hotel.referenceMarketGroupId) ? hotel.referenceMarketGroupId : marketGroups[0]?.id;
  const baseNetMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of baseRows) for (const g of r.groups) m.set(`${g.marketGroupId}|${r.date}`, Number(g.netPP) || 0);
    return m;
  }, [baseRows]);
  /** Net человека/ночь, по которому пойдёт бронь: свой Net → от базового (+ разница) */
  const effectiveNet = (date: string, groupId: string, ownNet: number): { value: number; derived: boolean } => {
    if (ownNet > 0 || isBase) return { value: ownNet, derived: false };
    const b = baseNetMap.get(`${groupId}|${date}`) || 0;
    if (!(b > 0)) return { value: 0, derived: false };
    return { value: roomType?.pricingMode === 'fixed_rate' ? b : b + offset, derived: true };
  };
  const missingByGroup = useMemo(
    () =>
      marketGroups
        .map((grp) => ({
          group: grp,
          count: rows.filter((r) => {
            const g = r.groups.find((x) => x.marketGroupId === grp.id);
            return !(effectiveNet(r.date, grp.id, Number(g?.netPP) || 0).value > 0);
          }).length,
        }))
        .filter((x) => x.count > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, baseNetMap, marketGroups, roomTypeId, roomTypes],
  );
  const refMissing = missingByGroup.find((x) => x.group.id === refGroupId);
  const pp = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.pricing.flow.${key}`, o);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelPricing" />
      <div className="px-scope">
        <HotelsSubnav active="pricing" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.pricing.kicker')}</div>
            <h1>{t('crm.hotels.pricing.title')}</h1>
            <p className="sub">{t('crm.hotels.pricing.subtitle')}</p>
          </div>
          <div data-tour="pricing-select" className="htl-hero-r io-toolbar">
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
              {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn" disabled={!roomTypeId || !marketGroups.length} onClick={() => setShowBulk(true)}><Ic d={HTL_ICON.plus} size={13} />{t('crm.hotels.pricing.bulk.open')}</button>
            <button data-tour="pricing-import" className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />{t('crm.hotels.pricing.importBtn')}</button>
          </div>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 16 }}>
          {t('crm.hotels.pricing.periodsLabel')}
        </div>
        <div data-tour="pricing-periods" className="period-toolbar">
          {periods.map((p) => (
            <div key={p.id} className="period-chip" style={{ opacity: selectedPeriods.includes(p.id) ? 1 : 0.4, position: 'relative' }}>
              <input type="checkbox" checked={selectedPeriods.includes(p.id)} onChange={() => toggleSelected(p.id)} style={{ margin: 0 }} />
              <span onClick={() => setEditing(p.id)} style={{ cursor: 'pointer' }}>{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</span>
              <button onClick={() => removePeriod(p.id)} title={t('crm.hotels.pricing.removePeriodTitle')}>×</button>
              {editing === p.id && (
                <PeriodEditor initial={p} onCancel={() => setEditing(null)} onSave={(s, e) => savePeriod(p.id, s, e)} />
              )}
            </div>
          ))}
          <div style={{ position: 'relative' }}>
            <button className="period-add-btn" onClick={() => setEditing('new')}><Ic d={HTL_ICON.plus} size={13} />{t('crm.hotels.pricing.addPeriod')}</button>
            {editing === 'new' && <PeriodEditor onCancel={() => setEditing(null)} onSave={addPeriod} />}
            {addingGroup && <MarketGroupDialog onCancel={() => setAddingGroup(false)} onSave={addMarketGroup} />}
            {showBulk && (
              <BulkFillDialog
                groups={marketGroups}
                defaultFrom={visibleDays[0] || ''}
                defaultTo={visibleDays[visibleDays.length - 1] || ''}
                onCancel={() => setShowBulk(false)}
                onSave={(dto) =>
                  bulkFillDailyRates(roomTypeId, dto)
                    .then((r) => {
                      setShowBulk(false);
                      showAlert(t('crm.hotels.pricing.bulk.done', { count: r.updated }), { variant: 'success' });
                      return fetchDailyRates(roomTypeId, visibleDays).then(setRows);
                    })
                    .catch((e) => showAlert(e.message || t('crm.hotels.pricing.bulk.error'), { variant: 'error' }))
                }
              />
            )}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
          <b style={{ color: 'var(--ink)' }}>{hotels.find((h) => h.id === hotelId)?.name}</b> · {roomTypes.find((r) => r.id === roomTypeId)?.name}{' '}
          {t('crm.hotels.pricing.summaryLine', { perPerson: t('crm.hotels.pricing.perPersonPerNight'), count: visibleDays.length })}
        </div>

        {roomType && (
          <div className="pp-flow">
            {!baseType ? (
              <div className="pe-box warn">{pp('noBase')}</div>
            ) : isBase ? (
              <div className="pe-box">{pp('base')}</div>
            ) : (
              <div className="pe-box">
                {roomType.pricingMode === 'fixed_rate'
                  ? pp('derivedFixed', { base: baseType.name })
                  : pp('derived', { base: baseType.name, offset: fmtEUR(offset) })}
              </div>
            )}
            {baseType && Number(baseType.ppNetOffset || 0) !== 0 && (
              <div className="pe-box warn">{pp('baseOffset', { base: baseType.name, offset: fmtEUR(Number(baseType.ppNetOffset)) })}</div>
            )}
            {rows.length > 0 && missingByGroup.length > 0 && (
              <div className="pe-box warn">
                <div>
                  {pp('missing')}{' '}
                  {missingByGroup.map((x, i) => (
                    <span key={x.group.id}>{i > 0 && ', '}<b>{x.group.name}</b> — {pp('days', { count: x.count })}</span>
                  ))}
                </div>
                <div>{refMissing ? pp('missingRef') : pp('missingFallback')}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 4px' }}>
          {t('crm.hotels.pricing.hint')}
        </div>
        <div className="ppt-wrap" style={{ marginTop: 4 }} onKeyDown={handleGridKeyDown} onPaste={handleGridPaste}>
          <table data-tour="pricing-table" className="ppt-table">
            <thead>
              <tr className="grp">
                <th className="periyot-h" rowSpan={2}>
                  {t('crm.hotels.pricing.dateColHeader')}
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: 8, padding: '2px 8px', fontSize: 10.5, fontWeight: 500, textTransform: 'none', verticalAlign: 'middle' }}
                    onClick={() => setAddingGroup(true)}
                    title={t('crm.hotels.pricing.addMarketGroupTitle')}
                  >
                    <Ic d={HTL_ICON.plus} size={11} />{t('crm.hotels.pricing.addMarketGroupBtn')}
                  </button>
                </th>
                <th rowSpan={2} style={{ width: 54 }}>{t('crm.hotels.pricing.stopColHeader')}</th>
                {marketGroups.map((g) => (
                  <th key={g.id} colSpan={5}>
                    {editingGroupId === g.id ? (
                      <input
                        autoFocus
                        defaultValue={g.name}
                        style={{ width: '90%', padding: '2px 4px', fontSize: 12, fontWeight: 400, textTransform: 'none', textAlign: 'center' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameMarketGroup(g.id, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        onBlur={(e) => renameMarketGroup(g.id, e.target.value)}
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setEditingGroupId(g.id)} title={t('crm.hotels.pricing.renameGroupTitle')}>{g.name}</span>
                        <button
                          style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                          title={t('crm.hotels.pricing.removeGroupTitle')}
                          onClick={() => removeMarketGroupAndRefresh(g)}
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </th>
                ))}
              </tr>
              <tr className="sub">
                {marketGroups.map((g) => (
                  <React.Fragment key={g.id}>
                    <th className="ref" title={pp('budgetTitle')}>Bütçe</th><th className="ref" title={pp('ppActHeadTitle')}>PP Ort.</th><th className="brut">Brüt</th><th>İndirim</th><th title={pp('netTitle')}>Net</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={2 + marketGroups.length * 5} style={{ padding: 24, color: 'var(--fg-3)' }}>{t('crm.hotels.pricing.noRangesSelected')}</td></tr>
              )}
              {rows.map((row, rowIdx) => {
                const isStopped = stoppedDates.includes(row.date);
                return (
                <tr key={row.date} className={isStopped ? 'ppt-stopped' : undefined}>
                  <td className="periyot">
                    {fmtDate(row.date)}
                    {isStopped && <span className="ppt-stop-badge">{t('crm.hotels.pricing.stopBadge')}</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Toggle
                      checked={isStopped}
                      onChange={() => toggleStopSaleDate(row.date)}
                      aria-label={t('crm.hotels.pricing.stopSaleAria', { date: row.date })}
                    />
                  </td>
                  {marketGroups.map((group, groupIdx) => {
                    const g = row.groups.find((x) => x.marketGroupId === group.id);
                    if (!g) return null;
                    const cellProps = (fieldIdx: number, extraClass?: string) => {
                      const col = groupIdx * FIELDS_PER_GROUP + fieldIdx;
                      const classes = [extraClass, isCellSelected(rowIdx, col) ? 'ppt-selected' : undefined].filter(Boolean).join(' ');
                      return {
                        className: classes || undefined,
                        onMouseDown: (e: React.MouseEvent) => handleCellMouseDown(rowIdx, col, e.shiftKey),
                        onMouseEnter: () => isDragging && setSelFocus({ row: rowIdx, col }),
                      };
                    };
                    return (
                      <React.Fragment key={g.marketGroupId}>
                        <td {...cellProps(0, 'ref-cell budget-cell')}>
                          <input key={`${row.date}-${g.marketGroupId}-b-${g.budgetPP}`} defaultValue={g.budgetPP} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'budgetPP', e.target.value)} /> €
                        </td>
                        {(() => {
                          // PP Ort. — факт по броням этой даты (считается сам); без броней — значение из импорта, если было
                          const budget = Number(g.budgetPP) || 0;
                          const act = g.ppActual ?? null;
                          const legacy = act === null && Number(g.ppAvg) > 0 ? Number(g.ppAvg) : null;
                          const tone = act !== null && budget > 0 ? (act >= budget ? 'up' : 'down') : '';
                          return (
                            <td {...cellProps(1, `ppact-cell ${tone}`)} title={act !== null ? pp('ppActTitle', { count: g.ppActualCount || 0 }) : legacy !== null ? pp('ppLegacyTitle') : pp('ppNoneTitle')}>
                              {act !== null ? fmtEUR(act) : legacy !== null ? <i>{fmtEUR(legacy)}</i> : '—'}
                            </td>
                          );
                        })()}
                        <td {...cellProps(2, 'brut-cell')}>
                          <input key={`${row.date}-${g.marketGroupId}-g-${g.grossPP}`} defaultValue={g.grossPP} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'grossPP', e.target.value)} /> €
                        </td>
                        <td {...cellProps(3)}>
                          <input key={`${row.date}-${g.marketGroupId}-d-${g.discountPct}`} defaultValue={g.discountPct} style={{ width: 56 }} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'discountPct', e.target.value)} />%
                        </td>
                        {(() => {
                          const eff = effectiveNet(row.date, g.marketGroupId, Number(g.netPP) || 0);
                          return eff.derived ? (
                            <td className="net-cell derived" title={pp('derivedCell', { base: baseType?.name || '' })}>{fmtEUR(eff.value)}</td>
                          ) : (
                            <td className={eff.value > 0 ? 'net-cell' : 'net-cell empty'}>{fmtEUR(eff.value)}</td>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, padding: '12px 16px', border: '1px solid var(--line-2)', borderRadius: 12, background: '#fff', fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--ink)' }}>Bütçe</b> — {t('crm.hotels.pricing.legend.budget')} · <b style={{ color: 'var(--ink)' }}>PP Ort.</b> — {t('crm.hotels.pricing.legend.ppAvg')} ·{' '}
          <b style={{ color: 'var(--ink)' }}>Brüt</b> — {t('crm.hotels.pricing.legend.gross')} · <b style={{ color: 'var(--ink)' }}>İndirim</b> — {t('crm.hotels.pricing.legend.discount')} ·{' '}
          <b style={{ color: 'var(--ink)' }}>Net</b> — {t('crm.hotels.pricing.legend.net')}
        </div>
      </div>

      {showImport && (
        <PricingImportModal
          hotelId={hotelId}
          roomTypeId={roomTypeId}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            if (roomTypeId && visibleDays.length) fetchDailyRates(roomTypeId, visibleDays).then(setRows);
          }}
        />
      )}
    </MainLayout>
  );
};

const PricingImportModal: React.FC<{
  hotelId: string;
  roomTypeId: string;
  onClose: () => void;
  onDone: () => void;
}> = ({ hotelId, roomTypeId, onClose, onDone }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelPricingImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; message: string }>; total: number } | null>(null);

  const handleFile = (file: File) => {
    setBusy(true);
    previewPricingImport(file)
      .then(setPreview)
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.importModal.readError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyPricingImport({ importId: preview.importId, hotelId, roomTypeId })
      .then(setResult)
      .catch((e) => showAlert(e.message || t('crm.hotels.pricing.importModal.applyError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{t('crm.hotels.pricing.importModal.title')}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t('crm.hotels.pricing.importModal.dropHint')}</div>
              <div style={{ fontSize: 11.5 }}>{t('crm.hotels.pricing.importModal.formatHint')}</div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                {t('crm.hotels.pricing.importModal.chooseFile')}
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </div>
          )}
          {preview && !result && (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
              {t('crm.hotels.pricing.importModal.foundRows', { count: preview.totalRows, date: preview.suggestedMapping.date || '—' })}
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{t('crm.hotels.pricing.importModal.updatedPrefix')} <b>{result.created}</b> {t('crm.hotels.pricing.importModal.updatedSuffix', { total: result.total })}</div>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>{t('crm.hotels.pricing.importModal.rowError', { row: e.row, message: e.message })}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? t('crm.hotels.pricing.importModal.close') : t('crm.hotels.pricing.importModal.cancel')}</button>
          {preview && !result && <button className="btn btn-primary" disabled={busy} onClick={handleApply}><Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.pricing.importModal.upload')}</button>}
          {result && <button className="btn btn-primary" onClick={onDone}>{t('crm.hotels.pricing.importModal.done')}</button>}
        </div>
      </div>
    </div>
  );
};
