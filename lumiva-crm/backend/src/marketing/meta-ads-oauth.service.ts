import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { Repository } from 'typeorm';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingOauthToken } from './marketing-oauth-token.entity';
import { MarketingService } from './marketing.service';

const GRAPH = 'https://graph.facebook.com/v19.0';
const DEFAULT_RETURN = '/integrations-hub?tab=marketing';

interface OAuthState {
  tenantId: string;
  redirect: string;
  exp: number;
}

/**
 * Подключение Meta Ads «одной кнопкой»: клиент входит в Facebook под нашим приложением, мы получаем
 * долгоживущий токен, показываем его рекламные аккаунты и заводим интеграции по выбранным.
 * Синхронизация (insights по кампаниям) остаётся прежней — MarketingService.syncMetaAdsIntegration.
 */
@Injectable()
export class MetaAdsOauthService {
  private readonly log = new Logger(MetaAdsOauthService.name);

  constructor(
    @InjectRepository(MarketingOauthToken)
    private readonly tokenRepo: Repository<MarketingOauthToken>,
    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,
    private readonly platformSettings: PlatformSettingsService,
    private readonly marketing: MarketingService,
  ) {}

  /** Redirect URI надо добавить в «Valid OAuth Redirect URIs» приложения Meta. */
  redirectUri(): string {
    const explicit = process.env.META_ADS_OAUTH_REDIRECT_URI?.trim();
    if (explicit) return explicit;
    const base = (process.env.PUBLIC_API_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    return `${base}/v1/marketing/integrations/meta-ads/oauth/callback`;
  }

  private sign(payload: OAuthState): string {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', process.env.JWT_SECRET!).update(raw).digest('base64url');
    return `${raw}.${sig}`;
  }

  private verify(state?: string | null): OAuthState | null {
    if (!state) return null;
    const [raw, sig] = state.split('.');
    if (!raw || !sig) return null;
    const expected = createHmac('sha256', process.env.JWT_SECRET!).update(raw).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthState;
      return p.exp > Math.floor(Date.now() / 1000) - 60 ? p : null;
    } catch {
      return null;
    }
  }

  private safeRedirect(raw?: string): string {
    const s = (raw ?? '').trim();
    if (!s) return DEFAULT_RETURN;
    if (!s.startsWith('/') || s.startsWith('//') || s.includes('://') || s.length > 400) {
      throw new BadRequestException('redirectPath должен быть относительным путём, начинающимся с /');
    }
    return s;
  }

  private withParam(path: string, value: 'connected' | 'error'): string {
    return `${path}${path.includes('?') ? '&' : '?'}metaAdsOAuth=${value}`;
  }

