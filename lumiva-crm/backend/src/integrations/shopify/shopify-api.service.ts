// src/integrations/shopify/shopify-api.service.ts
import { Injectable, Logger } from '@nestjs/common';

export type ShopifyOrder = {
  id: number | string;
  order_number?: number | string;
  name?: string; // "#1001"
  created_at?: string;
  processed_at?: string;
  currency?: string;
  total_price?: string;
  subtotal_price?: string;
  financial_status?: string; // pending|authorized|partially_paid|paid|partially_refunded|refunded|voided
  fulfillment_status?: string | null; // null|partial|fulfilled|restocked
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  note?: string | null;
  customer?: {
    id?: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  billing_address?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    country_code?: string;
    country?: string;
  };
  shipping_address?: {
    country_code?: string;
    country?: string;
  };
  line_items?: Array<{
    id?: number | string;
    product_id?: number | string;
    variant_id?: number | string;
    title?: string;
    name?: string;
    quantity?: number;
    price?: string;
  }>;
  [key: string]: unknown;
};

export type ShopifyShop = {
  id?: number;
  name?: string;
  email?: string;
  domain?: string;
  myshopify_domain?: string;
  currency?: string;
  [key: string]: unknown;
};

@Injectable()
export class ShopifyApiService {
  private readonly logger = new Logger(ShopifyApiService.name);

  buildBaseUrl(shopDomain: string): string {
    let domain = shopDomain.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(domain)) {
      domain = `https://${domain}`;
    }
    // Normalize to .myshopify.com if just a name given
    try {
      const u = new URL(domain);
      return u.origin;
    } catch {
      return `https://${domain}`;
    }
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'LumivaCRM-ShopifySync/1.0',
    };
  }

  async getShop(baseUrl: string, accessToken: string): Promise<ShopifyShop> {
    const url = `${baseUrl}/admin/api/2024-01/shop.json`;
    const res = await fetch(url, { headers: this.headers(accessToken) });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Доступ запрещён (401/403). Проверьте Access Token и права приложения.');
    }
    if (res.status === 404) {
      throw new Error('Магазин не найден (404). Проверьте домен магазина.');
    }
    if (!res.ok) {
      throw new Error(`Shopify API HTTP ${res.status}`);
    }
    const data = (await res.json()) as { shop: ShopifyShop };
    return data.shop;
  }

  /**
   * Fetch a page of orders. Returns orders array and next page cursor (if any).
   */
  async getOrdersPage(
    baseUrl: string,
    accessToken: string,
    params: { limit?: number; status?: string; pageInfo?: string },
  ): Promise<{ orders: ShopifyOrder[]; nextPageInfo: string | null }> {
    let url: string;
    if (params.pageInfo) {
      url = `${baseUrl}/admin/api/2024-01/orders.json?limit=${params.limit ?? 250}&page_info=${encodeURIComponent(params.pageInfo)}`;
    } else {
      url =
        `${baseUrl}/admin/api/2024-01/orders.json` +
        `?limit=${params.limit ?? 250}` +
        `&status=${params.status ?? 'any'}` +
        `&order=created_at+desc`;
    }

    this.logger.log(`Shopify GET ${url}`);
    const res = await fetch(url, { headers: this.headers(accessToken) });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Доступ запрещён (401/403). Проверьте Access Token и права приложения.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Shopify API HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as { orders: ShopifyOrder[] };
    const orders = Array.isArray(data.orders) ? data.orders : [];

    // Extract cursor-based pagination from Link header
    const linkHeader = res.headers.get('link') || '';
    const nextPageInfo = this.parseNextPageInfo(linkHeader);

    return { orders, nextPageInfo };
  }

  private parseNextPageInfo(linkHeader: string): string | null {
    if (!linkHeader) return null;
    // Format: <https://...&page_info=abc123>; rel="next"
    const parts = linkHeader.split(',');
    for (const part of parts) {
      if (part.includes('rel="next"')) {
        const match = part.match(/[?&]page_info=([^&>]+)/);
        if (match) return decodeURIComponent(match[1]);
      }
    }
    return null;
  }

  /**
   * Create a fulfillment for a Shopify order (marks it as fulfilled/shipped).
   * Used for bidirectional status sync: CRM "completed" → Shopify "fulfilled".
   */
  async createFulfillment(
    baseUrl: string,
    accessToken: string,
    orderId: string | number,
  ): Promise<void> {
    const url = `${baseUrl}/admin/api/2024-01/orders/${orderId}/fulfillments.json`;
    const body = JSON.stringify({ fulfillment: { notify_customer: false } });

    this.logger.log(`Shopify createFulfillment POST ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(accessToken),
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Shopify createFulfillment HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
    }
  }
}
