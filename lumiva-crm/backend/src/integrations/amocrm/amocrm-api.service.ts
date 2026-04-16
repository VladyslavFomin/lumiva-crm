import { Injectable } from '@nestjs/common';
import axios, { type Method } from 'axios';

/**
 * amoCRM — API v4 (Bearer).
 * Базовый URL: https://&lt;поддомен&gt;.amocrm.ru (или .com / .kz).
 * @see https://www.amocrm.ru/developers/content/crm_platform/api-reference
 */
@Injectable()
export class AmocrmApiService {
  normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private validateBaseUrl(url: string): void {
    const u = url.trim().toLowerCase();
    if (!u.startsWith('https://')) {
      throw new Error('amoCRM: базовый URL должен быть по HTTPS');
    }
    if (!u.includes('amocrm.')) {
      throw new Error('amoCRM: ожидается хост вида *.amocrm.ru, *.amocrm.com или *.amocrm.kz');
    }
  }

  async verifyAccess(baseUrl: string, accessToken: string): Promise<void> {
    await this.request({
      baseUrl,
      accessToken,
      method: 'GET',
      path: '/api/v4/account',
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
    this.validateBaseUrl(params.baseUrl);
    const base = this.normalizeBaseUrl(params.baseUrl);
    let path = params.path.trim();
    if (!path.startsWith('/')) path = `/${path}`;
    const url = `${base}${path}`;
    const upper = String(params.method || 'GET').trim().toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) {
      throw new Error(`amoCRM: недопустимый HTTP-метод ${upper}`);
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
      throw new Error(`amoCRM: HTTP ${res.status} ${detail}`.slice(0, 600));
    }
    return data;
  }
}
