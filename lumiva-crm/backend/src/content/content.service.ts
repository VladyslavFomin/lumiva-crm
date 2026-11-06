import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { EmployeeContentHooks } from '../ai-employees/ai-employee-content';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { appendFile, mkdir, rename, stat, unlink, writeFile } from 'fs/promises';
import { dirname, extname } from 'path';
import { joinUploadsAbsolute } from '../common/uploads-root.util';
import { SmmService } from '../smm/smm.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AiOpenAiService } from '../ai/ai-openai.service';
import { AiAssistantService } from '../ai/ai-assistant.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { ContentVideoAccountsService } from './content-video-accounts.service';
import { ADAPTERS, NETWORKS, TG_API, THREADS_API, vkCall, type Credentials, type MediaItem, type Network, type PostFormat } from './content-adapters';

export type Autonomy = 'suggest' | 'assisted' | 'auto';
const AUTONOMY: Autonomy[] = ['suggest', 'assisted', 'auto'];
const FORMATS: PostFormat[] = ['post', 'carousel', 'story', 'reel', 'article'];
const POST_EDITABLE = new Set(['draft', 'review', 'changes', 'approved', 'scheduled', 'rejected', 'failed', 'partial']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Actor = { userId: string | null; name?: string | null; role?: string | null };
export type ContentActor = Actor;

/** Canva (content-canva.service.ts) регистрирует себя: ИИ-посты с canvaTemplate и строка шаблонов для промптов. */
export interface ContentCanvaHooks {
  autofillForAi(tenantId: string, postId: string, tpl: { id?: string; fields?: Record<string, string> }): Promise<unknown>;
  templatesLine(tenantId: string): Promise<string>;
}

const pubBase = () => (process.env.PUBLIC_API_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Движок контента и публикаций (/marketing/smm). Каналы всех сетей, контент-планы, посты с вариантами
 * под каналы, согласование текста и картинок, режимы «Предложения / Помощник / Авто». Публикует
 * ContentPublisherService через адаптеры (content-adapters.ts). См. md/content_engine_plan.md.
 */
/** TypeORM на Postgres отдаёт UPDATE/DELETE … RETURNING как [rows, rowCount] — приводим к массиву строк. */
export function pgRows<T = any>(res: unknown): T[] {
  if (Array.isArray(res) && res.length === 2 && Array.isArray(res[0]) && typeof res[1] === 'number') return res[0] as T[];
  return (res as T[]) || [];
}

@Injectable()
export class ContentService implements OnModuleInit, EmployeeContentHooks {
  private readonly log = new Logger(ContentService.name);
  private credsCache = new Map<string, { at: number; creds: Credentials }>();
  private canva: ContentCanvaHooks | null = null;

  registerCanva(h: ContentCanvaHooks) {
    this.canva = h;
  }

  /** Строка шаблонов Canva для промптов ИИ ('' если Canva не подключена или шаблонов нет). */
  async canvaLine(tenantId: string): Promise<string> {
    return this.canva ? this.canva.templatesLine(tenantId).catch(() => '') : '';
  }

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly smm: SmmService,
    private readonly platform: PlatformSettingsService,
    private readonly openai: AiOpenAiService,
    private readonly assistant: AiAssistantService,
    private readonly quota: AiQuotaService,
    private readonly storage: StorageQuotaService,
    private readonly moduleRef: ModuleRef,
    private readonly videoAccounts: ContentVideoAccountsService,
  ) {}

  /** Регистрируемся в ИИ-сотрудниках лениво (без импорта их модуля — цикл DI): действие content_post. */
  onModuleInit(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AiEmployeesService } = require('../ai-employees/ai-employees.service');
      const emp = this.moduleRef.get(AiEmployeesService, { strict: false });
      emp?.registerContentHooks?.(this);
    } catch (e) {
      this.log.warn(`content hooks for AI employees not registered: ${(e as Error).message}`);
    }
  }

  /**
   * Лучшее время по реальным метрикам за 90 дней: средний ER (вовлечённость / охват) по слоту «день недели × час»
   * в часовом поясе `timezone`. Только сети с ≥ 8 измеренными постами и слоты с ≥ 2 постами — иначе это шум, не данные.
   */
  async bestTimes(tenantId: string, timezone = 'UTC'): Promise<Record<string, Array<{ dow: number; hour: number; er: number; n: number }>>> {
    const rows = await this.q(
      `SELECT c.network, v.published_at, v.metrics FROM content_variants v JOIN content_channels c ON c.id = v.channel_id
        WHERE v.tenant_id = $1 AND v.status = 'published' AND v.metrics IS NOT NULL AND v.published_at > now() - interval '90 days'`,
      [tenantId],
    );
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
    } catch {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
    }
    const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const by: Record<string, { measured: number; slots: Map<string, { er: number; n: number }> }> = {};
    for (const r of rows) {
      const m = r.metrics || {};
      const reach = Number(m.reach || 0);
      if (reach <= 0) continue;
      const eng = ['likes', 'comments', 'shares', 'saved'].reduce((a, k) => a + Number(m[k] || 0), 0);
      const parts = Object.fromEntries(fmt.formatToParts(new Date(r.published_at)).map((x) => [x.type, x.value]));
      const key = `${DOW[parts.weekday] || 0}-${Number(parts.hour)}`;
      const b = (by[r.network] ||= { measured: 0, slots: new Map() });
      b.measured++;
      const sl = b.slots.get(key) || { er: 0, n: 0 };
      sl.er += eng / reach;
      sl.n++;
      b.slots.set(key, sl);
    }
    const out: Record<string, Array<{ dow: number; hour: number; er: number; n: number }>> = {};
    for (const [net, b] of Object.entries(by)) {
      if (b.measured < 8) continue;
      const top = [...b.slots.entries()]
        .filter(([, v]) => v.n >= 2)
        .map(([k, v]) => ({ dow: Number(k.split('-')[0]), hour: Number(k.split('-')[1]), er: Math.round((v.er / v.n) * 1000) / 10, n: v.n }))
        .sort((a, z) => z.er - a.er)
        .slice(0, 3);
      if (top.length) out[net] = top;
    }
    return out;
  }

  /** Строка для промпта ИИ: «instagram: Thu 18:00 (ER 6.2%, 4 posts); …» или '' если данных мало. */
  async bestTimesLine(tenantId: string, timezone = 'UTC'): Promise<string> {
    const D = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const bt = await this.bestTimes(tenantId, timezone).catch(() => ({} as Record<string, any[]>));
    const parts = Object.entries(bt).map(([net, xs]) => `${net}: ${xs.map((x) => `${D[x.dow]} ${String(x.hour).padStart(2, '0')}:00 (ER ${x.er}%, ${x.n} posts)`).join(', ')}`);
    return parts.length ? `Best posting times from this company's own metrics (${timezone}, last 90 days) — prefer them: ${parts.join('; ')}.` : '';
  }

  // ── EmployeeContentHooks ──
  async channelsFor(tenantId: string, departmentId: string | null) {
    return (await this.channelsForDepartment(tenantId, departmentId)).map((c) => ({ id: c.id, network: c.network, accountName: c.accountName, autonomy: c.autonomy }));
  }

  async createPosts(tenantId: string, agent: { id: string; departmentId: string | null; name: string }, p: Record<string, any>) {
    const r = await this.createFromAi(tenantId, {
      departmentId: agent.departmentId,
      agentId: agent.id,
      source: 'ai_employee',
      planTitle: String(p.planTitle || p.title || `${agent.name}: контент-план`).slice(0, 255),
      posts: (Array.isArray(p.posts) ? p.posts : []).map((x: any) => ({
        channelIds: Array.isArray(x?.channelIds) ? x.channelIds.map(String) : [],
        publishAt: x?.publishAt ? String(x.publishAt) : null,
        text: String(x?.text ?? ''),
        title: x?.title ? String(x.title) : undefined,
        rubric: x?.rubric ? String(x.rubric) : undefined,
        format: x?.format ? String(x.format) : undefined,
        variants: x?.variants && typeof x.variants === 'object' ? x.variants : undefined,
        imagePrompt: x?.imagePrompt ? String(x.imagePrompt) : undefined,
        canvaTemplate: x?.canvaTemplate && typeof x.canvaTemplate === 'object' ? x.canvaTemplate : undefined,
      })),
      timezone: typeof p.timezone === 'string' ? p.timezone : 'UTC',
      withImages: true,
    });
    if (!r.posts) {
      await this.q(`DELETE FROM content_plans WHERE tenant_id = $1 AND id = $2`, [tenantId, r.planId]);
      throw new Error('content_post: no valid posts (check channelIds from CONTENT CHANNELS and text)');
    }
    return r;
  }

  private async q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return pgRows<T>(await this.db.query(sql, params));
  }

  // ───────────────────────── каналы ─────────────────────────

  private channelDto(r: any) {
    return {
      id: r.id,
      network: r.network as Network,
      accountId: r.account_id,
      accountName: r.account_name,
      accountHandle: r.account_handle,
      avatarUrl: r.avatar_url,
      autonomy: r.autonomy as Autonomy,
      rules: r.rules || {},
      enabled: r.enabled,
      status: r.status,
      lastError: r.last_error,
      departmentIds: r.department_ids || [],
      caps: ADAPTERS[r.network as Network]?.caps ?? null,
      createdAt: r.created_at,
    };
  }

  async listChannels(tenantId: string) {
    const rows = await this.q(`SELECT * FROM content_channels WHERE tenant_id = $1 ORDER BY created_at`, [tenantId]);
    return rows.map((r) => this.channelDto(r));
  }

  private async channelRow(tenantId: string, id: string) {
    if (!uuidRe.test(id)) throw new NotFoundException('Channel not found');
    const [r] = await this.q(`SELECT * FROM content_channels WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!r) throw new NotFoundException('Channel not found');
    return r;
  }

  /** Что можно подключить: страницы Facebook и Instagram из Meta, боты Telegram, профили/компании LinkedIn. */
  async connectOptions(tenantId: string) {
    const existing = new Set((await this.q(`SELECT network || ':' || account_id k FROM content_channels WHERE tenant_id = $1`, [tenantId])).map((r) => r.k));
    // Meta
    let meta: { connected: boolean; error: string | null; pages: any[] } = { connected: false, error: null, pages: [] };
    try {
      const targets = await this.smm.listMetaPublishTargets(tenantId);
      meta = {
        connected: true,
        error: null,
        pages: targets.map((p) => ({
          pageId: p.pageId,
          name: p.name,
          picture: p.picture,
          instagram: p.igUserId ? { id: p.igUserId, username: p.igUsername, added: existing.has(`instagram:${p.igUserId}`) } : null,
          facebookAdded: existing.has(`facebook:${p.pageId}`),
        })),
      };
    } catch (e) {
      const msg = (e as Error).message || '';
      meta = { connected: !/not connected/i.test(msg), error: /not connected/i.test(msg) ? null : msg.slice(0, 300), pages: [] };
    }
    // Telegram
    const bots = await this.q(`SELECT id, "botUsername" username FROM telegram_bots WHERE "tenantId" = $1`, [tenantId]);
    // LinkedIn
    const li = await this.platform.getGenericIntegrationOAuthConfig('linkedin');
    const liConns = await this.q(`SELECT id, external_id, name, avatar_url, expires_at, meta FROM content_connections WHERE tenant_id = $1 AND provider = 'linkedin' ORDER BY created_at`, [tenantId]);
    // VK
    const vk = await this.vkIdApp();
    const vkConns = await this.q(`SELECT id, external_id, name, avatar_url, meta FROM content_connections WHERE tenant_id = $1 AND provider = 'vk' ORDER BY created_at`, [tenantId]);
    const th = await this.platform.getGenericIntegrationOAuthConfig('threads');
    const thConns = await this.q(`SELECT id, external_id, name, avatar_url, expires_at FROM content_connections WHERE tenant_id = $1 AND provider = 'threads' ORDER BY created_at`, [tenantId]);
    const ytConf = await this.videoAccounts.configured('youtube');
    const ttConf = await this.videoAccounts.configured('tiktok');
    const vconn = async (prov: 'youtube' | 'tiktok') =>
      (await this.videoAccounts.connections(tenantId, prov)).map((c: any) => ({ id: c.id, accountId: c.external_id, name: c.name, avatarUrl: c.avatar_url, username: c.meta?.username || c.meta?.customUrl || null, added: existing.has(`${prov}:${c.external_id}`) }));
    return {
      meta,
      youtube: { configured: ytConf, connections: await vconn('youtube') },
      tiktok: { configured: ttConf, connections: await vconn('tiktok') },
      threads: {
        configured: !!(th.clientId && th.clientSecret),
        connections: thConns.map((c) => ({ id: c.id, userId: c.external_id, name: c.name, avatarUrl: c.avatar_url, expiresAt: c.expires_at, added: existing.has(`threads:${c.external_id}`) })),
      },
      vk: {
        configured: !!vk.clientId,
        connections: vkConns.map((c) => ({
          id: c.id,
          name: c.name,
          avatarUrl: c.avatar_url,
          groups: ((c.meta?.groups as any[]) || []).map((g) => ({ id: g.id, name: g.name, screenName: g.screenName, photo: g.photo, added: existing.has(`vk:${g.id}`) })),
        })),
      },
      telegram: { bots: bots.map((b) => ({ id: b.id, username: b.username })) },
      linkedin: {
        configured: !!(li.clientId && li.clientSecret),
        orgEnabled: this.linkedinOrgEnabled(),
        connections: liConns.map((c) => ({
          id: c.id,
          name: c.name,
          avatarUrl: c.avatar_url,
          expiresAt: c.expires_at,
          targets: [
            { urn: c.external_id, name: c.name, kind: 'person', added: existing.has(`linkedin:${c.external_id}`) },
            ...((c.meta?.organizations as any[]) || []).map((o) => ({ urn: o.urn, name: o.name, kind: 'organization', added: existing.has(`linkedin:${o.urn}`) })),
          ],
        })),
      },
    };
  }

  async addChannel(
    tenantId: string,
    actor: Actor,
    body: { network?: string; pageId?: string; igUserId?: string; botId?: string; channel?: string; connectionId?: string; urn?: string; groupId?: string; autonomy?: string },
  ) {
    const network = String(body.network || '') as Network;
    if (!NETWORKS.includes(network)) throw new BadRequestException('Unknown network');
    if (!ADAPTERS[network].caps.ready) throw new BadRequestException('This network is not available yet');
    const autonomy = AUTONOMY.includes(body.autonomy as Autonomy) ? (body.autonomy as Autonomy) : 'assisted';
    let row: { accountId: string; name: string; handle: string | null; avatar: string | null; connectionId: string | null; botId: string | null; rules: Record<string, unknown> };
    if (network === 'instagram' || network === 'facebook') {
      const targets = await this.smm.listMetaPublishTargets(tenantId);
      const page = targets.find((p) => p.pageId === String(body.pageId || ''));
      if (!page) throw new BadRequestException('Facebook page not found in the connected Meta account');
      if (network === 'instagram') {
        if (!page.igUserId || page.igUserId !== String(body.igUserId || page.igUserId)) throw new BadRequestException('This page has no Instagram business account linked');
        row = { accountId: page.igUserId, name: page.igUsername ? `@${page.igUsername}` : page.name, handle: page.igUsername, avatar: page.igPicture || page.picture, connectionId: null, botId: null, rules: { pageId: page.pageId } };
      } else {
        row = { accountId: page.pageId, name: page.name, handle: page.username, avatar: page.picture, connectionId: null, botId: null, rules: {} };
      }
    } else if (network === 'telegram') {
      const chk = await this.telegramCheck(tenantId, String(body.botId || ''), String(body.channel || ''));
      if (typeof chk === 'string') throw new BadRequestException(chk);
      row = { accountId: chk.chatId, name: chk.title, handle: chk.username, avatar: null, connectionId: null, botId: String(body.botId), rules: {} };
    } else if (network === 'linkedin') {
      const [c] = await this.q(`SELECT * FROM content_connections WHERE tenant_id = $1 AND id = $2 AND provider = 'linkedin'`, [tenantId, String(body.connectionId || '')]);
      if (!c) throw new BadRequestException('Connect LinkedIn first');
      const urn = String(body.urn || c.external_id);
      if (urn === c.external_id) {
        row = { accountId: urn, name: c.name || 'LinkedIn', handle: null, avatar: c.avatar_url, connectionId: c.id, botId: null, rules: { kind: 'person' } };
      } else {
        const org = ((c.meta?.organizations as any[]) || []).find((o) => o.urn === urn);
        if (!org) throw new BadRequestException('You are not an admin of this LinkedIn page');
        row = { accountId: urn, name: org.name, handle: null, avatar: org.logo || null, connectionId: c.id, botId: null, rules: { kind: 'organization' } };
      }
    } else if (network === 'youtube' || network === 'tiktok') {
      const [c] = await this.q(`SELECT * FROM content_connections WHERE tenant_id = $1 AND id = $2 AND provider = $3`, [tenantId, String(body.connectionId || ''), network]);
      if (!c) throw new BadRequestException(`Connect ${network === 'youtube' ? 'YouTube' : 'TikTok'} first`);
      row = { accountId: c.external_id, name: c.name || network, handle: c.meta?.username || c.meta?.customUrl || null, avatar: c.avatar_url, connectionId: c.id, botId: null, rules: {} };
    } else if (network === 'threads') {
      const [c] = await this.q(`SELECT * FROM content_connections WHERE tenant_id = $1 AND id = $2 AND provider = 'threads'`, [tenantId, String(body.connectionId || '')]);
      if (!c) throw new BadRequestException('Connect Threads first');
      row = { accountId: c.external_id, name: c.name || 'Threads', handle: c.meta?.username || null, avatar: c.avatar_url, connectionId: c.id, botId: null, rules: {} };
    } else if (network === 'vk') {
      const [c] = await this.q(`SELECT * FROM content_connections WHERE tenant_id = $1 AND id = $2 AND provider = 'vk'`, [tenantId, String(body.connectionId || '')]);
      if (!c) throw new BadRequestException('Connect VK first');
      const g = ((c.meta?.groups as any[]) || []).find((x) => String(x.id) === String(body.groupId || ''));
      if (!g) throw new BadRequestException('You are not an admin or editor of this VK community');
      row = { accountId: String(g.id), name: g.name, handle: g.screenName || null, avatar: g.photo || null, connectionId: c.id, botId: null, rules: {} };
    } else {
      throw new BadRequestException('This network is not available yet');
    }
    const [saved] = await this.q(
      `INSERT INTO content_channels (tenant_id, network, account_id, account_name, account_handle, avatar_url, connection_id, bot_id, autonomy, rules, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       ON CONFLICT (tenant_id, network, account_id) DO UPDATE SET account_name = EXCLUDED.account_name, account_handle = EXCLUDED.account_handle,
         avatar_url = EXCLUDED.avatar_url, connection_id = EXCLUDED.connection_id, bot_id = EXCLUDED.bot_id, enabled = true, status = 'ok', last_error = NULL, updated_at = now()
       RETURNING *`,
      [tenantId, network, row.accountId, row.name.slice(0, 255), row.handle, row.avatar, row.connectionId, row.botId, autonomy, JSON.stringify(row.rules), actor.userId],
    );
    return this.channelDto(saved);
  }

  async updateChannel(tenantId: string, id: string, body: { autonomy?: string; enabled?: boolean; rules?: Record<string, unknown>; departmentIds?: string[] }) {
    const r = await this.channelRow(tenantId, id);
    const autonomy = body.autonomy !== undefined ? (AUTONOMY.includes(body.autonomy as Autonomy) ? body.autonomy : r.autonomy) : r.autonomy;
    const enabled = body.enabled !== undefined ? !!body.enabled : r.enabled;
    const rules = body.rules !== undefined ? { ...(r.rules || {}), ...this.cleanRules(body.rules) } : r.rules || {};
    let depts: string[] = r.department_ids || [];
    if (body.departmentIds !== undefined) {
      const ids = (Array.isArray(body.departmentIds) ? body.departmentIds : []).map(String).filter((x) => uuidRe.test(x));
      const ok = ids.length ? await this.q(`SELECT id FROM ai_departments WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, ids]) : [];
      depts = ok.map((x) => x.id);
    }
    const [saved] = await this.q(
      `UPDATE content_channels SET autonomy = $3, enabled = $4, rules = $5::jsonb, department_ids = $6::text[], updated_at = now() WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id, autonomy, enabled, JSON.stringify(rules), depts],
    );
    return this.channelDto(saved);
  }

  private cleanRules(raw: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    if (raw.dailyLimit !== undefined) out.dailyLimit = Math.max(0, Math.min(50, Number(raw.dailyLimit) || 0));
    if (raw.timezone !== undefined) out.timezone = String(raw.timezone || '').slice(0, 64) || null;
    if (raw.hashtags !== undefined) out.hashtags = String(raw.hashtags || '').slice(0, 500);
    if (raw.signature !== undefined) out.signature = String(raw.signature || '').slice(0, 500);
    return out;
  }

  async removeChannel(tenantId: string, id: string) {
    await this.channelRow(tenantId, id);
    await this.q(`DELETE FROM content_channels WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return { ok: true };
  }

  // ───────────────────────── Telegram ─────────────────────────

  private async telegramCheck(tenantId: string, botId: string, channel: string): Promise<{ token: string; chatId: string; title: string; username: string | null } | string> {
    const ch = channel.trim();
    if (!/^@[A-Za-z0-9_]{4,64}$|^-100\d{5,20}$/.test(ch)) return 'Канал: укажите «@имя_канала» или id «-100…»';
    if (!uuidRe.test(botId)) return 'Выберите бота компании';
    const [bot] = await this.q(`SELECT "botToken" token FROM telegram_bots WHERE "tenantId" = $1 AND id = $2`, [tenantId, botId]);
    if (!bot?.token) return 'Бот не найден';
    try {
      const chat = await axios.get(`${TG_API}/bot${bot.token}/getChat`, { params: { chat_id: ch }, timeout: 15_000 });
      if (chat.data?.result?.type !== 'channel') return `${ch} — не канал`;
      const me = await axios.get(`${TG_API}/bot${bot.token}/getMe`, { timeout: 15_000 });
      const m = (await axios.get(`${TG_API}/bot${bot.token}/getChatMember`, { params: { chat_id: ch, user_id: me.data?.result?.id }, timeout: 15_000 })).data?.result;
      if (!(m?.status === 'creator' || (m?.status === 'administrator' && m?.can_post_messages))) return `Сделайте бота администратором ${ch} с правом публикации`;
      return { token: bot.token, chatId: String(chat.data.result.id), title: String(chat.data.result.title ?? ch), username: chat.data.result.username ?? null };
    } catch (e: any) {
      return `Telegram: ${e?.response?.data?.description ?? e.message}`;
    }
  }

  // ───────────────────────── VK ID OAuth (OAuth 2.1 + PKCE) ─────────────────────────

  /** state → верификатор PKCE: короткий state (VK ID требует ≥ 32 символов), секрет не уходит в URL. 30 мин. */
  private vkPending = new Map<string, { tenantId: string; userId: string | null; verifier: string; at: number }>();
  /** Параллельные обновления одного токена: VK ID ротирует refresh-токен, второй запрос получил бы отказ. */
  private vkRefreshing = new Map<string, Promise<string>>();

  private vkIdBase() {
    return (process.env.CONTENT_VKID_BASE || 'https://id.vk.com').replace(/\/$/, '');
  }

  /** Приложение VK ID: отдельное «vkid» из pl1, иначе — уже заведённое VK-приложение SMM (VK перевёл приложения на VK ID с тем же Client ID). */
  private async vkIdApp(): Promise<{ clientId: string | null }> {
    const own = await this.platform.getGenericIntegrationOAuthConfig('vkid');
    if (own.clientId) return { clientId: own.clientId };
    const legacy = await this.platform.getVkOAuthConfig().catch(() => ({ clientId: null }));
    return { clientId: legacy.clientId || null };
  }

  private vkRedirect() {
    return `${pubBase()}/v1/content/vk/callback`;
  }

  async vkAuthUrl(tenantId: string, userId: string | null) {
    const { clientId } = await this.vkIdApp();
    if (!clientId) throw new BadRequestException('Приложение VK ID не настроено в pl1 (OAuth-приложения → vkid)');
    const now = Date.now();
    for (const [k, v] of this.vkPending) if (now - v.at > 30 * 60_000) this.vkPending.delete(k);
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    this.vkPending.set(state, { tenantId, userId, verifier, at: now });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.vkRedirect(),
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      scope: 'wall photos video groups',
    });
    return { url: `${this.vkIdBase()}/authorize?${params.toString()}` };
  }

  private async vkTokenRequest(form: Record<string, string>) {
    const r = await axios.post(`${this.vkIdBase()}/oauth2/auth`, new URLSearchParams(form).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    });
    if (r.data?.error || !r.data?.access_token) throw new Error(`VK ID: ${r.data?.error_description || r.data?.error || 'no access token'}`);
    return r.data as { access_token: string; refresh_token?: string; expires_in?: number; user_id?: number | string; scope?: string };
  }

  async vkCallback(q: { code?: string; state?: string; device_id?: string }): Promise<string> {
    const back = (x: string) => `${pubBase()}/marketing/smm?tab=channels&vk=${x}`;
    const st = q.state ? this.vkPending.get(q.state) : undefined;
    if (q.state) this.vkPending.delete(q.state);
    if (!st || Date.now() - st.at > 30 * 60_000 || !q.code || !q.device_id) return back('invalid_state');
    const { clientId } = await this.vkIdApp();
    if (!clientId) return back('missing_app');
    try {
      const tok = await this.vkTokenRequest({
        grant_type: 'authorization_code',
        code: q.code,
        code_verifier: st.verifier,
        client_id: clientId,
        device_id: q.device_id,
        redirect_uri: this.vkRedirect(),
        state: randomBytes(24).toString('base64url'),
      });
      let name: string | null = null;
      let avatar: string | null = null;
      let userId = String(tok.user_id || '');
      try {
        const u = await axios.post(`${this.vkIdBase()}/oauth2/user_info`, new URLSearchParams({ client_id: clientId, access_token: tok.access_token }).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15_000,
        });
        const user = u.data?.user || {};
        name = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        avatar = user.avatar || null;
        userId = userId || String(user.user_id || '');
      } catch {
        // имя профиля не критично
      }
      if (!userId) throw new Error('VK ID: no user id');
      // сообщества, где пользователь админ или редактор — в них можно публиковать от имени сообщества
      const g = await vkCall('groups.get', { filter: 'admin,editor', extended: '1', count: '200' }, tok.access_token);
      const groups = ((g?.items as any[]) || []).map((x) => ({ id: String(x.id), name: String(x.name || x.screen_name || x.id), screenName: x.screen_name || null, photo: x.photo_100 || null }));
      await this.q(
        `INSERT INTO content_connections (tenant_id, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, scopes, meta, created_by)
         VALUES ($1,'vk',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, meta = EXCLUDED.meta, updated_at = now()`,
        [
          st.tenantId,
          userId,
          name,
          avatar,
          tok.access_token,
          tok.refresh_token || null,
          tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
          String(tok.scope || ''),
          JSON.stringify({ deviceId: q.device_id, groups }),
          uuidRe.test(String(st.userId || '')) ? st.userId : null,
        ],
      );
      await this.q(
        `UPDATE content_channels SET status = 'ok', last_error = NULL WHERE tenant_id = $1 AND network = 'vk' AND connection_id IN (SELECT id FROM content_connections WHERE tenant_id = $1 AND provider = 'vk' AND external_id = $2)`,
        [st.tenantId, userId],
      );
      this.invalidateCreds();
      return back('connected');
    } catch (e: any) {
      this.log.warn(`vk oauth failed: ${e?.response?.data?.error_description || e.message}`);
      return back('oauth_error');
    }
  }

  /** Действующий токен VK: обновляет за 5 минут до истечения (refresh ротируется — сохраняем новый). */
  private async vkAccessToken(connectionId: string): Promise<string> {
    const [c] = await this.q(`SELECT * FROM content_connections WHERE id = $1 AND provider = 'vk'`, [connectionId]);
    if (!c?.access_token) throw new Error('VK: подключение удалено — reconnect VK in Channels');
    if (!c.expires_at || new Date(c.expires_at).getTime() > Date.now() + 5 * 60_000) return c.access_token;
    const running = this.vkRefreshing.get(connectionId);
    if (running) return running;
    const job = (async () => {
      if (!c.refresh_token) throw new Error('VK: access expired — reconnect VK in Channels');
      const { clientId } = await this.vkIdApp();
      if (!clientId) throw new Error('VK: приложение VK ID не настроено — reconnect VK in Channels');
      let tok;
      try {
        tok = await this.vkTokenRequest({
          grant_type: 'refresh_token',
          refresh_token: c.refresh_token,
          client_id: clientId,
          device_id: String(c.meta?.deviceId || ''),
          state: randomBytes(24).toString('base64url'),
        });
      } catch (e: any) {
        throw new Error(`VK: access expired — reconnect VK in Channels (${e?.response?.data?.error || e.message})`);
      }
      await this.q(`UPDATE content_connections SET access_token = $2, refresh_token = COALESCE($3, refresh_token), expires_at = $4, updated_at = now() WHERE id = $1`, [
        connectionId,
        tok.access_token,
        tok.refresh_token || null,
        tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
      ]);
      return tok.access_token;
    })();
    this.vkRefreshing.set(connectionId, job);
    try {
      return await job;
    } finally {
      this.vkRefreshing.delete(connectionId);
    }
  }

  // ───────────────────────── Threads OAuth (отдельное приложение Threads у Meta) ─────────────────────────

  private threadsRedirect() {
    return `${pubBase()}/v1/content/threads/callback`;
  }

  async threadsAuthUrl(tenantId: string, userId: string | null) {
    const { clientId } = await this.platform.getGenericIntegrationOAuthConfig('threads');
    if (!clientId) throw new BadRequestException('Приложение Threads не настроено в pl1 (OAuth-приложения → threads)');
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.threadsRedirect(),
      scope: 'threads_basic,threads_content_publish,threads_manage_insights',
      response_type: 'code',
      state: this.sign({ tenantId, userId, ts: Date.now(), n: 'threads' }),
    });
    return { url: `${process.env.CONTENT_THREADS_AUTH || 'https://threads.net/oauth/authorize'}?${p.toString()}` };
  }

  async threadsCallback(code?: string, state?: string): Promise<string> {
    const back = (x: string) => `${pubBase()}/marketing/smm?tab=channels&threads=${x}`;
    const st = this.verify(state);
    if (!st?.tenantId || st.n !== 'threads' || !code) return back('invalid_state');
    const { clientId, clientSecret } = await this.platform.getGenericIntegrationOAuthConfig('threads');
    if (!clientId || !clientSecret) return back('missing_app');
    try {
      // Threads добавляет «#_» к коду в редиректе
      const short = await axios.post(
        `${THREADS_API}/oauth/access_token`,
        new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri: this.threadsRedirect(), code: code.replace(/#_$/, '') }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      const long = await axios.get(`${THREADS_API}/access_token`, { params: { grant_type: 'th_exchange_token', client_secret: clientSecret, access_token: short.data.access_token }, timeout: 20_000 });
      const token = String(long.data?.access_token || short.data.access_token);
      const expiresAt = long.data?.expires_in ? new Date(Date.now() + Number(long.data.expires_in) * 1000) : null;
      const me = await axios.get(`${THREADS_API}/v1.0/me`, { params: { fields: 'id,username,threads_profile_picture_url', access_token: token }, timeout: 20_000 });
      const uid = String(me.data?.id || short.data.user_id || '');
      if (!uid) throw new Error('no user id');
      await this.q(
        `INSERT INTO content_connections (tenant_id, provider, external_id, name, avatar_url, access_token, expires_at, scopes, meta, created_by)
         VALUES ($1,'threads',$2,$3,$4,$5,$6,'threads_basic,threads_content_publish,threads_manage_insights',$7::jsonb,$8)
         ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, access_token = EXCLUDED.access_token,
           expires_at = EXCLUDED.expires_at, meta = EXCLUDED.meta, updated_at = now()`,
        [st.tenantId, uid, me.data?.username ? `@${me.data.username}` : 'Threads', me.data?.threads_profile_picture_url || null, token, expiresAt, JSON.stringify({ username: me.data?.username || null, tokenAt: Date.now() }), uuidRe.test(String(st.userId || '')) ? st.userId : null],
      );
      await this.q(`UPDATE content_channels SET status = 'ok', last_error = NULL WHERE tenant_id = $1 AND network = 'threads' AND account_id = $2`, [st.tenantId, uid]);
      this.invalidateCreds();
      return back('connected');
    } catch (e: any) {
      this.log.warn(`threads oauth failed: ${e?.response?.data?.error?.message || e.message}`);
      return back('oauth_error');
    }
  }

  /** Долгоживущий токен Threads (60 дней): продлеваем, когда осталось < 7 дней (и токену уже > суток). */
  private async threadsToken(connectionId: string): Promise<string> {
    const [c] = await this.q(`SELECT * FROM content_connections WHERE id = $1 AND provider = 'threads'`, [connectionId]);
    if (!c?.access_token) throw new Error('Threads: подключение удалено — reconnect Threads in Channels');
    const exp = c.expires_at ? new Date(c.expires_at).getTime() : null;
    if (exp && exp < Date.now()) throw new Error('Threads: access expired — reconnect Threads in Channels');
    const issued = Number(c.meta?.tokenAt || 0);
    if (exp && exp - Date.now() < 7 * 86_400_000 && Date.now() - issued > 86_400_000) {
      try {
        const r = await axios.get(`${THREADS_API}/refresh_access_token`, { params: { grant_type: 'th_refresh_token', access_token: c.access_token }, timeout: 20_000 });
        if (r.data?.access_token) {
          await this.q(
            `UPDATE content_connections SET access_token = $2, expires_at = $3, meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{tokenAt}', to_jsonb($4::bigint)), updated_at = now() WHERE id = $1`,
            [connectionId, r.data.access_token, r.data.expires_in ? new Date(Date.now() + Number(r.data.expires_in) * 1000) : c.expires_at, Date.now()],
          );
          return r.data.access_token;
        }
      } catch (e) {
        this.log.warn(`threads token refresh failed: ${(e as Error).message}`);
      }
    }
    return c.access_token;
  }

  // ───────────────────────── LinkedIn OAuth ─────────────────────────

  private linkedinOrgEnabled() {
    return process.env.LINKEDIN_ORG_ENABLED === '1' || process.env.LINKEDIN_ORG_ENABLED === 'true';
  }

  private linkedinRedirect() {
    return `${pubBase()}/v1/content/linkedin/callback`;
  }

  private sign(payload: Record<string, unknown>) {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', process.env.JWT_SECRET || 'content').update(raw).digest('base64url');
    return `${raw}.${sig}`;
  }

  private verify(state?: string): Record<string, any> | null {
    if (!state || !state.includes('.')) return null;
    const [raw, sig] = state.split('.');
    const exp = createHmac('sha256', process.env.JWT_SECRET || 'content').update(raw).digest('base64url');
    if (exp !== sig) return null;
    try {
      const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      return Date.now() - Number(p.ts || 0) < 30 * 60_000 ? p : null;
    } catch {
      return null;
    }
  }

  async linkedinAuthUrl(tenantId: string, userId: string | null) {
    const { clientId } = await this.platform.getGenericIntegrationOAuthConfig('linkedin');
    if (!clientId) throw new BadRequestException('LinkedIn приложение не настроено в pl1 (OAuth-приложения → linkedin)');
    const scopes = ['openid', 'profile', 'w_member_social', ...(this.linkedinOrgEnabled() ? ['w_organization_social', 'r_organization_social', 'rw_organization_admin'] : [])];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.linkedinRedirect(),
      state: this.sign({ tenantId, userId, ts: Date.now() }),
      scope: scopes.join(' '),
    });
    return { url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` };
  }

  async linkedinCallback(code?: string, state?: string): Promise<string> {
    const back = (q: string) => `${pubBase()}/marketing/smm?tab=channels&linkedin=${q}`;
    const st = this.verify(state);
    if (!st?.tenantId || !code) return back('invalid_state');
    const { clientId, clientSecret } = await this.platform.getGenericIntegrationOAuthConfig('linkedin');
    if (!clientId || !clientSecret) return back('missing_app');
    try {
      const tok = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.linkedinRedirect(), client_id: clientId, client_secret: clientSecret }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      const accessToken = tok.data?.access_token as string;
      const expiresAt = tok.data?.expires_in ? new Date(Date.now() + Number(tok.data.expires_in) * 1000) : null;
      const me = await axios.get('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20_000 });
      const urn = `urn:li:person:${me.data.sub}`;
      const organizations: Array<{ urn: string; name: string; logo: string | null }> = [];
      if (this.linkedinOrgEnabled()) {
        try {
          const acl = await axios.get('https://api.linkedin.com/rest/organizationAcls', {
            params: { q: 'roleAssignee', role: 'ADMINISTRATOR', state: 'APPROVED' },
            headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202509', 'X-Restli-Protocol-Version': '2.0.0' },
            timeout: 20_000,
          });
          for (const el of acl.data?.elements || []) {
            const orgUrn = String(el.organization || el.organizationTarget || '');
            if (!orgUrn) continue;
            let name = orgUrn;
            try {
              const o = await axios.get(`https://api.linkedin.com/rest/organizations/${orgUrn.split(':').pop()}`, {
                headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202509', 'X-Restli-Protocol-Version': '2.0.0' },
                timeout: 20_000,
              });
              name = o.data?.localizedName || name;
            } catch {
              // имя страницы не критично
            }
            organizations.push({ urn: orgUrn, name, logo: null });
          }
        } catch (e) {
          this.log.warn(`linkedin org list failed: ${(e as Error).message}`);
        }
      }
      await this.q(
        `INSERT INTO content_connections (tenant_id, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, scopes, meta, created_by)
         VALUES ($1,'linkedin',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, meta = EXCLUDED.meta, updated_at = now()`,
        [st.tenantId, urn, me.data.name || null, me.data.picture || null, accessToken, tok.data?.refresh_token || null, expiresAt, String(tok.data?.scope || ''), JSON.stringify({ organizations }), uuidRe.test(String(st.userId || '')) ? st.userId : null],
      );
      // переподключение оживляет каналы этого подключения
      await this.q(`UPDATE content_channels SET status = 'ok', last_error = NULL WHERE tenant_id = $1 AND network = 'linkedin' AND connection_id IN (SELECT id FROM content_connections WHERE tenant_id = $1 AND external_id = $2)`, [st.tenantId, urn]);
      return back('connected');
    } catch (e: any) {
      this.log.warn(`linkedin oauth failed: ${e?.response?.data?.error_description || e.message}`);
      return back('oauth_error');
    }
  }

  // ───────────────────────── учётные данные для адаптеров ─────────────────────────

  async credentialsFor(channel: any): Promise<Credentials> {
    const key = channel.id;
    const hit = this.credsCache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.creds;
    let creds: Credentials;
    const net = channel.network as Network;
    if (net === 'instagram' || net === 'facebook') {
      const targets = await this.smm.listMetaPublishTargets(channel.tenant_id);
      const pageId = net === 'instagram' ? String(channel.rules?.pageId || '') : channel.account_id;
      const page = targets.find((p) => p.pageId === pageId);
      if (!page?.pageToken) throw new Error('Meta: страница больше не доступна — переподключите Meta в «Каналах»');
      creds = net === 'instagram' ? { network: 'instagram', igUserId: channel.account_id, pageToken: page.pageToken } : { network: 'facebook', pageId, pageToken: page.pageToken };
    } else if (net === 'telegram') {
      const [bot] = await this.q(`SELECT "botToken" token FROM telegram_bots WHERE "tenantId" = $1 AND id = $2`, [channel.tenant_id, channel.bot_id]);
      if (!bot?.token) throw new Error('Telegram: бот канала удалён');
      creds = { network: 'telegram', botToken: bot.token, chatId: channel.account_id, username: channel.account_handle || null };
    } else if (net === 'linkedin') {
      const [c] = await this.q(`SELECT access_token, expires_at FROM content_connections WHERE id = $1`, [channel.connection_id]);
      if (!c?.access_token) throw new Error('LinkedIn: подключение удалено — подключите заново');
      if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) throw new Error('LinkedIn: срок доступа истёк — переподключите LinkedIn');
      creds = { network: 'linkedin', accessToken: c.access_token, authorUrn: channel.account_id };
    } else if (net === 'youtube' || net === 'tiktok') {
      const t = await this.videoAccounts.token(channel.connection_id);
      return net === 'youtube'
        ? { network: 'youtube', accessToken: t.accessToken, channelId: channel.account_id }
        : { network: 'tiktok', accessToken: t.accessToken, openId: channel.account_id, username: t.meta?.username || channel.account_handle || null };
    } else if (net === 'threads') {
      return { network: 'threads', accessToken: await this.threadsToken(channel.connection_id), userId: channel.account_id };
    } else if (net === 'vk') {
      // токен VK живёт около часа — не кэшируем, берём (и при необходимости обновляем) каждый раз
      return { network: 'vk', accessToken: await this.vkAccessToken(channel.connection_id), groupId: channel.account_id };
    } else {
      throw new Error('This network is not available yet');
    }
    this.credsCache.set(key, { at: Date.now(), creds });
    return creds;
  }

  invalidateCreds(channelId?: string) {
    if (channelId) this.credsCache.delete(channelId);
    else this.credsCache.clear();
  }

  // ───────────────────────── медиа ─────────────────────────

  async saveImage(tenantId: string, buf: Buffer, ext: string): Promise<{ url: string; path: string }> {
    const e = ext.toLowerCase();
    if (!IMAGE_EXT.has(e)) throw new BadRequestException('Картинка: JPG, PNG или WEBP');
    if (buf.length > MAX_IMAGE_BYTES) throw new BadRequestException('Картинка больше 8 МБ');
    await this.storage.assertCanAdd(tenantId, buf.length);
    const rel = `content/${tenantId}/${randomUUID()}${e === '.jpeg' ? '.jpg' : e}`;
    const abs = joinUploadsAbsolute(rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    return { url: `${pubBase()}/v1/uploads/${rel}`, path: rel };
  }

  // ── видео: загрузка частями по 8 МБ (nginx пропускает ≤ 32 МБ на запрос) ──
  private videoUploads = new Map<string, { tenantId: string; ext: string; size: number; received: number; next: number; tmp: string; at: number }>();

  async startVideoUpload(tenantId: string, body: { name?: string; size?: number }) {
    const ext = (extname(String(body.name || '')).toLowerCase() || '.mp4').replace('.jpeg', '.jpg');
    if (!['.mp4', '.mov', '.m4v', '.webm'].includes(ext)) throw new BadRequestException('Видео: MP4, MOV или WEBM');
    const size = Number(body.size || 0);
    if (!(size > 0)) throw new BadRequestException('Пустой файл');
    if (size > 500 * 1024 * 1024) throw new BadRequestException('Видео больше 500 МБ');
    await this.storage.assertCanAdd(tenantId, size);
    const now = Date.now();
    for (const [k, v] of this.videoUploads) if (now - v.at > 2 * 3600_000) {
      this.videoUploads.delete(k);
      void unlink(v.tmp).catch(() => undefined);
    }
    const id = randomUUID();
    const tmp = joinUploadsAbsolute(`content/${tenantId}/tmp/${id}.part`);
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, Buffer.alloc(0));
    this.videoUploads.set(id, { tenantId, ext, size, received: 0, next: 0, tmp, at: now });
    return { uploadId: id, chunkSize: 8 * 1024 * 1024 };
  }

  async appendVideoChunk(tenantId: string, id: string, index: number, buf: Buffer) {
    const u = this.videoUploads.get(id);
    if (!u || u.tenantId !== tenantId) throw new BadRequestException('Загрузка не найдена — начните заново');
    if (index !== u.next) throw new BadRequestException(`Ожидалась часть ${u.next}`);
    if (!buf?.length || u.received + buf.length > u.size) throw new BadRequestException('Размер частей не совпадает с файлом');
    await appendFile(u.tmp, buf);
    u.received += buf.length;
    u.next++;
    u.at = Date.now();
    return { received: u.received, size: u.size };
  }

  async finishVideoUpload(tenantId: string, id: string): Promise<MediaItem> {
    const u = this.videoUploads.get(id);
    if (!u || u.tenantId !== tenantId) throw new BadRequestException('Загрузка не найдена — начните заново');
    const st = await stat(u.tmp);
    if (st.size !== u.size) throw new BadRequestException('Файл загружен не полностью');
    this.videoUploads.delete(id);
    const rel = `content/${tenantId}/${randomUUID()}${u.ext === '.m4v' ? '.mp4' : u.ext}`;
    await rename(u.tmp, joinUploadsAbsolute(rel));
    return { url: `${pubBase()}/v1/uploads/${rel}`, kind: 'video', approved: null, size: u.size };
  }

  async uploadImage(tenantId: string, file: { buffer: Buffer; originalname: string; size: number }) {
    if (!file?.buffer?.length) throw new BadRequestException('Пустой файл');
    return this.saveImage(tenantId, file.buffer, extname(file.originalname || '.jpg') || '.jpg');
  }

  // ───────────────────────── ИИ: текст и картинки ─────────────────────────

  private async aiText(tenantId: string, userId: string | null, system: string, user: string): Promise<string> {
    const override = await this.assistant.resolveTenantOpenAiOverride(tenantId);
    const { message, usage } = await this.openai.chatCompletionWithConfig(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], jsonMode: override?.provider !== 'anthropic', temperatureOverride: 0.7, timeoutMs: 60_000 },
      override,
    );
    if (!override) {
      const cfg = await this.platform.getSettings().catch(() => null);
      const cost = this.openai.estimateCostCents(usage.prompt_tokens || 0, usage.completion_tokens || 0, parseFloat(cfg?.aiPriceInputPerMtokUsd?.trim() || '0.15'), parseFloat(cfg?.aiPriceOutputPerMtokUsd?.trim() || '0.6'));
      await this.quota.chargeCents(tenantId, cost, { userId: userId ?? undefined, kind: 'chat', model: cfg?.openAiModel || null, promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 }).catch(() => undefined);
    }
    return String(message.content || '');
  }

  /** Картинка ИИ → сохраняем у себя (ссылки провайдера живут час, а Instagram забирает по ссылке позже). */
  async aiImage(tenantId: string, userId: string | null, prompt: string, size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024'): Promise<MediaItem> {
    const override = await this.assistant.resolveTenantOpenAiOverride(tenantId);
    const img = await this.openai.generateImage({ prompt: prompt.slice(0, 3500), size }, override);
    if (!override || override.provider === 'anthropic') {
      const cfg = await this.platform.getSettings().catch(() => null);
      const cost = cfg?.aiImageCostCents != null && cfg.aiImageCostCents > 0 ? cfg.aiImageCostCents : 8;
      await this.quota.chargeCents(tenantId, cost, { userId: userId ?? undefined, kind: 'image', model: cfg?.openAiImageModel || 'dall-e-3' }).catch(() => undefined);
    }
    let buf: Buffer;
    if (img.url.startsWith('data:')) buf = Buffer.from(img.url.split(',')[1] || '', 'base64');
    else buf = Buffer.from((await axios.get(img.url, { responseType: 'arraybuffer', timeout: 60_000 })).data);
    const saved = await this.saveImage(tenantId, buf, '.png');
    return { url: saved.url, kind: 'image', approved: null };
  }

  /** Подготовка поста ИИ: текст под каждую выбранную сеть (+ картинка по желанию). */
  async compose(
    tenantId: string,
    actor: Actor,
    body: { brief?: string; channelIds?: string[]; format?: string; withImage?: boolean; imagePrompt?: string; lang?: string },
  ) {
    const brief = String(body.brief || '').trim().slice(0, 3000);
    if (!brief) throw new BadRequestException('Опишите, о чём пост');
    const channels = (await this.listChannels(tenantId)).filter((c) => (body.channelIds || []).includes(c.id));
    const nets = [...new Set(channels.map((c) => c.network))];
    const lang = ['ru', 'en', 'tr'].includes(String(body.lang)) ? String(body.lang) : 'ru';
    const brand = await this.brandGuide(tenantId);
    const system = `You are a senior SMM copywriter. Write social media posts for a company. Language: ${lang}. Return strict JSON: {"title": "<short internal title>", "text": "<main post text>", "variants": {"<network>": "<text adapted to that network>"}, "imagePrompt": "<English prompt for an illustration without any text on it>"}.
Rules: no invented facts, prices or promises that are not in the brief; natural tone, short paragraphs, a clear call to action; emojis only where they help.
Network limits: instagram ≤ 2200 chars, max 30 hashtags (put 5–10 relevant ones at the end); facebook — conversational; telegram ≤ 1000 chars if there is an image; linkedin — professional, no hashtag spam (≤ 3), first line is a hook; vk — conversational, Russian-speaking audience, ≤ 5 hashtags; threads ≤ 500 chars, conversational, 0–1 hashtag.${brand ? `\nCompany brand guide (follow it):\n<<<\n${brand.slice(0, 6000)}\n>>>` : ''}`;
    const user = `Brief: ${brief}\nFormat: ${FORMATS.includes(body.format as PostFormat) ? body.format : 'post'}\nNetworks: ${nets.join(', ') || 'instagram'}`;
    let parsed: any = {};
    try {
      const raw = await this.aiText(tenantId, actor.userId, system, user);
      parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
    } catch (e) {
      const msg = (e as Error).message || '';
      throw new BadRequestException(/credit|quota|insufficient|429|billing/i.test(msg) ? 'У ИИ закончился баланс: пополните баланс платформы или подключите свой ключ OpenAI (ИИ-сотрудники → Свой ключ)' : `ИИ не ответил: ${msg.slice(0, 200)}`);
    }
    const media: MediaItem[] = [];
    let imageError: string | null = null;
    if (body.withImage) {
      try {
        media.push(await this.aiImage(tenantId, actor.userId, String(body.imagePrompt || parsed.imagePrompt || brief)));
      } catch (e) {
        imageError = (e as Error).message?.slice(0, 300) || 'image failed';
      }
    }
    const variants: Record<string, string> = {};
    for (const c of channels) {
      const v = parsed.variants?.[c.network];
      if (typeof v === 'string' && v.trim()) variants[c.id] = v.trim();
    }
    return { title: String(parsed.title || '').slice(0, 200), text: String(parsed.text || '').trim(), variants, media, imagePrompt: String(parsed.imagePrompt || ''), imageError };
  }

  /** Бренд-гайд: md-файлы людей в «Мозге» (общие и папки отделов «Контент»). */
  private async brandGuide(tenantId: string): Promise<string> {
    const rows = await this.q(
      `SELECT f.name, f.body_md FROM ai_brain_files f LEFT JOIN ai_departments d ON d.id = f.department_id
        WHERE f.tenant_id = $1 AND f.type = 'md' AND COALESCE(f.source,'') <> 'agent' AND f.agent_id IS NULL
          AND (f.scope @> ARRAY['all']::text[] OR d.template_key = 'content') ORDER BY f.updated_at DESC LIMIT 5`,
      [tenantId],
    ).catch(() => []);
    return rows.map((r) => `### ${r.name}\n${r.body_md || ''}`).join('\n\n').slice(0, 8000);
  }

  // ───────────────────────── посты ─────────────────────────

  private postDto(r: any, variants: any[] = []) {
    return {
      id: r.id,
      planId: r.plan_id,
      title: r.title,
      rubric: r.rubric,
      format: r.format,
      text: r.text,
      media: r.media || [],
      status: r.status,
      textApproved: r.text_approved,
      source: r.source,
      departmentId: r.department_id,
      agentId: r.agent_id,
      comments: r.comments || [],
      reviewNote: r.review_note,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      abGroup: r.ab_group ?? null,
      abLabel: r.ab_label ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      variants: variants.map((v) => ({
        id: v.id,
        channelId: v.channel_id,
        text: v.text,
        publishAt: v.publish_at,
        status: v.status,
        externalId: v.external_id,
        url: v.url,
        error: v.error,
        attempts: v.attempts,
        publishedAt: v.published_at,
        metrics: v.metrics,
      })),
    };
  }

  async listPosts(tenantId: string, filter: { status?: string; from?: string; to?: string; channelId?: string; planId?: string }) {
    const where: string[] = ['p.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (filter.status) {
      params.push(filter.status.split(',').map((s) => s.trim()).filter(Boolean));
      where.push(`p.status = ANY($${params.length}::text[])`);
    }
    if (filter.planId && uuidRe.test(filter.planId)) {
      params.push(filter.planId);
      where.push(`p.plan_id = $${params.length}`);
    }
    if (filter.from || filter.to || filter.channelId) {
      const sub: string[] = ['v.post_id = p.id'];
      if (filter.from) {
        params.push(filter.from);
        sub.push(`v.publish_at >= $${params.length}::timestamptz`);
      }
      if (filter.to) {
        params.push(filter.to);
        sub.push(`v.publish_at < $${params.length}::timestamptz`);
      }
      if (filter.channelId && uuidRe.test(filter.channelId)) {
        params.push(filter.channelId);
        sub.push(`v.channel_id = $${params.length}`);
      }
      where.push(`EXISTS (SELECT 1 FROM content_variants v WHERE ${sub.join(' AND ')})`);
    }
    const rows = await this.q(`SELECT p.* FROM content_posts p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 500`, params);
    if (!rows.length) return [];
    const vars = await this.q(`SELECT * FROM content_variants WHERE post_id = ANY($1::uuid[]) ORDER BY publish_at NULLS LAST`, [rows.map((r) => r.id)]);
    return rows.map((r) => this.postDto(r, vars.filter((v) => v.post_id === r.id)));
  }

  async getPost(tenantId: string, id: string) {
    if (!uuidRe.test(id)) throw new NotFoundException('Post not found');
    const [r] = await this.q(`SELECT * FROM content_posts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!r) throw new NotFoundException('Post not found');
    const vars = await this.q(`SELECT * FROM content_variants WHERE post_id = $1 ORDER BY publish_at NULLS LAST`, [id]);
    return this.postDto(r, vars);
  }

  private cleanMedia(raw: unknown): MediaItem[] {
    if (!Array.isArray(raw)) return [];
    const base = `${pubBase()}/v1/uploads/content/`;
    return raw
      .slice(0, 10)
      .map((m: any) => ({
        url: String(m?.url || ''),
        kind: m?.kind === 'video' ? 'video' : 'image',
        approved: m?.approved === true ? true : m?.approved === false ? false : null,
        note: m?.note ? String(m.note).slice(0, 500) : undefined,
        size: Number(m?.size) > 0 ? Number(m.size) : undefined,
      }))
      // только наши файлы: публичный URL нужен соцсетям, а чужие ссылки могут пропасть
      .filter((m) => m.url.startsWith(base)) as MediaItem[];
  }

  /** Создание/правка поста людьми. variants: [{channelId, text?, publishAt?}] */
  async savePost(
    tenantId: string,
    actor: Actor,
    id: string | null,
    body: { title?: string; rubric?: string; format?: string; text?: string; media?: unknown; planId?: string | null; variants?: Array<{ channelId: string; text?: string | null; publishAt?: string | null }> },
  ) {
    let cur: any = null;
    if (id) {
      const [r] = await this.q(`SELECT * FROM content_posts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
      if (!r) throw new NotFoundException('Post not found');
      if (!POST_EDITABLE.has(r.status)) throw new BadRequestException('Опубликованный пост нельзя менять');
      cur = r;
    }
    const format = FORMATS.includes(body.format as PostFormat) ? body.format : cur?.format || 'post';
    const media = body.media !== undefined ? this.cleanMedia(body.media) : cur?.media || [];
    const text = body.text !== undefined ? String(body.text).slice(0, 60_000) : cur?.text || '';
    let planId: string | null = cur?.plan_id ?? null;
    if (body.planId !== undefined) {
      planId = body.planId && uuidRe.test(body.planId) ? body.planId : null;
      if (planId && !(await this.q(`SELECT 1 FROM content_plans WHERE tenant_id = $1 AND id = $2`, [tenantId, planId])).length) planId = null;
    }
    // правка содержимого одобренного поста возвращает его на согласование (кроме правки самим согласующим — он сохраняет как есть)
    const contentChanged = cur && (text !== cur.text || JSON.stringify(media) !== JSON.stringify(cur.media || []));
    let row: any;
    if (!cur) {
      [row] = await this.q(
        `INSERT INTO content_posts (tenant_id, plan_id, title, rubric, format, text, media, status, source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'draft','manual',$8) RETURNING *`,
        [tenantId, planId, String(body.title || '').slice(0, 255), body.rubric ? String(body.rubric).slice(0, 120) : null, format, text, JSON.stringify(media), actor.userId],
      );
    } else {
      const status = contentChanged && ['approved', 'scheduled'].includes(cur.status) ? 'review' : cur.status;
      [row] = await this.q(
        `UPDATE content_posts SET plan_id = $3, title = $4, rubric = $5, format = $6, text = $7, media = $8::jsonb, status = $9,
           text_approved = CASE WHEN $10 THEN NULL ELSE text_approved END, updated_at = now() WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        [tenantId, id, planId, body.title !== undefined ? String(body.title).slice(0, 255) : cur.title, body.rubric !== undefined ? (body.rubric ? String(body.rubric).slice(0, 120) : null) : cur.rubric, format, text, JSON.stringify(media), status, !!contentChanged],
      );
      if (status === 'review' && cur.status !== 'review') {
        await this.q(`UPDATE content_variants SET status = 'pending' WHERE post_id = $1 AND status = 'scheduled'`, [id]);
      }
    }
    if (body.variants !== undefined) await this.syncVariants(tenantId, row.id, body.variants);
    return this.getPost(tenantId, row.id);
  }

  private async syncVariants(tenantId: string, postId: string, list: Array<{ channelId: string; text?: string | null; publishAt?: string | null }>) {
    const channels = new Map((await this.q(`SELECT id FROM content_channels WHERE tenant_id = $1`, [tenantId])).map((c) => [c.id, c]));
    const wanted = (Array.isArray(list) ? list : []).filter((v) => channels.has(String(v.channelId)));
    const ids = wanted.map((v) => String(v.channelId));
    await this.q(`DELETE FROM content_variants WHERE post_id = $1 AND status IN ('pending','scheduled','failed','skipped') AND NOT (channel_id = ANY($2::uuid[]))`, [postId, ids]);
    for (const v of wanted) {
      const at = v.publishAt && !Number.isNaN(Date.parse(v.publishAt)) ? new Date(v.publishAt) : null;
      await this.q(
        `INSERT INTO content_variants (tenant_id, post_id, channel_id, text, publish_at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (post_id, channel_id) DO UPDATE SET text = EXCLUDED.text, publish_at = EXCLUDED.publish_at,
           status = CASE WHEN content_variants.status IN ('published','publishing') THEN content_variants.status ELSE content_variants.status END, updated_at = now()`,
        [tenantId, postId, v.channelId, v.text ? String(v.text).slice(0, 60_000) : null, at],
      );
    }
    await this.rescheduleIfApproved(tenantId, postId);
  }

  /** У одобренного поста варианты со временем встают в расписание (и сходят с него, если время убрали). */
  private async rescheduleIfApproved(tenantId: string, postId: string) {
    const [p] = await this.q(`SELECT status, plan_id FROM content_posts WHERE id = $1`, [postId]);
    if (!p) return;
    const approved = ['approved', 'scheduled', 'partial', 'failed'].includes(p.status);
    if (approved) {
      await this.q(`UPDATE content_variants SET status = 'scheduled', next_attempt_at = NULL, error = NULL WHERE post_id = $1 AND status IN ('pending','failed') AND publish_at IS NOT NULL`, [postId]);
    }
    // «Авто»: в утверждённом плане варианты на каналах с режимом «Авто» публикуются без согласования поста
    if (p.plan_id) {
      const [plan] = await this.q(`SELECT status FROM content_plans WHERE id = $1`, [p.plan_id]);
      // пост на правках/отклонённый/черновик не выходит, даже если план утверждён
      if (plan?.status === 'approved' && (approved || p.status === 'review')) {
        await this.q(
          `UPDATE content_variants v SET status = 'scheduled', next_attempt_at = NULL FROM content_channels c
            WHERE v.post_id = $1 AND c.id = v.channel_id AND c.autonomy = 'auto' AND v.status = 'pending' AND v.publish_at IS NOT NULL`,
          [postId],
        );
        // все каналы поста — «Авто»: утверждение плана и есть согласование поста
        if (p.status === 'review') {
          const [m] = await this.q(
            `SELECT count(*)::int n, count(*) FILTER (WHERE c.autonomy = 'auto')::int a FROM content_variants v JOIN content_channels c ON c.id = v.channel_id WHERE v.post_id = $1`,
            [postId],
          );
          if (m && m.n > 0 && m.n === m.a) {
            await this.q(`UPDATE content_posts SET status = 'approved', text_approved = true, approved_by = (SELECT approved_by FROM content_plans WHERE id = $2), approved_at = now(), updated_at = now() WHERE id = $1 AND status = 'review'`, [postId, p.plan_id]);
          }
        }
      }
    }
    await this.q(`UPDATE content_variants SET status = 'pending' WHERE post_id = $1 AND status = 'scheduled' AND publish_at IS NULL`, [postId]);
    await this.refreshPostStatus(postId);
  }

  /** Итоговый статус поста по вариантам (после публикации/ошибок). */
  async refreshPostStatus(postId: string) {
    const [p] = await this.q(`SELECT status FROM content_posts WHERE id = $1`, [postId]);
    if (!p || ['draft', 'review', 'changes', 'rejected'].includes(p.status)) return;
    const vars = await this.q(`SELECT status FROM content_variants WHERE post_id = $1`, [postId]);
    if (!vars.length) return;
    const st = vars.map((v) => v.status);
    let next = p.status;
    if (st.every((s) => s === 'published' || s === 'skipped') && st.some((s) => s === 'published')) next = 'published';
    else if (st.some((s) => s === 'published') && st.some((s) => s === 'failed')) next = 'partial';
    else if (st.every((s) => s === 'failed')) next = 'failed';
    else if (st.some((s) => s === 'scheduled' || s === 'publishing')) next = 'scheduled';
    else next = 'approved';
    if (next !== p.status) await this.q(`UPDATE content_posts SET status = $2, updated_at = now() WHERE id = $1`, [postId, next]);
  }

  /**
   * «Повторить»: черновик-копия поста (тексты, картинки, каналы и свои тексты сетей) без времени и без плана.
   * Удачный пост можно выпустить снова или переделать; картинки нужно согласовать заново.
   */
  async duplicatePost(tenantId: string, actor: Actor, id: string) {
    const [src] = await this.q(`SELECT * FROM content_posts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!src) throw new NotFoundException('Post not found');
    const media = ((src.media || []) as MediaItem[]).filter((m) => m.approved !== false).map((m) => ({ url: m.url, kind: m.kind, approved: null }));
    const [row] = await this.q(
      `INSERT INTO content_posts (tenant_id, title, rubric, format, text, media, status, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'draft','manual',$7) RETURNING id`,
      [tenantId, String(src.title || '').slice(0, 240), src.rubric, src.format, src.text || '', JSON.stringify(media), actor.userId],
    );
    await this.q(
      `INSERT INTO content_variants (tenant_id, post_id, channel_id, text)
       SELECT v.tenant_id, $2, v.channel_id, v.text FROM content_variants v JOIN content_channels c ON c.id = v.channel_id
        WHERE v.post_id = $1 AND c.tenant_id = $3`,
      [id, row.id, tenantId],
    );
    await this.addComment(tenantId, row.id, actor, 'duplicated', String(src.title || src.text || '').slice(0, 120));
    return this.getPost(tenantId, row.id);
  }

  /**
   * A/B-тест текста: вариант B — копия поста (те же каналы и картинки) через неделю в тот же слот, текст меняют в редакторе.
   * Честно сравнить два текста одного поста в одной сети нельзя, поэтому сравниваем два поста в сопоставимое время по ER.
   */
  async createAbVariant(tenantId: string, actor: Actor, id: string, body: { text?: string; shiftDays?: number }) {
    const [src] = await this.q(`SELECT * FROM content_posts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!src) throw new NotFoundException('Post not found');
    if (src.ab_group && src.ab_label === 'B') throw new BadRequestException('Это уже вариант B — создайте тест от варианта A');
    if (src.ab_group) {
      const [b] = await this.q(`SELECT id FROM content_posts WHERE tenant_id = $1 AND ab_group = $2 AND ab_label = 'B'`, [tenantId, src.ab_group]);
      if (b) return this.getPost(tenantId, b.id);
    }
    const group = src.ab_group || randomUUID();
    const shift = Math.max(1, Math.min(30, Number(body.shiftDays) || 7));
    await this.q(`UPDATE content_posts SET ab_group = $3, ab_label = 'A' WHERE tenant_id = $1 AND id = $2`, [tenantId, id, group]);
    const media = ((src.media || []) as MediaItem[]).filter((m) => m.approved !== false).map((m) => ({ url: m.url, kind: m.kind, approved: m.approved ?? null }));
    const [row] = await this.q(
      `INSERT INTO content_posts (tenant_id, plan_id, title, rubric, format, text, media, status, source, created_by, ab_group, ab_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'draft','manual',$8,$9,'B') RETURNING id`,
      [tenantId, src.plan_id, `${String(src.title || '').slice(0, 230)}${src.title ? ' · ' : ''}B`, src.rubric, src.format, String(body.text ?? src.text ?? ''), JSON.stringify(media), actor.userId, group],
    );
    // время B = время A + N дней (тот же день недели и час); у A без времени — B тоже без времени
    await this.q(
      `INSERT INTO content_variants (tenant_id, post_id, channel_id, text, publish_at)
       SELECT v.tenant_id, $2, v.channel_id, NULL, CASE WHEN COALESCE(v.published_at, v.publish_at) IS NULL THEN NULL
              ELSE GREATEST(COALESCE(v.published_at, v.publish_at) + ($3 || ' days')::interval, now() + interval '1 hour') END
         FROM content_variants v JOIN content_channels c ON c.id = v.channel_id WHERE v.post_id = $1 AND c.tenant_id = $4`,
      [id, row.id, String(shift), tenantId],
    );
    await this.addComment(tenantId, row.id, actor, 'ab_created', null);
    return this.getPost(tenantId, row.id);
  }

  /** Итоги A/B: ER по каждому варианту (только измеренные публикации); победитель — когда измерены оба. */
  async abResults(tenantId: string) {
    const rows = await this.q(
      `SELECT p.ab_group, p.ab_label, p.id, p.title, left(p.text, 120) excerpt, v.status, v.metrics, v.published_at
         FROM content_posts p LEFT JOIN content_variants v ON v.post_id = p.id
        WHERE p.tenant_id = $1 AND p.ab_group IS NOT NULL AND p.updated_at > now() - interval '180 days'
        ORDER BY p.created_at DESC`,
      [tenantId],
    );
    const groups = new Map<string, any>();
    for (const r of rows) {
      const g = groups.get(r.ab_group) || { group: r.ab_group, A: null, B: null };
      const side = (g[r.ab_label] ||= { postId: r.id, title: r.title, excerpt: r.excerpt, published: 0, measured: 0, reach: 0, engagement: 0, er: null as number | null });
      if (r.status === 'published') side.published++;
      if (r.metrics) {
        side.measured++;
        side.reach += Number(r.metrics.reach || 0);
        side.engagement += ['likes', 'comments', 'shares', 'saved'].reduce((a, k) => a + Number(r.metrics[k] || 0), 0);
      }
      groups.set(r.ab_group, g);
    }
    const out: any[] = [];
    for (const g of groups.values()) {
      if (!g.A || !g.B) continue;
      for (const side of [g.A, g.B]) side.er = side.reach > 0 ? Math.round((side.engagement / side.reach) * 1000) / 10 : null;
      g.winner = g.A.er !== null && g.B.er !== null && g.A.er !== g.B.er ? (g.A.er > g.B.er ? 'A' : 'B') : null;
      out.push(g);
    }
    return out.slice(0, 30);
  }

  async removePost(tenantId: string, id: string) {
    const post = await this.getPost(tenantId, id);
    if (post.variants.some((v) => v.status === 'publishing')) throw new BadRequestException('Пост сейчас публикуется');
    await this.q(`DELETE FROM content_posts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return { ok: true };
  }

  async submitPost(tenantId: string, id: string) {
    const post = await this.getPost(tenantId, id);
    if (!['draft', 'changes', 'rejected'].includes(post.status)) throw new BadRequestException('Пост уже на согласовании или одобрен');
    await this.q(`UPDATE content_posts SET status = 'review', review_note = NULL, updated_at = now() WHERE id = $1`, [id]);
    await this.rescheduleIfApproved(tenantId, id); // пост в утверждённом плане на «Авто»-каналах выходит без отдельного согласования
    return this.getPost(tenantId, id);
  }

  private canApprove(actor: Actor) {
    return actor.role === 'owner' || actor.role === 'admin' || actor.role === 'manager';
  }

  /** Одобрить пост: текст + все картинки, кроме отклонённых (их нужно заменить или убрать). */
  async approvePost(tenantId: string, actor: Actor, id: string) {
    if (!this.canApprove(actor)) throw new ForbiddenException('Согласовывать посты может владелец или менеджер');
    const post = await this.getPost(tenantId, id);
    if (['published', 'scheduled'].includes(post.status)) return post;
    if (post.media.some((m: any) => m.approved === false)) throw new BadRequestException('Есть отклонённые картинки — замените или уберите их');
    for (const v of post.variants) {
      const ch = await this.channelRow(tenantId, v.channelId).catch(() => null);
      if (!ch) continue;
      const err = ADAPTERS[ch.network as Network].validate({ text: v.text || post.text, media: post.media as MediaItem[], format: post.format });
      if (err) throw new BadRequestException(`${ch.account_name}: ${err}`);
    }
    const media = post.media.map((m: any) => ({ ...m, approved: true }));
    await this.q(
      `UPDATE content_posts SET status = 'approved', text_approved = true, media = $3::jsonb, approved_by = $4, approved_at = now(), review_note = NULL, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id, JSON.stringify(media), uuidRe.test(String(actor.userId || '')) ? actor.userId : null],
    );
    await this.addComment(tenantId, id, actor, 'approved', null);
    await this.rescheduleIfApproved(tenantId, id);
    return this.getPost(tenantId, id);
  }

  async requestChanges(tenantId: string, actor: Actor, id: string, body: { note?: string; reject?: boolean }) {
    if (!this.canApprove(actor)) throw new ForbiddenException('Согласовывать посты может владелец или менеджер');
    const note = String(body.note || '').trim().slice(0, 2000);
    if (!note) throw new BadRequestException('Напишите, что поправить');
    const status = body.reject ? 'rejected' : 'changes';
    await this.q(`UPDATE content_posts SET status = $3::varchar, review_note = $4, text_approved = CASE WHEN $3::varchar = 'rejected' THEN false ELSE text_approved END, updated_at = now() WHERE tenant_id = $1 AND id = $2`, [tenantId, id, status, note]);
    await this.q(`UPDATE content_variants SET status = 'pending' WHERE post_id = $1 AND status = 'scheduled'`, [id]);
    await this.addComment(tenantId, id, actor, status, note);
    return this.getPost(tenantId, id);
  }

  /** Согласование одной картинки: approved true/false + комментарий (что переделать). */
  async reviewMedia(tenantId: string, actor: Actor, id: string, body: { index?: number; approved?: boolean; note?: string }) {
    if (!this.canApprove(actor)) throw new ForbiddenException('Согласовывать посты может владелец или менеджер');
    const post = await this.getPost(tenantId, id);
    const i = Number(body.index);
    if (!Number.isInteger(i) || i < 0 || i >= post.media.length) throw new BadRequestException('Нет такой картинки');
    const media = post.media.map((m: any, k: number) => (k === i ? { ...m, approved: !!body.approved, note: body.approved ? undefined : String(body.note || '').slice(0, 500) || undefined } : m));
    const status = !body.approved && ['review', 'approved', 'scheduled'].includes(post.status) ? 'changes' : post.status;
    await this.q(`UPDATE content_posts SET media = $3::jsonb, status = $4, updated_at = now() WHERE tenant_id = $1 AND id = $2`, [tenantId, id, JSON.stringify(media), status]);
    if (status === 'changes') await this.q(`UPDATE content_variants SET status = 'pending' WHERE post_id = $1 AND status = 'scheduled'`, [id]);
    if (!body.approved) await this.addComment(tenantId, id, actor, 'image_rejected', `#${i + 1}: ${String(body.note || '').slice(0, 500)}`);
    return this.getPost(tenantId, id);
  }

  async comment(tenantId: string, actor: Actor, id: string, text: string) {
    const t = String(text || '').trim().slice(0, 2000);
    if (!t) throw new BadRequestException('Пустой комментарий');
    await this.getPost(tenantId, id);
    await this.addComment(tenantId, id, actor, 'comment', t);
    return this.getPost(tenantId, id);
  }

  private async addComment(tenantId: string, id: string, actor: Actor, kind: string, text: string | null) {
    const c = { id: randomUUID(), kind, text, by: actor.name || null, userId: actor.userId, at: new Date().toISOString() };
    await this.q(`UPDATE content_posts SET comments = (COALESCE(comments, '[]'::jsonb) || $3::jsonb) WHERE tenant_id = $1 AND id = $2`, [tenantId, id, JSON.stringify([c])]);
  }

  /** «Опубликовать сейчас» (одобренный пост): все неопубликованные варианты встают в очередь на текущую минуту. */
  async publishNow(tenantId: string, actor: Actor, id: string) {
    if (!this.canApprove(actor)) throw new ForbiddenException('Публиковать может владелец или менеджер');
    const post = await this.getPost(tenantId, id);
    if (!['approved', 'scheduled', 'partial', 'failed'].includes(post.status)) throw new BadRequestException('Сначала одобрите пост');
    await this.q(`UPDATE content_variants SET status = 'scheduled', publish_at = now(), attempts = 0, next_attempt_at = NULL, error = NULL WHERE post_id = $1 AND status IN ('pending','scheduled','failed')`, [id]);
    await this.refreshPostStatus(id);
    return this.getPost(tenantId, id);
  }

  // ───────────────────────── планы ─────────────────────────

  async listPlans(tenantId: string) {
    return this.q(
      `SELECT p.id, p.title, p.period_from "periodFrom", p.period_to "periodTo", p.status, p.source, p.department_id "departmentId", p.approved_at "approvedAt", p.created_at "createdAt",
              (SELECT count(*)::int FROM content_posts x WHERE x.plan_id = p.id) "posts"
         FROM content_plans p WHERE p.tenant_id = $1 ORDER BY p.created_at DESC LIMIT 100`,
      [tenantId],
    );
  }

  async createPlan(tenantId: string, actor: Actor, body: { title?: string; periodFrom?: string; periodTo?: string }) {
    const title = String(body.title || '').trim().slice(0, 255) || 'Контент-план';
    const [r] = await this.q(
      `INSERT INTO content_plans (tenant_id, title, period_from, period_to, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, title, body.periodFrom || null, body.periodTo || null, actor.userId],
    );
    return (await this.listPlans(tenantId)).find((p: any) => p.id === r.id);
  }

  /** Утвердить план: посты каналов «Авто» встают в расписание; в каналах «Помощник» каждый пост ещё согласуют. */
  async approvePlan(tenantId: string, actor: Actor, id: string) {
    if (!this.canApprove(actor)) throw new ForbiddenException('Утверждать план может владелец или менеджер');
    const r = await this.q(`UPDATE content_plans SET status = 'approved', approved_by = $3, approved_at = now(), updated_at = now() WHERE tenant_id = $1 AND id = $2 RETURNING id`, [tenantId, id, uuidRe.test(String(actor.userId || '')) ? actor.userId : null]);
    if (!r.length) throw new NotFoundException('Plan not found');
    const posts = await this.q(`SELECT id FROM content_posts WHERE plan_id = $1 AND status NOT IN ('rejected','draft')`, [id]);
    for (const p of posts) await this.rescheduleIfApproved(tenantId, p.id);
    return (await this.listPlans(tenantId)).find((p: any) => p.id === id);
  }

  async removePlan(tenantId: string, id: string) {
    await this.q(`UPDATE content_posts SET plan_id = NULL WHERE tenant_id = $1 AND plan_id = $2`, [tenantId, id]);
    await this.q(`DELETE FROM content_plans WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return { ok: true };
  }

  // ───────────────────────── ИИ-отдел / ИИ-сотрудник → движок ─────────────────────────

  /** Каналы, доступные отделу: явно отданные ему или общие (без списка отделов). */
  async channelsForDepartment(tenantId: string, departmentId: string | null) {
    const rows = await this.q(`SELECT * FROM content_channels WHERE tenant_id = $1 AND enabled = true ORDER BY created_at`, [tenantId]);
    // каналы «только видео» (YouTube, TikTok) ИИ не наполнит — видео он не делает
    return rows
      .filter((r) => !ADAPTERS[r.network as Network]?.caps.videoOnly)
      .filter((r) => !r.department_ids?.length || (departmentId && r.department_ids.includes(departmentId)))
      .map((r) => this.channelDto(r));
  }

  /**
   * Контент-план от ИИ: посты + варианты по каналам. Режим канала решает, что дальше:
   * «Предложения» — черновик (публикует человек), «Помощник» — на согласование, «Авто» — в план, который
   * утверждает человек; после утверждения посты каналов «Авто» выходят сами.
   */
  async createFromAi(
    tenantId: string,
    input: {
      departmentId: string | null;
      agentId: string | null;
      source: 'ai_office' | 'ai_employee';
      planTitle: string;
      posts: Array<{ channelIds: string[]; publishAt?: string | null; text: string; title?: string; rubric?: string; format?: string; imagePrompt?: string; variants?: Record<string, string>; canvaTemplate?: { id?: string; fields?: Record<string, string> } }>;
      timezone?: string;
      withImages?: boolean;
    },
  ) {
    const allowed = new Map((await this.channelsForDepartment(tenantId, input.departmentId)).map((c) => [c.id, c]));
    if (!allowed.size) throw new Error('No publishing channels are available to this department — connect them in Marketing → SMM → Channels');
    const [plan] = await this.q(
      `INSERT INTO content_plans (tenant_id, title, status, source, department_id, agent_id) VALUES ($1,$2,'review',$3,$4,$5) RETURNING id`,
      [tenantId, input.planTitle.slice(0, 255) || 'Контент-план', input.source, input.departmentId, input.agentId],
    );
    let created = 0;
    for (const p of input.posts.slice(0, 31)) {
      const chans = (p.channelIds || []).map((id) => allowed.get(String(id))).filter(Boolean) as Array<ReturnType<ContentService['channelDto']>>;
      if (!chans.length || !String(p.text || '').trim()) continue;
      const allSuggest = chans.every((c) => c.autonomy === 'suggest');
      const media: MediaItem[] = [];
      // шаблон Canva в фирменном стиле важнее картинки ИИ — делается после создания поста (нужен его id)
      const useCanva = !!(input.withImages && this.canva && p.canvaTemplate?.id);
      if (input.withImages && p.imagePrompt && !useCanva) {
        try {
          media.push(await this.aiImage(tenantId, null, p.imagePrompt));
        } catch (e) {
          this.log.warn(`ai image failed: ${(e as Error).message}`);
        }
      }
      const [row] = await this.q(
        `INSERT INTO content_posts (tenant_id, plan_id, title, rubric, format, text, media, status, source, department_id, agent_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) RETURNING id`,
        [tenantId, plan.id, String(p.title || '').slice(0, 255), p.rubric ? String(p.rubric).slice(0, 120) : null, FORMATS.includes(p.format as PostFormat) ? p.format : media.length > 1 ? 'carousel' : 'post', String(p.text).slice(0, 60_000), JSON.stringify(media), allSuggest ? 'draft' : 'review', input.source, input.departmentId, input.agentId],
      );
      const at = p.publishAt ? await this.localToUtc(String(p.publishAt), input.timezone) : null;
      for (const c of chans) {
        await this.q(`INSERT INTO content_variants (tenant_id, post_id, channel_id, text, publish_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [tenantId, row.id, c.id, p.variants?.[c.network] || null, at]);
      }
      if (useCanva) {
        try {
          await this.canva!.autofillForAi(tenantId, row.id, p.canvaTemplate!);
        } catch (e) {
          this.log.warn(`canva autofill failed: ${(e as Error).message}`);
          if (p.imagePrompt) {
            try {
              const img = await this.aiImage(tenantId, null, p.imagePrompt);
              await this.q(`UPDATE content_posts SET media = $2::jsonb WHERE id = $1`, [row.id, JSON.stringify([img])]);
            } catch {
              // без картинки — человек добавит
            }
          }
        }
      }
      created++;
    }
    return { planId: plan.id, posts: created };
  }

  private async localToUtc(local: string, tz?: string): Promise<Date | null> {
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(local)) return Number.isNaN(Date.parse(local)) ? null : new Date(local);
    const [r] = await this.q(`SELECT ($1::timestamp AT TIME ZONE $2) v`, [local.replace('T', ' ').slice(0, 16), tz || 'UTC']).catch(() => [{ v: null }]);
    return r?.v ? new Date(r.v) : null;
  }

  // ───────────────────────── обзор и аналитика ─────────────────────────

  async overview(tenantId: string) {
    const [counts] = await this.q(
      `SELECT count(*) FILTER (WHERE status = 'review')::int review, count(*) FILTER (WHERE status = 'changes')::int changes,
              count(*) FILTER (WHERE status = 'draft')::int drafts, count(*) FILTER (WHERE status IN ('approved','scheduled'))::int ready
         FROM content_posts WHERE tenant_id = $1`,
      [tenantId],
    );
    const [week] = await this.q(
      `SELECT count(*) FILTER (WHERE status = 'scheduled' AND publish_at < now() + interval '7 days')::int scheduled7,
              count(*) FILTER (WHERE status = 'published' AND published_at > now() - interval '7 days')::int published7,
              count(*) FILTER (WHERE status = 'failed')::int "failedCount"
         FROM content_variants WHERE tenant_id = $1`,
      [tenantId],
    );
    const upcoming = await this.q(
      `SELECT v.id, v.publish_at "publishAt", v.status, c.network, c.account_name "channelName", p.id "postId", p.title, left(COALESCE(v.text, p.text), 140) excerpt, p.media->0->>'url' thumb
         FROM content_variants v JOIN content_channels c ON c.id = v.channel_id JOIN content_posts p ON p.id = v.post_id
        WHERE v.tenant_id = $1 AND v.status IN ('scheduled','publishing') ORDER BY v.publish_at LIMIT 8`,
      [tenantId],
    );
    const failedList = await this.q(
      `SELECT v.id, v.error, c.network, c.account_name "channelName", p.id "postId", p.title FROM content_variants v
         JOIN content_channels c ON c.id = v.channel_id JOIN content_posts p ON p.id = v.post_id
        WHERE v.tenant_id = $1 AND v.status = 'failed' ORDER BY v.updated_at DESC LIMIT 5`,
      [tenantId],
    );
    const channels = await this.q(`SELECT count(*)::int n, count(*) FILTER (WHERE status <> 'ok')::int broken FROM content_channels WHERE tenant_id = $1`, [tenantId]);
    return { ...counts, ...week, channels: channels[0], upcoming, failedList };
  }

  async analytics(tenantId: string, days = 30, tz = 'UTC') {
    const d = Math.max(1, Math.min(365, Number(days) || 30));
    const rows = await this.q(
      `SELECT v.id, v.post_id "postId", v.url, v.published_at "publishedAt", v.metrics, c.network, c.account_name "channelName", p.title, p.rubric, left(COALESCE(v.text, p.text), 160) excerpt, p.media->0->>'url' thumb
         FROM content_variants v JOIN content_channels c ON c.id = v.channel_id JOIN content_posts p ON p.id = v.post_id
        WHERE v.tenant_id = $1 AND v.status = 'published' AND v.published_at > now() - ($2 || ' days')::interval ORDER BY v.published_at DESC LIMIT 300`,
      [tenantId, String(d)],
    );
    const sum = (k: string) => rows.reduce((s, r) => s + Number(r.metrics?.[k] || 0), 0);
    const engagement = (r: any) => ['likes', 'comments', 'shares', 'saved'].reduce((s, k) => s + Number(r.metrics?.[k] || 0), 0);
    // measured — сколько постов с метриками: Telegram-боты и личный LinkedIn статистику не отдают, это не «0»
    const byNetwork: Record<string, { posts: number; measured: number; reach: number; engagement: number }> = {};
    for (const r of rows) {
      const b = (byNetwork[r.network] ||= { posts: 0, measured: 0, reach: 0, engagement: 0 });
      b.posts++;
      if (r.metrics) b.measured++;
      b.reach += Number(r.metrics?.reach || 0);
      b.engagement += engagement(r);
    }
    return {
      days: d,
      totals: { posts: rows.length, measured: rows.filter((r) => r.metrics).length, reach: sum('reach'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), saved: sum('saved') },
      byNetwork,
      bestTimes: await this.bestTimes(tenantId, tz),
      abTests: await this.abResults(tenantId),
      top: [...rows].sort((a, b) => engagement(b) - engagement(a)).slice(0, 10).map((r) => ({ ...r, engagement: engagement(r) })),
      posts: rows,
    };
  }
}
