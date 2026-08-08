// src/helpdesk/helpdesk.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HelpdeskChannel, HelpdeskTicket, HelpdeskTicketPriority, HelpdeskTicketStatus } from './helpdesk-ticket.entity';
import { HelpdeskTicketMessage } from './helpdesk-ticket-message.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { Department } from '../departments/department.entity';
import { EmailAccount } from '../email/email-account.entity';
import { TelegramContact } from '../telegram-crm/telegram-contact.entity';
import { WhatsappContact } from '../whatsapp-crm/whatsapp-contact.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { TelegramCrmService } from '../telegram-crm/telegram-crm.service';
import { WhatsappCrmService } from '../whatsapp-crm/whatsapp-crm.service';
import { SmsService } from '../sms/sms.service';

export type HelpdeskLinkType = 'lead' | 'company' | 'project';

/** Target response time by priority, in minutes — drives the "SLA overdue" flag. */
const SLA_TARGET_MIN: Record<HelpdeskTicketPriority, number> = { urgent: 30, high: 120, medium: 480, low: 1440 };

@Injectable()
export class HelpdeskService {
  constructor(
    @InjectRepository(HelpdeskTicket) private readonly ticketRepo: Repository<HelpdeskTicket>,
    @InjectRepository(HelpdeskTicketMessage) private readonly messageRepo: Repository<HelpdeskTicketMessage>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    @InjectRepository(EmailAccount) private readonly emailAccountRepo: Repository<EmailAccount>,
    @InjectRepository(TelegramContact) private readonly telegramContactRepo: Repository<TelegramContact>,
    @InjectRepository(WhatsappContact) private readonly whatsappContactRepo: Repository<WhatsappContact>,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly telegramCrmService: TelegramCrmService,
    private readonly whatsappCrmService: WhatsappCrmService,
    private readonly smsService: SmsService,
  ) {}

  // ========= CRM-entity link resolution (lead/company/project) =========

  private repoForLinkType(type: HelpdeskLinkType): Repository<{ id: string; name: string | null; tenantId: string | null }> {
    if (type === 'lead') return this.leadRepo as any;
    if (type === 'company') return this.companyRepo as any;
    return this.projectRepo as any;
  }

  private async resolveEntityLabel(tenantId: string, type: string | null, id: string | null): Promise<string | null> {
    if (!type || !id) return null;
    if (type !== 'lead' && type !== 'company' && type !== 'project') return null;
    const row = await this.repoForLinkType(type).findOne({ where: { id, tenantId } as any });
    return row?.name || null;
  }

  async searchLinkEntities(tenantId: string, type: HelpdeskLinkType, search?: string) {
    if (type !== 'lead' && type !== 'company' && type !== 'project') throw new BadRequestException('Неизвестный тип привязки');
    const repo = this.repoForLinkType(type);
    const qb = repo.createQueryBuilder('e').where('e.tenantId = :tenantId', { tenantId }).andWhere('e.name IS NOT NULL');
    if (search?.trim()) qb.andWhere('e.name ILIKE :s', { s: `%${search.trim()}%` });
    const rows = await qb.orderBy('e.name', 'ASC').limit(10).getMany();
    return rows.map((r: any) => ({ id: r.id, name: r.name }));
  }

  // ========= SLA =========

  private slaFor(ticket: HelpdeskTicket, firstOutgoingAt: Date | null) {
    const targetMinutes = SLA_TARGET_MIN[ticket.priority] ?? SLA_TARGET_MIN.medium;
    const hasResponded = !!firstOutgoingAt;
    const elapsedMs = (firstOutgoingAt ?? new Date()).getTime() - ticket.createdAt.getTime();
    const overdue = !hasResponded && ticket.status !== 'closed' && elapsedMs > targetMinutes * 60_000;
    return { slaTargetMinutes: targetMinutes, overdue };
  }

  private isExternalChannel(channel: HelpdeskChannel): boolean {
    return channel !== 'portal' && channel !== 'internal';
  }

  // ========= internal requester (staff who filed the ticket, not a client) =========

