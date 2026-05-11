import { Injectable, Logger } from '@nestjs/common';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffUsersService } from '../staff/staff-users.service';

type CalendarNotificationMeta = Record<string, unknown> & {
  title?: string | null;
  startAt?: string | null;
  workspaceCalendarPath?: string | null;
  workspaceTablePath?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EmailNotificationsService {
  private readonly log = new Logger(EmailNotificationsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly staffUsers: StaffUsersService,
  ) {}

  shouldNotifyImportedMessage(account: EmailAccount, msg: EmailMessage): boolean {
    const messageTs = msg.date instanceof Date ? msg.date.getTime() : new Date(msg.date).getTime();
    if (!Number.isFinite(messageTs)) return false;
    if (account.lastSyncAt) {
      return messageTs >= account.lastSyncAt.getTime() - 60_000;
    }
    const recentWindowStart = Date.now() - 5 * 60_000;
    const createdAt = account.createdAt?.getTime();
    const anchorTs = Number.isFinite(createdAt)
      ? Math.max(createdAt, recentWindowStart)
      : recentWindowStart;
    return messageTs >= anchorTs - 60_000;
  }

  async notifyIncomingMessage(
    account: EmailAccount,
    msg: EmailMessage,
    leadId?: string | null,
  ): Promise<void> {
    if (msg.direction !== 'incoming') return;
    if (!this.shouldNotifyImportedMessage(account, msg)) return;
    await this.safeCreate(account, 'Новое письмо', this.emailBody(account, msg), {
      type: 'email.message_received',
      emailMessageId: msg.id,
      emailAccountId: account.id,
      accountEmail: account.email,
      leadId: leadId ?? msg.leadId ?? null,
      from: msg.from,
      fromName: msg.fromName,
      subject: msg.subject,
      date: msg.date,
      link: this.emailLink(account, msg),
    });
  }

  async notifyCalendarInvite(
    account: EmailAccount,
    msg: EmailMessage,
    calendarInvite: CalendarNotificationMeta,
  ): Promise<void> {
    if (msg.direction !== 'incoming') return;
    if (!this.shouldNotifyImportedMessage(account, msg)) return;
    const link =
      this.cleanPath(calendarInvite.workspaceCalendarPath) ||
      this.cleanPath(calendarInvite.workspaceTablePath) ||
      this.emailLink(account, msg);
    await this.safeCreate(account, 'Новая встреча из почты', this.meetingBody(account, msg, calendarInvite), {
      type: 'email.calendar_invite_received',
      emailMessageId: msg.id,
      emailAccountId: account.id,
      accountEmail: account.email,
      workspaceObjectId: calendarInvite.workspaceObjectId ?? null,
      workspaceRecordId: calendarInvite.workspaceRecordId ?? null,
      workspaceCalendarPath: calendarInvite.workspaceCalendarPath ?? null,
      workspaceTablePath: calendarInvite.workspaceTablePath ?? null,
      from: msg.from,
      fromName: msg.fromName,
      subject: msg.subject,
      calendarInvite,
      link,
    });
  }

  private async safeCreate(
    account: EmailAccount,
    title: string,
    body: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    try {
      const recipients = await this.resolveRecipients(account);
      if (!recipients.length) return;
      await this.notifications.create(account.tenantId, recipients, title, body, meta);
    } catch (e: any) {
      this.log.warn(`email notification ${account.id}: ${e?.message || e}`);
    }
  }

  private async resolveRecipients(account: EmailAccount): Promise<string[]> {
    const meta = this.accountMeta(account);
    const explicitIds = [
      meta.connectedByUserId,
      meta.createdByUserId,
      ...(Array.isArray(meta.notificationUserIds) ? meta.notificationUserIds : []),
    ]
      .map((value) => String(value || '').trim())
      .filter((value) => UUID_RE.test(value));
    if (explicitIds.length) return [...new Set(explicitIds)];
    return this.staffUsers.resolveNotificationUserIdsForTenant(account.tenantId);
  }

  private accountMeta(account: EmailAccount): Record<string, unknown> {
    return account.meta && typeof account.meta === 'object' && !Array.isArray(account.meta)
      ? (account.meta as Record<string, unknown>)
      : {};
  }

  private emailBody(account: EmailAccount, msg: EmailMessage): string {
    return [
      `От: ${this.senderLabel(msg)}`,
      `Тема: ${this.subjectLabel(msg)}`,
      `Ящик: ${account.email}`,
    ].join('\n');
  }

  private meetingBody(
    account: EmailAccount,
    msg: EmailMessage,
    invite: CalendarNotificationMeta,
  ): string {
    const title = String(invite.title || msg.subject || 'Встреча').trim();
    const start = this.formatDate(invite.startAt);
    return [
      `Встреча: ${title}`,
      start ? `Начало: ${start}` : null,
      `От: ${this.senderLabel(msg)}`,
      `Ящик: ${account.email}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private senderLabel(msg: EmailMessage): string {
    return msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from;
  }

  private subjectLabel(msg: EmailMessage): string {
    return (msg.subject || 'Без темы').trim();
  }

  private emailLink(account: EmailAccount, msg: EmailMessage): string {
    return `/email/inbox?accountId=${encodeURIComponent(account.id)}&messageId=${encodeURIComponent(msg.id)}`;
  }

  private cleanPath(value: unknown): string | null {
    const path = String(value || '').trim();
    if (!path.startsWith('/')) return null;
    return path.replace(/^\/app(?=\/|$)/, '') || '/dashboard';
  }

  private formatDate(raw: unknown): string | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
