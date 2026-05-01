/** Origin сайта из ссылки Woo admin на заказ (если есть). */
function originFromWooAdminUrl(sale: Record<string, unknown>): string | null {
  const w = sale.wooAdminEditUrl;
  if (typeof w !== 'string' || !w.trim().startsWith('http')) return null;
  try {
    return new URL(w.trim()).origin;
  } catch {
    return null;
  }
}

/** Fallback: домен из подписи канала (hostname или URL). */
function originFromChannelSiteLabel(sale: Record<string, unknown>): string | null {
  const raw = sale.channelSiteLabel;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const withProto =
      /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

function shopOriginForFallback(sale: Record<string, unknown>): string | null {
  return originFromWooAdminUrl(sale) || originFromChannelSiteLabel(sale);
}

function lineItemsFromSale(sale: Record<string, unknown>): Record<string, unknown>[] {
  const raw = sale.rawPayload as Record<string, unknown> | undefined | null;
  if (!raw || typeof raw !== 'object') return [];
  const items = raw.line_items;
  if (!Array.isArray(items)) return [];
  return items.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
}

function tryHttp(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const u = v.trim();
  return /^https?:\/\//i.test(u) ? u : undefined;
}

function numId(v: unknown): number {
  const n =
    typeof v === 'string'
      ? Number(v.trim())
      : typeof v === 'number'
        ? v
        : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** Одна позиция Woo: permalink или product/variation id → ?p= или /product/slug/ */
function resolveLineProductUrl(
  line: Record<string, unknown>,
  origin: string | null,
): string | undefined {
  const direct =
    tryHttp(line.permalink) ||
    tryHttp(line.product_permalink) ||
    tryHttp(line.product_url);

  if (direct) return direct;

  const prod = line.product;
  if (prod && typeof prod === 'object') {
    const p = prod as Record<string, unknown>;
    const nested =
      tryHttp(p.permalink) ||
      tryHttp((p as { woocommerce_permalink?: string }).woocommerce_permalink);
    if (nested) return nested;

    const slug = typeof p.slug === 'string' ? p.slug.trim() : '';
    if (slug && origin) {
      const base = origin.replace(/\/+$/, '');
      return `${base}/product/${encodeURIComponent(slug)}/`;
    }
  }

  if (!origin) return undefined;

  const vid = numId(line.variation_id);
  const pid = numId(line.product_id);
  const postId = vid > 0 ? vid : pid > 0 ? pid : 0;
  if (postId > 0) return `${origin.replace(/\/+$/, '')}/?p=${postId}`;

  return undefined;
}

/**
 * Ссылка на страницу товара Woo:
 * notes (если URL), customFields.productUrl, затем rawPayload.line_items (все строки).
 */
export function extractSaleProductUrl(
  sale: Record<string, unknown>,
): string | undefined {
  const notes = typeof sale.notes === 'string' ? sale.notes.trim() : '';
  if (notes && /^https?:\/\//i.test(notes)) return notes;

  const cf =
    sale.customFields && typeof sale.customFields === 'object'
      ? (sale.customFields as Record<string, unknown>)
      : null;
  const cfRaw = cf?.productUrl ?? cf?.product_url;
  const cfUrl = typeof cfRaw === 'string' ? cfRaw.trim() : '';
  if (cfUrl && /^https?:\/\//i.test(cfUrl)) return cfUrl;

  const origin = shopOriginForFallback(sale);
  const lines = lineItemsFromSale(sale);

  for (const line of lines) {
    const url = resolveLineProductUrl(line, origin);
    if (url) return url;
  }

  return undefined;
}
