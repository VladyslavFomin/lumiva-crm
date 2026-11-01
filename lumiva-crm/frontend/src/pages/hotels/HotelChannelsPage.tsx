import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { hotelErrorText } from './ReservationLifecycle';
import {
  connectChannel,
  deleteChannel,
  fetchChannelLogs,
  fetchChannelRemote,
  fetchChannelState,
  fetchChannels,
  fetchHotels,
  fetchMarketGroups,
  fetchOccupancyTypes,
  fetchRoomTypes,
  fetchRatePlans,
  type HotelRatePlan,
  pullChannel,
  pushChannel,
  saveChannelMappings,
  toggleChannelWebhook,
  updateChannel,
  type Hotel,
  type HotelChannelConnection,
  type HotelChannelLogRow,
  type HotelChannelMapping,
  type HotelChannelRemote,
  type HotelChannelState,
  type HotelChannelSyncResult,
  type HotelMarketGroup,
  type HotelRoomOccupancyType,
  type HotelRoomType,
} from '../../api/hotels';
import './hotels-design.css';

interface PlanRow { externalRatePlanId: string; occupancyTypeId: string | null; marketGroupId: string | null; ratePlanId: string | null; active: boolean }
interface RoomMap { ext: string; extName: string | null; plans: PlanRow[] }

/** Сопоставления из API → по типу номера: номер в канале и список тарифов (несколько тарифов на один номер — BAR, B&B…) */
function toRoomMaps(roomTypes: HotelRoomType[], mappings: HotelChannelMapping[]): Record<string, RoomMap> {
  const out: Record<string, RoomMap> = {};
  for (const rt of roomTypes) {
    const mine = mappings.filter((m) => m.roomTypeId === rt.id);
    out[rt.id] = {
      ext: mine[0]?.externalRoomTypeId || '',
      extName: mine[0]?.externalName || null,
      plans: mine.filter((m) => m.externalRatePlanId).map((m) => ({ externalRatePlanId: m.externalRatePlanId!, occupancyTypeId: m.occupancyTypeId, marketGroupId: m.marketGroupId, ratePlanId: m.ratePlanId ?? null, active: m.active })),
    };
  }
  return out;
}

function toMappings(maps: Record<string, RoomMap>): HotelChannelMapping[] {
  const out: HotelChannelMapping[] = [];
  for (const [roomTypeId, m] of Object.entries(maps)) {
    if (!m.ext) continue;
    const plans = m.plans.filter((p) => p.externalRatePlanId);
    if (!plans.length) out.push({ roomTypeId, externalRoomTypeId: m.ext, externalName: m.extName, externalRatePlanId: null, occupancyTypeId: null, marketGroupId: null, ratePlanId: null, active: true });
    for (const p of plans) out.push({ roomTypeId, externalRoomTypeId: m.ext, externalName: m.extName, externalRatePlanId: p.externalRatePlanId, occupancyTypeId: p.occupancyTypeId, marketGroupId: p.marketGroupId, ratePlanId: p.ratePlanId, active: p.active });
  }
  return out;
}

/**
 * Менеджер каналов: Channex (через него Booking.com, Expedia, Airbnb…) — ключ, сопоставление номеров и тарифов,
 * обмен по правилам Channex (только изменения, полная выгрузка раз в сутки), брони по вебхуку, журнал.
 */
