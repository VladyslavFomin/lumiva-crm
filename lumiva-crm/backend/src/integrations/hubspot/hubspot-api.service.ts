import { Injectable } from '@nestjs/common';
import axios, { type Method } from 'axios';

const DEFAULT_BASE = 'https://api.hubapi.com';

/**
 * HubSpot — CRM API (private app / OAuth access token).
 * @see https://developers.hubspot.com/docs/api/overview
 */
@Injectable()
export class HubspotApiService {
  normalizeBaseUrl(url?: string): string {
    const raw = url?.trim();
    if (!raw) return DEFAULT_BASE;
    if (!raw.startsWith('https://')) {
      throw new Error('HubSpot: базовый URL API должен быть по HTTPS');
    }
    if (!raw.toLowerCase().includes('hubapi.com')) {
      throw new Error('HubSpot: ожидается хост api.hubapi.com или региональный api-eu1.hubapi.com и т.д.');
    }
    return raw.replace(/\/+$/, '');
  }

  async verifyAccess(accessToken: string, baseUrl?: string): Promise<void> {
    await this.request({
      baseUrl: this.normalizeBaseUrl(baseUrl),
      accessToken,
      method: 'GET',
      path: '/crm/v3/owners?limit=1',
      body: undefined,
    });
  }

  async request(params: {
    baseUrl: string;
    accessToken: string;
    method: string;
    path: string;
    body?: unknown;
  }): Promise<unknown> {
    const base = this.normalizeBaseUrl(params.baseUrl);
    let path = params.path.trim();
    if (!path.startsWith('/')) path = `/${path}`;
    const url = `${base}${path}`;
    const upper = String(params.method || 'GET').trim().toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) {
      throw new Error(`HubSpot: недопустимый HTTP-метод ${upper}`);
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
        Authorization: `Bearer ${params.accessToken.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    const data = res.data;
    if (res.status < 200 || res.status >= 300) {
      const detail =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data ?? '');
      throw new Error(`HubSpot: HTTP ${res.status} ${detail}`.slice(0, 600));
    }
    return data;
  }
}
