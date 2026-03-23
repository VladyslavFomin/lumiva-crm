import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { EmailService } from '../email/email.service';
import { StaffUser } from '../staff/staff-user.entity';

type LeadMeeting = {
  id: string;
  title?: string;
  startsAt: string;
  endsAt?: string;
  meetingUrl?: string;
  notes?: string;
  attendeeUserIds?: string[];
  attendeeNames?: string[];
  closedAt?: string;
  notifySentAt?: string;
  reminder24hSentAt?: string;
  reminder1hSentAt?: string;
};

@Injectable()
export class LeadsMeetingsReminderService {
  private readonly logger = new Logger(LeadsMeetingsReminderService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    private readonly emailService: EmailService,
  ) {}

  @Cron('* * * * *')
  async processMeetingReminders() {
    const leads = await this.leadsRepo.find();
    if (!leads.length) return;

    const accountsByTenant = new Map<string, string>();
    const now = Date.now();

    for (const lead of leads) {
      if (!lead.tenantId || !lead.email) continue;
      const meetings = this.readMeetings(lead);
      if (!meetings.length) continue;

      let changed = false;
      for (const meeting of meetings) {
        if (meeting.closedAt) continue;
        if (!meeting.startsAt) continue;
        const start = new Date(meeting.startsAt).getTime();
        if (!Number.isFinite(start) || start <= now) continue;
        const diffMs = start - now;

        const in24hWindow = diffMs <= 24 * 60 * 60 * 1000 && diffMs > 23 * 60 * 60 * 1000;
        const in1hWindow = diffMs <= 60 * 60 * 1000 && diffMs > 45 * 60 * 1000;
        if (!in24hWindow && !in1hWindow) continue;

        const reminderKind: '24h' | '1h' | null = in1hWindow
          ? meeting.reminder1hSentAt
            ? null
            : '1h'
          : meeting.reminder24hSentAt
            ? null
            : '24h';
        if (!reminderKind) continue;

        const accountId = await this.getAccountIdForTenant(lead.tenantId, accountsByTenant);
        if (!accountId) continue;

        try {
          const cc = await this.getAttendeeEmails(lead.tenantId, meeting.attendeeUserIds || [], lead.email);
          await this.emailService.sendEmail(lead.tenantId, {
            accountId,
            to: [lead.email],
            cc: cc.length ? cc : undefined,
            subject: this.buildSubject(reminderKind, meeting),
            textBody: this.buildTextBody(lead, meeting, reminderKind),
            leadId: lead.id,
            contactId: lead.contactId || undefined,
            companyId: lead.companyId || undefined,
            attachments: [
              {
                filename: 'meeting.ics',
                contentType: 'text/calendar; charset=utf-8; method=REQUEST',
                contentBase64: this.buildMeetingIcsBase64(lead, meeting),
              },
            ],
          } as any);

          if (reminderKind === '24h') meeting.reminder24hSentAt = new Date().toISOString();
          if (reminderKind === '1h') meeting.reminder1hSentAt = new Date().toISOString();
          changed = true;
        } catch (error: any) {
          this.logger.warn(
            `Failed to send ${reminderKind} reminder for lead ${lead.id}, meeting ${meeting.id}: ${error?.message || 'unknown error'}`,
          );
        }
      }

      if (changed) {
        const nextMeta = { ...(lead.meta || {}), meetings };
        lead.meta = nextMeta;
        await this.leadsRepo.save(lead);
      }
    }
  }

  private async getAccountIdForTenant(
    tenantId: string,
    cache: Map<string, string>,
  ): Promise<string | null> {
    const cached = cache.get(tenantId);
    if (cached) return cached;
    try {
      const accounts = await this.emailService.findAllAccounts(tenantId);
      const account = accounts.find((a) => a.status === 'active') || accounts[0];
      if (!account) return null;
      cache.set(tenantId, account.id);
      return account.id;
    } catch (error: any) {
      this.logger.warn(`No email account for tenant ${tenantId}: ${error?.message || 'unknown error'}`);
      return null;
    }
  }