export const HotelChannelsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.channels.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const [conn, setConn] = useState<HotelChannelConnection | null>(null);
  const [state, setState] = useState<HotelChannelState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [remote, setRemote] = useState<HotelChannelRemote | null>(null);
  const [remoteError, setRemoteError] = useState('');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [occ, setOcc] = useState<Record<string, HotelRoomOccupancyType[]>>({});
  const [groups, setGroups] = useState<HotelMarketGroup[]>([]);
  const [ourPlans, setOurPlans] = useState<HotelRatePlan[]>([]);
  const [maps, setMaps] = useState<Record<string, RoomMap>>({});
  const [dirty, setDirty] = useState(false);
  const [logs, setLogs] = useState<HotelChannelLogRow[]>([]);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ apiKey: '', environment: 'production' });
  const [settings, setSettings] = useState({ pushDays: '500', reserveRooms: '0' });

  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);

  const load = useCallback(async () => {
    if (!hotelId) return;
    const [list, rts, gs, rps] = await Promise.all([fetchChannels(hotelId).catch(() => []), fetchRoomTypes(hotelId).catch(() => []), fetchMarketGroups(hotelId).catch(() => []), fetchRatePlans(hotelId).catch(() => [] as HotelRatePlan[])]);
    setRoomTypes(rts);
    setGroups(gs);
    setOurPlans(rps);
    const occMap: Record<string, HotelRoomOccupancyType[]> = {};
    await Promise.all(rts.map((r) => fetchOccupancyTypes(r.id).then((o) => { occMap[r.id] = o; }).catch(() => { occMap[r.id] = []; })));
    setOcc(occMap);
    const c = list[0] || null;
    setConn(c);
    setLoaded(true);
    if (c) {
      setSettings({ pushDays: String(c.settings.pushDays ?? 500), reserveRooms: String(c.settings.reserveRooms ?? 0) });
      setMaps(toRoomMaps(rts, c.mappings));
      setDirty(false);
      fetchChannelLogs(c.id).then(setLogs).catch(() => setLogs([]));
      fetchChannelState(c.id).then(setState).catch(() => setState(null));
    }
  }, [hotelId]);
  const loadRemote = useCallback((c: HotelChannelConnection | null) => {
    setRemote(null);
    setRemoteError('');
    if (c) fetchChannelRemote(c.id).then(setRemote).catch((e) => setRemoteError(hotelErrorText(t, e, k('remoteError'))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);
  useEffect(() => { loadRemote(conn); }, [conn?.id, conn?.externalPropertyId]); // eslint-disable-line react-hooks/exhaustive-deps
  // журнал и состояние обмена обновляются сами, пока страница открыта
  useEffect(() => {
    if (!conn) return;
    const id = setInterval(() => {
      fetchChannelLogs(conn.id).then(setLogs).catch(() => undefined);
      fetchChannelState(conn.id).then(setState).catch(() => undefined);
      fetchChannels(hotelId).then((l) => l[0] && setConn((cur) => (cur && cur.id === l[0].id ? { ...l[0], mappings: cur.mappings } : cur))).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [conn?.id, hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<unknown>, ok?: (r: any) => string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) showAlert(ok(r), { variant: 'success' });
      await load();
    } catch (e) {
      showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const syncMsg = (r: HotelChannelSyncResult) =>
    r.calls === 0 && !r.deferred.length
      ? k('syncNothing')
      : [k('syncDone', { availability: r.availability, rates: r.rates, calls: r.calls }), r.deferred.length ? k('syncDeferred') : '', r.warnings.length ? k('syncWarnings', { count: r.warnings.length }) : ''].filter(Boolean).join(' · ');

  const connect = () => run('connect', () => connectChannel({ hotelId, provider: 'channex', apiKey: form.apiKey.trim(), environment: form.environment }), () => k('connected'));
  const ratePlan = (id: string) => remote?.ratePlans.find((p) => p.id === id) || null;
  const plansFor = (ext: string) => (remote?.ratePlans || []).filter((p) => !p.roomTypeId || p.roomTypeId === ext);
  const usedPlans = useMemo(() => new Set(Object.values(maps).flatMap((m) => m.plans.map((p) => p.externalRatePlanId)).filter(Boolean)), [maps]);
  const setRoom = (rtId: string, patch: Partial<RoomMap>) => {
    setMaps((prev) => ({ ...prev, [rtId]: { ...prev[rtId], ...patch } }));
    setDirty(true);
  };
  const setPlan = (rtId: string, i: number, patch: Partial<PlanRow>) => setRoom(rtId, { plans: maps[rtId].plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const mappedRooms = Object.values(maps).filter((m) => m.ext).length;
  const mappedPlans = Object.values(maps).reduce((s, m) => s + (m.ext ? m.plans.filter((p) => p.externalRatePlanId).length : 0), 0);
  const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const hotel = useMemo(() => hotels.find((h) => h.id === hotelId), [hotels, hotelId]);
  const paused = conn?.pausedUntil && new Date(conn.pausedUntil) > new Date() ? conn.pausedUntil : null;
  const modeBadge = (id: string) => {
    const p = ratePlan(id);
    if (!p) return null;
    const label = p.rateMode !== 'manual' ? k('plan.derived') : p.sellMode === 'per_person' ? k('plan.perPerson', { list: p.occupancies.join('/') }) : k('plan.perRoom');
    return <span className={`ch-plan m-${p.rateMode !== 'manual' ? 'derived' : p.sellMode}`} title={k(`plan.hint.${p.rateMode !== 'manual' ? 'derived' : p.sellMode}`)}>{label}</span>;
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotelChannels" />
      <div className="px-scope">
        <HotelsSubnav active="channels" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {conn && <span className={`ch-status st-${conn.status}`}>{k(`status.${conn.status}`)}</span>}
        </div>

        {!loaded ? (
          <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div>
        ) : !conn ? (
          <div className="htl-panel ch-connect">
            <h3 className="htl-h3">{k('connectTitle')}</h3>
            <p className="htl-sub">{k('connectHint')}</p>
            <ol className="ch-steps">
              <li>{k('step1')}</li>
              <li>{k('step2')}</li>
              <li>{k('step3')}</li>
            </ol>
            <div className="htl-form" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginTop: 12 }}>
              <div className="htl-f"><label>{k('apiKey')}</label><input type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></div>
              <div className="htl-f"><label>{k('environment')}</label>
                <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                  <option value="production">{k('envProduction')}</option>
                  <option value="staging">{k('envStaging')}</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btn-primary" disabled={!form.apiKey.trim() || busy === 'connect'} onClick={connect}>{k('connect')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="htl-panel">
              <div className="ch-head">
                <div>
                  <div className="ch-prop">{conn.externalPropertyName || k('noProperty')}</div>
                  <div className="htl-sub">Channex · {k(`env.${conn.environment}`)} · {k('key')} {conn.apiKeyMasked}</div>
                </div>
                <div className="ch-actions">
                  <button type="button" className="btn btn-primary" disabled={!!busy || !mappedRooms || !!paused} onClick={() => run('push', () => pushChannel(conn.id), syncMsg)}>
                    <Ic d={HTL_ICON.download} size={13} />{k('pushDelta')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy || !mappedRooms}
                    onClick={async () => {
                      if (await showConfirm(k('fullBody'), { title: k('pushFull'), confirmLabel: k('pushFull') })) void run('full', () => pushChannel(conn.id, true), syncMsg);
                    }}
                  >
                    {k('pushFull')}
                  </button>
                  <button type="button" className="btn" disabled={!!busy || !conn.externalPropertyId} onClick={() => run('pull', () => pullChannel(conn.id), (r) => k('pulled', r))}>{k('pull')}</button>
                  <button type="button" className="btn" disabled={!!busy} onClick={() => run('pause', () => updateChannel(conn.id, { status: conn.status === 'paused' ? 'active' : 'paused' }))}>
                    {conn.status === 'paused' ? k('resume') : k('pause')}
                  </button>
                </div>
              </div>
              <div className="ch-kpis">
                <div><span>{k('lastPush')}</span><b>{fmt(conn.lastPushAt)}</b><em>{k('lastDelta', { at: fmt(conn.lastDeltaAt) })}</em></div>
                <div><span>{k('lastFull')}</span><b>{fmt(conn.lastFullSyncAt)}</b><em>{k('fullRule')}</em></div>
                <div><span>{k('lastPull')}</span><b>{fmt(conn.lastPullAt)}</b><em>{conn.webhookActive ? k('webhookOn') : k('webhookOff')}</em></div>
                <div><span>{k('mapped')}</span><b>{k('mappedValue', { rooms: mappedRooms, total: roomTypes.length, plans: mappedPlans })}</b><em>{state ? k('accepted', { avail: state.availability.values, rates: state.rates.values }) : '—'}</em></div>
              </div>
              {paused && <div className="pe-box warn">{k('pausedUntil', { at: fmt(paused) })}</div>}
              {conn.lastError && <div className="pe-box warn">{conn.lastError}</div>}
              {remoteError && <div className="pe-box warn">{remoteError}</div>}
              {!conn.externalPropertyId && remote && (
                <div className="pe-box warn">
                  <div>{k('noPropertyHint')}</div>
                  <select value="" onChange={(e) => e.target.value && run('prop', () => updateChannel(conn.id, { externalPropertyId: e.target.value }))} style={{ maxWidth: 360 }}>
                    <option value="">{k('pickProperty')}</option>
                    {remote.properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}
              <div className="ch-webhook">
                <span>{conn.webhookActive ? k('webhookOnHint') : k('webhookOffHint')}</span>
                <button type="button" className="btn btn-sm" disabled={!!busy || !conn.externalPropertyId} onClick={() => run('webhook', () => toggleChannelWebhook(conn.id, !conn.webhookActive), () => (conn.webhookActive ? k('webhookDisabled') : k('webhookEnabled')))}>
                  {conn.webhookActive ? k('webhookDisable') : k('webhookEnable')}
                </button>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('mappingTitle')}</h3>
              <p className="htl-sub" style={{ margin: '-4px 0 10px' }}>{k('mappingHint')}</p>
              <div className="ch-rooms">
                {roomTypes.map((rt) => {
                  const m = maps[rt.id] || { ext: '', extName: null, plans: [] };
                  return (
                    <div key={rt.id} className={`ch-room${m.ext ? '' : ' off'}`}>
                      <div className="ch-room-head">
                        <b>{rt.name}</b>
                        <span className="arrow">→</span>
                        <select
                          value={m.ext}
                          onChange={(e) => setRoom(rt.id, { ext: e.target.value, extName: remote?.roomTypes.find((x) => x.id === e.target.value)?.title || null, plans: e.target.value ? m.plans.filter((p) => plansFor(e.target.value).some((x) => x.id === p.externalRatePlanId)) : [] })}
                        >
                          <option value="">{k('notMapped')}</option>
                          {(remote?.roomTypes || []).map((x) => <option key={x.id} value={x.id}>{x.title}{x.rooms !== null ? ` · ${k('roomsIn', { n: x.rooms })}` : ''}</option>)}
                        </select>
                      </div>
                      {m.ext && (
                        <div className="ch-plans">
                          {!m.plans.length && <div className="htl-sub">{k('availabilityOnly')}</div>}
                          {m.plans.map((p, i) => {
                            const plan = ratePlan(p.externalRatePlanId);
                            const perPerson = plan?.sellMode === 'per_person' && plan.rateMode === 'manual';
                            const derived = !!plan && plan.rateMode !== 'manual';
                            return (
                              <div key={i} className="ch-plan-row">
                                <select value={p.externalRatePlanId} onChange={(e) => setPlan(rt.id, i, { externalRatePlanId: e.target.value })}>
                                  <option value="">{k('pickRatePlan')}</option>
                                  {plansFor(m.ext).map((x) => (
                                    <option key={x.id} value={x.id} disabled={x.id !== p.externalRatePlanId && usedPlans.has(x.id)}>
                                      {x.title}{x.currency ? ` · ${x.currency}` : ''}
                                    </option>
                                  ))}
                                </select>
                                {modeBadge(p.externalRatePlanId)}
                                {derived ? (
                                  <span className="htl-sub ch-note">{k('derivedNote')}</span>
                                ) : perPerson ? (
                                  <span className="htl-sub ch-note">{k('perPersonNote')}</span>
                                ) : (
                                  <select value={p.occupancyTypeId || ''} onChange={(e) => setPlan(rt.id, i, { occupancyTypeId: e.target.value || null })} title={k('colOccupancy')}>
                                    <option value="">{k('occDefault')}</option>
                                    {(occ[rt.id] || []).map((o) => <option key={o.id} value={o.id}>{o.label} · ×{Number(o.coefficient)}</option>)}
                                  </select>
                                )}
                                {ourPlans.length > 0 && (
                                  <select value={p.ratePlanId || ''} onChange={(e) => setPlan(rt.id, i, { ratePlanId: e.target.value || null })} title={k('ourPlan')}>
                                    <option value="">{k('ourPlanNone')}</option>
                                    {ourPlans.filter((x) => !x.roomTypeIds?.length || x.roomTypeIds.includes(rt.id)).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}{x.active ? '' : ` (${k('ourPlanOff')})`}</option>)}
                                  </select>
                                )}
                                {!derived && (
                                  <select value={p.marketGroupId || ''} onChange={(e) => setPlan(rt.id, i, { marketGroupId: e.target.value || null })} title={k('colGroup')}>
                                    <option value="">{k('groupReference')}</option>
                                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                                  </select>
                                )}
                                <label className="ch-active"><input type="checkbox" checked={p.active} onChange={(e) => setPlan(rt.id, i, { active: e.target.checked })} />{k('colActive')}</label>
                                <button type="button" className="btn-icon btn-icon-danger" onClick={() => setRoom(rt.id, { plans: m.plans.filter((_, j) => j !== i) })} aria-label={k('removePlan')} title={k('removePlan')}>
                                  <Ic d={HTL_ICON.x} size={14} />
                                </button>
                              </div>
                            );
                          })}
                          {plansFor(m.ext).some((x) => !usedPlans.has(x.id)) && (
                            <button type="button" className="btn btn-sm ch-add" onClick={() => setRoom(rt.id, { plans: [...m.plans, { externalRatePlanId: plansFor(m.ext).find((x) => !usedPlans.has(x.id))?.id || '', occupancyTypeId: null, marketGroupId: null, ratePlanId: null, active: true }] })}>
                              <Ic d={HTL_ICON.plus} size={12} />{k('addPlan')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {remote && hotel?.currency && remote.ratePlans.some((p) => p.currency && p.currency !== hotel.currency) && (
                <div className="pe-box warn">{k('currencyWarn', { currency: hotel.currency })}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 }}>
                {dirty && <span className="htl-sub">{k('unsaved')}</span>}
                <button type="button" className="btn btn-primary" disabled={!!busy || !remote || !dirty} onClick={() => run('map', () => saveChannelMappings(conn.id, toMappings(maps)), () => k('mappingSaved'))}>{k('saveMapping')}</button>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('settingsTitle')}</h3>
              <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div className="htl-f"><label>{k('pushDays')}</label><input type="number" min={7} max={500} value={settings.pushDays} onChange={(e) => setSettings({ ...settings, pushDays: e.target.value })} /><div className="htl-hint">{k('pushDaysHint')}</div></div>
                <div className="htl-f"><label>{k('reserveRooms')}</label><input type="number" min={0} max={50} value={settings.reserveRooms} onChange={(e) => setSettings({ ...settings, reserveRooms: e.target.value })} /><div className="htl-hint">{k('reserveHint')}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!!busy}
                  onClick={async () => {
                    if (await showConfirm(k('disconnectBody'), { title: k('disconnect'), confirmLabel: k('disconnect'), danger: true })) void run('del', () => deleteChannel(conn.id));
                  }}
                >
                  {k('disconnect')}
                </button>
                <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run('settings', () => updateChannel(conn.id, { settings: { pushDays: Number(settings.pushDays), reserveRooms: Number(settings.reserveRooms) } }), () => k('settingsSaved'))}>{k('saveSettings')}</button>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('logTitle')}</h3>
              {!logs.length ? <p className="htl-sub">{k('logEmpty')}</p> : (
                <div className="ch-log">
                  {logs.map((l) => {
                    const warns = l.details?.warnings || [];
                    const tasks = l.details?.taskIds || [];
                    return (
                      <React.Fragment key={l.id}>
                        <div className={`${l.ok ? 'ok' : 'err'}${warns.length || tasks.length ? ' more' : ''}`} onClick={() => (warns.length || tasks.length) && setOpenLog(openLog === l.id ? null : l.id)}>
                          <span className="t">{fmt(l.createdAt)}</span>
                          <span className="kd">{k(`kind.${l.kind}`)}</span>
                          <span className="m">{l.message}</span>
                        </div>
                        {openLog === l.id && (
                          <div className="ch-log-details">
                            {tasks.length > 0 && <div><b>{k('tasks')}</b> {tasks.join(', ')}</div>}
                            {warns.map((w, i) => (
                              <div key={i} className="w">{[w.externalId, w.from && w.to && w.from !== w.to ? `${w.from} — ${w.to}` : w.from].filter(Boolean).join(' · ')}: {w.message}</div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default HotelChannelsPage;
