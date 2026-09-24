// Редизайн по мокапу Claude Design (marketing-seo.html / components/seo-page.jsx) —
// структура портирована 1:1, данные реальные: Google Search Console + PageSpeed Insights
// (см. backend marketing.service.ts: getSeoMetrics / syncSeo). Мобильная вёрстка — сверх мокапа.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  fetchSeoSites,
  type SeoSiteOption,
  type SeoSettings,
  type SeoMetricsResponse,
  type SeoPsi,
} from '../../api/seo';
import { getLocale } from '../../i18n/utils';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './seo-design.css';

type MetricKey = 'clicks' | 'impressions' | 'ctr' | 'position';
type Preset = '7' | '30' | '90' | 'custom';
type Strategy = 'mobile' | 'desktop';
type DailyRow = NonNullable<SeoMetricsResponse['gscDaily']>[number];

const S = {
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  chev: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l4 4 10-10" />,
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  google: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a13 13 0 010 18" />
      <path d="M12 3a13 13 0 000 18" />
      <path d="M3 12h18" />
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
};

const METRIC_KEYS: MetricKey[] = ['clicks', 'impressions', 'ctr', 'position'];
const BETTER: Record<MetricKey, 'up' | 'down'> = { clicks: 'up', impressions: 'up', ctr: 'up', position: 'down' };

const TONE = { good: '#1f8a5e', ok: '#c08319', poor: '#cc2f47' } as const;
const scoreTone = (v: number) => (v >= 90 ? 'good' : v >= 50 ? 'ok' : 'poor');

