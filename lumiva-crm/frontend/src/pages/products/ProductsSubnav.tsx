// src/pages/products/ProductsSubnav.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type SubnavKey = 'catalog' | 'categories' | 'attributes' | 'fields' | 'stock' | 'locations' | 'feeds' | 'webhooks' | 'moderation' | 'analytics';

const ICONS: Record<SubnavKey, React.ReactNode> = {
  catalog: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  ),
  categories: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  attributes: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M20.59 13.41L12 22l-8.59-8.59A2 2 0 013 12V4a1 1 0 011-1h8a2 2 0 011.41.59l8.18 8.18a2 2 0 010 2.83z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  fields: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 4l9 5-9 5-9-5z" />
      <path d="M3 14l9 5 9-5" />
    </svg>
  ),
  stock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  locations: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  feeds: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11a9 9 0 019 9" />
      <path d="M4 4a16 16 0 0116 16" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  webhooks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M18 8a3 3 0 10-2.83-4H15a3 3 0 000 6h.17" />
      <path d="M6 16a3 3 0 102.83 4H9a3 3 0 000-6h-.17" />
      <path d="M14 6L8 18" />
    </svg>
  ),
  moderation: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  analytics: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  ),
};

export const ProductsSubnav: React.FC<{ active: SubnavKey }> = ({ active }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items: Array<{ key: SubnavKey; label: string; path: string }> = [
    { key: 'catalog', label: t('crm.products.subnav.catalog'), path: '/products' },
    { key: 'categories', label: t('crm.products.subnav.categories'), path: '/products/categories' },
    { key: 'attributes', label: t('crm.products.subnav.attributes'), path: '/products/attributes' },
    { key: 'fields', label: t('crm.products.subnav.fields'), path: '/products/field-types' },
    { key: 'stock', label: t('crm.products.subnav.stock'), path: '/products/stock' },
    { key: 'locations', label: t('crm.products.subnav.locations'), path: '/products/locations' },
    { key: 'feeds', label: t('crm.products.subnav.feeds'), path: '/products/feeds' },
    { key: 'webhooks', label: t('crm.products.subnav.webhooks'), path: '/products/webhooks' },
    { key: 'moderation', label: t('crm.products.subnav.moderation'), path: '/products/moderation' },
    { key: 'analytics', label: t('crm.products.subnav.analytics'), path: '/products/analytics' },
  ];

  return (
    <div className="px-subnav">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={active === item.key ? 'active' : undefined}
          onClick={() => navigate(item.path)}
        >
          <span className="ic">{ICONS[item.key]}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
};
