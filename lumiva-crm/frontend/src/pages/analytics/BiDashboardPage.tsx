// src/pages/analytics/BiDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MainLayout } from '../../layout/MainLayout';
import { LottieIcon } from '../../components/LottieIcon';
import { fetchBiDashboardSummary, type BiDashboardSummary, type BiTrend, type CurrencyAmount } from '../../api/biDashboard';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, BI_ICON } from './BiDashboardIcons';
import '../telephony/telephony-design.css';
import './bi-dashboard-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const formatAmounts = (amounts: CurrencyAmount[]): string => {
  if (amounts.length === 0) return '—';
  return amounts
    .map((a) => `${a.amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ${a.currency}`)
    .join(' + ');
};

const trendArrow = (t: BiTrend) => (t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '–');
const trendClass = (t: BiTrend) => (t.direction === 'up' ? 'up' : t.direction === 'down' ? 'down' : undefined);

const Spark: React.FC<{ data: number[]; color?: string; height?: number }> = ({ data, color = '#222', height = 32 }) => {
  if (!data.length) return null;
  const w = 160;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const LineChart: React.FC<{ series: Array<{ data: number[]; color: string; label: string }>; labels: string[]; width?: number; height?: number }> = ({ series, labels, width = 900, height = 140 }) => {
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allVals);
  const niceMax = Math.ceil(max / 5) * 5 || 1;
  const padL = 26, padB = 18, padT = 8;
  const innerW = width - padL, innerH = height - padB - padT;
  const n = series[0]?.data.length || 1;
  const xAt = (i: number) => padL + (n > 1 ? (i / (n - 1)) * innerW : 0);
  const yAt = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const gridVals = [0, niceMax / 2, niceMax];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={width} y1={yAt(g)} y2={yAt(g)} stroke="var(--line-3)" strokeWidth="1" />
          <text x={0} y={yAt(g) + 3} fontSize="8.5" fill="var(--fg-3)" fontFamily="var(--ff-mono)">{Math.round(g)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const path = s.data.map((v, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1)).join(' ');
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.5" />
            {s.data.length > 0 && <circle cx={xAt(n - 1)} cy={yAt(s.data[n - 1])} r="2.5" fill={s.color} />}
          </g>
        );
      })}
      {labels.map((l, i) => (i % 5 === 0) && (
        <text key={i} x={xAt(i)} y={height - 2} fontSize="8.5" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--ff-mono)">{l}</text>
      ))}
    </svg>
  );
};

const MODULE_COLORS: Record<string, string> = {
  leads: '#3b6cb6',
  sales: '#1f8a5e',
  products: '#5a45a8',
  bookings: '#a06b1a',
  hotels: '#7a4fc9',
  telephony: '#cc2f47',
  marketing: '#1a7a8a',
};

