import { ShopifyApiService } from './shopify-api.service';

describe('ShopifyApiService', () => {
  let svc: ShopifyApiService;

  beforeEach(() => {
    svc = new ShopifyApiService();
  });

  describe('buildBaseUrl', () => {
    it('returns HTTPS origin for myshopify.com domain', () => {
      const url = svc.buildBaseUrl('my-store.myshopify.com');
      expect(url).toBe('https://my-store.myshopify.com');
    });

    it('strips https:// prefix without doubling it', () => {
      const url = svc.buildBaseUrl('https://my-store.myshopify.com');
      expect(url).toBe('https://my-store.myshopify.com');
    });

    it('strips trailing slashes', () => {
      const url = svc.buildBaseUrl('https://my-store.myshopify.com/');
      expect(url).toBe('https://my-store.myshopify.com');
    });
  });

  describe('parseNextPageInfo (link header pagination)', () => {
    const parse = (header: string) => (svc as any).parseNextPageInfo(header) as string | null;

    it('parses next cursor from Link header', () => {
      const header =
        '<https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=cursor123&limit=250>; rel="next"';
      expect(parse(header)).toBe('cursor123');
    });

    it('returns null when only previous link present', () => {
      const header =
        '<https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=cursor123>; rel="previous"';
      expect(parse(header)).toBeNull();
    });

    it('handles combined previous + next header', () => {
      const header =
        '<https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=prev>; rel="previous",' +
        '<https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=next_cur>; rel="next"';
      expect(parse(header)).toBe('next_cur');
    });

    it('returns null for empty header', () => {
      expect(parse('')).toBeNull();
    });

    it('returns null for undefined header', () => {
      expect(parse(undefined as any)).toBeNull();
    });
  });
});
