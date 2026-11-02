// src/whatsapp-crm/whatsapp-crm.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappContact } from './whatsapp-contact.entity';
import { WhatsappMessage } from './whatsapp-message.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { WhatsappApiError, WhatsappCloudService } from '../integrations/whatsapp/whatsapp-cloud.service';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { EntityType, NoteType } from '../notes/dto/create-note.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { normalizeChatFile, type ChatUpload } from '../common/chat-file.util';
import { enrichChatContacts } from '../common/chat-contact-enrich.util';
import { transcribeInboundVoice } from '../ai/voice-transcription.util';

export interface InboundWhatsappMessage {
  waMessageId: string;
  fromDigits: string;
  /** BSUID (from_user_id) — приходит всегда, в отличие от номера */
  fromUserId?: string | null;
  /** Ник WhatsApp (profile.username) — только если пользователь включил username */
  username?: string | null;
  profileName?: string | null;
  type: string;
  text?: string | null;
  displayPhone?: string | null;
  timestamp?: number | null;
  raw: any;
}

/** Окно обслуживания Meta: свободный текст клиенту — только 24 ч после его последнего сообщения. */
export const WA_WINDOW_MS = 24 * 3_600_000;

@Injectable()
export class WhatsappCrmService {
  private readonly log = new Logger(WhatsappCrmService.name);

