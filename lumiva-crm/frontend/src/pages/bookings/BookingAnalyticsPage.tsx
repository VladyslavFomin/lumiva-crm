import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import {
  fetchBookingAnalyticsSummary,
  fetchBookingDailyTrend,
  fetchBookingHeatmap,
  fetchBookingTopServices,
  fetchBookingStaffUtilization,
  fetchBookingSources,
  fetchAtRiskCustomers,
  type BookingAnalyticsSummary,
  type DailyTrendPoint,
  type HeatmapPoint,
  type TopServiceRow,
  type StaffUtilizationRow,
  type SourceBreakdownRow,
  type AtRiskCustomerRow,
} from '../../api/bookings';
import './bookings-design.css';

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const LineMini: React.FC<{ points: DailyTrendPoint[] }> = ({ points }) => {
  const { t } = useTranslation();
  if (points.length === 0) {
    return <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.analytics.noDataPeriod')}</div>;
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = points.length > 1 ? 200 / (points.length - 1) : 200;
  const coords = points.map((p, i) => `${i * step},${50 - (p.count / max) * 46}`).join(' ');
  return (
    <svg viewBox="0 0 200 50" width="100%" height="60" preserveAspectRatio="none">
      <polygon points={`0,50 ${coords} 200,50`} fill="#222" opacity="0.06" />
      <polyline points={coords} fill="none" stroke="#222" strokeWidth="1.6" />
    </svg>
  );
};

const Heatmap: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const { t } = useTranslation();
  const hours = Array.from({ length: 12 }, (_, i) => 9 + i);
  const max = Math.max(1, ...points.map((p) => p.count));
  const valueAt = (dow: number, hour: number) => points.find((p) => p.dow === dow && p.hour === hour)?.count || 0;
  const shade = (v: number) => `hsl(0 0% ${96 - Math.min(1, v / max) * 68}%)`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(${hours.length},1fr)`, gap: 4 }}>
        <span />
        {hours.map((h) => <span key={h} style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--fg-3)', textAlign: 'center' }}>{h}:00</span>)}
      </div>
      {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
        <div key={dow} style={{ display: 'grid', gridTemplateColumns: `28px repeat(${hours.length},1fr)`, gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{t(`crm.bookings.analytics.dow.${DOW_KEYS[dow]}`)}</span>
          {hours.map((h) => {
            const v = valueAt(dow, h);
            return <span key={h} title={`${v}`} style={{ aspectRatio: '1/1', borderRadius: 4, background: shade(v) }} />;
          })}
        </div>
      ))}
    </div>
  );
};

export const BookingAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const [periodDays, setPeriodDays] = useState(30);
  const [summary, setSummary] = useState<BookingAnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<DailyTrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [topServices, setTopServices] = useState<TopServiceRow[]>([]);
  const [staffUtil, setStaffUtil] = useState<StaffUtilizationRow[]>([]);
  const [sources, setSources] = useState<SourceBreakdownRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const sourceLabel = (s: string) => (s === 'website' || s === 'phone' || s === 'walkin' || s === 'manual' || s === 'api' || s === 'telegram' ? t(`crm.bookings.source.${s}`) : s);

  const { from, to } = useMemo(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - periodDays * 24 * 60 * 60_000);
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }, [periodDays]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchBookingAnalyticsSummary(from, to),
      fetchBookingDailyTrend(from, to),
      fetchBookingHeatmap(from, to),
      fetchBookingTopServices(from, to),
      fetchBookingStaffUtilization(from, to),
      fetchBookingSources(from, to),
      fetchAtRiskCustomers(60),
    ])
      .then(([s, tr, h, ts, su, src, risk]) => {
        setSummary(s);
        setTrend(tr);
        setHeatmap(h);
        setTopServices(ts);
        setStaffUtil(su);
        setSources(src);
        setAtRisk(risk);
      })
      .catch((e) => showAlert(e.message || t('crm.bookings.analytics.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <MainLayout>
      <PageHelpButton topic="bookingAnalytics" />
      <div className="px-scope">
        <BookingsSubnav active="analytics" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.analytics.kicker', { days: periodDays })}</div>
            <h1>{t('crm.bookings.analytics.title')}</h1>
            <p className="sub">{t('crm.bookings.analytics.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <div className="bk-select" onClick={() => setPeriodDays((p) => (p === 30 ? 7 : 30))}>
              <span className="lbl">{t('crm.bookings.analytics.periodLabel')}</span>{t('crm.bookings.analytics.periodDays', { days: periodDays })}
            </div>
          </div>
        </div>

        {summary && (
          <div className="bk-kpi-grid" style={{ margin: '16px 0' }}>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.analytics.kpis.total')}</div><div className="v">{summary.totalReservations}</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.analytics.kpis.occupancy')}</div><div className="v">{summary.occupancyRate}%</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.analytics.kpis.avgCheck')}</div><div className="v">{summary.avgCheck || '—'}</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.analytics.kpis.noShow')}</div><div className="v">{summary.noShowRate}%</div></div>
          </div>
        )}

        <div className="bk-cols">
          <div>
            <div className="bk-panel" style={{ marginBottom: 16 }}>
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.trendTitle')}</div></div>
              <div className="bk-panel-body" style={{ padding: '10px 18px 16px' }}><LineMini points={trend} /></div>
            </div>
            <div className="bk-panel">
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.heatmapTitle')}</div></div>
              <div className="bk-panel-body" style={{ padding: '12px 18px 16px' }}><Heatmap points={heatmap} /></div>
            </div>
          </div>

          <div>
            <div className="bk-panel" style={{ marginBottom: 16 }}>
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.atRisk.title')}</div><span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.bookings.analytics.atRisk.hint')}</span></div>
              <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                {atRisk.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.analytics.atRisk.empty')}</div>}
                {atRisk.map((c) => (
                  <div key={c.contactId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--line-3)' }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{c.customerName || t('crm.bookings.analytics.atRisk.noName')}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>
                        LTV {c.ltv} ₽ · {t(c.visits === 1 ? 'crm.bookings.analytics.atRisk.visitOne' : 'crm.bookings.analytics.atRisk.visitOther', { count: c.visits })} · {t('crm.bookings.analytics.atRisk.wasVisit', { date: new Date(c.lastVisit).toLocaleDateString(dateLocale) })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bk-panel" style={{ marginBottom: 16 }}>
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.topServices.title')}</div></div>
              <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                {topServices.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.analytics.topServices.empty')}</div>}
                {topServices.map((s) => (
                  <div key={s.serviceId} className="bk-info-row"><span className="l">{s.name} <span style={{ color: 'var(--fg-4)' }}>· {s.count}</span></span><span className="v">{s.revenue} ₽</span></div>
                ))}
              </div>
            </div>

            <div className="bk-panel" style={{ marginBottom: 16 }}>
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.staffUtil.title')}</div></div>
              <div className="bk-panel-body" style={{ padding: '8px 18px 14px' }}>
                {staffUtil.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.analytics.staffUtil.empty')}</div>}
                {staffUtil.map((m) => (
                  <div key={m.staffUserId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0' }}>
                    <span style={{ fontWeight: 500 }}>{m.name}</span>
                    <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{m.count} · {m.revenue} ₽</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bk-panel">
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.analytics.sources.title')}</div></div>
              <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                {sources.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.analytics.sources.empty')}</div>}
                {sources.map((s) => (
                  <div key={s.source} className="bk-info-row"><span className="l">{sourceLabel(s.source)}</span><span className="v">{s.count}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
