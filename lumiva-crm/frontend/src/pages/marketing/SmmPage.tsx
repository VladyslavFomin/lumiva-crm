// Редизайн по мокапу Claude Design (marketing-smm.html / components/smm-page.jsx) —
// структура портирована 1:1, данные реальные (см. backend smm.service.ts: профили, статистика,
// интеграции Meta / ВКонтакте). Мобильная вёрстка — сверх мокапа: таблица профилей превращается
// в карточки, панель интеграций открывается на всю ширину.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchSmmProfiles,
  fetchSmmStats,
  fetchSmmIntegrations,
  createSmmProfile,
  deleteSmmProfile,
  updateSmmProfile,
  fetchMetaAssets,
  getMetaAuthUrl,
  connectMetaProfile,
  syncMetaNow,
  fetchVkAssets,
  getVkAuthUrl,
  connectVkGroup,
  syncVkNow,
  type SmmProfile,
  type SmmPlatform,
  type SmmStatRow,
  type SmmStatsResponse,
  type SmmIntegrationsStatus,
} from '../../api/smm';
import { getLocale } from '../../i18n/utils';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './smm-design.css';

type Preset = '7d' | '30d' | '90d' | 'custom';
type MetricKey = 'followers' | 'reach' | 'likes' | 'comments' | 'videoViews';
type MetaAssets = Awaited<ReturnType<typeof fetchMetaAssets>>;
type VkAssets = Awaited<ReturnType<typeof fetchVkAssets>>;

