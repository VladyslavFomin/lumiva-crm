// src/esign/esign-items.ts
// Products and "Бронирования" (booking) services picked into a document — resolved and
// snapshotted server-side at issue time (never trust client-supplied prices in a contract).
// Mirrored on the frontend by computeItemValuesFE (EsignPage.tsx) for the live preview —
// keep both in sync.

export type EsignItemKind = 'product' | 'service';

export interface EsignItemPick {
  kind: EsignItemKind;
  refId: string;
  /** Only meaningful for kind: 'service' — which of the service's eligible staff performs it. */
  masterId?: string | null;
  /** Defaults to 1. */
  quantity?: number | null;
  /** Per-line discount, 0–100. Defaults to 0. */
  discountPercent?: number | null;
}

export interface EsignDocumentItem {
  kind: EsignItemKind;
  refId: string;
  name: string;
  sku?: string | null;
  /** Unit price from the catalog at issue time. */
  price: string;
  currency: string;
  durationMinutes?: number | null;
  masterId?: string | null;
  masterName?: string | null;
  /** Absent on documents issued before quantities existed — read as 1 / 0. */
  quantity?: number;
  discountPercent?: number;
}

/** Commercial-offer parameters entered in the issue wizard; stored in the document's
 * extraFields under these keys (not template placeholders, so never asked as manual fields). */
export const ESIGN_QUOTE_PARAM_KEYS = ['DISCOUNT_PERCENT', 'TAX_PERCENT', 'VALID_UNTIL'] as const;

export interface QuoteParams {
  discountPercent?: number;
  taxPercent?: number;
  /** YYYY-MM-DD */
  validUntil?: string | null;
  lang?: string | null;
}

const money = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

export const itemQty = (i: EsignDocumentItem) => (i.quantity && i.quantity > 0 ? i.quantity : 1);
export const itemDiscount = (i: EsignDocumentItem) => (i.discountPercent && i.discountPercent > 0 ? Math.min(i.discountPercent, 100) : 0);
export const itemLineTotal = (i: EsignDocumentItem) => round2(parseFloat(i.price) * itemQty(i) * (1 - itemDiscount(i) / 100));

