import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { createHmac, randomBytes } from 'crypto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { TIKTOK_API, YT_API } from './content-adapters';

const pubBase = () => (process.env.PUBLIC_API_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pg = (res: any): any[] => (Array.isArray(res) && res.length === 2 && Array.isArray(res[0]) && typeof res[1] === 'number' ? res[0] : res || []);

type Provider = 'youtube' | 'tiktok';

/**
 * Подключения видеосетей движка контента: YouTube (Google OAuth, приложение Google из pl1) и TikTok (Login Kit v2,
 * pl1 → OAuth-приложения → tiktok). Хранит токены в content_connections и продлевает их перед публикацией.
 */
@Injectable()
export class ContentVideoAccountsService {
  private readonly log = new Logger(ContentVideoAccountsService.name);
  private refreshing = new Map<string, Promise<string>>();

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly platform: PlatformSettingsService,
  ) {}

  private async q(sql: string, params: unknown[] = []) {
    return pg(await this.db.query(sql, params));
  }

  private redirect(p: Provider) {
    return `${pubBase()}/v1/content/${p}/callback`;
  }

  private sign(payload: Record<string, unknown>) {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${raw}.${createHmac('sha256', process.env.JWT_SECRET || 'content').update(raw).digest('base64url')}`;
  }

  private verify(state?: string): Record<string, any> | null {
    if (!state || !state.includes('.')) return null;
    const [raw, sig] = state.split('.');
    if (createHmac('sha256', process.env.JWT_SECRET || 'content').update(raw).digest('base64url') !== sig) return null;
    try {
      const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      return Date.now() - Number(p.ts || 0) < 30 * 60_000 ? p : null;
    } catch {
      return null;
    }
  }

  private async app(p: Provider) {
    return p === 'youtube' ? this.platform.getGoogleOAuthConfig() : this.platform.getGenericIntegrationOAuthConfig('tiktok');
  }

  async configured(p: Provider) {
    const a = await this.app(p);
    return !!(a.clientId && a.clientSecret);
  }

  async connections(tenantId: string, p: Provider) {
    return this.q(`SELECT id, external_id, name, avatar_url, expires_at, meta FROM content_connections WHERE tenant_id = $1 AND provider = $2 ORDER BY created_at`, [tenantId, p]);
  }

  async authUrl(tenantId: string, userId: string | null, p: Provider) {
    const { clientId } = await this.app(p);
    if (!clientId) throw new BadRequestException(p === 'youtube' ? 'Google OAuth не настроен в pl1' : 'Приложение TikTok не настроено в pl1 (OAuth-приложения → tiktok)');
    const state = this.sign({ tenantId, userId, ts: Date.now(), n: p, r: randomBytes(6).toString('hex') });
    if (p === 'youtube') {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: this.redirect(p),
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      return { url: `${process.env.CONTENT_GOOGLE_AUTH || 'https://accounts.google.com/o/oauth2/v2/auth'}?${q.toString()}` };
    }
    const q = new URLSearchParams({ client_key: clientId, scope: 'user.info.basic,video.publish,video.upload,video.list', response_type: 'code', redirect_uri: this.redirect(p), state });
    return { url: `${process.env.CONTENT_TIKTOK_AUTH || 'https://www.tiktok.com/v2/auth/authorize/'}?${q.toString()}` };
  }

  private async tokenRequest(p: Provider, form: Record<string, string>) {
    const { clientId, clientSecret } = await this.app(p);
    if (!clientId || !clientSecret) throw new Error(`${p}: app is not configured`);
    const url = p === 'youtube' ? process.env.CONTENT_GOOGLE_TOKEN || 'https://oauth2.googleapis.com/token' : `${TIKTOK_API}/v2/oauth/token/`;
    const body = p === 'youtube' ? { ...form, client_id: clientId, client_secret: clientSecret } : { ...form, client_key: clientId, client_secret: clientSecret };
    const r = await axios.post(url, new URLSearchParams(body).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000, validateStatus: () => true });
    if (r.status >= 400 || !r.data?.access_token) throw new Error(`${p}: ${r.data?.error_description || r.data?.error?.message || r.data?.error || `HTTP ${r.status}`}`);
    return r.data as { access_token: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string };
  }

  async callback(p: Provider, code?: string, state?: string, error?: string): Promise<string> {
    const back = (x: string) => `${pubBase()}/marketing/smm?tab=channels&${p}=${x}`;
    const st = this.verify(state);
    if (error) return back('denied');
    if (!st?.tenantId || st.n !== p || !code) return back('invalid_state');
    try {
      const tok = await this.tokenRequest(p, { grant_type: 'authorization_code', code, redirect_uri: this.redirect(p) });
      let ext = '';
      let name: string | null = null;
      let avatar: string | null = null;
      const meta: Record<string, unknown> = {};
      if (p === 'youtube') {
        const ch = await axios.get(`${YT_API}/youtube/v3/channels`, { params: { part: 'snippet', mine: 'true' }, headers: { Authorization: `Bearer ${tok.access_token}` }, timeout: 20_000 });
        const c = ch.data?.items?.[0];
        if (!c) return back('no_channel');
        ext = String(c.id);
        name = c.snippet?.title || 'YouTube';
        avatar = c.snippet?.thumbnails?.default?.url || null;
        meta.customUrl = c.snippet?.customUrl || null;
      } else {
        const u = await axios.get(`${TIKTOK_API}/v2/user/info/`, { params: { fields: 'open_id,display_name,avatar_url,username' }, headers: { Authorization: `Bearer ${tok.access_token}` }, timeout: 20_000 });
        const usr = u.data?.data?.user || {};
        ext = String(usr.open_id || tok.open_id || '');
        name = usr.display_name || (usr.username ? `@${usr.username}` : 'TikTok');
        avatar = usr.avatar_url || null;
        meta.username = usr.username || null;
        meta.refreshExpiresAt = tok.refresh_expires_in ? Date.now() + Number(tok.refresh_expires_in) * 1000 : null;
      }
      if (!ext) throw new Error('no account id');
      await this.q(
        `INSERT INTO content_connections (tenant_id, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, scopes, meta, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
         ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, content_connections.refresh_token), expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes,
           meta = EXCLUDED.meta, updated_at = now()`,
        [
          st.tenantId,
          p,
          ext,
          name,
          avatar,
          tok.access_token,
          tok.refresh_token || null,
          tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
          String(tok.scope || ''),
          JSON.stringify(meta),
          uuidRe.test(String(st.userId || '')) ? st.userId : null,
        ],
      );
      await this.q(`UPDATE content_channels SET status = 'ok', last_error = NULL WHERE tenant_id = $1 AND network = $2 AND account_id = $3`, [st.tenantId, p, ext]);
      return back('connected');
    } catch (e: any) {
      this.log.warn(`${p} oauth failed: ${e?.response?.data?.error_description || e.message}`);
      return back('oauth_error');
    }
  }

  /** Действующий токен: обновление за 5 минут до истечения (TikTok ротирует refresh — сохраняем новый). */
  async token(connectionId: string): Promise<{ accessToken: string; externalId: string; meta: any }> {
    const [c] = await this.q(`SELECT * FROM content_connections WHERE id = $1 AND provider IN ('youtube','tiktok')`, [connectionId]);
    if (!c?.access_token) throw new Error('Video account was removed — reconnect it in Channels');
    const p = c.provider as Provider;
    if (c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 5 * 60_000) return { accessToken: c.access_token, externalId: c.external_id, meta: c.meta || {} };
    let job = this.refreshing.get(connectionId);
    if (!job) {
      job = (async () => {
        if (!c.refresh_token) throw new Error(`${p}: access expired — reconnect ${p === 'youtube' ? 'YouTube' : 'TikTok'} in Channels`);
        let tok;
        try {
          tok = await this.tokenRequest(p, { grant_type: 'refresh_token', refresh_token: c.refresh_token });
        } catch (e) {
          throw new Error(`${p}: access expired — reconnect ${p === 'youtube' ? 'YouTube' : 'TikTok'} in Channels (${(e as Error).message})`);
        }
        await this.q(`UPDATE content_connections SET access_token = $2, refresh_token = COALESCE($3, refresh_token), expires_at = $4, updated_at = now() WHERE id = $1`, [
          connectionId,
          tok.access_token,
          tok.refresh_token || null,
          tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
        ]);
        return tok.access_token;
      })();
      this.refreshing.set(connectionId, job);
      job.finally(() => this.refreshing.delete(connectionId)).catch(() => undefined);
    }
    return { accessToken: await job, externalId: c.external_id, meta: c.meta || {} };
  }
}