/** Пороги Core Web Vitals (LCP/FCP/Speed Index — секунды, TBT — миллисекунды). */
const VITALS: Array<{ k: 'lcp' | 'cls' | 'fcp' | 'tbt' | 'speedIndex'; n: string; good: number; ok: number; max: number; unit: 's' | 'ms' | ''; d: number }> = [
  { k: 'lcp', n: 'LCP', good: 2.5, ok: 4, max: 6, unit: 's', d: 1 },
  { k: 'cls', n: 'CLS', good: 0.1, ok: 0.25, max: 0.4, unit: '', d: 2 },
  { k: 'fcp', n: 'FCP', good: 1.8, ok: 3, max: 5, unit: 's', d: 1 },
  { k: 'tbt', n: 'TBT', good: 200, ok: 600, max: 1000, unit: 'ms', d: 0 },
  { k: 'speedIndex', n: 'Speed Index', good: 3.4, ok: 5.8, max: 8, unit: 's', d: 1 },
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
/** Клиенту показываем просто домен: без https:// и служебного префикса sc-domain: (он нужен только Google). */
const toSiteHost = (value: string | null | undefined) =>
  (value || '')
    .trim()
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

const dayMs = 864e5;
const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayLabel = (s: string) => {
  const [, m, d] = s.split('-');
  return `${d}.${m}`;
};

/* ── sparkline ── */
const Spark: React.FC<{ values: number[]; w?: number; h?: number }> = ({ values, w = 104, h = 30 }) => {
  if (values.length < 2) return <span />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const rg = max - min || 1;
  const pts = values.map((v, i) => [2 + (i * (w - 4)) / (values.length - 1), h - 3 - ((v - min) / rg) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className="seo-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L${last[0].toFixed(1)},${h} L2,${h} Z`} fill="var(--line-3)" />
      <path d={d} fill="none" stroke="var(--fg-2)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="var(--ink)" />
    </svg>
  );
};

/* ── lighthouse ring: крупное тонкое кольцо, мягкая подложка цвета оценки; дуга «наполняется» CSS-анимацией ── */
const Ring: React.FC<{ value: number; size?: number }> = ({ value, size = 76 }) => {
  const stroke = 6;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const tone = TONE[scoreTone(value)];
  return (
    <div className="seo-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 1} fill={tone} fillOpacity="0.07" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle
          className="seo-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamp(value, 0, 100) / 100) * c}
          style={{ ['--c' as string]: c }}
        />
      </svg>
      <div className="num" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
};

/* ── trend chart: ширина берётся из контейнера, чтобы подписи не сжимались на телефоне ── */
const Trend: React.FC<{
  rows: DailyRow[];
  prev: Array<number | null> | null;
  metric: MetricKey;
  format: (m: MetricKey, v: number) => string;
  axis: (m: MetricKey, v: number) => string;
  metricLabel: string;
  prevLabel: string;
  currentLabel: string;
}> = ({ rows, prev, metric, format, axis, metricLabel, prevLabel, currentLabel }) => {
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

  const val = (d: DailyRow) => d[metric] as number;
  const cur = rows.map(val);
  const H = w < 520 ? 210 : 280;
  const PL = w < 520 ? 40 : 48;
  const PR = 14;
  const PT = 20;
  const PB = 34;
  const pool = cur.concat((prev || []).filter((v): v is number => v != null));
  let max = Math.max(...pool);
  let min = Math.min(...pool);
  if (metric === 'clicks' || metric === 'impressions') {
    // счётчики: ось от нуля с «круглым» шагом (1/2/5·10ⁿ) — без повторяющихся подписей вида 2, 2, 1, 1, 0
    const raw = Math.max(1, (max * 1.08) / 4);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= raw) as number;
    min = 0;
    max = step * 4;
  } else {
    const padv = (max - min) * 0.18 || max * 0.1 || 1;
    max += padv;
    min = metric === 'position' ? min - padv : Math.max(0, min - padv);
  }
  const rg = max - min || 1;
  const X = (i: number) => PL + (i * (w - PL - PR)) / Math.max(1, cur.length - 1);
  const Y = (v: number) => PT + (1 - (v - min) / rg) * (H - PT - PB);
  const line = (arr: Array<number | null>) => {
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
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + rg * t);
  const last = cur.length - 1;
  const xIdx = w < 520 ? [0, Math.round(last / 2), last] : [0, Math.round(last / 4), Math.round(last / 2), Math.round((last * 3) / 4), last];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const i = Math.round(((x - PL) / (w - PL - PR)) * last);
    setHover(clamp(i, 0, last));
  };

  const hasPrev = !!prev && prev.some((v) => v != null);
  const tip =
    hover !== null
      ? { left: clamp(X(hover) + 10, 62, w - 52), top: Math.max(Y(cur[hover]) - 6, 34) }
      : null;
  const pv = hover !== null && prev ? prev[hover] : null;

  return (
    <>
      <div className="seo-chart" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${w} ${H}`}
          width={w}
          height={H}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null);
          }}
          role="img"
          aria-label={metricLabel}
        >
          {ticks.map((tk, i) => (
            <g key={i}>
              <line x1={PL} x2={w - PR} y1={Y(tk)} y2={Y(tk)} stroke={i === 0 ? 'var(--line-2)' : 'var(--line-3)'} strokeWidth="1" />
              <text x={PL - 8} y={Y(tk) + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--ff-mono)" fill="var(--fg-4)">
                {axis(metric, tk)}
              </text>
            </g>
          ))}
          {hasPrev && prev && (
            <path d={line(prev)} fill="none" stroke="var(--fg-4)" strokeWidth="1.6" strokeDasharray="4 4" strokeLinecap="round" />
          )}
          <path d={`${line(cur)} L${X(last).toFixed(1)},${Y(min)} L${X(0)},${Y(min)} Z`} fill="var(--bg-soft)" />
          <path d={line(cur)} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {xIdx.map((i, k) => (
            <text
              key={`${i}-${k}`}
              x={X(i)}
              y={H - 12}
              textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
              fontSize="10"
              fontFamily="var(--ff-mono)"
              fill="var(--fg-4)"
            >
              {dayLabel(rows[i].date)}
            </text>
          ))}
          {hover !== null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={PT - 6} y2={H - PB} stroke="var(--line-2)" />
              {pv != null && <circle cx={X(hover)} cy={Y(pv)} r="3" fill="var(--fg-4)" />}
              <circle cx={X(hover)} cy={Y(cur[hover])} r="4" fill="var(--ink)" />
            </g>
          )}
        </svg>
        {tip && hover !== null && (
          <div className="seo-tip" style={{ left: tip.left, top: tip.top }}>
            <div className="dt">{dayLabel(rows[hover].date)}</div>
            <div className="rw">
              <span>{metricLabel}</span>
              <b>{format(metric, cur[hover])}</b>
            </div>
            {pv != null && (
              <div className="rw">
                <span>{prevLabel}</span>
                <b style={{ color: 'var(--fg-3)' }}>{format(metric, pv)}</b>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="seo-legend">
        <span>
          <i />
          {currentLabel}
        </span>
        {hasPrev && (
          <span>
            <i className="prev" />
            {prevLabel}
          </span>
        )}
      </div>
    </>
  );
};

/* ── окно «Как получить ключ PageSpeed API» ── */
const KeyHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const links: Array<string | null> = [
    'https://console.cloud.google.com/projectcreate',
    'https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com',
    'https://console.cloud.google.com/apis/credentials',
    null,
    null,
  ];
  return (
    <div
      className="seo-modal-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seo-keyhelp-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="seo-modal">
        <div className="seo-modal-h">
          <h3 id="seo-keyhelp-title">{t('crm.marketingSeo.ui.keyHelp.title')}</h3>
          <button type="button" className="x" onClick={onClose} aria-label={t('crm.marketingSeo.ui.keyHelp.close')}>
            ×
          </button>
        </div>
        <div className="seo-modal-b">
          <p className="seo-modal-intro">{t('crm.marketingSeo.ui.keyHelp.intro')}</p>
          <ol className="seo-steps">
            {links.map((href, i) => (
              <li key={i}>
                <span>
                  <b>{t(`crm.marketingSeo.ui.keyHelp.steps.${i}.b`)}</b> — {t(`crm.marketingSeo.ui.keyHelp.steps.${i}.t`)}
                  {href && (
                    <>
                      {' '}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="seo-link">
                        {t(`crm.marketingSeo.ui.keyHelp.steps.${i}.a`)}
                        <Ic d={S.ext} size={11} />
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="seo-modal-note">{t('crm.marketingSeo.ui.keyHelp.note')}</p>
        </div>
        <div className="seo-modal-f">
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            {t('crm.marketingSeo.ui.keyHelp.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SeoPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [metrics, setMetrics] = useState<SeoMetricsResponse | null>(null);
  const [siteUrlInput, setSiteUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [metric, setMetric] = useState<MetricKey>('clicks');
  const [strategy, setStrategy] = useState<Strategy>('mobile');
  const [preset, setPreset] = useState<Preset>('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [compare, setCompare] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** Ресурсы GSC, доступные аккаунту, когда выбранный адрес ему недоступен. */
  const [foreignSites, setForeignSites] = useState<string[]>([]);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [siteOptions, setSiteOptions] = useState<SeoSiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement>(null);
  const [keyHelpOpen, setKeyHelpOpen] = useState(false);
  /** Замер скорости через Google-аккаунт требует нового разрешения — нужно переподключить аккаунт. */
  const [psiReconnect, setPsiReconnect] = useState(false);
  /** PageSpeed API выключен в Google Cloud проекте платформы — ссылка на включение. */
  const [psiDisabledUrl, setPsiDisabledUrl] = useState<string | null>(null);

  const rangeDays = (from: string, to: string) => Math.round((parseDay(to) - parseDay(from)) / dayMs) + 1;
  const presetFor = (from: string, to: string): Preset => {
    const n = rangeDays(from, to);
    return n === 7 ? '7' : n === 30 ? '30' : n === 90 ? '90' : 'custom';
  };

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

    Promise.allSettled([fetchSeoSettings(), fetchSeoMetrics({ compare: true })])
      .then((results) => {
        if (!alive) return;
        const [sRes, mRes] = results;
        const msgs: string[] = [];
        if (sRes.status === 'fulfilled') {
          setSettings(sRes.value);
          setSiteUrlInput(toSiteHost(sRes.value.gscPropertyUrl || sRes.value.pageSpeedUrl));
          setStrategy(sRes.value.pageSpeedStrategy === 'desktop' ? 'desktop' : 'mobile');
        } else {
          console.error(sRes.reason);
          msgs.push(t('crm.marketingSeo.errors.loadSettings'));
        }
        if (mRes.status === 'fulfilled') {
          setMetrics(mRes.value);
          const g = mRes.value?.gsc;
          if (g?.dateFrom && g?.dateTo) {
            setDateFrom(g.dateFrom);
            setDateTo(g.dateTo);
            setPreset(presetFor(g.dateFrom, g.dateTo));
          }
        } else {
          console.error(mRes.reason);
          msgs.push(t('crm.marketingSeo.errors.loadMetrics'));
        }
        setError(oauthErrorMsg ?? (msgs.length ? msgs.join(' ') : null));
        if (seo === 'connected') setStatus(t('crm.marketingSeo.oauthCallback.connected'));
        if (seo) {
          const next = new URLSearchParams(sp);
          next.delete('seo');
          setSearchParams(next, { replace: true });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, setSearchParams]);

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
    const start = new Date(end.getTime() - (days - 1) * dayMs);
    return { from: isoDay(start.getTime()), to: isoDay(end.getTime()) };
  };

  const errorMessage = (e: unknown, fallback: string) => {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === 'object' && e && 'message' in e) {
      const message = (e as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
    return fallback;
  };

  const persistSeoTarget = async (valueOverride?: string) => {
    if (!settings) return null;
    const rawValue = valueOverride ?? siteUrlInput;
    const gscPropertyUrl = normalizeGscProperty(rawValue);
    if (!gscPropertyUrl) {
      setError(t('crm.marketingSeo.errors.siteRequired'));
      return null;
    }
    const pageSpeedUrl = normalizeSiteUrl(rawValue);
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateSeoSettings({ gscPropertyUrl, pageSpeedUrl, pageSpeedStrategy: settings.pageSpeedStrategy });
      setSettings(updated);
      setSiteUrlInput(toSiteHost(updated.gscPropertyUrl || gscPropertyUrl));
      return updated;
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.save')));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setSavingKey(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateSeoSettings({ pageSpeedApiKey: key });
      setSettings(updated);
      setKeyInput('');
      setStatus(t('crm.marketingSeo.ui.sources.keySaved'));
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.save')));
    } finally {
      setSavingKey(false);
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
    override?: { from?: string; to?: string; compare?: boolean },
    activeSettings: SeoSettings | null = settings,
  ) => {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const from = override?.from || dateFrom || undefined;
      const to = override?.to || dateTo || undefined;
      const withCompare = override?.compare ?? compare;
      const result = await syncSeo({ dateFrom: from, dateTo: to, compare: withCompare });
      setForeignSites([]);
      setPsiReconnect(!!result.psiNeedsReconnect);
      setPsiDisabledUrl(result.psiApiDisabled ? result.psiActivationUrl || 'https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com' : null);
      if (result.gscReauthRequired) {
        const s = await fetchSeoSettings().catch(() => null);
        if (s) setSettings(s);
        setError(t('crm.marketingSeo.errors.gscReauthRequired'));
        return;
      }
      if (result.gscForbidden) {
        // токен рабочий, но такого ресурса у аккаунта нет — предлагаем выбрать из доступных
        setForeignSites(result.gscSites || []);
        setError(
          t('crm.marketingSeo.errors.gscForbidden', {
            property: toSiteHost(activeSettings?.gscPropertyUrl) || siteUrlInput,
          }),
        );
        return;
      }
      if (result.gscProperty && result.gscProperty !== activeSettings?.gscPropertyUrl) {
        // бэкенд сам подобрал подходящий ресурс (например, sc-domain:example.com вместо https://example.com/)
        const s = await fetchSeoSettings().catch(() => null);
        if (s) setSettings(s);
        setSiteUrlInput(toSiteHost(result.gscProperty));
      }
      const fresh = await fetchSeoMetrics({ dateFrom: from, dateTo: to, compare: true });
      setMetrics(fresh);
      if (fresh?.gsc?.dateFrom && fresh?.gsc?.dateTo) {
        setDateFrom(fresh.gsc.dateFrom);
        setDateTo(fresh.gsc.dateTo);
      }
      if (!result.gsc && activeSettings?.gscPropertyUrl) {
        setError(t('crm.marketingSeo.errors.gscNotSynced'));
      } else if (result.psiApiDisabled) {
        // причина показывается отдельной плашкой (psiDisabledUrl)
        setStatus(t('crm.marketingSeo.status.updated'));
      } else if (result.psiNeedsReconnect) {
        // сообщение и кнопка «Переподключить» показываются отдельной плашкой (psiReconnect)
        setStatus(t('crm.marketingSeo.status.updated'));
      } else if (!result.psi && activeSettings?.pageSpeedUrl && (activeSettings?.pageSpeedApiKeySet || activeSettings?.pageSpeedPlatformKey || activeSettings?.gscConnected)) {
        setError(t('crm.marketingSeo.errors.psiNotSynced'));
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

  const applyPreset = (p: Exclude<Preset, 'custom'>) => {
    const range = buildRange(Number(p));
    setDateFrom(range.from);
    setDateTo(range.to);
    setPreset(p);
    void runSync({ from: range.from, to: range.to });
  };

  const runSeoAnalysis = async (valueOverride?: string) => {
    const updated = await persistSeoTarget(valueOverride);
    if (!updated) return;
    await runSync({ from: dateFrom, to: dateTo }, updated);
  };

  const pickSite = (site: string) => {
    setSiteUrlInput(toSiteHost(site));
    void runSeoAnalysis(site);
  };

  const toggleSiteMenu = () => {
    const next = !siteMenuOpen;
    setSiteMenuOpen(next);
    if (!next) return;
    setSitesLoading(true);
    fetchSeoSites()
      .then((r) => setSiteOptions(r.sites))
      .catch(() => setSiteOptions([]))
      .finally(() => setSitesLoading(false));
  };

  useEffect(() => {
    if (!siteMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(e.target as Node)) setSiteMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSiteMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [siteMenuOpen]);

  /** Переключение активного сайта: Google-аккаунт тот же, поэтому переподключение не нужно —
   * сначала мгновенно показываем уже сохранённые метрики сайта, затем обновляем их из Google. */
  const switchSite = async (site: SeoSiteOption) => {
    setSiteMenuOpen(false);
    if (site.current || !settings) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    setForeignSites([]);
    try {
      const updated = await updateSeoSettings({
        gscPropertyUrl: site.property,
        pageSpeedUrl: normalizeSiteUrl(site.property),
        pageSpeedStrategy: settings.pageSpeedStrategy,
      });
      setSettings(updated);
      setSiteUrlInput(toSiteHost(updated.gscPropertyUrl || site.property));
      const cached = await fetchSeoMetrics({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, compare: true }).catch(() => null);
      if (cached) setMetrics(cached);
      setSaving(false);
      await runSync({ from: dateFrom || undefined, to: dateTo || undefined }, updated);
    } catch (e: unknown) {
      console.error(e);
      setError(errorMessage(e, t('crm.marketingSeo.errors.save')));
    } finally {
      setSaving(false);
    }
  };

  const addSiteFocus = () => {
    setSiteMenuOpen(false);
    const el = document.getElementById('seo-site-url') as HTMLInputElement | null;
    if (!el) return;
    setSiteUrlInput('');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => el.focus(), 350);
  };

  const toggleCompare = () => {
    const next = !compare;
    setCompare(next);
    // предыдущий период мог ни разу не подтягиваться из GSC — тогда догружаем при включении
    if (next && !metrics?.gscCompare && settings?.gscConnected) void runSync({ compare: true });
  };

  /* ── форматирование ── */
  const fmtInt = (n: number) => Math.round(n).toLocaleString(locale);
  const fmt2 = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMetric = (m: MetricKey, v: number) =>
    m === 'ctr' ? `${fmt2(v * 100)}%` : m === 'position' ? fmt2(v) : fmtInt(v);
  const axisMetric = (m: MetricKey, v: number) =>
    m === 'ctr'
      ? `${(v * 100).toFixed(1)}%`
      : m === 'position'
        ? v.toFixed(1)
        : v >= 1000
          ? `${Math.round(v / 100) / 10}k`
          : String(Math.round(v));
  const fmtStamp = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
  const metricName = (m: MetricKey) => t(`crm.marketingSeo.gsc.${m}`);

  /* ── производные данные ── */
  const gsc = metrics?.gsc || null;
  const daily = useMemo(() => metrics?.gscDaily || [], [metrics]);
  const cmp = compare ? metrics?.gscCompare || null : null;

  // предыдущий период сопоставляем по дате (сдвиг на длину периода) — GSC не отдаёт дни без показов
  const prevSeries = useMemo(() => {
    if (!compare || !gsc || !metrics?.gscCompareDaily?.length || daily.length < 2) return null;
    const span = rangeDays(gsc.dateFrom, gsc.dateTo);
    const byDate = new Map(metrics.gscCompareDaily.map((d) => [d.date, d]));
    return daily.map((d) => {
      const p = byDate.get(isoDay(parseDay(d.date) - span * dayMs));
      return p ? (p[metric] as number) : null;
    });
  }, [compare, gsc, metrics, daily, metric]);

  const pctDelta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : NaN);

  const kpis = gsc
    ? METRIC_KEYS.map((k) => ({
        k,
        l: k === 'position' ? t('crm.marketingSeo.ui.kpiPosition') : metricName(k),
        v: fmtMetric(k, gsc[k]),
        d: cmp ? pctDelta(gsc[k], cmp[k]) : null,
      }))
    : [];

  const Delta: React.FC<{ value: number | null; better: 'up' | 'down' }> = ({ value, better }) => {
    if (value === null) return <span />;
    if (!isFinite(value) || Math.abs(value) < 0.05) return <span className="seo-d flat">{t('crm.marketingSeo.ui.flat')}</span>;
    const good = better === 'down' ? value < 0 : value > 0;
    return (
      <span className={cl('seo-d', good ? 'up' : 'dn')}>
        <Ic d={value > 0 ? S.up : S.dn} size={11} sw={2} />
        {`${value > 0 ? '+' : '−'}${fmt2(Math.abs(value))}%`}
      </span>
    );
  };

  const psi: SeoPsi | null = metrics?.psiByStrategy?.[strategy] ?? (metrics?.psi?.strategy === strategy ? metrics.psi : null);
  const connected = !!settings?.gscConnected;
  const siteHost = (siteUrlInput || settings?.gscPropertyUrl || settings?.pageSpeedUrl || '')
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const lastSync = fmtStamp(gsc?.updatedAt || psi?.updatedAt);
  const consoleUrl = settings?.gscPropertyUrl
    ? `https://search.google.com/search-console?resource_id=${encodeURIComponent(settings.gscPropertyUrl)}`
    : 'https://search.google.com/search-console';
  const busy = syncing || saving;
  // ключ задан клиентом или есть общий ключ платформы — тогда замеры возможны
  // замеры возможны, если есть ключ (свой или платформы) либо подключён Google-аккаунт (через него — без ключа)
  const psiKeyAvailable = !!(settings?.pageSpeedApiKeySet || settings?.pageSpeedPlatformKey);
  const psiCanRun = psiKeyAvailable || !!settings?.gscConnected;

  if (loading) {
    return (
      <MainLayout>
        <PageHelpButton topic="marketingSeo" />
        <div className="px-scope seo-scope">
          <div className="seo-wrap" aria-busy="true" aria-label={t('crm.marketingSeo.loading')}>
            <div className="seo-skel" style={{ height: 84, marginBottom: 18 }} />
            <div className="seo-skel" style={{ height: 96, marginBottom: 16 }} />
            <div className="seo-skel" style={{ height: 300 }} />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="marketingSeo" />
      <div className="px-scope seo-scope">
        <div className="seo-wrap">
          <div className="seo-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.marketingSeo.kicker')}
              </div>
              <h1>{t('crm.marketingSeo.title')}</h1>
              <div className="sub">{t('crm.marketingSeo.subtitle')}</div>
            </div>
            <div className="seo-head-actions">
              <span className={cl('seo-conn', connected && 'ok')}>
                <span className="dot" />
                {connected ? t('crm.marketingSeo.ui.conn.ok') : t('crm.marketingSeo.ui.conn.off')}
              </span>
              {siteHost && (
                <div className="seo-site-wrap" ref={siteMenuRef}>
                  <button
                    type="button"
                    className={cl('seo-site', 'seo-site-btn', siteMenuOpen && 'open')}
                    onClick={toggleSiteMenu}
                    aria-haspopup="listbox"
                    aria-expanded={siteMenuOpen}
                    disabled={busy}
                  >
                    <span className="lbl">{t('crm.marketingSeo.ui.resource')}</span>
                    <span className="val">{siteHost}</span>
                    <Ic d={S.chev} size={13} sw={2} />
                  </button>
                  {siteMenuOpen && (
                    <div className="seo-site-menu" role="listbox">
                      {sitesLoading && siteOptions.length === 0 ? (
                        <div className="seo-site-note">{t('crm.marketingSeo.ui.sites.loading')}</div>
                      ) : (
                        siteOptions.map((o) => (
                          <button
                            key={o.host}
                            type="button"
                            role="option"
                            aria-selected={o.current}
                            className={cl('seo-site-item', o.current && 'on')}
                            onClick={() => void switchSite(o)}
                          >
                            <span className="ck">{o.current && <Ic d={S.check} size={13} sw={2.2} />}</span>
                            <span className="nm">{o.host}</span>
                            <span className="st">{o.synced ? fmtStamp(o.updatedAt) : t('crm.marketingSeo.ui.sites.notChecked')}</span>
                          </button>
                        ))
                      )}
                      <button type="button" className="seo-site-item add" onClick={addSiteFocus}>
                        <span className="ck">+</span>
                        <span className="nm">{t('crm.marketingSeo.ui.sites.add')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button type="button" className="btn btn-sm" onClick={() => void runSync()} disabled={busy}>
                <Ic d={S.refresh} size={14} />
                {syncing ? t('crm.marketingSeo.ui.refreshing') : t('crm.marketingSeo.ui.refresh')}
              </button>
            </div>
          </div>

          <div className="seo-bar">
            <div className="seo-seg">
              {(['7', '30', '90', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cl(preset === p && 'active')}
                  onClick={() => (p === 'custom' ? setPreset('custom') : applyPreset(p))}
                  disabled={busy && p !== 'custom'}
                >
                  {t(`crm.marketingSeo.ui.range.${p === 'custom' ? 'custom' : `d${p}`}`)}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="seo-dates">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span style={{ color: 'var(--fg-4)' }}>→</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void runSync({ from: dateFrom, to: dateTo })}
                  disabled={!dateFrom || !dateTo || busy}
                >
                  {t('crm.marketingSeo.ui.range.apply')}
                </button>
              </div>
            )}
            <div className="seo-bar-spacer" />
            <span className="seo-sync">
              {gsc ? `${gsc.dateFrom} → ${gsc.dateTo}` : ''}
              {gsc && lastSync ? ' · ' : ''}
              {lastSync ? t('crm.marketingSeo.ui.syncLine', { date: lastSync }) : gsc ? '' : t('crm.marketingSeo.ui.syncNever')}
            </span>
            <div className="seo-cmp">
              <button
                type="button"
                className={cl('seo-switch', compare && 'on')}
                onClick={toggleCompare}
                role="switch"
                aria-checked={compare}
                aria-label={t('crm.marketingSeo.ui.compareLabel')}
              >
                <span />
              </button>
              {t('crm.marketingSeo.ui.compareLabel')}
            </div>
          </div>

          {error && (
            <div className="seo-note err" role="alert">
              <span className="sp">{error}</span>
              <button type="button" className="x" onClick={() => setError(null)} aria-label="×">
                ×
              </button>
            </div>
          )}
          {psiDisabledUrl && (
            <div className="seo-note warn">
              <span className="sp">{t('crm.marketingSeo.errors.psiApiDisabled')}</span>
              <a className="btn btn-sm" href={psiDisabledUrl} target="_blank" rel="noopener noreferrer">
                {t('crm.marketingSeo.ui.psi.enableApi')}
                <Ic d={S.ext} size={13} />
              </a>
            </div>
          )}
          {psiReconnect && connected && (
            <div className="seo-note warn">
              <span className="sp">{t('crm.marketingSeo.errors.psiReconnect')}</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void connectGsc()}>
                <Ic d={S.google} size={13} />
                {t('crm.marketingSeo.ui.notice.reconnect')}
              </button>
            </div>
          )}
          {foreignSites.length > 0 && (
            <div className="seo-note warn seo-pick">
              <span className="sp">{t('crm.marketingSeo.ui.notice.pickProperty')}</span>
              <span className="seo-pick-list">
                {foreignSites.map((site) => (
                  <button key={site} type="button" className="btn btn-sm" onClick={() => pickSite(site)} disabled={busy}>
                    {toSiteHost(site)}
                  </button>
                ))}
              </span>
            </div>
          )}
          {status && !error && (
            <div className="seo-note ok" role="status">
              <span className="sp">{status}</span>
              <button type="button" className="x" onClick={() => setStatus(null)} aria-label="×">
                ×
              </button>
            </div>
          )}
          {settings && !connected && (
            <div className="seo-note warn">
              <span className="sp">{gsc ? t('crm.marketingSeo.ui.notice.expired') : t('crm.marketingSeo.ui.notice.notConnected')}</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void connectGsc()}>
                <Ic d={S.google} size={13} />
                {gsc ? t('crm.marketingSeo.ui.notice.reconnect') : t('crm.marketingSeo.ui.notice.connect')}
              </button>
            </div>
          )}

          {gsc && (
            <div className="seo-kpis">
              {kpis.map((k) => (
                <button key={k.k} type="button" className={cl('seo-kpi', metric === k.k && 'active')} onClick={() => setMetric(k.k)}>
                  <div className="l">{k.l}</div>
                  <div className="v">{k.v}</div>
                  <div className="seo-kpi-foot">
                    <Delta value={k.d} better={BETTER[k.k]} />
                    <Spark values={daily.map((d) => d[k.k] as number)} />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="seo-cols">
            <div className="seo-card">
              {syncing && <div className="seo-busy">{t('crm.marketingSeo.syncingOverlay')}</div>}
              <div className="seo-card-head">
                <h3>{t('crm.marketingSeo.ui.chart.byDay', { metric: metricName(metric) })}</h3>
                <div className="grp">
                  {daily.length > 0 && <span className="meta">{t('crm.marketingSeo.ui.chart.days', { count: daily.length })}</span>}
                  <div className="seo-seg">
                    {METRIC_KEYS.map((k) => (
                      <button key={k} type="button" className={cl(metric === k && 'active')} onClick={() => setMetric(k)}>
                        {metricName(k)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {daily.length > 1 ? (
                <Trend
                  rows={daily}
                  prev={prevSeries}
                  metric={metric}
                  format={fmtMetric}
                  axis={axisMetric}
                  metricLabel={metricName(metric)}
                  prevLabel={t('crm.marketingSeo.ui.chart.prevTooltip')}
                  currentLabel={t('crm.marketingSeo.ui.chart.current')}
                />
              ) : (
                <div className="seo-empty">{t('crm.marketingSeo.gsc.empty')}</div>
              )}
            </div>

            <div className="seo-card">
              <div className="seo-card-head">
                <h3>{t('crm.marketingSeo.psi.title')}</h3>
                <div className="seo-seg">
                  {(['mobile', 'desktop'] as const).map((s) => (
                    <button key={s} type="button" className={cl(strategy === s && 'active')} onClick={() => setStrategy(s)}>
                      {t(`crm.marketingSeo.ui.psi.${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              {psi ? (
                <>
                  <div className="seo-gauges">
                    {(['performance', 'accessibility', 'bestPractices', 'seo'] as const).map((k) => (
                      <div className="seo-gauge" key={k}>
                        <Ring value={psi[k]} />
                        <div className="n">{t(`crm.marketingSeo.ui.psi.gauges.${k}`)}</div>
                        <div className="st" style={{ color: TONE[scoreTone(psi[k])] }}>
                          {t(`crm.marketingSeo.ui.psi.tone.${scoreTone(psi[k])}`)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="seo-legend2">
                    {(['good', 'ok', 'poor'] as const).map((k) => (
                      <span key={k}>
                        <i style={{ background: TONE[k] }} />
                        {k === 'good' ? '90–100' : k === 'ok' ? '50–89' : '0–49'}
                      </span>
                    ))}
                  </div>
                  <div className="seo-vitals">
                    {VITALS.map((v) => {
                      const val = psi[v.k];
                      const tone = val <= v.good ? 'good' : val <= v.ok ? 'ok' : 'poor';
                      const unit = v.unit === 's' ? t('crm.marketingSeo.ui.psi.unitS') : v.unit === 'ms' ? t('crm.marketingSeo.ui.psi.unitMs') : '';
                      return (
                        <div className="seo-vital" key={v.k}>
                          <div className="n">
                            <b>{v.n}</b>
                            <small>{t(`crm.marketingSeo.ui.psi.vitalDesc.${v.k}`)}</small>
                          </div>
                          <div className="track">
                            <i style={{ width: `${clamp((val / v.max) * 100, 3, 100)}%`, background: TONE[tone] }} />
                            <u style={{ left: `${(v.good / v.max) * 100}%` }} />
                            <u style={{ left: `${(v.ok / v.max) * 100}%` }} />
                          </div>
                          <div className="vv" style={{ color: TONE[tone] }}>
                            {val.toLocaleString(locale, { minimumFractionDigits: v.d, maximumFractionDigits: v.d })}
                            {unit && ` ${unit}`}
                            <em>{t(`crm.marketingSeo.ui.psi.tone.${tone}`)}</em>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="seo-psi-foot">
                    <span>{t('crm.marketingSeo.ui.psi.measured', { date: fmtStamp(psi.updatedAt) })}</span>
                                      </div>
                </>
              ) : (
                <div className="seo-empty">
                  {settings && !psiCanRun ? t('crm.marketingSeo.ui.psi.needKey') : t('crm.marketingSeo.ui.psi.emptyHint')}
                  {settings && !psiCanRun && (
                    <div style={{ marginTop: 10 }}>
                      <button type="button" className="btn btn-sm" onClick={() => setKeyHelpOpen(true)}>
                        {t('crm.marketingSeo.ui.psi.howTo')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="seo-src">
            <div className="seo-card">
              <div className="seo-card-head">
                <h3>{t('crm.marketingSeo.ui.sources.title')}</h3>
                {settings?.updatedAt && (
                  <span className="meta">{t('crm.marketingSeo.ui.sources.updated', { date: fmtStamp(settings.updatedAt) })}</span>
                )}
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="seo-site-url">
                  {t('crm.marketingSeo.fields.siteUrl')}
                </label>
                <div className="row">
                  <input
                    id="seo-site-url"
                    className="seo-input"
                    value={siteUrlInput}
                    onChange={(e) => setSiteUrlInput(e.target.value)}
                    placeholder="example.com"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => void runSeoAnalysis()}
                    disabled={busy || !siteUrlInput.trim()}
                  >
                    {busy ? t('crm.marketingSeo.actions.analyzing') : t('crm.marketingSeo.actions.analyze')}
                  </button>
                </div>
                <div className="seo-hint">{t('crm.marketingSeo.fields.siteUrlHint')}</div>
              </div>
              <div className="seo-field">
                <span className="l">{t('crm.marketingSeo.ui.sources.gscLabel')}</span>
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => void connectGsc()}>
                    <Ic d={S.google} size={13} />
                    {connected ? t('crm.marketingSeo.ui.sources.reconnect') : t('crm.marketingSeo.ui.sources.connect')}
                  </button>
                  <a className="btn btn-sm btn-ghost" href={consoleUrl} target="_blank" rel="noopener noreferrer">
                    {t('crm.marketingSeo.ui.sources.open')}
                    <Ic d={S.ext} size={13} />
                  </a>
                </div>
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="seo-psi-key">
                  {psiCanRun
                    ? t('crm.marketingSeo.ui.sources.keyLabelOptional')
                    : t('crm.marketingSeo.ui.sources.keyLabel')}
                </label>
                <div className="row">
                  <input
                    id="seo-psi-key"
                    className="seo-input"
                    type="password"
                    autoComplete="off"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={settings?.pageSpeedApiKey || t('crm.marketingSeo.ui.sources.keyPlaceholder')}
                  />
                  <button type="button" className="btn btn-sm" onClick={() => void saveKey()} disabled={savingKey || !keyInput.trim()}>
                    {savingKey ? t('crm.marketingSeo.ui.sources.keyBusy') : t('crm.marketingSeo.actions.save')}
                  </button>
                </div>
                <div className="seo-hint">
                  {psiCanRun && !settings?.pageSpeedApiKeySet
                    ? t('crm.marketingSeo.ui.sources.keyHintPlatform')
                    : t('crm.marketingSeo.ui.sources.keyHint')}{' '}
                  <button type="button" className="seo-link seo-link-btn" onClick={() => setKeyHelpOpen(true)}>
                    {t('crm.marketingSeo.ui.psi.howTo')}
                  </button>
                </div>
              </div>
            </div>

            <div className="seo-card">
              <div className="seo-card-head">
                <h3>{t('crm.marketingSeo.ui.stepsTitle')}</h3>
                <span className="meta">{t('crm.marketingSeo.ui.stepsMeta')}</span>
              </div>
              <ol className="seo-steps">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <span>
                      <b>{t(`crm.marketingSeo.ui.steps.${i}.b`)}</b> — {t(`crm.marketingSeo.ui.steps.${i}.t`)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
      {keyHelpOpen && createPortal(<KeyHelpModal onClose={() => setKeyHelpOpen(false)} />, document.body)}
    </MainLayout>
  );
};
