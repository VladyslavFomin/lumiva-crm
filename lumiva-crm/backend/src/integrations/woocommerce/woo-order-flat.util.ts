/**
 * Плоские строковые колонки из ответа WooCommerce REST API /orders для превью и импорта.
 * Ключи стабильны между заказами (пустая строка если нет значения).
 */

import {
  formatDecimalForFlat,
  parseDecimalString,
} from '../../lib/locale-number.util';

function s(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function trunc(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

/** Сумма из meta позиции заказа (WC часто кладёт реальную сумму в _line_total, а total в JSON — 0). */
function lineItemAmountFromMeta(li: Record<string, any>): number | null {
  const md = li.meta_data;
  if (!Array.isArray(md)) return null;
  const prefer = [
    '_line_total',
    'line_total',
    '_line_subtotal',
    'line_subtotal',
  ];
  for (const pk of prefer) {
    for (const entry of md) {
      const key = entry?.key != null ? String(entry.key) : '';
      if (key !== pk) continue;
      const v = parseDecimalString(entry?.value);
      if (v !== null && Math.abs(v) > 1e-9) return v;
    }
  }
  return null;
}

/** Вклад строки заказа: WC часто отдаёт пустой line_item.total, но заполняет subtotal или price×qty. */
function lineItemContributedAmount(li: Record<string, any>): number | null {
  if (!li || typeof li !== 'object') return null;
  const t = parseDecimalString(li.total);
  if (t !== null && Math.abs(t) > 1e-9) return t;
  const st =
    parseDecimalString(li.subtotal) ??
    parseDecimalString(li.sub_total);
  if (st !== null && Math.abs(st) > 1e-9) return st;
  const qty = parseDecimalString(li.quantity) ?? 1;
  const unit =
    parseDecimalString(li.price) ??
    parseDecimalString((li as { unit_price?: unknown }).unit_price);
  if (unit !== null && qty > 0) return unit * qty;
  const fromMeta = lineItemAmountFromMeta(li);
  if (fromMeta !== null && Math.abs(fromMeta) > 1e-9) return fromMeta;
  if (t !== null) return t;
  return st;
}

const ORDER_TOTAL_META_KEYS = new Set([
  '_order_total',
  'order_total',
  '_cart_total',
  'cart_total',
  'total_amount',
  '_order_total_base_currency',
  '_wc_order_total',
  'order_amount',
]);

/** Итог из meta_data (плагины / старые заказы), когда «total» в корне 0. */
export function orderTotalFromMeta(order: Record<string, any>): number | null {
  const md = order.meta_data;
  if (!Array.isArray(md)) return null;
  for (const entry of md) {
    const key = entry?.key != null ? String(entry.key) : '';
    if (!ORDER_TOTAL_META_KEYS.has(key)) continue;
    const v = parseDecimalString(entry?.value);
    if (v !== null && v > 0) return v;
  }
  return null;
}

function orderShippingAmount(order: Record<string, any>): number {
  let ship = parseDecimalString(order.shipping_total) ?? 0;
  if (ship > 0) return ship;
  const lines = Array.isArray(order.shipping_lines) ? order.shipping_lines : [];
  for (const sl of lines) {
    const v = parseDecimalString((sl as { total?: unknown })?.total);
    if (v !== null) ship += v;
  }
  return ship;
}

function orderTaxRollup(order: Record<string, any>): number {
  const direct = parseDecimalString(order.total_tax);
  if (direct !== null && direct > 0) return direct;
  const tl = Array.isArray(order.tax_lines) ? order.tax_lines : [];
  let s = 0;
  for (const row of tl) {
    const r = row as { tax_total?: unknown; shipping_tax_total?: unknown };
    const a = parseDecimalString(r.tax_total);
    if (a !== null) s += a;
    const b = parseDecimalString(r.shipping_tax_total);
    if (b !== null) s += b;
  }
  return s;
}

/**
 * Когда суммы по позициям в REST — 0, но заказ реально оплачен: пробуем корневой subtotal + доставка + налоги − скидка + fees.
 */
function orderTotalFromOrderScalars(order: Record<string, any>): number | null {
  const sub = parseDecimalString(order.subtotal);
  if (sub === null || sub <= 0) return null;
  const ship = orderShippingAmount(order);
  const disc = parseDecimalString(order.discount_total) ?? 0;
  const tax = orderTaxRollup(order);
  const feeLines = Array.isArray(order.fee_lines) ? order.fee_lines : [];
  let fees = 0;
  for (const f of feeLines) {
    const v = parseDecimalString((f as { total?: unknown }).total);
    if (v !== null) fees += v;
  }
  const candidate = sub - disc + ship + tax + fees;
  return candidate > 0 ? candidate : null;
}

/** Итог заказа из позиций + доставка + fee_lines (если корневой total пустой/0). */
export function computeWooOrderTotalNumber(order: Record<string, any>): number | null {
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  let fromLines = 0;
  for (const li of lineItems) {
    const v = lineItemContributedAmount(li as Record<string, any>);
    if (v !== null) fromLines += v;
  }
  const ship = orderShippingAmount(order);
  const feeLines = Array.isArray(order.fee_lines) ? order.fee_lines : [];
  let fees = 0;
  for (const f of feeLines) {
    const v = parseDecimalString((f as { total?: unknown }).total);
    if (v !== null) fees += v;
  }
  const sum = fromLines + ship + fees;
  if (sum > 0) return sum;
  const fromScalars = orderTotalFromOrderScalars(order);
  if (fromScalars !== null && fromScalars > 0) return fromScalars;
  return null;
}

function wooOrderTotalCell(order: Record<string, any>): string {
  return formatDecimalForFlat(wooOrderTotalNumber(order));
}

/** Единая логика: корневой total → meta (_order_total и др.) → сумма позиций + доставка + fees. Стат заказа на это не влияет. */
export function wooOrderTotalNumber(order: Record<string, any>): number {
  const parsed = parseDecimalString(order.total);
  if (parsed !== null && parsed > 0) return parsed;
  const fromMeta = orderTotalFromMeta(order);
  if (fromMeta !== null && fromMeta > 0) return fromMeta;
  const computed = computeWooOrderTotalNumber(order);
  if (computed !== null && computed > 0) return computed;
  return parsed ?? 0;
}

export function flattenWooOrder(order: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  const billing = order.billing && typeof order.billing === 'object' ? order.billing : {};
  const shipping = order.shipping && typeof order.shipping === 'object' ? order.shipping : {};
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  const scalars: Array<[string, unknown]> = [
    ['id', order.id],
    /** Дублирует id заказа; при агрегации строк `id` перезаписывается синтетическим ключом — order_id остаётся номером заказа. */
    ['order_id', order.id],
    ['parent_id', order.parent_id],
    ['number', order.number],
    ['order_key', order.order_key],
    ['status', order.status],
    ['currency', order.currency],
    ['version', order.version],
    ['prices_include_tax', order.prices_include_tax],
    ['date_created', order.date_created],
    ['date_modified', order.date_modified],
    ['date_created_gmt', order.date_created_gmt],
    ['date_modified_gmt', order.date_modified_gmt],
    ['date_completed', order.date_completed],
    ['date_paid', order.date_paid],
    ['discount_total', order.discount_total],
    ['discount_tax', order.discount_tax],
    ['shipping_total', order.shipping_total],
    ['shipping_tax', order.shipping_tax],
    ['cart_tax', order.cart_tax],
    /** Подытог по товарам до скидок (корень заказа); полезно, если total в REST 0. */
    ['subtotal', order.subtotal],
    ['total', wooOrderTotalCell(order)],
    ['total_tax', order.total_tax],
    ['customer_id', order.customer_id],
    ['customer_note', order.customer_note],
    ['payment_method', order.payment_method],
    ['payment_method_title', order.payment_method_title],
    ['transaction_id', order.transaction_id],
    ['customer_ip_address', order.customer_ip_address],
    ['customer_user_agent', order.customer_user_agent],
    ['created_via', order.created_via],
    ['cart_hash', order.cart_hash],
    ['currency_symbol', order.currency_symbol],
  ];

  for (const [k, v] of scalars) {
    out[k] = s(v);
  }

  const billKeys = [
    'first_name',
    'last_name',
    'company',
    'address_1',
    'address_2',
    'city',
    'state',
    'postcode',
    'country',
    'email',
    'phone',
  ] as const;
  for (const bk of billKeys) {
    out[`billing_${bk}`] = s((billing as any)[bk]);
  }
  for (const bk of billKeys) {
    out[`shipping_${bk}`] = s((shipping as any)[bk]);
  }

  const first = lineItems[0] && typeof lineItems[0] === 'object' ? lineItems[0] : {};
  out.line_item_first_id = s((first as any).id);
  out.line_item_first_name = s((first as any).name);
  out.line_item_first_product_id = s((first as any).product_id);
  out.line_item_first_sku = s((first as any).sku);
  out.line_item_first_quantity = s((first as any).quantity);
  const firstLineAmt = lineItemContributedAmount(first as Record<string, any>);
  out.line_item_first_total =
    firstLineAmt !== null ? formatDecimalForFlat(firstLineAmt) : s((first as any).total);
  out.line_item_first_subtotal = s((first as any).subtotal);
  out.line_item_first_permalink = s((first as any).permalink);

  const names = lineItems
    .map((li: any) => (li && li.name ? String(li.name).trim() : ''))
    .filter(Boolean);
  /** Каждая позиция с новой строки (в таблице — textarea / whitespace-pre-line). */
  out.line_items_names_joined = trunc(names.join('\n'), 4000);
  out.line_items_count = s(lineItems.length);

  if (Array.isArray(order.meta_data)) {
    const pairs = (order.meta_data as { key?: string; value?: unknown }[])
      .slice(0, 40)
      .map((m) => `${m.key ?? ''}=${s(m.value)}`)
      .join(' | ');
    out.meta_data_summary = trunc(pairs, 4000);
  } else {
    out.meta_data_summary = '';
  }

  out.raw_line_items_json = trunc(JSON.stringify(lineItems), 8000);

  return out;
}

/**
 * Порядок применения колонок Woo → одно поле CRM: больший rank записывается последним и «побеждает».
 * Иначе line_item_first_total (часто 0) может затереть заказной total (796), если оба смаплены в одно поле.
 */
export function wooImportColumnApplicationRank(sourceCol: string): number {
  const c = String(sourceCol || '').trim();
  if (c === 'total') return 1_000_000;
  if (c === 'subtotal') return 900_000;
  if (c === 'order_id' || c === 'id') return 800_000;
  if (c === 'number') return 400_000;
  if (c.startsWith('line_item_first_')) return 10_000;
  if (c.startsWith('line_item_')) return 20_000;
  return 100_000;
}

/** Объединение ключей из нескольких заказов (стабильный порядок для колонок). */
export function mergeColumnKeys(rows: Record<string, string>[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    Object.keys(r).forEach((k) => set.add(k));
  }
  const preferred = [
    'id',
    'order_id',
    'number',
    'status',
    'currency',
    'subtotal',
    'total',
    'date_created',
    'date_paid',
    'payment_method_title',
    'customer_note',
    'billing_email',
    'billing_first_name',
    'billing_last_name',
    'billing_phone',
    'billing_city',
    'billing_country',
    'shipping_country',
    'line_item_first_name',
    'line_item_first_total',
    'line_items_names_joined',
    'line_items_count',
  ];
  const rest = [...set].filter((k) => !preferred.includes(k));
  rest.sort((a, b) => a.localeCompare(b));
  const cols = [...preferred.filter((k) => set.has(k)), ...rest];
  return cols;
}
