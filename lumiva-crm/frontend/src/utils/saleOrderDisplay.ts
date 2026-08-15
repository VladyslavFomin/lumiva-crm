const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Номер заказа как в источнике (WooCommerce/Shopify — обычно числовой; тестовая витрина/
 * embed-формы — код вида ORD-XXXXXXXX), без UUID CRM в заголовке. Раньше принимался только
 * чисто числовой externalOrderNo/externalId, из-за чего алфанумерные коды витрины проваливались
 * в fallback на внутренний CRM id — теперь достаточно, что значение не выглядит как UUID.
 */
export function saleOrderDisplayNumber(
  sale: Record<string, unknown>,
): string {
  const on =
    typeof sale.externalOrderNo === 'string'
      ? sale.externalOrderNo.trim()
      : '';
  if (on && !UUID_RE.test(on)) return on;
  const ext =
    typeof sale.externalId === 'string' ? sale.externalId.trim() : '';
  if (ext && !UUID_RE.test(ext)) return ext;
  const crmId = typeof sale.id === 'string' ? sale.id : '';
  return crmId ? `${crmId.slice(0, 8)}…` : '—';
}

/**
 * Название товара(ов) для продажи без sale.hotel (WooCommerce/Shopify) — тестовая витрина/
 * embed-формы кладут состав корзины в customFields.items (SalesService.createFromStorefront),
 * не в sale.hotel.
 */
export function saleStorefrontProductName(sale: {
  customFields?: unknown;
}): string | null {
  const cf =
    sale.customFields && typeof sale.customFields === 'object'
      ? (sale.customFields as Record<string, unknown>)
      : null;
  const items = Array.isArray(cf?.items) ? (cf!.items as Record<string, unknown>[]) : [];
  const names = items
    .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
    .filter(Boolean);
  return names.length ? names.join(', ') : null;
}