  async buildAuthUrl(tenantId: string, redirectPath?: string): Promise<string> {
    const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
    if (!appId || !appSecret) {
      throw new BadRequestException('Приложение Meta не настроено на платформе (App ID / Secret).');
    }
    const state = this.sign({
      tenantId,
      redirect: this.safeRedirect(redirectPath),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    });
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      // ads_read — чтение рекламных аккаунтов и статистики кампаний
      scope: 'ads_read',
      state,
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  /** Обмен code → долгоживущий токен, сохранение и обновление уже подключённых через OAuth аккаунтов. */
  async handleCallback(code: string, state: string): Promise<string> {
    const st = this.verify(state);
    if (!st) return this.withParam(DEFAULT_RETURN, 'error');
    try {
      const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
      if (!appId || !appSecret) return this.withParam(st.redirect, 'error');

      const short = await axios.get(`${GRAPH}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, redirect_uri: this.redirectUri(), code },
      });
      const shortToken = short.data?.access_token as string | undefined;
      if (!shortToken) return this.withParam(st.redirect, 'error');

      const long = await axios.get(`${GRAPH}/oauth/access_token`, {
        params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken },
      });
      const token = (long.data?.access_token as string | undefined) || shortToken;
      const expiresIn = Number(long.data?.expires_in || 0);
      const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

      let row = await this.tokenRepo.findOne({ where: { tenantId: st.tenantId, provider: 'meta_ads' } });
      if (!row) row = this.tokenRepo.create({ tenantId: st.tenantId, provider: 'meta_ads' });
      row.accessToken = token;
      row.expiresAt = expiresAt;
      row.expiryNotice = null;
      await this.tokenRepo.save(row);

      // переподключение: обновляем токен во всех интеграциях, заведённых через OAuth
      const existing = await this.integrationRepo.find({ where: { tenantId: st.tenantId, provider: 'meta_ads' } });
      for (const it of existing) {
        const s = (it.settings && typeof it.settings === 'object' ? it.settings : {}) as Record<string, unknown>;
        if (s.oauth !== true) continue;
        it.settings = { ...s, accessToken: token, tokenExpiresAt: expiresAt?.toISOString() ?? null };
        await this.integrationRepo.save(it);
      }
      return this.withParam(st.redirect, 'connected');
    } catch (e: unknown) {
      const fb = axios.isAxiosError(e) ? (e.response?.data as { error?: { message?: string } } | undefined) : undefined;
      this.log.warn(`Meta Ads OAuth callback failed: ${fb?.error?.message || (e instanceof Error ? e.message : e)}`);
      return this.withParam(st.redirect, 'error');
    }
  }

  async status(tenantId: string) {
    const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
    const row = await this.tokenRepo.findOne({ where: { tenantId, provider: 'meta_ads' } });
    return {
      configured: Boolean(appId && appSecret),
      connected: Boolean(row),
      connectedAt: row?.createdAt?.toISOString() ?? null,
      expiresAt: row?.expiresAt?.toISOString() ?? null,
      expired: Boolean(row?.expiresAt && row.expiresAt.getTime() < Date.now()),
    };
  }

  private async token(tenantId: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
    const row = await this.tokenRepo.findOne({ where: { tenantId, provider: 'meta_ads' } });
    if (!row) throw new BadRequestException('Meta не подключена — нажмите «Подключить через Facebook».');
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Доступ к Meta истёк — переподключите аккаунт.');
    }
    return { accessToken: row.accessToken, expiresAt: row.expiresAt };
  }

  private normId(raw: string): string {
    return raw.replace(/^act_/i, '').replace(/\D/g, '');
  }

  /** Рекламные аккаунты пользователя + пометка, какие уже подключены к CRM. */
  async listAccounts(tenantId: string) {
    const { accessToken } = await this.token(tenantId);
    const accounts: Array<{
      id: string;
      name: string;
      currency: string | null;
      status: number | null;
      business: string | null;
    }> = [];
    try {
      let next: string | null = null;
      let first = true;
      for (let page = 0; page < 5 && (first || next); page++) {
        const res: { data: { data?: any[]; paging?: { next?: string } } } = await axios.get(
          first ? `${GRAPH}/me/adaccounts` : (next as string),
          {
            params: first
              ? { fields: 'account_id,name,currency,account_status,business_name', limit: 100, access_token: accessToken }
              : undefined,
          },
        );
        first = false;
        for (const a of res.data?.data || []) {
          accounts.push({
            id: String(a.account_id),
            name: String(a.name || a.account_id),
            currency: a.currency || null,
            status: typeof a.account_status === 'number' ? a.account_status : null,
            business: a.business_name || null,
          });
        }
        next = res.data?.paging?.next || null;
      }
    } catch (e: unknown) {
      const fb = axios.isAxiosError(e) ? (e.response?.data as { error?: { message?: string } } | undefined) : undefined;
      throw new BadRequestException(fb?.error?.message || 'Не удалось получить рекламные аккаунты Meta');
    }

    const connected = await this.integrationRepo.find({ where: { tenantId, provider: 'meta_ads' } });
    const byId = new Map(connected.map((c) => [this.normId(c.primaryId || ''), c]));
    return {
      accounts: accounts.map((a) => ({ ...a, connectedIntegrationId: byId.get(this.normId(a.id))?.id ?? null })),
    };
  }

  /** Заводит интеграции по выбранным аккаунтам (уже подключённым — обновляет токен) и сразу синхронизирует. */
  async connectAccounts(
    tenantId: string,
    picks: Array<{ id: string; name?: string; currency?: string }>,
  ) {
    const { accessToken, expiresAt } = await this.token(tenantId);
    const existing = await this.integrationRepo.find({ where: { tenantId, provider: 'meta_ads' } });
    const results: Array<{ id: string; integrationId: string; rows: number; error?: string }> = [];

    for (const p of picks) {
      const num = this.normId(p.id);
      if (!num) continue;
      const currencyRaw = (p.currency || 'USD').toUpperCase().slice(0, 8);
      const settings = { accessToken, oauth: true, currency: currencyRaw, tokenExpiresAt: expiresAt?.toISOString() ?? null };

      let row = existing.find((c) => this.normId(c.primaryId || '') === num) || null;
      if (row) {
        const prev = (row.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<string, unknown>;
        row.settings = { ...prev, ...settings, currency: (prev.currency as string) || currencyRaw };
        row.isActive = true;
        row = await this.integrationRepo.save(row);
      } else {
        const created = await this.marketing.createMarketingIntegration(tenantId, {
          provider: 'meta_ads',
          kind: 'ads',
          name: `Meta Ads · ${(p.name || num).slice(0, 120)}`,
          isActive: true,
          primaryId: `act_${num}`,
          settings,
        });
        row = created;
      }

      try {
        const rows = await this.marketing.syncMetaAdsIntegration(row);
        results.push({ id: num, integrationId: row.id, rows });
      } catch (e: unknown) {
        results.push({ id: num, integrationId: row.id, rows: 0, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!results.length) throw new NotFoundException('Не выбрано ни одного рекламного аккаунта');
    return { results };
  }
}
