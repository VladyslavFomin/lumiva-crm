// src/online-chat/online-chat.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  SelectQueryBuilder,
  FindOptionsWhere,
  LessThan,
  MoreThan,
} from 'typeorm';
import { randomUUID } from 'crypto';

import { ChatSession } from './chat-session.entity';
import { ChatMessage, ChatAttachment } from './chat-message.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { LeadsService } from '../leads/leads.service';

interface ListSessionsParams {
  status?: 'open' | 'closed';
  search?: string;
}

/**
 * Параметры для public /session
 */
interface PublicSessionParams {
  tenantKey: string;
  siteUrl: string;
  siteHost: string;
  userAgent?: string;
}

/**
 * Параметры для public /message
 * tenantKey здесь опционален – мы всё равно берём tenantId из самой сессии
 */
interface PublicMessageParams {
  tenantKey?: string;
  sessionId: string;
  text: string;
  from?: 'client' | 'staff' | 'system';
  type?: string;
  fileUrl?: string;
  fileName?: string;
}

/**
 * Лид после первого сообщения
 */
interface PublicLeadParams {
  tenantKey?: string;
  sessionId: string;
  name?: string;
  phone?: string;
  email?: string;
  utm?: any;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  referrer?: string;
}

/**
 * История сообщений
 */
interface PublicHistoryParams {
  tenantKey?: string;
  sessionId: string;
  limit: number;
}

/**
 * Пуллинг новых сообщений
 */
interface PublicPollParams {
  tenantKey?: string;
  sessionId: string;
  after: number; // timestamp ms
}

@Injectable()
export class OnlineChatService {
  private readonly logger = new Logger(OnlineChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepo: Repository<ChatSession>,

    @InjectRepository(ChatMessage)
    private readonly messagesRepo: Repository<ChatMessage>,

    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,

    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,

    private readonly leadsService: LeadsService,
  ) {}

  /* =========================================================
   * helpers
   * =======================================================*/

  private pickFirstAttachment(m: ChatMessage): ChatAttachment | null {
    const a = (m.attachments && Array.isArray(m.attachments) && m.attachments[0])
      ? m.attachments[0]
      : null;

    if (!a) return null;
    const url = (a as any).url || (a as any).fileUrl || null;
    const name = (a as any).name || (a as any).fileName || null;
    if (!url) return null;

    return {
      id: (a as any).id || randomUUID(),
      url: String(url),
      name: name ? String(name) : 'file',
    };
  }

  private normalizeAttachments(input: any): ChatAttachment[] | null {
    if (!input) return null;

    // если пришёл уже массив
    if (Array.isArray(input)) {
      const out: ChatAttachment[] = input
        .map((x) => {
          if (!x) return null;
          const url = x.url || x.fileUrl || x.file_url;
          if (!url) return null;
          const name = x.name || x.fileName || x.file_name || 'file';
          return {
            id: x.id || randomUUID(),
            name: String(name),
            url: String(url),
          } as ChatAttachment;
        })
        .filter(Boolean) as any;

      return out.length ? out : null;
    }

    // если пришёл объект (один файл)
    const url = input.url || input.fileUrl || input.file_url;
    if (!url) return null;
    const name = input.name || input.fileName || input.file_name || 'file';

    return [
      {
        id: input.id || randomUUID(),
        name: String(name),
        url: String(url),
      },
    ];
  }

  private mapPublicMessage(m: ChatMessage) {
    const a = this.pickFirstAttachment(m);
    return {
      id: m.id,
      text: m.text || '',
      from: (m.sender === 'staff' ? 'manager' : 'client') as 'manager' | 'client',
      file_url: a?.url ?? null,
      fileName: a?.name ?? null,
      // дублируем snake_case, чтобы старые фронты/виджет не ломались
      file_name: a?.name ?? null,
      created_at: m.createdAt,
    };
  }

  /**
   * Находит лид по meta.chatSessionId (старые записи до появления колонки leadId на сессии).
   */
  private async findLeadIdByChatSession(
    tenantId: string,
    sessionId: string,
  ): Promise<string | null> {
    const row = await this.leadsRepo
      .createQueryBuilder('l')
      .select('l.id', 'id')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'chatSessionId' = :sessionId", { sessionId })
      .getRawOne<{ id: string }>();

    return row?.id ?? null;
  }

  private async persistSessionLeadId(
    sessionId: string,
    leadId: string,
  ): Promise<void> {
    await this.sessionsRepo.update({ id: sessionId }, { leadId });
  }

