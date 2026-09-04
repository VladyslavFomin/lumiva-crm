// src/pages/products/ProductsAnalyticsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductsAnalytics,
  exportProductsAnalytics,
  fetchProductCategories,
  fetchProductLocations,
  type ProductsAnalyticsFilters,
  type ProductsAnalyticsResult,
  type ProductCategory,
  type ProductLocation,
  type ProductStatus,
} from '../../api/products';
import { fetchMarketingFxRates } from '../../api/marketing';
import { ProductsAnalyticsBuilder } from './ProductsAnalyticsBuilder';
import './products-design.css';

const CHART_COLORS = ['#222222', '#5a3a86', '#175c3d', '#7a4a09', '#214b8a', '#9a1f31', '#888888', '#c08319'];

const I = {
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
};
const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

function fmtMoney(n: number, currency: string): string {
  const abs = Math.abs(n);
  const short = abs >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : abs >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
  return `${short} ${currency}`;
}

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

export const ProductsAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const [mode, setMode] = useState<'overview' | 'builder'>('overview');

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['EUR', 'USD', 'TRY']);
  const [rates, setRates] = useState<Record<string, number>>({});

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('EUR');

  const [data, setData] = useState<ProductsAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([fetchProductCategories(), fetchProductLocations()])
      .then(([c, l]) => {
        setCategories(c);
        setLocations(l);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMarketingFxRates(displayCurrency)
      .then((r) => {
        setRates(r.multiplyToDisplay);
        if (r.availableDisplayCurrencies?.length) setAvailableCurrencies(r.availableDisplayCurrencies);
      })
      .catch(() => setRates({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCurrency]);

  const filters: ProductsAnalyticsFilters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      status: (status as ProductStatus) || undefined,
      categoryId: categoryId || undefined,
      locationId: locationId || undefined,
      search: search.trim() || undefined,
      displayCurrency,
      rates,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, status, categoryId, locationId, search, displayCurrency, rates],
  );

  useEffect(() => {
    if (!Object.keys(rates).length && displayCurrency !== 'EUR') return; // ждём курсы, чтобы не запрашивать дважды
    setLoading(true);
    fetchProductsAnalytics(filters)
      .then(setData)
      .catch((e) => showAlert(e.message || t('crm.products.analytics.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, rates]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportProductsAnalytics(filters);
    } catch (e: any) {
      showAlert(e.message || t('crm.products.analytics.errors.exportFailed'), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const currency = data?.displayCurrency || displayCurrency;

  return (
    <MainLayout>
      <PageHelpButton topic="productsAnalytics" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.analytics.title')}</h1>
            <p className="sub">{t('crm.products.analytics.subtitle')}</p>
          </div>
          <div className="px-head-actions">
            {mode === 'overview' && (
              <button type="button" className="aib ghost" onClick={handleExport} disabled={exporting || !data}>
                <Icon d={I.download} size={14} />
                {t('crm.products.analytics.exportButton')}
              </button>
            )}
          </div>
        </div>

        <ProductsSubnav active="analytics" />

        <div className="pxb-mode-switch" style={{ marginBottom: 18 }}>
          <button type="button" className={mode === 'overview' ? 'active' : undefined} onClick={() => setMode('overview')}>
            {t('crm.products.analytics.modeOverview')}
          </button>
          <button type="button" className={mode === 'builder' ? 'active' : undefined} onClick={() => setMode('builder')}>
            {t('crm.products.analytics.modeBuilder')}
          </button>
        </div>

        {mode === 'builder' ? (
          <ProductsAnalyticsBuilder />
        ) : (
        <>
        <div className="an-toolbar">
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.from')}</label>
            <input type="date" className="ai-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.to')}</label>
            <input type="date" className="ai-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.status')}</label>
            <select className="ai-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('crm.products.analytics.filters.statusAll')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`crm.products.status.${s}`)}</option>
              ))}
            </select>
          </div>
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.category')}</label>
            <select className="ai-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('crm.products.analytics.filters.categoryAll')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.location')}</label>
            <select className="ai-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{t('crm.products.analytics.filters.locationAll')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="an-filter grow">
            <label>{t('crm.products.analytics.filters.search')}</label>
            <input
              className="ai-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.products.analytics.filters.searchPlaceholder') || ''}
            />
          </div>
          <div className="an-filter">
            <label>{t('crm.products.analytics.filters.currency')}</label>
            <select className="ai-select" value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)}>
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {loading || !data ? (
          <div className="an-empty">{t('crm.common.loading')}</div>
        ) : (
          <>
            <div className="pr-kpis">
              <div className="pr-kpi">
                <div className="l">{t('crm.products.analytics.kpis.totalProducts')}</div>
                <div className="v">{data.kpis.totalProducts}<span className="u"> / {data.kpis.activeProducts} {t('crm.products.status.active')}</span></div>
              </div>
              <div className="pr-kpi">
                <div className="l">{t('crm.products.analytics.kpis.catalogValue')}</div>
                <div className="v">{fmtMoney(data.kpis.totalCatalogValue, currency)}</div>
                <div className="d">{t('crm.products.analytics.kpis.costValue')}: {fmtMoney(data.kpis.totalCostValue, currency)}</div>
              </div>
              <div className="pr-kpi">
                <div className="l">{t('crm.products.analytics.kpis.avgMargin')}</div>
                <div className="v">{data.kpis.avgMarginPct !== null ? `${data.kpis.avgMarginPct.toFixed(1)}%` : '—'}</div>
              </div>
              <div className="pr-kpi">
                <div className="l">{t('crm.products.analytics.kpis.stockUnits')}</div>
                <div className="v">{data.kpis.totalStockUnits}</div>
                <div className="d">{data.kpis.totalWarehouses} {t('crm.products.subnav.locations').toLowerCase()}</div>
              </div>
              <div className="pr-kpi">
                <div className="l">{t('crm.products.analytics.kpis.attention')}</div>
                <div className="v">{data.kpis.lowStockCount + data.kpis.outOfStockCount}</div>
                {data.kpis.outOfStockCount > 0 && <div className="d bad">{data.kpis.outOfStockCount} {t('crm.products.status.out_of_stock').toLowerCase()}</div>}
              </div>
            </div>

            <div className="an-grid">
              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.byCategory')}</div>
                  <div className="d">{data.byCategory.length}</div>
                </div>
                {!data.byCategory.length ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, data.byCategory.length * 34)}>
                    <BarChart data={data.byCategory} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line-3)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMoney(v, currency)} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
                      <Bar dataKey="value" fill="#222222" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.byCurrency')}</div>
                  <div className="d">{data.byCurrency.length}</div>
                </div>
                {!data.byCurrency.length ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={data.byCurrency as any} dataKey="convertedValue" nameKey="currency" innerRadius={38} outerRadius={62} paddingAngle={2}>
                          {data.byCurrency.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      {data.byCurrency.map((r, i) => (
                        <div key={r.currency} className="an-legend-row">
                          <span className="an-legend-sw" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="nm">{r.currency} · {r.count}</span>
                          <span className="val">{fmtMoney(r.convertedValue, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.byLocation')}</div>
                  <div className="d">{data.byLocation.length}</div>
                </div>
                {!data.byLocation.length ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <div>
                    {data.byLocation.map((r) => (
                      <div key={r.locationId} className="an-legend-row">
                        <span className="nm">{r.name}{r.isDefault ? ` · ${t('crm.products.locations.defaultBadge')}` : ''}</span>
                        <span className="val">{r.stockUnits} {t('crm.products.analytics.units')} · {fmtMoney(r.value, currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.margin')}</div>
                </div>
                {!data.marginBuckets.some((b) => b.count > 0) ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.marginBuckets} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-3)" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#5a3a86" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="an-panel full">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.movementTimeline')}</div>
                  <div className="d">{t('crm.products.analytics.movementIn')} / {t('crm.products.analytics.movementOut')}</div>
                </div>
                {!data.stockMovementTimeline.length ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.stockMovementTimeline} margin={{ left: -10, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-3)" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="in" name={t('crm.products.analytics.movementIn') || 'in'} stroke="#1f8a5e" fill="#1f8a5e" fillOpacity={0.15} />
                      <Area type="monotone" dataKey="out" name={t('crm.products.analytics.movementOut') || 'out'} stroke="#cc2f47" fill="#cc2f47" fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {!!data.byTag.length && (
                <div className="an-panel full">
                  <div className="an-panel-head">
                    <div className="t">{t('crm.products.analytics.panels.tags')}</div>
                  </div>
                  <div className="an-tag-cloud">
                    {data.byTag.map((t2) => (
                      <span key={t2.tag} className="an-tag-pill">{t2.tag} <span className="cnt">{t2.count}</span></span>
                    ))}
                  </div>
                </div>
              )}

              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.topProducts')}</div>
                </div>
                {!data.topProducts.length ? (
                  <div className="an-empty">{t('crm.products.analytics.empty')}</div>
                ) : (
                  <div>
                    {data.topProducts.map((p) => (
                      <div key={p.id} className="an-list-row">
                        <div className="nm">{p.name}{p.sku ? <span className="sku"> · {p.sku}</span> : null}</div>
                        <span className="val">{fmtMoney(p.value, currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{t('crm.products.analytics.panels.lowStock')}</div>
                  <div className="d">{data.lowStock.length}</div>
                </div>
                {!data.lowStock.length ? (
                  <div className="an-empty">{t('crm.products.analytics.noneLowStock')}</div>
                ) : (
                  <div>
                    {data.lowStock.map((p) => (
                      <div key={p.id} className="an-list-row">
                        <div className="nm">{p.name}{p.sku ? <span className="sku"> · {p.sku}</span> : null}</div>
                        <span className="qty warn">{p.quantity} / {p.lowStockThreshold}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!!data.outOfStock.length && (
                <div className="an-panel full">
                  <div className="an-panel-head">
                    <div className="t">{t('crm.products.analytics.panels.outOfStock')}</div>
                    <div className="d">{data.kpis.outOfStockCount}</div>
                  </div>
                  <div className="an-tag-cloud">
                    {data.outOfStock.map((p) => (
                      <span key={p.id} className="an-tag-pill">{p.name}{p.sku ? ` · ${p.sku}` : ''}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </MainLayout>
  );
};
