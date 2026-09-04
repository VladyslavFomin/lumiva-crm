import { Injectable } from '@nestjs/common';
import axios, { type Method } from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

const DEFAULT_BASE = 'https://api.hubapi.com';

/**
 * HubSpot — CRM API (private app / OAuth access token).
 * @see https://developers.hubspot.com/docs/api/overview
 */
@Injectable()
export class HubspotApiService {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<{ accessToken: string; expiresIn?: number }> {
    const rt = params.refreshToken.trim();
    if (!rt) throw new Error('HubSpot: пустой refresh token');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: rt,
    });
    const res = await axios.post('https://api.hubapi.com/oauth/v1/token', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`HubSpot OAuth refresh: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    const accessToken = String(res.data?.access_token ?? '').trim();
    if (!accessToken) {
      throw new Error('HubSpot OAuth refresh: нет access_token в ответе');
    }
    const expiresIn =
      typeof res.data?.expires_in === 'number' ? res.data.expires_in : undefined;
    return { accessToken, expiresIn };
  }

  /**
   * Access token из поля apiToken (ручной private app token) либо свежий через oauthRefreshToken
   * (платформенный OAuth-клиент HubSpot) — тот же паттерн, что и Google Calendar.
   */
  async resolveAccessFromConfig(cfg: {
    apiToken?: string;
    oauthRefreshToken?: string;
  }): Promise<string | null> {
    const rt = typeof cfg.oauthRefreshToken === 'string' ? cfg.oauthRefreshToken.trim() : '';
    if (rt) {
      const { clientId, clientSecret } =
        await this.platformSettings.getGenericIntegrationOAuthConfig('hubspot');
      if (!clientId || !clientSecret) return null;
      const { accessToken } = await this.refreshAccessToken({
        clientId,
        clientSecret,
        refreshToken: rt,
      });
      return accessToken;
    }
    const tok = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    return tok || null;
  }

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
