import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSmmProfiles,
  fetchSmmStats,
  createSmmProfile,
  deleteSmmProfile,
  fetchMetaAssets,
  getMetaAuthUrl,
  connectMetaProfile,
  syncMetaNow,
  type SmmProfile,
  type SmmPlatform,
  type SmmStatsResponse,
  type SmmProfileLastStat,
} from '../../api/smm';
import { getLocale } from '../../i18n/utils';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';



type PeriodPreset = '7d' | '30d' | '90d';

interface DateRange {
  from?: string;
  to?: string;
}

const PLATFORM_COLORS: Record<SmmPlatform, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  telegram: '#229ED9',
  vk: '#4c75a3',
  tiktok: '#25f4ee',
  other: '#9ca3af',
};

const CHART_PLATFORMS: SmmPlatform[] = ['instagram', 'facebook', 'telegram', 'vk'];

interface FollowersChartPoint {
  date: string;
  [key: string]: number | string | undefined;
}

type ChartMetric = 'followers' | 'reach' | 'likes' | 'comments' | 'videoViews';

/** Акцент нижних блоков (график, профили) — согласован с онлайн-чатом / маркетингом */
const SMM_PANEL_ACCENT = '#222222';

const FollowersTooltip: React.FC<any> = ({ active, payload, label, locale }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="max-w-[260px] rounded-xl border bg-white px-3 py-2 text-[11px] text-neutral-800 shadow-lg"
      style={{ borderColor: `${SMM_PANEL_ACCENT}22` }}
    >
      <div className="mb-1 font-semibold text-neutral-900">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-neutral-700">
          <span
            className="mr-1 inline-block h-3 w-3 rounded-full align-middle"
            style={{ background: p.color }}
          />
          <span className="align-middle">
            {p.name}: {p.value?.toLocaleString?.(locale) ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SmmPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const periodLabel: Record<PeriodPreset, string> = {
    '7d': t('crm.marketingSmm.periods.7d'),
    '30d': t('crm.marketingSmm.periods.30d'),
    '90d': t('crm.marketingSmm.periods.90d'),
  };
  const platformLabel = (platform: SmmPlatform) =>
    t(`crm.marketingSmm.platforms.${platform}`);
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [range, setRange] = useState<DateRange>({});
  const [profiles, setProfiles] = useState<SmmProfile[]>([]);
  const [stats, setStats] = useState<SmmStatsResponse | null>(null);
  const [compareStats, setCompareStats] = useState<SmmStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [form, setForm] = useState<{
    platform: SmmPlatform;
    handle: string;
    url: string;
    note: string;
  }>({
    platform: 'instagram',
    handle: '',
    url: '',
    note: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState<string | null>(null);
  const [metaSyncLoading, setMetaSyncLoading] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('followers');
  const [activeTab, setActiveTab] = useState<'profiles' | 'integrations'>('profiles');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<SmmPlatform | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [metaAssets, setMetaAssets] = useState<{
    pages: Array<{
      id: string;
      name: string;
      username: string | null;
      link: string | null;
      instagramBusinessId: string | null;
      instagramUsername: string | null;
    }>;
  } | null>(null);
  const metaConnected = Boolean(metaAssets && !metaError);
  const [hiddenMetaPages, setHiddenMetaPages] = useState<Set<string>>(new Set());

  const baseColumns = useMemo(
    () => [
      { id: 'profile', label: t('crm.marketingSmm.profiles.table.headers.profile') },
      { id: 'platform', label: t('crm.marketingSmm.profiles.table.headers.platform') },
      { id: 'followers', label: t('crm.marketingSmm.profiles.table.headers.followers') },
      {
        id: 'reachLikesComments',
        label: t('crm.marketingSmm.profiles.table.headers.reachLikesComments'),
      },
      { id: 'erViews', label: t('crm.marketingSmm.profiles.table.headers.erViews') },
      { id: 'date', label: t('crm.marketingSmm.profiles.table.headers.date') },
      { id: 'actions', label: t('crm.marketingSmm.profiles.table.headers.actions') },
    ],
    [t],
  );

  const orderedColumns = useMemo(() => {
    if (!baseColumns.length) return [];
    const map = new Map(baseColumns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : baseColumns.map((col) => col.id);
    const result: typeof baseColumns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    baseColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [baseColumns, columnOrder]);

  // ------ helpers: период

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);

    const today = new Date();
    const end = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );

    const start = new Date(end);
    if (p === '7d') {
      start.setUTCDate(end.getUTCDate() - 6);
    } else if (p === '30d') {
      start.setUTCDate(end.getUTCDate() - 29);
    } else if (p === '90d') {
      start.setUTCDate(end.getUTCDate() - 89);
    }

    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  };

  useEffect(() => {
    applyPreset('30d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('marketing_smm_profiles_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'marketing_smm_profiles_columns',
        JSON.stringify({ order: columnOrder, widths: columnWidths }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths]);

  useEffect(() => {
    if (!baseColumns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return baseColumns.map((c) => c.id);
      const ids = baseColumns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [baseColumns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    const raw = window.localStorage.getItem('smm.meta.hiddenPages');
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        setHiddenMetaPages(new Set(ids));
      }
    } catch {
      // ignore bad local storage
    }
  }, []);

  useEffect(() => {
    const ids = Array.from(hiddenMetaPages);
    window.localStorage.setItem('smm.meta.hiddenPages', JSON.stringify(ids));
  }, [hiddenMetaPages]);

  const reloadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const data = await fetchSmmProfiles();
      setProfiles(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.marketingSmm.errors.profiles'));
    } finally {
      setLoadingProfiles(false);
    }
  };

  const reloadStats = async () => {
    if (!range.from || !range.to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSmmStats({
        from: range.from,
        to: range.to,
      });
      setStats(res);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.marketingSmm.errors.stats'));
    } finally {
      setLoading(false);
    }
  };

  const reloadCompareStats = async () => {
    if (!range.from || !range.to) return;
    setCompareLoading(true);
    try {
      const start = new Date(`${range.from}T00:00:00Z`);
      const end = new Date(`${range.to}T00:00:00Z`);
      const days =
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const prevEnd = new Date(start);
      prevEnd.setUTCDate(start.getUTCDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setUTCDate(prevEnd.getUTCDate() - (days - 1));

      const prevRange = {
        from: prevStart.toISOString().slice(0, 10),
        to: prevEnd.toISOString().slice(0, 10),
      };
      const res = await fetchSmmStats(prevRange);
      setCompareStats(res);
    } catch (e: any) {
      console.error(e);
      setCompareStats(null);
    } finally {
      setCompareLoading(false);
    }
  };

  const loadMetaAssets = async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const data = await fetchMetaAssets();
      setMetaAssets(data);
    } catch (err: any) {
      setMetaError(err?.message || t('crm.marketingSmm.errors.metaAssets'));
    } finally {
      setMetaLoading(false);
    }
  };

  const connectMeta = async () => {
    setMetaError(null);
    setMetaStatus(null);
    try {
      const { url } = await getMetaAuthUrl('/app/marketing/smm');
      window.location.href = url;
    } catch (err: any) {
      setMetaError(err?.message || t('crm.marketingSmm.errors.metaConnect'));
    }
  };

  const handleConnectAsset = async (payload: { platform: 'facebook' | 'instagram'; pageId?: string; igUserId?: string }) => {
    setMetaStatus(null);
    setMetaError(null);
    try {
      await connectMetaProfile(payload);
      await reloadProfiles();
      await reloadStats();
      setMetaStatus(t('crm.marketingSmm.meta.profileAdded'));
    } catch (err: any) {
      setMetaError(err?.message || t('crm.marketingSmm.errors.metaAdd'));
    }
  };

  const handleDisconnectProfile = async (profileId: string) => {
    setMetaStatus(null);
    setMetaError(null);
    try {
      await deleteSmmProfile(profileId);
      await reloadProfiles();
      await reloadStats();
      setMetaStatus(t('crm.marketingSmm.meta.profileRemoved'));
    } catch (err: any) {
      setMetaError(err?.message || t('crm.marketingSmm.errors.metaRemove'));
    }
  };

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const columnDrag = useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const renderProfileCell = (
    p: SmmProfile,
    s: SmmProfileLastStat | null | undefined,
    columnId: string,
  ) => {
    switch (columnId) {
      case 'profile':
        return <span className="font-medium text-neutral-900">@{p.handle}</span>;
      case 'platform':
        return <span className="text-neutral-600">{platformLabel(p.platform)}</span>;
      case 'followers':
        return s
          ? s.followers.toLocaleString(locale)
          : t('crm.marketingSmm.compare.dash');
      case 'reachLikesComments':
        return s
          ? `${s.reach.toLocaleString(locale)} / ${s.likes.toLocaleString(
              locale,
            )} / ${s.comments.toLocaleString(locale)}`
          : t('crm.marketingSmm.compare.dash');
      case 'erViews':
        return s
          ? `${s.reach ? (((s.likes + s.comments) / s.reach) * 100).toFixed(2) : '0.00'}% / ${s.videoViews.toLocaleString(
              locale,
            )}`
          : t('crm.marketingSmm.compare.dash');
      case 'date':
        return s?.date || t('crm.marketingSmm.compare.dash');
      case 'actions':
        return (
          <button
            type="button"
            onClick={() => handleDeleteProfile(p)}
            className="rounded-lg border border-neutral-200 px-2 py-1 text-[10px] text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            {t('crm.marketingSmm.profiles.delete')}
          </button>
        );
      default:
        return null;
    }
  };

  const handleSyncMetaNow = async (days?: number) => {
    setMetaSyncLoading(true);
    setMetaError(null);
    setMetaStatus(null);
    try {
      const res = await syncMetaNow(days ? { days } : undefined);
      await reloadProfiles();
      await reloadStats();
      const scope = res.days
        ? t('crm.marketingSmm.meta.scope.days', { days: res.days })
        : t('crm.marketingSmm.meta.scope.today');
      setMetaStatus(
        t('crm.marketingSmm.meta.syncStatus', {
          scope,
          synced: res.synced,
          skipped: res.skipped,
          errors: res.errors,
        }),
      );
    } catch (err: any) {
      setMetaError(err?.message || t('crm.marketingSmm.errors.metaSync'));
    } finally {
      setMetaSyncLoading(false);
    }
  };

  const handleHideMetaPage = (pageId: string) => {
    setHiddenMetaPages((prev) => {
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
  };

  const handleResetHiddenPages = () => {
    setHiddenMetaPages(new Set());
  };

  // ------ загрузка профилей

  useEffect(() => {
    void reloadProfiles();
  }, []);

  // ------ загрузка статов

  useEffect(() => {
    if (!range.from || !range.to) return;
    void reloadStats();
    void reloadCompareStats();
  }, [range.from, range.to]);

  useEffect(() => {
    void loadMetaAssets();
  }, []);

  // ------ агрегаты

  const latestFollowersByProfile = useMemo(() => {
    const map = new Map<string, { followers: number; platform: SmmPlatform }>();
    if (!stats?.items?.length) return map;

    // предполагаем, что items по дате уже отсортированы ASC на бэке
    for (const row of stats.items) {
      map.set(row.profileId, {
        followers: row.followers || 0,
        platform: row.platform || 'other',
      });
    }
    return map;
  }, [stats]);

  const latestFollowersByProfileCompare = useMemo(() => {
    const map = new Map<string, { followers: number; platform: SmmPlatform }>();
    if (!compareStats?.items?.length) return map;

    for (const row of compareStats.items) {
      map.set(row.profileId, {
        followers: row.followers || 0,
        platform: row.platform || 'other',
      });
    }
    return map;
  }, [compareStats]);

  const getConnectedFacebookProfile = (pageId: string) =>
    profiles.find(
      (p) =>
        p.platform === 'facebook' &&
        p.meta?.provider === 'meta' &&
        p.meta?.pageId === pageId,
    ) || null;

  const getConnectedInstagramProfile = (igUserId: string) =>
    profiles.find(
      (p) =>
        p.platform === 'instagram' &&
        p.meta?.provider === 'meta' &&
        p.meta?.igUserId === igUserId,
    ) || null;

  const totalFollowers = useMemo(() => {
    let sum = 0;
    for (const v of latestFollowersByProfile.values()) {
      sum += v.followers;
    }
    return sum;
  }, [latestFollowersByProfile]);

  const compareTotalFollowers = useMemo(() => {
    let sum = 0;
    for (const v of latestFollowersByProfileCompare.values()) {
      sum += v.followers;
    }
    return sum;
  }, [latestFollowersByProfileCompare]);

  // прирост фолловеров за период: берём первые и последние значения по каждому профилю
  const followersDeltaTotal = useMemo(() => {
    if (!stats?.items?.length) return 0;

    const firstByProfile = new Map<string, number>();
    const lastByProfile = new Map<string, number>();

    for (const row of stats.items) {
      if (!firstByProfile.has(row.profileId)) {
        firstByProfile.set(row.profileId, row.followers || 0);
      }
      lastByProfile.set(row.profileId, row.followers || 0);
    }

    let delta = 0;
    for (const [id, first] of firstByProfile.entries()) {
      const last = lastByProfile.get(id) ?? first;
      delta += last - first;
    }
    return delta;
  }, [stats]);

  const compareFollowersDeltaTotal = useMemo(() => {
    if (!compareStats?.items?.length) return 0;

    const firstByProfile = new Map<string, number>();
    const lastByProfile = new Map<string, number>();

    for (const row of compareStats.items) {
      if (!firstByProfile.has(row.profileId)) {
        firstByProfile.set(row.profileId, row.followers || 0);
      }
      lastByProfile.set(row.profileId, row.followers || 0);
    }

    let delta = 0;
    for (const [id, first] of firstByProfile.entries()) {
      const last = lastByProfile.get(id) ?? first;
      delta += last - first;
    }
    return delta;
  }, [compareStats]);

  const totalImpressions = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.impressions || 0), 0);
  }, [stats]);

  const compareTotalImpressions = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    return compareStats.items.reduce((s, r) => s + (r.impressions || 0), 0);
  }, [compareStats]);

  const totalReach = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.reach || 0), 0);
  }, [stats]);

  const compareTotalReach = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    return compareStats.items.reduce((s, r) => s + (r.reach || 0), 0);
  }, [compareStats]);

  const totalLikes = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.likes || 0), 0);
  }, [stats]);

  const compareTotalLikes = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    return compareStats.items.reduce((s, r) => s + (r.likes || 0), 0);
  }, [compareStats]);

  const totalComments = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.comments || 0), 0);
  }, [stats]);

  const compareTotalComments = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    return compareStats.items.reduce((s, r) => s + (r.comments || 0), 0);
  }, [compareStats]);

  const totalVideoViews = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.videoViews || 0), 0);
  }, [stats]);

  const compareTotalVideoViews = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    return compareStats.items.reduce((s, r) => s + (r.videoViews || 0), 0);
  }, [compareStats]);

  const totalEngagementRate = useMemo(() => {
    if (!stats?.items?.length) return 0;
    const totalEngagement = stats.items.reduce(
      (s, r) => s + (r.likes || 0) + (r.comments || 0),
      0,
    );
    const base = totalReach || 0;
    if (!base) return 0;
    return (totalEngagement / base) * 100;
  }, [stats, totalReach]);

  const compareEngagementRate = useMemo(() => {
    if (!compareStats?.items?.length) return 0;
    const totalEngagement = compareStats.items.reduce(
      (s, r) => s + (r.likes || 0) + (r.comments || 0),
      0,
    );
    const base = compareTotalReach || 0;
    if (!base) return 0;
    return (totalEngagement / base) * 100;
  }, [compareStats, compareTotalReach]);

  const hasCompareData = Boolean(compareStats?.items?.length);

  const formatDelta = (current: number, previous: number) => {
    if (!previous && previous !== 0) return t('crm.marketingSmm.compare.dash');
    if (!previous && !current) return t('crm.marketingSmm.compare.dash');
    if (!previous) {
      return `+${current.toLocaleString(locale)}`;
    }
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toLocaleString(locale)} (${sign}${pct.toFixed(1)}%)`;
  };

  const renderCompare = (current: number, previous: number) => {
    if (compareLoading) return t('crm.marketingSmm.compare.loading');
    if (!hasCompareData) return t('crm.marketingSmm.compare.noData');
    return formatDelta(current, previous);
  };

  // ------ данные для графика

  const chartData: FollowersChartPoint[] = useMemo(() => {
    if (!stats?.items?.length) return [];

    const byDate = new Map<string, FollowersChartPoint>();

    for (const row of stats.items) {
      const date = row.date;
      const platform: SmmPlatform = row.platform || 'other';

      const point =
        byDate.get(date) ||
        (() => {
          const base = { date } as FollowersChartPoint;
          CHART_PLATFORMS.forEach((p) => {
            (base as any)[p] = 0;
          });
          return base;
        })();

      const platformKey = platform as keyof FollowersChartPoint;
      const metricValue =
        chartMetric === 'followers'
          ? row.followers
          : chartMetric === 'reach'
            ? row.reach
            : chartMetric === 'likes'
              ? row.likes
              : chartMetric === 'comments'
                ? row.comments
                : row.videoViews;
      (point as any)[platformKey] =
        Number((point as any)[platformKey] || 0) + Number(metricValue || 0);

      byDate.set(date, point);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [stats, chartMetric]);

  const chartDataWithCompare: FollowersChartPoint[] = useMemo(() => {
    if (!compareStats?.items?.length || chartData.length === 0) return chartData;

    const byDate = new Map<string, FollowersChartPoint>();
    for (const row of compareStats.items) {
      const date = row.date;
      const platform: SmmPlatform = row.platform || 'other';
      if (!CHART_PLATFORMS.includes(platform)) continue;

      const point =
        byDate.get(date) ||
        (() => {
          const base = { date } as FollowersChartPoint;
          CHART_PLATFORMS.forEach((p) => {
            (base as any)[p] = 0;
          });
          return base;
        })();

      const platformKey = platform as keyof FollowersChartPoint;
      const metricValue =
        chartMetric === 'followers'
          ? row.followers
          : chartMetric === 'reach'
            ? row.reach
            : chartMetric === 'likes'
              ? row.likes
              : chartMetric === 'comments'
                ? row.comments
                : row.videoViews;
      (point as any)[platformKey] =
        Number((point as any)[platformKey] || 0) + Number(metricValue || 0);
      byDate.set(date, point);
    }

    const comparePoints = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return chartData.map((point, index) => {
      const comparePoint = comparePoints[index];
      if (!comparePoint) return point;
      const next = { ...point } as FollowersChartPoint;
      CHART_PLATFORMS.forEach((platform) => {
        (next as any)[`${platform}Prev`] = (comparePoint as any)[platform] || 0;
      });
      return next;
    });
  }, [compareStats, chartData, chartMetric]);

  const profileTotals = useMemo(() => {
    const map = new Map<string, SmmProfileLastStat>();
    if (!stats?.items?.length) return map;

    for (const row of stats.items) {
      const existing = map.get(row.profileId);
      if (!existing) {
        map.set(row.profileId, {
          date: row.date,
          followers: row.followers || 0,
          impressions: row.impressions || 0,
          reach: row.reach || 0,
          profileViews: row.profileViews || 0,
          likes: row.likes || 0,
          comments: row.comments || 0,
          videoViews: row.videoViews || 0,
        });
        continue;
      }

      existing.date = row.date;
      existing.followers = row.followers || existing.followers;
      existing.impressions += row.impressions || 0;
      existing.reach += row.reach || 0;
      existing.profileViews += row.profileViews || 0;
      existing.likes += row.likes || 0;
      existing.comments += row.comments || 0;
      existing.videoViews += row.videoViews || 0;
    }

    return map;
  }, [stats]);

  const tableProfiles = useMemo(
    () => profiles.filter((p) => !['tiktok', 'other'].includes(p.platform)),
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return tableProfiles.filter((p) => {
      if (platformFilter !== 'all' && p.platform !== platformFilter) {
        return false;
      }
      if (!normalized) return true;
      return p.handle.toLowerCase().includes(normalized);
    });
  }, [tableProfiles, searchQuery, platformFilter]);

  const pagedProfiles = useMemo(
    () => filteredProfiles.slice(0, visibleCount),
    [filteredProfiles, visibleCount],
  );

  const canLoadMore = filteredProfiles.length > visibleCount;

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, platformFilter]);

  const platformTotals = useMemo(() => {
    const totals = new Map<SmmPlatform, SmmProfileLastStat>();
    if (!stats?.items?.length) return totals;

    for (const row of stats.items) {
      const platform = row.platform || 'other';
      const existing = totals.get(platform);
      if (!existing) {
        totals.set(platform, {
          date: row.date,
          followers: row.followers || 0,
          impressions: row.impressions || 0,
          reach: row.reach || 0,
          profileViews: row.profileViews || 0,
          likes: row.likes || 0,
          comments: row.comments || 0,
          videoViews: row.videoViews || 0,
        });
        continue;
      }
      existing.date = row.date;
      existing.followers += row.followers || 0;
      existing.impressions += row.impressions || 0;
      existing.reach += row.reach || 0;
      existing.profileViews += row.profileViews || 0;
      existing.likes += row.likes || 0;
      existing.comments += row.comments || 0;
      existing.videoViews += row.videoViews || 0;
    }

    return totals;
  }, [stats]);

  const zeroMetricNotes = useMemo(() => {
    if (!stats?.items?.length) return [];
    const notes: string[] = [];

    const ig = platformTotals.get('instagram');
    if (ig) {
      if (ig.videoViews === 0) {
        notes.push(t('crm.marketingSmm.zeroNotes.igVideo'));
      }
      if (ig.likes === 0 && ig.comments === 0 && ig.reach > 0) {
        notes.push(t('crm.marketingSmm.zeroNotes.igEngagement'));
      }
    }

    const fb = platformTotals.get('facebook');
    if (fb) {
      if (fb.reach === 0 && fb.impressions === 0) {
        notes.push(t('crm.marketingSmm.zeroNotes.fbReach'));
      }
    }

    return notes;
  }, [platformTotals, stats]);

  // ------ создание профиля

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.handle.trim()) return;

    try {
      setSavingProfile(true);
      const created = await createSmmProfile({
        platform: form.platform,
        handle: form.handle.trim(),
        url: form.url.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setProfiles((prev) => [...prev, { ...created, lastStat: null }]);
      setForm((prev) => ({
        ...prev,
        handle: '',
        url: '',
        note: '',
      }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('crm.marketingSmm.errors.createProfile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (p: SmmProfile) => {
    if (!window.confirm(t('crm.marketingSmm.profiles.confirmDelete', { platform: platformLabel(p.platform), handle: p.handle }))) {
      return;
    }
    try {
      await deleteSmmProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('crm.marketingSmm.errors.deleteProfile'));
    }
  };

  // ------ render

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingSmm.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingSmm.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingSmm.subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.marketingSmm.periodLabel')}
              </span>
              {(['7d', '30d', '90d'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (preset === p
                      ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                  }
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
            {range.from && range.to && (
              <div className="text-[10px] text-slate-500 text-right">
                {range.from} → {range.to}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIntegrationsOpen(true)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 hover:border-slate-300"
              >
                {t('crm.marketingSmm.integrations.kicker')}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {metaError && (
          <div className="text-[11px] text-rose-500">{metaError}</div>
        )}

        {metaStatus && (
          <div className="text-[11px] text-emerald-500">{metaStatus}</div>
        )}

        {/* KPI блоки */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-3xl bg-white border border-slate-200 px-4 py-4 flex flex-col justify-between shadow-sm">
            <div className="text-[11px] text-slate-500 mb-1">
              {t('crm.marketingSmm.kpi.activeProfiles')}
            </div>
            <div className="text-2xl font-semibold text-slate-900">
              {profiles.length.toLocaleString(locale)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              {t('crm.marketingSmm.kpi.activeProfilesHint')}
            </div>
          </div>

          <div className="rounded-3xl bg-sky-50 border border-sky-100 px-4 py-4 flex flex-col justify-between shadow-sm">
            <div className="text-[11px] text-sky-600 mb-1">
              {t('crm.marketingSmm.kpi.followersCurrent')}
            </div>
            <div className="text-2xl font-semibold text-sky-700">
              {totalFollowers.toLocaleString(locale)}
            </div>
            <div className="text-[11px] text-sky-700/70 mt-1">
              {t('crm.marketingSmm.compareLabel')}: {renderCompare(totalFollowers, compareTotalFollowers)}
            </div>
            <div className="text-[11px] text-sky-700/70 mt-2">
              {t('crm.marketingSmm.kpi.followersHint')}
            </div>
          </div>

          <div className="rounded-3xl bg-emerald-50 border border-emerald-100 px-4 py-4 flex flex-col justify-between shadow-sm">
            <div className="text-[11px] text-emerald-600 mb-1">
              {t('crm.marketingSmm.kpi.followersDelta')}
            </div>
            <div className="text-2xl font-semibold text-emerald-700">
              {followersDeltaTotal >= 0 ? '+' : ''}
              {followersDeltaTotal.toLocaleString(locale)}
            </div>
            <div className="text-[11px] text-emerald-700/70 mt-1">
              {t('crm.marketingSmm.compareLabel')}: {renderCompare(followersDeltaTotal, compareFollowersDeltaTotal)}
            </div>
            <div className="text-[11px] text-emerald-700/70 mt-2">
              {t('crm.marketingSmm.kpi.followersDeltaHint')}
            </div>
          </div>

          <div className="rounded-3xl bg-rose-50 border border-rose-100 px-4 py-4 flex flex-col justify-between shadow-sm">
            <div className="text-[11px] text-rose-600 mb-1">
              {t('crm.marketingSmm.kpi.reachEngagement')}
            </div>
            <div className="text-sm font-semibold text-rose-700">
              {t('crm.marketingSmm.kpi.reachLabel')}:{' '}
              <span className="text-lg">
                {totalReach.toLocaleString(locale)}
              </span>
            </div>
            <div className="text-[11px] text-rose-700/70 mt-1">
              {t('crm.marketingSmm.compareLabel')}: {renderCompare(totalReach, compareTotalReach)}
            </div>
            <div className="text-[11px] text-rose-700/70 mt-1">
              {t('crm.marketingSmm.kpi.videoViewsLabel')}: {totalVideoViews.toLocaleString(locale)}
            </div>
            <div className="text-[11px] text-rose-700/70 mt-1">
              {t('crm.marketingSmm.kpi.likesLabel')}: {totalLikes.toLocaleString(locale)} · {t('crm.marketingSmm.kpi.commentsLabel')}: {totalComments.toLocaleString(locale)}
            </div>
            <div className="text-[11px] text-rose-700/70 mt-1">
              {t('crm.marketingSmm.kpi.erLabel')}: {totalEngagementRate.toFixed(2)}% · {t('crm.marketingSmm.compareLabel')}: {renderCompare(totalEngagementRate, compareEngagementRate)}
            </div>
            <div className="text-[11px] text-rose-700/60 mt-1">
              {t('crm.marketingSmm.kpi.totalHint')}
            </div>
          </div>
        </section>

        {zeroMetricNotes.length > 0 && (
          <div
            className="rounded-2xl border bg-white px-4 py-3 text-[11px] text-neutral-600 shadow-sm"
            style={{ borderColor: `${SMM_PANEL_ACCENT}18` }}
          >
            {zeroMetricNotes.map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
        )}

        {/* График + список профилей */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)] md:gap-5">
          {/* График фолловеров */}
          <div
            className="rounded-3xl border bg-white px-4 py-4 shadow-sm md:px-5 md:py-5"
            style={{ borderColor: `${SMM_PANEL_ACCENT}18` }}
          >
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {t('crm.marketingSmm.chart.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {t('crm.marketingSmm.chart.subtitle')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {([
                  { key: 'followers', label: t('crm.marketingSmm.chart.metrics.followers') },
                  { key: 'reach', label: t('crm.marketingSmm.chart.metrics.reach') },
                  { key: 'likes', label: t('crm.marketingSmm.chart.metrics.likes') },
                  { key: 'comments', label: t('crm.marketingSmm.chart.metrics.comments') },
                  { key: 'videoViews', label: t('crm.marketingSmm.chart.metrics.videoViews') },
                ] as { key: ChartMetric; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setChartMetric(m.key)}
                    className={
                      'rounded-full border px-2.5 py-1 text-[10px] transition ' +
                      (chartMetric === m.key
                        ? 'font-medium text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                    }
                    style={
                      chartMetric === m.key
                        ? { backgroundColor: SMM_PANEL_ACCENT, borderColor: SMM_PANEL_ACCENT }
                        : undefined
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 md:h-72">
              {loading && (
                <div className="text-[11px] text-neutral-500">
                  {t('crm.marketingSmm.chart.loading')}
                </div>
              )}
              {!loading && chartData.length === 0 && (
                <div className="text-[11px] text-neutral-500">
                  {t('crm.marketingSmm.chart.empty')}
                </div>
              )}
              {!loading && chartData.length > 0 && (
                <ResponsiveContainer>
                  <LineChart
                    data={chartDataWithCompare}
                    margin={{ top: 10, right: 16, left: -16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e5e7eb"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={52}
                    />
                    <Tooltip content={<FollowersTooltip locale={locale} />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10, color: '#334155' }}
                    />

                    {CHART_PLATFORMS.map((platform) => (
                      <Line
                        key={platform}
                        type="monotone"
                        dataKey={platform}
                        name={platformLabel(platform)}
                        stroke={PLATFORM_COLORS[platform]}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                        strokeWidth={1.6}
                        isAnimationActive={false}
                      />
                    ))}
                    {compareStats?.items?.length
                      ? CHART_PLATFORMS.map((platform) => (
                        <Line
                          key={`${platform}-prev`}
                          type="monotone"
                          dataKey={`${platform}Prev`}
                          name={`${platformLabel(platform)} ${t('crm.marketingSmm.chart.prevSuffix')}`}
                          stroke={PLATFORM_COLORS[platform]}
                          strokeDasharray="4 4"
                          strokeOpacity={0.4}
                          dot={false}
                          strokeWidth={1.6}
                          isAnimationActive={false}
                        />
                      ))
                      : null}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Профили + форма добавления */}
          <div
            className="flex flex-col gap-4 rounded-3xl border bg-white px-4 py-4 text-xs shadow-sm md:px-5 md:py-5"
            style={{ borderColor: `${SMM_PANEL_ACCENT}18` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {activeTab === 'profiles'
                    ? t('crm.marketingSmm.profiles.title')
                    : t('crm.marketingSmm.integrations.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {activeTab === 'profiles'
                    ? t('crm.marketingSmm.profiles.subtitle')
                    : t('crm.marketingSmm.integrations.subtitle')}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profiles')}
                  className={
                    'rounded-full border px-3 py-1 text-[10px] transition ' +
                    (activeTab === 'profiles'
                      ? 'font-medium text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                  style={
                    activeTab === 'profiles'
                      ? { backgroundColor: SMM_PANEL_ACCENT, borderColor: SMM_PANEL_ACCENT }
                      : undefined
                  }
                >
                  {t('crm.marketingSmm.profiles.tabs.profiles')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('integrations')}
                  className={
                    'rounded-full border px-3 py-1 text-[10px] transition ' +
                    (activeTab === 'integrations'
                      ? 'font-medium text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                  }
                  style={
                    activeTab === 'integrations'
                      ? { backgroundColor: SMM_PANEL_ACCENT, borderColor: SMM_PANEL_ACCENT }
                      : undefined
                  }
                >
                  {t('crm.marketingSmm.profiles.tabs.integrations')}
                </button>
              </div>
              {activeTab === 'profiles' && (
                <span className="text-[11px] text-neutral-500">
                  {t('crm.marketingSmm.profiles.shown', {
                    shown: pagedProfiles.length,
                    total: filteredProfiles.length,
                  })}
                </span>
              )}
            </div>

            {activeTab === 'profiles' && (
              <>
                <div
                  className="flex flex-col gap-3 rounded-2xl border bg-neutral-50/50 p-3 md:flex-row md:items-center md:justify-between"
                  style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                >
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-900 outline-none transition focus:border-neutral-400"
                      placeholder={t('crm.marketingSmm.profiles.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <select
                      className="rounded-xl border border-neutral-200 bg-white px-2 py-2 text-[11px] text-neutral-900 outline-none"
                      value={platformFilter}
                      onChange={(e) =>
                        setPlatformFilter(e.target.value as SmmPlatform | 'all')
                      }
                    >
                      <option value="all">{t('crm.marketingSmm.profiles.filterAll')}</option>
                      <option value="instagram">{t('crm.marketingSmm.platforms.instagram')}</option>
                      <option value="facebook">{t('crm.marketingSmm.platforms.facebook')}</option>
                      <option value="vk">{t('crm.marketingSmm.platforms.vk')}</option>
                      <option value="telegram">{t('crm.marketingSmm.platforms.telegram')}</option>
                    </select>
                  </div>
                </div>

                <form
                  onSubmit={handleCreateProfile}
                  className="flex flex-col gap-2 rounded-2xl border bg-neutral-50/50 p-3 md:flex-row md:items-end"
                  style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {t('crm.marketingSmm.profiles.form.platform')}
                    </label>
                    <select
                      className="rounded-xl border border-neutral-200 bg-white px-2 py-1.5 text-[11px] text-neutral-900 outline-none"
                      value={form.platform}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          platform: e.target
                            .value as unknown as SmmPlatform,
                        }))
                      }
                    >
                      <option value="instagram">{t('crm.marketingSmm.platforms.instagram')}</option>
                      <option value="facebook">{t('crm.marketingSmm.platforms.facebook')}</option>
                    </select>
                  </div>

                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {t('crm.marketingSmm.profiles.form.handle')}
                    </label>
                    <input
                      className="rounded-xl border border-neutral-200 bg-white px-2 py-1.5 text-[11px] text-neutral-900 outline-none"
                      placeholder={t('crm.marketingSmm.profiles.form.handlePlaceholder')}
                      value={form.handle}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, handle: e.target.value }))
                      }
                    />
                  </div>

                  <div className="hidden md:flex md:flex-1 md:flex-col md:gap-1">
                    <label className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {t('crm.marketingSmm.profiles.form.url')}
                    </label>
                    <input
                      className="rounded-xl border border-neutral-200 bg-white px-2 py-1.5 text-[11px] text-neutral-900 outline-none"
                      placeholder={t('crm.marketingSmm.profiles.form.urlPlaceholder')}
                      value={form.url}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, url: e.target.value }))
                      }
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!form.handle.trim() || savingProfile}
                    className="rounded-xl px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: SMM_PANEL_ACCENT }}
                  >
                    {savingProfile
                      ? t('crm.marketingSmm.profiles.form.adding')
                      : t('crm.marketingSmm.profiles.form.add')}
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px] table-fixed text-neutral-800">
                    <thead>
                      <tr
                        className="border-b text-neutral-500"
                        style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                      >
                        {orderedColumns.map((col) => {
                          const fallback =
                            col.id === 'profile'
                              ? 200
                              : col.id === 'platform'
                                ? 140
                                : col.id === 'followers'
                                  ? 120
                                  : col.id === 'reachLikesComments'
                                    ? 220
                                    : col.id === 'erViews'
                                      ? 180
                                      : col.id === 'date'
                                        ? 140
                                        : 140;
                          const width = columnWidths[col.id] ?? fallback;
                          const alignRight = !['profile', 'platform'].includes(col.id);
                          return (
                            <th
                              key={col.id}
                              {...columnDrag.getThProps(
                                col.id,
                                typeof col.label === 'string' ? col.label : String(col.label),
                                `py-1.5 px-3 font-normal relative group/colhdr select-none transition-colors duration-150 ${
                                  alignRight ? 'text-right' : 'text-left'
                                }`,
                              )}
                              style={{ width, minWidth: width }}
                            >
                              <div
                                className={`flex min-h-[28px] items-center gap-2 ${
                                  alignRight ? 'justify-end' : ''
                                }`}
                              >
                                <span className="text-[10px] text-neutral-400 opacity-0 group-hover/colhdr:opacity-100 transition-opacity">
                                  ⋮⋮
                                </span>
                                <span>{col.label}</span>
                              </div>
                              <div
                                data-col-resize
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover/colhdr:opacity-100"
                                onMouseDown={(e) => startResize(col.id, e)}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingProfiles && (
                        <tr>
                          <td
                            colSpan={orderedColumns.length}
                            className="py-3 text-center text-neutral-500"
                          >
                            {t('crm.marketingSmm.profiles.table.loading')}
                          </td>
                        </tr>
                      )}

                      {!loadingProfiles && filteredProfiles.length === 0 && (
                        <tr>
                          <td
                            colSpan={orderedColumns.length}
                            className="py-3 text-center text-neutral-500"
                          >
                            {t('crm.marketingSmm.profiles.table.empty')}
                          </td>
                        </tr>
                      )}

                      {!loadingProfiles &&
                        pagedProfiles.map((p) => {
                          const totals = profileTotals.get(p.id);
                          const s =
                            totals ||
                            ((p as any).lastStat as
                              | SmmProfileLastStat
                              | null
                              | undefined);
                          return (
                            <tr
                              key={p.id}
                              className="border-b border-neutral-100 transition-colors last:border-none hover:bg-neutral-50"
                            >
                              {orderedColumns.map((col) => {
                                const fallback =
                                  col.id === 'profile'
                                    ? 200
                                    : col.id === 'platform'
                                      ? 140
                                      : col.id === 'followers'
                                        ? 120
                                        : col.id === 'reachLikesComments'
                                          ? 220
                                          : col.id === 'erViews'
                                            ? 180
                                            : col.id === 'date'
                                              ? 140
                                              : 140;
                                const width = columnWidths[col.id] ?? fallback;
                                const alignRight = !['profile', 'platform'].includes(col.id);
                                return (
                                  <td
                                    key={col.id}
                                    className={`py-1.5 px-3 ${
                                      alignRight ? 'text-right' : 'text-left'
                                    }`}
                                    style={{ width, minWidth: width }}
                                  >
                                    {renderProfileCell(p, s, col.id)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {canLoadMore && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 20)}
                    className="self-center rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-[11px] text-neutral-700 transition hover:border-neutral-300"
                  >
                    {t('crm.marketingSmm.profiles.loadMore')}
                  </button>
                )}
            </>
          )}

            {activeTab === 'integrations' && (
              <div className="space-y-3">
                <div
                  className="rounded-2xl border bg-neutral-50/50 p-4"
                  style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        {t('crm.marketingSmm.integrations.connections')}
                      </div>
                      <div className="mt-1 text-sm text-neutral-900">
                        {t('crm.marketingSmm.integrations.metaStatus', {
                          status: metaConnected
                            ? t('crm.marketingSmm.meta.connected')
                            : t('crm.marketingSmm.meta.disconnected'),
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIntegrationsOpen(true)}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] text-neutral-800 transition hover:border-neutral-300"
                    >
                      {t('crm.marketingSmm.integrations.manage')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div
                    className="rounded-2xl border bg-neutral-50/50 p-4"
                    style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {t('crm.marketingSmm.integrations.vkTitle')}
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-600">
                      {t('crm.marketingSmm.integrations.inDev')}
                    </div>
                  </div>
                  <div
                    className="rounded-2xl border bg-neutral-50/50 p-4"
                    style={{ borderColor: `${SMM_PANEL_ACCENT}14` }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {t('crm.marketingSmm.integrations.telegramTitle')}
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-600">
                      {t('crm.marketingSmm.integrations.inDev')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {integrationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSmm.integrations.kicker')}
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  {t('crm.marketingSmm.popup.title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIntegrationsOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500 hover:border-slate-300"
              >
                {t('crm.marketingSmm.popup.close')}
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                    M
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {t('crm.marketingSmm.popup.metaTitle')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t('crm.marketingSmm.popup.statusLabel', {
                        status: metaConnected
                          ? t('crm.marketingSmm.meta.connected')
                          : t('crm.marketingSmm.meta.disconnected'),
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={connectMeta}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 hover:border-slate-300"
                  >
                    {metaConnected
                      ? t('crm.marketingSmm.popup.reconnect')
                      : t('crm.marketingSmm.popup.connect')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSyncMetaNow()}
                    className="rounded-xl border border-slate-200 bg-black px-3 py-2 text-[11px] text-white hover:bg-slate-900 disabled:opacity-60"
                    disabled={metaSyncLoading}
                  >
                    {metaSyncLoading
                      ? t('crm.marketingSmm.popup.syncing')
                      : t('crm.marketingSmm.popup.syncNow')}
                  </button>
                  <button
                    type="button"
                    onClick={loadMetaAssets}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 hover:border-slate-300"
                  >
                    {t('crm.marketingSmm.popup.accountList')}
                  </button>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 max-h-[42vh] overflow-y-auto">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {t('crm.marketingSmm.popup.accountsTitle')}
                    {hiddenMetaPages.size > 0 && (
                      <button
                        type="button"
                        onClick={handleResetHiddenPages}
                        className="ml-2 text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        {t('crm.marketingSmm.popup.showHidden')}
                      </button>
                    )}
                  </div>
                  {metaLoading && (
                    <div className="text-[11px] text-slate-500 mt-2">
                      {t('crm.marketingSmm.popup.loading')}
                    </div>
                  )}
                  {!metaLoading && (!metaAssets || metaAssets.pages.length === 0) && (
                    <div className="text-[11px] text-slate-500 mt-2">
                      {t('crm.marketingSmm.popup.empty')}
                    </div>
                  )}
                  {!metaLoading && metaAssets && metaAssets.pages.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {metaAssets.pages
                        .filter((page) => !hiddenMetaPages.has(page.id))
                        .map((page) => (
                          <div key={page.id} className="rounded-xl border border-slate-200 px-3 py-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="text-[11px] text-slate-900 truncate">{page.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {page.link || t('crm.marketingSmm.popup.facebookPage')}
                                </div>
                                {page.instagramBusinessId && (
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {t('crm.marketingSmm.popup.instagramPrefix', {
                                      handle: page.instagramUsername || page.instagramBusinessId,
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleHideMetaPage(page.id)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-500 hover:border-slate-300"
                                >
                                  {t('crm.marketingSmm.popup.hide')}
                                </button>
                                {getConnectedFacebookProfile(page.id) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectProfile(getConnectedFacebookProfile(page.id)!.id)}
                                  className="rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-1.5 text-[10px] text-rose-600 hover:border-rose-400"
                                >
                                    {t('crm.marketingSmm.popup.disconnectFacebook')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleConnectAsset({ platform: 'facebook', pageId: page.id })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-700 hover:border-slate-300"
                                >
                                    {t('crm.marketingSmm.popup.addFacebook')}
                                  </button>
                                )}
                                {page.instagramBusinessId ? (
                                  getConnectedInstagramProfile(page.instagramBusinessId) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDisconnectProfile(
                                          getConnectedInstagramProfile(
                                            page.instagramBusinessId as string,
                                          )!.id,
                                        )
                                      }
                                      className="rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-1.5 text-[10px] text-rose-600 hover:border-rose-400"
                                    >
                                      {t('crm.marketingSmm.popup.disconnectInstagram')}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleConnectAsset({
                                          platform: 'instagram',
                                          igUserId: page.instagramBusinessId as string,
                                        })
                                      }
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-700 hover:border-slate-300"
                                    >
                                      {t('crm.marketingSmm.popup.addInstagram')}
                                    </button>
                                  )
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
                      VK
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {t('crm.marketingSmm.popup.vkTitle')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.marketingSmm.popup.inDevLabel')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {t('crm.marketingSmm.popup.vkDesc')}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700">
                      TG
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {t('crm.marketingSmm.popup.tgTitle')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.marketingSmm.popup.inDevLabel')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {t('crm.marketingSmm.popup.tgDesc')}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                      TT
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {t('crm.marketingSmm.popup.tiktokTitle')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.marketingSmm.popup.soon')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {t('crm.marketingSmm.popup.tiktokDesc')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