const M = {
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v6" />
      <path d="M15 3v6" />
      <rect x="6" y="9" width="12" height="6" rx="1.5" />
      <path d="M12 15v4" />
      <path d="M9 19h6" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
  up: (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  dn: (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M6 18L18 6" />
    </>
  ),
};

/** Цвет и аббревиатура платформы (из мокапа). */
const PL: Record<SmmPlatform, { c: string; s: string }> = {
  instagram: { c: '#C13584', s: 'IG' },
  facebook: { c: '#0866FF', s: 'FB' },
  vk: { c: '#0077FF', s: 'VK' },
  telegram: { c: '#229ED9', s: 'TG' },
  tiktok: { c: '#1f1f1f', s: 'TT' },
  other: { c: '#888888', s: '—' },
};
const PL_ORDER: SmmPlatform[] = ['instagram', 'facebook', 'vk', 'telegram', 'tiktok', 'other'];
const METRIC_KEYS: MetricKey[] = ['followers', 'reach', 'likes', 'comments', 'videoViews'];
const METRIC_MODE: Record<MetricKey, 'level' | 'sum'> = { followers: 'level', reach: 'sum', likes: 'sum', comments: 'sum', videoViews: 'sum' };
/** Через сколько дней без свежих данных подключённый профиль считается «застывшим». */
const STALE_AFTER_DAYS = 3;

const dayMs = 864e5;
const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dm = (s: string) => {
  const [, m, d] = s.split('-');
  return `${d}.${m}`;
};
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const rangeDays = (from: string, to: string) => Math.max(1, Math.round((parseDay(to) - parseDay(from)) / dayMs) + 1);
const sortRows = (rows: SmmStatRow[]) => [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/** Стата по профилям: строки по дате (ASC) для каждого profileId. */
const byProfile = (resp: SmmStatsResponse | null) => {
  const m = new Map<string, SmmStatRow[]>();
  sortRows(resp?.items || []).forEach((r) => {
    if (!m.has(r.profileId)) m.set(r.profileId, []);
    m.get(r.profileId)!.push(r);
  });
  return m;
};

const totalsOf = (map: Map<string, SmmStatRow[]>) => {
  let followers = 0;
  let delta = 0;
  let reach = 0;
  let likes = 0;
  let comments = 0;
  let videoViews = 0;
  map.forEach((rows) => {
    followers += rows[rows.length - 1].followers;
    delta += rows[rows.length - 1].followers - rows[0].followers;
    rows.forEach((r) => {
      reach += r.reach;
      likes += r.likes;
      comments += r.comments;
      videoViews += r.videoViews;
    });
  });
  return { followers, delta, reach, likes, comments, videoViews, er: reach ? ((likes + comments) / reach) * 100 : 0 };
};

/* ── линии по платформам ── */
const Trend: React.FC<{
  dates: string[];
  series: Partial<Record<SmmPlatform, number[]>>;
  prevSeries: Partial<Record<SmmPlatform, Array<number | null>>>;
  metric: MetricKey;
  hidden: SmmPlatform[];
  onToggle: (p: SmmPlatform) => void;
  platformName: (p: SmmPlatform) => string;
  fmt: (n: number) => string;
  dayTip: string;
  prevHint: string;
}> = ({ dates, series, prevSeries, metric, hidden, onToggle, platformName, fmt, dayTip, prevHint }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [w, setW] = useState(720);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setHover(null), [metric]);

  const H = w < 520 ? 210 : 260;
  const PLx = w < 520 ? 40 : 52;
  const PR = 14;
  const PT = 18;
  const PB = 32;
  const all = Object.keys(series) as SmmPlatform[];
  const keys = all.filter((k) => !hidden.includes(k));
  const flat = keys
    .flatMap((k) => series[k] || [])
    .concat(keys.flatMap((k) => (prevSeries[k] || []).filter((v): v is number => v != null)));
  let max = Math.max(...flat, 1);
  const min = Math.min(...flat, 0);
  max += (max - min) * 0.14 || 1;
  const rg = max - min || 1;
  const last = Math.max(1, dates.length - 1);
  const X = (i: number) => PLx + (i * (w - PLx - PR)) / last;
  const Y = (v: number) => PT + (1 - (v - min) / rg) * (H - PT - PB);
  const path = (arr: Array<number | null>) => {
    let out = '';
    let pen = false;
    arr.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      out += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
      pen = true;
    });
    return out;
  };
  const ticks = [0, 0.5, 1].map((t) => min + rg * t);
  const xi = [0, Math.round((dates.length - 1) / 2), dates.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - b.left - PLx) / (w - PLx - PR)) * last);
    setHover(clamp(i, 0, dates.length - 1));
  };
  const tipTop = hover === null || !keys.length ? 0 : Math.min(...keys.map((k) => Y((series[k] || [])[hover] ?? 0)));

  return (
    <>
      <div className="sm-chart" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${w} ${H}`}
          width={w}
          height={H}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null);
          }}
        >
          {ticks.map((tk, i) => (
            <g key={i}>
              <line x1={PLx} x2={w - PR} y1={Y(tk)} y2={Y(tk)} stroke={i === 0 ? 'var(--line-2)' : 'var(--line-3)'} />
              <text x={PLx - 8} y={Y(tk) + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--ff-mono)" fill="var(--fg-4)">
                {tk >= 1000 ? `${Math.round(tk / 100) / 10}k` : Math.round(tk)}
              </text>
            </g>
          ))}
          {keys.map((k) =>
            prevSeries[k]?.some((v) => v != null) ? (
              <path key={`p${k}`} d={path(prevSeries[k] as Array<number | null>)} fill="none" stroke={PL[k].c} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.4" />
            ) : null,
          )}
          {keys.map((k) => (
            <path key={k} d={path(series[k] || [])} fill="none" stroke={PL[k].c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {xi.map((i, n) => (
            <text
              key={`${i}-${n}`}
              x={X(i)}
              y={H - 11}
              textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
              fontSize="10"
              fontFamily="var(--ff-mono)"
              fill="var(--fg-4)"
            >
              {dm(dates[i])}
            </text>
          ))}
          {hover !== null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={PT - 4} y2={H - PB} stroke="var(--line-2)" />
              {keys.map((k) => (
                <circle key={k} cx={X(hover)} cy={Y((series[k] || [])[hover] ?? 0)} r="3.4" fill={PL[k].c} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && keys.length > 0 && (
          <div className="sm-tip" style={{ left: clamp(X(hover), 78, w - 78), top: Math.max(tipTop - 6, 60) }}>
            <div className="dt">
              {dm(dates[hover])}
              {METRIC_MODE[metric] === 'sum' ? dayTip : ''}
            </div>
            {keys.map((k) => (
              <div className="rw" key={k}>
                <i style={{ background: PL[k].c }} />
                <span>{platformName(k)}</span>
                <b>{fmt((series[k] || [])[hover] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sm-legend">
        {all.map((k) => (
          <button
            key={k}
            type="button"
            className={cl(hidden.includes(k) ? 'off' : 'on')}
            style={{ color: hidden.includes(k) ? 'var(--fg-3)' : PL[k].c }}
            onClick={() => onToggle(k)}
          >
            <i />
            {platformName(k)}
          </button>
        ))}
        <span className="hint">{prevHint}</span>
      </div>
    </>
  );
};

export const SmmPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showConfirm } = useAlertModal();
  const locale = getLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const [preset, setPreset] = useState<Preset>('30d');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [profiles, setProfiles] = useState<SmmProfile[]>([]);
  const [stats, setStats] = useState<SmmStatsResponse | null>(null);
  const [prevStats, setPrevStats] = useState<SmmStatsResponse | null>(null);
  const [integrations, setIntegrations] = useState<SmmIntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('followers');
  const [hidden, setHidden] = useState<SmmPlatform[]>([]);
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState<SmmPlatform | 'all'>('all');
  const [limit, setLimit] = useState(20);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [adding, setAdding] = useState<{ platform: SmmPlatform; handle: string; url: string }>({ platform: 'instagram', handle: '', url: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const nf = (n: number) => Math.round(n).toLocaleString(locale);
  const pf = (n: number) => `${n.toFixed(2)}%`;
  const platformName = (p: SmmPlatform) => t(`crm.marketingSmm.platforms.${p}`);
  const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

  /* ── период ── */
  const applyPreset = (p: Exclude<Preset, 'custom'>) => {
    const n = Number(p.replace('d', ''));
    const now = new Date();
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const next = { from: isoDay(end - (n - 1) * dayMs), to: isoDay(end) };
    setPreset(p);
    setDraft(next);
    setRange(next);
  };
  useEffect(() => {
    applyPreset('30d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = range.from && range.to ? rangeDays(range.from, range.to) : 30;

  /* ── загрузка ── */
  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await fetchSmmProfiles());
    } catch (e) {
      console.error(e);
      setError(errMsg(e, t('crm.marketingSmm.errors.profiles')));
    }
  }, [t]);

  const loadIntegrations = useCallback(async () => {
    try {
      setIntegrations(await fetchSmmIntegrations());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!range.from || !range.to) return;
    setLoading(true);
    const n = rangeDays(range.from, range.to);
    const prevTo = isoDay(parseDay(range.from) - dayMs);
    const prevFrom = isoDay(parseDay(range.from) - n * dayMs);
    const [cur, prev] = await Promise.allSettled([
      fetchSmmStats({ from: range.from, to: range.to }),
      fetchSmmStats({ from: prevFrom, to: prevTo }),
    ]);
    if (cur.status === 'fulfilled') setStats(cur.value);
    else {
      console.error(cur.reason);
      setError(errMsg(cur.reason, t('crm.marketingSmm.errors.stats')));
    }
    setPrevStats(prev.status === 'fulfilled' ? prev.value : null);
    setLoading(false);
  }, [range.from, range.to, t]);

  useEffect(() => {
    void loadProfiles();
    void loadIntegrations();
  }, [loadProfiles, loadIntegrations]);
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  /* возврат из OAuth (?meta=… / ?vk=…) */
  useEffect(() => {
    const sp = searchParamsRef.current;
    const meta = sp.get('meta');
    const vk = sp.get('vk');
    const code = meta || vk;
    if (!code) return;
    const provider = meta ? 'Meta' : 'VK';
    if (code === 'connected') {
      setStatus(t('crm.marketingSmm.ui.oauth.connected', { provider }));
      setDrawer(true);
    } else {
      setError(t('crm.marketingSmm.ui.oauth.failed', { provider }));
    }
    const next = new URLSearchParams(sp);
    next.delete('meta');
    next.delete('vk');
    setSearchParams(next, { replace: true });
  }, [t, setSearchParams]);

  /* ── агрегаты ── */
  const rowsCur = useMemo(() => byProfile(stats), [stats]);
  const rowsPrev = useMemo(() => byProfile(prevStats), [prevStats]);
  const T0 = useMemo(() => totalsOf(rowsCur), [rowsCur]);
  const P0 = useMemo(() => totalsOf(rowsPrev), [rowsPrev]);
  const hasPrev = rowsPrev.size > 0;
  const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

  const dates = useMemo(() => [...new Set((stats?.items || []).map((r) => r.date))].sort(), [stats]);
  const platformsPresent = useMemo(() => PL_ORDER.filter((k) => profiles.some((p) => p.platform === k)), [profiles]);

  const series = useMemo(() => {
    const out: Partial<Record<SmmPlatform, number[]>> = {};
    platformsPresent.forEach((k) => {
      out[k] = new Array(dates.length).fill(0);
    });
    const di = new Map(dates.map((d, i) => [d, i]));
    (stats?.items || []).forEach((r) => {
      const i = di.get(r.date);
      const arr = out[r.platform];
      if (i === undefined || !arr) return;
      arr[i] += r[metric] || 0;
    });
    return out;
  }, [stats, dates, platformsPresent, metric]);

  // предыдущий период сопоставляем по дате (сдвиг на длину периода)
  const prevSeries = useMemo(() => {
    const out: Partial<Record<SmmPlatform, Array<number | null>>> = {};
    if (!prevStats?.items?.length) return out;
    const cell = new Map<string, number>();
    prevStats.items.forEach((r) => {
      const key = `${r.platform}|${r.date}`;
      cell.set(key, (cell.get(key) || 0) + (r[metric] || 0));
    });
    platformsPresent.forEach((k) => {
      out[k] = dates.map((d) => {
        const v = cell.get(`${k}|${isoDay(parseDay(d) - days * dayMs)}`);
        return v === undefined ? null : v;
      });
    });
    return out;
  }, [prevStats, dates, platformsPresent, metric, days]);

  const noteFor = (p: SmmProfile, s: { reach: number; likes: number; comments: number; videoViews: number; impressions: number }) => {
    if (!p.isActive) return t('crm.marketingSmm.ui.notes.disabled');
    if (p.platform === 'telegram') return t('crm.marketingSmm.ui.notes.telegram');
    const parts: string[] = [];
    if (p.platform === 'instagram') {
      if (s.videoViews === 0) parts.push(t('crm.marketingSmm.zeroNotes.igVideo'));
      if (s.likes === 0 && s.comments === 0 && s.reach > 0) parts.push(t('crm.marketingSmm.zeroNotes.igEngagement'));
    }
    if (p.platform === 'facebook' && s.reach === 0 && s.impressions === 0) parts.push(t('crm.marketingSmm.zeroNotes.fbReach'));
    return parts.length ? parts.join(' ') : null;
  };

  const tableRows = useMemo(
    () =>
      profiles.map((p) => {
        const rows = rowsCur.get(p.id) || [];
        const pr = rowsPrev.get(p.id) || [];
        const s = rows.reduce(
          (a, r) => ({ reach: a.reach + r.reach, likes: a.likes + r.likes, comments: a.comments + r.comments, videoViews: a.videoViews + r.videoViews, impressions: a.impressions + r.impressions }),
          { reach: 0, likes: 0, comments: 0, videoViews: 0, impressions: 0 },
        );
        const lastRow = rows[rows.length - 1];
        const prevReach = pr.reduce((a, r) => a + r.reach, 0);
        return {
          p,
          ...s,
          followers: lastRow ? lastRow.followers : p.lastStat?.followers ?? 0,
          fDelta: lastRow ? lastRow.followers - rows[0].followers : 0,
          er: s.reach ? ((s.likes + s.comments) / s.reach) * 100 : 0,
          reachPct: pr.length ? pct(s.reach, prevReach) : null,
          date: lastRow?.date || p.lastStat?.date || null,
          note: noteFor(p, s),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, rowsCur, rowsPrev, t],
  );

  const filtered = tableRows.filter((r) => (plat === 'all' || r.p.platform === plat) && (!q || r.p.handle.toLowerCase().includes(q.toLowerCase())));
  const shown = filtered.slice(0, limit);
  const maxReach = Math.max(...tableRows.map((r) => r.reach), 1);
  useEffect(() => setLimit(20), [q, plat]);

  const activeCount = profiles.filter((p) => p.isActive).length;

  // «застывшие» профили: отключены вручную либо подключены по интеграции, но свежих данных давно нет
  const stale = useMemo(() => {
    const nowMs = Date.now();
    return profiles.filter((p) => {
      if (!p.isActive) return true;
      if (p.source === 'manual' || !p.source) return false;
      const d = p.lastStat?.date;
      return !!d && (nowMs - parseDay(d)) / dayMs > STALE_AFTER_DAYS;
    });
  }, [profiles]);
  const staleSince = useMemo(() => {
    const ds = stale.map((p) => p.lastStat?.date).filter((d): d is string => !!d).sort();
    return ds.length ? dm(ds[0]) : null;
  }, [stale]);

  /* ── действия ── */
  const runSync = async () => {
    const m = integrations?.meta.connected && !integrations.meta.expired;
    const v = integrations?.vk.connected && !integrations.vk.expired;
    if (!m && !v) {
      setError(t('crm.marketingSmm.ui.syncNothing'));
      setDrawer(true);
      return;
    }
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const res = await Promise.allSettled([m ? syncMetaNow() : Promise.resolve(null), v ? syncVkNow() : Promise.resolve(null)]);
      const ok = res.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
      const failed = res.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      await Promise.all([loadProfiles(), loadIntegrations(), loadStats()]);
      const sum = (k: 'synced' | 'skipped' | 'errors') => ok.reduce((a, r) => a + r[k], 0);
      if (failed) setError(errMsg(failed.reason, t('crm.marketingSmm.errors.metaSync')));
      else setStatus(t('crm.marketingSmm.ui.syncDone', { synced: sum('synced'), skipped: sum('skipped'), errors: sum('errors') }));
    } finally {
      setSyncing(false);
    }
  };

  const createProfile = async () => {
    if (!adding.handle.trim()) return;
    setSavingProfile(true);
    setError(null);
    try {
      await createSmmProfile({ platform: adding.platform, handle: adding.handle.trim(), url: adding.url.trim() || undefined });
      setAdding({ ...adding, handle: '', url: '' });
      await loadProfiles();
    } catch (e) {
      setError(errMsg(e, t('crm.marketingSmm.errors.createProfile')));
    } finally {
      setSavingProfile(false);
    }
  };

  const removeProfile = async (p: SmmProfile) => {
    const ok = await showConfirm(t('crm.marketingSmm.profiles.confirmDelete', { platform: platformName(p.platform), handle: p.handle }), {
      title: t('crm.confirmModal.deleteTitle'),
      confirmLabel: t('crm.confirmModal.deleteLabel'),
      cancelLabel: t('crm.confirmModal.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSmmProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      await loadStats();
    } catch (e) {
      setError(errMsg(e, t('crm.marketingSmm.errors.deleteProfile')));
    }
  };

  /* ── шапка ── */
  const soonMs = 7 * dayMs;
  const expiresSoon = (iso?: string | null) => !!iso && new Date(iso).getTime() - Date.now() <= soonMs;
  const metaState = !integrations
    ? null
    : !integrations.meta.connected
      ? 'off'
      : integrations.meta.expired || expiresSoon(integrations.meta.expiresAt)
        ? 'warn'
        : 'ok';
  const headSync = useMemo(() => {
    const ds = [integrations?.meta.lastSyncAt, integrations?.vk.lastSyncAt].filter((d): d is string => !!d).sort();
    return ds.length ? ds[ds.length - 1] : null;
  }, [integrations]);
  const fmtStamp = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const Delta: React.FC<{ value: number | null }> = ({ value }) => {
    if (value === null || !isFinite(value)) return <span className="sm-d flat">{t('crm.marketingSmm.ui.delta.noPrev')}</span>;
    if (Math.abs(value) < 0.05) return <span className="sm-d flat">{t('crm.marketingSmm.ui.delta.flat')}</span>;
    return (
      <span className={cl('sm-d', value > 0 ? 'up' : 'dn')}>
        <Ic d={value > 0 ? M.up : M.dn} size={11} sw={2} />
        {`${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`}
      </span>
    );
  };
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${nf(Math.abs(n))}`;

  if (loading && !stats && !profiles.length) {
    return (
      <MainLayout>
        <PageHelpButton topic="marketingSmm" />
        <div className="px-scope smm-scope">
          <div className="sm-wrap" aria-busy="true">
            <div className="sm-skel" style={{ height: 84, marginBottom: 18 }} />
            <div className="sm-skel" style={{ height: 96, marginBottom: 16 }} />
            <div className="sm-skel" style={{ height: 300 }} />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="marketingSmm" />
      <div className="px-scope smm-scope">
        <div className="sm-wrap">
          <div className="sm-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.marketingSmm.kicker')}
              </div>
              <h1>{t('crm.marketingSmm.title')}</h1>
              <div className="sub">{t('crm.marketingSmm.subtitle')}</div>
            </div>
            <div className="sm-head-actions">
              {metaState && (
                <span className={cl('sm-conn', metaState)}>
                  <span className="dot" />
                  {metaState === 'ok' ? t('crm.marketingSmm.ui.conn.metaOk') : metaState === 'warn' ? (integrations?.meta.expired ? t('crm.marketingSmm.ui.conn.metaExpired') : t('crm.marketingSmm.ui.conn.metaSoon')) : t('crm.marketingSmm.ui.conn.metaOff')}
                </span>
              )}
              {integrations?.vk.connected && (
                <span className={cl('sm-conn', integrations.vk.expired ? 'warn' : 'ok')}>
                  <span className="dot" />
                  {integrations.vk.expired ? t('crm.marketingSmm.ui.conn.vkExpired') : t('crm.marketingSmm.ui.conn.vkOk')}
                </span>
              )}
              <button type="button" className="btn btn-sm" onClick={() => void runSync()} disabled={syncing}>
                <Ic d={M.refresh} size={14} />
                {syncing ? t('crm.marketingSmm.ui.syncing') : t('crm.marketingSmm.ui.sync')}
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setDrawer(true)}>
                <Ic d={M.plug} size={14} />
                {t('crm.marketingSmm.ui.integrations')}
              </button>
            </div>
          </div>

          <div className="sm-bar">
            <div className="sm-seg">
              {(['7d', '30d', '90d', 'custom'] as const).map((p) => (
                <button key={p} type="button" className={cl(preset === p && 'active')} onClick={() => (p === 'custom' ? setPreset('custom') : applyPreset(p))}>
                  {t(`crm.marketingSmm.ui.range.${p}`)}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="sm-dates">
                <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                <span style={{ color: 'var(--fg-4)' }}>→</span>
                <input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                <button type="button" className="btn btn-sm" disabled={!draft.from || !draft.to || draft.from > draft.to} onClick={() => setRange(draft)}>
                  {t('crm.marketingSmm.ui.range.apply')}
                </button>
              </div>
            )}
            <div className="sm-bar-spacer" />
            <span className="sm-sync">
              {range.from} → {range.to} · {t('crm.marketingSmm.ui.rangeLine', { days })}
              {headSync ? ` · ${t('crm.marketingSmm.ui.lastSync', { date: fmtStamp(headSync) })}` : ''}
            </span>
          </div>

          {error && (
            <div className="sm-note err" role="alert">
              <span className="sp">{error}</span>
              <button type="button" className="x" onClick={() => setError(null)} aria-label="×">
                ×
              </button>
            </div>
          )}
          {status && !error && (
            <div className="sm-note ok" role="status">
              <span className="sp">{status}</span>
              <button type="button" className="x" onClick={() => setStatus(null)} aria-label="×">
                ×
              </button>
            </div>
          )}
          {stale.length > 0 && (
            <div className="sm-note warn">
              <span className="sp">
                {stale.length === 1 ? t('crm.marketingSmm.ui.stale.one', { handle: stale[0].handle }) : t('crm.marketingSmm.ui.stale.many', { count: stale.length })}
                {staleSince ? ` ${t('crm.marketingSmm.ui.stale.since', { date: staleSince })}` : ''}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setDrawer(true)}>
                {t('crm.marketingSmm.ui.stale.check')}
              </button>
            </div>
          )}

          <div className="sm-kpis">
            <div className="sm-kpi">
              <div className="l">{t('crm.marketingSmm.ui.kpi.profiles')}</div>
              <div className="v">
                {activeCount}
                <span className="u">{t('crm.marketingSmm.ui.kpi.ofN', { total: profiles.length })}</span>
              </div>
              <div className="note">{t('crm.marketingSmm.ui.kpi.profilesNote')}</div>
            </div>
            <div className="sm-kpi">
              <div className="l">{t('crm.marketingSmm.ui.kpi.followers')}</div>
              <div className="v">{nf(T0.followers)}</div>
              <div className="sm-kpi-foot">
                <Delta value={hasPrev ? pct(T0.followers, P0.followers) : null} />
              </div>
            </div>
            <div className="sm-kpi">
              <div className="l">{t('crm.marketingSmm.ui.kpi.delta')}</div>
              <div className="v">{signed(T0.delta)}</div>
              <div className="sm-kpi-foot">
                <Delta value={hasPrev ? pct(T0.delta, P0.delta) : null} />
              </div>
            </div>
            <div className="sm-kpi">
              <div className="l">{t('crm.marketingSmm.ui.kpi.reachEr')}</div>
              <div className="v">
                {nf(T0.reach)}
                <span className="u">ER {pf(T0.er)}</span>
              </div>
              <div className="sm-kpi-foot">
                <Delta value={hasPrev ? pct(T0.reach, P0.reach) : null} />
              </div>
            </div>
          </div>

          <div className="sm-card" style={{ position: 'relative' }}>
            {loading && <div className="sm-busy">{t('crm.marketingSmm.ui.loading')}</div>}
            <div className="sm-card-head">
              <h3>{t('crm.marketingSmm.ui.chart.title', { metric: t(`crm.marketingSmm.ui.metrics.${metric}`) })}</h3>
              <div className="sm-card-tools">
                <span className="meta">{t('crm.marketingSmm.ui.chart.days', { count: days })}</span>
                <div className="sm-seg">
                  {METRIC_KEYS.map((k) => (
                    <button key={k} type="button" className={cl(metric === k && 'active')} onClick={() => setMetric(k)}>
                      {t(`crm.marketingSmm.ui.metrics.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {dates.length > 1 && platformsPresent.length > 0 ? (
              <Trend
                dates={dates}
                series={series}
                prevSeries={prevSeries}
                metric={metric}
                hidden={hidden}
                onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))}
                platformName={platformName}
                fmt={nf}
                dayTip={t('crm.marketingSmm.ui.chart.dayTip')}
                prevHint={t('crm.marketingSmm.ui.chart.prevHint')}
              />
            ) : (
              <div className="sm-empty">{t('crm.marketingSmm.ui.chart.empty')}</div>
            )}
          </div>

          <div className="sm-card">
            <div className="sm-card-head">
              <h3>{t('crm.marketingSmm.ui.profiles.title')}</h3>
              <div className="sm-card-tools">
                <span className="meta">{t('crm.marketingSmm.ui.profiles.shown', { shown: shown.length, total: filtered.length })}</span>
                <label className="sm-search">
                  <Ic d={M.search} size={14} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('crm.marketingSmm.ui.profiles.search')} />
                </label>
                <select className="sm-select" value={plat} onChange={(e) => setPlat(e.target.value as SmmPlatform | 'all')}>
                  <option value="all">{t('crm.marketingSmm.ui.profiles.allPlatforms')}</option>
                  {platformsPresent.map((k) => (
                    <option key={k} value={k}>
                      {platformName(k)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm-form">
              <div className="sm-f">
                <label className="l" htmlFor="sm-add-platform">
                  {t('crm.marketingSmm.ui.profiles.platform')}
                </label>
                <select id="sm-add-platform" className="sm-select" style={{ width: '100%', height: 34 }} value={adding.platform} onChange={(e) => setAdding({ ...adding, platform: e.target.value as SmmPlatform })}>
                  {PL_ORDER.filter((k) => k !== 'other').map((k) => (
                    <option key={k} value={k}>
                      {platformName(k)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm-f">
                <label className="l" htmlFor="sm-add-handle">
                  {t('crm.marketingSmm.ui.profiles.account')}
                </label>
                <input id="sm-add-handle" className="sm-input" value={adding.handle} onChange={(e) => setAdding({ ...adding, handle: e.target.value })} placeholder="@account" autoCapitalize="off" autoCorrect="off" />
              </div>
              <div className="sm-f">
                <label className="l" htmlFor="sm-add-url">
                  {t('crm.marketingSmm.ui.profiles.link')}
                </label>
                <input id="sm-add-url" className="sm-input" value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} placeholder="https://instagram.com/account" inputMode="url" autoCapitalize="off" autoCorrect="off" />
              </div>
              <button type="button" className="btn btn-sm btn-primary" style={{ height: 34 }} disabled={!adding.handle.trim() || savingProfile} onClick={() => void createProfile()}>
                {savingProfile ? t('crm.marketingSmm.ui.profiles.adding') : t('crm.marketingSmm.ui.profiles.add')}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="sm-empty">
                <b>{t('crm.marketingSmm.ui.profiles.emptyTitle')}</b>
                {t('crm.marketingSmm.ui.profiles.emptyDesc')}
              </div>
            ) : (
              <>
                <div className="sm-table-scroll">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>{t('crm.marketingSmm.ui.table.profile')}</th>
                        <th>{t('crm.marketingSmm.ui.table.platform')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.followers')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.growth')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.reach')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.likes')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.comments')}</th>
                        <th className="r">ER</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.views')}</th>
                        <th className="r">{t('crm.marketingSmm.ui.table.data')}</th>
                        <th className="r" style={{ width: 80 }}>
                          {t('crm.marketingSmm.ui.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <React.Fragment key={r.p.id}>
                          <tr>
                            <td>
                              <ProfileCell r={r} off={t('crm.marketingSmm.ui.table.disabled')} />
                            </td>
                            <td>
                              <span className="sm-pill">
                                <span className="d" style={{ background: PL[r.p.platform].c }} />
                                {platformName(r.p.platform)}
                              </span>
                            </td>
                            <td className="r">{nf(r.followers)}</td>
                            <td className="r" style={{ color: r.fDelta > 0 ? '#1f8a5e' : r.fDelta < 0 ? '#cc2f47' : 'var(--fg-4)' }}>
                              {r.fDelta > 0 ? '+' : r.fDelta < 0 ? '−' : ''}
                              {nf(Math.abs(r.fDelta))}
                            </td>
                            <td className="r">
                              <div className="sm-bars">
                                <span className="tr">
                                  <i style={{ width: `${(r.reach / maxReach) * 100}%` }} />
                                </span>
                                {nf(r.reach)}
                              </div>
                            </td>
                            <td className="r">{r.likes ? nf(r.likes) : <span className="sm-dash">—</span>}</td>
                            <td className="r">{r.comments ? nf(r.comments) : <span className="sm-dash">—</span>}</td>
                            <td className="r">{r.reach && (r.likes || r.comments) ? pf(r.er) : <span className="sm-dash">—</span>}</td>
                            <td className="r">{r.videoViews ? nf(r.videoViews) : <span className="sm-dash">—</span>}</td>
                            <td className="r" style={{ color: 'var(--fg-3)' }}>
                              {r.date ? dm(r.date) : '—'}
                              {r.note && (
                                <button type="button" className="sm-note-btn" title={t('crm.marketingSmm.ui.table.why')} onClick={() => setOpenNote(openNote === r.p.id ? null : r.p.id)}>
                                  ?
                                </button>
                              )}
                            </td>
                            <td>
                              <div className="sm-td-act">
                                {r.p.url && (
                                  <a className="sm-ico" href={r.p.url} target="_blank" rel="noreferrer" title={t('crm.marketingSmm.ui.table.open')}>
                                    <Ic d={M.ext} size={14} />
                                  </a>
                                )}
                                <button type="button" className="sm-ico danger" title={t('crm.marketingSmm.ui.table.remove')} onClick={() => void removeProfile(r.p)}>
                                  <Ic d={M.trash} size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {openNote === r.p.id && r.note && (
                            <tr className="sm-row-note">
                              <td colSpan={11}>{r.note}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>{t('crm.marketingSmm.ui.table.total', { count: filtered.length })}</td>
                        <td className="r">{nf(filtered.reduce((s, r) => s + r.followers, 0))}</td>
                        <td className="r">{signed(filtered.reduce((s, r) => s + r.fDelta, 0))}</td>
                        <td className="r">{nf(filtered.reduce((s, r) => s + r.reach, 0))}</td>
                        <td className="r">{nf(filtered.reduce((s, r) => s + r.likes, 0))}</td>
                        <td className="r">{nf(filtered.reduce((s, r) => s + r.comments, 0))}</td>
                        <td className="r">{pf(T0.er)}</td>
                        <td className="r">{nf(filtered.reduce((s, r) => s + r.videoViews, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* телефон: карточки вместо широкой таблицы */}
                <div className="sm-cards">
                  {shown.map((r) => (
                    <div className="sm-pcard" key={r.p.id}>
                      <div className="sm-pcard-top">
                        <ProfileCell r={r} off={t('crm.marketingSmm.ui.table.disabled')} />
                        <div className="sm-pcard-foll">
                          {nf(r.followers)}
                          <small style={{ color: r.fDelta > 0 ? '#1f8a5e' : r.fDelta < 0 ? '#cc2f47' : 'var(--fg-4)' }}>
                            {r.fDelta > 0 ? '+' : r.fDelta < 0 ? '−' : ''}
                            {nf(Math.abs(r.fDelta))}
                          </small>
                        </div>
                      </div>
                      <div className="sm-pcard-grid">
                        {(
                          [
                            [t('crm.marketingSmm.ui.table.reach'), r.reach ? nf(r.reach) : null],
                            [t('crm.marketingSmm.ui.table.likes'), r.likes ? nf(r.likes) : null],
                            [t('crm.marketingSmm.ui.table.comments'), r.comments ? nf(r.comments) : null],
                            ['ER', r.reach && (r.likes || r.comments) ? pf(r.er) : null],
                            [t('crm.marketingSmm.ui.table.views'), r.videoViews ? nf(r.videoViews) : null],
                            [t('crm.marketingSmm.ui.table.data'), r.date ? dm(r.date) : null],
                          ] as Array<[string, string | null]>
                        ).map(([k, v]) => (
                          <div key={k}>
                            <div className="k">{k}</div>
                            <div className="v">{v ?? <span className="sm-dash">—</span>}</div>
                          </div>
                        ))}
                      </div>
                      {r.note && <div className="sm-pcard-note">{r.note}</div>}
                      <div className="sm-pcard-foot">
                        <span className="sm-pill">
                          <span className="d" style={{ background: PL[r.p.platform].c }} />
                          {platformName(r.p.platform)}
                        </span>
                        <span className="sm-td-act">
                          {r.p.url && (
                            <a className="sm-ico" href={r.p.url} target="_blank" rel="noreferrer" title={t('crm.marketingSmm.ui.table.open')}>
                              <Ic d={M.ext} size={14} />
                            </a>
                          )}
                          <button type="button" className="sm-ico danger" title={t('crm.marketingSmm.ui.table.remove')} onClick={() => void removeProfile(r.p)}>
                            <Ic d={M.trash} size={14} />
                          </button>
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="sm-pcard-total">
                    <span>{t('crm.marketingSmm.ui.table.total', { count: filtered.length })}</span>
                    <span>{nf(filtered.reduce((s, r) => s + r.followers, 0))}</span>
                  </div>
                </div>
              </>
            )}
            {filtered.length > shown.length && (
              <div className="sm-more">
                <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + 20)}>
                  {t('crm.marketingSmm.ui.table.more')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {drawer &&
        createPortal(
          <IntegrationsDrawer
            onClose={() => setDrawer(false)}
            integrations={integrations}
            profiles={profiles}
            syncing={syncing}
            onSync={() => void runSync()}
            reload={async () => {
              await Promise.all([loadProfiles(), loadIntegrations(), loadStats()]);
            }}
            setError={setError}
            setStatus={setStatus}
            fmtStamp={fmtStamp}
            nf={nf}
          />,
          document.body,
        )}
    </MainLayout>
  );
};

/* ── ячейка профиля (аватар + аккаунт + ссылка) ── */
const ProfileCell: React.FC<{
  r: { p: SmmProfile };
  off: string;
}> = ({ r, off }) => (
  <div className="sm-prof">
    <span className="sm-ava" style={{ background: r.p.isActive ? PL[r.p.platform].c : 'var(--fg-4)' }}>
      {PL[r.p.platform].s}
    </span>
    <div style={{ minWidth: 0 }}>
      <div className="nm">
        {r.p.handle}
        {!r.p.isActive && <span className="sm-off"> · {off}</span>}
      </div>
      {r.p.url && (
        <a className="ur" href={r.p.url} target="_blank" rel="noreferrer">
          {r.p.url.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  </div>
);

/* ── панель интеграций ── */
const IntegrationsDrawer: React.FC<{
  onClose: () => void;
  integrations: SmmIntegrationsStatus | null;
  profiles: SmmProfile[];
  syncing: boolean;
  onSync: () => void;
  reload: () => Promise<void>;
  setError: (v: string | null) => void;
  setStatus: (v: string | null) => void;
  fmtStamp: (iso?: string | null) => string;
  nf: (n: number) => string;
}> = ({ onClose, integrations, profiles, syncing, onSync, reload, setError, setStatus, fmtStamp, nf }) => {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<MetaAssets | null>(null);
  const [vk, setVk] = useState<VkAssets | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingVk, setLoadingVk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const metaUsable = !!integrations?.meta.connected && !integrations.meta.expired;
  const vkUsable = !!integrations?.vk.connected && !integrations.vk.expired;

  useEffect(() => {
    if (!metaUsable) return;
    setLoadingMeta(true);
    fetchMetaAssets()
      .then(setMeta)
      .catch((e) => setError(e instanceof Error && e.message ? e.message : t('crm.marketingSmm.errors.metaAssets')))
      .finally(() => setLoadingMeta(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaUsable]);
  useEffect(() => {
    if (!vkUsable) return;
    setLoadingVk(true);
    fetchVkAssets()
      .then(setVk)
      .catch((e) => setError(e instanceof Error && e.message ? e.message : t('crm.marketingSmm.ui.errors.vkAssets')))
      .finally(() => setLoadingVk(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vkUsable]);

  const findProfile = (platform: SmmPlatform, provider: 'meta' | 'vk', key: 'pageId' | 'igUserId' | 'groupId', value: string | number) =>
    profiles.find((p) => p.platform === platform && p.meta?.provider === provider && String(p.meta?.[key]) === String(value)) || null;

  /** Добавить / включить / отключить профиль (отключённый не синхронизируется, история остаётся). */
  const toggle = async (id: string, existing: SmmProfile | null, connect: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    setStatus(null);
    try {
      if (!existing) await connect();
      else await updateSmmProfile(existing.id, { isActive: !existing.isActive });
      await reload();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('crm.marketingSmm.ui.errors.toggle'));
    } finally {
      setBusy(null);
    }
  };
  const label = (p: SmmProfile | null) => (!p ? t('crm.marketingSmm.ui.drawer.add') : p.isActive ? t('crm.marketingSmm.ui.drawer.disable') : t('crm.marketingSmm.ui.drawer.enable'));

  const goAuth = async (get: () => Promise<{ url: string }>) => {
    try {
      const { url } = await get();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('crm.marketingSmm.errors.metaConnect'));
    }
  };

  const stateOf = (s?: { connected: boolean; expired: boolean; expiresAt?: string | null }) =>
    !s?.connected ? 'off' : s.expired ? 'warn' : s.expiresAt && new Date(s.expiresAt).getTime() - Date.now() <= 7 * 864e5 ? 'soon' : 'ok';
  const stateLabel = (k: string) => t(`crm.marketingSmm.ui.drawer.state.${k}`);
  const subFor = (s?: SmmIntegrationsStatus['meta']) =>
    !s?.connected
      ? t('crm.marketingSmm.ui.drawer.notConnectedSub')
      : t('crm.marketingSmm.ui.drawer.connectedSince', { date: fmtStamp(s.connectedAt) });
  const lastSyncLine = (s?: SmmIntegrationsStatus['meta']) =>
    s?.lastSyncAt && s.lastSync ? t('crm.marketingSmm.ui.drawer.lastSync', { date: fmtStamp(s.lastSyncAt), synced: s.lastSync.synced, errors: s.lastSync.errors }) : null;

  const m = integrations?.meta;
  const v = integrations?.vk;

  return (
    <div className="px-scope smm-scope">
      <div
        className="sm-drawer-back"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="sm-drawer" role="dialog" aria-modal="true" aria-label={t('crm.marketingSmm.ui.drawer.title')}>
          <div className="sm-drawer-head">
            <h2>{t('crm.marketingSmm.ui.drawer.title')}</h2>
            <button type="button" className="sm-ico" onClick={onClose} title={t('crm.marketingSmm.popup.close')}>
              <Ic d={M.x} size={15} />
            </button>
          </div>
          <div className="sm-drawer-body">
            {/* Meta */}
            <div className="sm-int">
              <div className="sm-int-head">
                <span className="sm-ava" style={{ background: PL.facebook.c }}>
                  FB
                </span>
                <div className="nm">
                  <b>{t('crm.marketingSmm.ui.drawer.metaTitle')}</b>
                  <span>{subFor(m)}</span>
                </div>
                <span className={cl('sm-conn', stateOf(m) === 'soon' ? 'warn' : stateOf(m))}>
                  <span className="dot" />
                  {stateLabel(stateOf(m))}
                </span>
              </div>
              <div className="sm-int-acts">
                <button type="button" className="btn btn-sm" onClick={() => void goAuth(() => getMetaAuthUrl('/app/marketing/smm'))}>
                  {m?.connected ? t('crm.marketingSmm.ui.drawer.reconnect') : t('crm.marketingSmm.ui.drawer.connect')}
                </button>
                {metaUsable && (
                  <button type="button" className="btn btn-sm" onClick={onSync} disabled={syncing}>
                    <Ic d={M.refresh} size={13} />
                    {syncing ? t('crm.marketingSmm.ui.syncing') : t('crm.marketingSmm.ui.drawer.syncNow')}
                  </button>
                )}
              </div>
              {lastSyncLine(m) && <div className="sm-int-foot" style={{ borderBottom: '1px solid var(--line-3)' }}>{lastSyncLine(m)}</div>}
              {m?.connected && !m.expired && m.expiresAt && (
                <div className="sm-int-foot" style={{ borderBottom: '1px solid var(--line-3)', color: stateOf(m) === 'soon' ? '#7a5411' : undefined }}>
                  {t('crm.marketingSmm.ui.drawer.expiresOn', { date: fmtStamp(m.expiresAt).split(',')[0] })}
                  {stateOf(m) === 'soon' ? ` — ${t('crm.marketingSmm.ui.drawer.expiresSoonHint')}` : ''}
                </div>
              )}
              {m?.expired && <div className="sm-int-foot">{t('crm.marketingSmm.ui.drawer.expiredHint')}</div>}
              {metaUsable && loadingMeta && <div className="sm-int-empty">{t('crm.marketingSmm.ui.drawer.loading')}</div>}
              {metaUsable && !loadingMeta && meta && meta.pages.length === 0 && <div className="sm-int-empty">{t('crm.marketingSmm.ui.drawer.noPages')}</div>}
              {metaUsable &&
                meta?.pages.map((pg) => {
                  const fb = findProfile('facebook', 'meta', 'pageId', pg.id);
                  const ig = pg.instagramBusinessId ? findProfile('instagram', 'meta', 'igUserId', pg.instagramBusinessId) : null;
                  const inProfiles = (fb && fb.isActive) || (ig && ig.isActive);
                  return (
                    <div className="sm-acc" key={pg.id}>
                      <div className="nm">
                        <b>{pg.name}</b>
                        <span>
                          {pg.username ? `fb.com/${pg.username}` : 'Facebook'}
                          {pg.instagramUsername ? ` · @${pg.instagramUsername}` : ` · ${t('crm.marketingSmm.ui.drawer.igNotLinked')}`}
                        </span>
                      </div>
                      {inProfiles ? <span className="sm-tagd">{t('crm.marketingSmm.ui.drawer.inProfiles')}</span> : null}
                      <div className="btns">
                        <button type="button" className="btn btn-sm" disabled={busy === `fb${pg.id}`} onClick={() => void toggle(`fb${pg.id}`, fb, () => connectMetaProfile({ platform: 'facebook', pageId: pg.id }))}>
                          Facebook · {label(fb)}
                        </button>
                        {pg.instagramBusinessId && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy === `ig${pg.id}`}
                            onClick={() => void toggle(`ig${pg.id}`, ig, () => connectMetaProfile({ platform: 'instagram', igUserId: pg.instagramBusinessId as string }))}
                          >
                            Instagram · {label(ig)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {metaUsable && <div className="sm-int-foot">{t('crm.marketingSmm.ui.drawer.pagesFoot')}</div>}
            </div>

            {/* ВКонтакте */}
            <div className="sm-int">
              <div className="sm-int-head">
                <span className="sm-ava" style={{ background: PL.vk.c }}>
                  VK
                </span>
                <div className="nm">
                  <b>{t('crm.marketingSmm.ui.drawer.vkTitle')}</b>
                  <span>{v?.connected ? t('crm.marketingSmm.ui.drawer.connectedSince', { date: fmtStamp(v.connectedAt) }) : t('crm.marketingSmm.ui.drawer.vkNotConnectedSub')}</span>
                </div>
                <span className={cl('sm-conn', stateOf(v))}>
                  <span className="dot" />
                  {stateLabel(stateOf(v))}
                </span>
              </div>
              <div className="sm-int-acts">
                <button type="button" className="btn btn-sm" onClick={() => void goAuth(() => getVkAuthUrl('/app/marketing/smm'))}>
                  {v?.connected ? t('crm.marketingSmm.ui.drawer.reconnect') : t('crm.marketingSmm.ui.drawer.connect')}
                </button>
                {vkUsable && (
                  <button type="button" className="btn btn-sm" onClick={onSync} disabled={syncing}>
                    <Ic d={M.refresh} size={13} />
                    {syncing ? t('crm.marketingSmm.ui.syncing') : t('crm.marketingSmm.ui.drawer.syncNow')}
                  </button>
                )}
              </div>
              {lastSyncLine(v) && <div className="sm-int-foot" style={{ borderBottom: '1px solid var(--line-3)' }}>{lastSyncLine(v)}</div>}
              {vkUsable && loadingVk && <div className="sm-int-empty">{t('crm.marketingSmm.ui.drawer.loading')}</div>}
              {vkUsable && !loadingVk && vk && vk.groups.length === 0 && <div className="sm-int-empty">{t('crm.marketingSmm.ui.drawer.noGroups')}</div>}
              {vkUsable &&
                vk?.groups.map((g) => {
                  const prof = findProfile('vk', 'vk', 'groupId', g.id);
                  return (
                    <div className="sm-acc" key={g.id}>
                      <div className="nm">
                        <b>{g.name}</b>
                        <span>
                          vk.com/{g.screenName || `club${g.id}`}
                          {g.membersCount != null ? ` · ${t('crm.marketingSmm.ui.drawer.members', { n: nf(g.membersCount) })}` : ''}
                        </span>
                      </div>
                      {prof && prof.isActive ? <span className="sm-tagd">{t('crm.marketingSmm.ui.drawer.inProfiles')}</span> : null}
                      <div className="btns">
                        <button type="button" className="btn btn-sm" disabled={busy === `vk${g.id}`} onClick={() => void toggle(`vk${g.id}`, prof, () => connectVkGroup({ groupId: g.id }))}>
                          {label(prof)}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Telegram */}
            <div className="sm-int">
              <div className="sm-int-head">
                <span className="sm-ava" style={{ background: PL.telegram.c }}>
                  TG
                </span>
                <div className="nm">
                  <b>Telegram</b>
                  <span>{t('crm.marketingSmm.ui.drawer.tgSub')}</span>
                </div>
                <span className="sm-conn">
                  <span className="dot" />
                  {t('crm.marketingSmm.ui.drawer.state.manual')}
                </span>
              </div>
              <div className="sm-int-foot">{t('crm.marketingSmm.ui.drawer.tgFoot')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
