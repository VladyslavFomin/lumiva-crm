/** Номер заказа как в WooCommerce (externalOrderNo / externalId), без UUID CRM в заголовке. */
export function saleOrderDisplayNumber(
  sale: Record<string, unknown>,
): string {
  const on =
    typeof sale.externalOrderNo === 'string'
      ? sale.externalOrderNo.trim()
      : '';
  if (on && /^\d+$/.test(on)) return on;
  const ext =
    typeof sale.externalId === 'string' ? sale.externalId.trim() : '';
  if (ext && /^\d+$/.test(ext)) return ext;
  const crmId = typeof sale.id === 'string' ? sale.id : '';
  return crmId ? `${crmId.slice(0, 8)}…` : '—';
}
