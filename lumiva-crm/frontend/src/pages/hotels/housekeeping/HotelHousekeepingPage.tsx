import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { addDaysIso, fmtDate, todayIso } from '../partners/partnerUtils';
import { IssueSheet, LostSheet, OutageSheet, PhotoStrip, unitName, useHk } from './HkShared';
import {
  assignHkTask,
  autoAssignHk,
  deleteLostItem,
  deleteOutage,
  endOutage,
  fetchHkPlan,
  fetchHkUnits,
  fetchHotels,
  fetchIssues,
  fetchLostFound,
  fetchOutages,
  floorsFromLabels,
  hkTaskAction,
  notifyLostItem,
  updateHkUnit,
  updateIssue,
  updateLostItem,
  HOTEL_UNIT_FEATURES,
  type Hotel,
  type HotelHkPlan,
  type HotelHkTask,
  type HotelLostItem,
  type HotelMaintenanceIssue,
  type HotelRoomOutage,
  type HotelUnitFull,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';
import { useHotelLive } from '../useHotelLive';

type Tab = 'plan' | 'issues' | 'outages' | 'lost' | 'rooms';
const TABS: Tab[] = ['plan', 'issues', 'outages', 'lost', 'rooms'];
const STATE_ORDER = ['vacant_dirty', 'vacant_clean', 'inspected', 'occupied_dirty', 'occupied_clean', 'out_of_order', 'out_of_service'] as const;

export const HotelHousekeepingPage: React.FC = () => {
  const { k, t, lang } = useHk();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [units, setUnits] = useState<HotelUnitFull[]>([]);
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const tab = (TABS.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'plan') as Tab;
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const setParam = (patch: Record<string, string>) => setSp({ ...Object.fromEntries(sp.entries()), ...patch });

  useEffect(() => {
    fetchHotels().then(setHotels).catch((e) => setError(e.message));
  }, []);
  const loadUnits = useCallback(() => {
    if (!hotelId) return;
    fetchHkUnits(hotelId).then((r) => { setUnits(r.units); setRoomTypes(r.roomTypes); }).catch(() => setUnits([]));
  }, [hotelId]);
  useEffect(() => { loadUnits(); }, [loadUnits]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelHousekeeping" />
      <div className="px-scope">
        <HotelsSubnav active="housekeeping" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate('/hotels/housekeeping/my')}>{k('toMy')}</button>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setParam({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {TABS.map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setParam({ tab: x })}>{k(`tabs.${x}`)}</div>)}
          </div>
        </div>
        {error ? (
          <div className="htl-empty"><h4>{k('loadError')}</h4><p>{error}</p></div>
        ) : !hotels.length ? (
          <div className="htl-empty"><h4>{t('crm.hotels.rack.noHotels')}</h4></div>
        ) : !hotelId ? null : tab === 'plan' ? (
          <PlanTab hotelId={hotelId} hotels={hotels} lang={lang} />
        ) : tab === 'issues' ? (
          <IssuesTab hotelId={hotelId} hotels={hotels} unitById={unitById} lang={lang} />
        ) : tab === 'outages' ? (
          <OutagesTab hotelId={hotelId} unitById={unitById} lang={lang} />
        ) : tab === 'lost' ? (
          <LostTab hotelId={hotelId} hotels={hotels} unitById={unitById} lang={lang} />
        ) : (
          <RoomsTab hotelId={hotelId} units={units} roomTypes={roomTypes} onChanged={loadUnits} />
        )}
      </div>
    </MainLayout>
  );
};