  /**
   * Подставляет leadId в сессии без колонки (одним запросом по списку id).
   */
  private async hydrateLeadIdsForSessions(
    tenantId: string,
    sessions: ChatSession[],
  ): Promise<void> {
    const missing = sessions.filter((s) => !s.leadId);
    if (!missing.length) return;

    const sessionIds = missing.map((s) => s.id);
    const rows = await this.leadsRepo
      .createQueryBuilder('l')
      .select('l.id', 'leadId')
      .addSelect("l.meta->>'chatSessionId'", 'sessionId')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'chatSessionId' IN (:...sessionIds)", { sessionIds })
      .getRawMany<{ leadId: string; sessionId: string }>();

    await Promise.all(
      rows.map((r) =>
        this.persistSessionLeadId(r.sessionId, r.leadId),
      ),
    );

    const bySession = new Map(rows.map((r) => [r.sessionId, r.leadId]));
    for (const s of missing) {
      const lid = bySession.get(s.id);
      if (lid) s.leadId = lid;
    }
  }

  private async ensureLeadIdOnSession(session: ChatSession): Promise<void> {
    if (session.leadId) return;
    const leadId = await this.findLeadIdByChatSession(
      session.tenantId,
      session.id,
    );
    if (leadId) {
      session.leadId = leadId;
      await this.persistSessionLeadId(session.id, leadId);
    }
  }

  private mapStaffMessage(m: ChatMessage) {
    const a = this.pickFirstAttachment(m);
    // Возвращаем "как есть" + удобные поля для фронта CRM
    return Object.assign(m, {
      file_url: a?.url ?? null,
      fileName: a?.name ?? null,
      file_name: a?.name ?? null,
    });
  }

  /* =========================================================
   * 1. STAFF: список сессий, сообщения, ответ оператора
   * =======================================================*/

  async listSessions(
    tenantId: string,
    params: ListSessionsParams = {},
  ): Promise<ChatSession[]> {
    const { status, search } = params;

    let qb: SelectQueryBuilder<ChatSession> = this.sessionsRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere("coalesce(s.visitorName, '') <> ''")
      .andWhere("coalesce(s.visitorEmail, '') <> ''")
      .orderBy('s.lastMessageAt', 'DESC')
      .addOrderBy('s.createdAt', 'DESC')
      .take(50);

    if (status) qb = qb.andWhere('s.status = :status', { status });

    if (search) {
      qb = qb.andWhere(
        '(s.siteHost ILIKE :q OR s.visitorEmail ILIKE :q OR s.visitorName ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const sessions = await qb.getMany();

    await this.hydrateLeadIdsForSessions(tenantId, sessions);

    // Определяем "непрочитанные": последнее сообщение посетителя новее ответа стаффа
    const lastVisitor = await this.messagesRepo
      .createQueryBuilder('m')
      .select('m.sessionId', 'sessionId')
      .addSelect('MAX(m.createdAt)', 'lastVisitorAt')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.sender = :sender', { sender: 'visitor' })
      .groupBy('m.sessionId')
      .getRawMany<{ sessionId: string; lastVisitorAt: string }>();

    const lastStaff = await this.messagesRepo
      .createQueryBuilder('m')
      .select('m.sessionId', 'sessionId')
      .addSelect('MAX(m.createdAt)', 'lastStaffAt')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.sender = :sender', { sender: 'staff' })
      .groupBy('m.sessionId')
      .getRawMany<{ sessionId: string; lastStaffAt: string }>();

    const lastVisitorMap = new Map<string, Date>();
    lastVisitor.forEach((row) => lastVisitorMap.set(row.sessionId, new Date(row.lastVisitorAt)));

    const lastStaffMap = new Map<string, Date>();
    lastStaff.forEach((row) => lastStaffMap.set(row.sessionId, new Date(row.lastStaffAt)));

    return sessions.map((s) => {
      const v = lastVisitorMap.get(s.id);
      const st = lastStaffMap.get(s.id);
      const unread = !!v && (!st || v.getTime() > st.getTime());
      return {
        ...s,
        lastSender: unread ? ('visitor' as ChatMessage['sender']) : null,
        unread,
      } as any;
    });
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<void> {
    await this.getSessionOrFail(tenantId, sessionId);

    await this.messagesRepo.delete({ tenantId, sessionId });
    await this.sessionsRepo.delete({ id: sessionId, tenantId });

    this.logger.log(
      `Chat session deleted: tenantId=${tenantId}, sessionId=${sessionId}`,
    );
  }

  private async getSessionOrFail(
    tenantId: string,
    sessionId: string,
  ): Promise<ChatSession> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId, tenantId },
    });

    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  /**
   * Сообщения по конкретной сессии (из панели)
   * ВАЖНО: добавляем file_url/fileName чтобы CRM фронт мог показать ссылку
   */
  async getMessages(
    tenantId: string,
    sessionId: string,
  ): Promise<{
    messages: any[];
    leadId: string | null;
    siteHost: string;
    visitorName: string | null;
    visitorEmail: string | null;
  }> {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    await this.ensureLeadIdOnSession(session);

    const list = await this.messagesRepo.find({
      where: { tenantId, sessionId },
      order: { createdAt: 'ASC' },
    });

    return {
      messages: list.map((m) => this.mapStaffMessage(m)),
      leadId: session.leadId ?? null,
      siteHost: session.siteHost,
      visitorName: session.visitorName,
      visitorEmail: session.visitorEmail,
    };
  }

