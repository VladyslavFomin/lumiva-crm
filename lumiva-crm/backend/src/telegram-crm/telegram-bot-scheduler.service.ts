// src/telegram-crm/telegram-bot-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramBot } from './telegram-bot.entity';
import { Lead } from '../leads/lead.entity';
import { TelegramCrmService } from './telegram-crm.service';

type LeadMeeting = {
  id: string;
  title?: string;
  startsAt: string;
  tgReminder1hSentAt?: string;
  tgReminderTodaySentAt?: string;
  closedAt?: string;
  attendeeUserIds?: string[];
};

@Injectable()
export class TelegramBotSchedulerService {
  private readonly log = new Logger(TelegramBotSchedulerService.name);

  constructor(
    @InjectRepository(TelegramBot)
    private readonly botRepo: Repository<TelegramBot>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly telegramCrm: TelegramCrmService,
  ) {}

  /** Every 15 minutes: send Telegram meeting reminders to staff */
  @Cron('*/15 * * * *')
  async sendMeetingReminders(): Promise<void> {
    try {
      const bots = await this.botRepo.find({ where: { status: 'active' } });
      if (!bots.length) return;

      // Collect tenants with at least one bot that has recipients
      const tenantIds = [
        ...new Set(
          bots
            .filter((b) => Array.isArray(b.meta?.recipients) && (b.meta.recipients as any[]).length > 0)
            .map((b) => b.tenantId),
        ),
      ];
      if (!tenantIds.length) return;

      const now = Date.now();

      for (const tenantId of tenantIds) {
        const leads = await this.leadRepo
          .createQueryBuilder('l')
          .where('l.tenantId = :tenantId', { tenantId })
          .andWhere("l.meta->'meetings' IS NOT NULL")
          .getMany();

        let needSave: Lead[] = [];

        for (const lead of leads) {
          const meetings = this.readMeetings(lead);
          if (!meetings.length) continue;

          let changed = false;
          for (const meeting of meetings) {
            if (meeting.closedAt) continue;
            const start = new Date(meeting.startsAt).getTime();
            if (!Number.isFinite(start) || start <= now) continue;
            const diff = start - now;

            // 1-hour window (45–65 min before)
            const in1h = diff <= 65 * 60_000 && diff > 44 * 60_000;
            // Same-day morning reminder (sent before 10:00 on the meeting day)
            const meetingDate = new Date(meeting.startsAt).toDateString();
            const todayDate = new Date().toDateString();
            const isToday = meetingDate === todayDate;
            const hour = new Date().getHours();
            const inToday = isToday && hour >= 8 && hour < 10 && diff > 2 * 60 * 60_000;

            if (in1h && !meeting.tgReminder1hSentAt) {
              const title = meeting.title || 'Встреча';
              const time = new Date(meeting.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const msg = `⏰ <b>Встреча через час</b>\n<b>${escHtml(title)}</b> в ${time}\n<i>Лид: ${escHtml(lead.name || '—')}</i>`;

              if (meeting.attendeeUserIds?.length) {
                for (const uid of meeting.attendeeUserIds) {
                  await this.telegramCrm.notifyStaffUser(tenantId, uid, msg).catch(() => undefined);
                }
              } else {
                await this.telegramCrm.notifyTenantRecipients(tenantId, msg).catch(() => undefined);
              }

              meeting.tgReminder1hSentAt = new Date().toISOString();
              changed = true;
            }

            if (inToday && !meeting.tgReminderTodaySentAt) {
              const title = meeting.title || 'Встреча';
              const time = new Date(meeting.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const msg = `📅 <b>Встреча сегодня в ${time}</b>\n<b>${escHtml(title)}</b>\n<i>Лид: ${escHtml(lead.name || '—')}</i>`;

              if (meeting.attendeeUserIds?.length) {
                for (const uid of meeting.attendeeUserIds) {
                  await this.telegramCrm.notifyStaffUser(tenantId, uid, msg).catch(() => undefined);
                }
              } else {
                await this.telegramCrm.notifyTenantRecipients(tenantId, msg).catch(() => undefined);
              }

              meeting.tgReminderTodaySentAt = new Date().toISOString();
              changed = true;
            }
          }

          if (changed) {
            lead.meta = { ...(lead.meta || {}), meetings };
            needSave.push(lead);
          }
        }

        for (const lead of needSave) {
          await this.leadRepo.save(lead).catch(() => undefined);
        }
      }
    } catch (err: any) {
      this.log.warn(`Meeting reminder cron error: ${err.message}`);
    }
  }

  private readMeetings(lead: Lead): LeadMeeting[] {
    const raw = (lead.meta as any)?.meetings;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m) => m && typeof m.id === 'string' && typeof m.startsAt === 'string')
      .map((m) => ({
        id: String(m.id),
        title: m.title ? String(m.title) : '',
        startsAt: String(m.startsAt),
        tgReminder1hSentAt: m.tgReminder1hSentAt || null,
        tgReminderTodaySentAt: m.tgReminderTodaySentAt || null,
        closedAt: m.closedAt || null,
        attendeeUserIds: Array.isArray(m.attendeeUserIds) ? m.attendeeUserIds.map(String) : [],
      }));
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
