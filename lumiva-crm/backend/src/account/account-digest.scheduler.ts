import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { InAppNotification } from '../notifications/in-app-notification.entity';
import { MailService } from '../mail/mail.service';
import { renderMailShell } from '../mail/mail-template.util';

/**
 * «Сводка за день» — почасовой обход: у каждого пользователя, включившего дайджест
 * (preferences.notifications.dailyDigest) и указавшего часовой пояс, проверяем, не настал ли
 * у него сейчас 19:00 по местному времени (Intl.DateTimeFormat с его timezone, без ручной
 * арифметики со смещениями). Первый прецедент per-user timezone-aware cron в этом кодбейзе —
 * остальные шедулеры (tenant-trial, automations) работают по фиксированному серверному времени.
 */
@Injectable()
export class AccountDigestScheduler {
  private readonly logger = new Logger(AccountDigestScheduler.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(InAppNotification) private readonly notifRepo: Repository<InAppNotification>,
    private readonly mail: MailService,
  ) {}

  private localHour(timezone: string): number | null {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
      const hourStr = fmt.format(new Date());
      const h = parseInt(hourStr, 10);
      return Number.isFinite(h) ? h % 24 : null;
    } catch {
      return null;
    }
  }

  @Cron('0 * * * *')
  async sendDueDigests(): Promise<void> {
    const candidates = await this.userRepo.find({
      where: { status: 'active', timezone: Not(IsNull()) },
    });

    const due = candidates.filter((u) => {
      const enabled = u.preferences?.notifications?.dailyDigest === true;
      if (!enabled || !u.timezone || !u.email) return false;
      return this.localHour(u.timezone) === 19;
    });

    for (const user of due) {
      try {
        await this.sendDigestFor(user);
      } catch (e) {
        this.logger.warn(`Digest send failed for user ${user.id}: ${(e as Error)?.message}`);
      }
    }
  }

  private async sendDigestFor(user: User): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.notifRepo.find({
      where: { tenantId: user.tenantId, userId: user.id },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const last24h = recent.filter((n) => n.createdAt >= since);
    const unread = recent.filter((n) => !n.isRead).length;
    if (!last24h.length && !unread) return; // нет активности — не шлём пустую сводку

    const rows = last24h
      .slice(0, 8)
      .map((n) => `<li style="margin:0 0 6px;">${n.title ? `<strong>${escape(n.title)}</strong> — ` : ''}${escape(n.body)}</li>`)
      .join('');

    const html = renderMailShell({
      headline: 'Ваша сводка за день',
      bodyHtml: `<p style="margin:0 0 16px;">За последние сутки в <strong>${escape(tenant?.name || 'Lumiva CRM')}</strong>:</p>
<ul style="margin:0 0 16px;padding-left:18px;">${rows || '<li>Новых событий не было</li>'}</ul>
<p style="margin:0;font-size:13px;color:#71717a;">Непрочитанных уведомлений: <strong>${unread}</strong>. Отключить сводку можно в Аккаунт → Интерфейс.</p>`,
    });

    await this.mail.sendMail({
      to: user.email,
      subject: 'Сводка за день — Lumiva CRM',
      html,
    });
  }
}

function escape(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
