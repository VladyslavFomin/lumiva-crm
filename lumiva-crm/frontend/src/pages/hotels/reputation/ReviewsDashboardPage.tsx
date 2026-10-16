import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
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
import { AiStatusBanner, Delta, PLATFORM_META, PlatformBadge, ReputationTabs, Score, fmtHours, fmtRepIndex, scoreClass, topicLabel, useRepT } from './ReputationShared';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate } from '../../../components/ui/DateRangePicker';
import { RepMultiSelect, joinParam, splitParam } from './RepMultiSelect';
import { RepReportModal } from './RepReportModal';
import '../hotels-design.css';
import './reputation.css';

const INK = '#222';
const NEG = '#cc2f47';
const POS = '#1f8a5e';
const PREV = '#b9bcc4';
/** Цвета линий сравнения: различимы между собой и на белом фоне. */
const SERIES = ['#222222', '#2f6fde', '#d9822b', '#1f8a5e', '#9b4dca', '#cc2f47', '#0f9fb0', '#8a6d3b'];
const fmt = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toFixed(d));

/** Подпись шага: день/неделя — «13.10», месяц — «10.26». Подписей не больше ~12, чтобы не слипались. */
function bucketLabel(b: string, g: 'day' | 'week' | 'month') {
  const [y, m, d] = b.split('-');
  return g === 'month' ? `${m}.${y.slice(2)}` : `${d}.${m}`;
}
function tickEvery(n: number) {
  return Math.max(1, Math.ceil(n / 12));
}
function bucketTitle(b: string, g: 'day' | 'week' | 'month', lang: string, r: (k: string, o?: any) => string) {
  const loc = lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const d = new Date(`${b}T00:00:00Z`);
  if (g === 'month') return d.toLocaleDateString(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (g === 'week') return r('dash.weekOf', { d: d.toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Средняя оценка 0–10 по шагам выбранного периода (одна ось, одна серия). */
const AvgLine: React.FC<{ series: RepDashboard['series']; prev?: RepDashboard['prevSeries'] | null; negBelow: number }> = ({ series, prev, negBelow }) => {
  const { r, lang } = useRepT();
  const [hover, setHover] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 560;
  const H = 150;
  const pts = rows.map((m, i) => ({ ...m, x: rows.length > 1 ? 24 + (i / (rows.length - 1)) * (W - 40) : W / 2, prev: prev?.points[i] ?? null }));
  const vals = pts.flatMap((p) => [p.avg10, p.prev?.avg10 ?? null]).filter((v): v is number => v != null);
  if (!vals.length) return <div className="rp-empty">{r('dash.noData')}</div>;
  const lo = Math.max(0, Math.floor(Math.min(...vals, negBelow) - 0.5));
  const hi = Math.min(10, Math.ceil(Math.max(...vals, 8) + 0.3));
  const y = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - 30);
  const line = pts.filter((p) => p.avg10 != null).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.avg10!).toFixed(1)}`).join(' ');
  const prevLine = pts.filter((p) => p.prev?.avg10 != null).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.prev!.avg10!).toFixed(1)}`).join(' ');
  const every = tickEvery(pts.length);
  const step = pts.length > 1 ? (W - 40) / (pts.length - 1) : 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart" onMouseLeave={() => setHover(null)}>
      {[lo, (lo + hi) / 2, hi].map((gv) => (
        <g key={gv}>
          <line x1={24} x2={W - 16} y1={y(gv)} y2={y(gv)} stroke="#f0f0f0" />
          <text x={0} y={y(gv) + 3} fontSize="9" fill="#b5b5b5">{gv.toFixed(1)}</text>
        </g>
      ))}
      {negBelow > lo && negBelow < hi && <line x1={24} x2={W - 16} y1={y(negBelow)} y2={y(negBelow)} stroke={NEG} strokeDasharray="3 4" strokeOpacity={0.5} />}
      {prev && prevLine && <path d={prevLine} fill="none" stroke={PREV} strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />}
      <path d={line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.bucket} onMouseEnter={() => setHover(i)}>
          <rect x={p.x - step / 2} y={0} width={Math.max(step, 6)} height={H} fill="transparent" />
          {p.avg10 != null && <circle cx={p.x} cy={y(p.avg10)} r={hover === i ? 5 : pts.length > 40 ? 2.5 : 4} fill={INK} stroke="#fff" strokeWidth={pts.length > 40 ? 1 : 2} />}
          {i % every === 0 && <text x={p.x} y={H - 2} fontSize="9" fill="#888" textAnchor="middle">{bucketLabel(p.bucket, g)}</text>}
        </g>
      ))}
      {hover != null && pts[hover] && (() => {
        const p = pts[hover];
        const cx = Math.min(W - 90, Math.max(90, p.x));
        const withPrev = !!prev && !!p.prev;
        return (
          <g pointerEvents="none">
            <rect x={cx - 90} y={2} width={180} height={withPrev ? 47 : 34} rx={6} fill="#222" />
            <text x={cx} y={16} fontSize="10" fill="#fff" textAnchor="middle">{bucketTitle(p.bucket, g, lang, r)}</text>
            <text x={cx} y={29} fontSize="10" fill="#fff" textAnchor="middle">{p.avg10 != null ? `${fmt(p.avg10)} / 10` : '—'} · {r('dash.tipReviews', { n: p.count })}</text>
            {withPrev && (
              <text x={cx} y={42} fontSize="9.5" fill="#c9cbd1" textAnchor="middle">
                {r('dash.tipPrev', { d: bucketTitle(p.prev!.bucket, g, lang, r), v: p.prev!.avg10 != null ? fmt(p.prev!.avg10) : '—', n: p.prev!.count })}
              </text>
            )}
          </g>
        );
      })()}
    </svg>
  );
};

