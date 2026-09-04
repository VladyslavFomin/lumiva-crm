// src/esign/esign-keys.ts
// Single source of truth for the {KEY} placeholder catalog used by "Мои документы" —
// templates are written with these keys, and the issue wizard substitutes them from
// the client's card, the manually entered contract fields, and the tenant's org profile.

export interface EsignKeyDef {
  key: string; // e.g. 'NAME' — without braces
  label: string;
}

export interface EsignKeyGroup {
  group: 'client' | 'contract' | 'org' | 'product' | 'service';
  keys: EsignKeyDef[];
}

export const ESIGN_CLIENT_KEYS: EsignKeyDef[] = [
  { key: 'NAME', label: 'ФИО клиента' },
  { key: 'FIRST_NAME', label: 'Имя' },
  { key: 'PHONE', label: 'Телефон' },
  { key: 'EMAIL', label: 'Почта' },
  { key: 'PASSPORT', label: 'Паспорт / ID' },
  { key: 'ADDRESS', label: 'Адрес' },
  { key: 'COMPANY', label: 'Компания клиента' },
  { key: 'TAX_ID', label: 'ИНН / VKN' },
  { key: 'COMPANY_REQUISITES', label: 'Реквизиты компании клиента' },
];

export const ESIGN_CONTRACT_KEYS: EsignKeyDef[] = [
  { key: 'CONTRACT_NO', label: 'Номер договора' },
  { key: 'CONTRACT_DATE', label: 'Дата договора' },
  { key: 'AMOUNT', label: 'Сумма' },
  { key: 'AMOUNT_WORDS', label: 'Сумма прописью' },
  { key: 'CURRENCY', label: 'Валюта' },
  { key: 'SERVICE', label: 'Предмет договора' },
  { key: 'TERM', label: 'Срок оказания' },
  { key: 'PAY_TERMS', label: 'Условия оплаты' },
];

export const ESIGN_ORG_KEYS: EsignKeyDef[] = [
  { key: 'ORG_NAME', label: 'Название компании' },
  { key: 'ORG_TAX', label: 'Реквизиты' },
  { key: 'MANAGER', label: 'Ответственный' },
  { key: 'TODAY', label: 'Текущая дата' },
];

/** Resolved from products picked in the issue wizard (see esign-items.ts) — {PRODUCT_*} always
 * describe the first picked product, {PRODUCTS_LIST}/{PRODUCTS_TOTAL} cover the whole pick. */
export const ESIGN_PRODUCT_KEYS: EsignKeyDef[] = [
  { key: 'PRODUCT_NAME', label: 'Название товара' },
  { key: 'PRODUCT_SKU', label: 'Артикул' },
  { key: 'PRODUCT_PRICE', label: 'Цена товара' },
  { key: 'PRODUCTS_LIST', label: 'Список товаров' },
  { key: 'PRODUCTS_TOTAL', label: 'Итого по товарам' },
];

/** Resolved from "Бронирования" services picked in the issue wizard — {BOOKING_SERVICE_*}
 * describe the first picked service (kept distinct from the free-text {SERVICE} key). */
export const ESIGN_SERVICE_KEYS: EsignKeyDef[] = [
  { key: 'BOOKING_SERVICE_NAME', label: 'Название услуги' },
  { key: 'BOOKING_SERVICE_PRICE', label: 'Цена услуги' },
  { key: 'BOOKING_SERVICE_DURATION', label: 'Длительность услуги' },
  { key: 'BOOKING_SERVICE_MASTER', label: 'Мастер / специалист' },
  { key: 'BOOKING_SERVICES_LIST', label: 'Список услуг' },
  { key: 'BOOKING_SERVICES_TOTAL', label: 'Итого по услугам' },
];

export const ESIGN_KEY_GROUPS: EsignKeyGroup[] = [
  { group: 'client', keys: ESIGN_CLIENT_KEYS },
  { group: 'contract', keys: ESIGN_CONTRACT_KEYS },
  { group: 'org', keys: ESIGN_ORG_KEYS },
  { group: 'product', keys: ESIGN_PRODUCT_KEYS },
  { group: 'service', keys: ESIGN_SERVICE_KEYS },
];

/** Keys resolved automatically from the client's card + org profile — never asked for manually. */
export const ESIGN_AUTO_KEYS = new Set<string>([...ESIGN_CLIENT_KEYS, ...ESIGN_ORG_KEYS].map((k) => k.key));

/** Keys resolved from picked products/booking-services — asked for via a search-and-pick
 * widget in the issue wizard, never a free-text input like the rest of the contract keys. */
export const ESIGN_ITEM_KEYS = new Set<string>([...ESIGN_PRODUCT_KEYS, ...ESIGN_SERVICE_KEYS].map((k) => k.key));

/** {CONTRACT_NO} is auto-assigned from the tenant's running sequence at issue time — never a
 * manual field, so it can't collide or go out of order. Kept in ESIGN_CONTRACT_KEYS so template
 * authors can still place it in text; excluded from the manual-fields step everywhere else. */
export const ESIGN_SEQUENCE_KEYS = new Set<string>(['CONTRACT_NO']);

export const ESIGN_KEY_LABEL: Record<string, string> = Object.fromEntries(
  [...ESIGN_CLIENT_KEYS, ...ESIGN_CONTRACT_KEYS, ...ESIGN_ORG_KEYS, ...ESIGN_PRODUCT_KEYS, ...ESIGN_SERVICE_KEYS].map((k) => [k.key, k.label]),
);

const KEY_TOKEN_RE = /\{([A-Z][A-Z0-9_]*)\}/g;

/** All distinct {KEY} tokens referenced in a template/document body. */
export function extractKeys(text: string): string[] {
  const found = text.match(KEY_TOKEN_RE) || [];
  return [...new Set(found.map((f) => f.slice(1, -1)))];
}

/** Substitutes {KEY} tokens with values. A missing/empty value leaves the token in place,
 * so an unfilled field stays visible as a mark in the exported document rather than a
 * silent gap — matches what the issue wizard's preview shows the user before export. */
export function renderKeys(text: string, values: Record<string, string | null | undefined>): string {
  return text.replace(KEY_TOKEN_RE, (m, key: string) => {
    const v = values[key];
    return v ? v : m;
  });
}
