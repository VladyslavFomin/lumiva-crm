import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { DateInput } from '../../../components/ui/DateInput';
import { money, todayIso } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  applyRevenue,
  createRevenueRule,
  deleteRevenueRule,
  fetchHotels,
  fetchRevenue,
  fetchRevenueRules,
  fetchRoomTypes,
  revenueRange,
  saveRevenueSettings,
  updateRevenueRule,
  type Hotel,
  type HotelRevenueRow,
  type HotelRevenueRule,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';

type Tab = 'recs' | 'rules' | 'settings';
const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %`;

/**
 * Рекомендации цены: загрузка и подборка по датам (тепловая карта), что советуют правила и почему, применение
 * поправок к цене по прайсу; правила; автоприменение и пределы.
 */
export const HotelRevenuePage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.revenue.${key}`, o);
  const loc = useLoc();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [tab, setTab] = useState<Tab>('recs');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRevenue>> | null>(null);
  const [rules, setRules] = useState<HotelRevenueRule[]>([]);
  const [rooms, setRooms] = useState<HotelRoomType[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState(false);
  const [edit, setEdit] = useState<HotelRevenueRule | 'new' | null>(null);
  const cur = (hotels.find((h) => h.id === hotelId)?.currency || '').toUpperCase();
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });

  useEffect(() => { fetchHotels().then((h) => { setHotels(h); if (h[0]) setHotelId(h[0].id); }).catch(err); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    if (!hotelId) return;
    fetchRevenue(hotelId).then((d) => { setData(d); setSel(new Set()); }).catch(err);
    fetchRevenueRules(hotelId).then(setRules).catch(err);
    fetchRoomTypes(hotelId).then(setRooms).catch(() => setRooms([]));
  };
  useEffect(load, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows || [];
  const recs = rows.filter((r) => r.recommendedPct !== null);
  const id = (r: HotelRevenueRow) => `${r.roomTypeId}|${r.date}`;
  const dates = useMemo(() => [...new Set(rows.map((r) => r.date))], [rows]);
  const types = useMemo(() => [...new Map(rows.map((r) => [r.roomTypeId, r.roomTypeName])).entries()], [rows]);
  const cell = useMemo(() => new Map(rows.map((r) => [id(r), r])), [rows]);
  const next30 = rows.filter((r) => r.lead < 30);
  const occ30 = next30.length ? Math.round(next30.reduce((s, r) => s + r.sold, 0) / Math.max(1, next30.reduce((s, r) => s + r.capacity, 0)) * 100) : 0;
  const apply = async (list: HotelRevenueRow[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      const r = await applyRevenue(hotelId, list.map((x) => ({ roomTypeId: x.roomTypeId, date: x.date, pct: x.recommendedPct as number, ruleId: x.ruleId })));
      showAlert(k('applied', { count: r.applied }), { variant: 'success' });
      load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const dLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  const wd = (n: number) => k(`wd.${n}`);

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="revenue" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <select className="htl-select" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            <button className="btn" disabled={!rooms.length} onClick={() => setRange(true)}>{k('manual')}</button>
          </div>
        </div>

        <div className="htl-kpis">
          <div className="htl-kpi"><div className="l">{k('kpi.occ30')}</div><div className="v">{occ30}%</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.up')}</div><div className="v">{recs.filter((r) => (r.recommendedPct || 0) > r.currentPct).length}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.down')}</div><div className="v">{recs.filter((r) => (r.recommendedPct || 0) < r.currentPct).length}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.auto')}</div><div className="v">{data?.settings.revenueAutoApply ? k('on') : k('off')}</div><div className="d">{k('kpi.rules', { count: data?.rules || 0 })}</div></div>
        </div>

        <div className="htl-toolbar">
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['recs', 'rules', 'settings'] as Tab[]).map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)}>{k(`tab.${x}`)}{x === 'recs' && recs.length ? ` · ${recs.length}` : ''}</div>)}
          </div>
        </div>

        {tab === 'recs' && (
          <>
            {!!rows.length && (
              <div className="rm-heat">
                <div className="rm-heat-scroll">
                  <table>
                    <thead><tr><th />{dates.map((d) => <th key={d} title={d}><span>{wd(rows.find((r) => r.date === d)!.weekday)}</span>{d.slice(8)}</th>)}</tr></thead>
                    <tbody>
                      {types.map(([rt, name]) => (
                        <tr key={rt}>
                          <th>{name}</th>
                          {dates.map((d) => {
                            const c = cell.get(`${rt}|${d}`)!;
                            const lvl = Math.min(4, Math.floor(c.occupancy / 25));
                            return (
                              <td key={d} className={`l${lvl}${c.recommendedPct !== null ? ' rec' : ''}`} title={`${dLabel(d)} · ${name}: ${c.sold}/${c.capacity} (${Math.round(c.occupancy)}%)${c.currentPct ? ` · ${sign(c.currentPct)}` : ''}`}>
                                {c.currentPct ? <b>{c.currentPct > 0 ? '+' : '−'}</b> : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rm-legend"><span className="l0" />0–25%<span className="l1" />25–50%<span className="l2" />50–75%<span className="l3" />75–99%<span className="l4" />100%<span className="rec-dot" />{k('legendRec')}<b>+ / −</b>{k('legendAdj')}</div>
              </div>
            )}
            {!recs.length ? (
              <div className="htl-empty"><h4>{rules.length ? k('noRecs') : k('noRules')}</h4><p>{rules.length ? k('noRecsHint') : k('noRulesHint')}</p></div>
            ) : (
              <>
                <div className="htl-toolbar">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => apply(sel.size ? recs.filter((r) => sel.has(id(r))) : recs)}><Ic d={HTL_ICON.check} size={12} />{sel.size ? k('applySel', { count: sel.size }) : k('applyAll', { count: recs.length })}</button>
                  <span className="htl-sub">{k('applyHint')}</span>
                </div>
                <div className="bk-table-wrap">
                  <table className="bk-table">
                    <thead><tr>
                      <th style={{ width: 30 }}><input type="checkbox" checked={sel.size === recs.length} onChange={(e) => setSel(e.target.checked ? new Set(recs.map(id)) : new Set())} aria-label={k('selectAll')} /></th>
                      <th>{k('col.date')}</th><th>{k('col.room')}</th><th>{k('col.occ')}</th><th className="num">{k('col.pickup')}</th><th>{k('col.change')}</th><th className="num">{k('col.price')}</th><th>{k('col.why')}</th>
                    </tr></thead>
                    <tbody>
                      {recs.map((r) => (
                        <tr key={id(r)}>
                          <td><input type="checkbox" checked={sel.has(id(r))} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(id(r))) n.delete(id(r)); else n.add(id(r)); return n; })} /></td>
                          <td className="mono">{dLabel(r.date)} <span className="htl-sub">{wd(r.weekday)} · {k('inDays', { count: r.lead })}</span></td>
                          <td>{r.roomTypeName}</td>
                          <td><div className="grp-bar"><span style={{ width: `${Math.min(100, r.occupancy)}%` }} /></div><span className="htl-sub">{r.sold}/{r.capacity} · {Math.round(r.occupancy)}%</span></td>
                          <td className="num mono">{r.pickup}</td>
                          <td className="mono"><span className="htl-sub">{sign(r.currentPct)}</span> → <b className={(r.recommendedPct || 0) > r.currentPct ? 'rm-up' : 'rm-down'}>{sign(r.recommendedPct as number)}</b></td>
                          <td className="num mono"><span className="htl-sub">{money(r.currentPrice, cur, loc)}</span> → <b>{money(r.newPrice || 0, cur, loc)}</b></td>
                          <td>{r.ruleName || k('reset')}{r.guard && <div className="htl-sub rm-guard">{k(`guard.${r.guard}`)}</div>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'rules' && (
          <>
            <div className="htl-toolbar"><button className="btn btn-primary btn-sm" onClick={() => setEdit('new')}><Ic d={HTL_ICON.plus} size={12} />{k('addRule')}</button><span className="htl-sub">{k('rulesHint')}</span></div>
            {!rules.length ? <div className="htl-empty"><h4>{k('noRules')}</h4><p>{k('noRulesHint')}</p></div> : (
              <div className="rtp-table-wrap">
                <table className="rtp-table">
                  <thead><tr><th>#</th><th>{k('col.rule')}</th><th>{k('col.when')}</th><th>{k('col.lead')}</th><th>{k('col.adjust')}</th><th>{k('col.rooms')}</th></tr></thead>
                  <tbody>
                    {rules.map((r, i) => (
                      <tr key={r.id} className={r.active ? '' : 'off'} onClick={() => setEdit(r)}>
                        <td className="mono">{i + 1}</td>
                        <td><b>{r.name}</b>{!r.active && <span className="rtp-tag" style={{ marginLeft: 6 }}>{k('off')}</span>}</td>
                        <td>{k(`metric.${r.metric}`)} {r.op === 'gte' ? '≥' : '≤'} {Number(r.threshold)}{r.metric === 'occupancy' ? '%' : ''}{r.weekdays?.length ? <div className="htl-sub">{r.weekdays.map(wd).join(', ')}</div> : null}</td>
                        <td>{r.leadMax !== null ? k('leadRange', { from: r.leadMin, to: r.leadMax }) : k('leadFrom', { from: r.leadMin })}</td>
                        <td className={`mono ${Number(r.adjustPct) > 0 ? 'rm-up' : 'rm-down'}`}><b>{sign(Number(r.adjustPct))}</b></td>
                        <td className="htl-sub">{r.roomTypeIds?.length ? r.roomTypeIds.map((x) => rooms.find((t) => t.id === x)?.name).filter(Boolean).join(', ') : k('allRooms')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'settings' && data && <RevenueSettings hotelId={hotelId} initial={data.settings} onSaved={load} />}
      </div>
      {edit && <RuleSheet rule={edit === 'new' ? null : edit} rooms={rooms} hotelId={hotelId} max={data?.settings.revenueMaxPct || 30} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {range && <RangeDialog rooms={rooms} hotelId={hotelId} max={data?.settings.revenueMaxPct || 30} onClose={() => setRange(false)} onDone={() => { setRange(false); load(); }} />}
    </MainLayout>
  );
};

const RevenueSettings: React.FC<{ hotelId: string; initial: { revenueAutoApply: boolean; revenueHorizon: number; revenueMaxPct: number }; onSaved: () => void }> = ({ hotelId, initial, onSaved }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.revenue.${key}`, o);
  const { showAlert } = useAlertModal();
  const [d, setD] = useState({ auto: initial.revenueAutoApply, horizon: String(initial.revenueHorizon), max: String(initial.revenueMaxPct) });
  return (
    <div className="htl-panel" style={{ marginTop: 14 }}>
      <h3 className="htl-h3">{k('tab.settings')}</h3>
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <label className="rtp-check"><input type="checkbox" checked={d.auto} onChange={(e) => setD({ ...d, auto: e.target.checked })} />{k('autoApply')}</label>
        <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('autoHint')}</div>
        <div className="htl-f"><label>{k('horizon')}</label><input type="number" min={7} max={365} value={d.horizon} onChange={(e) => setD({ ...d, horizon: e.target.value })} /></div>
        <div className="htl-f"><label>{k('maxPct')}</label><input type="number" min={1} max={90} value={d.max} onChange={(e) => setD({ ...d, max: e.target.value })} /></div>
        <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('guardHint')}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={() => saveRevenueSettings(hotelId, { revenueAutoApply: d.auto, revenueHorizon: Number(d.horizon), revenueMaxPct: Number(d.max) }).then(() => { showAlert(k('saved'), { variant: 'success' }); onSaved(); }).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }))}>{k('save')}</button>
      </div>
    </div>
  );
};

const RuleSheet: React.FC<{ rule: HotelRevenueRule | null; rooms: HotelRoomType[]; hotelId: string; max: number; onClose: () => void; onSaved: () => void }> = ({ rule, rooms, hotelId, max, onClose, onSaved }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.revenue.${key}`, o);
  const { showAlert, showConfirm } = useAlertModal();
  const [d, setD] = useState({
    name: rule?.name || '', metric: rule?.metric || 'occupancy', op: rule?.op || 'gte', threshold: rule ? String(Number(rule.threshold)) : '80',
    leadMin: String(rule?.leadMin ?? 0), leadMax: rule?.leadMax !== null && rule?.leadMax !== undefined ? String(rule.leadMax) : '30', adjustPct: rule ? String(Number(rule.adjustPct)) : '10',
    weekdays: rule?.weekdays || [] as number[], roomTypeIds: rule?.roomTypeIds || [] as string[], active: rule?.active ?? true,
  });
  const adj = Number(d.adjustPct.replace(',', '.'));
  const errors = [
    !d.name.trim() && k('err.name'),
    !(adj !== 0 && Math.abs(adj) <= max) && k('err.adjust', { max }),
    d.metric === 'occupancy' && !(Number(d.threshold) >= 0 && Number(d.threshold) <= 100) && k('err.threshold'),
    d.leadMax.trim() !== '' && Number(d.leadMax) < Number(d.leadMin) && k('err.lead'),
  ].filter(Boolean) as string[];
  const save = () => {
    const dto = { name: d.name, metric: d.metric as 'occupancy' | 'pickup', op: d.op as 'gte' | 'lte', threshold: d.threshold, leadMin: Number(d.leadMin) || 0, leadMax: d.leadMax.trim() === '' ? null : Number(d.leadMax), adjustPct: String(adj), weekdays: d.weekdays, roomTypeIds: d.roomTypeIds, active: d.active };
    (rule ? updateRevenueRule(rule.id, dto) : createRevenueRule({ ...dto, hotelId })).then(onSaved).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }));
  };
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet" role="dialog" aria-modal="true">
        <div className="htl-sheet-head"><div><h3>{rule ? rule.name : k('newRule')}</h3><div className="htl-sub" style={{ marginTop: 4 }}>{k('ruleHint')}</div></div><button onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.name')}</label><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={k('f.namePh')} /></div>
            <div className="htl-f"><label>{k('f.metric')}</label>
              <select value={d.metric} onChange={(e) => setD({ ...d, metric: e.target.value as 'occupancy' | 'pickup' })}>{(['occupancy', 'pickup'] as const).map((m) => <option key={m} value={m}>{k(`metricLong.${m}`)}</option>)}</select>
            </div>
            <div className="htl-f"><label>{k('f.condition')}</label>
              <div className="rtp-inline">
                <div className="htl-seg">{(['gte', 'lte'] as const).map((o) => <button key={o} type="button" className={d.op === o ? 'on' : ''} onClick={() => setD({ ...d, op: o })}>{o === 'gte' ? '≥' : '≤'}</button>)}</div>
                <input inputMode="decimal" value={d.threshold} onChange={(e) => setD({ ...d, threshold: e.target.value })} />
                <span className="htl-sub">{d.metric === 'occupancy' ? '%' : k('roomsUnit')}</span>
              </div>
            </div>
            <div className="htl-f"><label>{k('f.leadMin')}</label><input type="number" min={0} value={d.leadMin} onChange={(e) => setD({ ...d, leadMin: e.target.value })} /></div>
            <div className="htl-f"><label>{k('f.leadMax')}</label><input type="number" min={0} value={d.leadMax} placeholder="∞" onChange={(e) => setD({ ...d, leadMax: e.target.value })} /></div>
            <div className="htl-f"><label>{k('f.adjust', { max })}</label><input inputMode="decimal" value={d.adjustPct} onChange={(e) => setD({ ...d, adjustPct: e.target.value })} /></div>
            <div className="htl-hint" style={{ alignSelf: 'end' }}>{k('adjustHint')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.weekdays')}</label>
              <div className="rtp-chips">{[1, 2, 3, 4, 5, 6, 7].map((w) => <button key={w} type="button" className={`rtp-chip${d.weekdays.includes(w) ? ' on' : ''}`} onClick={() => setD({ ...d, weekdays: d.weekdays.includes(w) ? d.weekdays.filter((x) => x !== w) : [...d.weekdays, w] })}>{k(`wd.${w}`)}</button>)}</div>
            </div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.rooms')}</label>
              <div className="rtp-chips">
                <button type="button" className={`rtp-chip${!d.roomTypeIds.length ? ' on' : ''}`} onClick={() => setD({ ...d, roomTypeIds: [] })}>{k('allRooms')}</button>
                {rooms.map((r) => <button key={r.id} type="button" className={`rtp-chip${d.roomTypeIds.includes(r.id) ? ' on' : ''}`} onClick={() => setD({ ...d, roomTypeIds: d.roomTypeIds.includes(r.id) ? d.roomTypeIds.filter((x) => x !== r.id) : [...d.roomTypeIds, r.id] })}>{r.name}</button>)}
              </div>
            </div>
            <label className="rtp-check"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />{k('f.active')}</label>
          </div>
          {errors.length > 0 && <div className="pe-box warn" style={{ marginTop: 12 }}>{errors.map((x) => <div key={x}>{x}</div>)}</div>}
        </div>
        <div className="htl-sheet-foot">
          {rule && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => { if (await showConfirm(k('deleteBody'), { title: k('delete'), confirmLabel: k('delete'), danger: true })) deleteRevenueRule(rule.id).then(onSaved).catch(() => undefined); }}>{k('delete')}</button>}
          <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={errors.length > 0} onClick={save}><Ic d={HTL_ICON.check} size={14} />{k('save')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const RangeDialog: React.FC<{ rooms: HotelRoomType[]; hotelId: string; max: number; onClose: () => void; onDone: () => void }> = ({ rooms, hotelId, max, onClose, onDone }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.revenue.${key}`, o);
  const { showAlert } = useAlertModal();
  const [d, setD] = useState({ from: todayIso(), to: todayIso(), pct: '10', ids: [] as string[] });
  const pct = Number(d.pct.replace(',', '.'));
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head"><h3>{k('manual')}</h3><button type="button" onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="bk-modal-body">
          <div className="htl-f"><label>{k('f.from')}</label><DateInput value={d.from} min={todayIso()} clearable={false} onChange={(v) => setD({ ...d, from: v, to: d.to < v ? v : d.to })} /></div>
          <div className="htl-f" style={{ marginTop: 10 }}><label>{k('f.to')}</label><DateInput value={d.to} min={d.from} clearable={false} onChange={(v) => setD({ ...d, to: v })} /></div>
          <div className="htl-f" style={{ marginTop: 10 }}><label>{k('f.adjust', { max })}</label><input inputMode="decimal" value={d.pct} onChange={(e) => setD({ ...d, pct: e.target.value })} /></div>
          <div className="rtp-chips" style={{ marginTop: 10 }}>
            <button type="button" className={`rtp-chip${!d.ids.length ? ' on' : ''}`} onClick={() => setD({ ...d, ids: [] })}>{k('allRooms')}</button>
            {rooms.map((r) => <button key={r.id} type="button" className={`rtp-chip${d.ids.includes(r.id) ? ' on' : ''}`} onClick={() => setD({ ...d, ids: d.ids.includes(r.id) ? d.ids.filter((x) => x !== r.id) : [...d.ids, r.id] })}>{r.name}</button>)}
          </div>
          <div className="htl-hint" style={{ marginTop: 10 }}>{k('manualHint')}</div>
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('cancel')}</button>
          <button className="btn btn-primary" disabled={!(Math.abs(pct) <= max)} onClick={() => revenueRange({ hotelId, roomTypeIds: d.ids, from: d.from, to: d.to, pct }).then((r) => { showAlert(k('applied', { count: r.applied }), { variant: 'success' }); onDone(); }).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }))}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
