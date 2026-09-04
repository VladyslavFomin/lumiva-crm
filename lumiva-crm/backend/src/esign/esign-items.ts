// src/esign/esign-items.ts
// Products and "Бронирования" (booking) services picked into a document — resolved and
// snapshotted server-side at issue time (never trust client-supplied prices in a contract).

export type EsignItemKind = 'product' | 'service';

export interface EsignItemPick {
  kind: EsignItemKind;
  refId: string;
  /** Only meaningful for kind: 'service' — which of the service's eligible staff performs it. */
  masterId?: string | null;
}

export interface EsignDocumentItem {
  kind: EsignItemKind;
  refId: string;
  name: string;
  sku?: string | null;
  price: string;
  currency: string;
  durationMinutes?: number | null;
  masterId?: string | null;
  masterName?: string | null;
}

const money = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/** Renders the {PRODUCT_*}/{BOOKING_SERVICE_*} key values from a resolved item list — first
 * product/service pick fills the singular keys, the full pick fills the *_LIST/*_TOTAL keys. */
export function computeItemValues(items: EsignDocumentItem[]): Record<string, string> {
  const values: Record<string, string> = {};
  const products = items.filter((i) => i.kind === 'product');
  const services = items.filter((i) => i.kind === 'service');

  if (products[0]) {
    values.PRODUCT_NAME = products[0].name;
    values.PRODUCT_SKU = products[0].sku || '';
    values.PRODUCT_PRICE = `${money(parseFloat(products[0].price))} ${products[0].currency}`;
  }
  if (products.length) {
    values.PRODUCTS_LIST = products.map((p) => `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${money(parseFloat(p.price))} ${p.currency}`).join('\n');
    values.PRODUCTS_TOTAL = `${money(products.reduce((s, p) => s + parseFloat(p.price), 0))} ${products[0].currency}`;
  }

  if (services[0]) {
    values.BOOKING_SERVICE_NAME = services[0].name;
    values.BOOKING_SERVICE_PRICE = `${money(parseFloat(services[0].price))} ${services[0].currency}`;
    values.BOOKING_SERVICE_DURATION = services[0].durationMinutes ? `${services[0].durationMinutes} мин` : '';
    values.BOOKING_SERVICE_MASTER = services[0].masterName || '';
  }
  if (services.length) {
    values.BOOKING_SERVICES_LIST = services
      .map((s) => `${s.name}${s.masterName ? ` (${s.masterName})` : ''} — ${money(parseFloat(s.price))} ${s.currency}`)
      .join('\n');
    values.BOOKING_SERVICES_TOTAL = `${money(services.reduce((s, x) => s + parseFloat(x.price), 0))} ${services[0].currency}`;
  }

  return values;
}
