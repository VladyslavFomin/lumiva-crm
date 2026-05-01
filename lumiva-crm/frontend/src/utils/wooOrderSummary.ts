/**
 * Разбор сырого ответа WooCommerce REST API (заказ), сохранённого в sale.rawPayload.
 */

export type WooOrderLineRow = {
  name: string;
  quantity: string | number;
  lineTotal: string | null;
};

export type WooOrderSummary = {
  currency: string | null;
  lines: WooOrderLineRow[];
  totalTax: string | null;
  total: string | null;
};

function formatMoney(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') {
    const s = v.trim();
    return s.length ? s : null;
  }
  return String(v);
}

function parseLineItems(raw: unknown): WooOrderLineRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
    .map((li) => ({
      name: typeof li.name === 'string' && li.name.trim() ? li.name : '—',
      quantity:
        typeof li.quantity === 'number'
          ? li.quantity
          : typeof li.quantity === 'string'
            ? li.quantity
            : '—',
      lineTotal: formatMoney(li.total),
    }));
}

/** Признак того, что объект похож на заказ WooCommerce REST (а не произвольный JSON). */
function looksLikeWooRestOrder(o: Record<string, unknown>): boolean {
  if (Array.isArray(o.line_items)) return true;
  if (
    typeof o.currency === 'string' &&
    (o.total_tax !== undefined || o.total !== undefined || o.cart_tax !== undefined)
  ) {
    return true;
  }
  return false;
}

/**
 * Возвращает сводку для UI или null, если payload не похож на заказ Woo / нечего показать.
 */
export function extractWooOrderSummary(rawPayload: unknown): WooOrderSummary | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const o = rawPayload as Record<string, unknown>;

  if (!looksLikeWooRestOrder(o)) return null;

  const currency =
    typeof o.currency === 'string' && o.currency.trim()
      ? o.currency.trim().toUpperCase()
      : null;
  const lines = parseLineItems(o.line_items);
  const totalTax = formatMoney(o.total_tax);
  const total = formatMoney(o.total);

  if (!currency && !totalTax && !total && lines.length === 0) return null;

  return { currency, lines, totalTax, total };
}
