import { Injectable } from '@nestjs/common';
import axios, { type Method } from 'axios';

const API_VER = process.env.GOOGLE_ADS_API_VERSION || 'v16';

/**
 * Google Ads API (REST) — developer token + OAuth access token.
 * @see https://developers.google.com/google-ads/api/docs/start
 */
@Injectable()
export class GoogleAdsApiService {
  private apiRoot(): string {
    return `https://googleads.googleapis.com/${API_VER}`;
  }

  async verifyAccess(developerToken: string, oauthAccessToken: string): Promise<void> {
    const dev = developerToken.trim();
    const oauth = oauthAccessToken.trim();
    if (!dev) throw new Error('Google Ads: пустой developer token');
    if (!oauth) throw new Error('Google Ads: пустой OAuth access token');
    const url = `${this.apiRoot()}/customers:listAccessibleCustomers`;
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${oauth}`,
        'developer-token': dev,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
      validateStatus: () => true,
    });
    const data = res.data;
    if (res.status < 200 || res.status >= 300) {
      const detail =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data ?? '');
      throw new Error(`Google Ads API: HTTP ${res.status} ${detail}`.slice(0, 600));
    }
  }

  async request(params: {
    developerToken: string;
    oauthAccessToken: string;
    method: string;
    /** Путь относительно версии API, например /customers/123/googleAds:search */
    path: string;
    body?: unknown;
  }): Promise<unknown> {
    const dev = params.developerToken.trim();
    const oauth = params.oauthAccessToken.trim();
    if (!dev) throw new Error('Google Ads: пустой developer token');
    if (!oauth) throw new Error('Google Ads: пустой OAuth access token');
    let path = params.path.trim();
    if (path.startsWith('https://')) {
      throw new Error('Google Ads: укажите относительный path, а не полный URL');
    }
    if (!path.startsWith('/')) path = `/${path}`;
    const url = `${this.apiRoot()}${path}`;
    const upper = String(params.method || 'POST').trim().toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) {
      throw new Error(`Google Ads: недопустимый HTTP-метод ${upper}`);
    }
    const method = upper as Method;
    const res = await axios.request({
      url,
      method,
      data:
        method !== 'GET' && method !== 'HEAD' && params.body !== undefined
          ? params.body
          : undefined,
      headers: {
        Authorization: `Bearer ${oauth}`,
        'developer-token': dev,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 45000,
      validateStatus: () => true,
    });
    const data = res.data;
    if (res.status < 200 || res.status >= 300) {
      const detail =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data ?? '');
      throw new Error(`Google Ads API: HTTP ${res.status} ${detail}`.slice(0, 600));
    }
    return data;
  }
}