/** Parses a user-entered percent ("10", "12,5", "") into 0–100. */
export function parsePercent(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(',', '.').replace('%', '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 100);
}

/** Sum of line totals, grouped by currency — "1 200 EUR + 300 USD" when mixed (summing
 * across currencies into one number would be wrong). */
function totalsByCurrency(items: EsignDocumentItem[]): string {
  const byCur = new Map<string, number>();
  for (const i of items) byCur.set(i.currency, (byCur.get(i.currency) || 0) + itemLineTotal(i));
  return [...byCur.entries()].map(([cur, sum]) => `${money(round2(sum))} ${cur}`).join(' + ');
}

function lineLabel(i: EsignDocumentItem): string {
  const qty = itemQty(i);
  const disc = itemDiscount(i);
  const unit = `${money(parseFloat(i.price))} ${i.currency}`;
  if (qty === 1 && !disc) return unit;
  return `${qty} × ${unit}${disc ? ` −${disc}%` : ''} = ${money(itemLineTotal(i))} ${i.currency}`;
}

const QUOTE_HEADERS: Record<string, string[]> = {
  ru: ['№', 'Наименование', 'Кол-во', 'Цена', 'Скидка', 'Сумма'],
  en: ['#', 'Item', 'Qty', 'Price', 'Discount', 'Amount'],
  tr: ['No', 'Ürün / Hizmet', 'Miktar', 'Fiyat', 'İndirim', 'Tutar'],
};
const LOCALES: Record<string, string> = { ru: 'ru-RU', en: 'en-US', tr: 'tr-TR' };

export function normalizeDocLang(lang?: string | null): 'ru' | 'en' | 'tr' {
  const l = (lang || 'ru').slice(0, 2).toLowerCase();
  return l === 'en' || l === 'tr' ? l : 'ru';
}

/** Renders the {PRODUCT_*}/{BOOKING_SERVICE_*}/{QUOTE_*} key values from a resolved item list.
 * First product/service fills the singular keys, the full pick fills *_LIST/*_TOTAL, and the
 * {QUOTE_*} group is the commercial-offer table + totals (single currency only — `quoteError`
 * is set when items mix currencies). {QUOTE_ITEMS} is a tab-separated table: the PDF renderer
 * and the document views draw consecutive tab-separated lines as a real table. */
export function computeItemValues(
  items: EsignDocumentItem[],
  params: QuoteParams = {},
): { values: Record<string, string>; quoteError: 'mixed_currency' | null } {
  const values: Record<string, string> = {};
  const products = items.filter((i) => i.kind === 'product');
  const services = items.filter((i) => i.kind === 'service');

  if (products[0]) {
    values.PRODUCT_NAME = products[0].name;
    values.PRODUCT_SKU = products[0].sku || '';
    values.PRODUCT_PRICE = `${money(parseFloat(products[0].price))} ${products[0].currency}`;
  }
  if (products.length) {
    values.PRODUCTS_LIST = products.map((p) => `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${lineLabel(p)}`).join('\n');
    values.PRODUCTS_TOTAL = totalsByCurrency(products);
  }

  if (services[0]) {
    values.BOOKING_SERVICE_NAME = services[0].name;
    values.BOOKING_SERVICE_PRICE = `${money(parseFloat(services[0].price))} ${services[0].currency}`;
    values.BOOKING_SERVICE_DURATION = services[0].durationMinutes ? `${services[0].durationMinutes} мин` : '';
    values.BOOKING_SERVICE_MASTER = services[0].masterName || '';
  }
  if (services.length) {
    values.BOOKING_SERVICES_LIST = services.map((s) => `${s.name}${s.masterName ? ` (${s.masterName})` : ''} — ${lineLabel(s)}`).join('\n');
    values.BOOKING_SERVICES_TOTAL = totalsByCurrency(services);
  }

  const lang = normalizeDocLang(params.lang);
  if (params.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(params.validUntil)) {
    const [y, m, d] = params.validUntil.split('-');
    values.VALID_UNTIL = lang === 'en' ? `${m}/${d}/${y}` : `${d}.${m}.${y}`;
  }

  let quoteError: 'mixed_currency' | null = null;
  const all = [...products, ...services];
  if (all.length) {
    const currencies = new Set(all.map((i) => i.currency));
    if (currencies.size > 1) {
      quoteError = 'mixed_currency';
    } else {
      const cur = all[0].currency;
      const fmt = (n: number) => `${n.toLocaleString(LOCALES[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
      const subtotal = round2(all.reduce((s, i) => s + itemLineTotal(i), 0));
      const dp = params.discountPercent || 0;
      const discount = round2((subtotal * dp) / 100);
      const net = round2(subtotal - discount);
      const tp = params.taxPercent || 0;
      const tax = round2((net * tp) / 100);
      const total = round2(net + tax);

      const rows = all.map((i, idx) => {
        const name = i.kind === 'service' && i.masterName ? `${i.name} (${i.masterName})` : `${i.name}${i.sku ? ` (${i.sku})` : ''}`;
        const disc = itemDiscount(i);
        return [String(idx + 1), name, String(itemQty(i)), fmt(parseFloat(i.price)), disc ? `${disc}%` : '—', fmt(itemLineTotal(i))].join('\t');
      });
      values.QUOTE_ITEMS = [QUOTE_HEADERS[lang].join('\t'), ...rows].join('\n');
      values.QUOTE_SUBTOTAL = fmt(subtotal);
      values.QUOTE_DISCOUNT = dp ? `${dp}% — ${fmt(discount)}` : '—';
      values.QUOTE_TAX = tp ? `${tp}% — ${fmt(tax)}` : '—';
      values.QUOTE_TOTAL = fmt(total);
      values.QUOTE_TOTAL_NUMBER = total.toFixed(2);
      values.QUOTE_CURRENCY = cur;
    }
  }

  return { values, quoteError };
}
