import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { enrichChatContacts } from '../common/chat-contact-enrich.util';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { EntityType, NoteType } from '../notes/dto/create-note.dto';
import { NotesService } from '../notes/notes.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { Tenant } from '../tenants/tenant.entity';
import { InstagramAccount, InstagramAccountSettings } from './instagram-account.entity';
import { InstagramContact } from './instagram-contact.entity';
import { InstagramAttachment, InstagramMessage } from './instagram-message.entity';
import { InstagramGraphError, InstagramGraphService } from './instagram-graph.service';

const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'instagram_manage_messages',
  'instagram_manage_comments',
];
const STATE_TTL_MS = 30 * 60e3;
const DM_WINDOW_MS = 24 * 3600e3;
const PRIVATE_REPLY_WINDOW_MS = 7 * 864e5;
const APP_PATH = '/app/instagram';
const DEFAULT_RETURN_ORIGIN = 'https://crm.lumiva.agency';
const CUSTOM_DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

type InstagramOAuthState = {
  tenantId: string;
  ts: number;
  returnOrigin: string;
};

type Inbound = {
  kind: 'dm' | 'comment';
  direction: 'incoming' | 'outgoing';
  externalId: string | null;
  /** IGSID собеседника (только из директа) */
  igsid: string | null;
  /** username собеседника (из комментария) */
  username: string | null;
  /** id автора комментария — хранится отдельно, т.к. не гарантированно совпадает с IGSID директа */
  commentUserId: string | null;
  text: string | null;
  attachments: InstagramAttachment[] | null;
  mediaId: string | null;
  date: Date;
  raw: Record<string, unknown>;
};

@Injectable()
export class InstagramCrmService {
  private readonly log = new Logger(InstagramCrmService.name);

