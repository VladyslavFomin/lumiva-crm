/**
 * Главная v3 — секции из Claude Design home-aura-v3 на живых данных GET /dashboard/overview.
 * Отличия от макета: нет ИИ-поиска и логотипов интеграций (лишнее), «План» в «Динамике» заменён
 * на «Год назад» (планов в CRM нет), фото в профиле — аватар пользователя, погоды нет.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DashFeedItem, DashMetric, DashOverview, DashSeries, DashTimelineItem } from '../../api/dashboard';
import { saveDashboardNotes } from '../../api/dashboard';
import { resolvePublicAssetUrl } from '../../api/client';
import {
  HOME_KPIS,
  HOME_MAX_KPIS,
  HOME_MAX_SERIES,
  HOME_MAX_STATS,
  HOME_SERIES,
  type HomeCat,
  type HomePeriod,
} from './homeCatalog';
import './home-v3.css';

/* ───────────── иконки (как A2.IC в макете) ───────────── */

const IC: Record<string, React.ReactNode> = {
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  open: <><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v6H4V6h6" /></>,
  refresh: <><path d="M20 11a8 8 0 00-14.9-3" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0014.9 3" /><path d="M20 20v-4h-4" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h12" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  share: <><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  building: <><path d="M4 21V5l8-2v18" /><path d="M12 8h8v13" /><path d="M8 9h.01M8 13h.01M8 17h.01M16 12h.01M16 16h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  down: <path d="M6 9l6 6 6-6" />,
};

