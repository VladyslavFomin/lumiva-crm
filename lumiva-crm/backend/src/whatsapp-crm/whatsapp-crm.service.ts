// src/whatsapp-crm/whatsapp-crm.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappContact } from './whatsapp-contact.entity';
import { WhatsappMessage } from './whatsapp-message.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { WhatsappCloudService } from '../integrations/whatsapp/whatsapp-cloud.service';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { EntityType, NoteType } from '../notes/dto/create-note.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { normalizeChatFile, type ChatUpload } from '../common/chat-file.util';
import { enrichChatContacts } from '../common/chat-contact-enrich.util';

export interface InboundWhatsappMessage {
  waMessageId: string;
  fromDigits: string;
  profileName?: string | null;
  type: string;
  text?: string | null;
  displayPhone?: string | null;
  timestamp?: number | null;
  raw: any;
}

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

    let contact = await this.contactRepo.findOne({ where: { tenantId, waPhoneDigits: digits } });
    if (!contact) {
      contact = this.contactRepo.create({
        tenantId,
        connectionId,
        waPhoneDigits: digits,
        waProfileName: msg.profileName || null,
        status: 'active',
      });
    } else {
      contact.connectionId = connectionId;
      if (msg.profileName) contact.waProfileName = msg.profileName;
    }
    try {
      contact = await this.contactRepo.save(contact);
    } catch (error) {
      // Гонка двух почти одновременных вебхуков от одного номера — обе ветки прошли
      // find-then-create до того, как первая успела сохраниться. UQ_whatsapp_contacts_tenant_phone
      // (см. migrations/20260902120000) ловит это на уровне БД вместо тихого дубля контакта.
      if ((error as { code?: string }).code === '23505') {
        const existing = await this.contactRepo.findOne({ where: { tenantId, waPhoneDigits: digits } });
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
        name: msg.profileName || `WhatsApp +${digits}`,
        phone: `+${digits}`,
        source: 'whatsapp',
        status: 'new',
        meta: { whatsappPhoneDigits: digits, whatsappConnectionId: connectionId },
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

    const lines = [
      'Входящее сообщение WhatsApp',
      msg.displayPhone ? `Линия: ${msg.displayPhone}` : null,
      msg.profileName ? `Имя в WhatsApp: ${msg.profileName}` : null,
      '',
      msg.type === 'text'
        ? (msg.text || '(пустое тело)')
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

    const rows = contacts
      .map((c) => ({
        ...c,
        lastMessage: lastByContact.get(c.id) ?? null,
        unreadCount: unreadByContact.get(c.id) ?? 0,
      }))
      .sort((a, b) => {
        const ad = a.lastMessage ? new Date(a.lastMessage.date).getTime() : new Date(a.createdAt).getTime();
        const bd = b.lastMessage ? new Date(b.lastMessage.date).getTime() : new Date(b.createdAt).getTime();
        return bd - ad;
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

  async sendMessage(
    tenantId: string,
    connectionId: string,
    contactId: string,
    text: string,
    opts?: { source?: 'ai'; agentId?: string },
  ): Promise<WhatsappMessage> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('WhatsApp contact not found');
    const { phoneNumberId, accessToken } = await this.getCredentials(tenantId, connectionId);

    const { messageId } = await this.whatsappCloud.sendTextMessage({
      phoneNumberId, accessToken, to: contact.waPhoneDigits, body: text,
    });

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
    const { phoneNumberId, accessToken } = await this.getCredentials(tenantId, connectionId);
    // Картинки у WhatsApp — до 5 МБ; крупнее отправляем документом, чтобы не получить отказ Meta
    const kind = file.kind === 'image' && file.size <= 5 * 1024 * 1024 ? 'image' : 'document';
    const text = (caption || '').trim();
    let mediaId: string;
    let messageId: string | undefined;
    try {
      mediaId = await this.whatsappCloud.uploadMedia({ phoneNumberId, accessToken, buffer: file.buffer, mime: file.mime, fileName: file.fileName });
      ({ messageId } = await this.whatsappCloud.sendMediaMessage({
        phoneNumberId, accessToken, to: contact.waPhoneDigits, kind, mediaId, fileName: file.fileName, caption: text || undefined,
      }));
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
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

  /** «Создать лид» из диалога: новый лид с источником whatsapp, диалог и его сообщения привязываются к нему. */
  async createLeadForContact(tenantId: string, contactId: string): Promise<{ leadId: string }> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.leadId) return { leadId: contact.leadId };
    const phone = `+${contact.waPhoneDigits}`;
    const lead = await this.leadsService.createForTenant(tenantId, {
      name: contact.waProfileName || `WhatsApp +${contact.waPhoneDigits}`,
      ...(phone ? { phone } : {}),
      source: 'whatsapp',
      status: 'new',
      meta: { whatsappPhoneDigits: contact.waPhoneDigits, whatsappConnectionId: contact.connectionId || null },
    } as any);
    contact.leadId = lead.id;
    await this.contactRepo.save(contact);
    await this.messageRepo.update({ tenantId, contactId: contact.id }, { linkedLeadId: lead.id });
    return { leadId: lead.id };
  }
}
