// src/pages/products/ProductFeedsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import { fetchSites, type Site } from '../../api/sites';
import { API_BASE } from '../../api/client';
import './products-design.css';

function resolvePublicApiBase(): string {
  const b = API_BASE.replace(/\/$/, '');
  if (typeof window === 'undefined') return b || '/v1';
  if (b.startsWith('http')) return b;
  return `${window.location.origin}${b.startsWith('/') ? '' : '/'}${b}`;
}

const I = {
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const FeedRow: React.FC<{ label: string; url: string }> = ({ label, url }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--line-3)' }}>
      <span className="mono" style={{ width: 100, flexShrink: 0, color: 'var(--fg-3)' }}>{label}</span>
      <code style={{ flex: 1, fontSize: 11.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
      <button type="button" className="tb-icon-btn" onClick={handleCopy}>
        <Icon d={I.copy} />
        {copied ? '✓' : ''}
      </button>
    </div>
  );
};

export const ProductFeedsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSites()
      .then(setSites)
      .catch((e) => showAlert(e.message || t('crm.products.feeds.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const apiBase = useMemo(() => resolvePublicApiBase(), []);

  return (
    <MainLayout>
      <PageHelpButton topic="productFeeds" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.feeds.title')}</h1>
            <p className="sub">{t('crm.products.feeds.subtitle')}</p>
          </div>
        </div>

        <ProductsSubnav active="feeds" />

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : !sites.length ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.feeds.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sites.map((site) => {
              const base = `${apiBase}/public/feeds/${site.apiToken}`;
              return (
                <div key={site.id} className="px-table-wrap" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                    {site.name || site.domain}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 10 }}>{site.domain}</div>
                  <FeedRow label={t('crm.products.feeds.google')} url={`${base}/google.xml`} />
                  <FeedRow label={t('crm.products.feeds.woocommerce')} url={`${base}/woocommerce.csv`} />
                  <FeedRow label={t('crm.products.feeds.json')} url={`${base}/products.json`} />
                </div>
              );
            })}
            <div className="ai-hint" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.products.feeds.hint')}</div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