  constructor(
    @InjectRepository(InstagramAccount) private readonly accounts: Repository<InstagramAccount>,
    @InjectRepository(InstagramContact) private readonly contacts: Repository<InstagramContact>,
    @InjectRepository(InstagramMessage) private readonly messages: Repository<InstagramMessage>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly graph: InstagramGraphService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  // ───────────────────────── OAuth ─────────────────────────

  private redirectUri(): string {
    return process.env.INSTAGRAM_OAUTH_REDIRECT_URI || 'https://crm.lumiva.agency/v1/instagram-crm/oauth/callback';
  }

  private sign(raw: string): string {
    return createHmac('sha256', process.env.JWT_SECRET!).update(raw).digest('base64url');
  }

  private tenantReturnOrigin(
    tenant: Pick<Tenant, 'customDomain' | 'customDomainStatus'>,
  ): string {
    const domain = tenant.customDomain?.trim().toLowerCase();
    if (
      tenant.customDomainStatus !== 'active' ||
      !domain ||
      !CUSTOM_DOMAIN_PATTERN.test(domain)
    ) {
      return DEFAULT_RETURN_ORIGIN;
    }
    return `https://${domain}`;
  }

  private resultRedirect(origin: string, result: string): string {
    const url = new URL(APP_PATH, origin);
    url.searchParams.set('ig', result);
    return url.toString();
  }

  async getAuthUrl(tenantId: string): Promise<{ url: string }> {
    const { appId } = await this.platformSettings.getMetaOAuthConfig();
    if (!appId) throw new BadRequestException('Meta-приложение платформы не настроено');
    const tenant = await this.tenants.findOne({
      where: { id: tenantId },
      select: ['id', 'customDomain', 'customDomainStatus'],
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const raw = Buffer.from(
      JSON.stringify({
        tenantId,
        ts: Date.now(),
        returnOrigin: this.tenantReturnOrigin(tenant),
      } satisfies InstagramOAuthState),
    ).toString('base64url');
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      state: `${raw}.${this.sign(raw)}`,
      scope: OAUTH_SCOPES.join(','),
    });
    return {
      url: `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`,
    };
  }

  private verifyState(state?: string): InstagramOAuthState | null {
    const [raw, sig] = String(state || '').split('.');
    if (!raw || !sig) return null;
    const expected = Buffer.from(this.sign(raw));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    try {
      const p = JSON.parse(
        Buffer.from(raw, 'base64url').toString('utf8'),
      ) as Partial<InstagramOAuthState>;
      if (
        typeof p.tenantId !== 'string' ||
        !p.tenantId ||
        typeof p.ts !== 'number' ||
        !Number.isFinite(p.ts) ||
        Date.now() - p.ts > STATE_TTL_MS ||
        p.ts > Date.now() ||
        typeof p.returnOrigin !== 'string'
      ) {
        return null;
      }
      const parsedOrigin = new URL(p.returnOrigin);
      if (
        parsedOrigin.protocol !== 'https:' ||
        parsedOrigin.origin !== p.returnOrigin ||
        (p.returnOrigin !== DEFAULT_RETURN_ORIGIN &&
          (parsedOrigin.port !== '' || !CUSTOM_DOMAIN_PATTERN.test(parsedOrigin.hostname)))
      ) {
        return null;
      }
      return {
        tenantId: p.tenantId,
        ts: p.ts,
        returnOrigin: p.returnOrigin,
      };
    } catch {
      return null;
    }
  }

  private async callbackReturnOrigin(
    state: InstagramOAuthState,
  ): Promise<string> {
    const tenant = await this.tenants.findOne({
      where: { id: state.tenantId },
      select: ['id', 'customDomain', 'customDomainStatus'],
    });
    if (!tenant) return DEFAULT_RETURN_ORIGIN;
    const currentOrigin = this.tenantReturnOrigin(tenant);
    return currentOrigin === state.returnOrigin
      ? currentOrigin
      : DEFAULT_RETURN_ORIGIN;
  }

  async handleOAuthCallback(
    code?: string,
    state?: string,
    error?: string,
  ): Promise<string> {
    const oauthState = this.verifyState(state);
    if (!oauthState) return this.resultRedirect(DEFAULT_RETURN_ORIGIN, 'invalid_state');
    const tenantId = oauthState.tenantId;
    const returnOrigin = await this.callbackReturnOrigin(oauthState);
    const redirect = (result: string) => this.resultRedirect(returnOrigin, result);
    if (error || !code) return redirect('denied');
    const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
    if (!appId || !appSecret) return redirect('missing_oauth');

    let pages;
    try {
      const userToken = await this.graph.exchangeCode(appId, appSecret, this.redirectUri(), code);
      pages = await this.graph.listPagesWithInstagram(userToken);
    } catch (e) {
      this.log.warn(`Instagram OAuth failed for tenant ${tenantId}: ${(e as Error).message}`);
      return redirect('oauth_error');
    }
    if (!pages.length) return redirect('no_accounts');

    let connected = 0;
    for (const p of pages) {
      let acc = await this.accounts.findOne({ where: { tenantId, igUserId: p.igUserId } });
      if (!acc) acc = this.accounts.create({ tenantId, igUserId: p.igUserId, settings: {} });
      acc.igUsername = p.igUsername;
      acc.profilePictureUrl = p.profilePictureUrl;
      acc.pageId = p.pageId;
      acc.pageName = p.pageName;
      acc.pageAccessToken = p.pageAccessToken;
      acc.status = 'active';
      acc.lastError = null;
      acc.healthNotifiedAt = null;
      try {
        await this.graph.subscribePage(p.pageId, p.pageAccessToken);
      } catch (e) {
        acc.status = 'error';
        acc.lastError = `Не удалось подписаться на события страницы: ${(e as Error).message}`;
      }
      await this.accounts.save(acc);
      if (acc.status === 'active') connected++;
    }
    return redirect(connected ? 'connected' : 'subscribe_error');
  }

  // ───────────────────────── Аккаунты ─────────────────────────

  listAccounts(tenantId: string) {
    return this.accounts.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async updateSettings(tenantId: string, id: string, patch: InstagramAccountSettings) {
    const acc = await this.accounts.findOne({ where: { id, tenantId } });
    if (!acc) throw new NotFoundException('Instagram account not found');
    const next: InstagramAccountSettings = { ...(acc.settings || {}) };
    if (typeof patch.dmToLead === 'boolean') next.dmToLead = patch.dmToLead;
    if (typeof patch.commentsToLead === 'boolean') next.commentsToLead = patch.commentsToLead;
    if (Array.isArray(patch.commentKeywords)) {
      next.commentKeywords = [...new Set(patch.commentKeywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean))].slice(0, 50);
    }
    acc.settings = next;
    return this.accounts.save(acc);
  }

  /** Отключение: перестаём принимать события, история переписки остаётся. */
  async disconnect(tenantId: string, id: string) {
    const acc = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.pageAccessToken')
      .where('a.id = :id AND a.tenantId = :tenantId', { id, tenantId })
      .getOne();
    if (!acc) throw new NotFoundException('Instagram account not found');
    // другой тенант может держать ту же страницу — тогда подписку приложения не снимаем
    const others = await this.accounts
      .createQueryBuilder('a')
      .where('a.pageId = :pageId AND a.id <> :id AND a.status <> :d', { pageId: acc.pageId, id, d: 'disconnected' })
      .getCount();
    if (!others) {
      await this.graph.unsubscribePage(acc.pageId, acc.pageAccessToken).catch((e) =>
        this.log.warn(`Instagram unsubscribe ${acc.pageId}: ${(e as Error).message}`),
      );
    }
    await this.accounts.update({ id }, { status: 'disconnected', lastError: null });
    return { ok: true };
  }

  private async markAccountError(acc: InstagramAccount, e: unknown) {
    if (e instanceof InstagramGraphError && e.tokenInvalid) {
      await this.accounts.update({ id: acc.id }, { status: 'error', lastError: e.message.slice(0, 1000) });
    }
  }

  // ───────────────────────── Вебхук ─────────────────────────

  /** Токен проверки для настройки вебхука в Meta (одинаков для всех тенантов — вебхук общий на приложение). */
  webhookVerifyToken(): string {
    return process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || this.sign('instagram-webhook-verify').slice(0, 32);
  }

  async verifySignature(rawBody: Buffer | undefined, header: string | undefined): Promise<boolean> {
    const { appSecret } = await this.platformSettings.getMetaOAuthConfig();
    if (!appSecret || !rawBody?.length || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    const got = Buffer.from(header.slice('sha256='.length).trim(), 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  }

  async handleWebhook(body: unknown): Promise<void> {
    const root = (body || {}) as Record<string, any>;
    if (root.object !== 'instagram') return;
    for (const entry of Array.isArray(root.entry) ? root.entry : []) {
      const igId = entry?.id != null ? String(entry.id) : '';
      if (!igId) continue;
      const accs = await this.accounts
        .createQueryBuilder('a')
        .addSelect('a.pageAccessToken')
        .where('a.igUserId = :igId AND a.status <> :d', { igId, d: 'disconnected' })
        .getMany();
      if (!accs.length) {
        this.log.warn(`Instagram webhook: no account for ig ${igId}`);
        continue;
      }
      const events = this.parseEntry(entry, igId);
      for (const acc of accs) {
        for (const ev of events) {
          try {
            await this.recordEvent(acc, ev);
          } catch (e) {
            this.log.error(`Instagram event ${ev.externalId} for ${acc.id}: ${(e as Error).stack || (e as Error).message}`);
          }
        }
        if (events.length) await this.accounts.update({ id: acc.id }, { lastEventAt: new Date() });
      }
    }
  }

  private parseEntry(entry: Record<string, any>, igId: string): Inbound[] {
    const out: Inbound[] = [];
    for (const m of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const msg = m?.message;
      if (!msg || msg.is_deleted || msg.is_unsupported) continue;
      const echo = Boolean(msg.is_echo);
      const other = String((echo ? m.recipient?.id : m.sender?.id) ?? '');
      if (!other || other === igId) continue;
      const attachments: InstagramAttachment[] = (Array.isArray(msg.attachments) ? msg.attachments : [])
        .map((a: any) => ({ type: String(a?.type || 'file'), url: a?.payload?.url ? String(a.payload.url) : undefined }));
      out.push({
        kind: 'dm',
        direction: echo ? 'outgoing' : 'incoming',
        externalId: msg.mid ? String(msg.mid) : null,
        igsid: other,
        username: null,
        commentUserId: null,
        text: typeof msg.text === 'string' ? msg.text : null,
        attachments: attachments.length ? attachments : null,
        mediaId: null,
        date: m.timestamp ? new Date(Number(m.timestamp)) : new Date(),
        raw: m,
      });
    }
    for (const ch of Array.isArray(entry.changes) ? entry.changes : []) {
      if (ch?.field !== 'comments') continue;
      const v = ch.value || {};
      const fromId = v.from?.id != null ? String(v.from.id) : '';
      const username = v.from?.username ? String(v.from.username) : null;
      if (!v.id || fromId === igId || (!username && !fromId)) continue;
      out.push({
        kind: 'comment',
        direction: 'incoming',
        externalId: String(v.id),
        igsid: null,
        username,
        commentUserId: fromId || null,
        text: typeof v.text === 'string' ? v.text : null,
        attachments: null,
        mediaId: v.media?.id ? String(v.media.id) : null,
        date: entry.time ? new Date(Number(entry.time) * 1000) : new Date(),
        raw: v,
      });
    }
    return out;
  }

  private async findOrCreateContact(acc: InstagramAccount, ev: Inbound): Promise<InstagramContact> {
    const base = this.contacts.createQueryBuilder('c').where('c.accountId = :acc', { acc: acc.id });
    let contact: InstagramContact | null = null;
    if (ev.igsid) contact = await base.clone().andWhere('c.igsid = :igsid', { igsid: ev.igsid }).getOne();

    let profile: { name: string | null; username: string | null; profilePic: string | null } | null = null;
    if (!contact && ev.igsid) {
      profile = await this.graph.getUserProfile(ev.igsid, acc.pageAccessToken).catch(() => null);
    }
    const username = ev.username || profile?.username || null;
    if (!contact && username) {
      // тот же человек раньше писал комментарий — склеиваем с директом
      contact = await base.clone().andWhere('lower(c.username) = lower(:u)', { u: username }).getOne();
    }

    if (!contact) {
      contact = this.contacts.create({
        tenantId: acc.tenantId,
        accountId: acc.id,
        igsid: ev.igsid,
        username,
        name: profile?.name || null,
        profilePic: profile?.profilePic || null,
        meta: ev.commentUserId ? { commentUserId: ev.commentUserId } : null,
      });
    } else {
      if (ev.igsid && !contact.igsid) contact.igsid = ev.igsid;
      if (username && !contact.username) contact.username = username;
      if (profile?.name && !contact.name) contact.name = profile.name;
      if (profile?.profilePic) contact.profilePic = profile.profilePic;
      if (ev.commentUserId) contact.meta = { ...(contact.meta || {}), commentUserId: ev.commentUserId };
    }
    try {
      return await this.contacts.save(contact);
    } catch (e) {
      // два почти одновременных события от одного человека — уникальный индекс ловит гонку
      if ((e as { code?: string }).code === '23505') {
        const again = ev.igsid
          ? await base.clone().andWhere('c.igsid = :igsid', { igsid: ev.igsid }).getOne()
          : await base.clone().andWhere('lower(c.username) = lower(:u)', { u: username }).getOne();
        if (again) return again;
      }
      throw e;
    }
  }

  private wantsLead(acc: InstagramAccount, ev: Inbound): boolean {
    if (ev.direction !== 'incoming') return false;
    const s = acc.settings || {};
    if (ev.kind === 'dm') return s.dmToLead !== false;
    if (s.commentsToLead === false) return false;
    const kws = Array.isArray(s.commentKeywords) ? s.commentKeywords.filter(Boolean) : [];
    if (!kws.length) return true;
    const text = (ev.text || '').toLowerCase();
    return kws.some((k) => text.includes(k));
  }

  private contactTitle(c: InstagramContact): string {
    return c.name || (c.username ? `@${c.username}` : 'Instagram');
  }

  private async ensureLead(acc: InstagramAccount, contact: InstagramContact, firstTouch: { kind: string; permalink: string | null }): Promise<Lead> {
    const lead = await this.leadsService.createForTenant(acc.tenantId, {
      name: this.contactTitle(contact),
      source: 'instagram',
      status: 'new',
      meta: {
        instagramUsername: contact.username,
        instagramAccountId: acc.id,
        instagramAccount: acc.igUsername,
        instagramContactId: contact.id,
        instagramFirstTouch: firstTouch.kind,
        ...(firstTouch.permalink ? { instagramPostUrl: firstTouch.permalink } : {}),
      },
    } as any);
    await this.contacts.update({ id: contact.id }, { leadId: lead.id });
    contact.leadId = lead.id;
    return lead;
  }

  private async recordEvent(acc: InstagramAccount, ev: Inbound): Promise<void> {
    if (ev.externalId) {
      const dup = await this.messages.findOne({ where: { tenantId: acc.tenantId, externalId: ev.externalId } });
      if (dup) return;
    }
    const contact = await this.findOrCreateContact(acc, ev);

    if (ev.direction === 'outgoing') {
      // эхо нашего же ответа из CRM может прийти раньше, чем send() сохранит message_id
      const recent = await this.messages
        .createQueryBuilder('m')
        .where('m.contactId = :c AND m.direction = :d AND m.date > :since', {
          c: contact.id,
          d: 'outgoing',
          since: new Date(ev.date.getTime() - 120e3),
        })
        .andWhere('m.text IS NOT DISTINCT FROM :t', { t: ev.text })
        .getCount();
      if (recent) return;
    }

    let permalink: string | null = null;
    if (ev.mediaId) permalink = await this.graph.getMediaPermalink(ev.mediaId, acc.pageAccessToken).catch(() => null);

    let lead: Lead | null = contact.leadId ? await this.leadRepo.findOne({ where: { id: contact.leadId, tenantId: acc.tenantId } }) : null;
    if (!lead && this.wantsLead(acc, ev)) lead = await this.ensureLead(acc, contact, { kind: ev.kind, permalink });

    try {
      await this.messages.save(
        this.messages.create({
          tenantId: acc.tenantId,
          accountId: acc.id,
          contactId: contact.id,
          kind: ev.kind,
          externalId: ev.externalId,
          direction: ev.direction,
          text: ev.text,
          attachments: ev.attachments,
          mediaId: ev.mediaId,
          mediaPermalink: permalink,
          date: ev.date,
          // эхо — то, что ответили из самого Instagram: уже «прочитано»
          isRead: ev.direction === 'outgoing',
          rawData: ev.raw,
        }),
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505' && ev.externalId) return;
      throw e;
    }

    if (lead && ev.direction === 'incoming') {
      const body = ev.text || (ev.attachments?.length ? `[${ev.attachments.map((a) => a.type).join(', ')}]` : '');
      await this.notesService.create(
        acc.tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          title: ev.kind === 'comment' ? 'Instagram · комментарий' : 'Instagram · директ',
          content: [
            ev.kind === 'comment' ? `Комментарий в @${acc.igUsername || acc.igUserId}` : `Сообщение в директ @${acc.igUsername || acc.igUserId}`,
            contact.username ? `От: @${contact.username}` : null,
            permalink ? `Пост: ${permalink}` : null,
            '',
            body || '(пусто)',
          ]
            .filter((x) => x != null)
            .join('\n'),
          type: NoteType.NOTE,
          metadata: { channel: `instagram_${ev.kind}`, externalId: ev.externalId, accountId: acc.id, contactId: contact.id },
        } as any,
        undefined,
        'Instagram',
      );
    }
  }

  // ───────────────────────── Диалоги ─────────────────────────

  async findContacts(tenantId: string, opts: { search?: string; accountId?: string; leadId?: string }) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((opts.leadId && !uuid.test(opts.leadId)) || (opts.accountId && !uuid.test(opts.accountId))) return [];
    const qb = this.contacts.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });
    if (opts.accountId) qb.andWhere('c.accountId = :a', { a: opts.accountId });
    if (opts.leadId) qb.andWhere('c.leadId = :l', { l: opts.leadId });
    if (opts.search) qb.andWhere('(c.username ILIKE :s OR c.name ILIKE :s)', { s: `%${opts.search}%` });
    const list = await qb.getMany();
    if (!list.length) return [];
    const ids = list.map((c) => c.id);
    const last = await this.messages
      .createQueryBuilder('m')
      .distinctOn(['m.contactId'])
      .where('m.tenantId = :tenantId AND m.contactId IN (:...ids)', { tenantId, ids })
      .orderBy('m.contactId')
      .addOrderBy('m.date', 'DESC')
      .getMany();
    const lastBy = new Map(last.map((m) => [m.contactId, m]));
    const unread = await this.messages
      .createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('COUNT(*)', 'count')
      .where('m.tenantId = :tenantId AND m.contactId IN (:...ids) AND m.direction = :d AND m.isRead = false', { tenantId, ids, d: 'incoming' })
      .groupBy('m.contactId')
      .getRawMany<{ contactId: string; count: string }>();
    const unreadBy = new Map(unread.map((r) => [r.contactId, Number(r.count)]));
    const rows = list
      .map((c) => ({ ...c, lastMessage: lastBy.get(c.id) ?? null, unreadCount: unreadBy.get(c.id) ?? 0 }))
      .sort((a, b) => {
        const ad = new Date(a.lastMessage?.date ?? a.createdAt).getTime();
        const bd = new Date(b.lastMessage?.date ?? b.createdAt).getTime();
        return bd - ad;
      });
    return enrichChatContacts(this.contacts.manager, tenantId, rows, 'instagram_messages');
  }