/* ───────────── план уборки ───────────── */
const PlanTab: React.FC<{ hotelId: string; hotels: Hotel[]; lang: string }> = ({ hotelId, hotels, lang }) => {
  const { k, t } = useHk();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const [date, setDate] = useState(todayIso());
  const [plan, setPlan] = useState<HotelHkPlan | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [maids, setMaids] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<string | null | undefined>(undefined);

  const load = useCallback(() => {
    return fetchHkPlan(hotelId, date).then((p) => { setPlan(p); setFailed(null); }).catch((e) => setFailed(e.message));
  }, [hotelId, date]);
  useEffect(() => { setPlan(null); void load(); }, [load]);
  const live = useHotelLive(['housekeeping', 'reservation', 'unit', 'outage'], () => void load());
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) void load(); }, live.connected ? 120_000 : 30_000);
    return () => window.clearInterval(id);
  }, [load, live.connected]);

  const staffName = (id: string | null) => (id ? plan?.staff.find((s) => s.id === id)?.name || '—' : k('unassigned'));
  const act = async (task: HotelHkTask, action: 'start' | 'done' | 'skip' | 'reopen' | 'inspect') => {
    let note: string | undefined;
    if (action === 'skip') {
      const v = await showPrompt({ title: k('skipTitle', { room: task.unit?.label }), label: k('skipLabel'), placeholder: k('skipPh'), confirmLabel: k('actions.skip'), cancelLabel: t('crm.hotels.common.cancel') });
      if (v === null) return;
      note = v.trim();
      if (!note) { showAlert(k('errors.HOTEL_HK_SKIP_REASON'), { variant: 'error' }); return; }
    }
    setBusy(task.id);
    hkTaskAction(task.id, action, note)
      .then(() => load())
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(null));
  };
  const assign = (task: HotelHkTask, userId: string) => {
    setBusy(task.id);
    assignHkTask(task.id, userId || null).then(() => load()).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' })).finally(() => setBusy(null));
  };
  const auto = async (mode: 'unassigned' | 'all') => {
    if (!maids.size) { showAlert(k('errors.HOTEL_HK_NO_STAFF'), { variant: 'error' }); return; }
    if (mode === 'all') {
      const ok = await showConfirm(k('reassignConfirm'), { title: k('reassignAll'), confirmLabel: k('reassignAll'), cancelLabel: t('crm.hotels.common.cancel') });
      if (!ok) return;
    }
    setBusy('auto');
    autoAssignHk({ hotelId, date, userIds: [...maids], mode })
      .then((r) => { showAlert(k('assigned', { count: r.assigned }), { variant: 'success' }); return load(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(null));
  };

  const rows = (plan?.tasks || []).filter((x) =>
    filter === 'all' ? true : filter === 'unassigned' ? !x.assigneeUserId : filter === 'open' ? ['pending', 'in_progress'].includes(x.status) : filter === 'toInspect' ? x.status === 'done' : x.assigneeUserId === filter,
  );
  const byFloor = useMemo(() => {
    const m = new Map<string, HotelHkTask[]>();
    for (const r of rows) {
      const f = r.unit?.floor || '';
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }));
  }, [rows]);

  if (failed) return <div className="htl-empty"><h4>{k('loadError')}</h4><p>{failed}</p><button className="btn" onClick={() => void load()}>{t('crm.hotels.rack.retry')}</button></div>;
  if (!plan) return <div className="htl-rack-skel">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>;
  const pct = plan.summary.total ? Math.round((plan.summary.done / plan.summary.total) * 100) : 0;

  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, -1))} aria-label={k('prevDay')}>‹</button>
        <DateInput className="htl-date" value={date} onChange={(v) => v && setDate(v)}  inline clearable={false} />
        <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, 1))} aria-label={k('nextDay')}>›</button>
        {date !== todayIso() && <button className="btn btn-sm" onClick={() => setDate(todayIso())}>{k('today')}</button>}
        {!plan.editable && <span className="htl-sub">{k('pastReadonly')}</span>}
      </div>

      <div className="htl-rack-kpis htl-fd-kpis">
        <div><span>{k('kpi.tasks')}</span><b>{plan.summary.total}</b></div>
        <div><span>{k('kpi.done')}</span><b>{plan.summary.done}<small> / {plan.summary.total}</small></b><i className="bar"><i style={{ width: `${pct}%` }} /></i></div>
        <div><span>{k('kpi.inspected')}</span><b>{plan.summary.inspected}</b></div>
        <div className={plan.summary.unassigned ? 'alert' : ''}><span>{k('kpi.unassigned')}</span><b>{plan.summary.unassigned}</b></div>
        <div><span>{k('kpi.credits')}</span><b>{plan.summary.credits}</b></div>
      </div>

      <div className="hk-states">
        {STATE_ORDER.filter((s) => plan.roomStates[s]).map((s) => <span key={s} className={`hk-state s-${s}`}>{k(`states.${s}`)} <b>{plan.roomStates[s]}</b></span>)}
      </div>

      {plan.editable && (
        <div className="hk-assign">
          <div className="lbl">{k('maids')}</div>
          <div className="chips">
            {plan.staff.map((s) => {
              const l = plan.load.find((x) => x.userId === s.id);
              return (
                <button key={s.id} type="button" className={`chip${maids.has(s.id) ? ' on' : ''}`} onClick={() => setMaids((m) => { const n = new Set(m); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}>
                  {s.name}{l ? <em>{k('loadLine', { done: l.done, tasks: l.tasks, credits: l.credits })}</em> : null}
                </button>
              );
            })}
          </div>
          <div className="acts">
            <button className="btn btn-sm btn-primary" disabled={busy === 'auto' || !maids.size} onClick={() => void auto('unassigned')}>{k('autoAssign')}</button>
            <button className="btn btn-sm" disabled={busy === 'auto' || !maids.size} onClick={() => void auto('all')}>{k('reassignAll')}</button>
            <button className="btn btn-sm" onClick={() => setIssueFor(null)}>{k('reportIssue')}</button>
          </div>
        </div>
      )}

      <div className="bk-savedviews hk-filter">
        {['all', 'open', 'unassigned', 'toInspect'].map((f) => <div key={f} className={`bk-sv-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{k(`filters.${f}`)}</div>)}
        {plan.load.map((l) => <div key={l.userId} className={`bk-sv-tab${filter === l.userId ? ' active' : ''}`} onClick={() => setFilter(l.userId)}>{staffName(l.userId)}</div>)}
      </div>

      {!rows.length ? (
        <div className="htl-empty"><h4>{plan.summary.total ? k('noFiltered') : k('noTasks')}</h4><p>{plan.summary.total ? '' : k('noTasksHint')}</p></div>
      ) : (
        <div className="bk-table-wrap">
          <table className="bk-table hk-table">
            <thead>
              <tr><th>{k('col.room')}</th><th>{k('col.state')}</th><th>{k('col.task')}</th><th>{k('col.guest')}</th><th>{k('col.maid')}</th><th>{k('col.status')}</th><th /></tr>
            </thead>
            <tbody>
              {byFloor.map(([floor, list]) => (
                <React.Fragment key={floor || '—'}>
                  <tr className="hk-floor"><td colSpan={7}>{floor ? k('floor', { floor }) : k('noFloor')} · {k('tasksCount', { count: list.length })}</td></tr>
                  {list.map((x) => (
                    <tr key={x.id} className={x.priority >= 90 ? 'urgent' : undefined}>
                      <td><div className="htl-fd-room"><span className="u">{x.unit?.label}</span><em>{x.unit?.roomTypeName}</em></div></td>
                      <td>{x.unit?.state && <span className={`hk-state s-${x.unit.state}`}>{k(`states.${x.unit.state}`)}</span>}</td>
                      <td>
                        <div className="htl-fd-guest">
                          <b>{k(`kinds2.${x.kind}`)}</b>
                          <em>
                            {[
                              x.kind === 'departure' && x.nextArrival ? k('turnover') : '',
                              x.earlyCheckIn ? k('earlyArrival') : '',
                              x.babyCots ? t('crm.hotels.guestsPicker.babyCot', { count: x.babyCots }) : '',
                              x.lateCheckOut ? k('lateDeparture') : '',
                              x.kind === 'departure' && x.departed === false ? k('notYetLeft') : '',
                            ].filter(Boolean).join(' · ')}
                          </em>
                        </div>
                      </td>
                      <td><div className="htl-fd-guest"><b>{x.guestName || '—'}</b>{x.nextArrival && <em>{k('nextGuest', { name: x.nextArrival.guestName })}</em>}</div></td>
                      <td>
                        {plan.editable ? (
                          <select className="htl-fd-pick" value={x.assigneeUserId || ''} disabled={busy === x.id} onChange={(e) => assign(x, e.target.value)}>
                            <option value="">{k('unassigned')}</option>
                            {plan.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        ) : staffName(x.assigneeUserId)}
                      </td>
                      <td><span className={`hk-task s-${x.status}`}>{k(`taskStatus.${x.status}`)}</span>{x.note && <div className="htl-sub" style={{ marginTop: 3 }}>{x.note}</div>}</td>
                      <td style={{ textAlign: 'right' }}>
                        {plan.editable && (
                          <div className="htl-fd-acts">
                            {x.status === 'pending' && <button className="btn btn-sm" disabled={busy === x.id} onClick={() => void act(x, 'start')}>{k('actions.start')}</button>}
                            {(x.status === 'pending' || x.status === 'in_progress') && <button className="btn btn-sm btn-primary" disabled={busy === x.id} onClick={() => void act(x, 'done')}><Ic d={HTL_ICON.check} size={12} />{k('actions.done')}</button>}
                            {(x.status === 'pending' || x.status === 'in_progress') && <button className="btn btn-sm" disabled={busy === x.id} onClick={() => void act(x, 'skip')}>{k('actions.skip')}</button>}
                            {x.status === 'done' && <button className="btn btn-sm btn-primary" disabled={busy === x.id} onClick={() => void act(x, 'inspect')}>{k('actions.inspect')}</button>}
                            {(x.status === 'done' || x.status === 'inspected' || x.status === 'skipped') && <button className="btn btn-sm" disabled={busy === x.id} onClick={() => void act(x, 'reopen')}>{k('actions.reopen')}</button>}
                            <button className="btn btn-sm" title={k('reportIssue')} onClick={() => setIssueFor(x.roomUnitId)}><Ic d={HTL_ICON.ban} size={12} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {issueFor !== undefined && (
        <IssueSheet hotels={hotels.filter((h) => h.id === hotelId)} hotelId={hotelId} roomUnitId={issueFor} staff={plan.staff} onClose={() => setIssueFor(undefined)} onDone={() => { setIssueFor(undefined); void load(); }} />
      )}
      <p className="htl-fd-note" style={{ marginTop: 10 }}>{k('creditsHint')} · {fmtDate(date, lang)}</p>
    </>
  );
};

/* ───────────── неисправности ───────────── */
const IssuesTab: React.FC<{ hotelId: string; hotels: Hotel[]; unitById: Map<string, HotelUnitFull>; lang: string }> = ({ hotelId, hotels, unitById, lang }) => {
  const { k, t } = useHk();
  const { showAlert, showPrompt } = useAlertModal();
  const [status, setStatus] = useState('active');
  const [rows, setRows] = useState<HotelMaintenanceIssue[] | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => fetchIssues(hotelId, status === 'all' ? undefined : status).then(setRows).catch(() => setRows([])), [hotelId, status]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  useEffect(() => { fetchHkPlan(hotelId, todayIso()).then((p) => setStaff(p.staff)).catch(() => setStaff([])); }, [hotelId]);
  const patch = (i: HotelMaintenanceIssue, dto: Partial<HotelMaintenanceIssue>) =>
    updateIssue(i.id, dto).then(() => load()).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  const resolve = async (i: HotelMaintenanceIssue) => {
    const v = await showPrompt({ title: k('resolveTitle'), label: k('resolveLabel'), placeholder: k('resolvePh'), confirmLabel: k('resolve'), cancelLabel: t('crm.hotels.common.cancel') });
    if (v === null) return;
    await patch(i, { status: 'resolved', resolution: v });
    if (i.outageId) showAlert(k('resolvedBack'), { variant: 'success' });
  };
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="bk-savedviews" style={{ flex: 'none' }}>
          {['active', 'resolved', 'all'].map((s) => <div key={s} className={`bk-sv-tab${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>{k(`issueFilters.${s}`)}</div>)}
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}><Ic d={HTL_ICON.plus} size={14} />{k('issueNew')}</button>
      </div>
      {!rows ? <div className="htl-rack-skel">{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div> : !rows.length ? (
        <div className="htl-empty"><h4>{k('issuesEmpty')}</h4></div>
      ) : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{k('col.room')}</th><th>{k('category')}</th><th>{k('description')}</th><th>{k('priority')}</th><th>{k('assignee')}</th><th>{k('col.status')}</th><th /></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="htl-fd-room">{i.roomUnitId ? <span className="u">{unitName(unitById.get(i.roomUnitId), k)}</span> : <span>{k('noRoomPublic')}</span>}
                      <em>{new Date(i.createdAt).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</em></div>
                    {i.repeated && <span className="htl-fd-flag">{k('repeated')}</span>}
                    {i.outageId && i.status !== 'resolved' && <span className="htl-fd-flag">{k('roomOoo')}</span>}
                  </td>
                  <td>{k(`issueCategories.${i.category}`)}</td>
                  <td style={{ maxWidth: 360 }}><div style={{ whiteSpace: 'pre-wrap' }}>{i.description}</div><PhotoStrip urls={i.photoUrls} />{i.resolution && <div className="htl-sub" style={{ marginTop: 4 }}>{k('resolutionLine', { text: i.resolution })}</div>}</td>
                  <td><span className={`hk-prio p-${i.priority}`}>{k(`priorities.${i.priority}`)}</span></td>
                  <td>
                    <select className="htl-fd-pick" value={i.assigneeUserId || ''} onChange={(e) => void patch(i, { assigneeUserId: e.target.value || null })}>
                      <option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td><span className={`hk-task s-${i.status === 'resolved' ? 'inspected' : i.status === 'in_progress' ? 'in_progress' : i.status === 'cancelled' ? 'skipped' : 'pending'}`}>{k(`issueStatus.${i.status}`)}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="htl-fd-acts">
                      {i.status === 'open' && <button className="btn btn-sm" onClick={() => void patch(i, { status: 'in_progress' })}>{k('takeIssue')}</button>}
                      {(i.status === 'open' || i.status === 'in_progress') && <button className="btn btn-sm btn-primary" onClick={() => void resolve(i)}>{k('resolve')}</button>}
                      {(i.status === 'open' || i.status === 'in_progress') && <button className="btn btn-sm" onClick={() => void patch(i, { status: 'cancelled' })}>{k('cancelIssue')}</button>}
                      {(i.status === 'resolved' || i.status === 'cancelled') && <button className="btn btn-sm" onClick={() => void patch(i, { status: 'open' })}>{k('reopenIssue')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <IssueSheet hotels={hotels.filter((h) => h.id === hotelId)} hotelId={hotelId} staff={staff} onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />}
    </>
  );
};

/* ───────────── неработающие номера ───────────── */
const OutagesTab: React.FC<{ hotelId: string; unitById: Map<string, HotelUnitFull>; lang: string }> = ({ hotelId, unitById, lang }) => {
  const { k, t } = useHk();
  const { showAlert, showConfirm } = useAlertModal();
  const [showEnded, setShowEnded] = useState(false);
  const [rows, setRows] = useState<HotelRoomOutage[] | null>(null);
  const [sheet, setSheet] = useState<HotelRoomOutage | 'new' | null>(null);
  const load = useCallback(() => fetchOutages(hotelId, showEnded).then(setRows).catch(() => setRows([])), [hotelId, showEnded]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  const today = todayIso();
  const end = async (o: HotelRoomOutage) => {
    const ok = await showConfirm(k('endConfirm', { room: unitById.get(o.roomUnitId)?.label || '' }), { title: k('endTitle'), confirmLabel: k('end'), cancelLabel: t('crm.hotels.common.cancel') });
    if (!ok) return;
    endOutage(o.id).then(() => { showAlert(k('ended'), { variant: 'success' }); return load(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  };
  const remove = async (o: HotelRoomOutage) => {
    const ok = await showConfirm(k('deleteOutageConfirm'), { title: k('deleteOutage'), confirmLabel: t('crm.hotels.common.delete'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
    if (!ok) return;
    deleteOutage(o.id).then(() => load()).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  };
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <label className="hk-check inline"><input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /><span>{k('showEnded')}</span></label>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setSheet('new')}><Ic d={HTL_ICON.plus} size={14} />{k('outageNew')}</button>
      </div>
      <p className="htl-fd-note">{k('outagesHint')}</p>
      {!rows ? <div className="htl-rack-skel">{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div> : !rows.length ? (
        <div className="htl-empty"><h4>{k('outagesEmpty')}</h4></div>
      ) : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{k('col.room')}</th><th>{k('outageKind')}</th><th>{k('period')}</th><th>{k('reason')}</th><th>{k('note')}</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => {
                const active = o.dateFrom <= today && (!o.dateTo || o.dateTo > today);
                const ended = !!o.dateTo && o.dateTo <= today;
                return (
                  <tr key={o.id}>
                    <td><div className="htl-fd-room"><span className="u">{unitName(unitById.get(o.roomUnitId), k)}</span></div></td>
                    <td><span className={`hk-state s-${o.kind === 'ooo' ? 'out_of_order' : 'out_of_service'}`}>{k(`kinds.${o.kind}`)}</span></td>
                    <td><div className="htl-fd-dates"><b>{fmtDate(o.dateFrom, lang)} – {o.dateTo ? fmtDate(o.dateTo, lang) : k('untilFixed')}</b><em>{ended ? k('endedLabel') : active ? k('activeNow') : k('planned')}</em></div></td>
                    <td>{k(`outageReasons.${o.reason}`, { defaultValue: o.reason })}{o.issueId && <div className="htl-sub">{k('fromIssue')}</div>}</td>
                    <td style={{ maxWidth: 280, color: 'var(--fg-2)' }}>{o.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="htl-fd-acts">
                        {!ended && <button className="btn btn-sm" onClick={() => setSheet(o)}>{k('edit')}</button>}
                        {!ended && <button className="btn btn-sm btn-primary" onClick={() => void end(o)}>{k('end')}</button>}
                        <button className="btn btn-sm" onClick={() => void remove(o)} aria-label={t('crm.hotels.common.delete')}><Ic d={HTL_ICON.x} size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sheet && <OutageSheet hotelId={hotelId} initial={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} onDone={() => { setSheet(null); void load(); }} />}
    </>
  );
};

/* ───────────── находки ───────────── */
const LostTab: React.FC<{ hotelId: string; hotels: Hotel[]; unitById: Map<string, HotelUnitFull>; lang: string }> = ({ hotelId, hotels, unitById, lang }) => {
  const { k, t } = useHk();
  const navigate = useNavigate();
  const { showAlert, showPrompt, showConfirm } = useAlertModal();
  const [status, setStatus] = useState('stored');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<HotelLostItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => fetchLostFound(hotelId, status === 'all' ? undefined : status, q.trim() || undefined).then(setRows).catch(() => setRows([])), [hotelId, status, q]);
  useEffect(() => { const id = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(id); }, [load]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
  const giveBack = async (l: HotelLostItem) => {
    const v = await showPrompt({ title: k('returnTitle'), label: k('returnLabel'), defaultValue: l.guestName || '', confirmLabel: k('returnBtn'), cancelLabel: t('crm.hotels.common.cancel') });
    if (v === null) return;
    if (!v.trim()) { showAlert(k('errors.HOTEL_LOST_RETURNED_TO_REQUIRED'), { variant: 'error' }); return; }
    updateLostItem(l.id, { status: 'returned', returnedTo: v.trim() }).then(() => load()).catch(err);
  };
  const close = async (l: HotelLostItem, st: 'disposed' | 'handed_over') => {
    const ok = await showConfirm(k(`closeConfirm.${st}`), { title: k(`lostStatus.${st}`), confirmLabel: k(`lostStatus.${st}`), cancelLabel: t('crm.hotels.common.cancel') });
    if (ok) updateLostItem(l.id, { status: st }).then(() => load()).catch(err);
  };
  const notify = (l: HotelLostItem) => notifyLostItem(l.id).then(() => { showAlert(k('notified'), { variant: 'success' }); return load(); }).catch(err);
  const remove = async (l: HotelLostItem) => {
    const ok = await showConfirm(k('deleteLostConfirm'), { title: t('crm.hotels.common.delete'), confirmLabel: t('crm.hotels.common.delete'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
    if (ok) deleteLostItem(l.id).then(() => load()).catch(err);
  };
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="bk-savedviews" style={{ flex: 'none' }}>
          {['stored', 'returned', 'disposed', 'handed_over', 'all'].map((s) => <div key={s} className={`bk-sv-tab${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>{s === 'all' ? k('all') : k(`lostStatus.${s}`)}</div>)}
        </div>
        <div className="htl-rack-search"><Ic d={HTL_ICON.search} size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={k('lostSearch')} /></div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}><Ic d={HTL_ICON.plus} size={14} />{k('lostNew')}</button>
      </div>
      {!rows ? <div className="htl-rack-skel">{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div> : !rows.length ? (
        <div className="htl-empty"><h4>{k('lostEmpty')}</h4></div>
      ) : (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{k('foundAt')}</th><th>{k('lostWhat')}</th><th>{k('col.room')}</th><th>{k('col.guest')}</th><th>{k('storage')}</th><th>{k('col.status')}</th><th /></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td><div className="htl-fd-dates"><b>{new Date(l.foundAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}</b><em>{k(`lostCategories.${l.category}`)}</em></div></td>
                  <td style={{ maxWidth: 320 }}><div>{l.description}</div>{l.foundPlace && <div className="htl-sub">{l.foundPlace}</div>}<PhotoStrip urls={l.photoUrls} /></td>
                  <td>{l.roomUnitId ? unitName(unitById.get(l.roomUnitId), k) : '—'}</td>
                  <td>
                    <div className="htl-fd-guest">
                      {l.reservationId ? <a href={`/hotels/reservations?reservation=${l.reservationId}`} onClick={(e) => { e.preventDefault(); navigate(`/hotels/reservations?reservation=${l.reservationId}`); }} style={{ color: 'var(--ink)', fontWeight: 600 }}>{l.guestName || k('openBooking')}</a> : <b>{l.guestName || '—'}</b>}
                      {l.notifiedAt && <em>{k('notifiedAt', { date: new Date(l.notifiedAt).toLocaleDateString(lang) })}</em>}
                    </div>
                  </td>
                  <td>{l.storageLocation || '—'}</td>
                  <td><span className={`hk-task s-${l.status === 'stored' ? 'pending' : 'inspected'}`}>{k(`lostStatus.${l.status}`)}</span>{l.returnedTo && <div className="htl-sub">{l.returnedTo}</div>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="htl-fd-acts">
                      {l.status === 'stored' && l.reservationId && <button className="btn btn-sm" onClick={() => void notify(l)}>{l.notifiedAt ? k('notifyAgain') : k('notify')}</button>}
                      {l.status === 'stored' && <button className="btn btn-sm btn-primary" onClick={() => void giveBack(l)}>{k('returnBtn')}</button>}
                      {l.status === 'stored' && <button className="btn btn-sm" onClick={() => void close(l, 'handed_over')}>{k('lostStatus.handed_over')}</button>}
                      {l.status === 'stored' && <button className="btn btn-sm" onClick={() => void close(l, 'disposed')}>{k('lostStatus.disposed')}</button>}
                      {l.status !== 'stored' && <button className="btn btn-sm" onClick={() => updateLostItem(l.id, { status: 'stored' }).then(() => load()).catch(err)}>{k('backToStorage')}</button>}
                      <button className="btn btn-sm" onClick={() => void remove(l)} aria-label={t('crm.hotels.common.delete')}><Ic d={HTL_ICON.x} size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <LostSheet hotels={hotels.filter((h) => h.id === hotelId)} hotelId={hotelId} onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />}
    </>
  );
};

/* ───────────── номера: этаж, корпус, признаки ───────────── */
const RoomsTab: React.FC<{ hotelId: string; units: HotelUnitFull[]; roomTypes: Array<{ id: string; name: string }>; onChanged: () => void }> = ({ hotelId, units, roomTypes, onChanged }) => {
  const { k, t } = useHk();
  const { showAlert, showConfirm } = useAlertModal();
  const typeName = (id: string) => roomTypes.find((r) => r.id === id)?.name || '—';
  const save = (u: HotelUnitFull, dto: Partial<HotelUnitFull>) =>
    updateHkUnit(u.id, dto).then(onChanged).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  const fill = async () => {
    const hasFloors = units.some((u) => u.floor);
    const overwrite = hasFloors ? await showConfirm(k('floorsOverwrite'), { title: k('floorsFromLabels'), confirmLabel: k('floorsAll'), cancelLabel: k('floorsEmptyOnly') }) : false;
    floorsFromLabels(hotelId, overwrite).then((r) => { showAlert(k('floorsDone', { count: r.changed }), { variant: 'success' }); onChanged(); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }));
  };
  if (!units.length) return <div className="htl-empty"><h4>{t('crm.hotels.rack.noUnits')}</h4><p>{t('crm.hotels.rack.noUnitsHint')}</p></div>;
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <p className="htl-fd-note" style={{ margin: 0 }}>{k('roomsHint')}</p>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void fill()}>{k('floorsFromLabels')}</button>
      </div>
      <div className="bk-table-wrap">
        <table className="bk-table hk-rooms">
          <thead><tr><th>{k('col.room')}</th><th>{k('roomType')}</th><th>{k('floorCol')}</th><th>{k('building')}</th><th>{k('features')}</th><th>{k('note')}</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className={u.active ? undefined : 'muted'}>
                <td><b style={{ fontFamily: 'var(--ff-mono-ui)' }}>{u.label}</b>{!u.active && <span className="htl-sub"> · {t('crm.hotels.rack.inactive')}</span>}</td>
                <td>{typeName(u.roomTypeId)}</td>
                <td><input key={`f${u.id}${u.floor}`} className="hk-cell" defaultValue={u.floor || ''} onBlur={(e) => e.target.value !== (u.floor || '') && void save(u, { floor: e.target.value })} /></td>
                <td><input key={`b${u.id}${u.building}`} className="hk-cell wide" defaultValue={u.building || ''} onBlur={(e) => e.target.value !== (u.building || '') && void save(u, { building: e.target.value })} /></td>
                <td>
                  <div className="hk-feats">
                    {HOTEL_UNIT_FEATURES.map((f) => {
                      const on = (u.features || []).includes(f);
                      return <button key={f} type="button" className={on ? 'on' : ''} onClick={() => void save(u, { features: on ? u.features.filter((x) => x !== f) : [...(u.features || []), f] })}>{k(`featureNames.${f}`)}</button>;
                    })}
                  </div>
                </td>
                <td><input key={`n${u.id}${u.note}`} className="hk-cell wide" defaultValue={u.note || ''} onBlur={(e) => e.target.value !== (u.note || '') && void save(u, { note: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
