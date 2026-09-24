// src/pages/analytics/CompaniesAnalyticsPage.tsx
// Редизайн по мокапу Claude Design (companies-analytics.html / components/companies-analytics.jsx).
// Реальные данные из AllCompaniesAnalytics (perCompany уже сконвертирован в primaryCurrency
// тенанта — см. companies.service.ts getAllCompaniesAnalytics) + fetchCompanies для имени/отрасли.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { fetchAllCompaniesAnalytics, fetchCompanies, type AllCompaniesAnalytics, type Company } from '../../api/companies';
import { cl, money, Ic, LIC } from '../contacts/CrmListShared';
import { industryLabel } from '../contacts/CrmFormShared';
import '../contacts/crm-lists-design.css';
import './companies-analytics-design.css';

type MetricKey = 'revenue' | 'projects' | 'leads';

type Row = {
  companyId: string;
  name: string;
  industry: string;
  revenue: number;
  potential: number;
  projects: number;
  leads: number;
  won: number;
};

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const CompaniesAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AllCompaniesAnalytics | null>(null);
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<MetricKey>('revenue');
  const [period, setPeriod] = useState('quarter');
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchAllCompaniesAnalytics(), fetchCompanies({ limit: 2000 })])
      .then(([a, c]) => {
        if (!alive) return;
        setAnalytics(a);
        const map: Record<string, Company> = {};
        c.items.forEach((co) => (map[co.id] = co));
        setCompaniesMap(map);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e.message || t('crm.companies.analytics.errors.loadFailed'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const currency = analytics?.summary.currency || 'EUR';
  const cur = (v: number) => `${money(Math.round(v))} ${currency}`;
  const pct = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';

  const METRICS: Array<[MetricKey, string, (v: number) => string | number]> = [
    ['revenue', t('crm.companies.analytics.metrics.revenue'), (v) => cur(v)],
    ['projects', t('crm.companies.analytics.metrics.projects'), (v) => v],
    ['leads', t('crm.companies.analytics.metrics.leads'), (v) => v],
  ];

  const PERIODS: Array<[string, string]> = [
    ['month', t('crm.companies.analytics.periods.month')],
    ['quarter', t('crm.companies.analytics.periods.quarter')],
    ['halfYear', t('crm.companies.analytics.periods.halfYear')],
    ['year', t('crm.companies.analytics.periods.year')],
    ['allTime', t('crm.companies.analytics.periods.allTime')],
  ];

  const rows: Row[] = useMemo(
    () =>
      (analytics?.perCompany || []).map((p) => ({
        companyId: p.companyId,
        name: companiesMap[p.companyId]?.name || '—',
        industry: industryLabel(t, companiesMap[p.companyId]?.industry) || '—',
        revenue: p.revenue,
        potential: p.potential,
        projects: p.projects,
        leads: p.leads,
        won: p.wonLeads,
      })),
    [analytics, companiesMap, t],
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cl-empty">{t('crm.contacts.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cl-empty">{error}</div>
        </div>
      </MainLayout>
    );
  }

  if (!analytics) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div className="cl-empty">{t('crm.companies.analytics.noData')}</div>
        </div>
      </MainLayout>
    );
  }

  const S = analytics.summary;
  const withRevenue = rows.filter((c) => c.revenue > 0);
  const avgPerCompany = S.totalCompanies ? S.totalRevenue / S.totalCompanies : 0;
  const avgProject = S.totalProjects ? S.totalRevenue / S.totalProjects : 0;

  const sortedByMetric = [...rows].sort((a, b) => b[metric] - a[metric] || b.revenue - a.revenue);
  const totalOfMetric = rows.reduce((s, c) => s + c[metric], 0) || 1;
  let acc = 0;
  const board = sortedByMetric.slice(0, limit).map((c, i) => {
    acc += c[metric];
    return { ...c, rank: i + 1, share: (c[metric] / totalOfMetric) * 100, cum: (acc / totalOfMetric) * 100 };
  });
  const maxOf = board.length ? board[0][metric] || 1 : 1;
  const fmt = METRICS.find((m) => m[0] === metric)![2];

  const revSorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const top3 = revSorted.slice(0, 3).reduce((s, c) => s + c.revenue, 0);
  const top10 = revSorted.slice(0, 10).reduce((s, c) => s + c.revenue, 0);
  const shTop3 = S.totalRevenue ? (top3 / S.totalRevenue) * 100 : 0;
  const shNext = S.totalRevenue ? ((top10 - top3) / S.totalRevenue) * 100 : 0;
  const shRest = Math.max(0, 100 - shTop3 - shNext);

  const pipeline = [...rows].filter((c) => c.potential > 0).sort((a, b) => b.potential - a.potential).slice(0, 6);
  const maxPair = Math.max(...pipeline.map((c) => c.revenue + c.potential), 1);

  // Границы бакетов гистограммы считаются от реального максимума выручки в данных — работает
  // для любой валюты/масштаба тенанта, а не только для условных "100k/200k/300k" из мокапа.
  const revenues = rows.map((c) => c.revenue).filter((v) => v > 0);
  const maxRevenue = revenues.length ? Math.max(...revenues) : 0;
  const step = maxRevenue / 4 || 1;
  const BINS: Array<[string, string, (c: Row) => boolean]> = [
    [t('crm.companies.analytics.bins.none'), `0 ${currency}`, (c) => c.revenue === 0],
    [t('crm.companies.analytics.bins.small'), `< ${money(Math.round(step))}`, (c) => c.revenue > 0 && c.revenue < step],
    [t('crm.companies.analytics.bins.medium'), `${money(Math.round(step))}–${money(Math.round(step * 2))}`, (c) => c.revenue >= step && c.revenue < step * 2],
    [t('crm.companies.analytics.bins.large'), `${money(Math.round(step * 2))}–${money(Math.round(step * 3))}`, (c) => c.revenue >= step * 2 && c.revenue < step * 3],
    [t('crm.companies.analytics.bins.key'), `${money(Math.round(step * 3))}+`, (c) => c.revenue >= step * 3],
  ];
  const bins = BINS.map(([k, r, f]) => {
    const items = rows.filter(f);
    return { k, r, n: items.length, rev: items.reduce((s, c) => s + c.revenue, 0) };
  });
  const maxBin = Math.max(...bins.map((b) => b.n), 1);

  const KPIS: Array<[string, string | number, string]> = [
    [t('crm.companies.analytics.kpis.companies'), S.totalCompanies, t('crm.companies.analytics.kpis.companiesHint', { withRevenue: withRevenue.length, without: S.totalCompanies - withRevenue.length })],
    [t('crm.companies.analytics.kpis.leads'), S.totalLeads, t('crm.companies.analytics.kpis.leadsHint', { count: S.totalWonLeads })],
    [t('crm.companies.analytics.kpis.projects'), S.totalProjects, t('crm.companies.analytics.kpis.projectsHint', { count: rows.filter((c) => c.projects > 0).length })],
    [t('crm.companies.analytics.metrics.revenue'), cur(S.totalRevenue), t('crm.companies.analytics.kpis.revenueHint')],
    [t('crm.companies.analytics.kpis.potential'), cur(S.totalPotentialRevenue), t('crm.companies.analytics.kpis.potentialHint', { count: rows.filter((c) => c.potential > 0).length })],
    [t('crm.companies.analytics.kpis.avgConversion'), pct(S.avgWonConversionRate), t('crm.companies.analytics.kpis.avgConversionHint')],
  ];

  const handleExport = () => {
    const rowsCsv = [
      [
        t('crm.companies.analytics.export.rank'),
        t('crm.companies.analytics.export.company'),
        t('crm.companies.analytics.export.industry'),
        t('crm.companies.analytics.metrics.revenue'),
        t('crm.companies.analytics.metrics.projects'),
        t('crm.companies.analytics.metrics.leads'),
        t('crm.companies.analytics.export.share'),
        t('crm.companies.analytics.export.cumulative'),
      ],
      ...board.map((c) => [String(c.rank), c.name, c.industry, String(c.revenue), String(c.projects), String(c.leads), pct(c.share), pct(c.cum)]),
    ];
    downloadCsv(`companies-analytics-${Date.now()}.csv`, rowsCsv);
  };

  return (
    <MainLayout>
      <PageHelpButton topic="companiesAnalytics" />
      <div className="px-scope">
        <div className="ca-wrap">
          <div className="cl-hero">
            <div>
              <h1>
                {t('crm.companies.analytics.title')}
                <span className="cnt">{t('crm.companies.analytics.companiesCount', { count: S.totalCompanies })}</span>
              </h1>
              <p>{t('crm.companies.analytics.subtitle')}</p>
            </div>
            <div className="cl-hero-a">
              <select className="cl-sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" onClick={handleExport}>
                <Ic d={LIC.dl} size={13} />
                {t('crm.companies.analytics.export.button')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => navigate('/app/companies')}>
                <Ic d={LIC.table} size={13} />
                {t('crm.companies.analytics.backToList')}
              </button>
            </div>
          </div>

          <div className="ca-kpis">
            {KPIS.map(([k, v, d]) => (
              <div key={k as string} className="ca-kpi">
                <div className="k">{k}</div>
                <div className="v">{v}</div>
                <div className="d">{d}</div>
              </div>
            ))}
          </div>

          <div className="ca-panel">
            <div className="ca-head">
              <h2>{t('crm.companies.analytics.board.title')}</h2>
              <div className="cl-seg">
                {METRICS.map(([id, lb]) => (
                  <button key={id} type="button" className={cl(metric === id && 'on')} onClick={() => setMetric(id)}>
                    {lb}
                  </button>
                ))}
              </div>
              <div className="sp" />
              <span className="sub">{t('crm.companies.analytics.board.hint')}</span>
              <div className="cl-seg">
                {[5, 10, rows.length || 10].map((n, i) => (
                  <button key={i} type="button" className={cl(limit === n && 'on')} onClick={() => setLimit(n)}>
                    {i === 2 ? t('crm.companies.analytics.board.all') : n}
                  </button>
                ))}
              </div>
            </div>
            <div className="ca-split">
              <div>
                {board.length === 0 ? (
                  <div className="cl-empty">
                    <div className="t">{t('crm.companies.analytics.noData')}</div>
                  </div>
                ) : (
                  <div className="cl-scroll">
                  <table className="ca-lb">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('crm.companies.analytics.export.company')}</th>
                        <th></th>
                        <th className="r">{METRICS.find((m) => m[0] === metric)![1]}</th>
                        <th className="r">{t('crm.companies.analytics.board.share')}</th>
                        <th className="r">{t('crm.companies.analytics.board.cumulative')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((c) => (
                        <tr key={c.companyId}>
                          <td className="rk">{String(c.rank).padStart(2, '0')}</td>
                          <td>
                            <div className="nm">
                              <a
                                href={`/app/companies/${c.companyId}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/companies/${c.companyId}`);
                                }}
                              >
                                {c.name}
                              </a>
                            </div>
                            <div className="meta">
                              {c.industry} · {t('crm.companies.analytics.board.projectsCount', { count: c.projects })} ·{' '}
                              {t('crm.companies.analytics.board.leadsCount', { count: c.leads })}
                            </div>
                          </td>
                          <td className="bar">
                            <div className="ca-track">
                              <i style={{ width: `${Math.max(2, (c[metric] / maxOf) * 100)}%` }} />
                            </div>
                          </td>
                          <td className="r num">{fmt(c[metric])}</td>
                          <td className="r num dim">{pct(c.share)}</td>
                          <td className="r num dim">{pct(c.cum)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
                <div className="ca-foot">
                  <span>{t('crm.companies.analytics.foot.period', { period: PERIODS.find(([id]) => id === period)?.[1].toLowerCase() })}</span>
                  <span>{t('crm.companies.analytics.foot.source')}</span>
                </div>
              </div>
              <div className="ca-aside">
                <div className="ca-stat" style={{ paddingTop: 0 }}>
                  <div className="k">{t('crm.companies.analytics.aside.concentration')}</div>
                  <div className="ca-share" style={{ marginTop: 8 }}>
                    <i className="s1" style={{ width: `${shTop3}%` }}>
                      {pct(shTop3)}
                    </i>
                    <i className="s2" style={{ width: `${shNext}%` }}>
                      {shNext > 8 ? pct(shNext) : ''}
                    </i>
                    <i className="s3" style={{ width: `${shRest}%` }}>
                      {shRest > 8 ? pct(shRest) : ''}
                    </i>
                  </div>
                  <div className="ca-legend">
                    <span>
                      <b />
                      {t('crm.companies.analytics.aside.top3')}
                    </span>
                    <span>
                      <b className="g" />
                      {t('crm.companies.analytics.aside.next')}
                    </span>
                    {shRest > 0.5 && (
                      <span>
                        <b className="l" />
                        {t('crm.companies.analytics.aside.rest')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ca-stat">
                  <div className="k">{t('crm.companies.analytics.aside.revenuePerCompany')}</div>
                  <div className="v">{cur(avgPerCompany)}</div>
                  <div className="d">{t('crm.companies.analytics.aside.revenuePerCompanyHint', { amount: cur(S.totalRevenue / Math.max(1, withRevenue.length)) })}</div>
                </div>
                <div className="ca-stat">
                  <div className="k">{t('crm.companies.analytics.aside.avgProject')}</div>
                  <div className="v">{cur(avgProject)}</div>
                  <div className="d">{t('crm.companies.analytics.aside.avgProjectHint', { count: S.totalProjects })}</div>
                </div>
                <div className="ca-stat">
                  <div className="k">{t('crm.companies.analytics.aside.concentrationRisk')}</div>
                  <div className="v">
                    {shTop3 > 60
                      ? t('crm.companies.analytics.aside.riskHigh')
                      : shTop3 > 40
                        ? t('crm.companies.analytics.aside.riskMedium')
                        : t('crm.companies.analytics.aside.riskLow')}
                  </div>
                  <div className="d">{t('crm.companies.analytics.aside.riskHint', { pct: pct(shTop3) })}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ca-grid two">
            <div className="ca-panel">
              <div className="ca-head">
                <h2>{t('crm.companies.analytics.pipeline.title')}</h2>
                <div className="sp" />
                <div className="ca-legend">
                  <span>
                    <b />
                    {t('crm.companies.analytics.pipeline.closed')}
                  </span>
                  <span>
                    <b className="h" />
                    {t('crm.companies.analytics.pipeline.potential')}
                  </span>
                </div>
              </div>
              <div className="ca-rows">
                {pipeline.length === 0 ? (
                  <div className="cl-empty">
                    <div className="t">{t('crm.companies.analytics.noData')}</div>
                  </div>
                ) : (
                  <>
                    {pipeline.map((c) => (
                      <div key={c.companyId} className="ca-row">
                        <div className="t">
                          <span className="n">{c.name}</span>
                          <span className="f">
                            <b>{cur(c.revenue)}</b> · {t('crm.companies.analytics.pipeline.inDeals', { amount: cur(c.potential) })}
                          </span>
                        </div>
                        <div className="ca-track">
                          <i style={{ width: `${(c.revenue / maxPair) * 100}%` }} />
                          <i className="alt" style={{ width: `${(c.potential / maxPair) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="ca-note">
                      {t('crm.companies.analytics.pipeline.note', {
                        potential: cur(S.totalPotentialRevenue),
                        pct: pct(S.totalRevenue ? (S.totalPotentialRevenue / S.totalRevenue) * 100 : 0),
                        name: pipeline[0].name,
                        amount: cur(pipeline[0].potential),
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="ca-panel">
              <div className="ca-head">
                <h2>{t('crm.companies.analytics.funnel.title')}</h2>
                <div className="sp" />
                <span className="sub">{t('crm.companies.analytics.funnel.hint')}</span>
              </div>
              <div className="ca-funnel">
                {(
                  [
                    [t('crm.companies.analytics.funnel.leads'), S.totalLeads, false],
                    [t('crm.companies.analytics.funnel.projects'), S.totalProjects, false],
                    [t('crm.companies.analytics.funnel.closed'), S.totalWonLeads, false],
                    [t('crm.companies.analytics.funnel.companiesWithRevenue'), withRevenue.length, true],
                  ] as Array<[string, number, boolean]>
                ).map(([lb, v, out], i, arr) => (
                  <div key={lb} className="ca-step">
                    <div className="lb">{lb}</div>
                    <div className={cl('bx', out && 'o')} style={{ width: `${Math.max(12, (v / Math.max(1, S.totalLeads)) * 100)}%` }}>
                      {v}
                    </div>
                    <div className="cv">{i === 0 ? '—' : pct((v / Math.max(1, arr[i - 1][1] as number)) * 100)}</div>
                  </div>
                ))}
                <div className="ca-note">
                  {t('crm.companies.analytics.funnel.note', { pct: pct(S.avgWonConversionRate), amount: cur(avgProject) })}
                </div>
              </div>
            </div>
          </div>

          <div className="ca-panel" style={{ marginTop: 14 }}>
            <div className="ca-head">
              <h2>{t('crm.companies.analytics.hist.title')}</h2>
              <div className="sp" />
              <span className="sub">{t('crm.companies.analytics.hist.hint')}</span>
            </div>
            <div className="ca-hist">
              {bins.map((b) => (
                <div key={b.k} className={cl('ca-bin', b.rev / Math.max(1, S.totalRevenue) > 0.3 && 'hot')}>
                  <div className="col" style={{ height: `${Math.max(12, (b.n / maxBin) * 100)}%` }}>
                    {b.n}
                  </div>
                  <div className="cap">
                    <b>{b.k}</b>
                    {b.r} · {t('crm.companies.analytics.hist.revenueShare', { pct: pct(S.totalRevenue ? (b.rev / S.totalRevenue) * 100 : 0) })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