export const Ic: React.FC<{ n: keyof typeof IC | string; s?: number; w?: number }> = ({ n, s = 16, w = 1.6 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {IC[n]}
  </svg>
);

/* ───────────── форматирование ───────────── */

export function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

export function currencySymbol(currency: string, locale: string): string {
  try {
    const p = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return p.find((x) => x.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}

/** Число показателя для крупной цифры: деньги — с символом валюты, большие суммы — компактно. */
export function fmtValue(v: number, format: string, currency: string, locale: string): string {
  if (format === 'money') {
    const abs = Math.abs(v);
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: abs >= 10_000_000 ? 'compact' : 'standard',
        maximumFractionDigits: abs >= 10_000_000 ? 1 : abs < 100 ? 2 : 0,
      }).format(v);
    } catch {
      return `${Math.round(v).toLocaleString(locale)} ${currency}`;
    }
  }
  if (format === 'pct') return `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  if (format === 'num') return v.toLocaleString(locale, { maximumFractionDigits: 2 });
  return Math.round(v).toLocaleString(locale);
}

const isErr = (m: DashMetric | DashSeries | undefined): m is { error: 'denied' | 'locked' | 'failed' | 'amounts_hidden' } =>
  !m || 'error' in m;

/** Плавный «набор» цифры (как A2Count в макете). */
function useCountUp(target: number, ms = 1300) {
  const [v, setV] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const Count: React.FC<{ v: number; format: string; currency: string; locale: string }> = ({ v, format, currency, locale }) => {
  const x = useCountUp(v);
  const shown = format === 'int' || (format === 'money' && Math.abs(v) >= 100) ? Math.round(x) : x;
  return <>{fmtValue(shown, format, currency, locale)}</>;
};

function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0]![0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const GRAYS = ['#1d1d1d', '#d9d9d9', '#8c8c8c', '#ececec', '#4a4a4a', '#bdbdbd'];
const grayFg = (c: string) => (['#1d1d1d', '#8c8c8c', '#4a4a4a'].includes(c) ? '#fff' : '#1d1d1d');

/* ───────────── KPI ───────────── */

const ART = ['doc', 'check', 'folder', 'clock', 'star', 'chart'] as const;
const Art: React.FC<{ k: (typeof ART)[number] }> = ({ k }) => {
  if (k === 'check') return <div className="a3-art sq"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>;
  if (k === 'folder') return <div className="a3-art fold"><i /><b /></div>;
  if (k === 'clock') return <div className="a3-art sq round"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg></div>;
  if (k === 'star') return <div className="a3-art sq"><Ic n="star" s={28} w={1.5} /></div>;
  if (k === 'chart') return <div className="a3-art sq"><span className="bars"><i /><i /><i /></span></div>;
  return <div className="a3-art doc"><i /><i /><i /><i /></div>;
};

function DeltaLine({ m, t, period }: { m: DashMetric; t: (k: string, o?: any) => string; period: HomePeriod }) {
  if (isErr(m)) return <>{t(`crm.home.errors.${m.error}`)}</>;
  const vs = t(`crm.home.vs.${period}`);
  if (!m.delta) return <>{t('crm.home.noCompare')}</>;
  const sign = m.delta.value > 0 ? '+' : m.delta.value < 0 ? '−' : '';
  const abs = Math.abs(m.delta.value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <>
      <b className={m.good === false ? 'dn' : ''}>{sign}{abs}{m.delta.kind === 'pp' ? ` ${t('crm.home.pp')}` : '%'}</b> {vs}
    </>
  );
}

function CatalogPicker({
  items,
  available,
  selected,
  max,
  onToggle,
  onReset,
  t,
}: {
  items: Array<{ key: string; cat: HomeCat }>;
  available: Set<string>;
  selected: string[];
  max: number;
  onToggle: (k: string) => void;
  onReset: () => void;
  t: (k: string, o?: any) => string;
}) {
  const [cat, setCat] = useState<'all' | HomeCat>('all');
  const list = items.filter((x) => available.has(x.key));
  const cats = [...new Set(list.map((x) => x.cat))];
  return (
    <div className="a2-pick">
      <div className="a2-cats">
        {(['all', ...cats] as const).map((c) => (
          <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {c === 'all' ? t('crm.home.cats.all') : t(`crm.home.cats.${c}`)}
          </button>
        ))}
      </div>
      <div className="a2-pick-l">
        {list
          .filter((x) => cat === 'all' || x.cat === cat)
          .map((x) => (
            <button key={x.key} type="button" className={selected.includes(x.key) ? 'on' : ''} onClick={() => onToggle(x.key)}>
              <i />
              {t(`crm.home.metrics.${x.key}`)}
              <em>{t(`crm.home.cats.${x.cat}`)}</em>
            </button>
          ))}
      </div>
      <div className="a2-note">
        {t('crm.home.upTo', { count: max })} ·{' '}
        <button type="button" onClick={onReset}>
          {t('crm.home.reset')}
        </button>
      </div>
    </div>
  );
}

export function HomeKpis({
  data,
  keys,
  available,
  period,
  onPeriod,
  onChange,
  onReset,
  locale,
  loading,
}: {
  data: DashOverview | null;
  keys: string[];
  available: Set<string>;
  period: HomePeriod;
  onPeriod: (p: HomePeriod) => void;
  onChange: (keys: string[]) => void;
  onReset: () => void;
  locale: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggle = (k: string) =>
    onChange(keys.includes(k) ? (keys.length > 1 ? keys.filter((x) => x !== k) : keys) : keys.length >= HOME_MAX_KPIS ? keys : [...keys, k]);
  const cur = data?.currency || 'EUR';
  return (
    <section className="a3-kpis">
      <div className="a3-kpi-row">
        {keys.map((key, i) => {
          const m = data?.kpis[key];
          const pending = !m && loading;
          return (
            <div key={key} className={`a3-kpi${i === 0 ? ' dk' : ''}${pending ? ' skel' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="l">
                <div className="n">{t(`crm.home.metrics.${key}`)}</div>
                <div className="v">
                  {pending ? null : m && !isErr(m) && m.value != null ? (
                    <>
                      <Count v={m.value} format={m.format} currency={cur} locale={locale} />
                      {m.unit ? <small>{m.unit}</small> : null}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="d">{m ? <DeltaLine m={m} t={t} period={period} /> : ' '}</div>
              </div>
              <div className="r">
                <Art k={ART[i % ART.length]} />
                {open && (
                  <button type="button" className="a2-rb sm x" onClick={() => toggle(key)} title={t('crm.home.remove')}>
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!keys.length && <div className="a3-empty">{t('crm.home.kpiEmpty')}</div>}
      </div>
      <div className="a3-kpi-bar">
        <div className="gl">
          <div className="a3-seg" role="tablist">
            {(['today', '7d', '30d'] as HomePeriod[]).map((p) => (
              <button key={p} type="button" className={p === period ? 'on' : ''} onClick={() => onPeriod(p)}>
                {t(`crm.home.periods.${p}`)}
              </button>
            ))}
          </div>
          <span className="a2-note">{t('crm.home.kpiCount', { n: keys.length, total: HOME_KPIS.filter((x) => available.has(x.key)).length })}</span>
        </div>
        <button type="button" className={`a2-pill sm${open ? ' dark' : ''}`} onClick={() => setOpen((o) => !o)}>
          <Ic n="sliders" s={14} />
          {open ? t('crm.home.done') : t('crm.home.customizeKpis')}
        </button>
      </div>
      {open && <CatalogPicker items={HOME_KPIS} available={available} selected={keys} max={HOME_MAX_KPIS} onToggle={toggle} onReset={onReset} t={t} />}
    </section>
  );
}

/* ───────────── профиль ───────────── */

export function HomeProfile({
  data,
  keys,
  goals,
  available,
  onChange,
  onGoals,
  locale,
}: {
  data: DashOverview | null;
  keys: string[];
  goals: Record<string, number>;
  available: Set<string>;
  onChange: (keys: string[]) => void;
  onGoals: (g: Record<string, number>) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const me = data?.me;
  const cur = data?.currency || 'EUR';
  const toggle = (k: string) =>
    onChange(keys.includes(k) ? (keys.length > 1 ? keys.filter((x) => x !== k) : keys) : keys.length >= HOME_MAX_STATS ? [...keys.slice(1), k] : [...keys, k]);
  const days = me ? Math.max(1, Math.floor((Date.now() - Date.parse(me.since)) / 86_400_000)) : 0;
  const next = data?.timeline.today.find((x) => Date.parse(x.at) > Date.now());
  const avatar = resolvePublicAssetUrl(me?.avatarUrl);
  const roleLabel = me ? t(`crm.dashboard.roles.${me.role}`, { defaultValue: me.role }) : '';
  return (
    <section className="a2-panel a2-profile">
      <div className="a2-photo">{avatar ? <img src={avatar} alt="" /> : <span className="ini">{initials(me?.name || me?.email)}</span>}</div>
      <div className="a2-pinfo">
        <div className="a2-ptop">
          <div>
            <h2>{me?.name || me?.email || ' '}</h2>
            <div className="a2-role">
              <b>{me?.position || roleLabel}</b>
              {me ? t('crm.home.daysIn', { count: days }) : ''}
            </div>
          </div>
          <div className="a2-btns">
            <button type="button" className={`a2-rb${open ? ' dark' : ''}`} title={t('crm.home.pickStats')} onClick={() => setOpen((o) => !o)}>
              <Ic n="sliders" />
            </button>
            <Link className="a2-rb" to="/profile/personal" title={t('crm.home.editProfile')}>
              <Ic n="edit" />
            </Link>
          </div>
        </div>
        <div className="a2-contacts">
          <span>
            <Ic n="phone" s={15} />
            <span className={`tx${me?.phone ? '' : ' mu'}`}>{me?.phone || t('crm.home.noPhone')}</span>
          </span>
          <span>
            <Ic n="mail" s={15} />
            <span className="tx">{me?.email || ''}</span>
          </span>
          <span>
            <Ic n="building" s={15} />
            <span className="tx">{me?.company || '—'}</span>
          </span>
          <Link to={next?.link || '/calendar'}>
            <Ic n="flag" s={15} />
            <span className="tx">
              {next
                ? t('crm.home.nextAt', { time: new Date(next.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }), title: next.title })
                : t('crm.home.noMoreMeetings')}
            </span>
          </Link>
        </div>
      </div>
      {open && (
        <div className="a3-ppick">
          <span className="a2-note">{t('crm.home.pickStatsHint', { count: HOME_MAX_STATS })}</span>
          <div className="a3-chips">
            {HOME_KPIS.filter((x) => available.has(x.key)).map((x) => (
              <button key={x.key} type="button" className={keys.includes(x.key) ? 'on' : ''} onClick={() => toggle(x.key)}>
                {t(`crm.home.metrics.${x.key}`)}
              </button>
            ))}
          </div>
          <span className="a2-note">{t('crm.home.goalsHint')}</span>
          <div className="a3-goals">
            {keys.map((k) => (
              <label key={k}>
                {t(`crm.home.metrics.${k}`)}
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={goals[k] ?? ''}
                  placeholder={t('crm.home.goalPh')}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const g = { ...goals };
                    if (!e.target.value || !Number.isFinite(n) || n <= 0) delete g[k];
                    else g[k] = n;
                    onGoals(g);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="a2-stats">
        {keys.map((k, i) => {
          const m = data?.stats[k];
          const val = m && !isErr(m) ? m.value : null;
          const goal = goals[k];
          const pct = goal && val != null ? Math.min(100, (val / goal) * 100) : null;
          return (
            <div key={k} className="a2-stat">
              <div className="l">{t('crm.home.today', { metric: t(`crm.home.metrics.${k}`) })}</div>
              <div className="v">
                {m && !isErr(m) && val != null ? <Count v={val} format={m.format} currency={cur} locale={locale} /> : '—'}
                {m && !isErr(m) && m.unit ? <small style={{ fontSize: 14, color: 'var(--fg-3)' }}>{m.unit}</small> : null}
              </div>
              <div className={`bar g${i}`}>
                <div style={{ width: `${pct ?? 0}%` }} />
              </div>
              <div className="gl">
                {pct != null ? (
                  t('crm.home.ofGoal', { pct: Math.round(pct) })
                ) : m && isErr(m) ? (
                  t(`crm.home.errors.${m.error}`)
                ) : (
                  <button type="button" onClick={() => setOpen(true)}>
                    {t('crm.home.setGoal')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── «Динамика» ───────────── */

function smoothPath(pts: Array<[number, number]>) {
  return pts
    .map((p, i) => {
      if (!i) return `M${p[0]},${p[1]}`;
      const q = pts[i - 1]!;
      const cx = (q[0] + p[0]) / 2;
      return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    })
    .join(' ');
}

function niceMax(v: number) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return step * p;
}

export function HomeChart({
  data,
  keys,
  available,
  onChange,
  months,
  onMonths,
  locale,
}: {
  data: DashOverview | null;
  keys: string[];
  available: Set<string>;
  onChange: (keys: string[]) => void;
  months: 6 | 12;
  onMonths: (m: 6 | 12) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false);
  const [hv, setHv] = useState<number | null>(null);
  const shown = keys.filter((k) => available.has(k));
  const [sel, setSel] = useState(shown[0] || '');
  useEffect(() => {
    if (!shown.includes(sel)) setSel(shown[0] || '');
  }, [shown.join(','), sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (k: string) =>
    onChange(keys.includes(k) ? (keys.length > 1 ? keys.filter((x) => x !== k) : keys) : keys.length >= HOME_MAX_SERIES ? [...keys.slice(1), k] : [...keys, k]);

  const s = data?.series[sel];
  const cur = data?.currency || 'EUR';
  const ok = s && !isErr(s) ? s : null;
  const f = ok ? ok.current.slice(-months) : [];
  const p = ok ? ok.previous.slice(-months) : [];
  const labels = ok ? ok.labels.slice(-months) : [];
  const monthName = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y!, (m || 1) - 1, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '');
  };
  // деньги — в тысячах/миллионах выбранной валюты («тыс ₺»), остальное — как есть
  const rawMax = Math.max(0, ...f, ...p);
  const div = ok?.format === 'money' ? (rawMax >= 2_000_000 ? 1_000_000 : rawMax >= 20_000 ? 1000 : 1) : 1;
  const unit =
    ok?.format === 'money'
      ? `${div === 1_000_000 ? t('crm.home.units.m') + ' ' : div === 1000 ? t('crm.home.units.k') + ' ' : ''}${currencySymbol(cur, locale)}`
      : ok?.format === 'pct'
        ? '%'
        : t(`crm.home.seriesUnits.${sel}`, { defaultValue: '' });
  const W = 600;
  const H = 220;
  const P = 8;
  const max = niceMax((rawMax / div) * 1.1);
  const n = Math.max(2, f.length);
  const X = (i: number) => P + (i * (W - P * 2)) / (n - 1);
  const Y = (v: number) => H - (v / div / max) * H;
  const fp = f.map((v, i) => [X(i), Y(v)] as [number, number]);
  const pp = p.map((v, i) => [X(i), Y(v)] as [number, number]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => max * k);
  const fmtTick = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: v < 10 ? 1 : 0 });
  const sumF = f.reduce((a, b) => a + b, 0);
  const sumP = p.reduce((a, b) => a + b, 0);
  const fmtTotal = (v: number) => (ok ? fmtValue(v, ok.format === 'pct' ? 'num' : ok.format, cur, locale) : '—');

  return (
    <section className="a2-panel a3-chart">
      <header className="a2-ph">
        <h3>{t('crm.home.dynamics')}</h3>
        <div className="a2-tools">
          <div className="a3-seg">
            {shown.map((k) => (
              <button key={k} type="button" className={k === sel ? 'on' : ''} onClick={() => setSel(k)}>
                {t(`crm.home.series.${k}`)}
              </button>
            ))}
          </div>
          <button type="button" className={`a2-rb sm${edit ? ' dark' : ''}`} title={t('crm.home.whatToShow')} onClick={() => setEdit((e) => !e)}>
            <Ic n="sliders" s={14} />
          </button>
        </div>
      </header>
      {edit && (
        <div className="a3-ppick in">
          <span className="a2-note">{t('crm.home.seriesHint', { count: HOME_MAX_SERIES })}</span>
          <div className="a3-chips">
            {HOME_SERIES.filter((x) => available.has(x.key)).map((x) => (
              <button key={x.key} type="button" className={keys.includes(x.key) ? 'on' : ''} onClick={() => toggle(x.key)}>
                {t(`crm.home.series.${x.key}`)}
                <em>{t(`crm.home.cats.${x.cat}`)}</em>
              </button>
            ))}
          </div>
          <div className="a3-seg" style={{ alignSelf: 'flex-start' }}>
            {([6, 12] as const).map((m) => (
              <button key={m} type="button" className={m === months ? 'on' : ''} onClick={() => onMonths(m)}>
                {t('crm.home.monthsN', { count: m })}
              </button>
            ))}
          </div>
        </div>
      )}
      {!shown.length ? (
        <div className="a3-empty">{t('crm.home.seriesEmpty')}</div>
      ) : !ok ? (
        <div className="a3-empty">{s && isErr(s) ? t(`crm.home.errors.${s.error}`) : t('crm.dashboard.loading')}</div>
      ) : (
        <>
          <div className="a3-legend">
            <span>
              <i className="f" />
              {t('crm.home.fact')}
            </span>
            <span>
              <i className="p" />
              {t('crm.home.yearAgo')}
            </span>
            <span className="u">
              {unit ? `${unit} · ` : ''}
              {labels.length ? `${monthName(labels[0]!)} — ${monthName(labels[labels.length - 1]!)}` : ''}
            </span>
          </div>
          <div className="a3-plot" onMouseLeave={() => setHv(null)}>
            <div className="a3-y">
              {ticks
                .slice()
                .reverse()
                .map((v, i) => (
                  <span key={i}>{fmtTick(v)}</span>
                ))}
            </div>
            <div className="a3-svgw">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" key={sel + months + cur}>
                <defs>
                  <clipPath id="a3reveal">
                    <rect className="rv" x="0" y="-20" width={W} height={H + 40} />
                  </clipPath>
                  <pattern id="a3h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(0,0,0,.09)" strokeWidth="1.5" />
                  </pattern>
                </defs>
                {ticks.map((v, i) => (
                  <line key={i} x1="0" x2={W} y1={Y(v * div)} y2={Y(v * div)} className="gl" />
                ))}
                {fp.length > 1 && <path d={`${smoothPath(fp)} L${X(fp.length - 1)},${H} L${X(0)},${H} Z`} fill="url(#a3h)" className="ar" />}
                {pp.length > 1 && <path d={smoothPath(pp)} className="lp" />}
                {/* появление — маской слева направо: pathLength + non-scaling-stroke браузер считает
                    неверно, и линия обрывалась на середине графика */}
                {fp.length > 1 && <path d={smoothPath(fp)} className="lf" clipPath="url(#a3reveal)" />}
                {hv != null && <line x1={X(hv)} x2={X(hv)} y1="0" y2={H} className="hl" />}
              </svg>
              {f.map((_, i) => (
                <span key={i} className="a3-hit" style={{ left: `${(X(i) / W) * 100}%`, width: `${100 / n}%` }} onMouseEnter={() => setHv(i)} onTouchStart={() => setHv(i)} />
              ))}
              {hv != null && f[hv] != null && (
                <>
                  <span className="a3-dot" style={{ left: `${(X(hv) / W) * 100}%`, top: `${(Y(f[hv]!) / H) * 100}%` }} />
                  <div
                    className="a3-tip"
                    style={{
                      left: `${Math.min(88, Math.max(12, (X(hv) / W) * 100))}%`,
                      top: `${(Y(Math.max(f[hv]!, p[hv] ?? 0)) / H) * 100}%`,
                    }}
                  >
                    <b>{monthName(labels[hv]!)}</b>
                    <span>
                      {t('crm.home.fact')} {fmtTotal(f[hv]!)}
                    </span>
                    <span>
                      {t('crm.home.yearAgo')} {fmtTotal(p[hv] ?? 0)}
                    </span>
                    {p[hv] ? (
                      <em className={f[hv]! >= p[hv]! ? 'up' : 'dn'}>
                        {f[hv]! >= p[hv]! ? '+' : ''}
                        {Math.round((f[hv]! / p[hv]! - 1) * 100)}%
                      </em>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="a3-x">
            {labels.map((m) => (
              <span key={m}>{monthName(m)}</span>
            ))}
          </div>
          {ok.format !== 'pct' && (
            <div className="a3-sum">
              <div>
                {t('crm.home.totalPeriod', { count: months })}
                <b>{fmtTotal(sumF)}</b>
              </div>
              <div>
                {t('crm.home.yearAgo')}
                <b>{fmtTotal(sumP)}</b>
              </div>
              {sumP > 0 && (
                <div>
                  {t('crm.home.change')}
                  <b>
                    {sumF >= sumP ? '+' : '−'}
                    {Math.abs(Math.round((sumF / sumP - 1) * 100))}%
                  </b>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────── таймлайн ───────────── */

type TlTab = 'today' | 'past' | 'tasks';
const TL_COLLAPSED = 5;

export function HomeTimeline({ data, locale }: { data: DashOverview | null; locale: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TlTab>('today');
  const [expanded, setExpanded] = useState(false);
  const all: DashTimelineItem[] = data?.timeline[tab] || [];
  const list = expanded ? all : all.slice(0, TL_COLLAPSED);
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '');
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const range = (e: DashTimelineItem) =>
    e.kind === 'task' ? (e.overdue ? t('crm.home.tl.overdue') : t('crm.home.tl.until', { time: time(e.at) })) : `${time(e.at)}${e.end ? ` — ${time(e.end)}` : ''}`;
  return (
    <section className="a2-panel a3-tl">
      <div className="a3-tabs">
        {(['today', 'past', 'tasks'] as TlTab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={k === tab ? 'on' : ''}
            onClick={() => {
              setTab(k);
              setExpanded(false);
            }}
          >
            {t(`crm.home.tl.${k}`)}
            <em>{data?.timeline[k].length ?? 0}</em>
          </button>
        ))}
      </div>
      {!list.length ? (
        <div className="a3-empty">
          {t(`crm.home.tl.empty_${tab}`)}{' '}
          {tab !== 'past' && <Link to={tab === 'tasks' ? '/projects/list' : '/calendar'}>{t('crm.home.tl.open')}</Link>}
        </div>
      ) : (
        <div className="a3-tl-list" key={tab}>
          {list.map((e, i) => (
            <div
              key={e.id}
              className={`a3-tli${i === 0 && tab !== 'past' ? ' first' : ''}${e.overdue ? ' od' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="mk" />
              <div className="a3-tlc">
                <div className="dt">
                  <b>{day(e.at)}</b>
                  <span className={e.overdue ? 'od' : ''}>{range(e)}</span>
                </div>
                <div className="f">
                  <span>{e.kind === 'task' && e.sub ? e.sub : t(`crm.home.tl.kind_${e.kind}`)}</span>
                  <b>{e.title}</b>
                </div>
                <div className="f sm">
                  <span>{e.kind === 'meeting' && e.sub && e.sub !== e.title ? t('crm.home.tl.client') : t('crm.home.tl.responsible')}</span>
                  <b>{e.kind === 'meeting' && e.sub && e.sub !== e.title ? e.sub : e.who || '—'}</b>
                </div>
                <button type="button" className="a2-rb sm" title={t('crm.home.open')} onClick={() => navigate(e.link)}>
                  <Ic n="open" s={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {all.length > TL_COLLAPSED && (
        <button type="button" className="a3-tl-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('crm.home.tl.collapse') : t('crm.home.tl.show_all', { count: all.length - TL_COLLAPSED })}
          <span className={expanded ? 'up' : ''}>
            <Ic n="down" s={14} />
          </span>
        </button>
      )}
    </section>
  );
}

/* ───────────── заметки ───────────── */

export function HomeNotes({ data, locale }: { data: DashOverview | null; locale: string }) {
  const { t } = useTranslation();
  const [txt, setTxt] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const value = txt ?? data?.notes.text ?? '';
  const savedAt = saved || data?.notes.updatedAt || null;
  const dirty = txt != null && txt !== (data?.notes.text ?? '');
  const save = async () => {
    setBusy(true);
    setErr(false);
    try {
      const r = await saveDashboardNotes(value);
      setSaved(r.updatedAt);
      if (data) data.notes = { text: value, updatedAt: r.updatedAt };
      setTxt(null);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="a2-panel a3-notes">
      <header className="a2-ph">
        <h3>{t('crm.home.notes')}</h3>
      </header>
      <div className="a3-pad">
        <textarea
          value={value}
          placeholder={t('crm.home.notesPh')}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && dirty) save();
          }}
          rows={6}
        />
        <button type="button" className={`a3-save${!dirty && savedAt ? ' ok' : ''}`} disabled={busy || !dirty} onClick={save}>
          {busy ? '…' : dirty ? t('crm.common.save') : savedAt ? `✓ ${t('crm.home.saved')}` : t('crm.common.save')}
        </button>
      </div>
      <div className="a3-last">
        {err
          ? t('crm.home.saveFailed')
          : savedAt
            ? t('crm.home.savedAt', { at: new Date(savedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
            : t('crm.home.notesPrivate')}
      </div>
    </section>
  );
}

/* ───────────── медиа-папки ───────────── */

export function HomeFolders({ data }: { data: DashOverview | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cp, setCp] = useState<string | null>(null);
  const folders = data?.folders;
  if (!folders) return null;
  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCp(id);
      window.setTimeout(() => setCp(null), 1600);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };
  return (
    <section className="a2-panel">
      <header className="a2-ph">
        <h3>
          {t('crm.home.folders')} <span className="n">({folders.total})</span>
        </h3>
        <Link className="a2-pill sm" to="/media">
          {t('crm.home.allFolders')} →
        </Link>
      </header>
      {!folders.items.length ? (
        <div className="a3-empty">
          {t('crm.home.foldersEmpty')} <Link to="/media">{t('crm.home.tl.open')}</Link>
        </div>
      ) : (
        <div className="a3-folders">
          {folders.items.map((f, i) => (
            <article key={f.id} className="a3-fold" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="hd">
                <div className="a3-fico">
                  <i />
                  <b />
                </div>
                <span className="cnt">
                  <b>{t('crm.home.filesN', { count: f.files })}</b>
                  <span>{t('crm.home.downloadsN', { count: f.downloads })}</span>
                </span>
              </div>
              <div className="n" title={f.name}>
                {f.name}
              </div>
              <div className="d">{f.hotel || t('crm.home.noHotel')}</div>
              <div className="ac">
                {f.shareUrl ? (
                  <button type="button" className="a3-share" onClick={() => copy(f.id, f.shareUrl!)}>
                    <Ic n="share" s={14} />
                    <span>{cp === f.id ? t('crm.home.copied') : t('crm.home.copyLink')}</span>
                  </button>
                ) : (
                  <button type="button" className="a3-share" onClick={() => navigate(`/media?folder=${f.id}`)}>
                    <Ic n="folder" s={14} />
                    <span>{t('crm.home.openFolder')}</span>
                  </button>
                )}
                <button type="button" className="a2-rb sm" title={t('crm.home.open')} onClick={() => navigate(`/media?folder=${f.id}`)}>
                  <Ic n="open" s={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────────── живая лента ───────────── */

const FEED_IC: Record<DashFeedItem['kind'], string> = {
  lead: 'user',
  sale: 'card',
  booking: 'calendar',
  call: 'phone',
  activity: 'chat',
  media: 'folder',
  review: 'star',
};

export function HomeFeed({
  data,
  locale,
  onRefresh,
  refreshing,
}: {
  data: DashOverview | null;
  locale: string;
  onRefresh: () => void;
  refreshing: number;
}) {
  const { t } = useTranslation();
  const items = data?.feed || [];
  const seen = useRef<Set<string> | null>(null);
  const fresh = useMemo(() => {
    if (!data) return new Set<string>();
    const prev = seen.current;
    const next = new Set(items.map((x) => x.id));
    seen.current = next;
    if (!prev) return new Set<string>();
    return new Set(items.filter((x) => !prev.has(x.id)).map((x) => x.id));
  }, [items, data]);
  const cur = data?.currency || 'EUR';
  const today = new Date().toDateString();
  const statusLabel = (e: DashFeedItem) => {
    if (!e.status) return null;
    const k = `crm.home.feedStatus.${e.kind}.${e.status}`;
    const tr = t(k, { defaultValue: '' });
    if (tr) return tr;
    return t(`crm.home.feedStatus.any.${e.status}`, { defaultValue: e.kind === 'activity' ? '' : e.status });
  };
  return (
    <aside className="a2-panel a2-feed">
      <header className="a2-ph">
        <h3>
          {t('crm.home.feed')}{' '}
          <span className="a2-live">
            <i />
            live
          </span>
        </h3>
        <button type="button" className="a2-rb" title={t('crm.home.refresh')} onClick={onRefresh}>
          <span className="rot" key={refreshing}>
            <Ic n="refresh" />
          </span>
        </button>
      </header>
      <div className="a2-fl">
        {!items.length && <div className="a3-empty">{data ? t('crm.home.feedEmpty') : t('crm.dashboard.loading')}</div>}
        {items.map((e, i) => {
          const d = new Date(e.at);
          const st = statusLabel(e);
          return (
            <div key={e.id} className={`a2-fi${fresh.has(e.id) ? ' fresh' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <div className="when">
                <span className="ic">
                  <Ic n={FEED_IC[e.kind]} s={16} />
                </span>
                <b>{d.toDateString() === today ? t('crm.home.todayShort') : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}</b>
                <span>{d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <Link className="a2-fc" to={e.link}>
                <div className="hd">
                  <div className="t">
                    <div className="n">{e.title || '—'}</div>
                    <div className="s">{t(`crm.home.feedKind.${e.kind}`)}{e.sub ? ` · ${e.kind === 'activity' && e.status === 'status_changed' ? t(`crm.home.feedStatus.any.${e.sub}`, { defaultValue: e.sub }) : e.sub}` : ''}</div>
                  </div>
                  {e.value != null && (
                    <span className="val">
                      {e.format === 'money' ? fmtValue(e.value, 'money', cur, locale) : e.kind === 'review' ? `${e.value}/10` : e.kind === 'media' ? t('crm.home.filesN', { count: e.value }) : e.kind === 'call' ? `${Math.round(e.value / 60)} ${t('crm.home.min')}` : e.value}
                    </span>
                  )}
                </div>
                {st && (
                  <div className="row">
                    <span className="chips">
                      <span className="a2-chip">{t(`crm.home.cats.${feedCat(e.kind)}`)}</span>
                    </span>
                    <span className="a2-chip st">{st}</span>
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function feedCat(k: DashFeedItem['kind']): HomeCat {
  if (k === 'lead' || k === 'sale' || k === 'activity') return 'sales';
  if (k === 'booking') return 'booking';
  if (k === 'call') return 'calls';
  if (k === 'media') return 'media';
  return 'reviews';
}

/* ───────────── шапка ───────────── */

export function HomeTitle({ data, name, locale }: { data: DashOverview | null; name: string; locale: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const h = now.getHours();
  const g = h < 5 ? t('crm.home.greetNight') : h < 12 ? t('crm.dashboard.greeting.morning') : h < 18 ? t('crm.dashboard.greeting.afternoon') : t('crm.dashboard.greeting.evening');
  const online = data?.online || [];
  const upd = data ? new Date(data.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—';
  return (
    <div className="a2-title">
      <div>
        <div className="a3-upd">
          <span className="a3-live-dot" />
          {t('crm.home.updated', { time: upd })} · {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1>
          <span>{g},</span> {name}
        </h1>
      </div>
      {online.length > 0 && (
        <div className="a2-online">
          <span>
            {t('crm.home.onlineNow')} <em>({online.length})</em>
          </span>
          <span className="avs">
            {online.slice(0, 7).map((p, i) => {
              const src = resolvePublicAssetUrl(p.avatarUrl);
              const c = GRAYS[i % GRAYS.length]!;
              return (
                <span
                  key={p.userId}
                  className="a2-ava big"
                  title={p.name}
                  style={src ? { backgroundImage: `url("${src}")` } : { background: c, color: grayFg(c) }}
                >
                  {src ? null : initials(p.name)}
                  {p.me && <b className="new">{t('crm.home.you')}</b>}
                </span>
              );
            })}
          </span>
        </div>
      )}
    </div>
  );
}