  private readMeetings(lead: Lead): LeadMeeting[] {
    const raw = (lead.meta as any)?.meetings;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item.id === 'string' && typeof item.startsAt === 'string')
      .map((item) => ({
        id: String(item.id),
        title: item.title ? String(item.title) : '',
        startsAt: String(item.startsAt),
        endsAt: item.endsAt ? String(item.endsAt) : '',
        meetingUrl: item.meetingUrl ? String(item.meetingUrl) : '',
        notes: item.notes ? String(item.notes) : '',
        attendeeUserIds: Array.isArray(item.attendeeUserIds)
          ? item.attendeeUserIds.map(String)
          : [],
        attendeeNames: Array.isArray(item.attendeeNames)
          ? item.attendeeNames.map(String)
          : [],
        closedAt: item.closedAt ? String(item.closedAt) : '',
        notifySentAt: item.notifySentAt ? String(item.notifySentAt) : '',
        reminder24hSentAt: item.reminder24hSentAt ? String(item.reminder24hSentAt) : '',
        reminder1hSentAt: item.reminder1hSentAt ? String(item.reminder1hSentAt) : '',
      }));
  }

  private async getAttendeeEmails(
    tenantId: string,
    userIds: string[],
    leadEmail: string,
  ): Promise<string[]> {
    if (!Array.isArray(userIds) || !userIds.length) return [];
    const users = await this.staffRepo.find({
      where: {
        tenantId,
        isActive: true,
      },
    });
    const wanted = new Set(userIds);
    return users
      .filter((user) => wanted.has(user.id))
      .map((user) => user.email)
      .filter((email) => Boolean(email) && email !== leadEmail);
  }

  private buildSubject(kind: '24h' | '1h', meeting: LeadMeeting): string {
    const title = meeting.title?.trim() || 'Встреча с лидом';
    return kind === '24h' ? `Напоминание (24ч): ${title}` : `Напоминание (1ч): ${title}`;
  }

  private buildTextBody(lead: Lead, meeting: LeadMeeting, kind: '24h' | '1h'): string {
    const startText = new Date(meeting.startsAt).toLocaleString('ru-RU');
    const endText = meeting.endsAt ? new Date(meeting.endsAt).toLocaleString('ru-RU') : '';
    const lines = [
      `Здравствуйте${lead.name ? `, ${lead.name}` : ''}!`,
      '',
      kind === '24h'
        ? 'Напоминаем: встреча состоится через 24 часа.'
        : 'Напоминаем: встреча состоится через 1 час.',
      `Тема: ${meeting.title || 'Встреча с лидом'}`,
      `Начало: ${startText}`,
      endText ? `Окончание: ${endText}` : '',
      meeting.meetingUrl ? `Ссылка: ${meeting.meetingUrl}` : '',
      meeting.notes ? `Комментарий: ${meeting.notes}` : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  private toIcsUtc(iso: string): string {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeIcsText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  private buildMeetingIcsBase64(lead: Lead, meeting: LeadMeeting): string {
    const uid = `${meeting.id}@lumiva-crm`;
    const dtStamp = this.toIcsUtc(new Date().toISOString());
    const dtStart = this.toIcsUtc(meeting.startsAt);
    const dtEnd = this.toIcsUtc(meeting.endsAt || meeting.startsAt);
    const summary = this.escapeIcsText(meeting.title || `Встреча с ${lead.name || 'лидом'}`);
    const description = this.escapeIcsText(
      [
        meeting.notes || '',
        meeting.meetingUrl ? `Ссылка: ${meeting.meetingUrl}` : '',
        lead.phone ? `Телефон: ${lead.phone}` : '',
        lead.email ? `Email: ${lead.email}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    const location = this.escapeIcsText(meeting.meetingUrl || 'Online');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lumiva CRM//Leads Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return Buffer.from(ics, 'utf-8').toString('base64');
  }
}