  constructor(
    @InjectRepository(WhatsappContact)
    private readonly contactRepo: Repository<WhatsappContact>,
    @InjectRepository(WhatsappMessage)
    private readonly messageRepo: Repository<WhatsappMessage>,
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly whatsappCloud: WhatsappCloudService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private async findLeadByPhoneDigits(tenantId: string, digits: string): Promise<Lead | null> {
    if (!digits) return null;
    return this.leadRepo.createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", { digits })
      .orderBy('l.updatedAt', 'DESC').getOne();
  }

  /** Persists an inbound Meta Cloud API message: finds/creates the contact + lead, stores the
   * message row, and syncs a Lead note (same as before this inbox existed, so nothing downstream
   * that already reads WhatsApp notes breaks). Called by WhatsappWebhookService after it parses
   * Meta's payload shape. */
  async recordInboundMessage(
    tenantId: string,
    connectionId: string,
    msg: InboundWhatsappMessage,
  ): Promise<WhatsappMessage | null> {
    // Meta retries webhook deliveries on timeout — skip messages we've already recorded.
    if (msg.waMessageId) {
      const existing = await this.messageRepo.findOne({ where: { tenantId, waMessageId: msg.waMessageId } });
      if (existing) return null;
    }

    const digits = this.normalizeDigits(msg.fromDigits);
    const userId = (msg.fromUserId || '').trim() || null;
    // Номер есть не всегда (username в WhatsApp скрывает его), BSUID — всегда: ищем по любому из них
    const findContact = () => this.contactRepo.findOne({
      where: [
        ...(digits ? [{ tenantId, waPhoneDigits: digits }] : []),
        ...(userId ? [{ tenantId, waUserId: userId }] : []),
      ],
    });

    let contact = await findContact();
    if (!contact) {
      contact = this.contactRepo.create({
        tenantId,
        connectionId,
        waPhoneDigits: digits || null,
        waUserId: userId,
        waProfileName: msg.profileName || null,
        status: 'active',
        meta: msg.username ? { username: msg.username } : null,
      });
    } else {
      contact.connectionId = connectionId;
      if (msg.profileName) contact.waProfileName = msg.profileName;
      if (digits && !contact.waPhoneDigits) contact.waPhoneDigits = digits;
      if (userId && !contact.waUserId) contact.waUserId = userId;
      if (msg.username) contact.meta = { ...(contact.meta || {}), username: msg.username };
    }
    try {
      contact = await this.contactRepo.save(contact);
    } catch (error) {
      // Гонка двух почти одновременных вебхуков от одного номера — обе ветки прошли
      // find-then-create до того, как первая успела сохраниться. UQ_whatsapp_contacts_tenant_phone/_userid
      // (см. migrations/20260902120000, 20261022120000) ловят это на уровне БД вместо тихого дубля контакта.
      if ((error as { code?: string }).code === '23505') {
        const existing = await findContact();
        if (!existing) throw error;
        contact = existing;
      } else {
        throw error;
      }
    }

    let lead: Lead | null = null;
    if (contact.leadId) lead = await this.leadRepo.findOne({ where: { id: contact.leadId, tenantId } });
    if (!lead) lead = await this.findLeadByPhoneDigits(tenantId, digits);
    if (!lead) {
      lead = await this.leadsService.createForTenant(tenantId, {
        name: msg.profileName || (digits ? `WhatsApp +${digits}` : 'WhatsApp'),
        ...(digits ? { phone: `+${digits}` } : {}),
        source: 'whatsapp',
        status: 'new',
        meta: { whatsappPhoneDigits: digits || null, whatsappUserId: userId, whatsappUsername: msg.username || null, whatsappConnectionId: connectionId },
      });
    }
    if (contact.leadId !== lead.id) {
      contact.leadId = lead.id;
      await this.contactRepo.save(contact);
    }

    // Входящий файл/фото/голосовое: Meta присылает только media id — сам файл скачивается по запросу
    // (fetchAttachmentFile), пока ссылка у Meta жива (~30 дней).
    const rawMedia = msg.type !== 'text' ? (msg.raw as any)?.[msg.type] : null;
    const inboundMedia = rawMedia?.id
      ? {
          type: msg.type,
          id: String(rawMedia.id),
          mimeType: rawMedia.mime_type ? String(rawMedia.mime_type) : undefined,
          fileName: rawMedia.filename ? String(rawMedia.filename) : undefined,
          caption: rawMedia.caption ? String(rawMedia.caption) : undefined,
        }
      : null;

    let message: WhatsappMessage;
    try {
      message = await this.messageRepo.save(this.messageRepo.create({
        tenantId,
        contactId: contact.id,
        connectionId,
        waMessageId: msg.waMessageId,
        direction: 'incoming',
        text: msg.type === 'text' ? (msg.text || null) : (inboundMedia?.caption ?? null),
        messageType: msg.type,
        attachments: inboundMedia?.id ? [inboundMedia] : null,
        date: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
        isRead: false,
        rawData: msg.raw,
      }));
    } catch (error) {
      // Тот же класс гонки, что и у контакта выше — обгоняющая доставка того же
      // waMessageId уже прошла find-then-create до сохранения этой. Не задваиваем.
      if ((error as { code?: string }).code === '23505' && msg.waMessageId) {
        return null;
      }
      throw error;
    }

    // Голосовое → текст до заметки/автоматизаций/консультанта: дальше по цепочке все видят его как
    // обычный текст. Вебхук уже ответил Meta (fire-and-forget), так что ожидание никого не держит.
    let transcript: string | null = null;
    if (msg.type === 'audio' && inboundMedia?.id && !message.text) {
      transcript = await this.transcribeVoiceMessage(tenantId, message);
    }

    const lines = [
      'Входящее сообщение WhatsApp',
      msg.displayPhone ? `Линия: ${msg.displayPhone}` : null,
      msg.profileName ? `Имя в WhatsApp: ${msg.profileName}` : null,
      msg.username ? `Ник в WhatsApp: @${msg.username}` : null,
      '',
      msg.type === 'text'
        ? (msg.text || '(пустое тело)')
        : transcript
          ? `🎤 ${transcript}`
          : `[${inboundMedia?.fileName || msg.type}]${inboundMedia?.caption ? ` ${inboundMedia.caption}` : ''}`,
    ].filter((x) => x != null).join('\n');

    await this.notesService.create(tenantId, {
      entityType: EntityType.LEAD,
      entityId: lead.id,
      content: lines,
      title: 'WhatsApp · входящее',
      type: NoteType.NOTE,
      metadata: { channel: 'whatsapp_inbound', waMessageId: msg.waMessageId, connectionId, contactId: contact.id },
    }, undefined, 'WhatsApp');

    // Как у Telegram: входящее от клиента будит автоматизации и ответственного ИИ-сотрудника
    // (AutomationsService → AiEmployeesService.handleAutomationEvent). Сбой здесь не должен терять сообщение.
    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.WHATSAPP_MESSAGE_RECEIVED, {
        entityType: 'whatsapp_message',
        entityId: message.id,
        message,
        contact,
        connectionId,
        leadId: lead.id,
      });
    } catch (e) {
      this.log.warn(`WhatsApp automation trigger failed: ${(e as Error).message}`);
    }

