// src/pages/sales/SalesPaymentsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  listPayments,
  fetchPaymentsAnalytics,
  type PaymentListItemDto,
  type PaymentsAnalytics,
} from '../../api/payments';
import { IntegrationBrandIcon } from '../automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../automations/integrationsCatalog';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './payments-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const PROVIDER_IDS = ['iyzico', 'paytr', 'yookassa'] as const;

const LineChart: React.FC<{
  series: Array<{ data: number[]; color: string }>;
  labels: string[];
  width?: number;
  height?: number;
}> = ({ series, labels, width = 720, height = 130 }) => {
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
      {labels.map((l, i) => (i % 3 === 0) && (
        <text key={i} x={xAt(i)} y={height - 2} fontSize="8.5" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--ff-mono)">{l}</text>
      ))}
    </svg>
  );
};

const BarRow: React.FC<{ label: string; val: number; max: number; color?: string }> = ({ label, val, max, color = '#222' }) => (
  <div className="rev-bar-row">
    <span style={{ color: 'var(--fg-3)' }}>{label}</span>
    <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: max ? (val / max * 100) + '%' : '0%', background: color }} /></span>
    <span className="rev-bar-val">{val}</span>
  </div>
);

type StatusFilter = 'all' | 'paid' | 'pending' | 'failed';

