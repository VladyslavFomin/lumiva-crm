import React from 'react';
import { canonicalWorkspaceCatalogKey } from '../../api/workspaceAreas';

/** Иконка источника по типу каталога — свой значок для основных интеграций, generic для остальных. */
export const WorkspaceSourceIcon: React.FC<{ catalogKey: string; className?: string }> = ({ catalogKey, className }) => {
  const key = canonicalWorkspaceCatalogKey(catalogKey);
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true };
  if (key === 'woocommerce') {
    return <svg {...common}><path d="M3 8h18l-1.5 11H4.5z" /><path d="M8 8V6a4 4 0 018 0v2" /></svg>;
  }
  if (key === 'meta_ads' || key === 'facebook_ads' || key === 'meta' || key === 'instagram_ads') {
    return <svg {...common}><circle cx="8" cy="12" r="4.5" /><circle cx="16" cy="12" r="4.5" /></svg>;
  }
  if (key === 'google_analytics') {
    return <svg {...common}><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-6" /></svg>;
  }
  if (key === 'yandex_direct' || key === 'vk_ads') {
    return <svg {...common}><path d="M3 11l16-7v16L3 13z" /><path d="M7 13v4a2 2 0 002 2" /></svg>;
  }
  if (key === 'telegram') {
    return <svg {...common}><path d="M21 4L3 11l6 2m12-9-3.5 16L9 13m12-9L9 13m0 0v6l3-3.5" /></svg>;
  }
  if (key === 'email' || key === 'webform') {
    return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
  }
  if (key === 'shopify') {
    return <svg {...common}><path d="M6 8h12l1 12H5z" /><path d="M9 8a3 3 0 016 0" /></svg>;
  }
  if (key === 'webhooks') {
    return <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7l8 9M8 17h8" /></svg>;
  }
  return <svg {...common}><path d="M9 3v6" /><path d="M15 3v6" /><rect x="6" y="9" width="12" height="6" rx="1.5" /><path d="M12 15v4" /><path d="M9 19h6" /></svg>;
};