    // ИИ-консультант (тот же, что в онлайн-чате сайта) — если у него включён канал WhatsApp.
    // Лениво: online-chat-ai.service транзитивно импортирует этот файл (цикл при статическом импорте).
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OnlineChatAiService } = require('../online-chat/online-chat-ai.service');
      this.moduleRef.get(OnlineChatAiService, { strict: false }).onWhatsappMessage(tenantId, contact.id);
    } catch (e) {
      this.log.warn(`WhatsApp consultant hook failed: ${(e as Error).message}`);
    }

    return message;
  }

  async findContacts(
    tenantId: string,
    options?: { search?: string; connectionId?: string; leadId?: string },
  ): Promise<Array<WhatsappContact & { lastMessage: WhatsappMessage | null; unreadCount: number } & Record<string, unknown>>> {
    const qb = this.contactRepo.createQueryBuilder('contact')
      .where('contact.tenantId = :tenantId', { tenantId });
    if (options?.connectionId) qb.andWhere('contact.connectionId = :connectionId', { connectionId: options.connectionId });
    // Карточка лида: переписка WhatsApp этого лида (как у Telegram-блока)
    if (options?.leadId) qb.andWhere('contact.leadId = :leadId', { leadId: options.leadId });
    if (options?.search) {
      qb.andWhere(
        '(contact.waProfileName ILIKE :s OR contact.waPhoneDigits ILIKE :s)',
        { s: `%${options.search}%` },
      );
    }
    const contacts = await qb.getMany();
    if (!contacts.length) return [];
    const contactIds = contacts.map((c) => c.id);

    const lastMessages = await this.messageRepo.createQueryBuilder('m')
      .distinctOn(['m.contactId'])
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .orderBy('m.contactId')
      .addOrderBy('m.date', 'DESC')
      .getMany();
    const lastByContact = new Map(lastMessages.map((m) => [m.contactId, m]));

    const unreadRows = await this.messageRepo.createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('COUNT(*)', 'count')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .andWhere('m.direction = :dir', { dir: 'incoming' })
      .andWhere('m.isRead = false')
      .groupBy('m.contactId')
      .getRawMany<{ contactId: string; count: string }>();
    const unreadByContact = new Map(unreadRows.map((r) => [r.contactId, parseInt(r.count, 10)]));

    const incomingRows = await this.messageRepo.createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('MAX(m.date)', 'at')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .andWhere('m.direction = :dir', { dir: 'incoming' })
      .groupBy('m.contactId')
      .getRawMany<{ contactId: string; at: Date }>();
    const incomingByContact = new Map(incomingRows.map((r) => [r.contactId, new Date(r.at)]));

    // Окно 24 ч (Meta): свободный текст можно слать, пока с последнего входящего не прошло 24 ч.
    // waiting — последним писал клиент, answered — ответили, archived — окно закрыто (написать нельзя).
    const now = Date.now();
    const STATE_ORDER = { waiting: 0, answered: 1, archived: 2 } as const;
    const rows = contacts
      .map((c) => {
        const lastMessage = lastByContact.get(c.id) ?? null;
        const lastIncomingAt = incomingByContact.get(c.id) ?? null;
        const windowOpenUntil = lastIncomingAt ? new Date(lastIncomingAt.getTime() + WA_WINDOW_MS) : null;
        const chatState: keyof typeof STATE_ORDER = !windowOpenUntil || windowOpenUntil.getTime() <= now
          ? 'archived'
          : lastMessage?.direction === 'incoming' ? 'waiting' : 'answered';
        return {
          ...c,
          lastMessage,
          unreadCount: unreadByContact.get(c.id) ?? 0,
          lastIncomingAt,
          windowOpenUntil,
          chatState,
        };
      })
      .sort((a, b) => {
        if (a.chatState !== b.chatState) return STATE_ORDER[a.chatState] - STATE_ORDER[b.chatState];
        const at = (x: typeof a) => (x.lastMessage ? new Date(x.lastMessage.date).getTime() : new Date(x.createdAt).getTime());
        // ждут ответа: дольше всех ждущий — первым (новые внизу); остальные — свежие сверху
        return a.chatState === 'waiting' ? at(a) - at(b) : at(b) - at(a);
      });
    return enrichChatContacts(this.contactRepo.manager, tenantId, rows, 'whatsapp_messages');
  }

  async findMessages(
    tenantId: string,
    options?: { contactId?: string; limit?: number; offset?: number },
  ): Promise<{ items: WhatsappMessage[]; total: number }> {
    const qb = this.messageRepo.createQueryBuilder('message').where('message.tenantId = :tenantId', { tenantId });
    if (options?.contactId) qb.andWhere('message.contactId = :contactId', { contactId: options.contactId });
    const total = await qb.getCount();
    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);
    qb.orderBy('message.date', 'DESC');
    return { items: await qb.getMany(), total };
  }

  async markContactMessagesRead(tenantId: string, contactId: string): Promise<void> {
    await this.messageRepo.createQueryBuilder()
      .update(WhatsappMessage)
      .set({ isRead: true })
      .where('"tenantId" = :tenantId AND "contactId" = :contactId AND direction = :dir AND "isRead" = false', {
        tenantId, contactId, dir: 'incoming',
      })
      .execute();
  }

  /** WhatsApp connections available to reply from — IntegrationConnection rows with catalogId 'whatsapp'. */
  async listConnections(tenantId: string): Promise<Array<{ id: string; name: string; phoneNumberId: string | null }>> {
    const rows = await this.connectionRepo.find({ where: { tenantId, isDeleted: false, kind: 'third_party_link' } as any });
    const out: Array<{ id: string; name: string; phoneNumberId: string | null }> = [];
    for (const row of rows) {
      if (!row.configJson) continue;
      try {
        const cfg = JSON.parse(row.configJson) as { catalogId?: string; phoneNumberId?: string };
        if (cfg.catalogId !== 'whatsapp') continue;
        out.push({ id: row.id, name: row.name, phoneNumberId: cfg.phoneNumberId || null });
      } catch { /* skip malformed config */ }
    }
    return out;
  }

  private async getCredentials(tenantId: string, connectionId: string): Promise<{ phoneNumberId: string; accessToken: string }> {
    const entity = await this.connectionRepo.findOne({ where: { id: connectionId, tenantId, isDeleted: false } as any });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      throw new NotFoundException('WhatsApp connection not found');
    }
    let cfg: { catalogId?: string; apiToken?: string; phoneNumberId?: string };
    try {
      cfg = JSON.parse(entity.configJson);
    } catch {
      throw new BadRequestException('WhatsApp connection has invalid config');
    }
    if (cfg.catalogId !== 'whatsapp') throw new NotFoundException('WhatsApp connection not found');
    const accessToken = (cfg.apiToken || '').trim();
    const phoneNumberId = (cfg.phoneNumberId || '').trim();
    if (!accessToken || !phoneNumberId) {
      throw new BadRequestException('WhatsApp connection is missing phoneNumberId/apiToken');
    }
    return { phoneNumberId, accessToken };
  }

  /**
   * Состояние подключения для «Интеграций» (баннер, бейдж, уведомление владельцу): у WhatsApp нет
   * синхронизации по расписанию, поэтому «работает» = последняя отправка/входящее прошли успешно.
   */
  async markConnectionHealth(connectionId: string, ok: boolean, error?: string): Promise<void> {
    const qb = this.connectionRepo.createQueryBuilder().update(IntegrationConnection).where('id = :id', { id: connectionId });
    if (ok) {
      // пишем только при смене статуса — не на каждое сообщение
      await qb
        .set({ lastSyncStatus: 'ok', lastError: null, lastSyncAt: new Date() })
        .andWhere(`("lastSyncStatus" <> 'ok' OR "lastError" IS NOT NULL OR "lastSyncAt" IS NULL OR "lastSyncAt" < now() - interval '1 hour')`)
        .execute()
        .catch(() => undefined);
    } else {
      await qb.set({ lastSyncStatus: 'error', lastError: (error || '').slice(0, 1000), lastSyncAt: new Date() }).execute().catch(() => undefined);
    }
  }

  /** Кому слать: номер, а если клиент скрыл его за username — BSUID (Cloud API поле `recipient`). */
  private recipientOf(contact: WhatsappContact): string {
    const to = contact.waPhoneDigits || contact.waUserId;
    if (!to) throw new BadRequestException('WhatsApp: у контакта нет ни номера, ни идентификатора WhatsApp');
    return to;
  }

  /** Окно 24 ч закрыто — Meta отклонит свободный текст и файлы; говорим это сразу, не дёргая API. */
  private async assertWindowOpen(tenantId: string, contactId: string): Promise<void> {
    const last = await this.messageRepo.findOne({
      where: { tenantId, contactId, direction: 'incoming' },
      order: { date: 'DESC' },
      select: ['id', 'date'],
    });
    if (!last || Date.now() - new Date(last.date).getTime() >= WA_WINDOW_MS) {
      throw new BadRequestException('WhatsApp: клиент не писал больше 24 часов — свободный текст Meta не пропустит. Диалог в архиве: он вернётся, когда клиент напишет снова.');
    }
  }

  /** Ошибка Meta → понятное сообщение; сломанный токен помечает подключение. */
  private async sendFailed(connectionId: string, e: unknown): Promise<never> {
    if (e instanceof WhatsappApiError) {
      if (e.authFailed) {
        await this.markConnectionHealth(connectionId, false, `Отправка не удалась — токен недействителен или нет прав на номер: ${e.message}`);
        throw new BadRequestException('WhatsApp: токен подключения недействителен — обновите его в «Интеграциях».');
      }
      if (e.outsideWindow) {
        throw new BadRequestException('WhatsApp: клиент не писал больше 24 часов — свободный текст Meta не пропустит, нужен одобренный шаблон сообщения.');
      }
    }
    throw new BadRequestException((e as Error).message);
  }

  async sendMessage(
    tenantId: string,
    connectionId: string,
    contactId: string,
    text: string,
    opts?: { source?: 'ai'; agentId?: string },
  ): Promise<WhatsappMessage> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('WhatsApp contact not found');
    await this.assertWindowOpen(tenantId, contactId);
    const { phoneNumberId, accessToken } = await this.getCredentials(tenantId, connectionId);

    let messageId: string | undefined;
    try {
      ({ messageId } = await this.whatsappCloud.sendTextMessage({
        phoneNumberId, accessToken, to: this.recipientOf(contact), body: text,
      }));
    } catch (e) {
      return this.sendFailed(connectionId, e);
    }
    void this.markConnectionHealth(connectionId, true);

    if (contact.connectionId !== connectionId) {
      contact.connectionId = connectionId;
      await this.contactRepo.save(contact);
    }

    return this.messageRepo.save(this.messageRepo.create({
      tenantId,
      contactId: contact.id,
      connectionId,
      waMessageId: messageId || null,
      direction: 'outgoing',
      text,
      messageType: 'text',
      linkedLeadId: contact.leadId || null,
      linkedContactId: contact.contactId || null,
      linkedCompanyId: contact.companyId || null,
      date: new Date(),
      isRead: true,
      // Ответ ИИ помечаем: так консультант отличает «человек уже ответил» от своих ответов, а чат CRM — бейдж «ИИ-ответ»
      rawData: opts?.source ? { source: opts.source, agentId: opts.agentId ?? null } : null,
    }));
  }

  /** Отправить клиенту файл (PDF/Word/Excel/JPEG/PNG) в существующий диалог. */
  async sendFile(
    tenantId: string,
    connectionId: string,
    contactId: string,
    upload: ChatUpload | undefined,
    caption?: string,
  ): Promise<WhatsappMessage> {
    const file = normalizeChatFile(upload);
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('WhatsApp contact not found');
    await this.assertWindowOpen(tenantId, contactId);
    const { phoneNumberId, accessToken } = await this.getCredentials(tenantId, connectionId);
    // Картинки у WhatsApp — до 5 МБ; крупнее отправляем документом, чтобы не получить отказ Meta
    const kind = file.kind === 'image' && file.size <= 5 * 1024 * 1024 ? 'image' : 'document';
    const text = (caption || '').trim();
    let mediaId: string;
    let messageId: string | undefined;
    try {
      mediaId = await this.whatsappCloud.uploadMedia({ phoneNumberId, accessToken, buffer: file.buffer, mime: file.mime, fileName: file.fileName });
      ({ messageId } = await this.whatsappCloud.sendMediaMessage({
        phoneNumberId, accessToken, to: this.recipientOf(contact), kind, mediaId, fileName: file.fileName, caption: text || undefined,
      }));
    } catch (e) {
      return this.sendFailed(connectionId, e);
    }
    void this.markConnectionHealth(connectionId, true);
    if (contact.connectionId !== connectionId) {
      contact.connectionId = connectionId;
      await this.contactRepo.save(contact);
    }
    return this.messageRepo.save(this.messageRepo.create({
      tenantId,
      contactId: contact.id,
      connectionId,
      waMessageId: messageId || null,
      direction: 'outgoing',
      text: text || null,
      messageType: kind,
      attachments: [{ type: kind, id: mediaId, mimeType: file.mime, fileName: file.fileName, fileSize: file.size, caption: text || undefined }],
      linkedLeadId: contact.leadId || null,
      linkedContactId: contact.contactId || null,
      linkedCompanyId: contact.companyId || null,
      date: new Date(),
      isRead: true,
    }));
  }

  /** Файл сообщения (входящего или отправленного) — через Meta по media id, с токеном подключения. */
  async fetchAttachmentFile(
    tenantId: string,
    messageId: string,
    index = 0,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string | null }> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, tenantId } });
    const att = message?.attachments?.[index];
    if (!message || !att?.id) throw new NotFoundException('Attachment not found');
    if (!message.connectionId) throw new BadRequestException('No WhatsApp connection for this message');
    const { accessToken } = await this.getCredentials(tenantId, message.connectionId);
    try {
      const { buffer, contentType } = await this.whatsappCloud.downloadMedia(att.id, accessToken);
      return { buffer, contentType: att.mimeType || contentType, fileName: att.fileName || null };
    } catch (e) {
      throw new BadRequestException(`Файл больше недоступен у Meta: ${(e as Error).message}`);
    }
  }

  /** Расшифровка голосового: текст пишется в message.text (его читают консультант, ИИ-сотрудники,
   * поиск), а пометка transcript во вложении говорит интерфейсу показать его как расшифровку. */
  private async transcribeVoiceMessage(tenantId: string, message: WhatsappMessage): Promise<string | null> {
    try {
      const { buffer, contentType } = await this.fetchAttachmentFile(tenantId, message.id, 0);
      const ext = /ogg|opus/.test(contentType) ? 'ogg' : /mpeg|mp3/.test(contentType) ? 'mp3' : /mp4|m4a|aac/.test(contentType) ? 'm4a' : 'ogg';
      const res = await transcribeInboundVoice(this.moduleRef, tenantId, buffer, `voice.${ext}`);
      if (!res) return null;
      message.text = res.text;
      message.attachments = (message.attachments || []).map((a, i) => (i === 0 ? { ...a, transcript: true, transcriptLang: res.language } : a));
      await this.messageRepo.save(message);
      return res.text;
    } catch (e) {
      this.log.warn(`WhatsApp voice ${message.id} transcription skipped: ${(e as Error).message}`);
      return null;
    }
  }

  /** «Создать лид» из диалога: новый лид с источником whatsapp, диалог и его сообщения привязываются к нему. */
  async createLeadForContact(tenantId: string, contactId: string): Promise<{ leadId: string }> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.leadId) return { leadId: contact.leadId };
    const phone = contact.waPhoneDigits ? `+${contact.waPhoneDigits}` : null;
    const lead = await this.leadsService.createForTenant(tenantId, {
      name: contact.waProfileName || (phone ? `WhatsApp ${phone}` : 'WhatsApp'),
      ...(phone ? { phone } : {}),
      source: 'whatsapp',
      status: 'new',
      meta: { whatsappPhoneDigits: contact.waPhoneDigits, whatsappUserId: contact.waUserId, whatsappConnectionId: contact.connectionId || null },
    } as any);
    contact.leadId = lead.id;
    await this.contactRepo.save(contact);
    await this.messageRepo.update({ tenantId, contactId: contact.id }, { linkedLeadId: lead.id });
    return { leadId: lead.id };
  }
}
