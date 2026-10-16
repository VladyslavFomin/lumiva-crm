import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import {
  REP_PLATFORMS,
  fetchRepAiStatus,
  fetchRepCompare,
  fetchRepCompetitorsCompare,
  fetchRepDashboard,
  fetchRepMonthlyReport,
  fetchRepSettings,
  fetchRepSetup,
  fetchRepTopicMatrix,
  type RepAiStatus,
  type RepAnalyticsQuery,
  type RepCompare,
  type RepCompetitorTopic,
  type RepCompetitorsCompare,
  type RepCountryStat,
  type RepDashboard,
  type RepMonthlyReport,
  type RepSetup,
  type RepTopicStat,
} from '../../../api/hotelReputation';
import { AiStatusBanner, PLATFORM_META, fmtHours, fmtRepIndex, topicLabel, useRepT } from './ReputationShared';
import { Btn, CardHead, CountUp, Delta, Frame, PlatformBadge, RvHead, RvTabs, Score, Seg, Sel, Track, cx, scoreClass, useNumFmt } from './rvui';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate } from '../../../components/ui/DateRangePicker';
import { joinParam, splitParam } from './RepMultiSelect';
import { RepReportModal } from './RepReportModal';
import '../hotels-design.css';
import './reputation.css';

const ACC = '#5980a6';
const ACC9 = '#1d2d3d';
const PREV = '#b7b7ba';
const NEG = '#c23a4e';
const POS = '#2b7a57';
const MID = '#c9822b';
const GRID = '#e7e7ea';
const AX = '#98989b';
/** Цвета линий сравнения: первая — «мы» / первый выбранный, дальше различимые на белом. */
const SERIES = [ACC9, ACC, '#c9822b', POS, '#9b4dca', NEG, '#0f9fb0', '#8a6d3b'];

/** Подпись шага: день/неделя — «13.10», месяц — «10.26». Подписей не больше ~10, чтобы не слипались. */
function bucketLabel(b: string, g: 'day' | 'week' | 'month') {
  const [y, m, d] = b.split('-');
  return g === 'month' ? `${m}.${y.slice(2)}` : `${d}.${m}`;
}
const tickEvery = (n: number) => Math.max(1, Math.ceil(n / 10));
const locOf = (lang: string) => (lang.startsWith('en') ? 'en-GB' : lang.startsWith('tr') ? 'tr-TR' : 'ru-RU');
function bucketTitle(b: string, g: 'day' | 'week' | 'month', lang: string, r: (k: string, o?: any) => string) {
  const loc = locOf(lang);
  const d = new Date(`${b}T00:00:00Z`);
  if (g === 'month') return d.toLocaleDateString(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (g === 'week') return r('dash.weekOf', { d: d.toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Тёмная подсказка над графиком: строки текста, первая — заголовок. */
const Tip: React.FC<{ x: number; W: number; lines: Array<{ t: string; c?: string; b?: boolean }> }> = ({ x, W, lines }) => {
  const w = 210;
  const cx_ = Math.min(W - w / 2 - 2, Math.max(w / 2 + 2, x));
  return (
    <g pointerEvents="none" className="rv-tip">
      <rect x={cx_ - w / 2} y={2} width={w} height={8 + lines.length * 14} fill={ACC9} />
      {lines.map((l, i) => (
        <text key={i} x={cx_} y={16 + i * 14} fontSize="11.5" fill={l.c || '#fff'} textAnchor="middle" fontWeight={l.b ? 600 : 400}>{l.t}</text>
      ))}
    </g>
  );
};

const Spark: React.FC<{ vals: Array<number | null>; color?: string }> = ({ vals, color = ACC }) => {
  const v = vals.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const w = 56;
  const h = 18;
  const mn = Math.min(...v);
  const mx = Math.max(...v);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * w).toFixed(1)},${(h - ((x - mn) / Math.max(0.01, mx - mn)) * h).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.3" pathLength={1} className="rv-draw" />
    </svg>
  );
};

const Kpi: React.FC<{ l: React.ReactNode; title?: string; v: number | null | undefined; d?: number; suf?: string; text?: string; delta?: React.ReactNode; vs?: string; spark?: React.ReactNode }> = ({ l, title, v, d = 0, suf, text, delta, vs, spark }) => (
  <div className="rv-kpi">
    {spark}
    <div className="l" title={title}>{l}</div>
    <div className="v">{text != null ? <span style={{ fontSize: 30 }}>{text}</span> : <CountUp v={v} d={d} />}{suf && v != null && text == null && <small>{suf}</small>}</div>
    <div className="d">{delta}{delta && vs ? <span>{vs}</span> : null}</div>
  </div>
);

/** Средняя оценка 0–10 по шагам периода, с заливкой и пунктиром прошлого периода. */
const AvgLine: React.FC<{ series: RepDashboard['series']; prev?: RepDashboard['prevSeries'] | null; negBelow: number }> = ({ series, prev, negBelow }) => {
  const { r, lang } = useRepT();
  const fmt = useNumFmt();
  const [hv, setHv] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 440;
  const H = 170;
  const pts = rows.map((m, i) => ({ ...m, x: rows.length > 1 ? 28 + (i / (rows.length - 1)) * (W - 44) : W / 2, prev: prev?.points[i] ?? null }));
  const vals = pts.flatMap((p) => [p.avg10, p.prev?.avg10 ?? null]).filter((v): v is number => v != null);
  if (!vals.length) return <div className="rv-empty-s">{r('dash.noData')}</div>;
  const lo = Math.max(0, Math.floor(Math.min(...vals, negBelow) - 0.3));
  const hi = Math.min(10, Math.ceil(Math.max(...vals, 8) + 0.2));
  const y = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - 34);
  const own = pts.filter((p) => p.avg10 != null);
  const line = own.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.avg10!).toFixed(1)}`).join(' ');
  const area = own.length > 1 ? `${line} L${own[own.length - 1].x.toFixed(1)},${H - 24} L${own[0].x.toFixed(1)},${H - 24} Z` : '';
  const prevLine = pts.filter((p) => p.prev?.avg10 != null).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.prev!.avg10!).toFixed(1)}`).join(' ');
  const every = tickEvery(pts.length);
  const step = pts.length > 1 ? (W - 44) / (pts.length - 1) : 40;
  const small = pts.length > 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rv-chart" onMouseLeave={() => setHv(null)}>
      <defs>
        <linearGradient id="rvAvgArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ACC} stopOpacity=".22" />
          <stop offset="1" stopColor={ACC} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[lo, (lo + hi) / 2, hi].map((gv) => (
        <g key={gv}>
          <line x1={28} x2={W - 16} y1={y(gv)} y2={y(gv)} stroke={GRID} />
          <text x={0} y={y(gv) + 3} fontSize="11.5" fill={AX}>{fmt(gv, 1)}</text>
        </g>
      ))}
      {negBelow > lo && negBelow < hi && <line x1={28} x2={W - 16} y1={y(negBelow)} y2={y(negBelow)} stroke={NEG} strokeDasharray="3 4" strokeOpacity={0.45} />}
      {area && <path d={area} fill="url(#rvAvgArea)" style={{ animation: 'rvFade 1.2s .6s both' }} />}
      {prev && prevLine && <path d={prevLine} fill="none" stroke={PREV} strokeWidth="1.4" strokeDasharray="4 4" />}
      <path d={line} fill="none" stroke={ACC9} strokeWidth="2" pathLength={1} className="rv-draw" />
      {pts.map((p, i) => (
        <g key={p.bucket} onMouseEnter={() => setHv(i)}>
          <rect x={p.x - step / 2} y={0} width={Math.max(step, 6)} height={H} fill="transparent" />
          {p.avg10 != null && (
            <circle cx={p.x} cy={y(p.avg10)} r={hv === i ? 5 : small ? 2 : 3} fill={hv === i ? ACC : '#fff'} stroke={ACC9} strokeWidth="1.5" className="rv-dot-in" style={{ animationDelay: `${0.3 + Math.min(i, 20) * 0.05}s` }} />
          )}
          {i % every === 0 && <text x={p.x} y={H - 6} fontSize="11.5" fill={AX} textAnchor="middle">{bucketLabel(p.bucket, g)}</text>}
        </g>
      ))}
      {hv != null && pts[hv] && (
        <>
          <line x1={pts[hv].x} x2={pts[hv].x} y1={8} y2={H - 24} stroke={ACC} strokeDasharray="2 3" pointerEvents="none" />
          <Tip
            x={pts[hv].x}
            W={W}
            lines={[
              { t: `${bucketTitle(pts[hv].bucket, g, lang, r)} · ${r('dash.tipReviews', { n: pts[hv].count })}` },
              { t: pts[hv].avg10 != null ? `${fmt(pts[hv].avg10, 2)} / 10` : '—', b: true },
              ...(prev && pts[hv].prev
                ? [{ t: r('dash.tipPrev', { d: bucketTitle(pts[hv].prev!.bucket, g, lang, r), v: pts[hv].prev!.avg10 != null ? fmt(pts[hv].prev!.avg10, 2) : '—', n: pts[hv].prev!.count }), c: '#94bce3' }]
                : []),
            ]}
          />
        </>
      )}
    </svg>
  );
};

