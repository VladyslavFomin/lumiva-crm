import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ReputationSettingsService } from './reputation-settings.service';

const STATE_TTL_SEC = 15 * 60;
const SCOPES = ['https://www.googleapis.com/auth/business.manage', 'openid', 'email'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Google Business Profile: отзывы живут только в старом API v4 (mybusiness.googleapis.com/v4),
 * аккаунты/локации — в v1 (Account Management / Business Information), уведомления — Notifications API.
 * Квота без одобрения заявки = 0, поэтому ошибки 403/429 отдаём наружу понятным текстом.
 */
@Injectable()
export class GoogleBusinessService {
  private readonly log = new Logger(GoogleBusinessService.name);
  private readonly tokenCache = new Map<string, { token: string; exp: number }>();

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly settings: ReputationSettingsService,
  ) {}

  private redirectUri(): string {
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) throw new BadRequestException('PUBLIC_API_URL is not set — Google redirect_uri cannot be built');
    return `${apiBase}/v1/public/hotel-reputation/google/callback`;
  }

  private sign(payload: string) {
    return createHmac('sha256', process.env.JWT_SECRET || 'x').update(`gbp:${payload}`).digest('base64url');
  }

  async authUrl(tenantId: string): Promise<string> {
    const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) throw new BadRequestException('Google OAuth client is not configured on the platform (pl1 → settings)');
    const payload = Buffer.from(JSON.stringify({ t: tenantId, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC })).toString('base64url');
    const state = `${payload}.${this.sign(payload)}`;
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES.join(' '),
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  }

  private verifyState(state: string): string | null {
    const [payload, sig] = String(state || '').split('.');
    if (!payload || !sig) return null;
    const a = Buffer.from(sig);
    const b = Buffer.from(this.sign(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!d?.t || typeof d.exp !== 'number' || d.exp < Date.now() / 1000) return null;
      return String(d.t);
    } catch {
      return null;
    }
  }

  /** OAuth callback: сохраняем refresh-токен (зашифрованным), почту аккаунта и первый аккаунт GBP. */
  async completeOAuth(code: string, state: string): Promise<{ ok: boolean; error?: string; tenantId?: string }> {
    const tenantId = this.verifyState(state);
    if (!tenantId) return { ok: false, error: 'bad_state' };
    const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: this.redirectUri(), grant_type: 'authorization_code' }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      const refresh = res.data?.refresh_token as string | undefined;
      if (!refresh) return { ok: false, error: 'no_refresh_token', tenantId };
      await this.settings.setSecret(tenantId, 'googleRefreshToken', refresh);
      this.tokenCache.set(tenantId, { token: res.data.access_token, exp: Date.now() + (Number(res.data.expires_in || 3000) - 60) * 1000 });
      let email: string | null = null;
      try {
        const idt = String(res.data.id_token || '').split('.')[1];
        email = idt ? JSON.parse(Buffer.from(idt, 'base64url').toString('utf8')).email || null : null;
      } catch {
        /* без почты */
      }
      const cfg = await this.settings.config(tenantId);
      let accountName = cfg.google.accountName;
      try {
        const accounts = await this.listAccounts(tenantId);
        if (!accountName || !accounts.some((a) => a.name === accountName)) accountName = accounts[0]?.name || null;
      } catch (e: any) {
        this.log.warn(`GBP accounts after OAuth: ${e?.message || e}`);
      }
      await this.settings.patchConfig(tenantId, {
        google: { ...cfg.google, accountEmail: email, accountName, connectedAt: new Date().toISOString() },
      } as any);
      return { ok: true, tenantId };
    } catch (e: any) {
      this.log.warn(`GBP OAuth exchange failed: ${e?.response?.data?.error || e?.message}`);
      return { ok: false, error: 'exchange_failed', tenantId };
    }
  }

  async disconnect(tenantId: string) {
    await this.settings.setSecret(tenantId, 'googleRefreshToken', null);
    this.tokenCache.delete(tenantId);
    const cfg = await this.settings.config(tenantId);
    await this.settings.patchConfig(tenantId, { google: { ...cfg.google, accountEmail: null, connectedAt: null, notificationsOk: false } } as any);
  }

  async isConnected(tenantId: string) {
    return !!(await this.settings.secret(tenantId, 'googleRefreshToken'));
  }

  private async token(tenantId: string): Promise<string> {
    const c = this.tokenCache.get(tenantId);
    if (c && c.exp > Date.now()) return c.token;
    const refresh = await this.settings.secret(tenantId, 'googleRefreshToken');
    if (!refresh) throw new BadRequestException({ code: 'GBP_NOT_CONNECTED', message: 'Google Business Profile is not connected' });
    const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({ refresh_token: refresh, client_id: clientId!, client_secret: clientSecret!, grant_type: 'refresh_token' }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      const token = res.data.access_token as string;
      this.tokenCache.set(tenantId, { token, exp: Date.now() + (Number(res.data.expires_in || 3000) - 60) * 1000 });
      return token;
    } catch (e: any) {
      const err = e?.response?.data?.error;
      throw new BadRequestException({
        code: 'GBP_TOKEN',
        message: err === 'invalid_grant' ? 'Google access was revoked — reconnect Google Business Profile' : `Google token refresh failed: ${err || e?.message}`,
      });
    }
  }

  /** Запрос с повтором при 429/5xx (пауза растёт). Лимит ответов — 10/мин на профиль, поэтому пауза щедрая. */
  private async call<T = any>(tenantId: string, cfg: AxiosRequestConfig, attempt = 0): Promise<T> {
    const token = await this.token(tenantId);
    try {
      const res = await axios.request<T>({ timeout: 30_000, ...cfg, headers: { ...(cfg.headers || {}), Authorization: `Bearer ${token}` } });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      if ((status === 429 || status >= 500) && attempt < 4) {
        await sleep(Math.min(60_000, 2000 * 2 ** attempt + Math.random() * 1000));
        return this.call<T>(tenantId, cfg, attempt + 1);
      }
      if (status === 401 && attempt === 0) {
        this.tokenCache.delete(tenantId);
        return this.call<T>(tenantId, cfg, attempt + 1);
      }
      const msg = e?.response?.data?.error?.message || e?.message || String(e);
      const code = status === 403 || /quota/i.test(msg) ? 'GBP_FORBIDDEN' : status === 429 ? 'GBP_RATE_LIMIT' : 'GBP_ERROR';
      const err = new BadRequestException({ code, message: `Google ${status || ''}: ${msg}`.trim() });
      (err as any).httpStatus = status;
      throw err;
    }
  }

  async listAccounts(tenantId: string): Promise<Array<{ name: string; accountName: string; type: string }>> {
    const d = await this.call<any>(tenantId, { method: 'GET', url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts' });
    return (d?.accounts || []).map((a: any) => ({ name: a.name, accountName: a.accountName || a.name, type: a.type || '' }));
  }

  /** Локации аккаунта → путь v4 accounts/{a}/locations/{l} для привязки к отелю. */
  async listLocations(tenantId: string, accountName?: string | null) {
    const cfg = await this.settings.config(tenantId);
    const account = accountName || cfg.google.accountName;
    if (!account) throw new BadRequestException('No Google Business account selected');
    const out: Array<{ path: string; title: string; address: string | null; mapsUri: string | null }> = [];
    let pageToken: string | undefined;
    for (let i = 0; i < 20; i++) {
      const d = await this.call<any>(tenantId, {
        method: 'GET',
        url: `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations`,
        params: { readMask: 'name,title,storefrontAddress,metadata', pageSize: 100, pageToken },
      });
      for (const l of d?.locations || []) {
        const a = l.storefrontAddress;
        out.push({
          path: `${account}/${l.name}`,
          title: l.title || l.name,
          address: a ? [...(a.addressLines || []), a.locality].filter(Boolean).join(', ') : null,
          mapsUri: l.metadata?.mapsUri || null,
        });
      }
      pageToken = d?.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }

  /** Страница отзывов (до 50), по умолчанию свежие обновлённые первыми. */
  async listReviews(tenantId: string, locationPath: string, pageToken?: string) {
    return this.call<{ reviews?: any[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string }>(tenantId, {
      method: 'GET',
      url: `https://mybusiness.googleapis.com/v4/${locationPath}/reviews`,
      params: { pageSize: 50, pageToken, orderBy: 'updateTime desc' },
    });
  }

  async getReview(tenantId: string, reviewName: string) {
    return this.call<any>(tenantId, { method: 'GET', url: `https://mybusiness.googleapis.com/v4/${reviewName}` });
  }

  async reply(tenantId: string, locationPath: string, reviewId: string, comment: string) {
    return this.call<any>(tenantId, {
      method: 'PUT',
      url: `https://mybusiness.googleapis.com/v4/${locationPath}/reviews/${encodeURIComponent(reviewId)}/reply`,
      data: { comment },
    });
  }

  /** Подписка аккаунта на NEW_REVIEW/UPDATED_REVIEW в Pub/Sub-топик. Push-подписку на наш URL создают в GCP. */
  async setupNotifications(tenantId: string) {
    const cfg = await this.settings.config(tenantId);
    if (!cfg.google.accountName) throw new BadRequestException('No Google Business account selected');
    if (!cfg.google.pubsubTopic) throw new BadRequestException('Pub/Sub topic is not set');
    try {
      await this.call(tenantId, {
        method: 'PATCH',
        url: `https://mybusinessnotifications.googleapis.com/v1/${cfg.google.accountName}/notificationSetting`,
        params: { updateMask: 'pubsubTopic,notificationTypes' },
        data: {
          name: `${cfg.google.accountName}/notificationSetting`,
          pubsubTopic: cfg.google.pubsubTopic,
          notificationTypes: ['NEW_REVIEW', 'UPDATED_REVIEW'],
        },
      });
      await this.settings.patchConfig(tenantId, { google: { ...cfg.google, notificationsOk: true, notificationsError: null } } as any);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.getResponse?.()?.message || e?.message;
      await this.settings.patchConfig(tenantId, { google: { ...cfg.google, notificationsOk: false, notificationsError: String(msg).slice(0, 300) } } as any);
      throw e;
    }
  }
}
