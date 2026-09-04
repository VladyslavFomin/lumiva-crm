import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  fetchSeoSettings,
  updateSeoSettings,
  getGoogleAuthUrl,
  fetchSeoMetrics,
  syncSeo,
  type SeoSettings,
  type SeoMetricsResponse,
} from '../../api/seo';
import { getLocale } from '../../i18n/utils';

export const SeoPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [metrics, setMetrics] = useState<SeoMetricsResponse | null>(null);
  const [siteUrlInput, setSiteUrlInput] = useState('');
  const [gscMetricKey, setGscMetricKey] = useState<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [periodPreset, setPeriodPreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const sp = searchParamsRef.current;
    const seo = sp.get('seo');
    const oauthErrorMsg =
      seo && seo !== 'connected'
        ? (() => {
            const key = `crm.marketingSeo.oauthCallback.${seo}`;
            const msg = t(key);
            return msg !== key ? msg : t('crm.marketingSeo.oauthCallback.generic');
          })()
        : null;

    Promise.allSettled([fetchSeoSettings(), fetchSeoMetrics()])
      .then((results) => {
        if (!alive) return;
        const [sRes, mRes] = results;
        const msgs: string[] = [];
        if (sRes.status === 'fulfilled') {
          setSettings(sRes.value);
          setSiteUrlInput(sRes.value.gscPropertyUrl || sRes.value.pageSpeedUrl || '');
        } else {
          console.error(sRes.reason);
          msgs.push(t('crm.marketingSeo.errors.loadSettings'));
        }
        if (mRes.status === 'fulfilled') {
          setMetrics(mRes.value);
          const m = mRes.value;
          if (m?.gsc?.dateFrom && m?.gsc?.dateTo) {
            setDateFrom(m.gsc.dateFrom);
            setDateTo(m.gsc.dateTo);
          }
        } else {
          console.error(mRes.reason);
          msgs.push(t('crm.marketingSeo.errors.loadMetrics'));
        }
        const loadErr = msgs.length ? msgs.join(' ') : null;
        setError(oauthErrorMsg ?? loadErr);
        if (seo === 'connected') {
          setStatus(t('crm.marketingSeo.oauthCallback.connected'));
        }
        if (seo) {
          const next = new URLSearchParams(sp);
          next.delete('seo');
          setSearchParams(next, { replace: true });
        }
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [t, setSearchParams]);

  useEffect(() => {
    setHoverIndex(null);
  }, [gscMetricKey]);

  const normalizeSiteUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('sc-domain:')) {
      const domain = trimmed.slice('sc-domain:'.length).replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return domain ? `https://${domain}/` : '';
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    }
    return `https://${trimmed.replace(/\/+$/, '')}/`;
  };

  const normalizeGscProperty = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('sc-domain:')) {
      const domain = trimmed.slice('sc-domain:'.length).replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return domain ? `sc-domain:${domain}` : '';
    }
    return normalizeSiteUrl(trimmed);
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

  const errorMessage = (e: unknown, fallback: string) => {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === 'object' && e && 'message' in e) {
      const message = (e as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
    return fallback;
  };

  const persistSeoTarget = async () => {
    if (!settings) return null;
    const gscPropertyUrl = normalizeGscProperty(siteUrlInput);
    if (!gscPropertyUrl) {
      setError(t('crm.marketingSeo.errors.siteRequired'));
      return null;
    }
    const pageSpeedUrl = normalizeSiteUrl(siteUrlInput);
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateSeoSettings({
        gscPropertyUrl,
        pageSpeedUrl,
        pageSpeedStrategy: settings.pageSpeedStrategy,
      });
      setSettings(updated);
      setSiteUrlInput(updated.gscPropertyUrl || gscPropertyUrl);
      return updated;
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.save')));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const connectGsc = async () => {
    setError(null);
    setStatus(null);
    try {
      if (siteUrlInput.trim()) {
        const updated = await persistSeoTarget();
        if (!updated) return;
      }
      const res = await getGoogleAuthUrl('/app/marketing/seo');
      window.location.href = res.url;
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.oauth')));
    }
  };

  const runSync = async (
    override?: { from?: string; to?: string },
    activeSettings: SeoSettings | null = settings,
  ) => {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const from = override?.from || dateFrom;
      const to = override?.to || dateTo;
      const result = await syncSeo({ dateFrom: from, dateTo: to, compare: compareEnabled });
      if (result.gscReauthRequired) {
        const s = await fetchSeoSettings().catch(() => null);
        if (s) setSettings(s);
        setError(t('crm.marketingSeo.errors.gscReauthRequired'));
        return;
      }
      const fresh = await fetchSeoMetrics({ dateFrom: from, dateTo: to, compare: compareEnabled });
      setMetrics(fresh);
      if (fresh?.gsc?.dateFrom && fresh?.gsc?.dateTo) {
        setDateFrom(fresh.gsc.dateFrom);
        setDateTo(fresh.gsc.dateTo);
      }
      if (!result.gsc && activeSettings?.gscPropertyUrl) {
        setError(t('crm.marketingSeo.errors.gscNotSynced'));
      } else {
        setStatus(t('crm.marketingSeo.status.updated'));
      }
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.update')));
    } finally {
      setSyncing(false);
    }
  };

  const runSeoAnalysis = async () => {
    const updated = await persistSeoTarget();
    if (!updated) return;
    await runSync({ from: dateFrom, to: dateTo }, updated);
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
      <PageHelpButton topic="marketingSeo" />
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingSeo.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-900">
              {t('crm.marketingSeo.title')}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              {t('crm.marketingSeo.subtitle')}
            </p>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-600">{t('crm.marketingSeo.loading')}</div>
        )}

        {error && (
          <div className="text-[11px] text-red-600">{error}</div>
        )}

        {status && (
          <div className="text-[11px] font-medium text-emerald-700">{status}</div>
        )}

        {!loading && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {t('crm.marketingSeo.connections.title')}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {t('crm.marketingSeo.connections.subtitle')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={connectGsc}
                    className={
                      settings?.gscConnected
                        ? 'inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 shadow-sm hover:bg-emerald-200'
                        : 'btn-primary !w-auto shrink-0 px-4 py-2'
                    }
                  >
                    {settings?.gscConnected
                      ? t('crm.marketingSeo.connections.gscConnected')
                      : t('crm.marketingSeo.connections.connectGsc')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    disabled={syncing}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {syncing
                      ? t('crm.marketingSeo.connections.refreshing')
                      : t('crm.marketingSeo.connections.refresh')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
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
                          'rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm transition ' +
                          (periodPreset === preset
                            ? 'border-lumiva-accent bg-lumiva-accent text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')
                        }
                      >
                        {t(`crm.marketingSeo.period.presets.${preset}`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPeriodPreset('custom')}
                      className={
                        'rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm transition ' +
                        (periodPreset === 'custom'
                          ? 'border-lumiva-accent bg-lumiva-accent text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-lumiva-accent focus:ring-2 focus:ring-slate-200"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-lumiva-accent focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => runSync({ from: dateFrom, to: dateTo })}
                    disabled={!dateFrom || !dateTo || syncing}
                    className="btn-primary mt-3 w-full disabled:cursor-not-allowed"
                  >
                    {t('crm.marketingSeo.period.apply')}
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {t('crm.marketingSeo.compare.title')}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      {t('crm.marketingSeo.compare.subtitle')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompareEnabled((v) => !v)}
                    className={
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ' +
                      (compareEnabled ? 'bg-emerald-500' : 'bg-slate-300')
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingSeo.fields.siteUrl')}
                  <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center">
                    <input
                      value={siteUrlInput}
                      onChange={(e) => setSiteUrlInput(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-lumiva-accent focus:ring-2 focus:ring-slate-200"
                      placeholder="https://example.com/"
                    />
                    <button
                      type="button"
                      onClick={() => void runSeoAnalysis()}
                      disabled={saving || syncing || !siteUrlInput.trim()}
                      className="btn-primary w-full whitespace-nowrap lg:!w-auto disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving || syncing
                        ? t('crm.marketingSeo.actions.analyzing')
                        : t('crm.marketingSeo.actions.analyze')}
                    </button>
                  </div>
                </label>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                  {t('crm.marketingSeo.fields.siteUrlHint')}
                </p>
              </div>
            </section>

            <section className="relative">
              {syncing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/85 text-[11px] font-medium text-slate-800 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] backdrop-blur-[2px]">
                  {t('crm.marketingSeo.syncingOverlay')}
                </div>
              )}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-900 mb-3">
                  {t('crm.marketingSeo.gsc.title')}
                </div>
                {metrics?.gsc ? (
                  <div className="space-y-3 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <div>{t('crm.marketingSeo.gsc.period')}</div>
                      <div>{metrics.gsc.dateFrom} → {metrics.gsc.dateTo}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:border-slate-300">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.clicks')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {metrics.gsc.clicks.toLocaleString(locale)}
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:border-slate-300">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.impressions')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {metrics.gsc.impressions.toLocaleString(locale)}
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:border-slate-300">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.ctr')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {(metrics.gsc.ctr * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:border-slate-300">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          {t('crm.marketingSeo.gsc.position')}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
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
                                  'rounded-full border px-3 py-1 uppercase tracking-[0.18em] text-[9px] font-semibold shadow-sm transition ' +
                                  (gscMetricKey === key
                                    ? 'border-lumiva-accent bg-lumiva-accent text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')
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

            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-900 mb-3">
                  {t('crm.marketingSeo.control.title')}
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600">
                  <li>{t('crm.marketingSeo.control.items.0')}</li>
                  <li>{t('crm.marketingSeo.control.items.1')}</li>
                  <li>{t('crm.marketingSeo.control.items.2')}</li>
                  <li>{t('crm.marketingSeo.control.items.3')}</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-900 mb-3">
                  {t('crm.marketingSeo.connect.title')}
                </div>
                <div className="space-y-2 text-[11px] text-slate-600">
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
