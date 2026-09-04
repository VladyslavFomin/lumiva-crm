// src/pages/products/ProductStockPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductStock,
  adjustProductStock,
  fetchProductLocations,
  transferProductStock,
  type ProductStockRow,
  type ProductLocation,
} from '../../api/products';
import './products-design.css';

const I = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  box: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const ProductStockPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<ProductStockRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [adjustLocationId, setAdjustLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [transferTarget, setTransferTarget] = useState<ProductStockRow | null>(null);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferReason, setTransferReason] = useState('');

  useEffect(() => {
    fetchProductLocations()
      .then((locs) => {
        setLocations(locs);
        const def = locs.find((l) => l.isDefault);
        if (def) setAdjustLocationId(def.id);
      })
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    fetchProductStock({ search: search || undefined, lowStockOnly, locationId: locationFilter || undefined })
      .then(setRows)
      .catch((e) => showAlert(e.message || t('crm.products.stock.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, lowStockOnly, locationFilter]);

  const openAdjust = (row: ProductStockRow) => {
    setAdjustTarget(row);
    setDelta('');
    setReason('');
    if (!adjustLocationId) {
      const def = locations.find((l) => l.isDefault);
      if (def) setAdjustLocationId(def.id);
    }
  };

  const handleAdjustSave = async () => {
    if (!adjustTarget) return;
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) return;
    setSaving(true);
    try {
      await adjustProductStock({
        productId: adjustTarget.productId,
        variantId: adjustTarget.variantId,
        locationId: adjustLocationId || undefined,
        delta: d,
        reason: reason || undefined,
      });
      setAdjustTarget(null);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.stock.errors.adjustFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = (row: ProductStockRow) => {
    setTransferTarget(row);
    setTransferFrom(row.locations[0]?.locationId || '');
    setTransferTo('');
    setTransferQty('');
    setTransferReason('');
  };

  const handleTransferSave = async () => {
    if (!transferTarget) return;
    const qty = Number(transferQty);
    if (!transferFrom || !transferTo || transferFrom === transferTo || !Number.isFinite(qty) || qty <= 0) return;
    setSaving(true);
    try {
      await transferProductStock({
        productId: transferTarget.productId,
        variantId: transferTarget.variantId,
        fromLocationId: transferFrom,
        toLocationId: transferTo,
        quantity: qty,
        reason: transferReason || undefined,
      });
      setTransferTarget(null);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.stock.errors.transferFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const lowCount = rows.filter((r) => r.isLow && r.quantity > 0).length;
  const outCount = rows.filter((r) => r.quantity === 0).length;

  return (
    <MainLayout>
      <PageHelpButton topic="productStock" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.stock.title')}</h1>
            <p className="sub">{t('crm.products.stock.subtitle')}</p>
          </div>
        </div>

        <ProductsSubnav active="stock" />

        <div className="px-kpis">
          <div className="px-kpi">
            <div className="l">{t('crm.products.stock.kpis.positions')}</div>
            <div className="v">{rows.length}</div>
            <div className="d">{t('crm.products.stock.kpis.positionsHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.stock.kpis.totalQty')}</div>
            <div className="v">{totalQty}</div>
            <div className="d">{t('crm.products.stock.kpis.totalQtyHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.stock.kpis.low')}</div>
            <div className="v" style={{ color: lowCount ? '#c08319' : undefined }}>{lowCount}</div>
            <div className="d warn">{lowCount ? t('crm.products.stock.kpis.lowHintWarn') : t('crm.products.stock.kpis.lowHintOk')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.stock.kpis.out')}</div>
            <div className="v" style={{ color: outCount ? '#cc2f47' : undefined }}>{outCount}</div>
            <div className="d bad">{outCount ? t('crm.products.stock.kpis.outHintBad') : t('crm.products.stock.kpis.outHintOk')}</div>
          </div>
        </div>

        <div className="px-toolbar">
          <div className="tb-search" style={{ width: 240 }}>
            <Icon d={I.search} size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.products.stock.searchPlaceholder') || ''} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--fg-3)' }}>
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            {t('crm.products.stock.lowStockOnly')}
          </label>
          {locations.length > 1 && (
            <select
              className="ai-select"
              style={{ width: 'auto', fontSize: 12.5 }}
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">{t('crm.products.stock.allLocations')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.stock.empty')}</div>
        ) : (
          <div className="wh-table-wrap">
            <table className="wh-table">
              <thead>
                <tr>
                  <th>{t('crm.products.stock.columns.product')}</th>
                  <th>{t('crm.products.stock.columns.variant')}</th>
                  {locations.length > 1 && !locationFilter && <th>{t('crm.products.stock.columns.locations')}</th>}
                  <th className="r">{t('crm.products.stock.columns.quantity')}</th>
                  <th className="r">{t('crm.products.stock.columns.threshold')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.productId}-${r.variantId || 'base'}`} className="row">
                    <td>
                      <div className="wh-cell-name">
                        <div className="pr-thumb"><Icon d={I.box} size={15} /></div>
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/products/${r.productId}`)}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink)', cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}
                          >
                            {r.productName}
                          </button>
                          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{r.sku || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.variantLabel ? <span className="wh-loc">{r.variantLabel}</span> : '—'}</td>
                    {locations.length > 1 && !locationFilter && (
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.locations.filter((l) => l.quantity > 0).map((l) => (
                            <span
                              key={l.locationId}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'var(--bg-muted)', border: '1px solid var(--line-2)', color: 'var(--fg-3)' }}
                            >
                              {l.locationName}: {l.quantity}
                            </span>
                          ))}
                          {!r.locations.some((l) => l.quantity > 0) && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>—</span>}
                        </div>
                      </td>
                    )}
                    <td className="r">
                      <span style={{ color: r.quantity === 0 ? '#cc2f47' : r.isLow ? '#c08319' : 'var(--ink)', fontWeight: 600 }}>{r.quantity}</span>
                    </td>
                    <td className="r" style={{ color: 'var(--fg-3)' }}>{r.lowStockThreshold ?? '—'}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {locations.length > 1 && (
                        <button type="button" className="tb-icon-btn" onClick={() => openTransfer(r)} style={{ marginRight: 6 }}>
                          {t('crm.products.stock.transferButton')}
                        </button>
                      )}
                      <button type="button" className="tb-icon-btn" onClick={() => openAdjust(r)}>
                        {t('crm.products.stock.adjustButton')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {adjustTarget && (
          <div className="pr-cat-modal-back" onClick={() => setAdjustTarget(null)}>
            <div className="pr-cat-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <h3>{t('crm.products.stock.adjustModal.title')}</h3>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: -8, marginBottom: 16 }}>
                {adjustTarget.productName}{adjustTarget.variantLabel ? ` · ${adjustTarget.variantLabel}` : ''}
              </div>
              {locations.length > 1 && (
                <div className="ai-field">
                  <label className="ai-label">{t('crm.products.stock.adjustModal.locationLabel')}</label>
                  <select className="ai-select" value={adjustLocationId} onChange={(e) => setAdjustLocationId(e.target.value)}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="ai-field">
                <label className="ai-label">{t('crm.products.stock.adjustModal.deltaLabel')}</label>
                <input type="number" className="ai-input" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus />
                <div className="ai-hint">{t('crm.products.stock.adjustModal.deltaHint')}</div>
              </div>
              <div className="ai-field" style={{ marginBottom: 0 }}>
                <label className="ai-label">{t('crm.products.stock.adjustModal.reasonLabel')}</label>
                <input className="ai-input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="pr-cat-modal-foot">
                <button type="button" className="aib ghost" onClick={() => setAdjustTarget(null)}>
                  {t('crm.products.stock.adjustModal.cancel')}
                </button>
                <button type="button" className="aib" onClick={handleAdjustSave} disabled={saving || !delta || Number(delta) === 0}>
                  {t('crm.products.stock.adjustModal.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {transferTarget && (
          <div className="pr-cat-modal-back" onClick={() => setTransferTarget(null)}>
            <div className="pr-cat-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <h3>{t('crm.products.stock.transferModal.title')}</h3>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: -8, marginBottom: 16 }}>
                {transferTarget.productName}{transferTarget.variantLabel ? ` · ${transferTarget.variantLabel}` : ''}
              </div>
              <div className="ai-field">
                <label className="ai-label">{t('crm.products.stock.transferModal.fromLabel')}</label>
                <select className="ai-select" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({transferTarget.locations.find((s) => s.locationId === l.id)?.quantity || 0})
                    </option>
                  ))}
                </select>
              </div>
              <div className="ai-field">
                <label className="ai-label">{t('crm.products.stock.transferModal.toLabel')}</label>
                <select className="ai-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  <option value="">—</option>
                  {locations.filter((l) => l.id !== transferFrom).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="ai-field">
                <label className="ai-label">{t('crm.products.stock.transferModal.quantityLabel')}</label>
                <input type="number" min={1} className="ai-input" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
              </div>
              <div className="ai-field" style={{ marginBottom: 0 }}>
                <label className="ai-label">{t('crm.products.stock.transferModal.reasonLabel')}</label>
                <input className="ai-input" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
              </div>
              <div className="pr-cat-modal-foot">
                <button type="button" className="aib ghost" onClick={() => setTransferTarget(null)}>
                  {t('crm.products.stock.adjustModal.cancel')}
                </button>
                <button
                  type="button"
                  className="aib"
                  onClick={handleTransferSave}
                  disabled={saving || !transferFrom || !transferTo || transferFrom === transferTo || !transferQty || Number(transferQty) <= 0}
                >
                  {t('crm.products.stock.transferModal.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
