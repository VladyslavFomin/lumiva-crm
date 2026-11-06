import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ContentService, pgRows, type ContentActor } from './content.service';
import type { MediaItem } from './content-adapters';

const pubBase = () => (process.env.PUBLIC_API_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
const API = () => (process.env.CONTENT_CANVA_API || 'https://api.canva.com/rest/v1').replace(/\/$/, '');
const AUTH = () => process.env.CONTENT_CANVA_AUTH || 'https://www.canva.com/api/oauth/authorize';
const SCOPES = [
  'profile:read',
  'design:meta:read',
  'design:content:read',
  'design:content:write',
  'asset:read',
  'asset:write',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
];
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Размеры «Открыть в Canva» — под форматы сетей. */
export const CANVA_PRESETS: Record<string, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  landscape: { w: 1200, h: 627 },
};

type Conn = { id: string; tenant_id: string; external_id: string; name: string | null; access_token: string; refresh_token: string | null; expires_at: string | null; meta: any };

/**
 * Canva Connect: дизайны клиента → картинки поста (md/content_engine_plan.md, раздел «Canva»).
 * Canva здесь не канал публикации, а источник картинок: экспорт кладётся в uploads/content как обычная картинка поста.
 */
@Injectable()
export class ContentCanvaService implements OnModuleInit {
  private readonly log = new Logger(ContentCanvaService.name);
  /** state → PKCE-верификатор (30 мин, одноразово) */
  private pending = new Map<string, { tenantId: string; userId: string | null; verifier: string; at: number }>();
  private refreshing = new Map<string, Promise<string>>();

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly platform: PlatformSettingsService,
    private readonly content: ContentService,
  ) {}

  onModuleInit(): void {
    this.content.registerCanva(this);
  }

  private async q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return pgRows<T>(await this.db.query(sql, params));
  }

  private redirect() {
    return `${pubBase()}/v1/content/canva/callback`;
  }

  private async app() {
    return this.platform.getGenericIntegrationOAuthConfig('canva');
  }

  private basic(clientId: string, secret: string) {
    return `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
  }

  // ───────────────────────── OAuth ─────────────────────────

  async status(tenantId: string, userId: string | null) {
    const app = await this.app();
    const c = await this.connectionFor(tenantId, userId).catch(() => null);
    return { configured: !!(app.clientId && app.clientSecret), connected: !!c, name: c?.name ?? null, connectionId: c?.id ?? null };
  }

  async authUrl(tenantId: string, userId: string | null) {
    const { clientId, clientSecret } = await this.app();
    if (!clientId || !clientSecret) throw new BadRequestException('Интеграция Canva не настроена в pl1 (OAuth-приложения → canva)');
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.at > 30 * 60_000) this.pending.delete(k);
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    this.pending.set(state, { tenantId, userId, verifier, at: now });
    const p = new URLSearchParams({
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 's256',
      scope: SCOPES.join(' '),
      response_type: 'code',
      client_id: clientId,
      state,
      redirect_uri: this.redirect(),
    });
    return { url: `${AUTH()}?${p.toString()}` };
  }

  private async token(form: Record<string, string>) {
    const { clientId, clientSecret } = await this.app();
    if (!clientId || !clientSecret) throw new Error('Canva: integration is not configured');
    const r = await axios.post(`${API()}/oauth/token`, new URLSearchParams(form).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: this.basic(clientId, clientSecret) },
      timeout: 20_000,
      validateStatus: () => true,
    });
    if (r.status >= 400 || !r.data?.access_token) throw new Error(`Canva: ${r.data?.error_description || r.data?.error || r.data?.message || `HTTP ${r.status}`}`);
    return r.data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
  }

  async callback(q: { code?: string; state?: string; error?: string }): Promise<string> {
    const back = (x: string) => `${pubBase()}/marketing/smm?tab=channels&canva=${x}`;
    const st = q.state ? this.pending.get(q.state) : undefined;
    if (q.state) this.pending.delete(q.state);
    if (q.error) return back('denied');
    if (!st || Date.now() - st.at > 30 * 60_000 || !q.code) return back('invalid_state');
    try {
      const tok = await this.token({ grant_type: 'authorization_code', code: q.code, code_verifier: st.verifier, redirect_uri: this.redirect() });
      let userId = '';
      let name: string | null = null;
      try {
        const me = await axios.get(`${API()}/users/me`, { headers: { Authorization: `Bearer ${tok.access_token}` }, timeout: 15_000 });
        userId = String(me.data?.team_user?.user_id || '');
        const prof = await axios.get(`${API()}/users/me/profile`, { headers: { Authorization: `Bearer ${tok.access_token}` }, timeout: 15_000 }).catch(() => null);
        name = prof?.data?.profile?.display_name || null;
      } catch {
        // профиль не критичен
      }
      const ext = userId || `user-${st.userId || 'tenant'}`;
      await this.q(
        `INSERT INTO content_connections (tenant_id, provider, external_id, name, access_token, refresh_token, expires_at, scopes, meta, created_by)
         VALUES ($1,'canva',$2,$3,$4,$5,$6,$7,'{}'::jsonb,$8)
         ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET name = EXCLUDED.name, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, created_by = COALESCE(EXCLUDED.created_by, content_connections.created_by), updated_at = now()`,
        [
          st.tenantId,
          ext,
          name,
          tok.access_token,
          tok.refresh_token || null,
          tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
          String(tok.scope || SCOPES.join(' ')),
          uuidRe.test(String(st.userId || '')) ? st.userId : null,
        ],
      );
      return back('connected');
    } catch (e) {
      this.log.warn(`canva oauth failed: ${(e as Error).message}`);
      return back('oauth_error');
    }
  }

  async disconnect(tenantId: string, userId: string | null) {
    const c = await this.connectionFor(tenantId, userId);
    await this.q(`DELETE FROM content_connections WHERE id = $1`, [c.id]);
    return { ok: true };
  }

  /** Своё подключение пользователя, иначе — любое подключение компании (дизайны общие для команды). */
  private async connectionFor(tenantId: string, userId: string | null): Promise<Conn> {
    const rows = await this.q<Conn>(
      `SELECT * FROM content_connections WHERE tenant_id = $1 AND provider = 'canva' ORDER BY (created_by = $2) DESC NULLS LAST, updated_at DESC LIMIT 1`,
      [tenantId, uuidRe.test(String(userId || '')) ? userId : null],
    );
    if (!rows[0]) throw new BadRequestException('Подключите Canva во вкладке «Каналы»');
    return rows[0];
  }

  /** Действующий токен: обновляет за 5 минут до истечения; refresh одноразовый — сохраняем новый. */
  private async accessToken(c: Conn): Promise<string> {
    if (!c.expires_at || new Date(c.expires_at).getTime() > Date.now() + 5 * 60_000) return c.access_token;
    const running = this.refreshing.get(c.id);
    if (running) return running;
    const job = (async () => {
      const [fresh] = await this.q<Conn>(`SELECT * FROM content_connections WHERE id = $1`, [c.id]);
      if (fresh && fresh.expires_at && new Date(fresh.expires_at).getTime() > Date.now() + 5 * 60_000) return fresh.access_token;
      if (!fresh?.refresh_token) throw new BadRequestException('Canva: доступ истёк — переподключите Canva');
      let tok;
      try {
        tok = await this.token({ grant_type: 'refresh_token', refresh_token: fresh.refresh_token });
      } catch (e) {
        throw new BadRequestException(`Canva: доступ истёк — переподключите Canva (${(e as Error).message})`);
      }
      await this.q(`UPDATE content_connections SET access_token = $2, refresh_token = COALESCE($3, refresh_token), expires_at = $4, updated_at = now() WHERE id = $1`, [
        c.id,
        tok.access_token,
        tok.refresh_token || null,
        tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
      ]);
      return tok.access_token;
    })();
    this.refreshing.set(c.id, job);
    try {
      return await job;
    } finally {
      this.refreshing.delete(c.id);
    }
  }

  private async api<T = any>(c: Conn, method: 'GET' | 'POST', path: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const tok = await this.accessToken(c);
    const r = await axios.request({
      method,
      url: `${API()}${path}`,
      data,
      headers: { Authorization: `Bearer ${tok}`, ...(data && !headers ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      timeout: 60_000,
      validateStatus: () => true,
      maxBodyLength: 60 * 1024 * 1024,
    });
    if (r.status === 401) throw new BadRequestException('Canva: доступ отозван — переподключите Canva');
    if (r.status === 403) throw new BadRequestException(`Canva: нет доступа (${r.data?.message || 'scope'}) — возможно, нужен тариф Canva с этой функцией`);
    if (r.status === 429) throw new BadRequestException('Canva: слишком много запросов — попробуйте через минуту');
    if (r.status >= 400) throw new BadRequestException(`Canva: ${r.data?.message || r.data?.error || `HTTP ${r.status}`}`);
    return r.data as T;
  }

  /** Задания Canva (экспорт, загрузка, автозаполнение) асинхронные — опрашиваем до success/failed. */
  private async waitJob<T = any>(c: Conn, path: string, maxMs = 90_000): Promise<T> {
    const t0 = Date.now();
    let delay = 1000;
    for (;;) {
      const r = await this.api<any>(c, 'GET', path);
      const job = r.job || r;
      if (job.status === 'success') return job as T;
      if (job.status === 'failed') throw new BadRequestException(`Canva: ${job.error?.message || job.error?.code || 'job failed'}`);
      if (Date.now() - t0 > maxMs) throw new BadRequestException('Canva всё ещё готовит файл — попробуйте ещё раз через минуту');
      await new Promise((res) => setTimeout(res, delay));
      delay = Math.min(delay * 1.5, 5000);
    }
  }

  // ───────────────────────── дизайны → пост ─────────────────────────

  async designs(tenantId: string, userId: string | null, query?: string, continuation?: string) {
    const c = await this.connectionFor(tenantId, userId);
    const p = new URLSearchParams({ ownership: 'any', sort_by: 'modified_descending' });
    if (query?.trim()) p.set('query', query.trim().slice(0, 200));
    if (continuation) p.set('continuation', continuation);
    const r = await this.api<any>(c, 'GET', `/designs?${p.toString()}`);
    return {
      items: ((r.items as any[]) || []).map((d) => ({
        id: String(d.id),
        title: d.title || null,
        thumbnail: d.thumbnail?.url || null,
        pages: d.page_count ?? null,
        updatedAt: d.updated_at ? new Date(Number(d.updated_at) * 1000).toISOString() : null,
      })),
      continuation: r.continuation || null,
    };
  }

  /** Экспорт дизайна в картинки (каждая страница — отдельная картинка = карусель) → сохраняем у себя. */
  private async exportDesign(tenantId: string, c: Conn, designId: string, format: 'png' | 'jpg', pages?: number[]): Promise<MediaItem[]> {
    const body: any = { design_id: designId, format: format === 'jpg' ? { type: 'jpg', quality: 90 } : { type: 'png' } };
    if (pages?.length) body.format.pages = pages.slice(0, 10);
    const created = await this.api<any>(c, 'POST', '/exports', body);
    const id = created.job?.id;
    if (!id) throw new BadRequestException('Canva: export job was not created');
    const job = await this.waitJob<any>(c, `/exports/${id}`);
    const urls: string[] = (job.urls || []).slice(0, 10);
    if (!urls.length) throw new BadRequestException('Canva: export returned no files');
    const out: MediaItem[] = [];
    for (const u of urls) {
      const f = await axios.get(u, { responseType: 'arraybuffer', timeout: 60_000 });
      const saved = await this.content.saveImage(tenantId, Buffer.from(f.data), format === 'jpg' ? '.jpg' : '.png');
      out.push({ url: saved.url, kind: 'image', approved: null });
    }
    return out;
  }

  /** Добавить картинки в пост через обычное сохранение (правка одобренного поста вернёт его на согласование). */
  private async appendToPost(tenantId: string, actor: ContentActor, postId: string, items: MediaItem[]) {
    const post = await this.content.getPost(tenantId, postId);
    const media = [...((post.media || []) as MediaItem[]), ...items].slice(0, 10);
    const format = media.length > 1 && post.format === 'post' ? 'carousel' : post.format;
    return this.content.savePost(tenantId, actor, postId, { media, format });
  }

  async importDesign(tenantId: string, actor: ContentActor, postId: string, body: { designId?: string; format?: string; pages?: number[] }) {
    const designId = String(body.designId || '').trim();
    if (!designId) throw new BadRequestException('Выберите дизайн');
    await this.content.getPost(tenantId, postId);
    const c = await this.connectionFor(tenantId, actor.userId);
    const items = await this.exportDesign(tenantId, c, designId, body.format === 'jpg' ? 'jpg' : 'png', Array.isArray(body.pages) ? body.pages.map(Number).filter((n) => n > 0) : undefined);
    return this.appendToPost(tenantId, actor, postId, items);
  }

  /**
   * «Открыть в Canva»: дизайн нужного размера (с первой картинкой поста, если есть) → edit_url c correlation_state.
   * После «Готово» Canva возвращает на /v1/content/canva/return, и мы экспортируем дизайн в этот пост.
   */
  async openInCanva(tenantId: string, actor: ContentActor, postId: string, body: { preset?: string; withImage?: boolean }) {
    const post = await this.content.getPost(tenantId, postId);
    const c = await this.connectionFor(tenantId, actor.userId);
    const size = CANVA_PRESETS[String(body.preset || 'square')] || CANVA_PRESETS.square;
    let assetId: string | undefined;
    const first = ((post.media || []) as MediaItem[]).find((m) => m.approved !== false);
    if (body.withImage !== false && first) {
      const img = await axios.get(first.url, { responseType: 'arraybuffer', timeout: 60_000 });
      const meta = JSON.stringify({ name_base64: Buffer.from((post.title || 'Lumiva post').slice(0, 50)).toString('base64') });
      const up = await this.api<any>(c, 'POST', '/asset-uploads', Buffer.from(img.data), { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': meta });
      const job = await this.waitJob<any>(c, `/asset-uploads/${up.job?.id}`, 60_000);
      assetId = job.asset?.id;
    }
    const created = await this.api<any>(c, 'POST', '/designs', {
      design_type: { type: 'custom', width: size.w, height: size.h },
      title: (post.title || post.text || 'Lumiva post').slice(0, 120),
      ...(assetId ? { asset_id: assetId } : {}),
    });
    const designId = created.design?.id;
    const editUrl: string | undefined = created.design?.urls?.edit_url;
    if (!designId || !editUrl) throw new BadRequestException('Canva: design was not created');
    const corr = randomBytes(18).toString('base64url');
    const pendingList = (((c.meta?.pending as any[]) || []) as any[]).filter((x) => Date.now() - Number(x.at || 0) < 7 * 86_400_000).slice(-30);
    pendingList.push({ corr, designId, postId, tenantId, userId: actor.userId, at: Date.now() });
    await this.q(`UPDATE content_connections SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{pending}', $2::jsonb) WHERE id = $1`, [c.id, JSON.stringify(pendingList)]);
    const sep = editUrl.includes('?') ? '&' : '?';
    return { designId, editUrl: `${editUrl}${sep}correlation_state=${encodeURIComponent(corr)}` };
  }

  /**
   * Возврат из редактора Canva. correlation_jwt подписан Canva; полезную нагрузку читаем только чтобы найти
   * correlation_state — сам дизайн экспортируется токеном владельца подключения и только в пост, для которого его открыли.
   */
  async returnFromCanva(correlationJwt?: string): Promise<string> {
    const back = (x: string, postId?: string) => `${pubBase()}/marketing/smm?tab=posts${postId ? `&post=${postId}` : ''}&canva=${x}`;
    let corr = '';
    let designFromJwt = '';
    try {
      const payload = JSON.parse(Buffer.from(String(correlationJwt || '').split('.')[1] || '', 'base64url').toString('utf8'));
      corr = String(payload.correlation_state || '');
      designFromJwt = String(payload.design_id || '');
    } catch {
      return back('invalid_return');
    }
    if (!corr) return back('invalid_return');
    const rows = await this.q<Conn>(`SELECT * FROM content_connections WHERE provider = 'canva' AND meta->'pending' @> $1::jsonb`, [JSON.stringify([{ corr }])]);
    const c = rows[0];
    const item = ((c?.meta?.pending as any[]) || []).find((x) => x.corr === corr);
    if (!c || !item || (designFromJwt && designFromJwt !== item.designId)) return back('invalid_return');
    const rest = ((c.meta?.pending as any[]) || []).filter((x) => x.corr !== corr);
    await this.q(`UPDATE content_connections SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{pending}', $2::jsonb) WHERE id = $1`, [c.id, JSON.stringify(rest)]);
    try {
      const items = await this.exportDesign(c.tenant_id, c, item.designId, 'png');
      await this.appendToPost(c.tenant_id, { userId: item.userId ?? null, name: 'Canva' }, item.postId, items);
      return back('imported', item.postId);
    } catch (e) {
      this.log.warn(`canva return export failed: ${(e as Error).message}`);
      return back('export_failed', item.postId);
    }
  }

  // ───────────────────────── брендовые шаблоны (автозаполнение) ─────────────────────────

  async templates(tenantId: string, userId: string | null, query?: string) {
    const c = await this.connectionFor(tenantId, userId);
    const p = new URLSearchParams({ dataset: 'non_empty' });
    if (query?.trim()) p.set('query', query.trim().slice(0, 200));
    const r = await this.api<any>(c, 'GET', `/brand-templates?${p.toString()}`);
    return ((r.items as any[]) || []).map((t) => ({ id: String(t.id), title: t.title || null, thumbnail: t.thumbnail?.url || null }));
  }

  async templateFields(tenantId: string, userId: string | null, templateId: string) {
    const c = await this.connectionFor(tenantId, userId);
    const r = await this.api<any>(c, 'GET', `/brand-templates/${encodeURIComponent(templateId)}/dataset`);
    return Object.entries((r.dataset || {}) as Record<string, { type: string }>).map(([name, v]) => ({ name, type: v.type }));
  }

  /**
   * Автозаполнение: текстовые поля шаблона ← данные (из поста или от ИИ), картинки ← картинки поста по порядку.
   * Результат экспортируется в пост. Работает только у аккаунтов Canva с брендовыми шаблонами (Enterprise).
   */
  async autofill(tenantId: string, actor: ContentActor, postId: string, body: { templateId?: string; fields?: Record<string, string> }) {
    const templateId = String(body.templateId || '');
    if (!templateId) throw new BadRequestException('Выберите шаблон Canva');
    const post = await this.content.getPost(tenantId, postId);
    const c = await this.connectionFor(tenantId, actor.userId);
    const fields = await this.templateFields(tenantId, actor.userId, templateId);
    const given = body.fields || {};
    const images = ((post.media || []) as MediaItem[]).filter((m) => m.approved !== false);
    const data: Record<string, unknown> = {};
    let imgIdx = 0;
    for (const f of fields) {
      if (f.type === 'text') {
        const text = String(given[f.name] ?? '').trim();
        if (text) data[f.name] = { type: 'text', text: text.slice(0, 2000) };
      } else if (f.type === 'image' && images[imgIdx]) {
        const img = await axios.get(images[imgIdx++].url, { responseType: 'arraybuffer', timeout: 60_000 });
        const meta = JSON.stringify({ name_base64: Buffer.from(`${f.name}`.slice(0, 50)).toString('base64') });
        const up = await this.api<any>(c, 'POST', '/asset-uploads', Buffer.from(img.data), { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': meta });
        const job = await this.waitJob<any>(c, `/asset-uploads/${up.job?.id}`, 60_000);
        if (job.asset?.id) data[f.name] = { type: 'image', asset_id: job.asset.id };
      }
    }
    if (!Object.keys(data).length) throw new BadRequestException('Нечем заполнить шаблон — заполните хотя бы одно поле');
    const af = await this.api<any>(c, 'POST', '/autofills', { brand_template_id: templateId, title: (post.title || 'Lumiva post').slice(0, 120), data });
    const job = await this.waitJob<any>(c, `/autofills/${af.job?.id}`);
    const designId = job.result?.design?.id;
    if (!designId) throw new BadRequestException('Canva: autofill returned no design');
    const items = await this.exportDesign(tenantId, c, designId, 'png');
    return this.appendToPost(tenantId, actor, postId, items);
  }

  /** Для ИИ: есть ли у компании подключённая Canva с шаблонами (строка для промпта, '' если нет). */
  async templatesLine(tenantId: string): Promise<string> {
    const [c] = await this.q(`SELECT id FROM content_connections WHERE tenant_id = $1 AND provider = 'canva' LIMIT 1`, [tenantId]);
    if (!c) return '';
    try {
      const list = (await this.templates(tenantId, null)).slice(0, 15);
      if (!list.length) return '';
      const withFields = await Promise.all(list.map(async (t) => ({ ...t, fields: (await this.templateFields(tenantId, null, t.id).catch(() => [] as Array<{ name: string; type: string }>)).filter((f) => f.type === 'text').map((f) => f.name) })));
      return `Canva brand templates (instead of imagePrompt you may set canvaTemplate: { id, fields: { <field>: "<short text>" } } — the image is made in the company style): ${withFields
        .map((t) => `${t.id} = "${t.title || 'template'}" fields [${t.fields.join(', ')}]`)
        .join('; ')}.`;
    } catch {
      return '';
    }
  }

  /** ИИ-пост с canvaTemplate: автозаполнение от имени системы (ошибка — пост остаётся без картинки). */
  async autofillForAi(tenantId: string, postId: string, tpl: { id?: string; fields?: Record<string, string> }) {
    if (!tpl?.id) throw new NotFoundException('template');
    return this.autofill(tenantId, { userId: null, name: 'AI', role: 'owner' }, postId, { templateId: String(tpl.id), fields: tpl.fields || {} });
  }
}