/** Число отзывов по шагам периода: красная часть столбца — негатив. */
const CountBars: React.FC<{ series: RepDashboard['series']; prev?: RepDashboard['prevSeries'] | null }> = ({ series, prev }) => {
  const { r, lang } = useRepT();
  const fmt = useNumFmt();
  const [hv, setHv] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 440;
  const H = 170;
  const prevRows = prev?.points || [];
  const mx = Math.max(1, ...rows.map((m) => m.count), ...(prev ? prevRows.map((m) => m.count) : []));
  const step = (W - 36) / Math.max(1, rows.length);
  const gap = rows.length > 40 ? 1 : rows.length > 20 ? 3 : 8;
  const bw = Math.max(1.5, prev ? Math.min(14, (step - gap) / 2) : Math.min(26, step - gap));
  const every = tickEvery(rows.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rv-chart" onMouseLeave={() => setHv(null)}>
      <line x1={24} x2={W - 8} y1={H - 22} y2={H - 22} stroke="#d4d4d7" />
      {rows.map((p, i) => {
        const x0 = 28 + i * step;
        const h = (p.count / mx) * (H - 46);
        const pm = prev ? prevRows[i] : null;
        const ph = pm ? (pm.count / mx) * (H - 46) : 0;
        const nh = (h * (p.negativeShare ?? 0)) / 100;
        const bx = x0 + (prev ? bw + 1 : 0);
        const delay = Math.min(i, 30) * 30;
        return (
          <g key={p.bucket} onMouseEnter={() => setHv(i)}>
            <rect x={x0 - 3} y={0} width={step} height={H} fill={hv === i ? '#eef3f8' : 'transparent'} />
            {prev && ph > 0 && <rect x={x0} y={H - 22 - ph} width={bw} height={ph} fill={PREV} className="rv-bar-in" style={{ animationDelay: `${delay}ms` }} />}
            {h > 0 && <rect x={bx} y={H - 22 - h} width={bw} height={h} fill={ACC} className="rv-bar-in" style={{ animationDelay: `${120 + delay}ms` }} />}
            {nh > 0 && <rect x={bx} y={H - 22 - nh} width={bw} height={nh} fill={NEG} className="rv-bar-in" style={{ animationDelay: `${120 + delay}ms` }} />}
            {i % every === 0 && <text x={x0 + (prev ? bw : bw / 2)} y={H - 7} fontSize="11.5" fill={AX} textAnchor="middle">{bucketLabel(p.bucket, g)}</text>}
          </g>
        );
      })}
      {hv != null && rows[hv] && (
        <Tip
          x={28 + hv * step + bw}
          W={W}
          lines={[
            { t: `${bucketTitle(rows[hv].bucket, g, lang, r)} · ${r('dash.tipReviews', { n: rows[hv].count })}` },
            { t: r('dash.tipNeg', { n: rows[hv].negativeShare != null ? fmt(rows[hv].negativeShare, 1) : '—' }), c: '#ffb3bd' },
            ...(prev && prevRows[hv] ? [{ t: r('dash.tipPrevCount', { d: bucketTitle(prevRows[hv].bucket, g, lang, r), n: prevRows[hv].count }), c: '#94bce3' }] : []),
          ]}
        />
      )}
    </svg>
  );
};

