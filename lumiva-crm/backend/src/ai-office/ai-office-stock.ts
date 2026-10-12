/**
 * Склад для ИИ-отдела: остатки, пороги и расход за 30 дней по движениям склада. Все цифры («хватит на
 * N дней», «сколько дозаказать») считает система — модель их только читает. Без зависимостей от
 * сервисов: используется и пакетом данных отдела, и ежедневной программой stockWatch.
 */
type Q = { query: (sql: string, params?: unknown[]) => Promise<any[]> };
type Lang = 'ru' | 'en' | 'tr';

export type StockRow = {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  threshold: number | null;
  unit: string | null;
  /** списано продажами/расходом за 30 дней */
  out30: number;
  perDay: number;
  /** на сколько дней хватит при текущем темпе (null — расхода не было) */
  daysLeft: number | null;
  /** предложение системы: довести до запаса на 30 дней (и не ниже порога ×2) */
  suggestQty: number;
  state: 'out' | 'low' | 'soon' | 'ok';
};

/** Ниже порога / закончилось / закончится в ближайшие 14 дней — то, ради чего отделу вообще есть работа. */
export async function queryStock(db: Q, tenantId: string, limit = 60): Promise<{ total: number; rows: StockRow[] }> {
  const rows: any[] = await db.query(
    `WITH mv AS (
       SELECT "productId" pid, "variantId" vid, -sum("quantityDelta") out30
         FROM product_stock_movements
        WHERE "tenantId" = $1 AND "createdAt" >= now() - interval '30 days' AND type IN ('sale','out') AND "quantityDelta" < 0
        GROUP BY 1, 2),
     items AS (
       SELECT p.id pid, NULL::uuid vid, p.name, p.sku, p.quantity, p."lowStockThreshold" thr, p.unit
         FROM products p
        WHERE p."tenantId" = $1 AND p."isDeleted" = false AND p."isVariable" = false AND COALESCE(p.status, 'active') NOT IN ('archived','deleted','draft')
       UNION ALL
       SELECT p.id, v.id, p.name || ' / ' || COALESCE(v.sku, v.id::text), v.sku, v.quantity, p."lowStockThreshold", p.unit
         FROM product_variants v JOIN products p ON p.id = v."productId"
        WHERE p."tenantId" = $1 AND p."isDeleted" = false AND p."isVariable" = true AND COALESCE(p.status, 'active') NOT IN ('archived','deleted','draft'))
     SELECT i.*, COALESCE(mv.out30, 0) out30
       FROM items i LEFT JOIN mv ON mv.pid = i.pid AND mv.vid IS NOT DISTINCT FROM i.vid`,
    [tenantId],
  );
  const out: StockRow[] = rows.map((r) => {
    const quantity = Number(r.quantity) || 0;
    const threshold = r.thr === null || r.thr === undefined ? null : Number(r.thr);
    const out30 = Number(r.out30) || 0;
    const perDay = out30 / 30;
    const daysLeft = perDay > 0 ? Math.floor(quantity / perDay) : null;
    // ноль без порога и без движения — не складская позиция (услуга, цифровой товар), а не «закончилось»
    const tracked = threshold !== null || out30 > 0 || quantity > 0;
    const state: StockRow['state'] = !tracked
      ? 'ok'
      : quantity <= 0
        ? 'out'
        : threshold !== null && quantity <= threshold ? 'low' : daysLeft !== null && daysLeft <= 14 ? 'soon' : 'ok';
    const target = Math.max(Math.ceil(perDay * 30), (threshold ?? 0) * 2);
    return {
      productId: r.pid,
      variantId: r.vid ?? null,
      name: String(r.name ?? ''),
      sku: r.sku ?? null,
      quantity,
      threshold,
      unit: r.unit ?? null,
      out30,
      perDay: Math.round(perDay * 100) / 100,
      daysLeft,
      suggestQty: Math.max(0, target - quantity),
      state,
    };
  });
  const order = { out: 0, low: 1, soon: 2, ok: 3 } as const;
  const attention = out
    .filter((r) => r.state !== 'ok')
    .sort((a, b) => order[a.state] - order[b.state] || (a.daysLeft ?? 9e9) - (b.daysLeft ?? 9e9) || b.out30 - a.out30);
  return { total: out.length, rows: attention.slice(0, limit) };
}

