import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import {
  decodeThirdPartyOAuthState,
  encodeThirdPartyOAuthState,
} from '../integrations/third-party-link/generic-oauth-state.util';

export type OfficeOAuthProvider = 'notion' | 'github' | 'canva';
const STATE_TYP = 'lumiva_office_oauth_v1';

/**
 * OAuth-подключение Notion / GitHub / Canva для ИИ-офиса. Ключи приложений — как у остальных
 * интеграций: pl1 → «OAuth-приложения интеграций» (integrationOAuthApps[catalogId]) или env
 * INTEGRATION_OAUTH_<NOTION|GITHUB|CANVA>_CLIENT_ID/_SECRET. Redirect URI для регистрации:
 * {PUBLIC_API_URL}/v1/ai-office/oauth/<provider>/callback.
 * Сохраняется как обычное подключение интеграции (third_party_link, catalogId = provider).
 */
@Injectable()
export class AiOfficeOAuthService {
  private readonly log = new Logger(AiOfficeOAuthService.name);
  /** PKCE verifier Canva — только на сервере (state уходит провайдеру, verifier — нет). */
  private readonly verifiers = new Map<string, { v: string; at: number }>();

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    @InjectRepository(IntegrationConnection) private readonly conns: Repository<IntegrationConnection>,
  ) {}

  private redirectUri(p: OfficeOAuthProvider) {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/ai-office/oauth/${p}/callback`;
  }

  async configured(): Promise<Record<OfficeOAuthProvider, boolean>> {
    const out = {} as Record<OfficeOAuthProvider, boolean>;
    for (const p of ['notion', 'github', 'canva'] as OfficeOAuthProvider[]) {
      const c = await this.platformSettings.getGenericIntegrationOAuthConfig(p);
      out[p] = !!(c.clientId && c.clientSecret && process.env.PUBLIC_API_URL);
    }
    return out;
  }

  async start(p: OfficeOAuthProvider, tenantId: string, userId: string): Promise<string> {
    const { clientId, clientSecret } = await this.platformSettings.getGenericIntegrationOAuthConfig(p);
    if (!clientId || !clientSecret || !process.env.PUBLIC_API_URL) {
      throw new BadRequestException({ code: 'OAUTH_NOT_CONFIGURED', message: `${p} sign-in is not configured on the platform yet` });
    }
    const nonce = crypto.randomBytes(12).toString('base64url');
    const state = encodeThirdPartyOAuthState(STATE_TYP, { tenantId, userId, redirect: `/ai-office/connect#${p}:${nonce}` });
    const redirect_uri = this.redirectUri(p);
    if (p === 'github') {
      return `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri, scope: 'repo', state, allow_signup: 'false' })}`;
    }
    if (p === 'notion') {
      return `https://api.notion.com/v1/oauth/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri, response_type: 'code', owner: 'user', state })}`;
    }
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    this.verifiers.set(nonce, { v: verifier, at: Date.now() });
    for (const [k, x] of this.verifiers) if (Date.now() - x.at > 20 * 60_000) this.verifiers.delete(k);
    return `https://www.canva.com/api/oauth/authorize?${new URLSearchParams({
      code_challenge_method: 's256',
      response_type: 'code',
      client_id: clientId,
      redirect_uri,
      scope: 'design:content:read design:content:write design:meta:read profile:read',
      code_challenge: challenge,
      state,
    })}`;
  }

  /** Обмен кода на токен и сохранение подключения. Возвращает true/false для редиректа на фронт. */
  async callback(p: OfficeOAuthProvider, code: string, state: string): Promise<boolean> {
    const st = decodeThirdPartyOAuthState(STATE_TYP, state);
    if (!st) return false;
    const { clientId, clientSecret } = await this.platformSettings.getGenericIntegrationOAuthConfig(p);
    if (!clientId || !clientSecret) return false;
    const redirect_uri = this.redirectUri(p);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    try {
      let cfg: Record<string, unknown> = { catalogId: p };
      if (p === 'github') {
        const r = await axios.post('https://github.com/login/oauth/access_token', { client_id: clientId, client_secret: clientSecret, code, redirect_uri }, { headers: { Accept: 'application/json' }, timeout: 20_000 });
        if (!r.data?.access_token) throw new Error(r.data?.error_description || 'no token');
        const me = await axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${r.data.access_token}`, 'User-Agent': 'Lumiva-CRM' }, timeout: 15_000 }).catch(() => null);
        cfg = { ...cfg, accessToken: r.data.access_token, label: me?.data?.login ? `GitHub · ${me.data.login}` : 'GitHub' };
      } else if (p === 'notion') {
        const r = await axios.post('https://api.notion.com/v1/oauth/token', { grant_type: 'authorization_code', code, redirect_uri }, { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' }, timeout: 20_000 });
        cfg = { ...cfg, accessToken: r.data.access_token, label: r.data.workspace_name ? `Notion · ${r.data.workspace_name}` : 'Notion' };
      } else {
        const nonce = st.redirect.split(':').pop() || '';
        const ver = this.verifiers.get(nonce);
        if (!ver) throw new Error('PKCE verifier expired — start the connection again');
        this.verifiers.delete(nonce);
        const r = await axios.post(
          'https://api.canva.com/rest/v1/oauth/token',
          new URLSearchParams({ grant_type: 'authorization_code', code_verifier: ver.v, code, redirect_uri }).toString(),
          { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
        );
        cfg = {
          ...cfg,
          accessToken: r.data.access_token,
          refreshToken: r.data.refresh_token,
          expiresAt: new Date(Date.now() + Number(r.data.expires_in || 14_400) * 1000).toISOString(),
          label: 'Canva',
        };
      }
      // повторное подключение того же сервиса — обновляем существующее, а не плодим
      const existing = (await this.conns.find({ where: { tenantId: st.tenantId, kind: 'third_party_link', isDeleted: false } as any })).find((c) => {
        try {
          return JSON.parse(c.configJson || '{}').catalogId === p;
        } catch {
          return false;
        }
      });
      if (existing) {
        const prev = JSON.parse(existing.configJson || '{}');
        existing.configJson = JSON.stringify({ ...prev, ...cfg, apiToken: undefined });
        (existing as any).lastError = null;
        existing.isEnabled = true;
        await this.conns.save(existing);
      } else {
        await this.conns.save(this.conns.create({ tenantId: st.tenantId, kind: 'third_party_link', name: String(cfg.label), isEnabled: true, isDeleted: false, configJson: JSON.stringify(cfg) } as any));
      }
      return true;
    } catch (e: any) {
      this.log.warn(`${p} OAuth callback failed: ${e?.response?.status ?? ''} ${JSON.stringify(e?.response?.data ?? e?.message)}`);
      return false;
    }
  }

  /** Обновить истекающий токен Canva (живёт ~4 ч). Возвращает актуальный access token. */
  async freshCanvaToken(entity: IntegrationConnection, cfg: Record<string, any>): Promise<string> {
    const exp = cfg.expiresAt ? new Date(cfg.expiresAt).getTime() : 0;
    if (cfg.accessToken && exp - Date.now() > 120_000) return String(cfg.accessToken);
    if (!cfg.refreshToken) throw new Error('canva: 401 token expired — reconnect Canva');
    const { clientId, clientSecret } = await this.platformSettings.getGenericIntegrationOAuthConfig('canva');
    if (!clientId || !clientSecret) throw new Error('canva: 401 Canva app is not configured');
    try {
      const r = await axios.post(
        'https://api.canva.com/rest/v1/oauth/token',
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: String(cfg.refreshToken) }).toString(),
        { headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      const next = { ...cfg, accessToken: r.data.access_token, refreshToken: r.data.refresh_token || cfg.refreshToken, expiresAt: new Date(Date.now() + Number(r.data.expires_in || 14_400) * 1000).toISOString() };
      entity.configJson = JSON.stringify(next);
      await this.conns.save(entity);
      return String(next.accessToken);
    } catch (e: any) {
      throw new Error(`canva: ${e?.response?.status === 400 || e?.response?.status === 401 ? 401 : e?.response?.status ?? ''} refresh failed — reconnect Canva`);
    }
  }

  /** Настройки подключения, нужные агентам: репозиторий GitHub, страница Notion. */
  async updateSettings(tenantId: string, connectionId: string, patch: { repo?: string; parentPageId?: string }) {
    const c = await this.conns.findOne({ where: { id: connectionId, tenantId, isDeleted: false } as any });
    if (!c) throw new NotFoundException('Connection not found');
    const cfg = JSON.parse(c.configJson || '{}');
    const token = cfg.accessToken || cfg.apiToken;
    if (cfg.catalogId === 'github' && patch.repo !== undefined) {
      const repo = String(patch.repo).trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new BadRequestException('Repository must look like owner/name');
      await axios.get(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Lumiva-CRM' }, timeout: 15_000 }).catch((e) => {
        throw new BadRequestException(`GitHub: ${e?.response?.data?.message || e.message}`);
      });
      cfg.repo = repo;
    }
    if (cfg.catalogId === 'notion' && patch.parentPageId !== undefined) {
      const id = String(patch.parentPageId).replace(/-/g, '').match(/[0-9a-f]{32}/i)?.[0];
      if (!id) throw new BadRequestException('Notion: paste the page link');
      await axios.get(`https://api.notion.com/v1/pages/${id}`, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' }, timeout: 15_000 }).catch((e) => {
        throw new BadRequestException(`Notion: ${e?.response?.data?.message || e.message}`);
      });
      cfg.parentPageId = id;
    }
    c.configJson = JSON.stringify(cfg);
    await this.conns.save(c);
    return { ok: true };
  }

  /** Подсказки для выбора: репозитории GitHub / страницы Notion, доступные подключению. */
  async options(tenantId: string, connectionId: string): Promise<Array<{ id: string; label: string }>> {
    const c = await this.conns.findOne({ where: { id: connectionId, tenantId, isDeleted: false } as any });
    if (!c) throw new NotFoundException('Connection not found');
    const cfg = JSON.parse(c.configJson || '{}');
    const token = cfg.accessToken || cfg.apiToken;
    try {
      if (cfg.catalogId === 'github') {
        const r = await axios.get('https://api.github.com/user/repos', { params: { per_page: 100, sort: 'updated' }, headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Lumiva-CRM' }, timeout: 15_000 });
        return (r.data as any[]).map((x) => ({ id: x.full_name, label: x.full_name }));
      }
      if (cfg.catalogId === 'notion') {
        const r = await axios.post('https://api.notion.com/v1/search', { page_size: 50, filter: { property: 'object', value: 'page' } }, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, timeout: 15_000 });
        return (r.data?.results ?? []).map((pg: any) => {
          const prop = Object.values(pg.properties ?? {}).find((v: any) => v?.type === 'title') as any;
          return { id: pg.id.replace(/-/g, ''), label: (prop?.title ?? []).map((t: any) => t.plain_text).join('') || 'Untitled' };
        });
      }
    } catch (e: any) {
      throw new BadRequestException(`${cfg.catalogId}: ${e?.response?.data?.message || e.message}`);
    }
    return [];
  }
}
