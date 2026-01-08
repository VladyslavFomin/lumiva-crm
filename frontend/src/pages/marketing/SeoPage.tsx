import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSeoSettings,
  updateSeoSettings,
  getGoogleAuthUrl,
  fetchSeoMetrics,
  syncSeo,
  type SeoSettings,
  type SeoMetricsResponse,
} from '../../api/seo';
import { createSite, deleteSite, fetchSites, type Site } from '../../api/sites';
import { getLocale } from '../../i18n/utils';

export const SeoPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [metrics, setMetrics] = useState<SeoMetricsResponse | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [newSiteDomain, setNewSiteDomain] = useState('');
  const [gscMetricKey, setGscMetricKey] = useState<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [periodPreset, setPeriodPreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingSite, setAddingSite] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingSite, setDeletingSite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchSeoSettings(), fetchSeoMetrics()])
      .then(([s, m]) => {
        if (!alive) return;
        setSettings(s);
        setMetrics(m);
        if (m?.gsc?.dateFrom && m?.gsc?.dateTo) {
          setDateFrom(m.gsc.dateFrom);
          setDateTo(m.gsc.dateTo);
        }
      })
      .catch((e: any) => {
        if (!alive) return;
        console.error(e);
        setError(e?.message || t('crm.marketingSeo.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setHoverIndex(null);
  }, [gscMetricKey]);

  useEffect(() => {
    fetchSites()
      .then((items) => {
        setSites(items);
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);

  const normalizeSiteUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    }
    return `https://${trimmed.replace(/\/+$/, '')}/`;
  };

  const buildRange = (days: number) => {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  };

  const applyPreset = (preset: '7' | '30' | '90') => {
    const range = buildRange(Number(preset));
    setDateFrom(range.from);
    setDateTo(range.to);
    setPeriodPreset(preset);
    void runSync({ from: range.from, to: range.to });
  };

  const normalizeDomain = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(withProto);
      return url.host;
    } catch {
      return trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateSeoSettings({
        gscPropertyUrl: settings.gscPropertyUrl,
        pageSpeedApiKey: settings.pageSpeedApiKey,
        pageSpeedUrl: settings.pageSpeedUrl,
        pageSpeedStrategy: settings.pageSpeedStrategy,
      });
      setSettings(updated);
      setStatus(t('crm.marketingSeo.status.saved'));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const connectGsc = async () => {
    setError(null);
    setStatus(null);
    try {
      const res = await getGoogleAuthUrl('/app/marketing/seo');
      window.location.href = res.url;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.oauth'));
    }
  };

  const runSync = async (override?: { from?: string; to?: string }) => {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const from = override?.from || dateFrom;
      const to = override?.to || dateTo;
      const result = await syncSeo({ dateFrom: from, dateTo: to, compare: compareEnabled });
      const fresh = await fetchSeoMetrics({ dateFrom: from, dateTo: to, compare: compareEnabled });
      setMetrics(fresh);
      if (fresh?.gsc?.dateFrom && fresh?.gsc?.dateTo) {
        setDateFrom(fresh.gsc.dateFrom);
        setDateTo(fresh.gsc.dateTo);
      }
      if (!result.gsc && settings?.gscPropertyUrl) {
        setError(t('crm.marketingSeo.errors.gscNotSynced'));
      } else if (!result.psi && settings?.pageSpeedUrl) {
        setError(t('crm.marketingSeo.errors.psiNotSynced'));
      } else {
        setStatus(t('crm.marketingSeo.status.updated'));
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.update'));
    } finally {
      setSyncing(false);
    }
  };

  const addSite = async () => {
    if (!newSiteDomain.trim()) {
      setError(t('crm.marketingSeo.errors.siteRequired'));
      return;
    }
    setAddingSite(true);
    setError(null);
    setStatus(null);
    try {
      const domain = normalizeDomain(newSiteDomain);
      const created = await createSite({ domain });
      const updated = await fetchSites();
      setSites(updated);
      setSelectedSite(created.id);
      if (settings) {
        const url = normalizeSiteUrl(created.domain);
        const propertyUrl =
          settings.gscPropertyUrl && settings.gscPropertyUrl.startsWith('sc-domain:')
            ? `sc-domain:${created.domain}`
            : url;
        setSettings({
          ...settings,
          gscPropertyUrl: propertyUrl,
          pageSpeedUrl: url,
        });
        await updateSeoSettings({
          gscPropertyUrl: propertyUrl,
          pageSpeedUrl: url,
        });
        await runSync({ from: dateFrom, to: dateTo });
      }
      setNewSiteDomain('');
      setStatus(t('crm.marketingSeo.status.siteAdded'));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.siteAdd'));
    } finally {
      setAddingSite(false);
    }
  };

  const applySiteSelection = async (siteId: string) => {
    if (!settings) return;
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
    const url = normalizeSiteUrl(site.domain);
    const propertyUrl =
      settings.gscPropertyUrl && settings.gscPropertyUrl.startsWith('sc-domain:')
        ? `sc-domain:${site.domain}`
        : url;
    const updated = {
      ...settings,
      gscPropertyUrl: propertyUrl,
      pageSpeedUrl: url,
    };
    setSettings(updated);
    setStatus(null);
    setError(null);
    setSaving(true);
    try {
      await updateSeoSettings({
        gscPropertyUrl: updated.gscPropertyUrl,
        pageSpeedUrl: updated.pageSpeedUrl,
      });
      await runSync();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.siteApply'));
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedSite = async () => {
    if (!selectedSite || selectedSite === '__add__') return;
    setDeletingSite(true);
    setError(null);
    setStatus(null);
    try {
      await deleteSite(selectedSite);
      const updated = await fetchSites();
      setSites(updated);
      setSelectedSite('');
      setStatus(t('crm.marketingSeo.status.siteDeleted'));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingSeo.errors.siteDelete'));
    } finally {
      setDeletingSite(false);
    }
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const DonutStat: React.FC<{ label: string; percent: number }> = ({
    label,
    percent,
  }) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clamp(percent, 0, 100) / 100) * circumference;
    return (
      <div className="group relative flex flex-col items-center gap-1.5">
        <svg width="80" height="80" className="rotate-[-90deg]">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="#111827"
            strokeWidth="10"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </svg>
        <div className="text-center">
          <div className="text-sm font-semibold text-black">
            {percent.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-500">{label}</div>
        </div>
        <div className="pointer-events-none absolute -top-2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
            {label}: {percent.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

  const formatGscValue = (value: number) => {
    if (gscMetricKey === 'ctr') return `${value.toFixed(2)}%`;
    if (gscMetricKey === 'position') return value.toFixed(2);
    if (gscMetricKey === 'impressions') return Math.round(value).toLocaleString(locale);
    return Math.round(value).toLocaleString(locale);
  };

  const formatAxisLabel = (value: number) => {
    if (gscMetricKey === 'ctr') return `${value.toFixed(1)}%`;
    if (gscMetricKey === 'position') return value.toFixed(1);
    if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
    return Math.round(value).toString();
  };

  const formatDateLabel = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return `${String(date.getUTCDate()).padStart(2, '0')}.${String(
      date.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
  };

  const renderTrendChart = (
    values: number[],
    labels: string[],
    idSuffix: string,
    compareValues?: number[],
  ) => {
    if (values.length < 2) return null;
    const w = 300;
    const h = 140;
    const pad = 18;
    const comparePool = compareValues && compareValues.length ? compareValues : [];
    const max = Math.max(...values, ...comparePool, 1);
    const min = Math.min(...values, ...comparePool, 0);
    const range = max - min || 1;
    const step = (w - pad * 2) / (values.length - 1);
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - 12 - ((v - min) / range) * (h - pad * 2 - 20);
      return { x, y };
    });
    const path = `M${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
    const areaPath = `${path} L ${points[points.length - 1].x},${h - pad} L ${points[0].x},${h - pad} Z`;
    const gradientId = `seoLineFill-${idSuffix}`;
    const comparePath = compareValues && compareValues.length === values.length
      ? `M${compareValues
          .map((v, i) => {
            const x = pad + i * step;
            const y = h - pad - ((v - min) / range) * (h - pad * 2);
            return `${x},${y}`;
          })
          .join(' L ')}`
      : null;
    const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
    const activeValue = hoverIndex !== null ? values[hoverIndex] : null;
    const compareValue =
      hoverIndex !== null && compareValues && compareValues.length > hoverIndex
        ? compareValues[hoverIndex]
        : null;
    const tooltipX = activePoint ? clamp(activePoint.x, 30, w - 30) : 0;
    const tooltipY = activePoint ? Math.max(activePoint.y - 22, 18) : 0;
    const mid = min + range / 2;
    const axisLeftX = 6;
    const axisLabels = [
      { y: pad + 6, value: max },
      { y: h / 2, value: mid },
      { y: h - pad - 8, value: min },
    ];
    const bottomLabelIndices = [0, Math.floor((labels.length - 1) / 2), labels.length - 1];
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-36 sm:h-40"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.16" />
            <stop offset="90%" stopColor="black" stopOpacity="0" />
          </linearGradient>
        </defs>
        {axisLabels.map((label, idx) => (
          <text
            key={idx}
            x={axisLeftX}
            y={label.y}
            fontSize="8"
            fill="#9ca3af"
            textAnchor="start"
          >
            {formatAxisLabel(label.value)}
          </text>
        ))}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="black" strokeWidth={2.4} strokeLinecap="round" />
        {comparePath && (
          <path d={comparePath} fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" />
        )}
        {activePoint && activeValue !== null && (
          <g>
            <rect
              x={tooltipX - 30}
              y={tooltipY - 22}
              width={60}
              height={compareValue !== null ? 36 : 22}
              rx={6}
              fill="white"
              stroke="#e5e7eb"
            />
            <text
              x={tooltipX}
              y={tooltipY - 8}
              textAnchor="middle"
              fontSize="8"
              fill="#111827"
            >
              {formatGscValue(activeValue)}
            </text>
            {compareValue !== null && (
              <text
                x={tooltipX}
                y={tooltipY + 4}
                textAnchor="middle"
                fontSize="8"
                fill="#6b7280"
              >
                {formatGscValue(compareValue)}
              </text>
            )}
            {hoverIndex !== null && labels[hoverIndex] && (
              <text
                x={tooltipX}
                y={tooltipY + 16}
                textAnchor="middle"
                fontSize="8"
                fill="#9ca3af"
              >
                {formatDateLabel(labels[hoverIndex])}
              </text>
            )}
          </g>
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.6}
            fill="black"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
        {bottomLabelIndices.map((idx) => {
          const point = points[idx];
          const label = labels[idx];
          if (!point || !label) return null;
          return (
            <text
              key={idx}
              x={point.x}
              y={h - 4}
              fontSize="8"
              fill="#9ca3af"
              textAnchor="middle"
            >
              {formatDateLabel(label)}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingSeo.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingSeo.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingSeo.subtitle')}
            </p>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">{t('crm.marketingSeo.loading')}</div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {status && (
          <div className="text-[11px] text-emerald-300">{status}</div>
        )}

        {!loading && !error && (
          <>
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {t('crm.marketingSeo.connections.title')}
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    {t('crm.marketingSeo.connections.subtitle')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={connectGsc}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] text-slate-100 hover:border-slate-500"
                  >
                    {settings?.gscConnected
                      ? t('crm.marketingSeo.connections.gscConnected')
                      : t('crm.marketingSeo.connections.connectGsc')}
                  </button>
                  <button
                    type="button"
                    onClick={runSync}
                    disabled={syncing}
                    className="rounded-2xl border border-emerald-700/60 bg-emerald-900/20 px-4 py-2 text-[11px] text-emerald-200 hover:border-emerald-500 disabled:opacity-60"
                  >
                    {syncing
                      ? t('crm.marketingSeo.connections.refreshing')
                      : t('crm.marketingSeo.connections.refresh')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-3 text-xs">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">
                    {t('crm.marketingSeo.period.title')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['7', '30', '90'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={
                          'rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ' +
                          (periodPreset === preset
                            ? 'border-white bg-white text-slate-950'
                          : 'border-slate-700 text-slate-300 hover:border-white hover:text-white')
                        }
                      >
                        {t(`crm.marketingSeo.period.presets.${preset}`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPeriodPreset('custom')}
                      className={
                        'rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ' +
                        (periodPreset === 'custom'
                          ? 'border-white bg-white text-slate-950'
                          : 'border-slate-700 text-slate-300 hover:border-white hover:text-white')
                      }
                    >
                      {t('crm.marketingSeo.period.custom')}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => runSync({ from: dateFrom, to: dateTo })}
                    disabled={!dateFrom || !dateTo || syncing}
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] text-slate-100 hover:border-slate-500 disabled:opacity-60"
                  >
                    {t('crm.marketingSeo.period.apply')}
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {t('crm.marketingSeo.compare.title')}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {t('crm.marketingSeo.compare.subtitle')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompareEnabled((v) => !v)}
                    className={
                      'relative inline-flex h-6 w-11 items-center rounded-full transition ' +
                      (compareEnabled ? 'bg-emerald-400' : 'bg-slate-700')
                    }
                  >
                    <span
                      className={
                        'inline-block h-5 w-5 transform rounded-full bg-white transition ' +
                        (compareEnabled ? 'translate-x-5' : 'translate-x-1')
                      }
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.site.title')}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full">
                      <select
                        value={selectedSite}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedSite(id);
                          if (id === '__add__') return;
                          if (id) {
                            void applySiteSelection(id);
                          }
                        }}
                        className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 pr-10 text-sm text-slate-100"
                      >
                        <option value="">{t('crm.marketingSeo.site.placeholder')}</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name || site.domain}
                          </option>
                        ))}
                        <option value="__add__">{t('crm.marketingSeo.site.addOption')}</option>
                      </select>
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedSite}
                      disabled={!selectedSite || selectedSite === '__add__' || deletingSite}
                      className="w-full sm:w-auto rounded-2xl border border-red-700/60 bg-red-900/10 px-4 py-2 text-[11px] text-red-200 hover:border-red-500 disabled:opacity-60"
                    >
                      {deletingSite
                        ? t('crm.marketingSeo.site.deleting')
                        : t('crm.marketingSeo.site.delete')}
                    </button>
                  </div>
                </label>
                {selectedSite === '__add__' && (
                  <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    {t('crm.marketingSeo.newSite.title')}
                    <div className="mt-2 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        value={newSiteDomain}
                        onChange={(e) => setNewSiteDomain(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                        placeholder={t('crm.marketingSeo.newSite.placeholder')}
                      />
                      <button
                        type="button"
                        onClick={addSite}
                        disabled={addingSite}
                        className="w-full sm:w-auto whitespace-nowrap rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] text-slate-100 hover:border-slate-500 disabled:opacity-60"
                      >
                        {addingSite
                          ? t('crm.marketingSeo.newSite.adding')
                          : t('crm.marketingSeo.newSite.add')}
                      </button>
                    </div>
                  </label>
                )}
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.fields.gscPropertyUrl')}
                  <input
                    value={settings?.gscPropertyUrl || ''}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, gscPropertyUrl: e.target.value } : s,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    placeholder="https://example.com/"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.fields.pageSpeedUrl')}
                  <input
                    value={settings?.pageSpeedUrl || ''}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, pageSpeedUrl: e.target.value } : s,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    placeholder="https://example.com/"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.fields.pageSpeedApiKey')}
                  <input
                    value={settings?.pageSpeedApiKey || ''}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, pageSpeedApiKey: e.target.value } : s,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    placeholder="AIza..."
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.fields.pageSpeedStrategy')}
                  <select
                    value={settings?.pageSpeedStrategy || 'mobile'}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, pageSpeedStrategy: e.target.value } : s,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  >
                    <option value="mobile">{t('crm.marketingSeo.fields.strategy.mobile')}</option>
                    <option value="desktop">{t('crm.marketingSeo.fields.strategy.desktop')}</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] text-slate-100 hover:border-slate-500 disabled:opacity-60"
                >
                  {saving
                    ? t('crm.marketingSeo.actions.saving')
                    : t('crm.marketingSeo.actions.save')}
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
              {syncing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-slate-950/50 text-[11px] text-slate-100">
                  {t('crm.marketingSeo.syncingOverlay')}
                </div>
              )}
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingSeo.gsc.title')}
                </div>
                {metrics?.gsc ? (
                  <div className="space-y-3 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <div>{t('crm.marketingSeo.gsc.period')}</div>
                      <div>{metrics.gsc.dateFrom} → {metrics.gsc.dateTo}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 hover:border-slate-600">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.clicks')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-100">
                          {metrics.gsc.clicks.toLocaleString(locale)}
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 hover:border-slate-600">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.impressions')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-100">
                          {metrics.gsc.impressions.toLocaleString(locale)}
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 hover:border-slate-600">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.ctr')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-100">
                          {(metrics.gsc.ctr * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3 hover:border-slate-600">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.position')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-100">
                          {metrics.gsc.position.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-3">
                      {metrics.gscDaily && metrics.gscDaily.length > 0 && (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-black shadow-[0_12px_35px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
                            <span>{t('crm.marketingSeo.gsc.trendTitle')}</span>
                            <span>{t('crm.marketingSeo.gsc.trendSource')}</span>
                          </div>
                          {compareEnabled && (
                            <div className="mb-2 flex items-center gap-3 text-[10px] text-neutral-500">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-4 rounded-full bg-black" />
                                {t('crm.marketingSeo.gsc.legend.current')}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-4 rounded-full bg-neutral-400" />
                                {t('crm.marketingSeo.gsc.legend.previous')}
                              </div>
                            </div>
                          )}
                          {renderTrendChart(
                            metrics.gscDaily.map((d) => {
                              if (gscMetricKey === 'ctr') return d.ctr * 100;
                              if (gscMetricKey === 'position') return d.position;
                              if (gscMetricKey === 'impressions') return d.impressions;
                              return d.clicks;
                            }),
                            metrics.gscDaily.map((d) => d.date),
                            gscMetricKey,
                            metrics.gscCompareDaily && metrics.gscCompareDaily.length > 0
                              ? metrics.gscCompareDaily.map((d) => {
                                  if (gscMetricKey === 'ctr') return d.ctr * 100;
                                  if (gscMetricKey === 'position') return d.position;
                                  if (gscMetricKey === 'impressions') return d.impressions;
                                  return d.clicks;
                                })
                              : undefined,
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-500">
                            {(['clicks', 'impressions', 'ctr', 'position'] as const).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setGscMetricKey(key)}
                                className={
                                  'rounded-full border px-3 py-1 uppercase tracking-[0.18em] text-[9px] ' +
                                  (gscMetricKey === key
                                    ? 'border-black bg-black text-white'
                                    : 'border-neutral-200 text-neutral-500 hover:border-black hover:text-black')
                                }
                              >
                                {t(`crm.marketingSeo.gsc.metricTabs.${key}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-black shadow-[0_12px_35px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                              {t('crm.marketingSeo.gscDonut.title')}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {t('crm.marketingSeo.gscDonut.subtitle')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-black">
                              {(metrics.gsc.ctr * 100).toFixed(1)}%
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {t('crm.marketingSeo.gscDonut.average')}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="group relative">
                            <DonutStat label={t('crm.marketingSeo.gscDonut.labels.ctr')} percent={metrics.gsc.ctr * 100} />
                            {compareEnabled && metrics.gscCompare && (
                              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
                                  {t('crm.marketingSeo.gscDonut.was', {
                                    value: (metrics.gscCompare.ctr * 100).toFixed(1),
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="group relative">
                            <DonutStat
                              label={t('crm.marketingSeo.gscDonut.labels.rank')}
                              percent={clamp(100 - metrics.gsc.position * 3, 0, 100)}
                            />
                            {compareEnabled && metrics.gscCompare && (
                              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
                                  {t('crm.marketingSeo.gscDonut.was', {
                                    value: clamp(100 - metrics.gscCompare.position * 3, 0, 100).toFixed(1),
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="group relative">
                            <DonutStat
                              label={t('crm.marketingSeo.gscDonut.labels.visibility')}
                              percent={clamp(metrics.gsc.impressions / 10, 0, 100)}
                            />
                            {compareEnabled && metrics.gscCompare && (
                              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
                                  {t('crm.marketingSeo.gscDonut.was', {
                                    value: clamp(metrics.gscCompare.impressions / 10, 0, 100).toFixed(1),
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    {t('crm.marketingSeo.gsc.empty')}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingSeo.psi.title')}
                </div>
                {metrics?.psi ? (
                  <div className="space-y-3 text-[11px] text-slate-300">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-black shadow-[0_12px_35px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                            {t('crm.marketingSeo.psiDonut.title')}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {t('crm.marketingSeo.psiDonut.subtitle')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-black">61,3%</div>
                          <div className="text-[11px] text-neutral-500">
                            {t('crm.marketingSeo.psiDonut.average')}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <DonutStat label={t('crm.marketingSeo.psiDonut.labels.performance')} percent={metrics.psi.performance} />
                        <DonutStat label={t('crm.marketingSeo.psiDonut.labels.seo')} percent={metrics.psi.seo} />
                        <DonutStat label={t('crm.marketingSeo.psiDonut.labels.accessibility')} percent={metrics.psi.accessibility} />
                        <DonutStat label={t('crm.marketingSeo.psiDonut.labels.best')} percent={metrics.psi.bestPractices} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-black shadow-[0_12px_35px_rgba(0,0,0,0.05)]">
                      <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-600">
                        <div>{t('crm.marketingSeo.psiMetrics.lcp', { value: (metrics.psi.lcp / 1000).toFixed(2) })}</div>
                        <div>{t('crm.marketingSeo.psiMetrics.cls', { value: metrics.psi.cls.toFixed(3) })}</div>
                        <div>{t('crm.marketingSeo.psiMetrics.fcp', { value: (metrics.psi.fcp / 1000).toFixed(2) })}</div>
                        <div>{t('crm.marketingSeo.psiMetrics.tbt', { value: (metrics.psi.tbt / 1000).toFixed(2) })}</div>
                        <div>{t('crm.marketingSeo.psiMetrics.speedIndex', { value: (metrics.psi.speedIndex / 1000).toFixed(2) })}</div>
                        <div>{t('crm.marketingSeo.psiMetrics.strategy', { value: metrics.psi.strategy })}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    {t('crm.marketingSeo.psi.empty')}
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingSeo.control.title')}
                </div>
                <ul className="space-y-2 text-[11px] text-slate-400">
                  <li>{t('crm.marketingSeo.control.items.0')}</li>
                  <li>{t('crm.marketingSeo.control.items.1')}</li>
                  <li>{t('crm.marketingSeo.control.items.2')}</li>
                  <li>{t('crm.marketingSeo.control.items.3')}</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingSeo.connect.title')}
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div>{t('crm.marketingSeo.connect.items.0')}</div>
                  <div>{t('crm.marketingSeo.connect.items.1')}</div>
                  <div>{t('crm.marketingSeo.connect.items.2')}</div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
