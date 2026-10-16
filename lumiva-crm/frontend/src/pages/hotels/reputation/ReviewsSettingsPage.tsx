import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import {
  REP_PLATFORMS,
  createRepBrand,
  deleteRepBrand,
  deleteRepSource,
  disconnectRepGoogle,
  fetchRepAlerts,
  fetchRepGoogleAccounts,
  fetchRepGoogleAuthUrl,
  fetchRepGoogleLocations,
  fetchRepRuns,
  fetchRepSettings,
  fetchRepSetup,
  previewRepRun,
  setRepHotelBrand,
  setupRepGoogleNotifications,
  syncRepSource,
  testRepSource,
  updateRepBrand,
  updateRepSettings,
  upsertRepSource,
  restoreRepPrimary,
  fetchRepOlderCount,
  purgeRepOlder,
  requestRepBackfill,
  APIFY_PRICE_PER_1000,
  verifyRepApify,
  fetchRepApifyUsage,
  scanRepDuplicates,
  matchRepStays,
  type RepAlertKind,
  type RepConfig,
  type RepPlatform,
  type RepRecipients,
  type RepRun,
  type RepSettings,
  type RepSetup,
  type RepSource,
  translateRepTopic,
} from '../../../api/hotelReputation';
import { ApifyPauseBanner, PlatformBadge, TOPIC_KEYS, fmtDate, useRepT } from './ReputationShared';
import { RvHead, RvTabs } from './rvui';
import { CompetitorsTab } from './RepCompetitorsSettings';
import { TenantMailNotice } from '../../../components/mail/TenantMailNotice';
import { useTenantComponents } from '../../../hooks/useTenantComponents';
import '../hotels-design.css';
import './reputation.css';

type Tab = 'hotels' | 'connections' | 'competitors' | 'alerts' | 'ai' | 'log';
const TABS: Tab[] = ['hotels', 'connections', 'competitors', 'alerts', 'ai', 'log'];
const emptyRec = (): RepRecipients => ({ emails: [], telegram: [], userIds: [] });

// ============================================================ Дозагрузка истории

/** Спросить, до скольки отзывов догрузить, показать оценку стоимости и поставить в очередь. */
function useBackfill() {
  const { r } = useRepT();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  return async (platform: RepPlatform, hotels: number, target: { sourceIds?: string[]; platform?: string }, onDone?: () => void) => {
    const v = await showPrompt({ title: r('backfill.promptTitle'), label: r('backfill.promptLabel'), defaultValue: '1000' });
    const max = Math.round(Number(v));
    if (!v || !Number.isFinite(max) || max < 10) return;
    const usd = (max * hotels * APIFY_PRICE_PER_1000[platform]) / 1000;
    if (!(await showConfirm(r('backfill.confirm', { n: max, h: hotels, usd: usd < 1 ? usd.toFixed(2) : Math.round(usd) })))) return;
    try {
      const res = await requestRepBackfill({ ...target, max });
      showAlert(r('backfill.queued', { n: res.queued }), { variant: 'success' });
      onDone?.();
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    }
  };
}

// ============================================================ Отели и площадки

