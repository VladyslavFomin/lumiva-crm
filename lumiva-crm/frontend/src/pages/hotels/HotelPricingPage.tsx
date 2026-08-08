import React, { useEffect, useMemo, useState } from 'react';
import { Toggle } from '../../components/ui';
import { MainLayout } from '../../layout/MainLayout';
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

const PeriodEditor: React.FC<{
  initial?: HotelPricingPeriod;
  onSave: (startDate: string, endDate: string) => void;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [start, setStart] = useState(initial?.startDate || '');
  const [end, setEnd] = useState(initial?.endDate || '');
  return (
    <div className="period-editor">
      <div style={{ fontSize: 13, fontWeight: 600 }}>{initial ? 'Изменить период' : 'Новый период'}</div>
      <div className="row2">
        <div><label>Начало</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label>Конец</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="period-editor-foot">
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={onCancel}>Отмена</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => start && end && onSave(start, end)}>Сохранить</button>
      </div>
    </div>
  );
};

export const HotelPricingPage: React.FC = () => {
  const { showAlert, showConfirm } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [marketGroups, setMarketGroups] = useState<HotelMarketGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<HotelPricingPeriod[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [rows, setRows] = useState<HotelDailyMarketRateRow[]>([]);
  const [stoppedDates, setStoppedDates] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [selAnchor, setSelAnchor] = useState<CellPos | null>(null);
  const [selFocus, setSelFocus] = useState<CellPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchHotels()
      .then((h) => {
        setHotels(h);
        if (h.length) setHotelId(h[0].id);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    fetchRoomTypes(hotelId)
      .then((rts) => {
        setRoomTypes(rts);
        if (rts.length) setRoomTypeId(rts[0].id);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить типы номеров', { variant: 'error' }));
    loadMarketGroups(hotelId);
    loadPeriods(hotelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const loadMarketGroups = (hId: string) => {
    fetchMarketGroups(hId)
      .then(setMarketGroups)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить группы рынков', { variant: 'error' }));
  };

  const addMarketGroup = () => {
    const name = window.prompt('Название группы рынков (например, Batı Avrupa)');
    if (!name || !name.trim()) return;
    createMarketGroup(hotelId, name.trim())
      .then(() => loadMarketGroups(hotelId))
      .catch((e) => showAlert(e.message || 'Не удалось добавить группу', { variant: 'error' }));
  };

  const renameMarketGroup = (id: string, name: string) => {
    if (!name.trim()) {
      setEditingGroupId(null);
      return;
    }
    updateMarketGroup(id, name.trim())
      .then(() => loadMarketGroups(hotelId))
      .catch((e) => showAlert(e.message || 'Не удалось переименовать группу', { variant: 'error' }))
      .finally(() => setEditingGroupId(null));
  };

  const removeMarketGroupAndRefresh = async (group: HotelMarketGroup) => {
    const ok = await showConfirm(`Удалить группу рынков «${group.name}»? Все цены по этой группе будут удалены.`, {
      title: 'Удалить группу рынков',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    deleteMarketGroup(group.id)
      .then(() => {
        loadMarketGroups(hotelId);
        if (roomTypeId && visibleDays.length) fetchDailyRates(roomTypeId, visibleDays).then(setRows);
      })
      .catch((e) => showAlert(e.message || 'Не удалось удалить группу', { variant: 'error' }));
  };

  const loadPeriods = (hId: string) => {
    fetchPricingPeriods(hId)
      .then((p) => {
        setPeriods(p);
        setSelectedPeriods(p.map((x) => x.id));
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить периоды', { variant: 'error' }));
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
      .catch((e) => showAlert(e.message || 'Не удалось загрузить цены', { variant: 'error' }));
    fetchStopSaleDates(roomTypeId, visibleDays)
      .then(setStoppedDates)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить стоп-даты', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId, visibleDays.join(',')]);

  const toggleStopSaleDate = (date: string) => {
    if (!roomTypeId) return;
    const stopped = !stoppedDates.includes(date);
    setStopSaleDate(roomTypeId, date, stopped)
      .then(() => setStoppedDates((prev) => (stopped ? [...prev, date] : prev.filter((d) => d !== date))))
      .catch((e) => showAlert(e.message || 'Не удалось изменить стоп-продажу', { variant: 'error' }));
  };

  const addPeriod = (startDate: string, endDate: string) => {
    createPricingPeriod(hotelId, { startDate, endDate })
      .then(() => {
        setEditing(null);
        loadPeriods(hotelId);
      })
      .catch((e) => showAlert(e.message || 'Не удалось создать период', { variant: 'error' }));
  };
  const savePeriod = (id: string, startDate: string, endDate: string) => {
    updatePricingPeriod(id, { startDate, endDate })
      .then(() => {
        setEditing(null);
        loadPeriods(hotelId);
      })
      .catch((e) => showAlert(e.message || 'Не удалось сохранить период', { variant: 'error' }));
  };
  const removePeriod = (id: string) => {
    deletePricingPeriod(id)
      .then(() => loadPeriods(hotelId))
      .catch((e) => showAlert(e.message || 'Не удалось удалить период', { variant: 'error' }));
  };
  const toggleSelected = (id: string) =>
    setSelectedPeriods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const updateCell = (date: string, marketGroupId: string, field: EditableField, val: string) => {
    const dto: any = { [field]: val };
    upsertDailyRate(roomTypeId, marketGroupId, date, dto)
      .then(() => fetchDailyRates(roomTypeId, visibleDays).then(setRows))
      .catch((e) => showAlert(e.message || 'Не удалось сохранить цену', { variant: 'error' }));
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
    return (g as any)[EDITABLE_FIELDS[col % FIELDS_PER_GROUP]] ?? '';
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
      .catch((err) => showAlert(err.message || 'Не удалось вставить данные', { variant: 'error' }));
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="pricing" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />ЦЕНА ЗА ЧЕЛОВЕКА / НОЧЬ · ПОДНЕВНО</div>
            <h1>Цены по рынкам продаж</h1>
            <p className="sub">Периоды ниже — это фильтр диапазона дат для отображения. В таблице каждая дата — отдельная строка, с ценой на человека за ночь по каждому рынку.</p>
          </div>
          <div className="htl-hero-r io-toolbar">
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
              {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />Импорт Excel</button>
          </div>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: 16 }}>
          Диапазоны дат для отображения
        </div>
        <div className="period-toolbar">
          {periods.map((p) => (
            <div key={p.id} className="period-chip" style={{ opacity: selectedPeriods.includes(p.id) ? 1 : 0.4, position: 'relative' }}>
              <input type="checkbox" checked={selectedPeriods.includes(p.id)} onChange={() => toggleSelected(p.id)} style={{ margin: 0 }} />
              <span onClick={() => setEditing(p.id)} style={{ cursor: 'pointer' }}>{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</span>
              <button onClick={() => removePeriod(p.id)} title="Удалить диапазон">×</button>
              {editing === p.id && (
                <PeriodEditor initial={p} onCancel={() => setEditing(null)} onSave={(s, e) => savePeriod(p.id, s, e)} />
              )}
            </div>
          ))}
          <div style={{ position: 'relative' }}>
            <button className="period-add-btn" onClick={() => setEditing('new')}><Ic d={HTL_ICON.plus} size={13} />Добавить диапазон</button>
            {editing === 'new' && <PeriodEditor onCancel={() => setEditing(null)} onSave={addPeriod} />}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
          <b style={{ color: 'var(--ink)' }}>{hotels.find((h) => h.id === hotelId)?.name}</b> · {roomTypes.find((r) => r.id === roomTypeId)?.name} · цена указана{' '}
          <b style={{ color: 'var(--ink)' }}>на 1 человека за ночь</b> · показано дат: <b style={{ color: 'var(--ink)' }}>{visibleDays.length}</b>
        </div>

        <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '8px 0 4px' }}>
          Выделите ячейки мышью (или Shift+клик) — Ctrl+C копирует, Ctrl+V вставляет сразу в несколько ячеек, как в Excel.
          Первая колонка (дата) закреплена при горизонтальной прокрутке.
        </div>
        <div className="ppt-wrap" style={{ marginTop: 4 }} onKeyDown={handleGridKeyDown} onPaste={handleGridPaste}>
          <table className="ppt-table">
            <thead>
              <tr className="grp">
                <th className="periyot-h" rowSpan={2}>
                  Tarih
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: 8, padding: '2px 8px', fontSize: 10.5, fontWeight: 500, textTransform: 'none', verticalAlign: 'middle' }}
                    onClick={addMarketGroup}
                    title="Добавить группу рынков"
                  >
                    <Ic d={HTL_ICON.plus} size={11} />Рынок
                  </button>
                </th>
                <th rowSpan={2} style={{ width: 54 }}>Стоп</th>
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
                        <span style={{ cursor: 'pointer' }} onClick={() => setEditingGroupId(g.id)} title="Переименовать группу">{g.name}</span>
                        <button
                          style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                          title="Удалить группу рынков"
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
                    <th>Bütçe</th><th>PP Ort.</th><th className="brut">Brüt</th><th>İndirim</th><th>Net</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={2 + marketGroups.length * 5} style={{ padding: 24, color: 'var(--fg-3)' }}>Нет выбранных диапазонов — отметьте один выше или добавьте новый.</td></tr>
              )}
              {rows.map((row, rowIdx) => {
                const isStopped = stoppedDates.includes(row.date);
                return (
                <tr key={row.date} className={isStopped ? 'ppt-stopped' : undefined}>
                  <td className="periyot">
                    {fmtDate(row.date)}
                    {isStopped && <span className="ppt-stop-badge">СТОП</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Toggle
                      checked={isStopped}
                      onChange={() => toggleStopSaleDate(row.date)}
                      aria-label={`Стоп-продажа на ${row.date} (все рынки)`}
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
                        <td {...cellProps(0)}>
                          <input key={`${row.date}-${g.marketGroupId}-b-${g.budgetPP}`} defaultValue={g.budgetPP} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'budgetPP', e.target.value)} /> €
                        </td>
                        <td {...cellProps(1)}>
                          <input key={`${row.date}-${g.marketGroupId}-p-${g.ppAvg}`} defaultValue={g.ppAvg} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'ppAvg', e.target.value)} /> €
                        </td>
                        <td {...cellProps(2, 'brut-cell')}>
                          <input key={`${row.date}-${g.marketGroupId}-g-${g.grossPP}`} defaultValue={g.grossPP} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'grossPP', e.target.value)} /> €
                        </td>
                        <td {...cellProps(3)}>
                          <input key={`${row.date}-${g.marketGroupId}-d-${g.discountPct}`} defaultValue={g.discountPct} style={{ width: 44 }} onBlur={(e) => updateCell(row.date, g.marketGroupId, 'discountPct', e.target.value)} />%
                        </td>
                        <td className="net-cell">{fmtEUR(Number(g.netPP))}</td>
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
          <b style={{ color: 'var(--ink)' }}>Bütçe</b> — себестоимость на человека/ночь · <b style={{ color: 'var(--ink)' }}>PP Ort.</b> — средняя фактическая цена за период ·{' '}
          <b style={{ color: 'var(--ink)' }}>Brüt</b> — желаемая (целевая) цена до скидки · <b style={{ color: 'var(--ink)' }}>İndirim</b> — скидка рынка ·{' '}
          <b style={{ color: 'var(--ink)' }}>Net</b> — итоговая цена клиенту на эту дату.
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
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelPricingImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; message: string }>; total: number } | null>(null);

  const handleFile = (file: File) => {
    setBusy(true);
    previewPricingImport(file)
      .then(setPreview)
      .catch((e) => showAlert(e.message || 'Не удалось прочитать файл', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyPricingImport({ importId: preview.importId, hotelId, roomTypeId })
      .then(setResult)
      .catch((e) => showAlert(e.message || 'Не удалось применить импорт', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>Импорт цен из Excel</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>Загрузите .xlsx с ценами по датам</div>
              <div style={{ fontSize: 11.5 }}>Формат: одна дата на строку (Tarih/Дата), рынки группами колонок — "&lt;Группа&gt; Bütçe/Brüt/İndirim"</div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                Выбрать файл
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </div>
          )}
          {preview && !result && (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
              Найдено {preview.totalRows} строк, дата определена как «{preview.suggestedMapping.date || '—'}». Колонки рынков сопоставляются автоматически по названию группы.
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Обновлено <b>{result.created}</b> значений из {result.total} строк.</div>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>Строка {e.row}: {e.message}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? 'Закрыть' : 'Отмена'}</button>
          {preview && !result && <button className="btn btn-primary" disabled={busy} onClick={handleApply}><Ic d={HTL_ICON.check} size={14} />Загрузить</button>}
          {result && <button className="btn btn-primary" onClick={onDone}>Готово</button>}
        </div>
      </div>
    </div>
  );
};