/** Число отзывов по шагам выбранного периода (отдельный график — без второй оси). */
const CountBars: React.FC<{ series: RepDashboard['series']; prev?: RepDashboard['prevSeries'] | null }> = ({ series, prev }) => {
  const { r, lang } = useRepT();
  const [hover, setHover] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 560;
  const H = 130;
  const prevRows = prev?.points || [];
  const max = Math.max(1, ...rows.map((m) => m.count), ...(prev ? prevRows.map((m) => m.count) : []));
  const step = (W - 30) / Math.max(1, rows.length);
  const pair = prev ? 2 : 1;
  const bw = Math.max(1.5, Math.min(prev ? 16 : 34, (step - (rows.length > 40 ? 2 : 6)) / pair));
  const every = tickEvery(rows.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart" onMouseLeave={() => setHover(null)}>
      {rows.map((m, i) => {
        const x = 24 + i * step;
        const h = (m.count / max) * (H - 40);
        const pm = prev ? prevRows[i] : null;
        const ph = pm ? (pm.count / max) * (H - 40) : 0;
        return (
          <g key={m.bucket} onMouseEnter={() => setHover(i)}>
            <rect x={x} y={0} width={step} height={H} fill="transparent" />
            {prev && <rect x={x} y={H - 14 - ph} width={bw} height={Math.max(pm?.count ? 1 : 0, ph)} rx={Math.min(3, bw / 2)} fill={PREV} />}
            <rect x={x + (prev ? bw : 0)} y={H - 14 - h} width={bw} height={Math.max(1, h)} rx={Math.min(4, bw / 2)} fill={INK} fillOpacity={hover === i ? 1 : 0.85} />
            {i % every === 0 && <text x={x + (bw * pair) / 2} y={H - 2} fontSize="9" fill="#888" textAnchor="middle">{bucketLabel(m.bucket, g)}</text>}
          </g>
        );
      })}
      {hover != null && rows[hover] && (() => {
        const m = rows[hover];
        const pm = prev ? prevRows[hover] : null;
        const cx = Math.min(W - 90, Math.max(90, 24 + hover * step + bw / 2));
        return (
          <g pointerEvents="none">
            <rect x={cx - 90} y={0} width={180} height={pm ? 47 : 34} rx={6} fill="#222" />
            <text x={cx} y={14} fontSize="10" fill="#fff" textAnchor="middle">{bucketTitle(m.bucket, g, lang, r)} · {r('dash.tipReviews', { n: m.count })}</text>
            <text x={cx} y={27} fontSize="10" fill="#fff" textAnchor="middle">{r('dash.tipNeg', { n: m.negativeShare ?? '—' })}</text>
            {pm && <text x={cx} y={40} fontSize="9.5" fill="#c9cbd1" textAnchor="middle">{r('dash.tipPrevCount', { d: bucketTitle(pm.bucket, g, lang, r), n: pm.count })}</text>}
          </g>
        );
      })()}
    </svg>
  );
};

