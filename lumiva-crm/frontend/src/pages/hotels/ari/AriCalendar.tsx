import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { DateInput } from '../../../components/ui/DateInput';
import { Ic, HTL_ICON } from '../HotelIcons';
import {
  fetchAriGrid,
  fetchMarketGroups,
  saveAriBulk,
  type HotelAriBulkPatch,
  type HotelAriDay,
  type HotelAriGrid,
  type HotelMarketGroup,
} from '../../../api/hotels';
import './ari.css';

type RowKey = 'free' | 'price' | 'stop' | 'cta' | 'ctd' | 'min' | 'max';
const ROWS: RowKey[] = ['free', 'price', 'stop', 'cta', 'ctd', 'min', 'max'];
const EDITABLE: RowKey[] = ['price', 'stop', 'cta', 'ctd', 'min', 'max'];
const BOOL: RowKey[] = ['stop', 'cta', 'ctd'];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => {
  const w = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};

/** Правка одного поля для диапазона — то, что уходит в /hotels/ari/bulk */
function patchFor(row: RowKey, value: string | boolean): Partial<HotelAriBulkPatch> {
  switch (row) {
    case 'price':
      return { price: String(value).trim() ? String(value).trim() : null };
    case 'stop':
      return { stop: !!value };
    case 'cta':
      return { closedToArrival: !!value };
    case 'ctd':
      return { closedToDeparture: !!value };
    case 'min':
      return { minNights: String(value).trim() ? Number(value) : null };
    case 'max':
      return { maxNights: String(value).trim() ? Number(value) : null };
    default:
      return {};
  }
}

interface Selection { roomTypeId: string; row: RowKey; a: number; b: number }

/**
 * Календарь ограничений: типы номеров × дни — свободно, цена (по прайсу или ручная), стоп-продажа, закрыто на заезд /
 * выезд, минимум и максимум ночей. Клик — правка дня, протяжка по строке — правка диапазона, «Изменить диапазон» —
 * массово по дням недели и типам номеров. Всё это уходит в каналы продаж в течение минуты.
 */