export const SalesPaymentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const [analytics, setAnalytics] = useState<PaymentsAnalytics | null>(null);
  const [items, setItems] = useState<PaymentListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const PAGE_SIZE = 30;

  const loadAnalytics = () => {
    fetchPaymentsAnalytics(30)
      .then(setAnalytics)
      .catch((e) => showAlert(e?.message || t('crm.sales.payments.errors.load'), { variant: 'error' }));
  };

  const loadItems = async (offset: number) => {
    const res = await listPayments({
      status: statusFilter === 'all' ? undefined : statusFilter,
      provider: providerFilter === 'all' ? undefined : providerFilter,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset,
    });
    if (offset === 0) setItems(res.items);
    else setItems((prev) => [...prev, ...res.items]);
    setTotal(res.total);
  };

  useEffect(() => { loadAnalytics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    loadItems(0)
      .catch((e) => showAlert(e?.message || t('crm.sales.payments.errors.load'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, providerFilter]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadItems(items.length);
    } catch (e: any) {
      showAlert(e?.message || t('crm.sales.payments.errors.load'), { variant: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };

  const dayLabels = useMemo(
    () => (analytics?.dailySeries || []).map((d) => new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })),
    [analytics],
  );
  const createdSeries = (analytics?.dailySeries || []).map((d) => d.created);
  const paidSeries = (analytics?.dailySeries || []).map((d) => d.paid);
  const failedSeries = (analytics?.dailySeries || []).map((d) => d.failed);
  const maxProviderTotal = Math.max(1, ...(analytics?.byProvider || []).map((p) => p.totalCount));

  const statusLabel = (s: string) => t(`crm.sales.payments.status.${s}`, { defaultValue: s });
  const providerLabel = (id: string) => integrationCatalogName(id, t);

  return (
    <MainLayout>
      <PageHelpButton topic="salesPayments" />
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.sales.payments.kicker')}</div>
            <h1>{t('crm.sales.payments.title')}</h1>
            <p className="sub">{t('crm.sales.payments.subtitle')}</p>
          </div>
        </div>

        {analytics && (
          <div className="tel-kpis">
            <div className="tel-kpi"><div className="l">{t('crm.sales.payments.kpi.total')}</div><div className="v">{analytics.totalCount}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.sales.payments.kpi.paid')}</div><div className="v">{analytics.paidCount}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.sales.payments.kpi.failed')}</div><div className="v">{analytics.failedCount}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.sales.payments.kpi.pending')}</div><div className="v">{analytics.pendingCount}</div></div>
            <div className="tel-kpi"><div className="l">{t('crm.sales.payments.kpi.successRate')}</div><div className="v">{analytics.successRate}%</div></div>
          </div>
        )}

        {analytics && analytics.byCurrency.length > 0 && (
          <div className="ha-section">
            <div className="ha-section-head">
              <div>
                <h3>{t('crm.sales.payments.paidAmount')}</h3>
                <div className="sub">{t('crm.sales.payments.last30days')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {analytics.byCurrency.map((c) => (
                <div key={c.currency}>
                  <div style={{ fontFamily: 'var(--ff-display)', fontSize: 21, fontWeight: 600 }}>
                    {c.paidAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {c.currency}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.sales.payments.paymentsCount', { count: c.paidCount })}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics && (
          <div className="ha-section">
            <div className="ha-section-head">
              <div>
                <h3>{t('crm.sales.payments.dynamics')}</h3>
                <div className="sub">{t('crm.sales.payments.dynamicsSub', { days: analytics.dailySeries.length })}</div>
              </div>
            </div>
            <LineChart
              series={[
                { data: createdSeries, color: '#888' },
                { data: paidSeries, color: '#1f8a5e' },
                { data: failedSeries, color: '#cc2f47' },
              ]}
              labels={dayLabels}
            />
            <div className="pace-legend">
              <span><i style={{ background: '#888' }} />{t('crm.sales.payments.legendCreated')}</span>
              <span><i style={{ background: '#1f8a5e' }} />{t('crm.sales.payments.legendPaid')}</span>
              <span><i style={{ background: '#cc2f47' }} />{t('crm.sales.payments.legendFailed')}</span>
            </div>
          </div>
        )}

        {analytics && analytics.byProvider.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: analytics.recentFailures.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div className="ha-section" style={{ marginBottom: 0 }}>
              <div className="ha-section-head">
                <div>
                  <h3>{t('crm.sales.payments.byProvider')}</h3>
                  <div className="sub">{t('crm.sales.payments.byProviderSub')}</div>
                </div>
              </div>
              {analytics.byProvider.map((p) => (
                <BarRow key={p.provider} label={providerLabel(p.provider)} val={p.totalCount} max={maxProviderTotal} />
              ))}
            </div>

            {analytics.recentFailures.length > 0 && (
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3>{t('crm.sales.payments.recentFailures')}</h3>
                    <div className="sub">{t('crm.sales.payments.recentFailuresSub')}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {analytics.recentFailures.map((f) => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, borderBottom: '1px solid var(--line-3)', paddingBottom: 6 }}>
                      <span style={{ color: 'var(--fg-3)' }}>{providerLabel(f.provider)} · {new Date(f.createdAt).toLocaleDateString()}</span>
                      <span style={{ color: '#c0392b', textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.failReason || ''}>
                        {f.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {f.currency} — {f.failReason || t('crm.sales.payments.status.failed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, margin: '20px 0 14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="bk-search" style={{ flex: '1 1 240px', maxWidth: 320 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>
            <input placeholder={t('crm.sales.payments.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bk-savedviews">
            {(['all', 'paid', 'pending', 'failed'] as StatusFilter[]).map((s) => (
              <div key={s} className={cx('bk-sv-tab', statusFilter === s && 'active')} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? t('crm.sales.payments.filterAll') : statusLabel(s)}
              </div>
            ))}
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            style={{ border: '1px solid var(--line-2)', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: '#fff' }}
          >
            <option value="all">{t('crm.sales.payments.filterAllProviders')}</option>
            {PROVIDER_IDS.map((p) => (
              <option key={p} value={p}>{providerLabel(p)}</option>
            ))}
          </select>
        </div>

        <div className="bk-table-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1.6fr 1fr 110px 100px 130px', gap: 12, padding: '9px 14px', fontSize: 10.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-muted)' }}>
            <span></span>
            <span>{t('crm.sales.payments.col.buyer')}</span>
            <span>{t('crm.sales.payments.col.provider')}</span>
            <span>{t('crm.sales.payments.col.amount')}</span>
            <span>{t('crm.sales.payments.col.status')}</span>
            <span>{t('crm.sales.payments.col.date')}</span>
          </div>
          {!loading && items.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.sales.payments.empty')}</div>
          )}
          {items.map((p) => (
            <div
              key={p.id}
              className="pay-row"
              onClick={() => { if (p.saleId) navigate(`/sales/${p.saleId}`); }}
              style={{ cursor: p.saleId ? 'pointer' : 'default' }}
            >
              <IntegrationBrandIcon catalogId={p.provider} label={providerLabel(p.provider)} size={32} className="pay-icon" />
              <div>
                <div className="pay-name">{p.buyerName || t('crm.sales.payments.unknownBuyer')}</div>
                <div className="pay-sub">{p.saleOrderNo || p.id.slice(0, 8)}</div>
              </div>
              <div style={{ fontSize: 12.5 }}>{providerLabel(p.provider)}</div>
              <div className="pay-amount">{p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.currency}</div>
              <div><span className={cx('pay-status', p.status)}>{statusLabel(p.status)}</span></div>
              <div className="pay-date">{new Date(p.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {items.length < total && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn" onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? t('crm.sales.payments.loading') : t('crm.sales.payments.loadMore', { count: total - items.length })}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
