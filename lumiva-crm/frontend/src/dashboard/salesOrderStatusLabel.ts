import type { TFunction } from 'i18next';

/** WooCommerce / sales order codes → `crm.dashboard.salesOrderStatus.*` */
export function translateSalesOrderStatus(status: unknown, t: TFunction): string {
  const code =
    String(status || 'other')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_') || 'other';
  const key = `crm.dashboard.salesOrderStatus.${code}`;
  const translated = t(key);
  if (translated !== key) return translated;
  const raw = String(status ?? '').trim();
  return raw || t('crm.dashboard.salesOrderStatus.other');
}