const SourceRow: React.FC<{
  hotelId: string;
  platform: RepPlatform;
  source: RepSource | undefined;
  googleConnected: boolean;
  locations: Array<{ path: string; title: string; address: string | null }> | null;
  onChanged: () => void;
}> = ({ hotelId, platform, source, googleConnected, locations, onChanged }) => {
  const { r, lang } = useRepT();
  const { showAlert, showConfirm } = useAlertModal();
  const backfill = useBackfill();
  const [url, setUrl] = useState(source?.url || '');
  const [extId, setExtId] = useState(source?.externalId || '');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setUrl(source?.url || '');
    setExtId(source?.externalId || '');
  }, [source?.url, source?.externalId]);

  const act = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      onChanged();
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const dirty = url !== (source?.url || '') || extId !== (source?.externalId || '') || !!key;
  const save = () =>
    act('save', () => upsertRepSource(hotelId, platform, { url: url || null, ...(platform === 'google' ? { externalId: extId || null } : {}), ...(key ? { apiKey: key } : {}) }).then(() => setKey('')), r('settings.saved'));

  const status = !source
    ? null
    : source.lastError
      ? { cls: 'err', text: r('src.error') }
      : source.lastSuccessAt
        ? { cls: 'ok', text: r('src.okAt', { d: fmtDate(source.lastSuccessAt, lang, true) }) }
        : { cls: 'warn', text: r('src.notSynced') };

  return (
    <tr>
      <td><PlatformBadge platform={platform} /><div className="rp-src-meta">{r(`replyMode.${source?.replyMode || (platform === 'check24' ? 'none' : ['google', 'holidaycheck'].includes(platform) ? 'api' : 'external')}`)}</div></td>
      <td>
        <div className="rp-src-cell">
          <input className="rp-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={r(`src.urlPh.${platform}`)} />
          {platform === 'google' && (
            locations && locations.length ? (
              <select className="rp-input" value={extId} onChange={(e) => setExtId(e.target.value)}>
                <option value="">{r('src.pickLocation')}</option>
                {locations.map((l) => <option key={l.path} value={l.path}>{l.title}{l.address ? ` — ${l.address}` : ''}</option>)}
              </select>
            ) : (
              <input className="rp-input" value={extId} onChange={(e) => setExtId(e.target.value)} placeholder="accounts/…/locations/…" disabled={!googleConnected} title={googleConnected ? '' : r('src.googleConnectFirst')} />
            )
          )}
          {platform === 'holidaycheck' && (
            <input className="rp-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={source?.apiKey ? r('src.keySet', { k: source.apiKey }) : r('src.keyPh')} autoComplete="new-password" />
          )}
        </div>
      </td>
      <td style={{ minWidth: 170 }}>
        {status && <span className={`rp-status ${status.cls}`}>{status.text}</span>}
        {source?.lastError && <div className="rp-src-meta err" title={source.lastError}>{source.lastError.slice(0, 120)}</div>}
        {source?.platformCount != null && <div className="rp-src-meta">{r('src.onPlatform', { n: source.platformCount, r: source.platformRating ?? '—' })}</div>}
        {source?.useFallback && (
          <div className="rp-src-meta err">
            {r('src.onFallback')}{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); act('primary', () => restoreRepPrimary(source.id)); }}>{r('src.backToPrimary')}</a>
          </div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {dirty && <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={save}>{r('settings.save')}</button>}
          {source && !dirty && (
            <>
              <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act('sync', async () => {
                  const res = await syncRepSource(source.id);
                  showAlert(res?.queued ? r('src.syncQueued') : r('src.syncStarted'), { variant: 'success' });
                })}>
                {busy === 'sync' ? '…' : r('src.sync')}
              </button>
              {(platform !== 'google' || !googleConnected || !source.externalId) && (
                <button type="button" className="btn btn-sm" disabled={!!busy || !!source.backfillMax} title={r('backfill.hint')} onClick={() => backfill(platform, 1, { sourceIds: [source.id] }, onChanged)}>
                  {source.backfillMax ? r('backfill.pending') : r('backfill.button')}
                </button>
              )}
              {(platform !== 'google' || !source.externalId) && (
                <button type="button" className="btn btn-sm" disabled={!!busy} title={r('src.testHint')} onClick={() => act('test', () => testRepSource(source.id, 20), r('src.testStarted'))}>
                  {r('src.test')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                disabled={!!busy}
                onClick={async () => {
                  const okd = await showConfirm(r('src.confirmDelete'));
                  if (okd) act('del', () => deleteRepSource(source.id));
                }}
              >
                <Ic d={HTL_ICON.x} size={12} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

const HotelsTab: React.FC<{ setup: RepSetup; settings: RepSettings; reload: () => void }> = ({ setup, settings, reload }) => {
  const { r } = useRepT();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(setup.hotels[0]?.id || null);
  const [newBrand, setNewBrand] = useState('');
  const [locations, setLocations] = useState<Array<{ path: string; title: string; address: string | null }> | null>(null);

  useEffect(() => {
    if (settings.googleConnected && settings.config.google.accountName) fetchRepGoogleLocations().then(setLocations).catch(() => setLocations(null));
  }, [settings.googleConnected, settings.config.google.accountName]);

  const wrap = (p: Promise<unknown>) => p.then(reload).catch((e) => showAlert(e.message, { variant: 'error' }));

  return (
    <>
      <div data-tour="rvs-brands" className="ha-section">
        <div className="ha-section-head"><div><h3>{r('settings.brandsTitle')}</h3><div className="sub">{r('settings.brandsSub')}</div></div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {setup.brands.map((b) => (
            <span key={b.id} className="rp-chip" style={{ cursor: 'default' }}>
              <span
                onClick={async () => {
                  const name = await showPrompt({ title: r('settings.brandRename'), defaultValue: b.name });
                  if (name && name.trim() && name !== b.name) wrap(updateRepBrand(b.id, name.trim(), b.color));
                }}
                style={{ cursor: 'pointer' }}
              >{b.name}</span>
              <span className="x" style={{ cursor: 'pointer' }} onClick={async () => (await showConfirm(r('settings.brandDelete', { n: b.name }))) && wrap(deleteRepBrand(b.id))}>×</span>
            </span>
          ))}
          <input className="rp-input" style={{ width: 180 }} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder={r('settings.brandPh')}
            onKeyDown={(e) => { if (e.key === 'Enter' && newBrand.trim()) { wrap(createRepBrand(newBrand.trim())); setNewBrand(''); } }} />
          <button type="button" className="btn btn-sm" disabled={!newBrand.trim()} onClick={() => { wrap(createRepBrand(newBrand.trim())); setNewBrand(''); }}>
            <Ic d={HTL_ICON.plus} size={12} />{r('settings.brandAdd')}
          </button>
        </div>
      </div>

      {!setup.hotels.length && (
        <div className="rp-empty">
          <h4>{r('settings.noHotelsTitle')}</h4>
          <p style={{ margin: '0 0 12px' }}>{r('settings.noHotelsText')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/hotels/list')}>{r('settings.goHotels')}</button>
        </div>
      )}

      {setup.hotels.map((h, hi) => {
        const connected = h.sources.length;
        const failing = h.sources.filter((s) => s.lastError).length;
        return (
          <div key={h.id} data-tour={hi === 0 ? 'rvs-hotel' : undefined} className="rp-conn">
            <div className="rp-conn-head" style={{ marginBottom: open === h.id ? 10 : 0, cursor: 'pointer' }} onClick={() => setOpen(open === h.id ? null : h.id)}>
              <h3>
                <Ic d={HTL_ICON.chev} size={14} style={{ transform: open === h.id ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                {h.name}
                {h.city && <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontSize: 12.5 }}>{h.city}</span>}
              </h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <span className={`rp-status ${failing ? 'err' : connected ? 'ok' : ''}`}>{r('settings.platformsCount', { n: connected, t: REP_PLATFORMS.length })}</span>
                <select className="rp-input" value={h.brandId || ''} onChange={(e) => wrap(setRepHotelBrand(h.id, e.target.value || null))}>
                  <option value="">{r('settings.noBrand')}</option>
                  {setup.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            {open === h.id && (
              <div className="bk-table-wrap">
                <table className="bk-table rp-src-table">
                  <thead><tr><th>{r('settings.colPlatform')}</th><th>{r('settings.colLink')}</th><th>{r('settings.colStatus')}</th><th /></tr></thead>
                  <tbody>
                    {REP_PLATFORMS.map((p) => (
                      <SourceRow key={p} hotelId={h.id} platform={p} source={h.sources.find((s) => s.platform === p)} googleConnected={settings.googleConnected} locations={locations} onChanged={reload} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

// ============================================================ Период отзывов

/** «Брать отзывы начиная с»: граница для выгрузки + удаление уже собранных старых отзывов по кнопке. */
const HistoryFromCard: React.FC<{ value: string | null; save: (b: any) => Promise<void> }> = ({ value, save }) => {
  const { r, lang } = useRepT();
  const { showAlert, showConfirm } = useAlertModal();
  const [date, setDate] = useState(value || '');
  const [older, setOlder] = useState<number | null>(null);
  useEffect(() => setDate(value || ''), [value]);
  useEffect(() => {
    if (!value) return setOlder(null);
    fetchRepOlderCount(value).then((x) => setOlder(x.count)).catch(() => setOlder(null));
  }, [value]);
  return (
    <div className="rp-conn">
      <div className="rp-conn-head">
        <h3>{r('history.title')}</h3>
        <span className={`rp-status ${value ? 'ok' : ''}`}>{value ? r('history.since', { d: fmtDate(value, lang) }) : r('history.all')}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 12px' }}>{r('history.text')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="rp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="btn btn-primary" disabled={date === (value || '')} onClick={() => save({ historyFrom: date || null }).then(() => showAlert(r('settings.saved'), { variant: 'success' })).catch((e) => showAlert(e.message, { variant: 'error' }))}>
          {r('settings.save')}
        </button>
        {value && <button type="button" className="btn" onClick={() => save({ historyFrom: null })}>{r('history.reset')}</button>}
      </div>
      {value && older ? (
        <div className="rp-note warn" style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>{r('history.olderFound', { n: older, d: fmtDate(value, lang) })}</span>
          <button type="button" className="btn btn-sm" onClick={async () => {
            if (!(await showConfirm(r('history.purgeConfirm', { n: older, d: fmtDate(value, lang) })))) return;
            try {
              const res = await purgeRepOlder(value);
              setOlder(0);
              showAlert(r('history.purged', { n: res.deleted }), { variant: 'success' });
            } catch (e: any) {
              showAlert(e?.message || r('card.error'), { variant: 'error' });
            }
          }}>{r('history.purge')}</button>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================ Подключения

const ConnectionsTab: React.FC<{ settings: RepSettings; setup: RepSetup; save: (b: any) => Promise<void>; reload: () => void }> = ({ settings, setup, save, reload }) => {
  const { r, lang } = useRepT();
  const backfill = useBackfill();
  const { showAlert, showConfirm } = useAlertModal();
  const cfg = settings.config;
  const [token, setToken] = useState('');
  const [topic, setTopic] = useState(cfg.google.pubsubTopic || '');
  const [accounts, setAccounts] = useState<Array<{ name: string; accountName: string }> | null>(null);
  const [actors, setActors] = useState(cfg.apifyActors);
  const [sched, setSched] = useState(cfg.schedule);
  const [hc, setHc] = useState(cfg.holidaycheck);
  const [busy, setBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number | null; limit: number | null; cycleEnd: string | null } | null>(null);

  useEffect(() => {
    if (settings.googleConnected) fetchRepGoogleAccounts().then(setAccounts).catch(() => setAccounts(null));
  }, [settings.googleConnected]);
  useEffect(() => {
    if (settings.apifyToken) fetchRepApifyUsage().then(setUsage).catch(() => setUsage(null));
  }, [settings.apifyToken]);

  const act = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
    } catch (e: any) {
      showAlert(e?.message || r('card.error'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <HistoryFromCard value={cfg.historyFrom} save={save} />
      <div className="rp-conn">
        <div className="rp-conn-head">
          <h3><PlatformBadge platform="google" compact /> Google Business Profile</h3>
          <span className={`rp-status ${settings.googleConnected ? 'ok' : ''}`}>
            {settings.googleConnected ? r('conn.connectedAs', { e: cfg.google.accountEmail || '—' }) : r('conn.notConnected')}
          </span>
        </div>
        <div className="rp-note warn" style={{ marginBottom: 12 }}>{r('conn.googleAccessNote')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {!settings.googleConnected ? (
            <button type="button" className="btn btn-primary" disabled={busy === 'g'} onClick={() => act('g', async () => { window.location.href = (await fetchRepGoogleAuthUrl()).url; })}>
              {r('conn.googleConnect')}
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => act('g', async () => { window.location.href = (await fetchRepGoogleAuthUrl()).url; })}>{r('conn.reconnect')}</button>
              <button type="button" className="btn" onClick={async () => (await showConfirm(r('conn.disconnectConfirm'))) && act('gd', () => disconnectRepGoogle().then(reload))}>{r('conn.disconnect')}</button>
            </>
          )}
        </div>
        {settings.googleConnected && (
          <div className="rp-set-grid">
            <label className="rp-field">
              <span>{r('conn.googleAccount')}</span>
              <select className="rp-input" value={cfg.google.accountName || ''} onChange={(e) => save({ google: { accountName: e.target.value || null } })}>
                <option value="">—</option>
                {accounts?.map((a) => <option key={a.name} value={a.name}>{a.accountName}</option>)}
              </select>
              {accounts === null && <small>{r('conn.accountsError')}</small>}
            </label>
            <label className="rp-field">
              <span>{r('conn.pubsubTopic')}</span>
              <input className="rp-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="projects/my-project/topics/gbp-reviews" />
              <small>{r('conn.pubsubHint')}</small>
            </label>
          </div>
        )}
        {settings.googleConnected && (
          <>
            <ol className="rp-steps">
              <li>{r('conn.step1')}</li>
              <li>{r('conn.step2')} <span className="rp-code">mybusiness-api-pubsub@system.gserviceaccount.com</span></li>
              <li>{r('conn.step3')} <span className="rp-code">{settings.pushEndpoint || '—'}</span></li>
              <li>{r('conn.step4')}</li>
            </ol>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" disabled={!topic || busy === 'n'} onClick={() => act('n', async () => { await save({ google: { pubsubTopic: topic } }); await setupRepGoogleNotifications(); reload(); }, r('conn.notifOk'))}>
                {r('conn.enableNotif')}
              </button>
              <span className={`rp-status ${cfg.google.notificationsOk ? 'ok' : cfg.google.notificationsError ? 'err' : ''}`}>
                {cfg.google.notificationsOk ? r('conn.notifOn') : cfg.google.notificationsError || r('conn.notifOff')}
              </span>
            </div>
            <div className="rp-src-meta" style={{ marginTop: 10 }}>{r('conn.googleNightly')}</div>
          </>
        )}
      </div>

      <div className="rp-conn">
        <div className="rp-conn-head">
          <h3>Apify</h3>
          <span className={`rp-status ${settings.apifyToken ? 'ok' : ''}`}>{settings.apifyToken ? r('conn.tokenSet', { k: settings.apifyToken }) : r('conn.tokenMissing')}</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 12px' }}>{r('conn.apifyText')}</p>
        {usage?.limit != null && usage.used != null && (
          <div className={`rp-note${usage.used >= usage.limit * 0.98 ? ' err' : usage.used >= usage.limit * 0.8 ? ' warn' : ''}`} style={{ marginBottom: 12 }}>
            <b>{r('conn.usage', { used: usage.used.toFixed(2), limit: usage.limit })}</b>{' '}
            {usage.cycleEnd && r('conn.usageCycle', { d: fmtDate(usage.cycleEnd, lang) })}{' '}
            {usage.used >= usage.limit * 0.98 && r('conn.usageOver')}
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,.08)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`, height: '100%', background: usage.used >= usage.limit * 0.8 ? '#cc2f47' : '#1f8a5e' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="rp-input" type="password" style={{ flex: '1 1 280px' }} value={token} onChange={(e) => setToken(e.target.value)} placeholder="apify_api_…" autoComplete="new-password" />
          <button type="button" className="btn" disabled={!token && !settings.apifyToken} onClick={() => act('v', async () => { const v = await verifyRepApify(token || undefined); showAlert(v.ok ? r('conn.apifyOk', { u: v.username || '—' }) : r('conn.tokenMissing'), { variant: v.ok ? 'success' : 'error' }); })}>
            {r('conn.verify')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!token} onClick={() => act('t', async () => { await save({ apifyToken: token }); setToken(''); }, r('settings.saved'))}>{r('settings.save')}</button>
          {settings.apifyToken && <button type="button" className="btn" onClick={async () => (await showConfirm(r('conn.tokenRemoveConfirm'))) && act('t', () => save({ apifyToken: null }))}>{r('conn.remove')}</button>}
        </div>

        <h4 style={{ fontSize: 13, margin: '6px 0 8px' }}>{r('conn.scheduleTitle')}</h4>
        <div className="rp-set-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <label className="rp-field"><span>{r('conn.maxConcurrent')}</span><input className="rp-input" type="number" min={1} value={sched.maxConcurrentRuns} onChange={(e) => setSched({ ...sched, maxConcurrentRuns: Number(e.target.value) })} /><small>{r('conn.maxConcurrentHint')}</small></label>
        </div>
        <div className="rp-toggle">
          <div><div>{r('conn.offSeason')}</div><div className="d">{r('conn.offSeasonHint')}</div></div>
          <button type="button" className={`rp-switch-btn${sched.offSeason ? ' on' : ''}`} onClick={() => setSched({ ...sched, offSeason: !sched.offSeason })} aria-pressed={sched.offSeason} />
        </div>

        <h4 style={{ fontSize: 13, margin: '16px 0 8px' }}>{r('conn.actorsTitle')}</h4>
        <div className="rp-src-meta" style={{ marginBottom: 10 }}>{r('conn.actorsHint', { u: '{{url}}', m: '{{max}}', s: '{{since}}' })}</div>
        {(['booking', 'tripadvisor', 'yandex', 'expedia', 'check24', 'otelpuan', 'holidaycheck', 'google'] as RepPlatform[]).map((p) => (
          <div key={p} style={{ padding: '10px 0', borderTop: '1px solid var(--line-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <PlatformBadge platform={p} />
              {p === 'google' && <span className="rp-src-meta">{r('conn.googleFallbackActor')}</span>}
              {p === 'holidaycheck' && <span className="rp-src-meta">{r('conn.hcReadActor')}</span>}
              {(() => {
                const n = setup.hotels.filter((h) => h.sources.some((x) => x.platform === p && x.url)).length;
                return n ? (
                  <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} title={r('backfill.hint')} onClick={() => backfill(p, n, { platform: p }, reload)}>
                    {r('backfill.all', { n })}
                  </button>
                ) : null;
              })()}
            </div>
            <div className="rp-set-grid">
              <label className="rp-field"><span>{r('conn.primary')}</span><input className="rp-input" value={actors[p]?.primary || ''} onChange={(e) => setActors({ ...actors, [p]: { ...actors[p], primary: e.target.value } })} /></label>
              <label className="rp-field"><span>{r('conn.fallback')}</span><input className="rp-input" value={actors[p]?.fallback || ''} placeholder={r('conn.fallbackPh')} onChange={(e) => setActors({ ...actors, [p]: { ...actors[p], fallback: e.target.value } })} /></label>
            </div>
            <div className="rp-set-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 8 }}>
              {(['everyHours', 'firstLoadMax', 'maxPerRun'] as const).map((f) => (
                <label key={f} className="rp-field">
                  <span>{r(`conn.lim.${f}`)}</span>
                  <input className="rp-input" type="number" min={1} value={actors[p]?.[f] ?? ''} onChange={(e) => setActors({ ...actors, [p]: { ...actors[p], [f]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <label className="rp-field" style={{ marginTop: 8 }}>
              <span>{r('conn.input')}</span>
              <textarea value={actors[p]?.input || ''} onChange={(e) => setActors({ ...actors, [p]: { ...actors[p], input: e.target.value } })} />
            </label>
          </div>
        ))}
        <div className="rp-save-bar">
          <button type="button" className="btn btn-primary" disabled={busy === 's'} onClick={() => act('s', () => save({ apifyActors: actors, schedule: sched }), r('settings.saved'))}>{r('settings.save')}</button>
        </div>
      </div>

      <div className="rp-conn">
        <div className="rp-conn-head">
          <h3><PlatformBadge platform="holidaycheck" compact /> HolidayCheck — {r('conn.hcReplies')}</h3>
          <span className={`rp-status ${hc.replyUrlTemplate ? 'ok' : 'warn'}`}>{hc.replyUrlTemplate ? r('conn.hcConfigured') : r('conn.hcNeedDocs')}</span>
        </div>
        <div className="rp-note" style={{ marginBottom: 12 }}>{r('conn.hcNote')}</div>
        <div className="rp-set-grid">
          <label className="rp-field" style={{ gridColumn: '1 / -1' }}>
            <span>{r('conn.hcUrl')}</span>
            <input className="rp-input" value={hc.replyUrlTemplate} onChange={(e) => setHc({ ...hc, replyUrlTemplate: e.target.value })} placeholder="https://…/reviews/{reviewId}/response" />
            <small>{r('conn.hcUrlHint')}</small>
          </label>
          <label className="rp-field"><span>{r('conn.hcMethod')}</span>
            <select className="rp-input" value={hc.method} onChange={(e) => setHc({ ...hc, method: e.target.value as any })}><option>POST</option><option>PUT</option></select>
          </label>
          <label className="rp-field"><span>{r('conn.hcBodyField')}</span><input className="rp-input" value={hc.bodyField} onChange={(e) => setHc({ ...hc, bodyField: e.target.value })} /></label>
          <label className="rp-field"><span>{r('conn.hcAuthHeader')}</span><input className="rp-input" value={hc.authHeader} onChange={(e) => setHc({ ...hc, authHeader: e.target.value })} /></label>
          <label className="rp-field"><span>{r('conn.hcAuthPrefix')}</span><input className="rp-input" value={hc.authPrefix} onChange={(e) => setHc({ ...hc, authPrefix: e.target.value })} /></label>
        </div>
        <div className="rp-save-bar">
          <button type="button" className="btn btn-primary" onClick={() => act('hc', () => save({ holidaycheck: hc }), r('settings.saved'))}>{r('settings.save')}</button>
        </div>
      </div>
    </>
  );
};

// ============================================================ Алерты и получатели

const RecipientEditor: React.FC<{ label: string; value: RepRecipients; tgOptions: Array<{ id: string; name: string }>; onChange: (v: RepRecipients) => void }> = ({ label, value, tgOptions, onChange }) => {
  const { r } = useRepT();
  const [emails, setEmails] = useState(value.emails.join(', '));
  useEffect(() => setEmails(value.emails.join(', ')), [value.emails]);
  return (
    <div className="rp-recip">
      <b>{label}</b>
      <label className="rp-field">
        <span>Email</span>
        <input className="rp-input" value={emails} onChange={(e) => setEmails(e.target.value)} onBlur={() => onChange({ ...value, emails: emails.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean) })} placeholder="manager@hotel.com, …" />
      </label>
      <div className="rp-field">
        <span>Telegram</span>
        {tgOptions.length ? (
          <div className="rp-checks">
            {tgOptions.map((o) => {
              const on = value.telegram.includes(o.id);
              return (
                <span key={o.id} className={`rp-chip${on ? ' on' : ''}`} onClick={() => onChange({ ...value, telegram: on ? value.telegram.filter((x) => x !== o.id) : [...value.telegram, o.id] })}>{o.name}</span>
              );
            })}
          </div>
        ) : <small>{r('alerts.noTgRecipients')}</small>}
      </div>
    </div>
  );
};

const AlertsTab: React.FC<{ settings: RepSettings; setup: RepSetup; save: (b: any) => Promise<void> }> = ({ settings, setup, save }) => {
  const { r } = useRepT();
  const { showAlert } = useAlertModal();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<RepConfig>(settings.config);
  useEffect(() => setCfg(settings.config), [settings.config]);
  const bot = settings.telegramBots.find((b) => b.id === cfg.telegramBotId);
  const tgOptions = bot?.recipients || [];
  const th = cfg.thresholds;
  const setTh = (k: keyof RepConfig['thresholds'], v: number) => setCfg({ ...cfg, thresholds: { ...th, [k]: v } });
  const num = (k: keyof RepConfig['thresholds'], step = 1) => (
    <input className="rp-input" type="number" step={step} style={{ width: 80 }} value={th[k]} onChange={(e) => setTh(k, Number(e.target.value))} />
  );
  const rec = (scope: 'brands' | 'hotels', id: string) => cfg.recipients[scope][id] || emptyRec();
  const setRec = (scope: 'brands' | 'hotels' | 'developer', id: string | null, v: RepRecipients) =>
    setCfg({
      ...cfg,
      recipients: scope === 'developer' ? { ...cfg.recipients, developer: v } : { ...cfg.recipients, [scope]: { ...cfg.recipients[scope], [id!]: v } },
    });

  const rows: Array<{ k: RepAlertKind; extra?: React.ReactNode }> = [
    { k: 'negative', extra: <>{r('alerts.below')} {num('negativeBelow', 0.5)} / 10</> },
    { k: 'no_reply', extra: <>{num('noReplyHours')} {r('alerts.hours')}</> },
    { k: 'rating_lowered' },
    { k: 'avg_drop', extra: <>{r('alerts.by')} {num('ratingDropPoints', 0.1)}</> },
    { k: 'topic_spike', extra: <>{num('topicRepeatCount')} {r('alerts.timesIn')} {num('topicRepeatDays')} {r('alerts.days')}</> },
    { k: 'sync_problem', extra: <>{r('alerts.stale')} {num('staleDays')} {r('alerts.days')}, {r('alerts.drift')} {num('countDriftPct', 0.5)}%</> },
  ];

  return (
    <>
      <TenantMailNotice style={{ marginBottom: 12 }} />
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('alerts.rulesTitle')}</h3><div className="sub">{r('alerts.rulesSub')}</div></div></div>
        {rows.map(({ k, extra }) => (
          <div key={k} className="rp-toggle">
            <div style={{ flex: 1 }}>
              <div>{r(`alerts.kind.${k}.title`)}</div>
              <div className="d">{r(`alerts.kind.${k}.who`)}</div>
              {extra && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--fg-2)', flexWrap: 'wrap' }}>{extra}</div>}
            </div>
            <button type="button" className={`rp-switch-btn${cfg.alerts[k] ? ' on' : ''}`} aria-pressed={cfg.alerts[k]} onClick={() => setCfg({ ...cfg, alerts: { ...cfg.alerts, [k]: !cfg.alerts[k] } })} />
          </div>
        ))}
      </div>

      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('alerts.tgTitle')}</h3><div className="sub">{r('alerts.tgSub')}</div></div></div>
        {settings.telegramBots.length ? (
          <select className="rp-input" value={cfg.telegramBotId || ''} onChange={(e) => setCfg({ ...cfg, telegramBotId: e.target.value || null })}>
            <option value="">{r('alerts.noBot')}</option>
            {settings.telegramBots.map((b) => <option key={b.id} value={b.id}>{b.name} · {r('alerts.recipientsN', { n: b.recipients.length })}</option>)}
          </select>
        ) : (
          <div className="rp-note">{r('alerts.noBots')} <a href="#" onClick={(e) => { e.preventDefault(); navigate('/telegram'); }}>{r('alerts.openTelegram')}</a></div>
        )}
      </div>

      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('alerts.recipientsTitle')}</h3><div className="sub">{r('alerts.recipientsSub')}</div></div></div>
        <RecipientEditor label={r('alerts.developer')} value={cfg.recipients.developer} tgOptions={tgOptions} onChange={(v) => setRec('developer', null, v)} />
        {setup.brands.map((b) => (
          <RecipientEditor key={b.id} label={`${r('alerts.brandMarketing')} · ${b.name}`} value={rec('brands', b.id)} tgOptions={tgOptions} onChange={(v) => setRec('brands', b.id, v)} />
        ))}
        {setup.hotels.map((h) => (
          <RecipientEditor key={h.id} label={`${r('alerts.hotelManager')} · ${h.name}`} value={rec('hotels', h.id)} tgOptions={tgOptions} onChange={(v) => setRec('hotels', h.id, v)} />
        ))}
      </div>
      <div className="rp-save-bar">
        <button type="button" className="btn btn-primary" onClick={() => save({ thresholds: cfg.thresholds, alerts: cfg.alerts, telegramBotId: cfg.telegramBotId, recipients: cfg.recipients }).then(() => showAlert(r('settings.saved'), { variant: 'success' })).catch((e) => showAlert(e.message, { variant: 'error' }))}>
          {r('settings.save')}
        </button>
      </div>
    </>
  );
};

// ============================================================ ИИ и темы

/** Связь отзывов с бронями модуля «Отели» — только если у клиента включены брони. */
const StaysMatch: React.FC = () => {
  const { r } = useRepT();
  const { showAlert } = useAlertModal();
  const { isEnabled } = useTenantComponents();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ checked: number; auto: number; suggested: number } | null>(null);
  if (!isEnabled('hotels') || !isEnabled('hotels_reservations')) return null;
  return (
    <div className="ha-section">
      <div className="ha-section-head"><div><h3>{r('stay.settingsTitle')}</h3><div className="sub">{r('stay.settingsSub')}</div></div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await matchRepStays());
            } catch (e: any) {
              showAlert(e?.message || r('card.error'), { variant: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? r('dup.scanning') : r('stay.matchRun')}
        </button>
        {res && <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{r('stay.matchResult', { checked: res.checked, auto: res.auto, suggested: res.suggested })}</span>}
      </div>
    </div>
  );
};

/** Поиск дубликатов по всей истории (новые отзывы проверяются сами при сборе). */
const DuplicatesScan: React.FC = () => {
  const { r } = useRepT();
  const { showAlert } = useAlertModal();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ checked: number; found: number; suggested: number } | null>(null);
  return (
    <div className="ha-section">
      <div className="ha-section-head"><div><h3>{r('dup.settingsTitle')}</h3><div className="sub">{r('dup.settingsSub')}</div></div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await scanRepDuplicates());
            } catch (e: any) {
              showAlert(e?.message || r('card.error'), { variant: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? r('dup.scanning') : r('dup.scan')}
        </button>
        {res && <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{r('dup.scanResult', { checked: res.checked, found: res.found, suggested: res.suggested })}</span>}
        {res && res.suggested > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => navigate('/hotels/reviews?dup=suggested')}>{r('dup.review')} →</button>
        )}
      </div>
    </div>
  );
};

const AiTab: React.FC<{ settings: RepSettings; setup: RepSetup; save: (b: any) => Promise<void> }> = ({ settings, setup, save }) => {
  const { r, lang } = useRepT();
  const { showAlert } = useAlertModal();
  const [cfg, setCfg] = useState<RepConfig>(settings.config);
  const [newTopic, setNewTopic] = useState('');
  const [translatingTopic, setTranslatingTopic] = useState(false);
  useEffect(() => setCfg(settings.config), [settings.config]);
  const topicLocale = lang.startsWith('tr') ? 'tr' : lang.startsWith('en') ? 'en' : 'ru';
  const disabledTopics = cfg.topicsDisabled || [];
  // удалённые темы: история их отметок цела, вернуть можно в один клик (сохраняется кнопкой «Сохранить»)
  const removedCustom = [...(cfg.topicsArchive || []), ...settings.config.topicsExtra]
    .filter((x, i, all) => !cfg.topicsExtra.some((y) => y.key === x.key) && all.findIndex((y) => y.key === x.key) === i);
  const restoreCustom = (x: RepConfig['topicsExtra'][number]) => setCfg({ ...cfg, topicsExtra: [...cfg.topicsExtra, x] });
  const addTopic = async () => {
    const label = newTopic.trim();
    if (!label || translatingTopic) return;
    // такая тема уже была и удалена — возвращаем её вместе с историей, а не заводим новую
    const lower = label.toLocaleLowerCase();
    const archived = removedCustom.find((x) => [x.label, x.translations?.ru, x.translations?.en, x.translations?.tr].some((v) => v?.toLocaleLowerCase() === lower));
    if (archived) {
      restoreCustom(archived);
      setNewTopic('');
      return;
    }
    setTranslatingTopic(true);
    try {
      const translations = await translateRepTopic(label);
      const base = `x_${label.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_').replace(/[а-яё]/gi, (c) => c.charCodeAt(0).toString(36))}`.slice(0, 38);
      const existing = new Set([
        ...TOPIC_KEYS,
        ...cfg.topicsExtra.map((topic) => topic.key),
      ]);
      let key = base;
      let suffix = 2;
      while (existing.has(key) || key === 'other') {
        const suffixText = `_${suffix++}`;
        key = `${base.slice(0, 38 - suffixText.length)}${suffixText}`;
      }
      setCfg({
        ...cfg,
        topicsExtra: [...cfg.topicsExtra, { key, label: translations.ru, translations }],
      });
      setNewTopic('');
    } catch (e: any) {
      showAlert(e?.message || r('ai.topicTranslateError'), { variant: 'error' });
    } finally {
      setTranslatingTopic(false);
    }
  };
  return (
    <>
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('ai.translateTitle')}</h3><div className="sub">{r('ai.translateSub')}</div></div></div>
        <div className="hotel-select-tabs" style={{ display: 'inline-flex' }}>
          {(['ru', 'en'] as const).map((l) => <div key={l} className={`hotel-select-tab${cfg.translateTo === l ? ' active' : ''}`} onClick={() => setCfg({ ...cfg, translateTo: l })}>{r(`ai.lang.${l}`)}</div>)}
        </div>
      </div>
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('ai.topicsTitle')}</h3><div className="sub">{r('ai.topicsSub')}</div></div></div>
        <div className="rp-topics" style={{ marginTop: 0, marginBottom: 12 }}>
          {TOPIC_KEYS.filter((key) => !disabledTopics.includes(key)).map((key) => (
            <span key={key} className="rp-topic" title={`RU: ${r(`topics.${key}`, { lng: 'ru' })} · TR: ${r(`topics.${key}`, { lng: 'tr' })} · EN: ${r(`topics.${key}`, { lng: 'en' })}`}>
              {r(`topics.${key}`)}
              <button type="button" aria-label={`${r('ai.removeTopic')}: ${r(`topics.${key}`)}`} style={{ background: 'none', border: 0, color: 'inherit', padding: 0, marginLeft: 4, cursor: 'pointer', font: 'inherit' }} onClick={() => setCfg({ ...cfg, topicsDisabled: [...disabledTopics, key] })}>×</button>
            </span>
          ))}
          {cfg.topicsExtra.map((x) => (
            <span key={x.key} className="rp-topic positive">
              <span title={`RU: ${x.translations?.ru || x.label} · TR: ${x.translations?.tr || x.label} · EN: ${x.translations?.en || x.label}`}>
                {x.translations?.[topicLocale] || x.label}
              </span>
              <button type="button" aria-label={`${r('ai.removeTopic')}: ${x.label}`} style={{ background: 'none', border: 0, color: 'inherit', padding: 0, marginLeft: 4, cursor: 'pointer', font: 'inherit' }} onClick={() => setCfg({ ...cfg, topicsExtra: cfg.topicsExtra.filter((y) => y.key !== x.key) })}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="rp-input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder={r('ai.topicPh')} />
          <button type="button" className="btn btn-sm" disabled={!newTopic.trim() || translatingTopic} onClick={() => void addTopic()}>
            <Ic d={HTL_ICON.plus} size={12} />{translatingTopic ? r('ai.translatingTopic') : r('ai.addTopic')}
          </button>
        </div>
        {(disabledTopics.length > 0 || removedCustom.length > 0) && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}>{r('ai.removedTitle')}</div>
            <div className="rp-topics" style={{ marginTop: 0 }}>
              {disabledTopics.map((key) => (
                <span key={key} className="rp-topic" style={{ opacity: 0.7 }}>
                  <s>{r(`topics.${key}`)}</s>
                  <button type="button" style={{ background: 'none', border: 0, color: 'var(--ink)', padding: 0, marginLeft: 6, cursor: 'pointer', font: 'inherit', fontWeight: 600 }} onClick={() => setCfg({ ...cfg, topicsDisabled: disabledTopics.filter((k) => k !== key) })}>
                    ↺ {r('ai.restoreTopic')}
                  </button>
                </span>
              ))}
              {removedCustom.map((x) => (
                <span key={x.key} className="rp-topic" style={{ opacity: 0.7 }}>
                  <s>{x.translations?.[topicLocale] || x.label}</s>
                  <button type="button" style={{ background: 'none', border: 0, color: 'var(--ink)', padding: 0, marginLeft: 6, cursor: 'pointer', font: 'inherit', fontWeight: 600 }} onClick={() => restoreCustom(x)}>
                    ↺ {r('ai.restoreTopic')}
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="rp-src-meta" style={{ marginTop: 10 }}>{r('ai.topicsNote')}</div>
      </div>
      <DuplicatesScan />
      <StaysMatch />
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('ai.signTitle')}</h3><div className="sub">{r('ai.signSub')}</div></div></div>
        <div className="rp-set-grid">
          {setup.hotels.map((h) => (
            <label key={h.id} className="rp-field">
              <span>{h.name}</span>
              <input className="rp-input" value={cfg.signatures[h.id] ?? ''} placeholder={r('ai.signPh', { n: h.name })} onChange={(e) => setCfg({ ...cfg, signatures: { ...cfg.signatures, [h.id]: e.target.value } })} />
            </label>
          ))}
        </div>
      </div>
      <div className="ha-section">
        <div className="rp-toggle">
          <div><div>{r('ai.monthly')}</div><div className="d">{r('ai.monthlySub')}</div></div>
          <button type="button" className={`rp-switch-btn${cfg.monthlyReport.enabled ? ' on' : ''}`} onClick={() => setCfg({ ...cfg, monthlyReport: { enabled: !cfg.monthlyReport.enabled } })} />
        </div>
      </div>
      <div className="rp-save-bar">
        <button type="button" className="btn btn-primary" onClick={() => save({ translateTo: cfg.translateTo, topicsExtra: cfg.topicsExtra, topicsDisabled: disabledTopics, signatures: cfg.signatures, monthlyReport: cfg.monthlyReport }).then(() => showAlert(r('settings.saved'), { variant: 'success' })).catch((e) => showAlert(e.message, { variant: 'error' }))}>
          {r('settings.save')}
        </button>
      </div>
    </>
  );
};

// ============================================================ Журнал

const LogTab: React.FC<{ setup: RepSetup }> = ({ setup }) => {
  const { r, lang } = useRepT();
  const [runs, setRuns] = useState<RepRun[] | null>(null);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof fetchRepAlerts>> | null>(null);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRepRun>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [, tick] = useState(0);
  const load = () => {
    setLoading(true);
    Promise.all([
      fetchRepRuns(status ? { status } : {}).then(setRuns).catch(() => setRuns([])),
      fetchRepAlerts().then(setAlerts).catch(() => setAlerts([])),
    ]).finally(() => {
      setLoading(false);
      setLoadedAt(new Date());
    });
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  // пока есть идущие запуски — сами обновляемся раз в 15 секунд
  const anyRunning = !!runs?.some((x) => x.status === 'running');
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => {
      load();
      tick((n) => n + 1);
    }, 15_000);
    return () => clearInterval(id);
  }, [anyRunning, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const elapsed = (iso: string) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    return m < 60 ? r('log.minutes', { n: m }) : r('log.hours', { n: Math.round(m / 6) / 10 });
  };
  const hotel = (id: string | null) => setup.hotels.find((h) => h.id === id)?.name || '—';
  return (
    <>
      <div className="ha-section">
        <div className="ha-section-head">
          <div><h3>{r('log.runsTitle')}</h3><div className="sub">{r('log.runsSub')}</div></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="rp-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{r('log.all')}</option><option value="running">{r('log.running')}</option><option value="ok">OK</option><option value="error">{r('log.errors')}</option>
            </select>
            {loadedAt && (
              <span className="rp-src-meta" style={{ alignSelf: 'center' }}>
                {r('log.updatedAt', { t: loadedAt.toLocaleTimeString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU') })}
                {anyRunning ? ` · ${r('log.auto')}` : ''}
              </span>
            )}
            <button type="button" className="btn btn-sm" disabled={loading} onClick={load}>{loading ? r('log.refreshing') : r('log.refresh')}</button>
          </div>
        </div>
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{r('log.started')}</th><th>{r('settings.colPlatform')}</th><th>{r('dash.col.hotel')}</th><th>{r('log.trigger')}</th><th>{r('settings.colStatus')}</th><th>{r('log.fetched')}</th><th>{r('log.new')}</th><th>{r('log.updated')}</th><th /></tr></thead>
            <tbody>
              {runs?.map((x) => (
                <tr key={x.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.startedAt, lang, true)}</td>
                  <td><PlatformBadge platform={x.platform} compact /> <span className="rp-src-meta">{x.actorId}</span></td>
                  <td>{hotel(x.hotelId)}</td>
                  <td>{r(`log.triggers.${x.trigger}`)}</td>
                  <td>
                    <span className={`rp-status ${x.status === 'ok' ? 'ok' : x.status === 'error' ? 'err' : 'warn'}`}>{x.status === 'running' ? `${r('log.running')} · ${elapsed(x.startedAt)}` : x.status === 'ok' ? 'OK' : r('log.error')}</span>
                    {x.errorText && <div className="rp-src-meta err" title={x.errorText}>{x.errorText.slice(0, 140)}</div>}
                  </td>
                  <td>{x.fetched}</td><td>{x.new}</td><td>{x.updated}</td>
                  <td>{x.trigger === 'test' && x.status === 'ok' && <button type="button" className="btn btn-sm" onClick={() => previewRepRun(x.id).then(setPreview)}>{r('log.preview')}</button>}</td>
                </tr>
              ))}
              {runs && !runs.length && <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{r('log.empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ha-section">
        <div className="ha-section-head"><div><h3>{r('log.alertsTitle')}</h3><div className="sub">{r('log.alertsSub')}</div></div></div>
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead><tr><th>{r('log.sent')}</th><th>{r('log.event')}</th><th>{r('log.channels')}</th></tr></thead>
            <tbody>
              {alerts?.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.sentAt, lang, true)}</td>
                  <td><b>{a.title}</b><div className="rp-src-meta" style={{ whiteSpace: 'pre-line' }}>{(a.body || '').slice(0, 220)}</div></td>
                  <td className="rp-src-meta">{a.channels ? Object.entries(a.channels).filter(([, n]) => n).map(([c, n]) => `${c}: ${n}`).join(', ') || r('log.noChannels') : '…'}</td>
                </tr>
              ))}
              {alerts && !alerts.length && <tr><td colSpan={3} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{r('log.noAlerts')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {preview && (
        <>
          <div className="bk-drawer-back lv-backdrop" onClick={() => setPreview(null)} />
          <aside className="bk-drawer rp-drawer lv-sheet-right">
            <div className="bk-drawer-head">
              <div><div className="kicker"><span className="dot" />{r('log.preview')}</div><h3>{r('log.previewTitle', { n: preview.run.fetched })}</h3></div>
              <button type="button" onClick={() => setPreview(null)}><Ic d={HTL_ICON.x} size={18} /></button>
            </div>
            <div className="bk-drawer-body">
              <div className="rp-note" style={{ marginBottom: 12 }}>{r('log.previewHint')}{preview.costUsd != null ? ` · $${preview.costUsd.toFixed(3)}` : ''}</div>
              {preview.items.map((it, i) => (
                <div key={i} className="rp-reply-item">
                  <div className="h"><span>{it.parsed ? `${it.parsed.author || '—'} · ${it.parsed.ratingRaw ?? '—'}/${it.parsed.ratingScale} · ${it.parsed.lang || '?'}` : r('log.notParsed')}</span><span>{it.parsed?.publishedAt ? fmtDate(it.parsed.publishedAt, lang) : ''}</span></div>
                  {(it.parsed?.textOriginal || '').slice(0, 300)}
                  <details style={{ marginTop: 6 }}><summary style={{ fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer' }}>JSON</summary><pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(it.raw, null, 1).slice(0, 3000)}</pre></details>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

// ============================================================ страница

export const ReviewsSettingsPage: React.FC = () => {
  const { r } = useRepT();
  const { showAlert } = useAlertModal();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'hotels';
  const [settings, setSettings] = useState<RepSettings | null>(null);
  const [setup, setSetup] = useState<RepSetup | null>(null);

  const reload = () => {
    fetchRepSettings().then(setSettings).catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchRepSetup().then(setSetup).catch((e) => showAlert(e.message, { variant: 'error' }));
  };
  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  // возврат из Google OAuth
  useEffect(() => {
    const g = params.get('google');
    if (!g) return;
    showAlert(g === 'connected' ? r('conn.googleConnected') : r('conn.googleError', { e: params.get('reason') || '' }), { variant: g === 'connected' ? 'success' : 'error' });
    const p = new URLSearchParams(params);
    p.delete('google');
    p.delete('reason');
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (body: any) => {
    const s = await updateRepSettings(body);
    setSettings(s);
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReviewsSettings" />
      <div className="px-scope">
        <HotelsSubnav active="reviews" />
        <div className="rv">
          <RvHead title={r('settings.title')} sub={r('settings.subtitle')} />
          <RvTabs active="settings" />
          <ApifyPauseBanner pause={settings?.config.apifyPause} />
          <div className="rv-view rv-set">
            <nav data-tour="rvs-tabs" className="rv-set-nav" aria-label={r('settings.title')}>
              {TABS.map((t, i) => (
                <button key={t} type="button" className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setParams({ tab: t }, { replace: true })}>
                  <span className="no">{String(i + 1).padStart(2, '0')}</span>
                  {r(`settings.tabs.${t}`)}
                </button>
              ))}
            </nav>
            <div key={tab} className="rv-set-body" style={{ minWidth: 0, animation: 'rvIn .4s cubic-bezier(.2,.8,.2,1) both' }}>
              {!settings || !setup ? (
                <div className="rv-empty-s">{r('card.loading')}</div>
              ) : tab === 'hotels' ? (
                <HotelsTab setup={setup} settings={settings} reload={reload} />
              ) : tab === 'connections' ? (
                <ConnectionsTab key={settings.config.google.accountName || 'x'} settings={settings} setup={setup} save={save} reload={reload} />
              ) : tab === 'competitors' ? (
                <CompetitorsTab settings={settings} setup={setup} save={save} />
              ) : tab === 'alerts' ? (
                <AlertsTab settings={settings} setup={setup} save={save} />
              ) : tab === 'ai' ? (
                <AiTab settings={settings} setup={setup} save={save} />
              ) : (
                <LogTab setup={setup} />
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ReviewsSettingsPage;