export const AriCalendar: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.ari.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [from, setFrom] = useState('');
  const [days, setDays] = useState<14 | 31>(14);
  const [adults, setAdults] = useState(2);
  const [groups, setGroups] = useState<HotelMarketGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const [grid, setGrid] = useState<HotelAriGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{ roomTypeId: string; row: RowKey; date: string; value: string } | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [bulk, setBulk] = useState<{ roomTypeIds: string[]; from: string; to: string; row?: RowKey } | null>(null);
  const dragging = useRef(false);

  const load = useCallback(() => {
    if (!hotelId) return;
    setLoading(true);
    fetchAriGrid(hotelId, { from: from || undefined, days, adults, marketGroupId: groupId || null })
      .then((g) => {
        setGrid(g);
        setFailed(null);
        if (!from) setFrom(g.from);
      })
      .catch((e) => setFailed(e.message || k('loadError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, from, days, adults, groupId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setFrom('');
    setGroupId('');
    if (hotelId) fetchMarketGroups(hotelId).then(setGroups).catch(() => setGroups([]));
  }, [hotelId]);
  useEffect(() => {
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setSel((s) => {
        if (s && s.a !== s.b && grid) {
          const [a, b] = s.a < s.b ? [s.a, s.b] : [s.b, s.a];
          setBulk({ roomTypeIds: [s.roomTypeId], from: grid.dates[a], to: grid.dates[b], row: s.row });
        }
        return null;
      });
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [grid]);

  const apply = (dto: HotelAriBulkPatch, msg?: string) => {
    setSaving(true);
    return saveAriBulk(dto)
      .then((r) => {
        if (msg) showAlert(msg.replace('{n}', String(r.dates * r.roomTypes)), { variant: 'success' });
        load();
        return true;
      })
      .catch((e) => {
        showAlert(e.message || k('saveError'), { variant: 'error' });
        return false;
      })
      .finally(() => setSaving(false));
  };

  const cellValue = (d: HotelAriDay, row: RowKey) => {
    switch (row) {
      case 'free': return d.free;
      case 'price': return d.manualPrice ?? d.price;
      case 'stop': return d.stop;
      case 'cta': return d.closedToArrival;
      case 'ctd': return d.closedToDeparture;
      case 'min': return d.minStay;
      case 'max': return d.maxStay;
    }
  };

  const onCellDown = (roomTypeId: string, row: RowKey, idx: number, e: React.MouseEvent) => {
    if (!EDITABLE.includes(row) || e.button !== 0) return;
    dragging.current = true;
    setSel({ roomTypeId, row, a: idx, b: idx });
  };
  const onCellEnter = (roomTypeId: string, row: RowKey, idx: number) => {
    if (!dragging.current) return;
    setSel((s) => (s && s.roomTypeId === roomTypeId && s.row === row ? { ...s, b: idx } : s));
  };
  const onCellClick = (roomTypeId: string, row: RowKey, d: HotelAriDay) => {
    if (!EDITABLE.includes(row) || saving) return;
    if (BOOL.includes(row)) {
      if (row === 'stop' && d.stopElsewhere) {
        showAlert(k('stopElsewhere'), { variant: 'error' });
        return;
      }
      void apply({ roomTypeIds: [roomTypeId], from: d.date, to: d.date, ...patchFor(row, !cellValue(d, row)) });
      return;
    }
    const v = row === 'price' ? (d.manualPrice !== null ? String(d.manualPrice) : '') : row === 'max' ? (d.maxStay ? String(d.maxStay) : '') : String(d.minStay);
    setEdit({ roomTypeId, row, date: d.date, value: v });
  };
  const commitEdit = () => {
    if (!edit) return;
    const e = edit;
    setEdit(null);
    void apply({ roomTypeIds: [e.roomTypeId], from: e.date, to: e.date, ...patchFor(e.row, e.value) });
  };

  const fmtPrice = (v: number | null) => (v === null ? '—' : v.toLocaleString(loc, { maximumFractionDigits: v % 1 ? 2 : 0 }));
  const head = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return {
      wd: d.toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' }),
      dm: d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    };
  };
  const shift = (n: number) => setFrom((f) => addDays(f || grid?.from || '', n));

  const inSel = (roomTypeId: string, row: RowKey, idx: number) => {
    if (!sel || sel.roomTypeId !== roomTypeId || sel.row !== row) return false;
    const [a, b] = sel.a < sel.b ? [sel.a, sel.b] : [sel.b, sel.a];
    return idx >= a && idx <= b;
  };

  const toolbar = (
    <div className="ari-bar">
      <div className="ari-nav">
        <button type="button" className="btn btn-sm" onClick={() => shift(-days)} aria-label={k('prev')}><Ic d={HTL_ICON.chev} size={13} sw={2} style={{ transform: 'rotate(90deg)' }} /></button>
        <DateInput inline clearable={false} value={from} onChange={(v) => v && setFrom(v)} />
        <button type="button" className="btn btn-sm" onClick={() => shift(days)} aria-label={k('next')}><Ic d={HTL_ICON.chev} size={13} sw={2} style={{ transform: 'rotate(-90deg)' }} /></button>
        <button type="button" className="btn btn-sm" onClick={() => grid && setFrom(grid.today)}>{k('today')}</button>
        <div className="htl-seg">
          <button type="button" className={days === 14 ? 'on' : ''} onClick={() => setDays(14)}>{k('days', { count: 14 })}</button>
          <button type="button" className={days === 31 ? 'on' : ''} onClick={() => setDays(31)}>{k('days', { count: 31 })}</button>
        </div>
      </div>
      <div className="ari-opts">
        <label>
          {k('priceFor')}
          <select className="base-select" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{k('adults', { count: n })}</option>)}
          </select>
        </label>
        {groups.length > 0 && (
          <label>
            {k('market')}
            <select className="base-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{k('reference')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="btn btn-primary" disabled={!grid?.roomTypes.length} onClick={() => grid && setBulk({ roomTypeIds: grid.roomTypes.map((r) => r.id), from: grid.dates[0], to: grid.dates[grid.dates.length - 1] })}>
          <Ic d={HTL_ICON.pencil} size={13} />{k('bulkBtn')}
        </button>
      </div>
    </div>
  );

  if (failed && !grid) {
    return (
      <div className="ari-wrap">
        {toolbar}
        <div className="ari-empty"><h4>{k('loadError')}</h4><p>{failed}</p><button type="button" className="btn" onClick={load}>{k('retry')}</button></div>
      </div>
    );
  }
  if (!grid) return <div className="ari-wrap">{toolbar}<div className="ari-empty"><p>{k('loading')}</p></div></div>;
  if (!grid.roomTypes.length) return <div className="ari-wrap">{toolbar}<div className="ari-empty"><h4>{k('noRooms')}</h4><p>{k('noRoomsText')}</p></div></div>;

  return (
    <div className={`ari-wrap${loading || saving ? ' busy' : ''}`}>
      {toolbar}
      <div className="ari-hint">{k('hint')}</div>
      <div className="ari-scroll" onMouseLeave={() => { if (!dragging.current) setSel(null); }}>
        <table className="ari-table">
          <thead>
            <tr>
              <th className="ari-c0">{grid.currency}</th>
              {grid.dates.map((d) => {
                const h = head(d);
                return (
                  <th key={d} className={`${weekday(d) >= 6 ? 'we' : ''}${d === grid.today ? ' today' : ''}`}>
                    <span>{h.wd}</span>
                    <b>{h.dm}</b>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.roomTypes.map((rt) => (
              <React.Fragment key={rt.id}>
                <tr className="ari-room">
                  <td className="ari-c0" colSpan={grid.dates.length + 1}>
                    <b>{rt.name}</b>
                    {rt.isBase && <span className="ari-tag">{k('base')}</span>}
                    {rt.stopSale && <span className="ari-tag stop">{k('stopSale')}</span>}
                  </td>
                </tr>
                {ROWS.map((row) => (
                  <tr key={row} className={`ari-row r-${row}`}>
                    <td className="ari-c0 lbl" title={k(`rowHint.${row}`)}>{k(`rows.${row}`)}</td>
                    {rt.days.map((d, idx) => {
                      const v = cellValue(d, row);
                      const editing = edit && edit.roomTypeId === rt.id && edit.row === row && edit.date === d.date;
                      const cls = [
                        weekday(d.date) >= 6 ? 'we' : '',
                        EDITABLE.includes(row) ? 'ed' : '',
                        inSel(rt.id, row, idx) ? 'sel' : '',
                        row === 'free' && d.free <= 0 ? 'zero' : '',
                        row === 'price' && d.manualPrice !== null ? 'man' : '',
                        row === 'price' && d.price === null ? 'none' : '',
                        BOOL.includes(row) && v ? 'on' : '',
                        row === 'stop' && d.stopElsewhere ? 'ext' : '',
                        row === 'min' && d.minStay > 1 ? 'set' : '',
                        row === 'max' && d.maxStay > 0 ? 'set' : '',
                      ].filter(Boolean).join(' ');
                      if (editing) {
                        return (
                          <td key={d.date} className={`${cls} editing`}>
                            <input
                              autoFocus
                              inputMode={row === 'price' ? 'decimal' : 'numeric'}
                              value={edit!.value}
                              placeholder={row === 'price' ? k('byPrice') : row === 'max' ? '∞' : '1'}
                              onChange={(e) => setEdit({ ...edit!, value: e.target.value })}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setEdit(null);
                              }}
                            />
                          </td>
                        );
                      }
                      const title =
                        row === 'price'
                          ? d.manualPrice !== null ? k('manualTip', { price: fmtPrice(d.price) }) : d.price === null ? k('noPriceTip') : k('priceTip')
                          : row === 'stop' && d.stopElsewhere ? k('stopElsewhere') : undefined;
                      return (
                        <td
                          key={d.date}
                          className={cls}
                          title={title}
                          onMouseDown={(e) => onCellDown(rt.id, row, idx, e)}
                          onMouseEnter={() => onCellEnter(rt.id, row, idx)}
                          onClick={() => (sel && sel.a !== sel.b ? undefined : onCellClick(rt.id, row, d))}
                        >
                          {row === 'free' && d.free}
                          {row === 'price' && (
                            <>
                              {fmtPrice(d.price)}
                              {d.discountPct > 0 && <i className="disc">−{d.discountPct}%</i>}
                            </>
                          )}
                          {BOOL.includes(row) && (v ? <span className="dot" /> : null)}
                          {row === 'min' && (d.minStay > 1 ? d.minStay : '·')}
                          {row === 'max' && (d.maxStay > 0 ? d.maxStay : '·')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ari-legend">
        <span><i className="sw man" />{k('legend.manual')}</span>
        <span><i className="sw on" />{k('legend.closed')}</span>
        <span><i className="sw ext" />{k('legend.ext')}</span>
        <span><i className="sw zero" />{k('legend.soldOut')}</span>
        <span className="muted">{k('legend.channels')}</span>
      </div>
      {bulk && (
        <AriBulkDialog
          grid={grid}
          initial={bulk}
          saving={saving}
          onCancel={() => setBulk(null)}
          onApply={(dto) => apply(dto, k('bulkDone')).then((ok) => ok && setBulk(null))}
        />
      )}
    </div>
  );
};

type Tri = '' | 'yes' | 'no';

/** Массовая правка: типы номеров × диапазон дат × дни недели; меняются только заданные поля */
const AriBulkDialog: React.FC<{
  grid: HotelAriGrid;
  initial: { roomTypeIds: string[]; from: string; to: string; row?: RowKey };
  saving: boolean;
  onCancel: () => void;
  onApply: (dto: HotelAriBulkPatch) => void;
}> = ({ grid, initial, saving, onCancel, onApply }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.ari.${key}`, o);
  const wdNames = t('crm.hotels.calendarCommon.dow', { returnObjects: true }) as string[];
  const [rooms, setRooms] = useState<string[]>(initial.roomTypeIds);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [priceMode, setPriceMode] = useState<'' | 'set' | 'reset'>(initial.row === 'price' ? 'set' : '');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [stop, setStop] = useState<Tri>(initial.row === 'stop' ? 'yes' : '');
  const [cta, setCta] = useState<Tri>(initial.row === 'cta' ? 'yes' : '');
  const [ctd, setCtd] = useState<Tri>(initial.row === 'ctd' ? 'yes' : '');
  const [minN, setMinN] = useState('');
  const [maxMode, setMaxMode] = useState<'' | 'set' | 'reset'>(initial.row === 'max' ? 'set' : '');
  const [maxN, setMaxN] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCancel]);

  const dto: HotelAriBulkPatch = { roomTypeIds: rooms, from, to, weekdays: weekdays.length === 7 ? undefined : weekdays };
  if (priceMode === 'set') dto.price = price;
  if (priceMode === 'reset') dto.price = null;
  if (discount.trim()) dto.discountPct = discount;
  if (stop) dto.stop = stop === 'yes';
  if (cta) dto.closedToArrival = cta === 'yes';
  if (ctd) dto.closedToDeparture = ctd === 'yes';
  if (minN.trim()) dto.minNights = Number(minN);
  if (maxMode === 'set') dto.maxNights = Number(maxN);
  if (maxMode === 'reset') dto.maxNights = null;
  const changes = Object.keys(dto).filter((x) => !['roomTypeIds', 'from', 'to', 'weekdays'].includes(x)).length;
  const invalid =
    !rooms.length || !from || !to || to < from || !weekdays.length || !changes ||
    (priceMode === 'set' && !(Number(price.replace(',', '.')) > 0)) ||
    (maxMode === 'set' && !(Number(maxN) >= 1)) ||
    (!!minN.trim() && !(Number(minN) >= 1));

  const tri = (label: string, value: Tri, set: (v: Tri) => void, yes: string, no: string) => (
    <div className="ari-f">
      <span>{label}</span>
      <div className="htl-seg">
        <button type="button" className={value === '' ? 'on' : ''} onClick={() => set('')}>{k('bulk.keep')}</button>
        <button type="button" className={value === 'yes' ? 'on' : ''} onClick={() => set('yes')}>{yes}</button>
        <button type="button" className={value === 'no' ? 'on' : ''} onClick={() => set('no')}>{no}</button>
      </div>
    </div>
  );

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onCancel} />
      <div className="bk-modal ari-dialog lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('bulk.title')}</h3>
          <button type="button" onClick={onCancel} aria-label={k('bulk.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <div className="ari-f">
            <span>{k('bulk.rooms')}</span>
            <div className="ari-chips">
              {grid.roomTypes.map((r) => (
                <label key={r.id} className={`ari-chip${rooms.includes(r.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={rooms.includes(r.id)} onChange={() => setRooms((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
          <div className="bk-row2">
            <div><label>{k('bulk.from')}</label><DateInput value={from} onChange={(v) => { setFrom(v); if (v && to < v) setTo(v); }} clearable={false} /></div>
            <div><label>{k('bulk.to')}</label><DateInput value={to} min={from || undefined} onChange={setTo} clearable={false} /></div>
          </div>
          <div className="ari-f">
            <span>{k('bulk.weekdays')}</span>
            <div className="ari-chips">
              {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                <button key={w} type="button" className={`ari-chip${weekdays.includes(w) ? ' on' : ''}`} onClick={() => setWeekdays((x) => (x.includes(w) ? x.filter((y) => y !== w) : [...x, w].sort()))}>
                  {wdNames[w - 1]}
                </button>
              ))}
            </div>
          </div>
          <div className="ari-sep" />
          <div className="ari-f">
            <span>{k('bulk.price')}</span>
            <div className="ari-inline">
              <div className="htl-seg">
                <button type="button" className={priceMode === '' ? 'on' : ''} onClick={() => setPriceMode('')}>{k('bulk.keep')}</button>
                <button type="button" className={priceMode === 'set' ? 'on' : ''} onClick={() => setPriceMode('set')}>{k('bulk.priceSet')}</button>
                <button type="button" className={priceMode === 'reset' ? 'on' : ''} onClick={() => setPriceMode('reset')}>{k('bulk.priceReset')}</button>
              </div>
              {priceMode === 'set' && <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={grid.currency} />}
            </div>
          </div>
          <div className="ari-f">
            <span>{k('bulk.discount')}</span>
            <input className="ari-num" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={k('bulk.keep')} />
          </div>
          {tri(k('rows.stop'), stop, setStop, k('bulk.close'), k('bulk.open'))}
          {tri(k('rows.cta'), cta, setCta, k('bulk.close'), k('bulk.open'))}
          {tri(k('rows.ctd'), ctd, setCtd, k('bulk.close'), k('bulk.open'))}
          <div className="ari-f">
            <span>{k('rows.min')}</span>
            <input className="ari-num" inputMode="numeric" value={minN} onChange={(e) => setMinN(e.target.value.replace(/\D/g, ''))} placeholder={k('bulk.keep')} />
          </div>
          <div className="ari-f">
            <span>{k('rows.max')}</span>
            <div className="ari-inline">
              <div className="htl-seg">
                <button type="button" className={maxMode === '' ? 'on' : ''} onClick={() => setMaxMode('')}>{k('bulk.keep')}</button>
                <button type="button" className={maxMode === 'set' ? 'on' : ''} onClick={() => setMaxMode('set')}>{k('bulk.maxSet')}</button>
                <button type="button" className={maxMode === 'reset' ? 'on' : ''} onClick={() => setMaxMode('reset')}>{k('bulk.maxReset')}</button>
              </div>
              {maxMode === 'set' && <input className="ari-num" inputMode="numeric" value={maxN} onChange={(e) => setMaxN(e.target.value.replace(/\D/g, ''))} />}
            </div>
          </div>
        </div>
        <div className="bk-modal-foot">
          <span className="ari-sum">{changes ? k('bulk.summary', { fields: changes, rooms: rooms.length }) : k('bulk.nothing')}</span>
          <button type="button" className="btn" onClick={onCancel}>{k('bulk.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={invalid || saving} onClick={() => onApply(dto)}><Ic d={HTL_ICON.check} size={14} />{k('bulk.apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AriCalendar;