/** Несколько линий на одном графике (отели, площадки, мы и конкуренты): средняя или число отзывов. */
const CompareChart: React.FC<{ data: RepCompare; negBelow: number; legend?: boolean }> = ({ data, negBelow, legend = true }) => {
  const { r, lang } = useRepT();
  const fmt = useNumFmt();
  const [metric, setMetric] = useState<'avg' | 'count'>('avg');
  const [hv, setHv] = useState<number | null>(null);
  const g = data.granularity;
  const items = data.items.map((it, i) => ({
    ...it,
    name: data.dim === 'platform' ? PLATFORM_META[it.key as keyof typeof PLATFORM_META]?.label || it.key : it.label,
    color: data.dim === 'platform' ? PLATFORM_META[it.key as keyof typeof PLATFORM_META]?.bg || SERIES[i % SERIES.length] : SERIES[i % SERIES.length],
  }));
  const buckets = items[0]?.points.map((p) => p.bucket) || [];
  const W = 440;
  const H = 170;
  const xOf = (i: number) => (buckets.length > 1 ? 28 + (i / (buckets.length - 1)) * (W - 44) : W / 2);
  const val = (p: { avg10: number | null; count: number }) => (metric === 'avg' ? p.avg10 : p.count);
  const vals = items.flatMap((it) => it.points.map(val)).filter((v): v is number => v != null);
  const lo = metric === 'avg' ? Math.max(0, Math.floor(Math.min(...vals, negBelow) - 0.3)) : 0;
  const hi = metric === 'avg' ? Math.min(10, Math.ceil(Math.max(...vals, 8) + 0.2)) : Math.max(1, ...vals);
  const y = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - 34);
  const every = tickEvery(buckets.length);
  const step = buckets.length > 1 ? (W - 44) / (buckets.length - 1) : 40;
  const path = (pts: Array<{ avg10: number | null; count: number }>) => {
    let out = '';
    let pen = false;
    pts.forEach((p, i) => {
      const v = val(p);
      if (v == null) {
        pen = false;
        return;
      }
      out += `${pen ? 'L' : 'M'}${xOf(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return out;
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        {legend ? (
          <div className="rv-legend">
            {items.map((it) => (
              <span key={it.key} style={{ color: it.color }}>
                <i />
                <b style={{ color: 'var(--tx)', fontWeight: 500 }}>{it.name}</b>
                <small>{fmt(it.avg10, 2)} · {r('dash.tipReviews', { n: it.count })}</small>
              </span>
            ))}
          </div>
        ) : <span />}
        <Seg value={metric} onChange={(k) => setMetric(k as 'avg' | 'count')} opts={[['avg', r('dash.cmpAvg')], ['count', r('dash.cmpCount')]]} />
      </div>
      {!vals.length ? (
        <div className="rv-empty-s">{r('dash.noData')}</div>
      ) : (
        <svg key={metric} viewBox={`0 0 ${W} ${H}`} className="rv-chart" onMouseLeave={() => setHv(null)}>
          {[lo, (lo + hi) / 2, hi].map((gv) => (
            <g key={gv}>
              <line x1={28} x2={W - 16} y1={y(gv)} y2={y(gv)} stroke={GRID} />
              <text x={0} y={y(gv) + 3} fontSize="11.5" fill={AX}>{metric === 'avg' ? fmt(gv, 1) : Math.round(gv)}</text>
            </g>
          ))}
          {metric === 'avg' && negBelow > lo && negBelow < hi && <line x1={28} x2={W - 16} y1={y(negBelow)} y2={y(negBelow)} stroke={NEG} strokeDasharray="3 4" strokeOpacity={0.45} />}
          {items.map((it, i) => <path key={it.key} d={path(it.points)} fill="none" stroke={it.color} strokeWidth={i === 0 ? 2.2 : 1.6} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="rv-draw" />)}
          {buckets.map((b, i) => (
            <g key={b} onMouseEnter={() => setHv(i)}>
              <rect x={xOf(i) - step / 2} y={0} width={Math.max(step, 6)} height={H} fill="transparent" />
              {hv === i && <line x1={xOf(i)} x2={xOf(i)} y1={6} y2={H - 24} stroke={ACC} strokeDasharray="2 3" />}
              {hv === i && items.map((it) => (val(it.points[i]) != null ? <circle key={it.key} cx={xOf(i)} cy={y(val(it.points[i])!)} r={4} fill={it.color} stroke="#fff" strokeWidth={1.5} /> : null))}
              {i % every === 0 && <text x={xOf(i)} y={H - 6} fontSize="11.5" fill={AX} textAnchor="middle">{bucketLabel(b, g)}</text>}
            </g>
          ))}
          {hv != null && buckets[hv] && (() => {
            const lines = items.map((it) => ({ it, p: it.points[hv] }));
            const w = 220;
            const cx_ = Math.min(W - w / 2 - 2, Math.max(w / 2 + 2, xOf(hv)));
            return (
              <g pointerEvents="none">
                <rect x={cx_ - w / 2} y={2} width={w} height={20 + lines.length * 14} fill={ACC9} />
                <text x={cx_} y={16} fontSize="11.5" fill="#fff" textAnchor="middle">{bucketTitle(buckets[hv], g, lang, r)}</text>
                {lines.map(({ it, p }, k) => (
                  <g key={it.key}>
                    <rect x={cx_ - w / 2 + 10} y={23 + k * 14} width={7} height={7} fill={it.color} />
                    <text x={cx_ - w / 2 + 22} y={30 + k * 14} fontSize="11" fill="#fff">{it.name.length > 22 ? `${it.name.slice(0, 21)}…` : it.name}</text>
                    <text x={cx_ + w / 2 - 10} y={30 + k * 14} fontSize="11" fill="#fff" textAnchor="end">{p.avg10 != null ? fmt(p.avg10, 2) : '—'} · {p.count}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      )}
    </div>
  );
};

/** Страны гостей: по оценке (средняя / доля негатива) или по количеству негативных отзывов. */
const CountriesCard: React.FC<{ data: NonNullable<RepDashboard['countries']>; negBelow: number }> = ({ data, negBelow }) => {
  const { r, lang } = useRepT();
  const fmt = useNumFmt();
  const [mode, setMode] = useState<'rating' | 'count'>('rating');
  const [all, setAll] = useState(false);
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang.slice(0, 2)], { type: 'region' });
    } catch {
      return null;
    }
  }, [lang]);
  const nameOf = (c: RepCountryStat) => (c.code === 'x-en' ? r('dash.countryEn') : c.code === 'x-ar' ? r('dash.countryAr') : names?.of(c.code) || c.code);
  // по оценке — только страны с выборкой от 5 отзывов, иначе одна «единица» делает страну худшей
  const MIN = 5;
  const rows = mode === 'rating'
    ? data.items.filter((c) => c.count >= MIN && c.avg10 != null).sort((a, b) => a.avg10! - b.avg10! || (b.negativeShare ?? 0) - (a.negativeShare ?? 0))
    : [...data.items].filter((c) => c.negative > 0).sort((a, b) => b.negative - a.negative || b.count - a.count);
  const shown = all ? rows : rows.slice(0, 10);
  const maxNeg = Math.max(1, ...rows.map((c) => c.negative));
  return (
    <Frame className="rv-card rv-st" style={{ '--i': 6 } as React.CSSProperties} data-tour="rvd-countries">
      <CardHead title={r('dash.countriesTitle')} sub={mode === 'rating' ? r('dash.countriesRatingHint', { n: MIN }) : r('dash.countriesCountHint')}>
        <Seg value={mode} onChange={(k) => setMode(k as 'rating' | 'count')} opts={[['rating', r('dash.countriesByRating')], ['count', r('dash.countriesByCount')]]} />
      </CardHead>
      <div key={mode}>
        {!rows.length && <div className="rv-empty-s">{r('dash.noData')}</div>}
        {shown.map((c, i) => (
          <div key={c.code} className="rv-country rv-st" style={{ '--i': i } as React.CSSProperties}>
            <span className="n" title={c.byLangShare != null && c.byLangShare >= 0.5 ? `${nameOf(c)} — ${r('dash.byLangHint')}` : nameOf(c)}>
              <span className="cc">{c.code.startsWith('x-') ? c.code.slice(2).toUpperCase() : c.code}</span>
              {nameOf(c)}
            </span>
            {mode === 'rating' ? (
              <Track pct={(c.avg10 ?? 0) * 10} color={c.avg10 != null && c.avg10 < negBelow ? NEG : c.avg10 != null && c.avg10 < 8 ? MID : POS} />
            ) : (
              <Track pct={(c.negative / maxNeg) * 100} color={NEG} />
            )}
            <span className="v">
              {mode === 'rating' ? (
                <><b>{fmt(c.avg10, 2)}</b>{r('dash.countryNeg', { p: c.negativeShare != null ? fmt(c.negativeShare, 1) : '—', n: c.count })}</>
              ) : (
                <><b>{c.negative}</b>{r('dash.countryOf', { n: c.count })}</>
              )}
            </span>
          </div>
        ))}
      </div>
      {rows.length > 10 && <Btn sm gh style={{ marginTop: 8 }} onClick={() => setAll((x) => !x)}>{all ? r('dash.showLess') : r('dash.showAll', { n: rows.length })}</Btn>}
      {data.unknown > 0 && <div style={{ fontSize: 11.5, color: 'var(--n7)', marginTop: 10 }}>{r('dash.countriesUnknown', { n: data.unknown })}</div>}
    </Frame>
  );
};

/** Разрыв по теме с конкурентами: подпись — доля жалоб или похвал «у нас / у них». */
const GapList: React.FC<{ rows: RepCompetitorTopic[]; kind: 'lose' | 'win' }> = ({ rows, kind }) => {
  const { r, lang } = useRepT();
  const max = Math.max(1, ...rows.map((x) => Math.abs(x.gap ?? 0)));
  if (!rows.length) return <div className="rv-empty-s">{r('comp.noGap')}</div>;
  return (
    <div className="rv-bars">
      {rows.map((x, i) => (
        <div key={x.topic} className="rv-bar rv-st" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 128px', '--i': i } as React.CSSProperties} title={r('comp.gapHint', { g: Math.abs(x.gap ?? 0) })}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topicLabel(x, r, lang)}</span>
          <Track pct={(Math.abs(x.gap ?? 0) / max) * 100} color={kind === 'lose' ? NEG : POS} />
          <span className="v" style={{ fontSize: 12, fontFamily: 'var(--t)', fontWeight: 400 }}>
            {x.basis === 'praise'
              ? r('comp.praiseShare', { a: Math.round(x.oursPosPct ?? 0), b: Math.round(x.theirsPosPct ?? 0) })
              : r('comp.complaintShare', { a: Math.round(x.oursNegPct ?? 0), b: Math.round(x.theirsNegPct ?? 0) })}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Мы и конкуренты — у каждого отеля свой набор конкурентов (выбор отеля сверху): место, таблица,
 * динамика на одинаковых площадках, темы — где проигрываем и где выигрываем.
 */
const CompetitorsCard: React.FC<{ data: RepCompetitorsCompare; negBelow: number }> = ({ data, negBelow }) => {
  const { r } = useRepT();
  const fmt = useNumFmt();
  const navigate = useNavigate();
  const [hid, setHid] = useState(data.hotels[0]?.hotelId);
  const h = data.hotels.find((x) => x.hotelId === hid) || data.hotels[0];
  if (!h) return null;
  const chart: RepCompare = {
    dim: 'hotel',
    granularity: data.granularity as RepCompare['granularity'],
    items: [
      { key: 'ours', label: r('comp.us', { name: h.name }), count: h.ours.count, avg10: h.ours.avg10, points: h.ours.points },
      ...h.competitors.map((c) => ({ key: c.id, label: c.name, count: c.count, avg10: c.avg10, points: c.points })),
    ],
  };
  const ranked = [h.ours.avg10, ...h.competitors.map((c) => c.avg10)].filter((v): v is number => v != null).sort((a, b) => b - a);
  const gap = h.rank == null || h.ours.avg10 == null ? null : h.rank === 1 ? (ranked.length > 1 ? h.ours.avg10 - ranked[1] : null) : ranked[0] - h.ours.avg10;
  const errors = h.competitors.flatMap((c) => c.platforms.filter((p) => p.lastError).map((p) => `${c.name} · ${PLATFORM_META[p.platform].label}`));
  const fewTopics = h.topicsBase.ours < h.topicsBase.min || h.topicsBase.theirs < h.topicsBase.min;
  return (
    <Frame className="rv-card rv-st" style={{ '--i': 8, marginBottom: 22 } as React.CSSProperties} data-tour="rvd-competitors">
      <CardHead title={r('rv.comp.title')} sub={r('rv.comp.sub', { name: h.name, n: h.competitors.length, p: h.platforms.map((p) => PLATFORM_META[p].label).join(', ') })}>
        {data.hotels.length > 1 && (
          <select className="rv-in" style={{ width: 220, height: 30 }} value={h.hotelId} onChange={(e) => setHid(e.target.value)} aria-label={r('dash.col.hotel')}>
            {data.hotels.map((x) => <option key={x.hotelId} value={x.hotelId}>{x.name}</option>)}
          </select>
        )}
        <Btn sm onClick={() => navigate(`/hotels/reviews/settings?tab=competitors&hotel=${h.hotelId}`)}>{r('rv.comp.manage')}</Btn>
      </CardHead>
      <div key={h.hotelId}>
        {h.rank != null && h.rankOf != null && (
          <div className="rv-rank">
            <span className="num"><CountUp v={h.rank} /><small>/{h.rankOf}</small></span>
            <div className="t">
              <b>{h.rank === 1 ? r('rv.comp.rankFirst') : r('rv.comp.rankN', { r: h.rank, n: h.rankOf })}</b>
              {gap != null && gap > 0 ? r(h.rank === 1 ? 'rv.comp.leadBy' : 'rv.comp.behindBy', { g: fmt(gap, 2) }) : r('rv.comp.byAvg')} {r('comp.rankHint')}
            </div>
          </div>
        )}
        {errors.length > 0 && <div className="rv-note warn" style={{ marginBottom: 12 }}>{r('comp.sourceErrors', { list: errors.join(', ') })}</div>}
        <div className="rv-grid3" style={{ marginBottom: 0 }}>
          <div>
            <div className="rv-tw">
              <table className="rv-tbl">
                <thead><tr><th>{r('dash.col.hotel')}</th><th>{r('dash.col.avg')}</th><th>Δ</th><th>{r('dash.col.count')}</th><th>{r('dash.col.neg')}</th><th>{r('comp.onPlatform')}</th></tr></thead>
                <tbody>
                  {[{ id: 'ours', name: r('comp.us', { name: h.name }), ...h.ours, platforms: [] as typeof h.competitors[number]['platforms'] }, ...h.competitors].map((c, i) => (
                    <tr key={c.id} className={i === 0 ? 'us' : ''}>
                      <td><b>{c.name}</b></td>
                      <td><Score v={c.avg10} nb={negBelow} /></td>
                      <td><Delta v={c.delta} /></td>
                      <td>{c.count}</td>
                      <td>{c.negativeShare != null ? `${fmt(c.negativeShare, 1)}%` : '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {i === 0 ? '—' : c.platforms.filter((x) => x.rating != null).map((x) => (
                          <span key={x.platform} style={{ display: 'inline-flex', gap: 4, marginRight: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <PlatformBadge p={x.platform} compact />{fmt(x.rating, 1)}{x.count != null && <small style={{ color: 'var(--n5)' }}>({fmt(x.count)})</small>}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16 }}><CompareChart data={chart} negBelow={negBelow} /></div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, color: NEG, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{r('comp.losing')}</h4>
            {fewTopics ? <div className="rv-empty-s">{r('comp.fewTopics', { n: h.topicsBase.min, a: h.topicsBase.ours, b: h.topicsBase.theirs })}</div> : <GapList rows={h.losing} kind="lose" />}
            {!fewTopics && (
              <>
                <h4 style={{ fontSize: 14, color: POS, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 0 10px' }}>{r('comp.winning')}</h4>
                <GapList rows={h.winning} kind="win" />
              </>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--n7)', marginTop: 14, lineHeight: 1.5 }}>{r('comp.topicsNote')}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
};

/** Номера с жалобами: негативные отзывы, связанные с бронью гостя. */
const RoomsCard: React.FC<{ data: NonNullable<RepDashboard['rooms']>; hotelName: (id: string) => string; negBelow: number }> = ({ data, hotelName, negBelow }) => {
  const { r } = useRepT();
  const navigate = useNavigate();
  return (
    <Frame className="rv-card rv-st" style={{ '--i': 7 } as React.CSSProperties} data-tour="rvd-rooms">
      <CardHead title={r('rooms.title')} sub={r('rooms.sub', { n: data.linked, s: data.suggested })} />
      {!data.rooms.length ? (
        <div className="rv-empty-s">{r('rooms.none')}</div>
      ) : (
        <div className="rv-tw">
          <table className="rv-tbl">
            <thead><tr><th>{r('rooms.room')}</th><th>{r('dash.col.hotel')}</th><th>{r('rooms.negative')}</th><th>{r('dash.col.avg')}</th><th /></tr></thead>
            <tbody>
              {data.rooms.map((x) => (
                <tr key={`${x.hotelId}-${x.roomUnitId || x.roomType}`}>
                  <td><b>{x.room ? `№ ${x.room}` : r('rooms.noUnit')}</b>{x.roomType && <div style={{ fontSize: 11, color: 'var(--n7)' }}>{x.roomType}</div>}</td>
                  <td>{hotelName(x.hotelId)}</td>
                  <td><span className="rv-pill noreply">{x.negative}</span> <span style={{ fontSize: 12, color: 'var(--n7)' }}>{r('rooms.of', { n: x.reviews })}</span></td>
                  <td><Score v={x.avg10} nb={negBelow} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {x.negativeReviewIds[0] && <Btn sm gh icon="arrow" aria-label={r('rooms.open')} title={r('rooms.open')} onClick={() => navigate(`/hotels/reviews?review=${x.negativeReviewIds[0]}`)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  );
};

const TopicBars: React.FC<{ rows: RepTopicStat[]; kind: 'negative' | 'positive'; onPick: (topic: string) => void }> = ({ rows, kind, onPick }) => {
  const { r, lang } = useRepT();
  const max = Math.max(1, ...rows.map((t) => t[kind]));
  if (!rows.length) return <div className="rv-empty-s">{r('dash.noTopics')}</div>;
  return (
    <div className="rv-bars">
      {rows.map((t, i) => {
        const quotes = kind === 'negative' ? t.negQuotes : t.posQuotes;
        return (
          <div key={`${t.topic}-${t.label}`} className="rv-bar rv-st" style={{ '--i': i } as React.CSSProperties} title={quotes.map((q) => `«${q}»`).join('\n')}>
            <span className="n" onClick={() => onPick(t.topic)}>{topicLabel(t, r, lang)}</span>
            <Track pct={(t[kind] / max) * 100} color={kind === 'negative' ? NEG : POS} h={8} />
            <span className="v">
              <CountUp v={t[kind]} />
              {kind === 'negative' && <small><Delta v={t.negative - t.prevNegative} invert digits={0} /></small>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

type Matrix = Awaited<ReturnType<typeof fetchRepTopicMatrix>>;
/** Темы по отелям: красный — жалобы, зелёный — похвалы; число — отзывов с темой; клик — лента. */
const Heat: React.FC<{ m: Matrix; onPick: (topic: string, hotelId: string) => void }> = ({ m, onPick }) => {
  const { r, lang } = useRepT();
  const max = Math.max(1, ...m.hotels.flatMap((h) => h.cells.map((c) => Math.max(c.negative, c.positive))));
  let k = 0;
  return (
    <div className="rv-tw">
      <div className="rv-heat" style={{ gridTemplateColumns: `160px repeat(${m.topics.length}, minmax(44px,1fr))`, minWidth: 160 + m.topics.length * 46 }}>
        <div />
        {m.topics.map((t) => <div key={t.topic} className="hd" title={topicLabel(t, r, lang)}>{topicLabel(t, r, lang)}</div>)}
        {m.hotels.map((h) => (
          <React.Fragment key={h.hotelId}>
            <div className="rh" title={h.name}>{h.name}</div>
            {h.cells.map((c, j) => {
              const negSide = c.negative >= c.positive;
              const n = negSide ? c.negative : c.positive;
              const pct = n ? Math.round(18 + (n / max) * 67) : 0;
              const bg = !n ? 'var(--n1, #f4f4f5)' : `color-mix(in oklab, ${negSide ? NEG : POS} ${pct}%, #fff)`;
              const t = m.topics[j];
              return (
                <div
                  key={c.topic}
                  className="cell"
                  style={{ '--i': k++, background: bg, color: pct > 55 ? '#fff' : 'var(--tx)' } as React.CSSProperties}
                  title={r('rv.dash.cellTip', { hotel: h.name, topic: t ? topicLabel(t, r, lang) : c.topic, neg: c.negative, pos: c.positive })}
                  onClick={() => onPick(c.topic, h.hotelId)}
                >
                  {n || '·'}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** Отели → Отзывы → Дашборд: как меняется рейтинг и на что конкретно жалуются гости. */
export const ReviewsDashboardPage: React.FC = () => {
  const { r, t, lang } = useRepT();
  const fmt = useNumFmt();
  const { showAlert } = useAlertModal();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const periodPresets = useMemo(
    () => [
      ...([7, 14, 30, 90, 365] as const).map((n) => ({ id: String(n), label: t(`crm.dateRange.last${n}`), range: lastDays(n) })),
      { id: 'all', label: t('crm.dateRange.allTime'), range: { from: null, to: null } },
    ],
    [t],
  );
  const [setup, setSetup] = useState<RepSetup | null>(null);
  const [negBelow, setNegBelow] = useState(6);
  const [data, setData] = useState<RepDashboard | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [report, setReport] = useState<RepMonthlyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<RepAiStatus | null>(null);
  const [cmpHotels, setCmpHotels] = useState<RepCompare | null>(null);
  const [cmpPlatforms, setCmpPlatforms] = useState<RepCompare | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [competitors, setCompetitors] = useState<RepCompetitorsCompare | null>(null);
  const view = params.get('view') === 'report' ? 'report' : 'overview';
  /**
   * С чем сравнивать (показатели, графики, отчёт): прошлый период той же длины (по умолчанию) или тот же период
   * год назад — для сезонных отелей честнее. «Выкл» — только убрать наложение с графиков.
   */
  const cmpMode: 'off' | 'prev' | 'yoy' = params.get('cmp') === '0' ? 'off' : params.get('cmp') === 'yoy' ? 'yoy' : 'prev';
  const showPrev = cmpMode !== 'off';
  const selBrands = splitParam(params.get('brand'));
  const selHotels = splitParam(params.get('hotel'));
  const selPlatforms = splitParam(params.get('platform'));

  // период: пресет (7/14/30/90/365/all) или свой диапазон — как в продажах
  const preset = params.get('preset') || (params.get('from') ? 'custom' : '90');
  const q = useMemo((): RepAnalyticsQuery => {
    // мультивыбор: в URL и в API — через запятую
    const base = {
      brandId: params.get('brand') || undefined,
      hotelId: params.get('hotel') || undefined,
      platform: params.get('platform') || undefined,
      compare: params.get('cmp') === 'yoy' ? ('yoy' as const) : undefined,
    };
    if (preset === 'all') return { ...base, all: '1' };
    if (preset === 'custom') return { ...base, from: params.get('from') || undefined, to: params.get('to') || undefined };
    return { ...base, from: toIsoDate(lastDays(Number(preset)).from!), to: undefined };
  }, [params, preset]);

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    fetchRepSetup().then(setSetup).catch(() => undefined);
    fetchRepSettings().then((s) => setNegBelow(s.config.thresholds.negativeBelow)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view !== 'overview') return;
    setData(null);
    fetchRepDashboard(q).then(setData).catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchRepTopicMatrix(q).then(setMatrix).catch(() => setMatrix(null));
    fetchRepAiStatus().then(setAiStatus).catch(() => setAiStatus(null));
    // выбрано несколько отелей / площадок — сравнение на одном графике
    setCmpHotels(null);
    setCmpPlatforms(null);
    if (splitParam(q.hotelId).length > 1) fetchRepCompare(q, 'hotel').then(setCmpHotels).catch(() => setCmpHotels(null));
    if (splitParam(q.platform).length > 1) fetchRepCompare(q, 'platform').then(setCmpPlatforms).catch(() => setCmpPlatforms(null));
    setCompetitors(null);
    fetchRepCompetitorsCompare(q).then(setCompetitors).catch(() => setCompetitors(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, view]);

  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setUTCDate(1);
    for (let i = 0; i < 12; i++) {
      d.setUTCMonth(d.getUTCMonth() - 1);
      out.push(d.toISOString().slice(0, 7));
    }
    return out;
  }, []);
  const reportBrand = params.get('rbrand') || setup?.brands[0]?.id || '';
  const reportMonth = params.get('month') || months[0];

  useEffect(() => {
    if (view !== 'report' || !setup) return;
    setReportLoading(true);
    setReport(null);
    fetchRepMonthlyReport(reportBrand || null, reportMonth)
      .then(setReport)
      .catch((e) => showAlert(e.message, { variant: 'error' }))
      .finally(() => setReportLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reportBrand, reportMonth, setup]);

  const toFeed = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q.brandId) p.set('brandId', q.brandId);
    if (q.hotelId) p.set('hotelId', q.hotelId);
    if (q.platform) p.set('platform', q.platform);
    if (q.from) p.set('from', q.from);
    if (q.to) p.set('to', q.to);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    navigate(`/hotels/reviews?${p.toString()}`);
  };

  const hotels = setup?.hotels || [];
  const k = data?.kpis;
  const hotelOptions = (selBrands.length ? hotels.filter((h) => h.brandId && selBrands.includes(h.brandId)) : hotels).map((h) => ({ value: h.id, label: h.name }));
  const setBrands = (v: string[]) => {
    const p = new URLSearchParams(params);
    const j = joinParam(v);
    j ? p.set('brand', j) : p.delete('brand');
    // отели вне выбранных брендов из выбора убираем
    if (v.length) {
      const keep = selHotels.filter((id) => v.includes(hotels.find((h) => h.id === id)?.brandId || ''));
      const jh = joinParam(keep);
      jh ? p.set('hotel', jh) : p.delete('hotel');
    }
    setParams(p, { replace: true });
  };
  const loc = locOf(lang);
  const dayFmt = (iso: string, endExclusive = false, year = true) =>
    new Date(new Date(iso).getTime() - (endExclusive ? 864e5 : 0)).toLocaleDateString(loc, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  const nameList = (ids: string[], all: string, of: (id: string) => string) => (ids.length ? ids.map(of).join(', ') : all);

  // месячный отчёт — PDF/отправка по тем же правилам, что и обзор: бренд + границы месяца
  const monthEnd = (m: string) => {
    const d = new Date(`${m}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  };
  const reportQuery: RepAnalyticsQuery = view === 'report' ? { brandId: reportBrand || undefined, from: `${reportMonth}-01`, to: monthEnd(reportMonth) } : q;
  const monthTitle = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const scopeText =
    view === 'report'
      ? [setup?.brands.find((b) => b.id === reportBrand)?.name || r('filters.allBrands'), monthTitle(reportMonth)].join(' · ')
      : [
          nameList(selBrands, r('filters.allBrands'), (id) => setup?.brands.find((b) => b.id === id)?.name || '—'),
          nameList(selHotels, r('filters.allHotels'), (id) => hotels.find((h) => h.id === id)?.name || '—'),
          nameList(selPlatforms, r('filters.allPlatforms'), (id) => PLATFORM_META[id as keyof typeof PLATFORM_META]?.label || id),
          data ? `${dayFmt(data.period.from)} — ${dayFmt(data.period.to, true)}` : '',
        ].filter(Boolean).join(' · ');
  const vs = cmpMode === 'yoy' ? r('rv.dash.vsYoy') : r('rv.dash.vsPrev');
  const pts = data?.series.points || [];
  const summaryParts = (report?.summary || '').split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReviewsDashboard" />
      <div className="px-scope">
        <HotelsSubnav active="reviews" />
        <div className="rv">
          <RvHead title={r('dash.title')} sub={r('dash.subtitle')} />
          <RvTabs active="dashboard" />

          <div className="rv-view">
            <div className="rv-cmpbar" style={{ marginTop: 0 }} data-tour="rvd-view">
              <Seg value={view} onChange={(v) => set('view', v === 'report' ? 'report' : null)} opts={[['overview', r('dash.viewOverview')], ['report', r('dash.viewReport')]]} />
              <Btn icon="download" onClick={() => setReportOpen(true)} disabled={view === 'overview' ? !data : !report}>{r('report.button')}</Btn>
            </div>

            {view === 'overview' && (
              <>
                <div data-tour="rvd-filters" className="rv-filters">
                  {(setup?.brands.length || 0) > 0 && (
                    <Sel allLabel={r('filters.allBrands')} value={selBrands} onChange={setBrands} options={(setup?.brands || []).map((b) => ({ value: b.id, label: b.name }))} />
                  )}
                  <Sel allLabel={r('filters.allHotels')} value={selHotels} onChange={(v) => set('hotel', joinParam(v))} options={hotelOptions} />
                  <Sel
                    allLabel={r('filters.allPlatforms')}
                    value={selPlatforms}
                    onChange={(v) => set('platform', joinParam(v))}
                    options={REP_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformBadge p={p} compact /> }))}
                  />
                  <DateRangePicker
                    value={preset === 'all' ? { from: null, to: null } : preset === 'custom' ? { from: fromIsoDate(params.get('from')), to: fromIsoDate(params.get('to')) } : lastDays(Number(preset))}
                    presetId={preset === 'custom' ? null : preset}
                    presets={periodPresets}
                    maxDate={new Date()}
                    onChange={(v) => {
                      const p = new URLSearchParams(params);
                      p.delete('days');
                      if (v.presetId) {
                        p.set('preset', v.presetId);
                        p.delete('from');
                        p.delete('to');
                      } else {
                        p.set('preset', 'custom');
                        v.from ? p.set('from', toIsoDate(v.from)) : p.delete('from');
                        v.to ? p.set('to', toIsoDate(v.to)) : p.delete('to');
                      }
                      setParams(p, { replace: true });
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--n7)', marginLeft: 8 }}>{r('dash.compareWith')}</span>
                  <Seg value={cmpMode} onChange={(v) => set('cmp', v === 'prev' ? null : v === 'off' ? '0' : 'yoy')} opts={[['prev', r('dash.cmpPrev')], ['yoy', r('dash.cmpYoy')], ['off', r('dash.cmpOff')]]} />
                  <span style={{ flex: 1 }} />
                  {data && showPrev && data.prevPeriod && (
                    <div className="rv-legend">
                      <span style={{ color: ACC9 }}><i />{`${dayFmt(data.period.from, false, false)} — ${dayFmt(data.period.to, true)}`}</span>
                      <span style={{ color: PREV }}><i className="dash" />{`${dayFmt(data.prevPeriod.from, false, false)} — ${dayFmt(data.prevPeriod.to, true)}`}</span>
                    </div>
                  )}
                </div>

                {!data ? (
                  <div className="rv-empty-s" style={{ padding: '40px 0', textAlign: 'center' }}>{r('card.loading')}</div>
                ) : (
                  <div key={JSON.stringify(q)}>
                    {cmpMode === 'yoy' && k!.delta && k!.count > 0 && k!.count - k!.delta.count < k!.count * 0.5 && (
                      <div className="rv-note warn" style={{ marginBottom: 14 }}>{r('dash.yoyPartial', { prev: k!.count - k!.delta.count, cur: k!.count })}</div>
                    )}
                    <Frame className="rv-kpis" data-tour="rvd-kpis">
                      <Kpi l={r('dash.kpi.avg')} title={r('dash.kpi.avgHint')} v={k!.avg10} d={2} suf="/10" delta={<Delta v={k!.delta?.avg10} />} vs={vs} spark={<Spark vals={pts.map((p) => p.avg10)} />} />
                      <Kpi l={r('dash.kpi.index')} title={r('dash.kpi.indexHint')} v={k!.reputationIndex} d={1} suf="/100" text={k!.reputationIndex == null ? fmtRepIndex(null, lang) : undefined} delta={<Delta v={k!.delta?.reputationIndex} digits={1} />} vs={vs} />
                      <Kpi l={r('dash.kpi.count')} v={k!.count} delta={<Delta v={k!.delta?.count} digits={0} />} vs={vs} spark={<Spark vals={pts.map((p) => p.count)} />} />
                      <Kpi l={r('rv.dash.negKpi', { n: negBelow })} title={r('dash.kpi.negHint', { n: negBelow })} v={k!.negativeShare} d={1} suf="%" delta={<Delta v={k!.delta?.negativeShare} invert suffix={` ${r('units.pp')}`} digits={1} />} vs={vs} spark={<Spark vals={pts.map((p) => p.negativeShare)} color={NEG} />} />
                      <Kpi l={r('dash.kpi.response')} title={r('dash.kpi.responseHint')} v={k!.responseRate} d={1} suf="%" delta={<Delta v={k!.delta?.responseRate} suffix={` ${r('units.pp')}`} digits={1} />} vs={vs} />
                      <Kpi l={r('dash.kpi.replyTime')} title={r('dash.kpi.replyTimeHint')} v={k!.medianReplyHours} text={fmtHours(k!.medianReplyHours, r)} delta={<Delta v={k!.delta?.medianReplyHours} invert suffix={` ${r('units.h')}`} digits={1} />} vs={vs} />
                    </Frame>

                    {k!.count === 0 && <div className="rv-note" style={{ marginBottom: 16 }}>{r('dash.noData')}</div>}
                    <AiStatusBanner status={aiStatus} />

                    <div className="rv-grid2" data-tour="rvd-trend">
                      <Frame className="rv-card rv-st" style={{ '--i': 1 } as React.CSSProperties}>
                        <CardHead title={r('dash.trendTitleP')} sub={r('dash.trendSub', { n: negBelow, step: r(`dash.step.${data.series.granularity}`) })} />
                        {pts.length ? <AvgLine series={data.series} prev={showPrev ? data.prevSeries : null} negBelow={negBelow} /> : <div className="rv-empty-s">{r('dash.noData')}</div>}
                      </Frame>
                      <Frame className="rv-card rv-st" style={{ '--i': 2 } as React.CSSProperties}>
                        <CardHead title={r('dash.countTitleP')} sub={`${r('dash.countSub', { step: r(`dash.step.${data.series.granularity}`) })} ${r('rv.dash.countNegNote')}`} />
                        {pts.length ? <CountBars series={data.series} prev={showPrev ? data.prevSeries : null} /> : <div className="rv-empty-s">{r('dash.noData')}</div>}
                      </Frame>
                    </div>

                    {(selHotels.length > 1 || selPlatforms.length > 1) && (
                      <div className={cx(selHotels.length > 1 && selPlatforms.length > 1 && 'rv-grid2')} style={selHotels.length > 1 && selPlatforms.length > 1 ? undefined : { marginBottom: 22 }}>
                        {selHotels.length > 1 && (
                          <Frame className="rv-card rv-st">
                            <CardHead title={r('dash.cmpHotelsTitle')} sub={r('dash.cmpSub', { step: r(`dash.step.${data.series.granularity}`) })} />
                            {cmpHotels ? <CompareChart data={cmpHotels} negBelow={negBelow} /> : <div className="rv-empty-s">{r('card.loading')}</div>}
                          </Frame>
                        )}
                        {selPlatforms.length > 1 && (
                          <Frame className="rv-card rv-st">
                            <CardHead title={r('dash.cmpPlatformsTitle')} sub={r('dash.cmpSub', { step: r(`dash.step.${data.series.granularity}`) })} />
                            {cmpPlatforms ? <CompareChart data={cmpPlatforms} negBelow={negBelow} /> : <div className="rv-empty-s">{r('card.loading')}</div>}
                          </Frame>
                        )}
                      </div>
                    )}

                    <div className="rv-grid2" data-tour="rvd-topics">
                      <Frame className="rv-card rv-st" style={{ '--i': 3 } as React.CSSProperties}>
                        <CardHead title={r('dash.complaints')} cls="neg" sub={r('dash.complaintsSub')} />
                        <TopicBars rows={data.complaints} kind="negative" onPick={(tp) => toFeed({ topic: tp, sentiment: 'negative' })} />
                      </Frame>
                      <Frame className="rv-card rv-st" style={{ '--i': 4 } as React.CSSProperties}>
                        <CardHead title={r('dash.praises')} cls="pos" sub={r('dash.praisesSub')} />
                        <TopicBars rows={data.praises} kind="positive" onPick={(tp) => toFeed({ topic: tp })} />
                      </Frame>
                    </div>

                    <Frame className="rv-card rv-st" style={{ '--i': 5, marginBottom: 22 } as React.CSSProperties}>
                      <CardHead title={r('dash.platformsTitle')} sub={r('dash.platformsSub')} />
                      <div className="rv-tw">
                        <table className="rv-tbl">
                          <thead>
                            <tr><th>{r('dash.col.platform')}</th><th>{r('dash.col.onPlatform')}</th><th>{r('dash.col.inCrm')}</th><th>{r('dash.col.periodCount')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.neg')}</th><th>{r('dash.col.response')}</th></tr>
                          </thead>
                          <tbody>
                            {data.byPlatform.map((p) => {
                              const s = data.sources.find((x) => x.platform === p.platform);
                              return (
                                <tr key={p.platform} className="click" onClick={() => set('platform', p.platform)}>
                                  <td><PlatformBadge p={p.platform} />{s?.failing ? <span className="rv-pill noreply" style={{ marginLeft: 8 }}>{r('dash.failing')}</span> : null}</td>
                                  <td>{p.platformCount != null ? <>{p.platformRating != null && <b className="num" style={{ marginRight: 6 }}>{fmt(p.platformRating, 1)}</b>}<span style={{ color: 'var(--n7)' }}>{fmt(p.platformCount)}</span></> : '—'}</td>
                                  <td>{s ? fmt(s.inCrm) : '—'}</td>
                                  <td>{p.count}</td>
                                  <td><Score v={p.avg10} nb={negBelow} /></td>
                                  <td>{p.negativeShare != null ? `${fmt(p.negativeShare, 1)}%` : '—'}</td>
                                  <td>{p.responseRate != null ? `${fmt(p.responseRate, 1)}%` : <span style={{ color: 'var(--n5)' }}>{r('dash.noReplies')}</span>}</td>
                                </tr>
                              );
                            })}
                            {!data.byPlatform.length && <tr><td colSpan={7} className="rv-empty-s">{r('dash.noData')}</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </Frame>

                    {matrix && matrix.hotels.length > 1 && matrix.topics.length > 0 && (
                      <Frame className="rv-card rv-st" style={{ '--i': 6, marginBottom: 22 } as React.CSSProperties}>
                        <CardHead title={r('dash.matrixTitle')} sub={r('rv.dash.matrixSub')}>
                          <div className="rv-legend">
                            <span style={{ color: NEG }}><i style={{ height: 8 }} />{r('rv.dash.legendNeg')}</span>
                            <span style={{ color: POS }}><i style={{ height: 8 }} />{r('rv.dash.legendPos')}</span>
                          </div>
                        </CardHead>
                        <Heat m={matrix} onPick={(tp, hid) => toFeed({ topic: tp, hotelId: hid })} />
                      </Frame>
                    )}

                    {(data.countries || (data.rooms && (data.rooms.linked > 0 || data.rooms.suggested > 0))) && (
                      <div className={cx(data.countries && data.rooms && (data.rooms.linked > 0 || data.rooms.suggested > 0) && 'rv-grid2')} style={{ marginBottom: 22 }}>
                        {data.countries && <CountriesCard data={data.countries} negBelow={negBelow} />}
                        {data.rooms && (data.rooms.linked > 0 || data.rooms.suggested > 0) && (
                          <RoomsCard data={data.rooms} negBelow={negBelow} hotelName={(id) => hotels.find((x) => x.id === id)?.name || '—'} />
                        )}
                      </div>
                    )}

                    {competitors && competitors.hotels.length > 0 && <CompetitorsCard data={competitors} negBelow={negBelow} />}

                    <Frame className="rv-card rv-st" style={{ '--i': 9, marginBottom: 22 } as React.CSSProperties} data-tour="rvd-hotels">
                      <CardHead title={r('dash.hotelsTitle')} sub={r('dash.hotelsSub')} />
                      <div className="rv-tw">
                        <table className="rv-tbl">
                          <thead>
                            <tr>
                              <th>{r('dash.col.hotel')}</th><th>{r('dash.col.index')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.count')}</th>
                              <th>{r('dash.col.neg')}</th><th>{r('dash.col.response')}</th><th>{r('dash.col.replyTime')}</th><th>{r('dash.col.open')}</th><th>{r('dash.col.topComplaint')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.byHotel.map((h) => (
                              <tr key={h.hotelId} className="click" onClick={() => set('hotel', h.hotelId)}>
                                <td><b>{h.name}</b>{h.brand && <div style={{ fontSize: 11, color: 'var(--n7)' }}>{h.brand}</div>}</td>
                                <td><span className="rv-score"><b className={scoreClass(h.reputationIndex != null ? h.reputationIndex / 10 : null, negBelow)}>{fmtRepIndex(h.reputationIndex, lang)}</b></span></td>
                                <td><Score v={h.avg10} nb={negBelow} /> <Delta v={h.delta} /></td>
                                <td>{h.count}</td>
                                <td>{h.negativeShare != null ? `${fmt(h.negativeShare, 1)}%` : '—'}</td>
                                <td>{h.responseRate != null ? `${fmt(h.responseRate, 1)}%` : '—'}</td>
                                <td>{fmtHours(h.medianReplyHours, r)}</td>
                                <td>
                                  {h.openNegative ? (
                                    <button type="button" className="rv-pill urg" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toFeed({ hotelId: h.hotelId, reply: 'none', ratingMax: (negBelow - 0.01).toFixed(2) }); }}>
                                      {h.openNegative} · {r('rv.dash.open')}
                                    </button>
                                  ) : <span style={{ color: 'var(--n5)' }}>0</span>}
                                </td>
                                <td style={{ fontSize: 12 }}>{h.topComplaint ? `${topicLabel(h.topComplaint, r, lang)} · ${h.topComplaint.count}` : '—'}</td>
                              </tr>
                            ))}
                            {!data.byHotel.length && <tr><td colSpan={9} className="rv-empty-s">{r('dash.noData')}</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </Frame>

                    <div className="rv-grid2">
                      <Frame className="rv-card rv-st" style={{ '--i': 10 } as React.CSSProperties}>
                        <CardHead title={r('dash.managersTitle')} sub={r('dash.managersSub')} />
                        {data.managers.length ? (
                          <table className="rv-tbl">
                            <thead><tr><th>{r('dash.col.manager')}</th><th>{r('dash.col.replies')}</th><th>{r('dash.col.replyTime')}</th></tr></thead>
                            <tbody>{data.managers.map((m) => <tr key={m.userId}><td>{m.name || '—'}</td><td>{m.replies}</td><td>{fmtHours(m.medianReplyHours, r)}</td></tr>)}</tbody>
                          </table>
                        ) : <div className="rv-empty-s">{r('dash.noManagers')}</div>}
                      </Frame>
                      <Frame className="rv-card rv-st" style={{ '--i': 11 } as React.CSSProperties}>
                        <CardHead title={r('dash.otherTitle')} sub={r('dash.otherSub')} />
                        {data.otherTopics.length ? (
                          <div className="rv-topics" style={{ marginTop: 0 }}>
                            {data.otherTopics.map((tp) => <span key={tp.label} className="rv-topic">{tp.label} · {tp.negative + tp.positive + tp.neutral}</span>)}
                          </div>
                        ) : <div className="rv-empty-s">{r('dash.noOther')}</div>}
                        <Btn sm style={{ marginTop: 12 }} onClick={() => navigate('/hotels/reviews/settings?tab=ai')}>{r('dash.extendDictionary')}</Btn>
                      </Frame>
                    </div>
                  </div>
                )}
              </>
            )}

            {view === 'report' && (
              <>
                <div className="rv-filters">
                  <Sel
                    single
                    allLabel={r('filters.allBrands')}
                    value={reportBrand ? [reportBrand] : []}
                    onChange={(v) => set('rbrand', v[0] || null)}
                    options={(setup?.brands || []).map((b) => ({ value: b.id, label: b.name }))}
                  />
                  <select className="rv-in" style={{ width: 190 }} value={reportMonth} onChange={(e) => set('month', e.target.value)} aria-label={r('rv.report.month')}>
                    {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
                  </select>
                  <span style={{ flex: 1 }} />
                  <Btn icon="download" disabled={!report} onClick={() => setReportOpen(true)}>PDF</Btn>
                  <Btn pri icon="send" disabled={!report} onClick={() => setReportOpen(true)}>{r('rv.report.send')}</Btn>
                </div>
                {reportLoading || !report ? (
                  <div className="rv-empty-s" style={{ padding: '40px 0', textAlign: 'center' }}>{r('dash.reportLoading')}</div>
                ) : (
                  <div key={`${reportBrand}-${reportMonth}`}>
                    <Frame className="rv-card" style={{ marginBottom: 22 }}>
                      <div className="kick rv-kick" style={{ marginBottom: 10 }}><span className="dot" />{r('rv.report.kick', { name: report.brand?.name || r('filters.allBrands'), month: monthTitle(reportMonth) })}</div>
                      <div className="rv-sum">
                        <div>
                          {report.brandHotels === 0 ? (
                            <div className="rv-note warn">
                              {r('dash.brandNoHotels')} <a href="#" onClick={(e) => { e.preventDefault(); navigate('/hotels/reviews/settings'); }}>{r('dash.assignBrand')}</a>
                            </div>
                          ) : !report.kpis.count ? (
                            <div className="rv-note">{r('dash.reportEmpty')}</div>
                          ) : summaryParts.length ? (
                            <>
                              <div className="h big rv-st">{summaryParts[0]}</div>
                              {summaryParts.slice(1).map((s, i) => <p key={i} className="rv-st" style={{ '--i': i + 1 } as React.CSSProperties}>{s}</p>)}
                            </>
                          ) : (
                            <p className="rv-st" style={{ color: 'var(--n7)' }}>{r('rv.report.noSummary')}</p>
                          )}
                        </div>
                        <div className="rv-kpis" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', border: '1px solid var(--ln)', alignSelf: 'start', marginBottom: 0 }}>
                          {(
                            [
                              [r('dash.kpi.avg'), report.kpis.avg10, 2, '/10', report.kpis.avg10 != null && report.prev.avg10 != null ? report.kpis.avg10 - report.prev.avg10 : null, false],
                              [r('dash.kpi.count'), report.kpis.count, 0, '', report.kpis.count - report.prev.count, false],
                              [r('dash.kpi.neg'), report.kpis.negativeShare, 1, '%', report.kpis.negativeShare != null && report.prev.negativeShare != null ? report.kpis.negativeShare - report.prev.negativeShare : null, true],
                              [r('dash.kpi.response'), report.kpis.responseRate, 1, '%', report.kpis.responseRate != null && report.prev.responseRate != null ? report.kpis.responseRate - report.prev.responseRate : null, false],
                            ] as Array<[string, number | null, number, string, number | null, boolean]>
                          ).map(([l, v, d, s, dl, inv], i) => (
                            <div key={l} className="rv-kpi" style={i % 2 === 0 ? { borderLeft: 0 } : undefined}>
                              <div className="l">{l}</div>
                              <div className="v" style={{ fontSize: 34 }}><CountUp v={v} d={d} />{s && v != null && <small>{s}</small>}</div>
                              <div className="d"><Delta v={dl} invert={inv} digits={d} />{dl != null && <span>{r('rv.report.vsPrevMonth')}</span>}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Frame>
                    <div className="rv-grid2">
                      <Frame className="rv-card rv-st" style={{ '--i': 1 } as React.CSSProperties}>
                        <CardHead title={r('dash.top5')} cls="neg" sub={r('dash.top5Sub')} />
                        <TopicBars rows={report.topComplaints} kind="negative" onPick={(tp) => toFeed({ topic: tp, sentiment: 'negative', brandId: reportBrand })} />
                      </Frame>
                      <Frame className="rv-card rv-st" style={{ '--i': 2 } as React.CSSProperties}>
                        <CardHead title={r('dash.dropped')} sub={r('dash.droppedSub')} />
                        {report.droppedHotels.length ? (
                          <div className="rv-bars">
                            {report.droppedHotels.map((h) => (
                              <div key={h.hotelId} className="rv-bar" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 70px' }}>
                                <span>{h.name}</span>
                                <span className="v"><Score v={h.avg10} nb={negBelow} /></span>
                                <span className="v" style={{ fontSize: 13 }}><Delta v={h.delta} /></span>
                              </div>
                            ))}
                          </div>
                        ) : <div className="rv-empty-s">{r('dash.noDropped')}</div>}
                      </Frame>
                    </div>
                    <Frame className="rv-card rv-st" style={{ '--i': 3, marginBottom: 22 } as React.CSSProperties}>
                      <CardHead title={r('dash.compareTitle')} sub={r('dash.compareSub')} />
                      <div className="rv-tw">
                        <table className="rv-tbl">
                          <thead><tr><th>{r('dash.col.hotel')}</th><th>{r('dash.col.index')}</th><th>Δ</th><th>{r('dash.col.avg')}</th><th>Δ</th><th>{r('dash.col.count')}</th><th>{r('dash.col.neg')}</th><th>{r('dash.col.topComplaint')}</th></tr></thead>
                          <tbody>
                            {report.hotels.map((h) => (
                              <tr key={h.hotelId}>
                                <td><b>{h.name}</b></td>
                                <td><span className="rv-score"><b className={scoreClass(h.reputationIndex != null ? h.reputationIndex / 10 : null, negBelow)}>{fmtRepIndex(h.reputationIndex, lang)}</b></span></td>
                                <td><Delta v={h.indexDelta} digits={1} /></td>
                                <td><Score v={h.avg10} nb={negBelow} /></td>
                                <td><Delta v={h.delta} /></td>
                                <td>{h.count}</td>
                                <td>{h.negativeShare != null ? `${fmt(h.negativeShare, 1)}%` : '—'}</td>
                                <td style={{ fontSize: 12 }}>{h.topComplaint ? `${topicLabel(h.topComplaint, r, lang)} · ${h.topComplaint.count}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Frame>
                    <div className="rv-note">{r('dash.reportAutoSend')}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <RepReportModal open={reportOpen} onClose={() => setReportOpen(false)} query={reportQuery} scopeText={scopeText} />
      </div>
    </MainLayout>
  );
};

export default ReviewsDashboardPage;
