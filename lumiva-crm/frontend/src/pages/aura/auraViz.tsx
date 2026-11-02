import React, { useEffect, useId, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { AuraData, AuraFormat, AuraStreamItem, AuraTone, AuraWidgetData } from '../../api/aura';
import { Link } from 'react-router-dom';
import { auBucketLabel, auFmt, auLocale } from './auraModel';

/* Общие примитивы дашборда + виджеты «стеклянных» шаблонов (гейдж, прогноз, лента, календарь…). */

export const C = ['var(--a-c1)', 'var(--a-c2)', 'var(--a-c3)', 'var(--a-c4)', 'var(--a-c5)'];

export type Fmt = { cur: string; lang: string; t: TFunction; links?: boolean; emptyText?: string };
export const fmtVal = (f: Fmt, n: number | null | undefined, format: AuraFormat, unit?: 'pcs', compact = false) =>
  auFmt(n, format, f.cur, f.lang, { unit, t: f.t, compact });

export function Empty({ text }: { text: string }) {
  return <div className="dsh-empty">{text}</div>;
}

type W<T extends AuraWidgetData['type']> = Extract<AuraWidgetData, { type: T }>;

/** Плавная кривая через точки (Catmull-Rom → Безье) — для стеклянных тем. */
export function pathOf(pts: Array<[number, number]>, smooth: boolean): string {
  if (!pts.length) return '';
  if (!smooth || pts.length < 3) return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const k = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    // по Y без перелёта за соседние точки — кривая не уходит ниже нуля
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) * k));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) * k));
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Мини-график KPI штрихами («штрих-код», как в макетах 2026). */
export function SparkTicks({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <div className="dsh-spark dsh-spark-empty" />;
  const mx = Math.max(...data, 0);
  const n = data.length;
  const w = 100;
  const step = w / n;
  const bw = Math.max(0.8, Math.min(step * 0.42, 3));
  return (
    <svg className="dsh-spark dsh-ticks" viewBox={`0 0 ${w} 36`} preserveAspectRatio="none" aria-hidden>
      {data.map((v, i) => {
        const h = mx > 0 ? Math.max(3, (v / mx) * 34) : 3;
        return <rect key={i} x={i * step + (step - bw) / 2} y={36 - h} width={bw} height={h} rx={bw / 2} className={i === n - 1 ? 'on' : ''} style={{ animationDelay: `${i * 0.012}s` }} />;
      })}
    </svg>
  );
}

const TONE: Record<AuraTone, string> = { good: 'var(--a-good)', bad: 'var(--a-bad)', warn: 'var(--a-warn)', neutral: 'var(--a-neu)' };

/* ---------- приветствие ---------- */

function greetingKey(h: number) {
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : 'evening';
}

const HERO_LINKS: Record<string, string> = { leads: '/leads', revenue: '/sales', bookings: '/bookings', calls: '/telephony' };

export function Hero({ w, f }: { w: W<'hero'>; f: Fmt }) {
  const now = new Date();
  const g = f.t(`crm.aura.hero.${greetingKey(now.getHours())}`);
  const date = now.toLocaleDateString(auLocale(f.lang), { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="dsh-hero">
      <div className="dsh-hero-l">
        <span className="dsh-hero-date">{date}</span>
        <h2 className="dsh-hero-h">{w.name ? `${g}, ${w.name}` : g}</h2>
        <p className="dsh-hero-sub">{f.t('crm.aura.hero.sub')}</p>
        {f.links && (
          <div className="dsh-hero-act">
            <Link to="/leads" className="dsh-hero-btn">
              <i>+</i>
              {f.t('crm.aura.hero.newLead')}
            </Link>
            <Link to="/sales" className="dsh-hero-btn">
              {f.t('crm.aura.hero.openSales')}
            </Link>
            <Link to="/aura/apps" className="dsh-hero-btn">
              {f.t('crm.aura.hero.allApps')}
            </Link>
          </div>
        )}
      </div>
      <div className="dsh-hero-stats">
        {w.items.map((it, i) => {
          const inner = (
            <>
              <b className="dsh-fit">{fmtVal(f, it.value, it.format, undefined, true)}</b>
              <span>{f.t(`crm.aura.hero.today.${it.key}`)}</span>
            </>
          );
          return f.links && HERO_LINKS[it.key] ? (
            <Link key={it.key} to={HERO_LINKS[it.key]} className="dsh-hero-stat" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              {inner}
            </Link>
          ) : (
            <div key={it.key} className="dsh-hero-stat" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- чек-лист «С чего начать» ---------- */

const CHECK_LINKS: Record<string, string> = {
  lead: '/leads',
  team: '/staff',
  sale: '/sales',
  calls: '/telephony',
  ads: '/integrations-hub',
  products: '/products',
  booking: '/bookings',
  aura: '/aura',
};

export function Check({ w, f }: { w: W<'check'>; f: Fmt }) {
  const done = w.items.filter((x) => x.done).length;
  const pct = w.items.length ? Math.round((done / w.items.length) * 100) : 0;
  return (
    <div className="dsh-check">
      <p className="dsh-check-sub">{f.t('crm.aura.check.sub')}</p>
      <div className="dsh-check-top">
        <span>{f.t('crm.aura.check.progress', { done, total: w.items.length })}</span>
        <b>{pct}%</b>
      </div>
      <div className="dsh-check-bar">
        <span style={{ width: pct + '%' }} />
      </div>
      <ul>
        {w.items.map((it, i) => {
          const label = f.t(`crm.aura.check.${it.key}`);
          return (
            <li key={it.key} className={it.done ? 'done' : ''} style={{ animationDelay: `${i * 0.04}s` }}>
              <span className="dsh-check-ic" aria-hidden>
                {it.done && (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              {f.links && !it.done ? <Link to={CHECK_LINKS[it.key] || '/'}>{label}</Link> : <span>{label}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- полукруглый гейдж ---------- */

export function Gauge({ w, f, k }: { w: W<'gauge'>; f: Fmt; k: string }) {
  const tot = w.rows.reduce((a, r) => a + r.value, 0);
  if (!tot || w.value == null) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  // сегменты с плоскими концами и узким зазором; края дуги скругляем кружками цвета крайних сегментов
  const gap = 1.1;
  const shown = w.rows.filter((r) => r.value > 0);
  let acc = 0;
  return (
    <div className="dsh-gauge">
      <div className="dsh-gauge-arc">
        <svg viewBox="0 0 200 112" aria-hidden>
          <path d="M16 100 A84 84 0 0 1 184 100" pathLength={100} className="dsh-gauge-track" />
          {shown.map((r, i) => {
            const len = (r.value / tot) * 100;
            const last = i === shown.length - 1;
            const seg = Math.max(0.35, len - (shown.length > 1 && !last ? gap : 0));
            const el = (
              <path
                key={r.key}
                d="M16 100 A84 84 0 0 1 184 100"
                pathLength={100}
                className="dsh-gauge-seg"
                style={{ stroke: TONE[r.tone], strokeDasharray: `${seg} 200`, strokeDashoffset: -acc, animationDelay: `${i * 0.08}s` }}
              />
            );
            acc += len;
            return el;
          })}
          <circle cx="16" cy="100" r="7" className="dsh-gauge-cap" style={{ fill: TONE[shown[0].tone] }} />
          <circle cx="184" cy="100" r="7" className="dsh-gauge-cap dsh-gauge-cap-end" style={{ fill: TONE[shown[shown.length - 1].tone] }} />
        </svg>
        <div className="dsh-gauge-c">
          <span>{f.t(`crm.aura.gauge.${k}`)}</span>
          <b>{fmtVal(f, w.value, 'pct')}</b>
        </div>
      </div>
      <div className="dsh-gauge-rows">
        {w.rows.map((r, i) => (
          <div key={r.key} style={{ animationDelay: `${0.15 + i * 0.05}s` }}>
            <i style={{ background: TONE[r.tone] }} />
            <span>{f.t(`crm.aura.part.${r.key}`)}</span>
            <b>{fmtVal(f, r.value, 'int')}</b>
            <em className={'dsh-tone-' + r.tone}>{Math.round((r.value / tot) * 100)}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- сегментная шкала ---------- */

const segLabel = (f: Fmt, key: string) => (key.startsWith('~') ? key.slice(1) : f.t(`crm.aura.part.${key}`));

export function SegBar({ w, f }: { w: W<'segbar'>; f: Fmt }) {
  const tot = w.items.reduce((a, b) => a + b.value, 0);
  const [hv, setHv] = useState<string | null>(null);
  if (!tot) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-seg2">
      <div className="dsh-seg2-top">
        <span className="dsh-big dsh-fit">{fmtVal(f, tot, w.format, undefined, true)}</span>
        <span className="dsh-mute">{f.t('crm.aura.total')}</span>
      </div>
      <div className="dsh-seg2-bar" onMouseLeave={() => setHv(null)}>
        {w.items
          .map((it, i) => ({ it, i }))
          .filter(({ it }) => it.value > 0)
          .map(({ it, i }) => {
            const p = (it.value / tot) * 100;
            return (
              <div
                key={it.key}
                className={'dsh-seg2-s dsh-pat' + (i % 3) + (hv && hv !== it.key ? ' dim' : '')}
                style={{ flexGrow: p, ['--sc' as string]: it.tone ? TONE[it.tone] : C[i % 5], animationDelay: `${i * 0.07}s` } as React.CSSProperties}
                onMouseEnter={() => setHv(it.key)}
                title={`${segLabel(f, it.key)}: ${fmtVal(f, it.value, w.format)}`}
              >
                {p >= 9 && <em>{Math.round(p)}%</em>}
                <span />
              </div>
            );
          })}
      </div>
      <div className="dsh-seg2-rows">
        {w.items.map((it, i) => (
          <div key={it.key} className={hv && hv !== it.key ? 'dim' : ''} onMouseEnter={() => setHv(it.key)} onMouseLeave={() => setHv(null)}>
            <i style={{ background: it.tone ? TONE[it.tone] : C[i % 5] }} />
            <span>{segLabel(f, it.key)}</span>
            <b>{fmtVal(f, it.value, w.format, undefined, true)}</b>
            <em>{Math.round((it.value / tot) * 100)}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- прогноз на месяц ---------- */

export function Forecast({ w, f }: { w: W<'forecast'>; f: Fmt }) {
  const rest = Math.max(0, w.projected - w.done);
  const scale = Math.max(w.projected, w.target || 0, w.prev, 1);
  const toGoal = w.target ? Math.max(0, w.target - w.projected) : 0;
  // темп без единой продажи в месяце — не «−100%», а просто «ещё нет продаж»
  const pace = w.prevSameDay > 0 && w.done > 0 ? Math.round((w.done / w.prevSameDay - 1) * 100) : null;
  const parts = [
    { key: 'done', v: w.done, cls: 'dsh-fc-done' },
    { key: 'rest', v: rest, cls: 'dsh-fc-rest' },
    { key: 'gap', v: toGoal, cls: 'dsh-fc-gap' },
  ].filter((p) => p.v > 0);
  if (!w.done && !w.prev && !w.target) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-fc">
      <div className="dsh-fc-top">
        <span className="dsh-big dsh-fit">{fmtVal(f, w.projected, w.format, undefined, true)}</span>
        {pace != null && <span className={'dsh-pill ' + (pace >= 0 ? 'good' : 'bad')}>{(pace >= 0 ? '↑ ' : '↓ ') + Math.abs(pace) + '%'}</span>}
      </div>
      <div className="dsh-fc-sub">{f.t('crm.aura.fc.sub', { day: w.day, days: w.days })}</div>
      {!w.done ? (
        <div className="dsh-fc-none">
          <span>{f.t('crm.aura.fc.noneYet')}</span>
          {w.prev > 0 && <b>{f.t('crm.aura.fc.prevWas', { value: fmtVal(f, w.prev, w.format, undefined, true) })}</b>}
        </div>
      ) : (
      <div className="dsh-fc-bar">
        {parts.map((p, i) => (
          <div key={p.key} className={'dsh-fc-s ' + p.cls} style={{ flexGrow: (p.v / scale) * 100, animationDelay: `${i * 0.1}s` }}>
            <em>{Math.round((p.v / scale) * 100)}%</em>
            <span />
          </div>
        ))}
        {w.projected < scale && !toGoal && <div className="dsh-fc-s dsh-fc-free" style={{ flexGrow: ((scale - w.projected) / scale) * 100 }}><span /></div>}
      </div>
      )}
      <div className="dsh-fc-leg">
        <span>
          <i className="dsh-fc-done" />
          {f.t('crm.aura.fc.done')} <b>{fmtVal(f, w.done, w.format, undefined, true)}</b>
        </span>
        <span>
          <i className="dsh-fc-rest" />
          {f.t('crm.aura.fc.rest')} <b>{fmtVal(f, rest, w.format, undefined, true)}</b>
        </span>
        {w.target ? (
          <span>
            <i className="dsh-fc-gap" />
            {f.t('crm.aura.fc.goal')} <b>{fmtVal(f, w.target, w.format, undefined, true)}</b>
          </span>
        ) : (
          <span>
            <i className="dsh-fc-prev" />
            {f.t('crm.aura.fc.prev')} <b>{fmtVal(f, w.prev, w.format, undefined, true)}</b>
          </span>
        )}
      </div>
      {w.series && w.series.length > 1 && <ForecastChart w={w} f={f} />}
      <div className="dsh-fc-conf">
        <span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
          </svg>
          {f.t('crm.aura.fc.pace')}
        </span>
        <b>{pace != null ? (pace > 0 ? '+' : pace < 0 ? '−' : '') + Math.abs(pace) + '%' : '—'}</b>
        <em>{f.t('crm.aura.fc.vsPrev')}</em>
      </div>
    </div>
  );
}

/** Накопительно за месяц: факт, прошлый месяц пунктиром, прогноз до конца месяца, линия цели. */
function ForecastChart({ w, f }: { w: W<'forecast'>; f: Fmt }) {
  const id = useId().replace(/:/g, '');
  const cur = w.series || [];
  const prev = w.prevSeries || [];
  const D = Math.max(w.days, prev.length, 2);
  const mx = Math.max(1, w.projected, w.target || 0, ...prev) * 1.08;
  const Wd = 600;
  const Ht = 120;
  const x = (i: number) => (i / (D - 1)) * Wd;
  const y = (v: number) => Ht - (v / mx) * Ht;
  const curPts = cur.map((v, i) => [x(i), y(v)] as [number, number]);
  const last = curPts[curPts.length - 1];
  const dCur = pathOf(curPts, true);
  const dPrev = pathOf(prev.map((v, i) => [x(i), y(v)] as [number, number]), true);
  return (
    <div className="dsh-fc-chart">
      <svg viewBox={`0 0 ${Wd} ${Ht}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--a-c1)', stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: 'var(--a-c1)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {w.target ? <line x1="0" x2={Wd} y1={y(w.target)} y2={y(w.target)} className="dsh-fc-goal" vectorEffect="non-scaling-stroke" /> : null}
        {prev.length > 1 && <path d={dPrev} className="dsh-fc-prevl" vectorEffect="non-scaling-stroke" />}
        <path d={`${dCur} L${last[0]},${Ht} L0,${Ht} Z`} fill={`url(#${id})`} />
        <path d={dCur} className="dsh-fc-curl dsh-draw" vectorEffect="non-scaling-stroke" />
        <path d={`M${last[0]},${last[1]} L${x(D - 1)},${y(w.projected)}`} className="dsh-fc-projl" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="dsh-fc-now" style={{ left: (last[0] / Wd) * 100 + '%', top: (last[1] / Ht) * 100 + '%' }} />
      <span className="dsh-fc-end" style={{ top: (y(w.projected) / Ht) * 100 + '%' }}>
        {fmtVal(f, w.projected, w.format, undefined, true)}
      </span>
    </div>
  );
}

/* ---------- живая лента ---------- */

function useNow(ms = 30_000) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setN(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return n;
}

export function relTime(at: string, now: number, lang: string) {
  const diff = (new Date(at).getTime() - now) / 1000;
  const a = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(auLocale(lang), { numeric: 'auto', style: 'short' });
  if (a < 45) return rtf.format(0, 'second');
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(at).toLocaleDateString(auLocale(lang), { day: 'numeric', month: 'short' });
}

const GOOD_ST = new Set(['won', 'confirmed', 'completed', 'checked_in', 'answered']);
const BAD_ST = new Set(['lost', 'missed', 'no_show', 'cancelled', 'cancelled_by_customer', 'cancelled_by_business', 'rejected', 'refunded', 'failed']);

const KIND_IC: Record<AuraStreamItem['kind'], string> = {
  lead: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  sale: 'M3 7h18l-2 12H5L3 7zM8 7V5a4 4 0 0 1 8 0v2',
  booking: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  call: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
};

function streamValue(it: AuraStreamItem, f: Fmt) {
  if (it.kind === 'sale') return it.value == null ? '•••' : fmtVal(f, it.value, 'money', undefined, true);
  if (it.kind === 'call') {
    if (!it.value) return '—';
    const m = Math.floor(it.value / 60);
    return `${m}:${String(it.value % 60).padStart(2, '0')}`;
  }
  if (it.kind === 'booking') return it.value ? `×${it.value}` : '—';
  return f.t(`crm.aura.leadSource.${it.sub || 'unknown'}`, { defaultValue: it.sub || '—' });
}

function streamSub(it: AuraStreamItem, f: Fmt) {
  if (it.kind === 'call') return f.t(`crm.aura.stream.dir.${it.sub}`, { defaultValue: it.sub || '' });
  if (it.kind === 'lead') return f.t('crm.aura.stream.kind.lead');
  return it.sub || f.t(`crm.aura.stream.kind.${it.kind}`);
}

export function Stream({ w, f }: { w: W<'stream'>; f: Fmt }) {
  const now = useNow();
  if (!w.items.length) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-stream">
      <div className="dsh-stream-h">
        <span>{f.t('crm.aura.stream.col.name')}</span>
        <span>{f.t('crm.aura.stream.col.time')}</span>
        <span>{f.t('crm.aura.stream.col.value')}</span>
        <span>{f.t('crm.aura.stream.col.status')}</span>
      </div>
      {w.items.map((it, i) => {
        const st = it.status;
        const tone = GOOD_ST.has(st) ? 'good' : BAD_ST.has(st) ? 'bad' : 'neutral';
        return (
          <div key={it.kind + it.at + i} className="dsh-stream-r" style={{ animationDelay: `${i * 0.045}s` }}>
            <span className="dsh-stream-n">
              <span className={'dsh-stream-ic dsh-k-' + it.kind}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={KIND_IC[it.kind]} />
                </svg>
              </span>
              <span className="dsh-stream-t">
                <b>{it.title || f.t('crm.aura.stream.noName')}</b>
                <em>{streamSub(it, f)}</em>
              </span>
            </span>
            <span className="dsh-stream-time">{relTime(it.at, now, f.lang)}</span>
            <span className="dsh-stream-v">{streamValue(it, f)}</span>
            <span className={'dsh-stchip dsh-tone-' + tone}>{f.t(`crm.aura.st.${it.kind}.${st}`, { defaultValue: st })}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- пульс данных ---------- */

export function Status({ w, f }: { w: W<'status'>; f: Fmt }) {
  const now = useNow();
  if (!w.items.length) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-status">
      {w.items.map((it, i) => {
        const age = it.last ? now - new Date(it.last).getTime() : Infinity;
        const tone = age < 86_400_000 ? 'good' : age < 7 * 86_400_000 ? 'warn' : 'off';
        return (
          <div key={it.key} className={'dsh-status-r dsh-st-' + tone} style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="dsh-status-dot" />
            <span className="dsh-status-n">
              <b>{f.t(`crm.aura.src.${it.key}.name`)}</b>
              <em>{it.last ? relTime(it.last, now, f.lang) : f.t('crm.aura.pulse.never')}</em>
            </span>
            <span className="dsh-status-c">{it.n24 ? `+${it.n24}` : '0'}</span>
          </div>
        );
      })}
      <div className="dsh-status-note">{f.t('crm.aura.pulse.note')}</div>
    </div>
  );
}

/* ---------- несколько линий ---------- */

export function Multi({ w, f, data, smooth }: { w: W<'multi'>; f: Fmt; data: AuraData; smooth: boolean }) {
  const id = useId().replace(/:/g, '');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [hv, setHv] = useState<number | null>(null);
  const vis = w.series.filter((s) => !off.has(s.key));
  const n = w.series[0]?.data.length || 0;
  if (!n || !w.series.some((s) => s.data.some((v) => v > 0))) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  const W = 600;
  const H = 180;
  const mx = Math.max(1, ...vis.flatMap((s) => s.data)) * 1.15;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v: number) => H - (v / mx) * H;
  const labels = data.period.labels;
  const step = Math.max(1, Math.ceil(n / 6));
  const main = vis[0];
  const peak = main ? main.data.indexOf(Math.max(...main.data)) : -1;
  const i = hv ?? peak;
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHv(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const colorOf = (key: string) => C[w.series.findIndex((s) => s.key === key) % 5];
  return (
    <div className="dsh-multi">
      <div className="dsh-multi-leg">
        {w.series.map((s) => {
          const total = s.data.reduce((a, b) => a + b, 0);
          return (
            <button
              type="button"
              key={s.key}
              className={off.has(s.key) ? 'off' : ''}
              onClick={() =>
                setOff((o) => {
                  const nx = new Set(o);
                  if (nx.has(s.key)) nx.delete(s.key);
                  else if (vis.length > 1) nx.add(s.key);
                  return nx;
                })
              }
            >
              <i style={{ background: colorOf(s.key) }} />
              {f.t(`crm.aura.multi.${s.key}`)}
              <b>{fmtVal(f, total, w.format, undefined, true)}</b>
            </button>
          );
        })}
      </div>
      <div className="dsh-line-plot" onMouseMove={move} onMouseLeave={() => setHv(null)}>
        <div className="dsh-gridlines">
          <span />
          <span />
          <span />
          <span />
        </div>
        <svg className="dsh-reveal-x" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: main ? colorOf(main.key) : C[0], stopOpacity: 0.18 }} />
              <stop offset="1" style={{ stopColor: main ? colorOf(main.key) : C[0], stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {vis.map((s, k) => {
            const d = pathOf(
              s.data.map((v, j) => [x(j), y(v)]),
              smooth,
            );
            return (
              <g key={s.key}>
                {k === 0 && <path d={`${d} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${id})`} />}
                <path
                  className="dsh-draw"
                  d={d}
                  vectorEffect="non-scaling-stroke"
                  style={{ fill: 'none', stroke: colorOf(s.key), strokeWidth: k === 0 ? 2.4 : 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: k === 0 ? 1 : 0.85 }}
                />
              </g>
            );
          })}
        </svg>
        {i >= 0 && main && (
          <>
            <span className="dsh-cross" style={{ left: (x(i) / W) * 100 + '%' }} />
            {vis.map((s) => (
              <span key={s.key} className="dsh-dot" style={{ left: (x(i) / W) * 100 + '%', top: (y(s.data[i]) / H) * 100 + '%', background: colorOf(s.key) }} />
            ))}
            <div className={'dsh-tip dsh-tip-side' + (hv == null ? ' dsh-tip-peak' : '') + ((x(i) / W) * 100 > 62 ? ' dsh-tip-l' : ' dsh-tip-r')} style={{ left: (x(i) / W) * 100 + '%' }}>
              <em>
                {hv == null ? f.t('crm.aura.multi.peak') + ' · ' : ''}
                {labels[i] ? auBucketLabel(labels[i], data.period.granularity, f.lang) : ''}
              </em>
              {vis.map((s) => (
                <div key={s.key}>
                  <i style={{ background: colorOf(s.key) }} />
                  {f.t(`crm.aura.multi.${s.key}`)}
                  <b>{fmtVal(f, s.data[i], w.format, undefined, true)}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="dsh-xlabels">
        {labels.map((l, j) => (
          <span key={j}>{j % step === 0 || j === n - 1 ? auBucketLabel(l, data.period.granularity, f.lang) : ''}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- сплит двух долей ---------- */

export function Split({ w, f }: { w: W<'split'>; f: Fmt }) {
  const tot = w.a.value + w.b.value;
  if (!tot) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  const pa = Math.round((w.a.value / tot) * 100);
  const pb = 100 - pa;
  return (
    <div className="dsh-split">
      <div className="dsh-split-n">
        <div>
          <b>
            {pa}
            <small>%</small>
          </b>
          <span>{f.t(`crm.aura.part.${w.a.key}`)}</span>
          <em>{fmtVal(f, w.a.value, w.format, undefined, true)}</em>
        </div>
        <div className="r">
          <b>
            {pb}
            <small>%</small>
          </b>
          <span>{f.t(`crm.aura.part.${w.b.key}`)}</span>
          <em>{fmtVal(f, w.b.value, w.format, undefined, true)}</em>
        </div>
      </div>
      <div className="dsh-split-bar">
        <span className="a" style={{ flexGrow: Math.max(pa, 1) }} />
        <i />
        <span className="b" style={{ flexGrow: Math.max(pb, 1) }} />
      </div>
      <div className="dsh-split-scale">
        <span>{f.t(`crm.aura.part.${w.a.key}`)}</span>
        <span>{f.t(`crm.aura.part.${w.b.key}`)}</span>
      </div>
    </div>
  );
}

/* ---------- календарь-тепловая карта ---------- */

export function Cal({ w, f }: { w: W<'cal'>; f: Fmt }) {
  const [hv, setHv] = useState<number | null>(null);
  const { base, weeks, months, mx, total } = useMemo(() => {
    const [y, m, d] = w.start.split('-').map(Number);
    const base = Date.UTC(y, m - 1, d);
    const cols: Array<Array<{ i: number; v: number; date: number }>> = [];
    const months: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    w.values.forEach((v, i) => {
      const date = base + i * 86_400_000;
      const col = Math.floor(i / 7);
      (cols[col] ||= []).push({ i, v, date });
      const mm = new Date(date).getUTCMonth();
      if (i % 7 === 0 && mm !== lastMonth) {
        months.push({ col, label: new Date(date).toLocaleDateString(auLocale(f.lang), { month: 'short', timeZone: 'UTC' }) });
        lastMonth = mm;
      }
    });
    return { base, weeks: cols, months, mx: Math.max(0, ...w.values), total: w.values.reduce((a, b) => a + b, 0) };
  }, [w.start, w.values, f.lang]);
  if (!mx) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  const lvl = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / mx) * 4)));
  const hvItem = hv != null ? { v: w.values[hv], date: base + hv * 86_400_000 } : null;
  return (
    <div className="dsh-cal">
      <div className="dsh-cal-top">
        <span className="dsh-big dsh-fit">{fmtVal(f, total, w.format, undefined, true)}</span>
        <span className="dsh-cal-hint">
          {hvItem
            ? `${new Date(hvItem.date).toLocaleDateString(auLocale(f.lang), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} — ${fmtVal(f, hvItem.v, w.format, undefined, true)}`
            : f.t('crm.aura.cal.weeks', { count: weeks.length })}
        </span>
      </div>
      <div className="dsh-cal-scroll">
        <div className="dsh-cal-grid" style={{ gridTemplateColumns: `22px repeat(${weeks.length}, minmax(0, 1fr))` }} onMouseLeave={() => setHv(null)}>
          <span />
          {weeks.map((_, c) => (
            <em key={c} className="dsh-cal-m">
              {months.find((m) => m.col === c)?.label || ''}
            </em>
          ))}
          {Array.from({ length: 7 }, (_, r) => (
            <React.Fragment key={r}>
              <em className="dsh-cal-d">{r % 2 === 0 ? f.t(`crm.aura.dow.${r}`) : ''}</em>
              {weeks.map((col, c) => {
                const cell = col[r];
                if (!cell) return <span key={c} />;
                return <span key={c} className={'dsh-cal-c l' + lvl(cell.v) + (hv === cell.i ? ' on' : '')} style={{ animationDelay: `${c * 0.012}s` }} onMouseEnter={() => setHv(cell.i)} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="dsh-cal-leg">
        <span>{f.t('crm.aura.cal.less')}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={'dsh-cal-c l' + l} />
        ))}
        <span>{f.t('crm.aura.cal.more')}</span>
      </div>
    </div>
  );
}

/* ---------- столбцы (вид «Столбцы» / «Стопкой» для любых рядов) ---------- */

export function Columns({ w, f, labels }: { w: import('./auraTransform').AuColumnsData; f: Fmt; labels: string[] }) {
  const [hv, setHv] = useState<number | null>(null);
  const n = Math.max(0, ...w.series.map((s) => s.data.length));
  const lab = w.labels.length ? w.labels : labels;
  const totals = Array.from({ length: n }, (_, i) => w.series.reduce((a, s) => a + (s.data[i] || 0), 0));
  const mx = Math.max(1, ...(w.stacked ? totals : w.series.flatMap((s) => s.data)));
  if (!n || !w.series.some((s) => s.data.some((v) => v > 0))) return <Empty text={f.emptyText || f.t('crm.aura.empty')} />;
  const step = Math.max(1, Math.ceil(n / 8));
  const named = w.series.filter((s) => s.name);
  return (
    <div className="dsh-cols-wrap">
      {named.length > 1 && (
        <div className="dsh-legend">
          {named.map((s, k) => (
            <span key={k}>
              <i className={s.dash ? 'dash' : ''} style={{ background: C[k % 5] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="dsh-colsx" onMouseLeave={() => setHv(null)}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className={'dsh-colx' + (hv === i ? ' on' : '')} onMouseEnter={() => setHv(i)}>
            {hv === i && (
              <div className="dsh-colx-tip">
                {lab[i] && <em>{lab[i]}</em>}
                {w.series.map((s, k) => (
                  <div key={k}>
                    {w.series.length > 1 && <i style={{ background: C[k % 5] }} />}
                    {s.name}
                    <b>{fmtVal(f, s.data[i] || 0, w.format, undefined, true)}</b>
                  </div>
                ))}
              </div>
            )}
            <div className={'dsh-colx-bars' + (w.stacked ? ' st' : '')}>
              {w.series.map((s, k) => (
                <span
                  key={k}
                  className={s.dash ? 'dash' : ''}
                  style={{ height: `${((s.data[i] || 0) / mx) * 100}%`, background: C[k % 5], animationDelay: `${i * 0.02 + k * 0.03}s` }}
                />
              ))}
            </div>
            <em>{i % step === 0 || i === n - 1 ? lab[i] || '' : ''}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- KPI: кольцо прогресса и цель ---------- */

export function Ring({ w, f }: { w: import('./auraTransform').AuRingData; f: Fmt }) {
  const R = 15.9;
  const p = Math.max(0, Math.min(100, w.pct));
  return (
    <div className="dsh-ring">
      <div className="dsh-ring-c">
        <svg viewBox="0 0 42 42" aria-hidden>
          <circle cx="21" cy="21" r={R} style={{ fill: 'none', stroke: 'var(--a-c1-soft)', strokeWidth: 4 }} />
          <circle className="dsh-arc" cx="21" cy="21" r={R} style={{ fill: 'none', stroke: 'var(--a-c1)', strokeWidth: 4, strokeLinecap: 'round', strokeDasharray: `${p} ${100 - p}`, strokeDashoffset: 25 }} />
        </svg>
        <b>{w.pct >= 1000 ? '999%+' : `${Math.round(w.pct)}%`}</b>
      </div>
      <div className="dsh-ring-m">
        <span className="dsh-kpi-v dsh-fit">{fmtVal(f, w.value, w.format)}</span>
        <em>{w.target != null ? f.t('crm.aura.kpi.ofTarget', { target: fmtVal(f, w.target, w.format, undefined, true) }) : f.t('crm.aura.kpi.ofHundred')}</em>
      </div>
    </div>
  );
}

export function TargetBar({ value, target, format, f }: { value: number | null; target: number; format: AuraFormat; f: Fmt }) {
  const pct = value != null && target > 0 ? (value / target) * 100 : 0;
  const done = pct >= 100;
  return (
    <div className={'dsh-target' + (done ? ' done' : '')}>
      <div className="dsh-target-bar">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="dsh-target-l">
        <span>{f.t('crm.aura.kpi.target', { target: fmtVal(f, target, format, undefined, true) })}</span>
        <b>{Math.round(pct)}%</b>
      </div>
    </div>
  );
}

/* ---------- заметка и заголовок раздела ---------- */

/** Мини-разметка заметки: «# заголовок», «- пункт», **жирный**, ссылки http(s). Всё — обычный текст React (без HTML). */
function inline(s: string, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<b key={kp + i++}>{tok.slice(2, -2)}</b>);
    else
      out.push(
        <a key={kp + i++} href={tok} target="_blank" rel="noopener noreferrer">
          {tok.replace(/^https?:\/\//, '').slice(0, 48)}
        </a>,
      );
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Note({ text, f }: { text: string; f: Fmt }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={'u' + k}>
        {list.map((x, j) => (
          <li key={j}>{inline(x, `l${k}-${j}-`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  text.split('\n').forEach((raw, k) => {
    const line = raw.trimEnd();
    if (/^\s*[-•*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-•*]\s+/, ''));
      return;
    }
    flush(k);
    if (!line.trim()) return;
    if (line.startsWith('# ')) blocks.push(<h3 key={k}>{inline(line.slice(2), `h${k}-`)}</h3>);
    else blocks.push(<p key={k}>{inline(line, `p${k}-`)}</p>);
  });
  flush(9999);
  return <div className="dsh-note">{blocks.length ? blocks : <p className="dsh-mute">{f.t('crm.aura.note.empty')}</p>}</div>;
}

export function Section({ text, f }: { text: string; f: Fmt }) {
  const [h, ...rest] = (text || '').split('\n');
  return (
    <div className="dsh-section">
      <h2>{h || f.t('crm.aura.note.sectionEmpty')}</h2>
      {rest.join(' ').trim() && <p>{rest.join(' ').trim()}</p>}
    </div>
  );
}