function downloadCsv(data: BiDashboardSummary, t: TFunction) {
  const rows = [
    [t('crm.bi.modulesSection.heading'), t('crm.bi.hero.export'), ''],
    [t('crm.bi.modules.leads.name'), String(data.leads.total), `${t('crm.bi.modules.leads.kpiConversion')} ${data.leads.conversionRate}%`],
    [t('crm.bi.modules.sales.name'), formatAmounts(data.sales.revenue), `${data.sales.confirmed}`],
    [t('crm.bi.modules.products.name'), formatAmounts(data.products.inventoryValue), `${data.products.lowStockCount}`],
    [t('crm.bi.modules.bookings.name'), formatAmounts(data.bookings.revenue), `${data.bookings.completed}`],
    [t('crm.bi.modules.hotels.name'), formatAmounts(data.hotels.revenue), `${data.hotels.total}`],
    [t('crm.bi.modules.telephony.name'), String(data.telephony.calls), `SMS ${data.telephony.sms}`],
    [
      t('crm.bi.marketing.heading'),
      formatAmounts(data.marketing.spend),
      `${data.marketing.connectedChannels}, ${data.marketing.campaigns}, ${data.marketing.countries}`,
    ],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bi-dashboard-${data.period.days}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const BiDashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<BiDashboardSummary | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';

  useEffect(() => {
    setLoading(true);
    fetchBiDashboardSummary(days)
      .then(setData)
      .catch((e) => showAlert(e?.message || t('crm.bi.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (loading || !data) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
            <div className="flex justify-center">
              <LottieIcon name="mini-dashboard" size={110} />
            </div>
            <div style={{ marginTop: 4 }}>{t('crm.bi.loading')}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const dayLabels = data.dailyTrend.map((d) => new Date(d.date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }));
  const series = [
    { key: 'leads', label: t('crm.bi.modules.leads.name'), color: MODULE_COLORS.leads, data: data.dailyTrend.map((d) => d.leads) },
    { key: 'sales', label: t('crm.bi.modules.sales.name'), color: MODULE_COLORS.sales, data: data.dailyTrend.map((d) => d.sales) },
    { key: 'bookings', label: t('crm.bi.modules.bookings.name'), color: MODULE_COLORS.bookings, data: data.dailyTrend.map((d) => d.bookings) },
    { key: 'hotels', label: t('crm.bi.modules.hotels.name'), color: MODULE_COLORS.hotels, data: data.dailyTrend.map((d) => d.hotels) },
    { key: 'calls', label: t('crm.bi.modules.telephony.kpiCalls'), color: MODULE_COLORS.telephony, data: data.dailyTrend.map((d) => d.calls) },
  ];

  const modules = [
    {
      key: 'leads',
      name: t('crm.bi.modules.leads.name'),
      icon: BI_ICON.leads,
      link: '/app/leads/analytics',
      color: MODULE_COLORS.leads,
      spark: series[0].data,
      kpis: [
        { l: t('crm.bi.modules.leads.kpiCount', { days }), v: `${data.leads.total}` },
        { l: t('crm.bi.modules.leads.kpiConversion'), v: `${data.leads.conversionRate}`, u: '%' },
        { l: t('crm.bi.modules.leads.kpiInProgress'), v: `${data.leads.openPipeline}` },
      ],
      foot: t('crm.bi.modules.leads.foot', { arrow: trendArrow(data.leads.trend), pct: data.leads.trend.pct }),
      footClass: trendClass(data.leads.trend),
    },
    {
      key: 'sales',
      name: t('crm.bi.modules.sales.name'),
      icon: BI_ICON.sales,
      link: '/app/sales/analytics',
      color: MODULE_COLORS.sales,
      spark: series[1].data,
      kpis: [
        { l: t('crm.bi.modules.sales.kpiCount'), v: `${data.sales.confirmed}` },
        { l: t('crm.bi.modules.sales.kpiRevenue'), v: formatAmounts(data.sales.revenue) },
        { l: t('crm.bi.modules.sales.kpiAvgDeal'), v: formatAmounts(data.sales.avgDeal) },
      ],
      foot: t('crm.bi.modules.sales.foot', { arrow: trendArrow(data.sales.trend), pct: data.sales.trend.pct }),
      footClass: trendClass(data.sales.trend),
    },
    {
      key: 'products',
      name: t('crm.bi.modules.products.name'),
      icon: BI_ICON.products,
      link: '/app/products/analytics',
      color: MODULE_COLORS.products,
      spark: [] as number[],
      kpis: [
        { l: t('crm.bi.modules.products.kpiActive'), v: `${data.products.activeCount}` },
        { l: t('crm.bi.modules.products.kpiStock'), v: formatAmounts(data.products.inventoryValue) },
        { l: t('crm.bi.modules.products.kpiLowStock'), v: `${data.products.lowStockCount}` },
      ],
      foot: data.products.lowStockCount > 0
        ? t('crm.bi.modules.products.footWarn', { count: data.products.lowStockCount })
        : t('crm.bi.modules.products.footOk'),
      footClass: data.products.lowStockCount > 0 ? 'warn' : undefined,
    },
    {
      key: 'bookings',
      name: t('crm.bi.modules.bookings.name'),
      icon: BI_ICON.bookings,
      link: '/bookings/analytics',
      color: MODULE_COLORS.bookings,
      spark: series[2].data,
      kpis: [
        { l: t('crm.bi.modules.bookings.kpiCount'), v: `${data.bookings.total}` },
        { l: t('crm.bi.modules.bookings.kpiCompleted'), v: `${data.bookings.completed}` },
        { l: t('crm.bi.modules.bookings.kpiRevenue'), v: formatAmounts(data.bookings.revenue) },
      ],
      foot: t('crm.bi.modules.bookings.foot', { arrow: trendArrow(data.bookings.trend), pct: data.bookings.trend.pct }),
      footClass: trendClass(data.bookings.trend),
    },
    {
      key: 'hotels',
      name: t('crm.bi.modules.hotels.name'),
      icon: BI_ICON.hotels,
      link: '/hotels/analytics',
      color: MODULE_COLORS.hotels,
      spark: series[3].data,
      kpis: [
        { l: t('crm.bi.modules.hotels.kpiCount'), v: `${data.hotels.total}` },
        { l: t('crm.bi.modules.hotels.kpiCancelled'), v: `${data.hotels.cancelled}` },
        { l: t('crm.bi.modules.hotels.kpiRevenue'), v: formatAmounts(data.hotels.revenue) },
      ],
      foot: t('crm.bi.modules.hotels.foot', { arrow: trendArrow(data.hotels.trend), pct: data.hotels.trend.pct }),
      footClass: trendClass(data.hotels.trend),
    },
    {
      key: 'telephony',
      name: t('crm.bi.modules.telephony.name'),
      icon: BI_ICON.telephony,
      link: '/app/telephony/analytics',
      color: MODULE_COLORS.telephony,
      spark: series[4].data,
      kpis: data.telephony.enabled
        ? [
            { l: t('crm.bi.modules.telephony.kpiCalls'), v: `${data.telephony.calls}` },
            { l: t('crm.bi.modules.telephony.kpiPickup'), v: `${data.telephony.pickupRate}`, u: '%' },
            { l: t('crm.bi.modules.telephony.kpiSms'), v: `${data.telephony.sms}` },
          ]
        : [{ l: t('crm.bi.modules.telephony.kpiSms'), v: `${data.telephony.sms}` }],
      foot: data.telephony.enabled
        ? t('crm.bi.modules.telephony.foot', { arrow: trendArrow(data.telephony.trend), pct: data.telephony.trend.pct })
        : t('crm.bi.modules.telephony.disabled'),
      footClass: data.telephony.enabled ? trendClass(data.telephony.trend) : undefined,
    },
  ];

  const maxChannel = Math.max(1, ...data.channels.map((c) => c.count));
  const maxFunnel = Math.max(1, data.funnel[0]?.value || 1);

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bi.hero.kicker', { days })}</div>
            <h1>{t('crm.nav.biDashboard', 'BI-дашборд')}</h1>
            <p className="sub">{t('crm.bi.hero.subtitle')}</p>
          </div>
          <div className="tel-hero-r">
            <button className="btn btn-sm" onClick={() => downloadCsv(data, t)}><Ic d={BI_ICON.download} size={13} />{t('crm.bi.hero.export')}</button>
            {[30, 90].map((d) => (
              <button key={d} className={'btn btn-sm' + (days === d ? ' btn-primary' : '')} onClick={() => setDays(d)}>
                {t('crm.bi.hero.periodDays', { days: d })}
              </button>
            ))}
          </div>
        </div>

        <div className="ha-kpis">
          <div className="ha-kpi">
            <div className="l">{t('crm.bi.kpis.touches')}</div>
            <div className="v">{data.totals.touches.toLocaleString(dateLocale)}</div>
            <div className={cx('d', trendClass(data.totals.touchesTrend))}>{trendArrow(data.totals.touchesTrend)} {data.totals.touchesTrend.pct}% · {t('crm.bi.kpis.touchesSub')}</div>
          </div>
          <div className="ha-kpi">
            <div className="l">{t('crm.bi.kpis.activeClients')}</div>
            <div className="v">{data.totals.activeClients.toLocaleString(dateLocale)}</div>
            <div className="d">{t('crm.bi.kpis.activeClientsSub')}</div>
          </div>
          <div className="ha-kpi">
            <div className="l">{t('crm.bi.kpis.attention')}</div>
            <div className="v">{data.totals.attentionCount}</div>
            <div className={cx('d', data.totals.attentionCount > 0 && 'warn')}>
              {data.totals.attentionCount > 0 ? t('crm.bi.kpis.attentionSubRisks') : t('crm.bi.kpis.attentionSubNone')}
            </div>
          </div>
          <div className="ha-kpi">
            <div className="l">{t('crm.bi.kpis.sentiment')}</div>
            <div className="v">{data.totals.avgSentiment === null ? '—' : (data.totals.avgSentiment > 0 ? '+' : '') + data.totals.avgSentiment}</div>
            <div className="d">{t('crm.bi.kpis.sentimentSub')}</div>
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3><Ic d={BI_ICON.analytics} size={15} />{t('crm.bi.modulesSection.heading')}</h3>
              <div className="sub">{t('crm.bi.modulesSection.sub')}</div>
            </div>
          </div>
          <div className="bi-modules">
            {modules.map((m) => (
              <Link to={m.link} key={m.key} className="bi-mod">
                <div className="bi-mod-head">
                  <div className="bi-mod-name"><span className="ic"><Ic d={m.icon} size={14} /></span>{m.name}</div>
                  <span className="bi-mod-link"><Ic d={BI_ICON.chevR} size={14} /></span>
                </div>
                <div className="bi-mod-sub">{t('crm.bi.modulesSection.openFull')}</div>
                <div className="bi-mod-kpis">
                  {m.kpis.map((k) => (
                    <div key={k.l} className="bi-mod-kpi">
                      <div className="l">{k.l}</div>
                      <div className="v">{k.v}{'u' in k && k.u && <small>{k.u}</small>}</div>
                    </div>
                  ))}
                </div>
                {m.spark.length > 0 && <div className="bi-mod-spark"><Spark data={m.spark} color={m.color} /></div>}
                <div className="bi-mod-foot"><span className={m.footClass}>{m.foot}</span></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3><Ic d={BI_ICON.marketing} size={15} />{t('crm.bi.marketing.heading')}</h3>
              <div className="sub">
                {t('crm.bi.marketing.subtitle', {
                  channels: data.marketing.connectedChannels,
                  spend: formatAmounts(data.marketing.spend),
                  campaigns: data.marketing.campaigns,
                  countries: data.marketing.countries,
                })}
              </div>
            </div>
            <Link to="/marketing/channels" className="btn btn-sm">{t('crm.bi.marketing.allChannels')}</Link>
          </div>
          {data.marketing.channels.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.bi.marketing.empty')}</div>
          ) : (
            <div className="bi-team">
              {data.marketing.channels.map((c) => (
                <div key={c.provider} className="bi-team-row">
                  <span className="bi-team-rank" style={{ color: c.connected ? '#1f8a5e' : 'var(--fg-4)' }}>●</span>
                  <span className="bi-team-name">
                    <span className="ava">
                      {c.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <span className="nm">
                        {c.name}
                        <span className={cx('ha-risk-pill', c.connected ? 'ok' : 'warn')} style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                          {c.connected ? t('crm.bi.marketing.connected') : t('crm.bi.marketing.disconnected')}
                        </span>
                      </span>
                      <div className="bi-team-chips">
                        <span className="bi-team-chip">{t('crm.bi.marketing.campaigns')} · {c.campaigns}</span>
                        <span className="bi-team-chip">
                          {t('crm.bi.marketing.countries')} · {c.countries > 0 ? c.topCountries.join(', ') : '—'}
                        </span>
                        {(() => {
                          if (!c.connected) return null;
                          const daysSince = c.lastDataDate
                            ? Math.floor((Date.now() - new Date(c.lastDataDate).getTime()) / 86400000)
                            : null;
                          if (daysSince === null) {
                            return <span className="bi-team-chip" style={{ color: '#b0233a' }}>{t('crm.bi.marketing.noSyncData')}</span>;
                          }
                          if (daysSince > 30) {
                            return (
                              <span className="bi-team-chip" style={{ color: '#b0233a' }}>
                                {t('crm.bi.marketing.staleSyncData', { date: new Date(c.lastDataDate!).toLocaleDateString(dateLocale) })}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {t('crm.bi.marketing.spent')}
                    </div>
                    <div style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.01em', marginTop: 2, whiteSpace: 'nowrap' }}>
                      {formatAmounts(c.spend)}
                    </div>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>{t('crm.bi.activity.heading')}</h3>
              <div className="sub">{t('crm.bi.activity.sub')}</div>
            </div>
          </div>
          <LineChart series={series} labels={dayLabels} />
          <div className="bi-combined-legend">
            {series.map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.label} — {s.data.reduce((a, b) => a + b, 0)} {t('crm.bi.activity.legendSuffix')}</span>
            ))}
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3><Ic d={BI_ICON.chat} size={15} />{t('crm.bi.channels.heading')}</h3>
              <div className="sub">{t('crm.bi.channels.sub')}</div>
            </div>
          </div>
          {data.channels.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.bi.channels.empty')}</div>}
          {data.channels.map((c) => (
            <div key={c.key} className="rev-bar-row">
              <span style={{ color: 'var(--fg-3)' }}>{c.label}</span>
              <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: (c.count / maxChannel * 100) + '%', background: 'var(--ink)' }} /></span>
              <span className="rev-bar-val">{c.count}</span>
            </div>
          ))}
        </div>

        <div className="bi-two-col">
          <div className="ha-section" style={{ marginBottom: 0, minWidth: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.funnel} size={15} />{t('crm.bi.funnel.heading')}</h3>
                <div className="sub">{t('crm.bi.funnel.sub')}</div>
              </div>
            </div>
            {data.funnel.map((s) => (
              <div key={s.key} className="rev-bar-row">
                <span style={{ color: 'var(--fg-3)' }}>{s.label}</span>
                <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: (s.value / maxFunnel * 100) + '%', background: MODULE_COLORS.leads }} /></span>
                <span className="rev-bar-val">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="ha-section" style={{ marginBottom: 0, minWidth: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.companies} size={15} />{t('crm.bi.topCompanies.heading')}</h3>
                <div className="sub">{t('crm.bi.topCompanies.sub')}</div>
              </div>
            </div>
            {data.topCompanies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.bi.topCompanies.empty')}</div>
            ) : (
              <div className="pace-table-wrap bi-co-table-wrap">
                <table className="pace-table bi-co-table">
                  <thead>
                    <tr>
                      <th>{t('crm.bi.topCompanies.colCompany')}</th>
                      <th>{t('crm.bi.topCompanies.colLeads')}</th>
                      <th>{t('crm.bi.topCompanies.colProjects')}</th>
                      <th>{t('crm.bi.topCompanies.colRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCompanies.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td style={{ color: 'var(--fg-3)' }}>{c.leads}</td>
                        <td>{c.projects}</td>
                        <td className="need low">{c.revenue.toLocaleString(dateLocale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bi-two-col-wide">
          <div className="ha-section" style={{ marginBottom: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.flag} size={15} />{t('crm.bi.alerts.heading')}</h3>
                <div className="sub">{t('crm.bi.alerts.sub')}</div>
              </div>
            </div>
            <div className="bi-alerts">
              {data.alerts.map((a, i) => (
                <Link key={i} className="bi-alert" to={a.link}>
                  <span className={cx('ha-risk-pill', a.risk)}>
                    {a.risk === 'bad' ? t('crm.bi.alerts.riskBad') : a.risk === 'warn' ? t('crm.bi.alerts.riskWarn') : t('crm.bi.alerts.riskOk')}
                  </span>
                  <span className="bi-alert-mod">{a.module}</span>
                  <span className="bi-alert-txt">{a.text}</span>
                  <span className="bi-alert-link">{t('crm.bi.alerts.open')}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="ha-section" style={{ marginBottom: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.staff} size={15} />{t('crm.bi.team.heading')}</h3>
                <div className="sub">{t('crm.bi.team.sub')}</div>
              </div>
            </div>
            {data.team.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.bi.team.empty')}</div>
            ) : (
              <div className="bi-team">
                {data.team.map((tm, i) => (
                  <div key={tm.id} className="bi-team-row">
                    <span className="bi-team-rank">#{i + 1}</span>
                    <span className="bi-team-name">
                      <span className="ava">{tm.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span>
                        <span className="nm">{tm.name}</span>
                        <div className="bi-team-chips">
                          {tm.leads > 0 && <span className="bi-team-chip">{t('crm.bi.team.leads')} · {tm.leads}</span>}
                          {tm.calls > 0 && <span className="bi-team-chip">{t('crm.bi.team.calls')} · {tm.calls}</span>}
                          {tm.bookings > 0 && <span className="bi-team-chip">{t('crm.bi.team.bookings')} · {tm.bookings}</span>}
                        </div>
                      </span>
                    </span>
                    <span className="bi-team-delta">{tm.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