  async sendStaffMessage(
    tenantId: string,
    staffUserId: string,
    sessionId: string,
    dto: SendChatMessageDto,
  ): Promise<any> {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    const attachments = this.normalizeAttachments((dto as any).attachments);

    const message = this.messagesRepo.create({
      tenantId,
      sessionId,
      sender: 'staff',
      staffUserId,
      text: dto.text ?? '',
      isInternal: (dto as any).internal ?? false,
      attachments,
    });

    const saved = await this.messagesRepo.save(message);

    session.lastMessageAt = new Date();
    await this.sessionsRepo.save(session);

    return this.mapStaffMessage(saved);
  }

  /* =========================================================
   * 2. Вспомогательные для public API
   * =======================================================*/

  private async resolveTenantIdByKey(tenantKey: string): Promise<string> {
    if (!tenantKey) throw new BadRequestException('tenantKey is required');

    const tenant = await this.tenantsRepo.findOne({
      where: { clientKey: tenantKey },
    });

    if (!tenant) throw new NotFoundException(`Tenant not found for key ${tenantKey}`);
    return tenant.id;
  }

  async ensureSessionForVisitor(params: {
    tenantId: string;
    siteHost: string;
    visitorEmail?: string | null;
    visitorName?: string | null;
  }): Promise<ChatSession> {
    const {
      tenantId,
      siteHost,
      visitorEmail = null,
      visitorName = null,
    } = params;

    const where: FindOptionsWhere<ChatSession> = {
      tenantId,
      siteHost,
      status: 'open',
    };

    if (visitorEmail) where.visitorEmail = visitorEmail;

    const existing = await this.sessionsRepo.findOne({ where });
    if (existing) return existing;

    const session = this.sessionsRepo.create({
      tenantId,
      siteHost,
      visitorEmail,
      visitorName,
      status: 'open',
      lastMessageAt: new Date(),
    });

    return await this.sessionsRepo.save(session);
  }

  private async getSessionById(sessionId: string): Promise<ChatSession> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  /* =========================================================
   * 3. PUBLIC API: /v1/public/online-chat/...
   * =======================================================*/

  async createPublicSession(
    params: PublicSessionParams,
  ): Promise<{ session_id: string }> {
    const { tenantKey, siteHost, siteUrl } = params;

    const tenantId = await this.resolveTenantIdByKey(tenantKey);
    const utm = this.parseUtmFromUrl(siteUrl);

    const session = this.sessionsRepo.create({
      tenantId,
      siteHost,
      utmSource: utm.utmSource ?? null,
      utmMedium: utm.utmMedium ?? null,
      utmCampaign: utm.utmCampaign ?? null,
      utmContent: utm.utmContent ?? null,
      utmTerm: utm.utmTerm ?? null,
      status: 'open',
      lastMessageAt: new Date(),
    });

    const saved = await this.sessionsRepo.save(session);
    return { session_id: saved.id };
  }