  async findMessages(tenantId: string, contactId: string, limit = 200) {
    return this.messages.find({
      where: { tenantId, contactId },
      order: { date: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async markRead(tenantId: string, contactId: string) {
    await this.messages.update({ tenantId, contactId, direction: 'incoming', isRead: false }, { isRead: true });
  }

  /**
   * Ответ собеседнику. Правила Instagram: в директ — только 24 ч после его последнего сообщения;
   * автору комментария — один «личный ответ» в директ в течение 7 дней после комментария.
   */
  async send(tenantId: string, contactId: string, text: string) {
    const body = String(text || '').trim();
    if (!body) throw new BadRequestException('Пустое сообщение');
    if (body.length > 1000) throw new BadRequestException('Instagram принимает сообщения до 1000 символов');
    const contact = await this.contacts.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const acc = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.pageAccessToken')
      .where('a.id = :id AND a.tenantId = :tenantId', { id: contact.accountId, tenantId })
      .getOne();
    if (!acc || acc.status === 'disconnected') throw new BadRequestException('Аккаунт Instagram отключён');

    const now = Date.now();
    const lastDm = await this.messages.findOne({
      where: { tenantId, contactId, kind: 'dm', direction: 'incoming' },
      order: { date: 'DESC' },
    });
    const lastComment = await this.messages.findOne({
      where: { tenantId, contactId, kind: 'comment', direction: 'incoming' },
      order: { date: 'DESC' },
    });
    const dmOpen = !!(contact.igsid && lastDm && now - new Date(lastDm.date).getTime() < DM_WINDOW_MS);
    const commentOpen = !!(
      lastComment?.externalId &&
      now - new Date(lastComment.date).getTime() < PRIVATE_REPLY_WINDOW_MS &&
      !(lastComment.rawData as Record<string, unknown> | null)?.privateReplied &&
      (!lastDm || new Date(lastComment.date) > new Date(lastDm.date))
    );

    let recipient: { id: string } | { comment_id: string };
    if (dmOpen) recipient = { id: contact.igsid! };
    else if (commentOpen) recipient = { comment_id: lastComment!.externalId! };
    else if (contact.igsid) recipient = { id: contact.igsid }; // пусть Meta ответит точной причиной
    else throw new BadRequestException('Этот человек пока не писал в директ, а личный ответ на его комментарий уже недоступен (больше 7 дней или уже отправлен).');

    let res: { messageId: string | null };
    try {
      res = await this.graph.sendMessage(acc.pageAccessToken, recipient, body);
    } catch (e) {
      await this.markAccountError(acc, e);
      if (e instanceof InstagramGraphError && e.outsideWindow) {
        throw new BadRequestException('Instagram разрешает отвечать в директ только в течение 24 часов после последнего сообщения клиента.');
      }
      throw new BadRequestException(`Instagram: ${(e as Error).message}`);
    }

    if ('comment_id' in recipient && lastComment) {
      await this.messages.update({ id: lastComment.id }, { rawData: { ...(lastComment.rawData || {}), privateReplied: true } });
    }
    try {
      return await this.messages.save(
        this.messages.create({
          tenantId,
          accountId: acc.id,
          contactId,
          kind: 'dm',
          externalId: res.messageId,
          direction: 'outgoing',
          text: body,
          date: new Date(),
          isRead: true,
          rawData: 'comment_id' in recipient ? { privateReplyTo: recipient.comment_id } : null,
        }),
      );
    } catch (e) {
      // эхо этого сообщения уже успело записаться вебхуком — сообщение отправлено, дубль не нужен
      if ((e as { code?: string }).code === '23505' && res.messageId) {
        const echo = await this.messages.findOne({ where: { tenantId, externalId: res.messageId } });
        if (echo) return echo;
      }
      throw e;
    }
  }

  async createLeadForContact(tenantId: string, contactId: string): Promise<{ leadId: string }> {
    const contact = await this.contacts.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.leadId) {
      const existing = await this.leadRepo.findOne({ where: { id: contact.leadId, tenantId } });
      if (existing) return { leadId: existing.id };
    }
    const acc = await this.accounts.findOne({ where: { id: contact.accountId, tenantId } });
    if (!acc) throw new NotFoundException('Instagram account not found');
    const first = await this.messages.findOne({ where: { tenantId, contactId }, order: { date: 'ASC' } });
    const lead = await this.ensureLead(acc, contact, { kind: first?.kind || 'dm', permalink: first?.mediaPermalink || null });
    return { leadId: lead.id };
  }
}
