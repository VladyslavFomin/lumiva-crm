// src/whatsapp-crm/whatsapp-crm.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
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
    contact = await this.contactRepo.save(contact);

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

    const message = await this.messageRepo.save(this.messageRepo.create({
      tenantId,
      contactId: contact.id,
      connectionId,
      waMessageId: msg.waMessageId,
      direction: 'incoming',
      text: msg.type === 'text' ? (msg.text || null) : null,
      messageType: msg.type,
      date: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
      isRead: false,
      rawData: msg.raw,
    }));

    const lines = [
      'Входящее сообщение WhatsApp',
      msg.displayPhone ? `Линия: ${msg.displayPhone}` : null,
      msg.profileName ? `Имя в WhatsApp: ${msg.profileName}` : null,
      '',
      msg.type === 'text' ? (msg.text || '(пустое тело)') : `[${msg.type}]`,
    ].filter((x) => x != null).join('\n');

    await this.notesService.create(tenantId, {
      entityType: EntityType.LEAD,
      entityId: lead.id,
      content: lines,
      title: 'WhatsApp · входящее',
      type: NoteType.NOTE,
      metadata: { channel: 'whatsapp_inbound', waMessageId: msg.waMessageId, connectionId, contactId: contact.id },
    }, undefined, 'WhatsApp');

    return message;
  }

  async findContacts(
    tenantId: string,
    options?: { search?: string; connectionId?: string },
  ): Promise<Array<WhatsappContact & { lastMessage: WhatsappMessage | null; unreadCount: number }>> {
    const qb = this.contactRepo.createQueryBuilder('contact')
      .where('contact.tenantId = :tenantId', { tenantId });
    if (options?.connectionId) qb.andWhere('contact.connectionId = :connectionId', { connectionId: options.connectionId });
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

    return contacts
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
    }));
  }
}