  /**
   * POST /message – входящее сообщение от клиента
   * Файл: сохраняем в attachments[] как {id,name,url}
   */
  async postPublicMessage(params: PublicMessageParams): Promise<any> {
    const sessionId = String(params.sessionId || '').trim();
    const text = (params.text ?? '').toString();
    const fileUrl = (params.fileUrl ?? '').toString().trim();
    const fileName = (params.fileName ?? '').toString().trim();

    if (!sessionId) throw new BadRequestException('sessionId is required');

    const session = await this.getSessionById(sessionId);
    const isFile = !!fileUrl;

    let attachments: ChatAttachment[] | null = null;
    if (isFile) {
      attachments = [
        {
          id: randomUUID(),
          name: fileName || 'file',
          url: fileUrl,
        },
      ];
    }

    const message = this.messagesRepo.create({
      tenantId: session.tenantId,
      sessionId: session.id,
      sender: 'visitor',
      staffUserId: null,
      text: isFile ? (text.trim() || (attachments?.[0]?.name ?? '')) : text,
      isInternal: false,
      attachments,
    });

    const saved = await this.messagesRepo.save(message);

    session.lastMessageAt = new Date();
    await this.sessionsRepo.save(session);

    const a = this.pickFirstAttachment(saved);

    return {
      id: saved.id,
      text: saved.text,
      from: 'client',
      file_url: a?.url ?? null,
      fileName: a?.name ?? null,
      file_name: a?.name ?? null,
      created_at: saved.createdAt,
    };
  }

