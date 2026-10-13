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
  fetchRepDashboard,
  fetchRepMonthlyReport,
  fetchRepSettings,
  fetchRepSetup,
  fetchRepTopicMatrix,
  type RepAiStatus,
  type RepAnalyticsQuery,
  type RepDashboard,
  type RepMonthlyReport,
  type RepSetup,
  type RepTopicStat,
} from '../../../api/hotelReputation';
import { AiStatusBanner, Delta, PLATFORM_META, PlatformBadge, ReputationTabs, Score, fmtHours, scoreClass, useRepT } from './ReputationShared';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate } from '../../../components/ui/DateRangePicker';
import '../hotels-design.css';
import './reputation.css';

const INK = '#222';
const NEG = '#cc2f47';
const POS = '#1f8a5e';
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
const AvgLine: React.FC<{ series: RepDashboard['series']; negBelow: number }> = ({ series, negBelow }) => {
  const { r, lang } = useRepT();
  const [hover, setHover] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 560;
  const H = 150;
  const pts = rows.map((m, i) => ({ ...m, x: rows.length > 1 ? 24 + (i / (rows.length - 1)) * (W - 40) : W / 2 }));
  const vals = pts.filter((p) => p.avg10 != null).map((p) => p.avg10!) as number[];
  if (!vals.length) return <div className="rp-empty">{r('dash.noData')}</div>;
  const lo = Math.max(0, Math.floor(Math.min(...vals, negBelow) - 0.5));
  const hi = Math.min(10, Math.ceil(Math.max(...vals, 8) + 0.3));
  const y = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - 30);
  const line = pts.filter((p) => p.avg10 != null).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.avg10!).toFixed(1)}`).join(' ');
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
        const cx = Math.min(W - 75, Math.max(75, p.x));
        return (
          <g pointerEvents="none">
            <rect x={cx - 75} y={2} width={150} height={34} rx={6} fill="#222" />
            <text x={cx} y={16} fontSize="10" fill="#fff" textAnchor="middle">{bucketTitle(p.bucket, g, lang, r)}</text>
            <text x={cx} y={29} fontSize="10" fill="#fff" textAnchor="middle">{p.avg10 != null ? `${fmt(p.avg10)} / 10` : '—'} · {r('dash.tipReviews', { n: p.count })}</text>
          </g>
        );
      })()}
    </svg>
  );
};

/** Число отзывов по шагам выбранного периода (отдельный график — без второй оси). */
const CountBars: React.FC<{ series: RepDashboard['series'] }> = ({ series }) => {
  const { r, lang } = useRepT();
  const [hover, setHover] = useState<number | null>(null);
  const rows = series.points;
  const g = series.granularity;
  const W = 560;
  const H = 130;
  const max = Math.max(1, ...rows.map((m) => m.count));
  const step = (W - 30) / Math.max(1, rows.length);
  const bw = Math.max(2, Math.min(34, step - (rows.length > 40 ? 2 : 6)));
  const every = tickEvery(rows.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rp-chart" onMouseLeave={() => setHover(null)}>
      {rows.map((m, i) => {
        const x = 24 + i * step;
        const h = (m.count / max) * (H - 40);
        return (
          <g key={m.bucket} onMouseEnter={() => setHover(i)}>
            <rect x={x} y={0} width={step} height={H} fill="transparent" />
            <rect x={x} y={H - 14 - h} width={bw} height={Math.max(1, h)} rx={Math.min(4, bw / 2)} fill={INK} fillOpacity={hover === i ? 1 : 0.85} />
            {i % every === 0 && <text x={x + bw / 2} y={H - 2} fontSize="9" fill="#888" textAnchor="middle">{bucketLabel(m.bucket, g)}</text>}
          </g>
        );
      })}
      {hover != null && rows[hover] && (() => {
        const m = rows[hover];
        const cx = Math.min(W - 75, Math.max(75, 24 + hover * step + bw / 2));
        return (
          <g pointerEvents="none">
            <rect x={cx - 75} y={0} width={150} height={34} rx={6} fill="#222" />
            <text x={cx} y={14} fontSize="10" fill="#fff" textAnchor="middle">{bucketTitle(m.bucket, g, lang, r)} · {r('dash.tipReviews', { n: m.count })}</text>
            <text x={cx} y={27} fontSize="10" fill="#fff" textAnchor="middle">{r('dash.tipNeg', { n: m.negativeShare ?? '—' })}</text>
          </g>
        );
      })()}
    </svg>
  );
};

const TopicBars: React.FC<{ rows: RepTopicStat[]; kind: 'negative' | 'positive'; onPick: (topic: string) => void }> = ({ rows, kind, onPick }) => {
  const { r } = useRepT();
  const max = Math.max(1, ...rows.map((t) => t[kind]));
  if (!rows.length) return <div style={{ color: 'var(--fg-4)', fontSize: 12.5, fontStyle: 'italic' }}>{r('dash.noTopics')}</div>;
  return (
    <div className="rp-bars">
      {rows.map((t) => {
        const quotes = kind === 'negative' ? t.negQuotes : t.posQuotes;
        return (
          <div key={`${t.topic}-${t.label}`} className="rp-bar" title={quotes.map((q) => `«${q}»`).join('\n')}>
            <span className="n" onClick={() => onPick(t.topic)}>{t.label}</span>
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
  const view = params.get('view') === 'report' ? 'report' : 'overview';

  // период: пресет (7/14/30/90/365/all) или свой диапазон — как в продажах
  const preset = params.get('preset') || (params.get('from') ? 'custom' : '90');
  const q = useMemo((): RepAnalyticsQuery => {
    const base = { brandId: params.get('brand') || undefined, hotelId: params.get('hotel') || undefined, platform: params.get('platform') || undefined };
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
              <select value={q.brandId || ''} onChange={(e) => set('brand', e.target.value || null)}>
                <option value="">{r('filters.allBrands')}</option>
                {setup?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={q.hotelId || ''} onChange={(e) => set('hotel', e.target.value || null)}>
                <option value="">{r('filters.allHotels')}</option>
                {(q.brandId ? hotels.filter((h) => h.brandId === q.brandId) : hotels).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <select value={q.platform || ''} onChange={(e) => set('platform', e.target.value || null)}>
                <option value="">{r('filters.allPlatforms')}</option>
                {REP_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
              </select>
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
                <div data-tour="rvd-kpis" className="rp-kpis">
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.avgHint')}>{r('dash.kpi.avg')}</span></div>
                    <div className="v">{fmt(k!.avg10)}<small>/10</small></div>
                    <div className="d"><Delta v={k!.delta?.avg10} /></div>
                  </div>
                  <div className="ha-kpi">
                    <div className="l"><span title={r('dash.kpi.indexHint')}>{r('dash.kpi.index')}</span></div>
                    <div className="v">{fmt(k!.reputationIndex)}<small>/10</small></div>
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
                    {data.series.points.length ? <AvgLine series={data.series} negBelow={negBelow} /> : <div className="rp-empty">{r('dash.noData')}</div>}
                  </div>
                  <div className="ha-section">
                    <div className="ha-section-head"><div><h3><Ic d={HTL_ICON.calendar} size={15} />{r('dash.countTitleP')}</h3><div className="sub">{r('dash.countSub', { step: r(`dash.step.${data.series.granularity}`) })}</div></div></div>
                    {data.series.points.length ? <CountBars series={data.series} /> : <div className="rp-empty">{r('dash.noData')}</div>}
                  </div>
                </div>

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
                            <td><Score rating10={h.reputationIndex} negBelow={negBelow} /></td>
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
                            <td style={{ fontSize: 12 }}>{h.topComplaint ? `${h.topComplaint.label} · ${h.topComplaint.count}` : '—'}</td>
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
                        <thead><tr><th>{r('dash.col.hotel')}</th>{matrix.topics.map((t) => <th key={t.topic}>{t.label}</th>)}</tr></thead>
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
                  <div className="ha-kpi"><div className="l">{r('dash.kpi.index')}</div><div className="v">{fmt(report.kpis.reputationIndex)}</div><div className="d"><Delta v={report.kpis.reputationIndex != null && report.prev.reputationIndex != null ? report.kpis.reputationIndex - report.prev.reputationIndex : null} /></div></div>
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
                          <td><span className={`rp-score`}><b className={scoreClass(h.reputationIndex, negBelow)}>{fmt(h.reputationIndex)}</b></span></td>
                          <td><Delta v={h.indexDelta} /></td>
                          <td>{fmt(h.avg10)}</td>
                          <td><Delta v={h.delta} /></td>
                          <td>{h.count}</td>
                          <td>{h.negativeShare != null ? `${h.negativeShare}%` : '—'}</td>
                          <td style={{ fontSize: 12 }}>{h.topComplaint ? `${h.topComplaint.label} · ${h.topComplaint.count}` : '—'}</td>
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