/** Несколько отелей или площадок на одном графике: средняя оценка или число отзывов по шагам периода. */
const CompareChart: React.FC<{ data: RepCompare; negBelow: number }> = ({ data, negBelow }) => {
  const { r, lang } = useRepT();
  const [metric, setMetric] = useState<'avg' | 'count'>('avg');
  const [hover, setHover] = useState<number | null>(null);
  const g = data.granularity;
  const items = data.items.map((it, i) => ({
    ...it,
    name: data.dim === 'platform' ? PLATFORM_META[it.key as keyof typeof PLATFORM_META]?.label || it.key : it.label,
    color: data.dim === 'platform' ? PLATFORM_META[it.key as keyof typeof PLATFORM_META]?.bg || SERIES[i % SERIES.length] : SERIES[i % SERIES.length],
  }));
  const buckets = items[0]?.points.map((p) => p.bucket) || [];
  const W = 560;
  const H = 170;
  const xOf = (i: number) => (buckets.length > 1 ? 24 + (i / (buckets.length - 1)) * (W - 40) : W / 2);
  const val = (p: { avg10: number | null; count: number }) => (metric === 'avg' ? p.avg10 : p.count);
  const vals = items.flatMap((it) => it.points.map(val)).filter((v): v is number => v != null);
  const lo = metric === 'avg' ? Math.max(0, Math.floor(Math.min(...vals, negBelow) - 0.5)) : 0;
  const hi = metric === 'avg' ? Math.min(10, Math.ceil(Math.max(...vals, 8) + 0.3)) : Math.max(1, ...vals);
  const y = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - 30);
  const every = tickEvery(buckets.length);
  const step = buckets.length > 1 ? (W - 40) / (buckets.length - 1) : 40;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div className="rp-legend">
          {items.map((it) => (
            <span key={it.key} style={{ color: it.color }}>
              <i />
              <b>{it.name}</b>
              <small>{fmt(it.avg10)} · {r('dash.tipReviews', { n: it.count })}</small>
            </span>
          ))}
        </div>
        <div className="rp-seg">
          <button type="button" className={metric === 'avg' ? 'on' : ''} onClick={() => setMetric('avg')}>{r('dash.cmpAvg')}</button>
          <button type="button" className={metric === 'count' ? 'on' : ''} onClick={() => setMetric('count')}>{r('dash.cmpCount')}</button>
        </div>
      </div>
      {!vals.length ? (
        <div className="rp-empty">{r('dash.noData')}</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart" onMouseLeave={() => setHover(null)}>
          {[lo, (lo + hi) / 2, hi].map((gv) => (
            <g key={gv}>
              <line x1={24} x2={W - 16} y1={y(gv)} y2={y(gv)} stroke="#f0f0f0" />
              <text x={0} y={y(gv) + 3} fontSize="9" fill="#b5b5b5">{metric === 'avg' ? gv.toFixed(1) : Math.round(gv)}</text>
            </g>
          ))}
          {metric === 'avg' && negBelow > lo && negBelow < hi && <line x1={24} x2={W - 16} y1={y(negBelow)} y2={y(negBelow)} stroke={NEG} strokeDasharray="3 4" strokeOpacity={0.5} />}
          {items.map((it) => <path key={it.key} d={path(it.points)} fill="none" stroke={it.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {buckets.map((b, i) => (
            <g key={b} onMouseEnter={() => setHover(i)}>
              <rect x={xOf(i) - step / 2} y={0} width={Math.max(step, 6)} height={H} fill="transparent" />
              {hover === i && <line x1={xOf(i)} x2={xOf(i)} y1={6} y2={H - 16} stroke="#ddd" />}
              {hover === i && items.map((it) => (val(it.points[i]) != null ? <circle key={it.key} cx={xOf(i)} cy={y(val(it.points[i])!)} r={4} fill={it.color} stroke="#fff" strokeWidth={1.5} /> : null))}
              {i % every === 0 && <text x={xOf(i)} y={H - 2} fontSize="9" fill="#888" textAnchor="middle">{bucketLabel(b, g)}</text>}
            </g>
          ))}
          {hover != null && buckets[hover] && (() => {
            const lines = items.map((it) => ({ it, p: it.points[hover] }));
            const bh = 18 + lines.length * 13;
            const cx = Math.min(W - 100, Math.max(100, xOf(hover)));
            return (
              <g pointerEvents="none">
                <rect x={cx - 100} y={2} width={200} height={bh} rx={6} fill="#222" />
                <text x={cx} y={15} fontSize="10" fill="#fff" textAnchor="middle">{bucketTitle(buckets[hover], g, lang, r)}</text>
                {lines.map(({ it, p }, k) => (
                  <g key={it.key}>
                    <circle cx={cx - 88} cy={25 + k * 13} r={3.5} fill={it.color} />
                    <text x={cx - 80} y={28 + k * 13} fontSize="9.5" fill="#fff">{it.name.length > 22 ? `${it.name.slice(0, 21)}…` : it.name}</text>
                    <text x={cx + 92} y={28 + k * 13} fontSize="9.5" fill="#fff" textAnchor="end">{p.avg10 != null ? fmt(p.avg10) : '—'} · {p.count}</text>
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

/** 🇩🇪 из «DE»; группы стран (англо-/арабоязычные) — глобус. */
function flagOf(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Страны гостей: кто больше жалуется — по оценкам (средняя / доля негатива) или по количеству негативных отзывов. */
const CountriesBlock: React.FC<{ data: NonNullable<RepDashboard['countries']>; negBelow: number }> = ({ data, negBelow }) => {
  const { r, lang } = useRepT();
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
  // по оценкам — только страны с выборкой от 5 отзывов, иначе одна «единица» делает страну худшей
  const MIN = 5;
  const rows = mode === 'rating'
    ? data.items.filter((c) => c.count >= MIN && c.avg10 != null).sort((a, b) => (a.avg10! - b.avg10!) || (b.negativeShare ?? 0) - (a.negativeShare ?? 0))
    : [...data.items].sort((a, b) => b.negative - a.negative || b.count - a.count);
  const shown = all ? rows : rows.slice(0, 10);
  const maxCount = Math.max(1, ...rows.map((c) => c.count));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{mode === 'rating' ? r('dash.countriesRatingHint', { n: MIN }) : r('dash.countriesCountHint')}</div>
        <div className="rp-seg">
          <button type="button" className={mode === 'rating' ? 'on' : ''} onClick={() => setMode('rating')}>{r('dash.countriesByRating')}</button>
          <button type="button" className={mode === 'count' ? 'on' : ''} onClick={() => setMode('count')}>{r('dash.countriesByCount')}</button>
        </div>
      </div>
      {!rows.length ? (
        <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noData')}</div>
      ) : (
        shown.map((c) => (
          <div key={c.code} className="rp-country">
            <div className="n">
              <span className="flag" aria-hidden="true">{flagOf(c.code)}</span>
              <span title={c.byLangShare != null && c.byLangShare >= 0.5 ? `${nameOf(c)} — ${r('dash.byLangHint')}` : nameOf(c)}>{nameOf(c)}</span>
            </div>
            {mode === 'rating' ? (
              <div className="track" title={`${fmt(c.avg10)} / 10`}>
                <i style={{ width: `${((c.avg10 ?? 0) / 10) * 100}%`, background: c.avg10 != null && c.avg10 < negBelow ? NEG : c.avg10 != null && c.avg10 < 8 ? '#d9822b' : POS }} />
              </div>
            ) : (
              <div className="track" title={r('dash.countriesBarHint', { neg: c.negative, n: c.count })}>
                <i style={{ width: `${(c.negative / maxCount) * 100}%`, background: NEG }} />
                <i style={{ width: `${((c.count - c.negative) / maxCount) * 100}%`, background: '#d5d8de' }} />
              </div>
            )}
            <div className="v">
              {mode === 'rating' ? (
                <>
                  <b>{fmt(c.avg10)}</b> <small>{r('dash.countryNeg', { p: c.negativeShare ?? '—', n: c.count })}</small>
                </>
              ) : (
                <>
                  <b>{c.negative}</b> <small>{r('dash.countryOf', { n: c.count })}</small>
                </>
              )}
            </div>
          </div>
        ))
      )}
      {rows.length > 10 && (
        <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setAll((x) => !x)}>
          {all ? r('dash.showLess') : r('dash.showAll', { n: rows.length })}
        </button>
      )}
      {data.unknown > 0 && <div className="rp-src-meta" style={{ marginTop: 8 }}>{r('dash.countriesUnknown', { n: data.unknown })}</div>}
    </div>
  );
};

/** Разрыв по теме с конкурентами: подпись — доля жалоб или похвал «у нас / у них». */
const GapList: React.FC<{ rows: RepCompetitorTopic[]; kind: 'lose' | 'win' }> = ({ rows, kind }) => {
  const { r, lang } = useRepT();
  const max = Math.max(1, ...rows.map((x) => Math.abs(x.gap ?? 0)));
  if (!rows.length) return <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('comp.noGap')}</div>;
  return (
    <div className="rp-bars">
      {rows.map((x) => (
        <div key={x.topic} className="rp-bar" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 120px' }}>
          <span className="n" style={{ cursor: 'default' }}>{topicLabel(x, r, lang)}</span>
          <span className="track"><span className="fill" style={{ width: `${(Math.abs(x.gap ?? 0) / max) * 100}%`, background: kind === 'lose' ? NEG : POS }} /></span>
          <span className="v" style={{ fontSize: 11.5 }} title={r('comp.gapHint', { g: Math.abs(x.gap ?? 0) })}>
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
 * Мы против конкурентов (если клиент их добавил): средняя и динамика на одних и тех же площадках,
 * место среди конкурентов, темы — где проигрываем и где выигрываем.
 */
const CompetitorsBlock: React.FC<{ data: RepCompetitorsCompare; negBelow: number }> = ({ data, negBelow }) => {
  const { r, lang } = useRepT();
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
  const onSite = (list: Array<{ platform: string; rating: number | null; count: number | null }>) =>
    list.filter((x) => x.rating != null).map((x) => (
      <span key={x.platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8, whiteSpace: 'nowrap' }}>
        <PlatformBadge platform={x.platform as any} compact /> {x.rating!.toFixed(1)}{x.count != null ? <small style={{ color: 'var(--fg-4)' }}> ({x.count})</small> : null}
      </span>
    ));
  const errors = h.competitors.flatMap((c) => c.platforms.filter((p) => p.lastError).map((p) => `${c.name} · ${PLATFORM_META[p.platform].label}`));
  return (
    <div data-tour="rvd-competitors" className="ha-section">
      <div className="ha-section-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3>{r('comp.title')}</h3>
          <div className="sub">{r('comp.sub', { p: h.platforms.map((p) => PLATFORM_META[p].label).join(', ') })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {data.hotels.length > 1 && (
            <select value={h.hotelId} onChange={(e) => setHid(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line-2)', borderRadius: 9, font: 'inherit', fontSize: 12.5, background: '#fff' }}>
              {data.hotels.map((x) => <option key={x.hotelId} value={x.hotelId}>{x.name}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-sm" onClick={() => navigate('/hotels/reviews/settings?tab=competitors')}>{r('comp.manage')}</button>
        </div>
      </div>
      {h.rank != null && <div className="rp-note" style={{ marginBottom: 12 }}><b>{r('comp.rank', { r: h.rank, n: h.rankOf })}</b> {r('comp.rankHint')}</div>}
      {errors.length > 0 && <div className="rp-note warn" style={{ marginBottom: 12 }}>{r('comp.sourceErrors', { list: errors.join(', ') })}</div>}
      <div className="pace-table-wrap" style={{ marginBottom: 14 }}>
        <table className="pace-table">
          <thead><tr><th>{r('dash.col.hotel')}</th><th>{r('dash.col.avg')}</th><th>Δ</th><th>{r('dash.col.count')}</th><th>{r('dash.col.neg')}</th><th>{r('comp.onPlatform')}</th></tr></thead>
          <tbody>
            {[{ id: 'ours', name: r('comp.us', { name: h.name }), ...h.ours, platforms: [] as any[] }, ...h.competitors].map((c, i) => (
              <tr key={c.id} style={i === 0 ? { background: 'var(--bg-muted)' } : undefined}>
                <td><b>{c.name}</b></td>
                <td><Score rating10={c.avg10} negBelow={negBelow} /></td>
                <td><Delta v={c.delta} /></td>
                <td>{c.count}</td>
                <td>{c.negativeShare != null ? `${c.negativeShare}%` : '—'}</td>
                <td style={{ fontSize: 12 }}>{i === 0 ? '—' : onSite(c.platforms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rp-grid2" style={{ marginBottom: 0, alignItems: 'start' }}>
        <CompareChart data={chart} negBelow={negBelow} />
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: NEG }}>{r('comp.losing')}</h4>
          {h.topicsBase.ours < h.topicsBase.min || h.topicsBase.theirs < h.topicsBase.min
            ? <div style={{ color: 'var(--fg-4)', fontSize: 12.5 }}>{r('comp.fewTopics', { n: h.topicsBase.min, a: h.topicsBase.ours, b: h.topicsBase.theirs })}</div>
            : <GapList rows={h.losing} kind="lose" />}
          {h.topicsBase.ours >= h.topicsBase.min && h.topicsBase.theirs >= h.topicsBase.min && (
            <>
              <h4 style={{ margin: '16px 0 8px', fontSize: 13, color: POS }}>{r('comp.winning')}</h4>
              <GapList rows={h.winning} kind="win" />
            </>
          )}
        </div>
      </div>
      <div className="rp-src-meta" style={{ marginTop: 10 }}>{r('comp.topicsNote')}</div>
    </div>
  );
};

/** Номера с жалобами: негативные отзывы, связанные с бронью гостя (номер, даты проживания). */
const RoomsBlock: React.FC<{ data: NonNullable<RepDashboard['rooms']>; hotelName: (id: string) => string; negBelow: number }> = ({ data, hotelName, negBelow }) => {
  const { r } = useRepT();
  const navigate = useNavigate();
  return (
    <div data-tour="rvd-rooms" className="ha-section">
      <div className="ha-section-head"><div><h3>{r('rooms.title')}</h3><div className="sub">{r('rooms.sub', { n: data.linked, s: data.suggested })}</div></div></div>
      {!data.rooms.length ? (
        <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('rooms.none')}</div>
      ) : (
        <div className="pace-table-wrap">
          <table className="pace-table">
            <thead><tr><th>{r('rooms.room')}</th><th>{r('dash.col.hotel')}</th><th>{r('rooms.negative')}</th><th>{r('dash.col.avg')}</th><th /></tr></thead>
            <tbody>
              {data.rooms.map((x) => (
                <tr key={`${x.hotelId}-${x.roomUnitId || x.roomType}`}>
                  <td><b>{x.room ? `№ ${x.room}` : r('rooms.noUnit')}</b>{x.roomType && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{x.roomType}</div>}</td>
                  <td>{hotelName(x.hotelId)}</td>
                  <td><span className="ha-risk-pill bad">{x.negative}</span> <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>{r('rooms.of', { n: x.reviews })}</span></td>
                  <td><Score rating10={x.avg10} negBelow={negBelow} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {x.negativeReviewIds[0] && <button type="button" className="btn btn-sm" onClick={() => navigate(`/hotels/reviews?review=${x.negativeReviewIds[0]}`)}>{r('rooms.open')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const TopicBars: React.FC<{ rows: RepTopicStat[]; kind: 'negative' | 'positive'; onPick: (topic: string) => void }> = ({ rows, kind, onPick }) => {
  const { r, lang } = useRepT();
  const max = Math.max(1, ...rows.map((t) => t[kind]));
  if (!rows.length) return <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noTopics')}</div>;
  return (
    <div className="rp-bars">
      {rows.map((t) => {
        const quotes = kind === 'negative' ? t.negQuotes : t.posQuotes;
        return (
          <div key={`${t.topic}-${t.label}`} className="rp-bar" title={quotes.map((q) => `«${q}»`).join('\n')}>
            <span className="n" onClick={() => onPick(t.topic)}>{topicLabel(t, r, lang)}</span>
            <span className="track"><span className="fill" style={{ width: `${(t[kind] / max) * 100}%`, background: kind === 'negative' ? NEG : POS }} /></span>
            <span className="v">
              {t[kind]}
              {kind === 'negative' && <small><Delta v={t.negative - t.prevNegative} invert digits={0} /></small>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Отели → Отзывы → Дашборд: как меняется рейтинг и на что конкретно жалуются гости. */
export const ReviewsDashboardPage: React.FC = () => {
  const { r, t, lang } = useRepT();
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
  const [matrix, setMatrix] = useState<Awaited<ReturnType<typeof fetchRepTopicMatrix>> | null>(null);
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
    const base = {
      brandId: params.get('brand') || undefined,
      hotelId: params.get('hotel') || undefined,
      platform: params.get('platform') || undefined,
      compare: params.get('cmp') === 'yoy' ? ('yoy' as const) : undefined,
    };
    // мультивыбор: в URL и в API — через запятую
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
  const nameList = (ids: string[], all: string, of: (id: string) => string) => (ids.length ? ids.map(of).join(', ') : all);
  const scopeText = [
    nameList(selBrands, r('filters.allBrands'), (id) => setup?.brands.find((b) => b.id === id)?.name || '—'),
    nameList(selHotels, r('filters.allHotels'), (id) => hotels.find((h) => h.id === id)?.name || '—'),
    nameList(selPlatforms, r('filters.allPlatforms'), (id) => PLATFORM_META[id as keyof typeof PLATFORM_META]?.label || id),
    data ? `${new Date(data.period.from).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU')} — ${new Date(new Date(data.period.to).getTime() - 864e5).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU')}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReviewsDashboard" />
      <div className="px-scope">
        <HotelsSubnav active="reviews" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{r('kicker')}</div>
            <h1>{r('dash.title')}</h1>
            <p className="sub">{r('dash.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            {view === 'overview' && (
              <button type="button" className="btn" onClick={() => setReportOpen(true)} disabled={!data}>
                <Ic d={HTL_ICON.download} />{r('report.button')}
              </button>
            )}
            <div data-tour="rvd-view" className="hotel-select-tabs">
              <div className={`hotel-select-tab${view === 'overview' ? ' active' : ''}`} onClick={() => set('view', null)}>{r('dash.viewOverview')}</div>
              <div className={`hotel-select-tab${view === 'report' ? ' active' : ''}`} onClick={() => set('view', 'report')}>{r('dash.viewReport')}</div>
            </div>
          </div>
        </div>
        <ReputationTabs active="dashboard" />

        {view === 'overview' && (
          <>
            <div data-tour="rvd-filters" className="rp-filters">
              <RepMultiSelect allLabel={r('filters.allBrands')} value={selBrands} onChange={setBrands} options={(setup?.brands || []).map((b) => ({ value: b.id, label: b.name }))} />
              <RepMultiSelect allLabel={r('filters.allHotels')} value={selHotels} onChange={(v) => set('hotel', joinParam(v))} options={hotelOptions} />
              <RepMultiSelect
                allLabel={r('filters.allPlatforms')}
                value={selPlatforms}
                onChange={(v) => set('platform', joinParam(v))}
                options={REP_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformBadge platform={p} compact /> }))}
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
            </div>

            {!data ? (
              <div className="rp-empty">{r('card.loading')}</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '0 0 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{r('dash.compareWith')}</span>
                    <div className="rp-seg">
                      <button type="button" className={cmpMode === 'prev' ? 'on' : ''} onClick={() => set('cmp', null)}>{r('dash.cmpPrev')}</button>
                      <button type="button" className={cmpMode === 'yoy' ? 'on' : ''} onClick={() => set('cmp', 'yoy')}>{r('dash.cmpYoy')}</button>
                      <button type="button" className={cmpMode === 'off' ? 'on' : ''} onClick={() => set('cmp', '0')}>{r('dash.cmpOff')}</button>
                    </div>
                  </div>
                  {showPrev && data.prevPeriod && (
                    <div className="rp-legend" style={{ margin: 0 }}>
                      <span style={{ color: INK }}><i />{r('dash.legendCurrent')}</span>
                      <span style={{ color: PREV }}>
                        <i className="dash" />
                        {r(cmpMode === 'yoy' ? 'dash.legendYoy' : 'dash.legendPrev', {
                          from: new Date(data.prevPeriod.from).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU', { day: 'numeric', month: 'short' }),
                          to: new Date(new Date(data.prevPeriod.to).getTime() - 864e5).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
                        })}
                      </span>
                    </div>
                  )}
                </div>
                {cmpMode === 'yoy' && k!.delta && k!.count > 0 && k!.count - k!.delta.count < k!.count * 0.5 && (
                  <div className="rp-note warn" style={{ marginBottom: 12 }}>{r('dash.yoyPartial', { prev: k!.count - k!.delta.count, cur: k!.count })}</div>
                )}
                <div data-tour="rvd-kpis" className="rp-kpis">
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.avgHint')}>{r('dash.kpi.avg')}</span></div>
                    <div className="v">{fmt(k!.avg10)}<small>/10</small></div>
                    <div className="d"><Delta v={k!.delta?.avg10} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.indexHint')}>{r('dash.kpi.index')}</span></div>
                    <div className="v">{fmtRepIndex(k!.reputationIndex, lang)}<small>/100</small></div>
                    <div className="d"><Delta v={k!.delta?.reputationIndex} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l">{r('dash.kpi.count')}</div>
                    <div className="v">{k!.count}</div>
                    <div className="d"><Delta v={k!.delta?.count} digits={0} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.negHint', { n: negBelow })}>{r('dash.kpi.neg')}</span></div>
                    <div className="v">{fmt(k!.negativeShare, 1)}<small>%</small></div>
                    <div className="d"><Delta v={k!.delta?.negativeShare} invert suffix={` ${r('units.pp')}`} digits={1} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.responseHint')}>{r('dash.kpi.response')}</span></div>
                    <div className="v">{fmt(k!.responseRate, 1)}<small>%</small></div>
                    <div className="d"><Delta v={k!.delta?.responseRate} suffix={` ${r('units.pp')}`} digits={1} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.replyTimeHint')}>{r('dash.kpi.replyTime')}</span></div>
                    <div className="v" style={{ fontSize: 20 }}>{fmtHours(k!.medianReplyHours, r)}</div>
                    <div className="d"><Delta v={k!.delta?.medianReplyHours} invert suffix={` ${r('units.h')}`} digits={1} /></div>
                  </div>
                </div>

                {k!.count === 0 && <div className="rp-note" style={{ marginBottom: 16 }}>{r('dash.noData')}</div>}
                <AiStatusBanner status={aiStatus} />

                <div data-tour="rvd-trend" className="rp-grid2">
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.chart} size={15} />{r('dash.trendTitleP')}</h3><div className="sub">{r('dash.trendSub', { n: negBelow, step: r(`dash.step.${data.series.granularity}`) })}</div></div></div>
                    {data.series.points.length ? <AvgLine series={data.series} prev={showPrev ? data.prevSeries : null} negBelow={negBelow} /> : <div className="rp-empty">{r('dash.noData')}</div>}
                  </div>
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.calendar} size={15} />{r('dash.countTitleP')}</h3><div className="sub">{r('dash.countSub', { step: r(`dash.step.${data.series.granularity}`) })}</div></div></div>
                    {data.series.points.length ? <CountBars series={data.series} prev={showPrev ? data.prevSeries : null} /> : <div className="rp-empty">{r('dash.noData')}</div>}
                  </div>
                </div>

                {(selHotels.length > 1 || selPlatforms.length > 1) && (
                  <div className={selHotels.length > 1 && selPlatforms.length > 1 ? 'rp-grid2' : ''}>
                    {selHotels.length > 1 && (
                      <div className="ha-section">
                        <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.chart} size={15} />{r('dash.cmpHotelsTitle')}</h3><div className="sub">{r('dash.cmpSub', { step: r(`dash.step.${data.series.granularity}`) })}</div></div></div>
                        {cmpHotels ? <CompareChart data={cmpHotels} negBelow={negBelow} /> : <div className="rp-empty">{r('card.loading')}</div>}
                      </div>
                    )}
                    {selPlatforms.length > 1 && (
                      <div className="ha-section">
                        <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.chart} size={15} />{r('dash.cmpPlatformsTitle')}</h3><div className="sub">{r('dash.cmpSub', { step: r(`dash.step.${data.series.granularity}`) })}</div></div></div>
                        {cmpPlatforms ? <CompareChart data={cmpPlatforms} negBelow={negBelow} /> : <div className="rp-empty">{r('card.loading')}</div>}
                      </div>
                    )}
                  </div>
                )}

                <div data-tour="rvd-topics" className="rp-grid2">
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3 style={{ color: NEG }}>{r('dash.complaints')}</h3><div className="sub">{r('dash.complaintsSub')}</div></div></div>
                    <TopicBars rows={data.complaints} kind="negative" onPick={(t) => toFeed({ topic: t, sentiment: 'negative' })} />
                  </div>
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3 style={{ color: POS }}>{r('dash.praises')}</h3><div className="sub">{r('dash.praisesSub')}</div></div></div>
                    <TopicBars rows={data.praises} kind="positive" onPick={(t) => toFeed({ topic: t })} />
                  </div>
                </div>

                {data.countries && (
                  <div data-tour="rvd-countries" className="ha-section">
                    <div className="ha-section-head"><div><h3>{r('dash.countriesTitle')}</h3><div className="sub">{r('dash.countriesSub')}</div></div></div>
                    <CountriesBlock data={data.countries} negBelow={negBelow} />
                  </div>
                )}

                {competitors && competitors.hotels.length > 0 && <CompetitorsBlock data={competitors} negBelow={negBelow} />}

                {data.rooms && (data.rooms.linked > 0 || data.rooms.suggested > 0) && (
                  <RoomsBlock data={data.rooms} negBelow={negBelow} hotelName={(id) => hotels.find((x) => x.id === id)?.name || '—'} />
                )}

                <div data-tour="rvd-hotels" className="ha-section">
                  <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.check} size={15} />{r('dash.hotelsTitle')}</h3><div className="sub">{r('dash.hotelsSub')}</div></div></div>
                  <div className="pace-table-wrap">
                    <table className="pace-table">
                      <thead>
                        <tr>
                          <th>{r('dash.col.hotel')}</th><th>{r('dash.col.index')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.count')}</th>
                          <th>{r('dash.col.neg')}</th><th>{r('dash.col.response')}</th><th>{r('dash.col.replyTime')}</th><th>{r('dash.col.open')}</th><th>{r('dash.col.topComplaint')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byHotel.map((h) => (
                          <tr key={h.hotelId} style={{ cursor: 'pointer' }} onClick={() => set('hotel', h.hotelId)}>
                            <td><b>{h.name}</b>{h.brand && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{h.brand}</div>}</td>
                            <td><span className="rp-score"><b className={scoreClass(h.reputationIndex != null ? h.reputationIndex / 10 : null, negBelow)}>{fmtRepIndex(h.reputationIndex, lang)}</b></span></td>
                            <td>{fmt(h.avg10)} <Delta v={h.delta} /></td>
                            <td>{h.count}</td>
                            <td>{h.negativeShare != null ? `${h.negativeShare}%` : '—'}</td>
                            <td>{h.responseRate != null ? `${h.responseRate}%` : '—'}</td>
                            <td>{fmtHours(h.medianReplyHours, r)}</td>
                            <td>
                              {h.openNegative ? (
                                <span className="ha-risk-pill bad" onClick={(e) => { e.stopPropagation(); toFeed({ hotelId: h.hotelId, reply: 'none', ratingMax: (negBelow - 0.01).toFixed(2) }); }}>{h.openNegative}</span>
                              ) : '0'}
                            </td>
                            <td style={{ fontSize: 12 }}>{h.topComplaint ? `${topicLabel(h.topComplaint, r, lang)} · ${h.topComplaint.count}` : '—'}</td>
                          </tr>
                        ))}
                        {!data.byHotel.length && <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{r('dash.noData')}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ha-section">
                  <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.chart} size={15} />{r('dash.platformsTitle')}</h3><div className="sub">{r('dash.platformsSub')}</div></div></div>
                  <div className="pace-table-wrap">
                    <table className="pace-table">
                      <thead>
                        <tr><th>{r('dash.col.platform')}</th><th>{r('dash.col.periodCount')}</th><th>{r('dash.col.avg')}</th><th>{r('dash.col.neg')}</th><th>{r('dash.col.response')}</th><th>{r('dash.col.onPlatform')}</th><th>{r('dash.col.inCrm')}</th></tr>
                      </thead>
                      <tbody>
                        {data.byPlatform.map((p) => {
                          const s = data.sources.find((x) => x.platform === p.platform);
                          return (
                            <tr key={p.platform} style={{ cursor: 'pointer' }} onClick={() => set('platform', p.platform)}>
                              <td><PlatformBadge platform={p.platform} /></td>
                              <td>{p.count}</td>
                              <td><Score rating10={p.avg10} negBelow={negBelow} /></td>
                              <td>{p.negativeShare != null ? `${p.negativeShare}%` : '—'}</td>
                              <td>{p.responseRate != null ? `${p.responseRate}%` : <span style={{ color: 'var(--fg-4)' }}>{r('dash.noReplies')}</span>}</td>
                              <td>{p.platformCount != null ? `${p.platformCount}${p.platformRating != null ? ` · ★ ${p.platformRating}` : ''}` : '—'}</td>
                              <td>{s ? s.inCrm : '—'}{s?.failing ? <span className="ha-risk-pill bad" style={{ marginLeft: 6 }}>{r('dash.failing')}</span> : null}</td>
                            </tr>
                          );
                        })}
                        {!data.byPlatform.length && <tr><td colSpan={7} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{r('dash.noData')}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {matrix && matrix.hotels.length > 1 && (
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3>{r('dash.matrixTitle')}</h3><div className="sub">{r('dash.matrixSub')}</div></div></div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="rp-matrix">
                        <thead><tr><th>{r('dash.col.hotel')}</th>{matrix.topics.map((t) => <th key={t.topic}>{topicLabel(t, r, lang)}</th>)}</tr></thead>
                        <tbody>
                          {matrix.hotels.map((h) => (
                            <tr key={h.hotelId}>
                              <td>{h.name}</td>
                              {h.cells.map((c) => {
                                const a = Math.min(1, c.negativePct / 25);
                                return (
                                  <td key={c.topic} title={`${c.negative} − · ${c.positive} +`} style={{ background: c.negative ? `rgba(204,47,71,${0.08 + a * 0.55})` : 'var(--bg-muted)', color: a > 0.6 ? '#fff' : 'var(--ink)' }}>
                                    {c.negative ? `${c.negativePct}%` : '·'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="rp-grid2">
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3>{r('dash.managersTitle')}</h3><div className="sub">{r('dash.managersSub')}</div></div></div>
                    {data.managers.length ? (
                      <table className="pace-table">
                        <thead><tr><th>{r('dash.col.manager')}</th><th>{r('dash.col.replies')}</th><th>{r('dash.col.replyTime')}</th></tr></thead>
                        <tbody>{data.managers.map((m) => <tr key={m.userId}><td>{m.name || '—'}</td><td>{m.replies}</td><td>{fmtHours(m.medianReplyHours, r)}</td></tr>)}</tbody>
                      </table>
                    ) : <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noManagers')}</div>}
                  </div>
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3>{r('dash.otherTitle')}</h3><div className="sub">{r('dash.otherSub')}</div></div></div>
                    {data.otherTopics.length ? (
                      <div className="rp-topics" style={{ marginTop: 0 }}>
                        {data.otherTopics.map((t) => <span key={t.label} className="rp-topic">{t.label} · {t.negative + t.positive + t.neutral}</span>)}
                      </div>
                    ) : <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noOther')}</div>}
                    <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/hotels/reviews/settings?tab=ai')}>{r('dash.extendDictionary')}</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <RepReportModal open={reportOpen} onClose={() => setReportOpen(false)} query={q} scopeText={scopeText} />

        {view === 'report' && (
          <>
            <div className="rp-filters">
              <select value={reportBrand} onChange={(e) => set('rbrand', e.target.value)}>
                {!setup?.brands.length && <option value="">{r('filters.allBrands')}</option>}
                {setup?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={reportMonth} onChange={(e) => set('month', e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'ru-RU', { month: 'long', year: 'numeric' })}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => window.print()}><Ic d={HTL_ICON.download} />{r('dash.print')}</button>
            </div>
            {reportLoading || !report ? (
              <div className="rp-empty">{r('dash.reportLoading')}</div>
            ) : (
              <div className="rp-report">
                <div className="kicker"><span className="dot" />{r('dash.reportKicker')}</div>
                <h2>{report.brand?.name || r('filters.allBrands')} · {report.month}</h2>
                {report.summary && <div className="sum">{report.summary}</div>}
                {report.brandHotels === 0 ? (
                  <div className="rp-note warn">
                    {r('dash.brandNoHotels')}{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/hotels/reviews/settings'); }}>{r('dash.assignBrand')}</a>
                  </div>
                ) : !report.kpis.count && <div className="rp-note">{r('dash.reportEmpty')}</div>}
                <div className="rp-kpis" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.avg')}</div><div className="v">{fmt(report.kpis.avg10)}</div><div className="d"><Delta v={report.kpis.avg10 != null && report.prev.avg10 != null ? report.kpis.avg10 - report.prev.avg10 : null} /></div></div>
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.index')}</div><div className="v">{fmtRepIndex(report.kpis.reputationIndex, lang)}<small>/100</small></div><div className="d"><Delta v={report.kpis.reputationIndex != null && report.prev.reputationIndex != null ? report.kpis.reputationIndex - report.prev.reputationIndex : null} /></div></div>
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.count')}</div><div className="v">{report.kpis.count}</div><div className="d"><Delta v={report.kpis.count - report.prev.count} digits={0} /></div></div>
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.neg')}</div><div className="v">{fmt(report.kpis.negativeShare, 1)}<small>%</small></div></div>
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.response')}</div><div className="v">{fmt(report.kpis.responseRate, 1)}<small>%</small></div></div>
                </div>
                <div className="rp-grid2">
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3 style={{ color: NEG }}>{r('dash.top5')}</h3><div className="sub">{r('dash.top5Sub')}</div></div></div>
                    <TopicBars rows={report.topComplaints} kind="negative" onPick={(t) => toFeed({ topic: t, sentiment: 'negative', brandId: reportBrand })} />
                  </div>
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3>{r('dash.dropped')}</h3><div className="sub">{r('dash.droppedSub')}</div></div></div>
                    {report.droppedHotels.length ? (
                      <div className="rp-bars">
                        {report.droppedHotels.map((h) => (
                          <div key={h.hotelId} className="rp-bar" style={{ gridTemplateColumns: '1fr 70px 60px' }}>
                            <span className="n">{h.name}</span>
                            <span className="v">{fmt(h.avg10)}</span>
                            <span className="v"><Delta v={h.delta} /></span>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noDropped')}</div>}
                  </div>
                </div>
                <div className="ha-section">
                  <div className="ha-section-head"><div><h3>{r('dash.compareTitle')}</h3><div className="sub">{r('dash.compareSub')}</div></div></div>
                  <table className="pace-table">
                    <thead><tr><th>{r('dash.col.hotel')}</th><th>{r('dash.col.index')}</th><th>Δ</th><th>{r('dash.col.avg')}</th><th>Δ</th><th>{r('dash.col.count')}</th><th>{r('dash.col.neg')}</th><th>{r('dash.col.topComplaint')}</th></tr></thead>
                    <tbody>
                      {report.hotels.map((h) => (
                        <tr key={h.hotelId}>
                          <td><b>{h.name}</b></td>
                          <td><span className="rp-score"><b className={scoreClass(h.reputationIndex != null ? h.reputationIndex / 10 : null, negBelow)}>{fmtRepIndex(h.reputationIndex, lang)}</b></span></td>
                          <td><Delta v={h.indexDelta} /></td>
                          <td>{fmt(h.avg10)}</td>
                          <td><Delta v={h.delta} /></td>
                          <td>{h.count}</td>
                          <td>{h.negativeShare != null ? `${h.negativeShare}%` : '—'}</td>
                          <td style={{ fontSize: 12 }}>{h.topComplaint ? `${topicLabel(h.topComplaint, r, lang)} · ${h.topComplaint.count}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rp-note">{r('dash.reportAutoSend')}</div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default ReviewsDashboardPage;