  async savePublicLead(params: PublicLeadParams): Promise<any> {
    const { sessionId, name, phone, email } = params;

    this.logger.debug(`savePublicLead: incoming = ${JSON.stringify(params)}`);

    if (!sessionId) throw new BadRequestException('sessionId is required');

    const session = await this.getSessionById(sessionId);

    session.visitorName = name || session.visitorName || null;
    session.visitorEmail = email || session.visitorEmail || null;

    await this.sessionsRepo.save(session);

    // Виджет часто собирает данные в несколько шагов (сначала имя, потом телефон/email) —
    // без этой проверки каждый повторный вызов создавал ОТДЕЛЬНЫЙ, никак не связанный с
    // первым лид, а сессия молча переключалась на самый свежий.
    if (session.leadId) {
      try {
        const existingLead = await this.leadsService.findOneForTenant(session.tenantId, session.leadId);
        const patch: Record<string, unknown> = {};
        if (name && name !== existingLead.name) patch.name = name;
        if (phone && phone !== existingLead.phone) patch.phone = phone;
        if (email && email !== existingLead.email) patch.email = email;
        const updatedLead = Object.keys(patch).length
          ? await this.leadsService.updateForTenant(session.tenantId, existingLead.id, patch as any)
          : existingLead;
        return {
          ok: true,
          session_id: session.id,
          lead_id: updatedLead.id,
          name: updatedLead.name,
          email: updatedLead.email,
          phone: updatedLead.phone,
        };
      } catch (e) {
        // Лид сессии не найден (удалён/недоступен) — падаем обратно на создание нового,
        // как и раньше вело себя это место при отсутствии session.leadId.
        this.logger.warn(`savePublicLead: session.leadId ${session.leadId} not found, creating a new lead`);
      }
    }

    try {
      const utm = params.utm || {};
      let utmSource =
        params.utmSource ?? utm.utmSource ?? utm.utm_source ?? null;
      let utmMedium =
        params.utmMedium ?? utm.utmMedium ?? utm.utm_medium ?? null;
      let utmCampaign =
        params.utmCampaign ?? utm.utmCampaign ?? utm.utm_campaign ?? null;
      let utmContent =
        params.utmContent ?? utm.utmContent ?? utm.utm_content ?? null;
      let utmTerm =
        params.utmTerm ?? utm.utmTerm ?? utm.utm_term ?? null;

      if (!utmSource) utmSource = session.utmSource ?? null;
      if (!utmMedium) utmMedium = session.utmMedium ?? null;
      if (!utmCampaign) utmCampaign = session.utmCampaign ?? null;
      if (!utmContent) utmContent = session.utmContent ?? null;
      if (!utmTerm) utmTerm = session.utmTerm ?? null;

      if (!utmSource || !utmMedium || !utmCampaign || !utmContent || !utmTerm) {
        const parsed = this.parseUtmFromUrl(
          params.pageUrl || params.referrer || null,
        );
        if (!utmSource && parsed.utmSource) utmSource = parsed.utmSource;
        if (!utmMedium && parsed.utmMedium) utmMedium = parsed.utmMedium;
        if (!utmCampaign && parsed.utmCampaign) utmCampaign = parsed.utmCampaign;
        if (!utmContent && parsed.utmContent) utmContent = parsed.utmContent;
        if (!utmTerm && parsed.utmTerm) utmTerm = parsed.utmTerm;
      }

      const lead = await this.leadsService.createForTenant(session.tenantId, {
        name: session.visitorName || name || undefined,
        phone: phone || undefined,
        email: session.visitorEmail || email || undefined,
        status: 'new',
        source: 'online-chat',
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        meta: {
          channel: 'online-chat',
          chatSessionId: session.id,
          siteHost: session.siteHost,
        },
      });

      this.logger.log(
        `Created lead from chat session: leadId=${lead.id}, sessionId=${session.id}`,
      );

      session.leadId = lead.id;
      await this.sessionsRepo.save(session);

      return {
        ok: true,
        session_id: session.id,
        lead_id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
      };
    } catch (e) {
      this.logger.error(
        `Failed to create lead from chat session ${session.id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : undefined,
      );

      return {
        ok: true,
        session_id: session.id,
        name: session.visitorName || undefined,
        email: session.visitorEmail || undefined,
        phone: phone || undefined,
      };
    }
  }

  private parseUtmFromUrl(value?: string | null) {
    if (!value) return {};
    try {
      const url = value.startsWith('http')
        ? new URL(value)
        : new URL(value, 'https://example.com');
      return {
        utmSource: url.searchParams.get('utm_source') || null,
        utmMedium: url.searchParams.get('utm_medium') || null,
        utmCampaign: url.searchParams.get('utm_campaign') || null,
        utmContent: url.searchParams.get('utm_content') || null,
        utmTerm: url.searchParams.get('utm_term') || null,
      };
    } catch {
      return {};
    }
  }

  async getPublicHistory(params: PublicHistoryParams): Promise<{
    messages: Array<ReturnType<OnlineChatService['mapPublicMessage']>>;
    lead?: { name?: string; email?: string };
    last: number;
  }> {
    const { sessionId, limit } = params;

    if (!sessionId) throw new BadRequestException('sessionId is required');

    const session = await this.getSessionById(sessionId);

    const messages = await this.messagesRepo.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    const mapped = messages.map((m) => this.mapPublicMessage(m));

    const lastTs =
      mapped.length > 0
        ? mapped[mapped.length - 1].created_at.getTime()
        : 0;

    return {
      messages: mapped,
      lead: {
        name: session.visitorName || undefined,
        email: session.visitorEmail || undefined,
      },
      last: lastTs,
    };
  }

  /**
   * poll: отдаём только новые сообщения после after (timestamp ms)
   */
  async pollPublic(params: PublicPollParams): Promise<{
    messages: Array<ReturnType<OnlineChatService['mapPublicMessage']>>;
    last: number;
  }> {
    const { sessionId, after } = params;

    if (!sessionId) throw new BadRequestException('sessionId is required');

    const session = await this.getSessionById(sessionId);

    let where: any = { sessionId: session.id };

    if (after && Number(after) > 0) {
      const dt = new Date(Number(after));
      if (!Number.isNaN(dt.getTime())) {
        where = { ...where, createdAt: MoreThan(dt) };
      }
    }

    const list = await this.messagesRepo.find({
      where,
      order: { createdAt: 'ASC' },
      take: 200,
    });

    const mapped = list.map((m) => this.mapPublicMessage(m));

    const lastTs =
      mapped.length > 0
        ? mapped[mapped.length - 1].created_at.getTime()
        : (after || 0);

    return {
      messages: mapped,
      last: lastTs,
    };
  }

  async debugListByTenantKey(tenantKey: string) {
    if (!tenantKey) throw new BadRequestException('tenantKey is required');

    const tenant = await this.tenantsRepo.findOne({
      where: { clientKey: tenantKey },
    });

    if (!tenant) {
      this.logger.warn(`debugListByTenantKey: tenant not found for key=${tenantKey}`);
      return [];
    }

    const sessions = await this.sessionsRepo.find({
      where: { tenantId: tenant.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    this.logger.log(
      `debugListByTenantKey: tenantKey=${tenantKey}, tenantId=${tenant.id}, sessions=${sessions.length}`,
    );

    return sessions;
  }

  /* =========================================================
   * 4. Optional cleanup
   * =======================================================*/

  async cleanupOldMessages(days = 30): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const res = await this.messagesRepo.delete({
      createdAt: LessThan(cutoff),
    } as any);
    return { deleted: res.affected || 0 };
  }

  async cleanupOldEmptySessions(days = 30): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const old = await this.sessionsRepo.find({
      where: { createdAt: LessThan(cutoff) } as any,
      take: 500,
      order: { createdAt: 'ASC' },
    });

    let deleted = 0;

    for (const s of old) {
      const cnt = await this.messagesRepo.count({
        where: { sessionId: s.id } as any,
      });
      if (cnt === 0) {
        await this.sessionsRepo.delete({ id: s.id } as any);
        deleted++;
      }
    }

    return { deleted };
  }
}
