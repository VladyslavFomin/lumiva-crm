import type { SaleStatus } from '../../api/sales';

export const SALE_STATUSES_ORDER: SaleStatus[] = [
  'new',
  'pending',
  'confirmed',
  'cancelled',
  'refunded',
  'other',
];

/** Классы как у статусов проектов (.lv-st / .lv-st-new …) */
export function saleStatusPillClass(status: SaleStatus | string): string {
  switch (status) {
    case 'new':
      return 'lv-st lv-st-new';
    case 'pending':
      return 'lv-st lv-st-review';
    case 'confirmed':
      return 'lv-st lv-st-won';
    case 'cancelled':
      return 'lv-st lv-st-closed';
    case 'refunded':
      return 'lv-st lv-st-lost';
    case 'other':
    default:
      return 'lv-st lv-st-paused';
  }
}
