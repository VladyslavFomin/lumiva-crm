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
  fetchChannels,
  fetchHotels,
  fetchMarketGroups,
  fetchOccupancyTypes,
  fetchRoomTypes,
  pullChannel,
  pushChannel,
  saveChannelMappings,
  updateChannel,
  type Hotel,
  type HotelChannelConnection,
  type HotelChannelLogRow,
  type HotelChannelMapping,
  type HotelChannelRemote,
  type HotelMarketGroup,
  type HotelRoomOccupancyType,
  type HotelRoomType,
} from '../../api/hotels';
import './hotels-design.css';

/** Менеджер каналов: Channex (через него Booking.com, Expedia, Airbnb…) — ключ, сопоставления, выгрузка и брони */
export const HotelChannelsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.channels.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const [conn, setConn] = useState<HotelChannelConnection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [remote, setRemote] = useState<HotelChannelRemote | null>(null);
  const [remoteError, setRemoteError] = useState('');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [occ, setOcc] = useState<Record<string, HotelRoomOccupancyType[]>>({});
  const [groups, setGroups] = useState<HotelMarketGroup[]>([]);
  const [rows, setRows] = useState<HotelChannelMapping[]>([]);
  const [logs, setLogs] = useState<HotelChannelLogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ apiKey: '', environment: 'production' });
  const [settings, setSettings] = useState({ pushDays: '365', reserveRooms: '0' });

  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoaded(false);
    setRemote(null);
    setRemoteError('');
    const [list, rts, gs] = await Promise.all([fetchChannels(hotelId).catch(() => []), fetchRoomTypes(hotelId).catch(() => []), fetchMarketGroups(hotelId).catch(() => [])]);
    setRoomTypes(rts);
    setGroups(gs);
    const occMap: Record<string, HotelRoomOccupancyType[]> = {};
    await Promise.all(rts.map((r) => fetchOccupancyTypes(r.id).then((o) => { occMap[r.id] = o; }).catch(() => { occMap[r.id] = []; })));
    setOcc(occMap);
    const c = list[0] || null;
    setConn(c);
    setLoaded(true);
    if (c) {
      setSettings({ pushDays: String(c.settings.pushDays ?? 365), reserveRooms: String(c.settings.reserveRooms ?? 0) });
      setRows(rts.map((rt) => c.mappings.find((m) => m.roomTypeId === rt.id) || { roomTypeId: rt.id, occupancyTypeId: null, marketGroupId: null, externalRoomTypeId: '', externalRatePlanId: null, active: true }));
      fetchChannelLogs(c.id).then(setLogs).catch(() => setLogs([]));
      fetchChannelRemote(c.id).then(setRemote).catch((e) => setRemoteError(hotelErrorText(t, e, k('remoteError'))));
    }
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

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

  const connect = () => run('connect', () => connectChannel({ hotelId, provider: 'channex', apiKey: form.apiKey.trim(), environment: form.environment }), () => k('connected'));
  const ratePlansFor = (extRoomTypeId: string) => (remote?.ratePlans || []).filter((p) => !p.roomTypeId || p.roomTypeId === extRoomTypeId);
  const setRow = (i: number, patch: Partial<HotelChannelMapping>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const mapped = rows.filter((r) => r.externalRoomTypeId);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const hotel = useMemo(() => hotels.find((h) => h.id === hotelId), [hotels, hotelId]);

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
              <div className="htl-f"><label>{k('apiKey')}</label><input type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="ck_…" /></div>
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
                  <button type="button" className="btn" disabled={!!busy || !mapped.length} onClick={() => run('push', () => pushChannel(conn.id), (r) => k('pushed', { availability: r.availability, rates: r.rates, stops: r.stops }))}>
                    <Ic d={HTL_ICON.download} size={13} />{k('push')}
                  </button>
                  <button type="button" className="btn" disabled={!!busy || !conn.externalPropertyId} onClick={() => run('pull', () => pullChannel(conn.id), (r) => k('pulled', r))}>{k('pull')}</button>
                  <button type="button" className="btn" disabled={!!busy} onClick={() => run('pause', () => updateChannel(conn.id, { status: conn.status === 'paused' ? 'active' : 'paused' }))}>
                    {conn.status === 'paused' ? k('resume') : k('pause')}
                  </button>
                </div>
              </div>
              <div className="ch-kpis">
                <div><span>{k('lastPush')}</span><b>{fmt(conn.lastPushAt)}</b></div>
                <div><span>{k('lastPull')}</span><b>{fmt(conn.lastPullAt)}</b></div>
                <div><span>{k('mapped')}</span><b>{mapped.length} / {roomTypes.length}</b></div>
                <div><span>{k('auto')}</span><b>{conn.status === 'paused' ? k('autoOff') : k('autoOn')}</b></div>
              </div>
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
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('mappingTitle')}</h3>
              <p className="htl-sub" style={{ margin: '-4px 0 10px' }}>{k('mappingHint')}</p>
              <div className="ch-map-wrap">
                <table className="pace-table ch-map">
                  <thead>
                    <tr>
                      <th>{k('colRoom')}</th>
                      <th>{k('colChannelRoom')}</th>
                      <th>{k('colRatePlan')}</th>
                      <th>{k('colOccupancy')}</th>
                      <th>{k('colGroup')}</th>
                      <th>{k('colActive')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const rt = roomTypes.find((x) => x.id === r.roomTypeId);
                      return (
                        <tr key={r.roomTypeId}>
                          <td><b>{rt?.name}</b></td>
                          <td>
                            <select value={r.externalRoomTypeId} onChange={(e) => setRow(i, { externalRoomTypeId: e.target.value, externalRatePlanId: null, externalName: remote?.roomTypes.find((x) => x.id === e.target.value)?.title || null })}>
                              <option value="">{k('notMapped')}</option>
                              {(remote?.roomTypes || []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={r.externalRatePlanId || ''} disabled={!r.externalRoomTypeId} onChange={(e) => setRow(i, { externalRatePlanId: e.target.value || null })}>
                              <option value="">{k('noRatePlan')}</option>
                              {ratePlansFor(r.externalRoomTypeId).map((x) => <option key={x.id} value={x.id}>{x.title}{x.currency ? ` · ${x.currency}` : ''}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={r.occupancyTypeId || ''} disabled={!r.externalRatePlanId} onChange={(e) => setRow(i, { occupancyTypeId: e.target.value || null })}>
                              <option value="">{k('occFirst')}</option>
                              {(occ[r.roomTypeId] || []).map((o) => <option key={o.id} value={o.id}>{o.label} · ×{Number(o.coefficient)}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={r.marketGroupId || ''} disabled={!r.externalRatePlanId} onChange={(e) => setRow(i, { marketGroupId: e.target.value || null })}>
                              <option value="">{k('groupReference')}</option>
                              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={r.active} disabled={!r.externalRoomTypeId} onChange={(e) => setRow(i, { active: e.target.checked })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {remote && hotel?.currency && remote.ratePlans.some((p) => p.currency && p.currency !== hotel.currency) && (
                <div className="pe-box warn">{k('currencyWarn', { currency: hotel.currency })}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-primary" disabled={!!busy || !remote} onClick={() => run('map', () => saveChannelMappings(conn.id, mapped), () => k('mappingSaved'))}>{k('saveMapping')}</button>
              </div>
            </div>

            <div className="htl-panel">
              <h3 className="htl-h3">{k('settingsTitle')}</h3>
              <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div className="htl-f"><label>{k('pushDays')}</label><input type="number" min={7} max={365} value={settings.pushDays} onChange={(e) => setSettings({ ...settings, pushDays: e.target.value })} /><div className="htl-hint">{k('pushDaysHint')}</div></div>
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
                  {logs.map((l) => (
                    <div key={l.id} className={l.ok ? 'ok' : 'err'}>
                      <span className="t">{fmt(l.createdAt)}</span>
                      <span className="kd">{k(`kind.${l.kind}`)}</span>
                      <span className="m">{l.message}</span>
                    </div>
                  ))}
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
