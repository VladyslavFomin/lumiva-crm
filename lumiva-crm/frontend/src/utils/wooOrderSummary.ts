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

type StorefrontOrderItem = {
  name?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
};

/**
 * Сводка для заказов первого порядка (тестовая витрина pl1, product_order embed-форма) —
 * там нет rawPayload/line_items Woo, состав корзины лежит в sale.customFields.items
 * (SalesService.createFromStorefront), формат {sku, name, qty, unitPrice}.
 */
export function extractStorefrontOrderSummary(
  customFields: unknown,
  currency: string | null | undefined,
  amount: number | null | undefined,
): WooOrderSummary | null {
  const cf =
    customFields && typeof customFields === 'object'
      ? (customFields as Record<string, unknown>)
      : null;
  const rawItems = cf?.items;
  if (!Array.isArray(rawItems) || !rawItems.length) return null;

  const lines: WooOrderLineRow[] = rawItems
    .filter((x): x is StorefrontOrderItem => x !== null && typeof x === 'object')
    .map((item) => {
      const qty =
        typeof item.qty === 'number'
          ? item.qty
          : Number(item.qty) || 0;
      const unitPrice =
        typeof item.unitPrice === 'number'
          ? item.unitPrice
          : Number(item.unitPrice) || 0;
      return {
        name: typeof item.name === 'string' && item.name.trim() ? item.name : '—',
        quantity: qty,
        lineTotal: formatMoney(qty * unitPrice),
      };
    });

  if (!lines.length) return null;

  return {
    currency: currency ? currency.toUpperCase() : null,
    lines,
    totalTax: null,
    total: formatMoney(amount ?? null),
  };
}