  /** Any authenticated User can raise an internal request to support — e.g. Sales asking
   * IT/support for help — regardless of helpdesk RBAC permissions AND regardless of whether
   * they even have a StaffUser row (not every logged-in User does — the department/StaffUser
   * link below is best-effort enrichment, not a requirement). No channel/contact to pick:
   * replies notify the requester in-app instead of dispatching externally. */
  async createInternalRequest(
    tenantId: string,
    requester: { id: string; name?: string | null; email?: string | null },
    input: { subject: string; message: string; category?: string | null; priority?: HelpdeskTicketPriority },
  ) {
    if (!input.subject?.trim()) throw new BadRequestException('Укажите тему обращения');
    if (!input.message?.trim()) throw new BadRequestException('Опишите ваш вопрос');
    if (!requester.id) throw new BadRequestException('Не удалось определить сотрудника, отправляющего запрос');

    const requesterName = requester.name?.trim() || requester.email?.trim() || 'Сотрудник';
    const email = requester.email?.trim().toLowerCase();
    const staff = email
      ? await this.staffRepo.createQueryBuilder('s').where('s.tenantId = :tenantId', { tenantId }).andWhere('LOWER(s.email) = :email', { email }).getOne()
      : null;
    const department = staff?.departmentId ? await this.departmentRepo.findOne({ where: { id: staff.departmentId, tenantId } }) : null;

    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        tenantId,
        requesterUserId: requester.id,
        requesterStaffId: staff?.id || null,
        requesterName: staff?.fullName || requesterName,
        requesterDepartment: department?.name || null,
        subject: input.subject.trim(),
        category: input.category?.trim() || null,
        priority: input.priority || 'medium',
        channel: 'internal',
      }),
    );
    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId,
        ticketId: ticket.id,
        direction: 'incoming',
        authorName: ticket.requesterName,
        text: input.message.trim(),
      }),
    );
    await this.notifyStaff(tenantId, null, `Внутреннее обращение: ${ticket.subject}`, `${ticket.requesterName}: ${input.message.trim().slice(0, 200)}`, ticket.id);
    return ticket;
  }

  // ========= staff-side =========

  async listTickets(tenantId: string, filters: { status?: HelpdeskTicketStatus; assignedUserId?: string }) {
    const where: any = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;

    const tickets = await this.ticketRepo.find({ where, order: { updatedAt: 'DESC' } });
    if (!tickets.length) return [];

    const contactIds = [...new Set(tickets.map((t) => t.contactId).filter((id): id is string => !!id))];
    const contacts = contactIds.length ? await this.contactRepo.find({ where: { id: In(contactIds) } }) : [];
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    const assigneeIds = [...new Set(tickets.map((t) => t.assignedUserId).filter((id): id is string => !!id))];
    const assignees = assigneeIds.length ? await this.staffRepo.find({ where: { id: In(assigneeIds) } }) : [];
    const assigneeById = new Map(assignees.map((s) => [s.id, s]));

    const ticketIds = tickets.map((t) => t.id);
    const lastMessages = ticketIds.length
      ? await this.messageRepo
          .createQueryBuilder('m')
          .distinctOn(['m.ticketId'])
          .where('m.ticketId IN (:...ticketIds)', { ticketIds })
          .orderBy('m.ticketId')
          .addOrderBy('m.createdAt', 'DESC')
          .getMany()
      : [];
    const lastMessageByTicket = new Map(lastMessages.map((m) => [m.ticketId, m]));

    const unreadRows = ticketIds.length
      ? await this.messageRepo
          .createQueryBuilder('m')
          .select('m.ticketId', 'ticketId')
          .addSelect('COUNT(*)', 'count')
          .where('m.ticketId IN (:...ticketIds)', { ticketIds })
          .andWhere("m.direction = 'incoming'")
          .andWhere('m.isRead = false')
          .groupBy('m.ticketId')
          .getRawMany()
      : [];
    const unreadByTicket = new Map(unreadRows.map((r) => [r.ticketId, Number(r.count)]));

    const firstOutgoingRows = ticketIds.length
      ? await this.messageRepo
          .createQueryBuilder('m')
          .select('m.ticketId', 'ticketId')
          .addSelect('MIN(m.createdAt)', 'firstAt')
          .where('m.ticketId IN (:...ticketIds)', { ticketIds })
          .andWhere("m.direction = 'outgoing'")
          .groupBy('m.ticketId')
          .getRawMany()
      : [];
    const firstOutgoingByTicket = new Map(firstOutgoingRows.map((r) => [r.ticketId, new Date(r.firstAt)]));

    return Promise.all(
      tickets.map(async (t) => {
        const contact = t.contactId ? contactById.get(t.contactId) : null;
        const assignee = t.assignedUserId ? assigneeById.get(t.assignedUserId) : null;
        const lastMessage = lastMessageByTicket.get(t.id);
        const { slaTargetMinutes, overdue } = this.slaFor(t, firstOutgoingByTicket.get(t.id) || null);
        return {
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          channel: t.channel,
          category: t.category,
          assignedUserId: t.assignedUserId,
          assigneeName: assignee?.fullName || null,
          contactId: t.contactId,
          contactName: contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : null,
          contactEmail: contact?.email || null,
          requesterStaffId: t.requesterStaffId,
          requesterName: t.requesterName,
          requesterDepartment: t.requesterDepartment,
          entityType: t.entityType,
          entityId: t.entityId,
          entityLabel: await this.resolveEntityLabel(tenantId, t.entityType, t.entityId),
          lastMessagePreview: lastMessage?.text?.slice(0, 140) || null,
          lastMessageAt: lastMessage?.createdAt || t.createdAt,
          unreadCount: unreadByTicket.get(t.id) || 0,
          slaTargetMinutes,
          overdue,
          closedAt: t.closedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
      }),
    );
  }

  async getTicketWithMessages(tenantId: string, ticketId: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    const [messages, contact, assignee] = await Promise.all([
      this.messageRepo.find({ where: { tenantId, ticketId }, order: { createdAt: 'ASC' } }),
      ticket.contactId ? this.contactRepo.findOne({ where: { id: ticket.contactId } }) : Promise.resolve(null),
      ticket.assignedUserId ? this.staffRepo.findOne({ where: { id: ticket.assignedUserId } }) : Promise.resolve(null),
    ]);
    await this.messageRepo.update({ tenantId, ticketId, direction: 'incoming', isRead: false }, { isRead: true });
    const firstOutgoing = messages.find((m) => m.direction === 'outgoing') || null;
    const { slaTargetMinutes, overdue } = this.slaFor(ticket, firstOutgoing?.createdAt || null);
    return {
      ticket: {
        ...ticket,
        contactName: contact ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') : null,
        contactEmail: contact?.email || null,
        contactPhone: contact?.phone || null,
        assigneeName: assignee?.fullName || null,
        entityLabel: await this.resolveEntityLabel(tenantId, ticket.entityType, ticket.entityId),
        slaTargetMinutes,
        overdue,
      },
      messages,
    };
  }

  async createTicketFromStaff(
    tenantId: string,
    input: {
      contactId?: string | null;
      subject: string;
      message: string;
      category?: string | null;
      priority?: HelpdeskTicketPriority;
      channel?: HelpdeskChannel;
      entityType?: HelpdeskLinkType | null;
      entityId?: string | null;
      assignedUserId?: string | null;
      authorName: string;
    },
  ) {
    if (!input.subject?.trim()) throw new BadRequestException('Укажите тему обращения');
    const channel = input.channel || 'portal';
    if (this.isExternalChannel(channel) && !input.contactId) {
      throw new BadRequestException('Для этого канала укажите контакт');
    }
    if (input.entityType && input.entityType !== 'lead' && input.entityType !== 'company' && input.entityType !== 'project') {
      throw new BadRequestException('Неизвестный тип привязки');
    }
    if (input.entityType && input.entityId) {
      const label = await this.resolveEntityLabel(tenantId, input.entityType, input.entityId);
      if (!label) throw new BadRequestException('Связанная запись не найдена');
    }

    const draft = this.ticketRepo.create({
      tenantId,
      contactId: input.contactId || null,
      subject: input.subject.trim(),
      category: input.category?.trim() || null,
      priority: input.priority || 'medium',
      channel,
      entityType: (input.entityType as string) || null,
      entityId: input.entityId || null,
      assignedUserId: input.assignedUserId || null,
    });

    // Dispatch (if applicable) BEFORE persisting — a channel failure (missing contact
    // identity, unconfigured mailbox, etc.) must not leave behind a ticket the caller
    // was told never got created.
    if (input.message?.trim() && this.isExternalChannel(channel)) {
      await this.dispatchOutgoing(tenantId, draft, input.message.trim());
    }

    const ticket = await this.ticketRepo.save(draft);

    if (input.message?.trim()) {
      await this.messageRepo.save(
        this.messageRepo.create({
          tenantId,
          ticketId: ticket.id,
          direction: 'outgoing',
          authorName: input.authorName,
          text: input.message.trim(),
          isRead: true,
        }),
      );
    }
    return ticket;
  }

  async addStaffMessage(tenantId: string, ticketId: string, authorName: string, text: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    if (!text?.trim()) throw new BadRequestException('Сообщение не может быть пустым');
    const trimmed = text.trim();

    if (this.isExternalChannel(ticket.channel)) await this.dispatchOutgoing(tenantId, ticket, trimmed);

    const message = await this.messageRepo.save(
      this.messageRepo.create({ tenantId, ticketId, direction: 'outgoing', authorName, text: trimmed, isRead: true }),
    );
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await this.ticketRepo.update({ id: ticket.id }, { status: 'pending' });
    }
    if (ticket.channel === 'internal' && ticket.requesterUserId) {
      await this.notifications.create(
        tenantId,
        [ticket.requesterUserId],
        `Ответ по обращению: ${ticket.subject}`,
        `${authorName}: ${trimmed.slice(0, 200)}`,
        { type: 'helpdesk.ticket', ticketId: ticket.id },
      );
    }
    return message;
  }

  /** Sends a staff reply out through the ticket's real channel. Throws if the channel target
   * can't be resolved (missing contact identity / channel not configured) — the caller must
   * NOT persist the message in that case, since it never actually left the CRM. */
  private async dispatchOutgoing(tenantId: string, ticket: HelpdeskTicket, text: string): Promise<void> {
    if (!ticket.contactId) throw new BadRequestException('У тикета нет привязанного контакта — не могу определить получателя');
    const contact = await this.contactRepo.findOne({ where: { id: ticket.contactId, tenantId } });
    if (!contact) throw new BadRequestException('Контакт не найден');

    switch (ticket.channel) {
      case 'email': {
        if (!contact.email) throw new BadRequestException('У контакта нет email');
        const account = await this.emailAccountRepo.findOne({ where: { tenantId, status: 'active' }, order: { createdAt: 'ASC' } });
        if (!account) throw new BadRequestException('Нет подключённого почтового ящика — настройте его в Почта → Настройки');
        await this.emailService.sendEmail(tenantId, {
          accountId: account.id,
          to: [contact.email],
          subject: `Re: ${ticket.subject}`,
          textBody: text,
          contactId: contact.id,
        });
        return;
      }
      case 'telegram': {
        const tgContact = await this.telegramContactRepo.findOne({ where: { tenantId, contactId: contact.id }, order: { updatedAt: 'DESC' } });
        if (!tgContact?.botId) throw new BadRequestException('У контакта нет привязки к Telegram');
        await this.telegramCrmService.sendMessage(tenantId, tgContact.botId, tgContact.telegramUserId, text, { contactId: contact.id });
        return;
      }
      case 'whatsapp': {
        const waContact = await this.whatsappContactRepo.findOne({ where: { tenantId, contactId: contact.id }, order: { updatedAt: 'DESC' } });
        if (!waContact?.connectionId) throw new BadRequestException('У контакта нет привязки к WhatsApp');
        await this.whatsappCrmService.sendMessage(tenantId, waContact.connectionId, waContact.id, text);
        return;
      }
      case 'sms': {
        if (!contact.phone) throw new BadRequestException('У контакта нет телефона');
        const record = await this.smsService.sendFromAutomation(tenantId, contact.phone, text, 'contact', contact.id);
        if (record.status === 'failed') {
          throw new BadRequestException(`Не удалось отправить SMS: ${(record.meta as any)?.error || 'ошибка провайдера'}`);
        }
        return;
      }
      default:
        return;
    }
  }

  async updateTicket(
    tenantId: string,
    ticketId: string,
    patch: {
      status?: HelpdeskTicketStatus;
      priority?: HelpdeskTicketPriority;
      assignedUserId?: string | null;
      category?: string | null;
      entityType?: HelpdeskLinkType | null;
      entityId?: string | null;
    },
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    if (patch.status) {
      ticket.status = patch.status;
      ticket.resolvedAt = patch.status === 'resolved' ? new Date() : ticket.resolvedAt;
      ticket.closedAt = patch.status === 'closed' ? new Date() : ticket.closedAt;
    }
    if (patch.priority) ticket.priority = patch.priority;
    if (patch.assignedUserId !== undefined) ticket.assignedUserId = patch.assignedUserId;
    if (patch.category !== undefined) ticket.category = patch.category?.trim() || null;
    if (patch.entityType !== undefined) ticket.entityType = patch.entityType;
    if (patch.entityId !== undefined) ticket.entityId = patch.entityId;
    return this.ticketRepo.save(ticket);
  }

  // ========= portal-side (scoped to one Contact) =========

  async listTicketsForContact(tenantId: string, contactId: string) {
    const tickets = await this.ticketRepo.find({ where: { tenantId, contactId }, order: { updatedAt: 'DESC' } });
    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getTicketForContact(tenantId: string, contactId: string, ticketId: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, tenantId, contactId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    const messages = await this.messageRepo.find({ where: { tenantId, ticketId }, order: { createdAt: 'ASC' } });
    await this.messageRepo.update({ tenantId, ticketId, direction: 'outgoing', isRead: false }, { isRead: true });
    return { ticket, messages };
  }

  async createTicketFromPortal(tenantId: string, contactId: string, subject: string, message: string) {
    if (!subject?.trim()) throw new BadRequestException('Укажите тему обращения');
    if (!message?.trim()) throw new BadRequestException('Опишите ваш вопрос');
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Контакт не найден');

    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({ tenantId, contactId, subject: subject.trim(), channel: 'portal' }),
    );
    const contactName = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Клиент';
    await this.messageRepo.save(
      this.messageRepo.create({ tenantId, ticketId: ticket.id, direction: 'incoming', authorName: contactName, text: message.trim() }),
    );
    await this.notifyStaff(tenantId, null, `Новое обращение: ${ticket.subject}`, `${contactName}: ${message.trim().slice(0, 200)}`, ticket.id);
    return ticket;
  }

  async addPortalMessage(tenantId: string, contactId: string, ticketId: string, text: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, tenantId, contactId } });
    if (!ticket) throw new NotFoundException('Тикет не найден');
    if (!text?.trim()) throw new BadRequestException('Сообщение не может быть пустым');
    const contact = await this.contactRepo.findOne({ where: { id: contactId, tenantId } });
    const contactName = contact?.fullName || [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || 'Клиент';

    const message = await this.messageRepo.save(
      this.messageRepo.create({ tenantId, ticketId, direction: 'incoming', authorName: contactName, text: text.trim() }),
    );
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await this.ticketRepo.update({ id: ticket.id }, { status: 'open' });
    }
    await this.notifyStaff(
      tenantId,
      ticket.assignedUserId,
      `Ответ клиента: ${ticket.subject}`,
      `${contactName}: ${text.trim().slice(0, 200)}`,
      ticket.id,
    );
    return message;
  }

  // ========= notifications =========

  private async notifyStaff(tenantId: string, assignedUserId: string | null, title: string, body: string, ticketId: string) {
    let staff: StaffUser[];
    if (assignedUserId) {
      staff = await this.staffRepo.find({ where: { id: assignedUserId, tenantId } });
    } else {
      staff = await this.staffRepo.find({ where: { tenantId, role: In(['owner', 'manager', 'support']), isActive: true } });
    }
    const emails = new Set(staff.map((s) => s.email?.trim().toLowerCase()).filter((e): e is string => !!e));
    if (!emails.size) return;
    const users = await this.userRepo.find({ where: { tenantId } });
    const userIds = users.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
    if (!userIds.length) return;
    await this.notifications.create(tenantId, userIds, title, body, { type: 'helpdesk.ticket', ticketId });
  }
}
