import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingLocations, type BookingLocation } from '../../api/bookings';
import { fetchZones, createZone, updateZone, deleteZone, saveZoneLayout, type BookingZone, type BookingZoneDecor, type LayoutTableInput } from '../../api/bookingVerticals';
import { DECOR_KINDS, TABLE_SHAPES, Seats, DecorView, defaultTableSize, type TableShape } from './floorShapes';
import { BkModal, EmptyState, errMsg } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

type EdTable = LayoutTableInput & { key: string };
type EdDecor = BookingZoneDecor;
type Sel = { kind: 'table' | 'decor'; key: string } | null;

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;
let seq = 0;
const tmpKey = () => `new-${Date.now()}-${seq++}`;

const DECOR_DEFAULT: Record<BookingZoneDecor['kind'], { w: number; h: number }> = {
  wall: { w: 200, h: 8 },
  bar: { w: 220, h: 50 },
  entrance: { w: 90, h: 30 },
  window: { w: 160, h: 10 },
  kitchen: { w: 200, h: 120 },
  plant: { w: 34, h: 34 },
  stage: { w: 200, h: 100 },
  label: { w: 120, h: 24 },
};

export const RestaurantFloorEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [zones, setZones] = useState<BookingZone[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [tables, setTables] = useState<EdTable[]>([]);
  const [decor, setDecor] = useState<EdDecor[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 1000, h: 640 });
  const [sel, setSel] = useState<Sel>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoneModal, setZoneModal] = useState<{ mode: 'create' | 'edit'; name: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; sel: NonNullable<Sel>; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  useEffect(() => {
    fetchBookingLocations()
      .then((l) => {
        setLocations(l);
        setLocationId((c) => c || l[0]?.id || '');
      })
      .catch(() => undefined);
  }, []);

  const loadZones = (keepZone?: string) =>
    fetchZones(locationId)
      .then((z) => {
        setZones(z);
        const next = keepZone && z.some((x) => x.id === keepZone) ? keepZone : z[0]?.id || '';
        setZoneId(next);
        hydrate(z.find((x) => x.id === next) || null);
      })
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    if (locationId) loadZones();
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hydrate = (z: BookingZone | null) => {
    setTables(
      (z?.tables || []).filter((x) => x.active !== false || x.zoneId).map((x) => ({
        key: x.id,
        id: x.id,
        name: x.name,
        shape: x.shape || 'square',
        posX: x.posX ?? 20,
        posY: x.posY ?? 20,
        width: x.width ?? 80,
        height: x.height ?? 80,
        rotation: x.rotation || 0,
        capacity: x.capacity || 2,
        minCapacity: x.minCapacity ?? null,
        active: x.active,
      })),
    );
    setDecor(z?.decor || []);
    setRemoved([]);
    setSize({ w: z?.width || 1000, h: z?.height || 640 });
    setSel(null);
    setDirty(false);
  };

  const switchZone = async (id: string) => {
    if (dirty && !(await showConfirm(t('crm.bookings.v.editor.unsavedSwitch')))) return;
    setZoneId(id);
    hydrate(zones.find((z) => z.id === id) || null);
  };

  const nextName = () => {
    const nums = tables.map((x) => Number(String(x.name).replace(/\D/g, ''))).filter((n) => Number.isFinite(n));
    const all = zones.flatMap((z) => z.tables.map((x) => Number(String(x.name).replace(/\D/g, '')))).filter((n) => Number.isFinite(n));
    return String(Math.max(0, ...nums, ...all) + 1);
  };

  const addTable = (shape: TableShape) => {
    const seats = shape === 'bar' ? 4 : shape === 'rect' ? 6 : shape === 'booth' ? 4 : shape === 'round' ? 4 : 4;
    const { w, h } = defaultTableSize(shape, seats);
    const key = tmpKey();
    setTables((ts) => [...ts, { key, name: nextName(), shape, posX: snap(40 + (ts.length % 8) * 30), posY: snap(40 + (ts.length % 6) * 30), width: w, height: h, rotation: 0, capacity: seats, minCapacity: null, active: true }]);
    setSel({ kind: 'table', key });
    setDirty(true);
  };

  const addDecor = (kind: BookingZoneDecor['kind']) => {
    const id = tmpKey();
    const d = DECOR_DEFAULT[kind];
    setDecor((ds) => [...ds, { id, kind, x: 30, y: 30, w: d.w, h: d.h, rotation: 0, label: kind === 'label' ? t('crm.bookings.v.editor.decor.label') : null }]);
    setSel({ kind: 'decor', key: id });
    setDirty(true);
  };

  const selTable = sel?.kind === 'table' ? tables.find((x) => x.key === sel.key) || null : null;
  const selDecor = sel?.kind === 'decor' ? decor.find((x) => x.id === sel.key) || null : null;

  const patchTable = (key: string, p: Partial<EdTable>) => {
    setTables((ts) => ts.map((x) => (x.key === key ? { ...x, ...p } : x)));
    setDirty(true);
  };
  const patchDecor = (id: string, p: Partial<EdDecor>) => {
    setDecor((ds) => ds.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setDirty(true);
  };

  const removeSel = () => {
    if (!sel) return;
    if (sel.kind === 'table') {
      const tb = tables.find((x) => x.key === sel.key);
      if (tb?.id) setRemoved((r) => [...r, tb.id!]);
      setTables((ts) => ts.filter((x) => x.key !== sel.key));
    } else {
      setDecor((ds) => ds.filter((x) => x.id !== sel.key));
    }
    setSel(null);
    setDirty(true);
  };

  const duplicateSel = () => {
    if (selTable) {
      const key = tmpKey();
      setTables((ts) => [...ts, { ...selTable, key, id: undefined, name: nextName(), posX: selTable.posX + 20, posY: selTable.posY + 20 }]);
      setSel({ kind: 'table', key });
      setDirty(true);
    } else if (selDecor) {
      const id = tmpKey();
      setDecor((ds) => [...ds, { ...selDecor, id, x: selDecor.x + 20, y: selDecor.y + 20 }]);
      setSel({ kind: 'decor', key: id });
      setDirty(true);
    }
  };

  // клавиатура: стрелки — сдвиг, Delete — удалить, Ctrl/Cmd+D — дублировать
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sel) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const step = e.shiftKey ? GRID * 2 : GRID;
      const move = (dx: number, dy: number) => {
        e.preventDefault();
        if (sel.kind === 'table') setTables((ts) => ts.map((x) => (x.key === sel.key ? { ...x, posX: Math.max(0, x.posX + dx), posY: Math.max(0, x.posY + dy) } : x)));
        else setDecor((ds) => ds.map((x) => (x.id === sel.key ? { ...x, x: x.x + dx, y: x.y + dy } : x)));
        setDirty(true);
      };
      if (e.key === 'ArrowLeft') move(-step, 0);
      else if (e.key === 'ArrowRight') move(step, 0);
      else if (e.key === 'ArrowUp') move(0, -step);
      else if (e.key === 'ArrowDown') move(0, step);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSel();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSel();
      } else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e: React.PointerEvent, s: NonNullable<Sel>, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    setSel(s);
    const item = s.kind === 'table' ? tables.find((x) => x.key === s.key) : decor.find((x) => x.id === s.key);
    if (!item) return;
    const pos = s.kind === 'table' ? { x: (item as EdTable).posX, y: (item as EdTable).posY, w: (item as EdTable).width, h: (item as EdTable).height } : { x: (item as EdDecor).x, y: (item as EdDecor).y, w: (item as EdDecor).w, h: (item as EdDecor).h };
    drag.current = { mode, sel: s, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: pos.w, oh: pos.h };
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* указатель уже отпущен — перетаскивание продолжится через события холста */
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      const nx = Math.min(size.w - 10, Math.max(0, snap(d.ox + dx)));
      const ny = Math.min(size.h - 10, Math.max(0, snap(d.oy + dy)));
      if (d.sel.kind === 'table') setTables((ts) => ts.map((x) => (x.key === d.sel.key ? { ...x, posX: nx, posY: ny } : x)));
      else setDecor((ds) => ds.map((x) => (x.id === d.sel.key ? { ...x, x: nx, y: ny } : x)));
    } else {
      const nw = Math.max(d.sel.kind === 'table' ? 30 : 4, snap(d.ow + dx));
      const nh = Math.max(d.sel.kind === 'table' ? 30 : 4, snap(d.oh + dy));
      if (d.sel.kind === 'table') {
        setTables((ts) => ts.map((x) => (x.key === d.sel.key ? { ...x, width: x.shape === 'round' ? Math.max(nw, nh) : nw, height: x.shape === 'round' ? Math.max(nw, nh) : nh } : x)));
      } else setDecor((ds) => ds.map((x) => (x.id === d.sel.key ? { ...x, w: nw, h: nh } : x)));
    }
    setDirty(true);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const save = async () => {
    if (!zoneId) return;
    setSaving(true);
    try {
      const saved = await saveZoneLayout(zoneId, {
        tables: tables.map(({ key: _k, ...rest }) => rest),
        decor,
        removedTableIds: removed,
        width: size.w,
        height: size.h,
      });
      setZones((zs) => zs.map((z) => (z.id === zoneId ? saved : z)));
      hydrate(saved);
      showAlert(t('crm.bookings.v.editor.saved'), { variant: 'success' });
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const submitZone = async () => {
    if (!zoneModal?.name.trim()) return;
    try {
      if (zoneModal.mode === 'create') {
        const z = await createZone({ name: zoneModal.name.trim(), locationId });
        setZoneModal(null);
        await loadZones(z.id);
      } else {
        await updateZone(zoneId, { name: zoneModal.name.trim() });
        setZoneModal(null);
        setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, name: zoneModal.name.trim() } : z)));
      }
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  const removeZone = async () => {
    const z = zones.find((x) => x.id === zoneId);
    if (!z || !(await showConfirm(t('crm.bookings.v.editor.deleteZoneConfirm', { name: z.name }), { danger: true }))) return;
    try {
      await deleteZone(z.id);
      await loadZones();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  const seatsTotal = useMemo(() => tables.filter((x) => x.active !== false).reduce((s, x) => s + (Number(x.capacity) || 0), 0), [tables]);

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="floorEditor" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.editor.kicker')}</div>
            <h1>{t('crm.bookings.v.editor.title')}</h1>
            <p className="sub">{t('crm.bookings.v.editor.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/bookings/floor')}>{t('crm.bookings.v.editor.toLive')}</button>
            <button className="btn btn-primary btn-sm" disabled={!dirty || saving || !zoneId} onClick={save}>
              <Ic d={BK_ICON.check} size={13} /> {saving ? t('crm.bookings.v.common.saving') : dirty ? t('crm.bookings.v.editor.save') : t('crm.bookings.v.editor.savedShort')}
            </button>
          </div>
        </div>

        <div className="fl-toolbar">
          {locations.length > 1 && (
            <select className="bk-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <div className="bk-savedviews" style={{ margin: 0 }}>
            {zones.map((z) => (
              <div key={z.id} className={`bk-sv-tab${z.id === zoneId ? ' active' : ''}`} onClick={() => switchZone(z.id)}>{z.name}</div>
            ))}
          </div>
          <button className="btn btn-sm" disabled={!locationId} onClick={() => setZoneModal({ mode: 'create', name: '' })}><Ic d={BK_ICON.plus} size={12} /> {t('crm.bookings.v.editor.addZone')}</button>
          {zoneId && (
            <>
              <button className="btn btn-sm" onClick={() => setZoneModal({ mode: 'edit', name: zones.find((z) => z.id === zoneId)?.name || '' })}><Ic d={BK_ICON.edit} size={12} /></button>
              <button className="btn btn-sm btn-danger" onClick={removeZone}><Ic d={BK_ICON.trash} size={12} /></button>
            </>
          )}
        </div>

        {!locations.length && (
          <div className="bk-panel"><EmptyState title={t('crm.bookings.v.editor.noLocation')} action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings/locations')}>{t('crm.bookings.v.editor.toLocations')}</button>} /></div>
        )}
        {locations.length > 0 && zones.length === 0 && (
          <div className="bk-panel">
            <EmptyState title={t('crm.bookings.v.editor.noZones')} text={t('crm.bookings.v.editor.noZonesText')} action={<button className="btn btn-primary btn-sm" onClick={() => setZoneModal({ mode: 'create', name: t('crm.bookings.v.editor.mainHall') })}>{t('crm.bookings.v.editor.addZone')}</button>} />
          </div>
        )}

        {zoneId && (
          <div className="fe-layout">
            <div className="bk-panel fe-pal">
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.editor.tables')}</div></div>
              <div className="fe-palette">
                {TABLE_SHAPES.map((s) => {
                  const { w, h } = defaultTableSize(s, 4);
                  const k = Math.min(34 / w, 26 / h);
                  return (
                    <button key={s} className="fe-pal-btn" onClick={() => addTable(s)}>
                      <span className="fe-pal-ico" style={{ width: w * k, height: h * k, borderRadius: s === 'round' ? '50%' : s === 'bar' ? 999 : s === 'booth' ? '8px 8px 3px 3px' : 4 }} />
                      {t(`crm.bookings.v.editor.shape.${s}`)}
                    </button>
                  );
                })}
              </div>
              <div className="bk-panel-head" style={{ borderTop: '1px solid var(--line-2)' }}><div className="t">{t('crm.bookings.v.editor.decorTitle')}</div></div>
              <div className="fe-palette">
                {DECOR_KINDS.map((k) => (
                  <button key={k} className="fe-pal-btn" onClick={() => addDecor(k)}>{t(`crm.bookings.v.editor.decor.${k}`)}</button>
                ))}
              </div>
              <div className="bk-hint" style={{ padding: '0 14px 14px' }}>{t('crm.bookings.v.editor.keysHint')}</div>
            </div>

            <div className="fe-can">
              <div className="fl-canvas-wrap" style={{ maxHeight: '72vh' }}>
                <div ref={canvasRef} className="fl-canvas fe-canvas" style={{ width: size.w, height: size.h }} onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag} onPointerDown={() => setSel(null)}>
                  {decor.map((d) => (
                    <div key={d.id} className={`fe-item${sel?.key === d.id ? ' sel' : ''}`} style={{ left: d.x, top: d.y, width: d.w, height: d.h, transform: d.rotation ? `rotate(${d.rotation}deg)` : undefined }} onPointerDown={(e) => startDrag(e, { kind: 'decor', key: d.id }, 'move')}>
                      <DecorView d={{ ...d, x: 0, y: 0, rotation: 0 }} label={t(`crm.bookings.v.editor.decor.${d.kind}`)} />
                      {sel?.key === d.id && <span className="fe-handle" onPointerDown={(e) => startDrag(e, { kind: 'decor', key: d.id }, 'resize')} />}
                    </div>
                  ))}
                  {tables.map((tb) => (
                    <div key={tb.key} className={`fe-item${sel?.key === tb.key ? ' sel' : ''}`} style={{ left: tb.posX, top: tb.posY, width: tb.width, height: tb.height, transform: tb.rotation ? `rotate(${tb.rotation}deg)` : undefined, opacity: tb.active === false ? 0.45 : 1 }} onPointerDown={(e) => startDrag(e, { kind: 'table', key: tb.key }, 'move')}>
                      <Seats shape={tb.shape} w={tb.width} h={tb.height} seats={Number(tb.capacity) || 0} />
                      <div className={`fl-table ${tb.shape}`} style={{ left: 0, top: 0, width: tb.width, height: tb.height, cursor: 'move' }}>
                        <span className="n">{tb.name}</span>
                        <span className="c">{tb.capacity}</span>
                      </div>
                      {sel?.key === tb.key && <span className="fe-handle" onPointerDown={(e) => startDrag(e, { kind: 'table', key: tb.key }, 'resize')} />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bk-hint" style={{ marginTop: 8 }}>{t('crm.bookings.v.editor.summary', { tables: tables.length, seats: seatsTotal })}</div>
            </div>

            <div className="bk-panel fe-ins">
              <div className="bk-panel-head"><div className="t">{selTable ? t('crm.bookings.v.editor.tableProps') : selDecor ? t('crm.bookings.v.editor.decorProps') : t('crm.bookings.v.editor.hallProps')}</div></div>
              <div className="bk-panel-body" style={{ padding: '14px 16px' }}>
                {selTable && (
                  <>
                    <div className="bk-row2">
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.tableName')}</label><input value={selTable.name} onChange={(e) => patchTable(selTable.key, { name: e.target.value })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.shapeLabel')}</label>
                        <select value={selTable.shape} onChange={(e) => { const shape = e.target.value as TableShape; const s = defaultTableSize(shape, Number(selTable.capacity) || 2); patchTable(selTable.key, { shape, width: s.w, height: s.h }); }}>
                          {TABLE_SHAPES.map((s) => <option key={s} value={s}>{t(`crm.bookings.v.editor.shape.${s}`)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="bk-row2">
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.seats')}</label><input type="number" min={1} max={100} value={selTable.capacity} onChange={(e) => patchTable(selTable.key, { capacity: Math.max(1, Number(e.target.value) || 1) })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.minSeats')}</label><input type="number" min={1} value={selTable.minCapacity ?? ''} onChange={(e) => patchTable(selTable.key, { minCapacity: e.target.value ? Number(e.target.value) : null })} /></div>
                    </div>
                    <div className="bk-row3">
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.width')}</label><input type="number" value={selTable.width} onChange={(e) => patchTable(selTable.key, { width: Number(e.target.value) || 30, ...(selTable.shape === 'round' ? { height: Number(e.target.value) || 30 } : {}) })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.height')}</label><input type="number" value={selTable.height} disabled={selTable.shape === 'round'} onChange={(e) => patchTable(selTable.key, { height: Number(e.target.value) || 30 })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.rotation')}</label><input type="number" step={15} value={selTable.rotation || 0} onChange={(e) => patchTable(selTable.key, { rotation: Number(e.target.value) || 0 })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <button className="btn btn-sm" onClick={() => patchTable(selTable.key, { rotation: ((selTable.rotation || 0) - 45) % 360 })}>↺ 45°</button>
                      <button className="btn btn-sm" onClick={() => patchTable(selTable.key, { rotation: ((selTable.rotation || 0) + 45) % 360 })}>↻ 45°</button>
                      <button className="btn btn-sm" onClick={() => { const s = defaultTableSize(selTable.shape as TableShape, Number(selTable.capacity) || 2); patchTable(selTable.key, { width: s.w, height: s.h }); }}>{t('crm.bookings.v.editor.fitSize')}</button>
                    </div>
                    <label className="bk-check"><input type="checkbox" checked={selTable.active !== false} onChange={(e) => patchTable(selTable.key, { active: e.target.checked })} /> {t('crm.bookings.v.editor.activeTable')}</label>
                  </>
                )}
                {selDecor && (
                  <>
                    <div className="bk-field"><label>{t('crm.bookings.v.editor.decorKind')}</label>
                      <select value={selDecor.kind} onChange={(e) => patchDecor(selDecor.id, { kind: e.target.value as BookingZoneDecor['kind'] })}>
                        {DECOR_KINDS.map((k) => <option key={k} value={k}>{t(`crm.bookings.v.editor.decor.${k}`)}</option>)}
                      </select>
                    </div>
                    <div className="bk-field"><label>{t('crm.bookings.v.editor.decorLabel')}</label><input value={selDecor.label || ''} onChange={(e) => patchDecor(selDecor.id, { label: e.target.value })} /></div>
                    <div className="bk-row3">
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.width')}</label><input type="number" value={selDecor.w} onChange={(e) => patchDecor(selDecor.id, { w: Number(e.target.value) || 4 })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.height')}</label><input type="number" value={selDecor.h} onChange={(e) => patchDecor(selDecor.id, { h: Number(e.target.value) || 4 })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.rotation')}</label><input type="number" step={15} value={selDecor.rotation || 0} onChange={(e) => patchDecor(selDecor.id, { rotation: Number(e.target.value) || 0 })} /></div>
                    </div>
                  </>
                )}
                {(selTable || selDecor) && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={duplicateSel}>{t('crm.bookings.v.editor.duplicate')}</button>
                    <button className="btn btn-sm btn-danger" onClick={removeSel}><Ic d={BK_ICON.trash} size={12} /> {t('crm.bookings.v.common.delete')}</button>
                  </div>
                )}
                {!selTable && !selDecor && (
                  <>
                    <div className="bk-row2">
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.canvasW')}</label><input type="number" step={50} min={400} max={4000} value={size.w} onChange={(e) => { setSize((s) => ({ ...s, w: Math.max(400, Number(e.target.value) || 400) })); setDirty(true); }} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.editor.canvasH')}</label><input type="number" step={50} min={300} max={3000} value={size.h} onChange={(e) => { setSize((s) => ({ ...s, h: Math.max(300, Number(e.target.value) || 300) })); setDirty(true); }} /></div>
                    </div>
                    <div className="bk-hint">{t('crm.bookings.v.editor.selectHint')}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BkModal
        open={!!zoneModal}
        title={zoneModal?.mode === 'create' ? t('crm.bookings.v.editor.addZone') : t('crm.bookings.v.editor.renameZone')}
        onClose={() => setZoneModal(null)}
        footer={<><button className="btn btn-sm" onClick={() => setZoneModal(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" onClick={submitZone}>{t('crm.bookings.v.common.save')}</button></>}
      >
        <div className="bk-field"><label>{t('crm.bookings.v.editor.zoneName')}</label><input autoFocus value={zoneModal?.name || ''} onChange={(e) => setZoneModal((z) => (z ? { ...z, name: e.target.value } : z))} onKeyDown={(e) => e.key === 'Enter' && submitZone()} placeholder={t('crm.bookings.v.editor.zoneNamePh')} /></div>
      </BkModal>
    </MainLayout>
  );
};