const L = {
  ru: { h: 'Склад: позиции, требующие внимания', note: 'посчитано системой по остаткам и движениям за 30 дней', name: 'Позиция', qty: 'Остаток', thr: 'Порог', out: 'Расход 30 дн', days: 'Хватит, дн', sug: 'Дозаказать', st: { out: 'нет в наличии', low: 'ниже порога', soon: 'кончится ≤14 дн', ok: '' }, none: 'Все позиции в норме' },
  en: { h: 'Stock: items needing attention', note: 'computed by the system from stock levels and 30-day movements', name: 'Item', qty: 'In stock', thr: 'Threshold', out: 'Used 30 d', days: 'Lasts, d', sug: 'Reorder', st: { out: 'out of stock', low: 'below threshold', soon: 'runs out ≤14 d', ok: '' }, none: 'All items are fine' },
  tr: { h: 'Stok: dikkat gerektiren ürünler', note: 'stok seviyeleri ve 30 günlük hareketlerden sistem tarafından hesaplandı', name: 'Ürün', qty: 'Stok', thr: 'Eşik', out: '30 g çıkış', days: 'Yeter, g', sug: 'Sipariş', st: { out: 'stokta yok', low: 'eşiğin altında', soon: '≤14 g içinde biter', ok: '' }, none: 'Tüm ürünler normal' },
};

export function stockTable(lang: Lang, rows: StockRow[], max = 25): string {
  const t = L[lang];
  if (!rows.length) return `### ${t.h}\n\n${t.none}`;
  return [
    `### ${t.h}`,
    `_${t.note}_`,
    '',
    `| ${t.name} | ${t.qty} | ${t.thr} | ${t.out} | ${t.days} | ${t.sug} | |`,
    '|---|---|---|---|---|---|---|',
    ...rows.slice(0, max).map(
      (r) =>
        `| ${r.name.replace(/\|/g, '/')}${r.sku ? ` (${r.sku})` : ''} | ${r.quantity}${r.unit ? ` ${r.unit}` : ''} | ${r.threshold ?? '—'} | ${r.out30} | ${r.daysLeft ?? '—'} | ${r.suggestQty || '—'} | ${t.st[r.state]} |`,
    ),
  ].join('\n');
}

/** Email-адреса, которые отдел знает не с потолка: «Мозг» компании и контакты/компании CRM. */
export async function knownSupplierEmail(db: Q, tenantId: string, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const r: any[] = await db.query(
    `SELECT 1 FROM ai_brain_chunks WHERE tenant_id = $1 AND position($2 in lower(text)) > 0
     UNION ALL SELECT 1 FROM contacts WHERE "tenantId" = $1 AND lower(email) = $2
     UNION ALL SELECT 1 FROM companies WHERE "tenantId" = $1 AND lower(email) = $2
     LIMIT 1`,
    [tenantId, e],
  );
  return r.length > 0;
}

/**
 * Поставщики из «Мозга»: фрагменты документов, где есть слово «поставщик» и email. Отдел склада получает их
 * всегда, а не только если поиск по тексту задачи их найдёт, — без них заказ поставщику невозможен.
 */
export async function brainSuppliers(db: Q, tenantId: string, departmentId: string): Promise<string> {
  const rows: Array<{ name: string; text: string }> = await db.query(
    `SELECT f.name, c.text FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
      WHERE c.tenant_id = $1 AND (f.scope @> ARRAY['all']::text[] OR f.scope @> ARRAY[$2]::text[])
        AND c.text ~* '(поставщик|поставк|supplier|vendor|tedarik)' AND c.text ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}'
      ORDER BY f.updated_at DESC LIMIT 6`,
    [tenantId, departmentId],
  );
  return rows.map((r) => `[${r.name}]\n${r.text}`).join('\n\n').slice(0, 6000);
}
