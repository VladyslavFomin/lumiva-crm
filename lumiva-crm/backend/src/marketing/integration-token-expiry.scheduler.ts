import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmmIntegration } from '../smm/smm-integration.entity';
import { SmmProfile } from '../smm/smm-profile.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingOauthToken } from './marketing-oauth-token.entity';

/** За сколько дней до окончания доступа напоминаем. */
const SOON_DAYS = 7;
const DAY_MS = 864e5;

type Stage = 'soon' | 'expired';
type Lang = 'ru' | 'en' | 'tr';

const COPY: Record<Lang, Record<Stage, { title: string; body: (what: string, date: string, days: number) => string }>> = {
  ru: {
    soon: { title: 'Доступ к Meta скоро истечёт', body: (w, d, n) => `Доступ к «${w}» действует до ${d} (осталось дней: ${n}). Переподключите аккаунт, иначе статистика перестанет обновляться.` },
    expired: { title: 'Доступ к Meta истёк', body: (w, d) => `Доступ к «${w}» истёк ${d} — данные больше не обновляются. Переподключите аккаунт.` },
  },
  en: {
    soon: { title: 'Meta access is about to expire', body: (w, d, n) => `Access to “${w}” is valid until ${d} (${n} days left). Reconnect the account or statistics will stop updating.` },
    expired: { title: 'Meta access has expired', body: (w, d) => `Access to “${w}” expired on ${d} — data is no longer updating. Reconnect the account.` },
  },
  tr: {
    soon: { title: 'Meta erişimi yakında sona erecek', body: (w, d, n) => `“${w}” erişimi ${d} tarihine kadar geçerli (${n} gün kaldı). Hesabı yeniden bağlayın, yoksa istatistikler güncellenmeyi durduracak.` },
    expired: { title: 'Meta erişiminin süresi doldu', body: (w, d) => `“${w}” erişiminin süresi ${d} tarihinde doldu — veriler güncellenmiyor. Hesabı yeniden bağlayın.` },
  },
};

/**
 * Раз в сутки проверяет срок OAuth-токенов Meta (Meta Ads и Meta в SMM живут ~60 дней и сами не продлеваются)
 * и предупреждает владельца тенанта: за 7 дней и в момент истечения — письмом и уведомлением в CRM.
 * Какое напоминание уже отправлено — хранится рядом с токеном (`expiryNotice`) и сбрасывается при переподключении,
 * поэтому письмо не повторяется на каждый прогон.
 */
@Injectable()
export class IntegrationTokenExpiryScheduler {
  private readonly log = new Logger(IntegrationTokenExpiryScheduler.name);

  constructor(
    @InjectRepository(MarketingOauthToken) private readonly adsTokens: Repository<MarketingOauthToken>,
    @InjectRepository(MarketingIntegration) private readonly integrations: Repository<MarketingIntegration>,
    @InjectRepository(SmmIntegration) private readonly smmIntegrations: Repository<SmmIntegration>,
    @InjectRepository(SmmProfile) private readonly smmProfiles: Repository<SmmProfile>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(StaffUser) private readonly staff: Repository<StaffUser>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  private stageFor(expiresAt: Date, now: number): { stage: Stage; daysLeft: number } | null {
    const left = expiresAt.getTime() - now;
    if (left <= 0) return { stage: 'expired', daysLeft: 0 };
    if (left <= SOON_DAYS * DAY_MS) return { stage: 'soon', daysLeft: Math.max(1, Math.ceil(left / DAY_MS)) };
    return null;
  }

  @Cron('15 6 * * *')
  async run(): Promise<void> {
    const now = Date.now();

    // Meta Ads
    const tokens = await this.adsTokens.find();
    for (const t of tokens) {
      if (!t.expiresAt) continue;
      const due = this.stageFor(t.expiresAt, now);
      if (!due || t.expiryNotice === due.stage || t.expiryNotice === 'expired') continue;
      const active = await this.integrations.count({ where: { tenantId: t.tenantId, provider: 'meta_ads', isActive: true } });
      if (!active) continue;
      await this.notify(t.tenantId, 'Meta Ads', t.expiresAt, due, '/integrations-hub?tab=marketing');
      t.expiryNotice = due.stage;
      await this.adsTokens.save(t);
    }

    // Meta в SMM (профили Facebook / Instagram)
    const smm = await this.smmIntegrations.find({ where: { provider: 'meta' } });
    for (const it of smm) {
      if (!it.expiresAt) continue;
      const due = this.stageFor(it.expiresAt, now);
      const sent = (it.meta?.expiryNotice as Stage | null | undefined) ?? null;
      if (!due || sent === due.stage || sent === 'expired') continue;
      const profiles = await this.smmProfiles
        .createQueryBuilder('p')
        .where('p.tenantId = :tid', { tid: it.tenantId })
        .andWhere("p.meta ->> 'provider' = 'meta'")
        .andWhere('p.isActive = true')
        .getCount();
      if (!profiles) continue;
      await this.notify(it.tenantId, 'Meta (SMM)', it.expiresAt, due, '/marketing/smm');
      it.meta = { ...(it.meta || {}), expiryNotice: due.stage };
      await this.smmIntegrations.save(it);
    }
  }

  private async notify(
    tenantId: string,
    what: string,
    expiresAt: Date,
    due: { stage: Stage; daysLeft: number },
    path: string,
  ): Promise<void> {
    try {
      const tenant = await this.tenants.findOne({ where: { id: tenantId } });
      if (!tenant) return;
      const l = (tenant.uiLanguage || 'ru').slice(0, 2);
      const lang: Lang = l === 'en' || l === 'tr' ? l : 'ru';
      const host = tenant.customDomainStatus === 'active' && tenant.customDomain ? tenant.customDomain : 'crm.lumiva.agency';
      const dateLabel = expiresAt.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

      if (tenant.ownerEmail) {
        await this.mail
          .sendIntegrationTokenEmail({
            to: tenant.ownerEmail,
            uiLanguage: tenant.uiLanguage,
            tenantName: tenant.name,
            what,
            kind: due.stage,
            dateLabel,
            daysLeft: due.daysLeft,
            url: `https://${host}/app${path}`,
          })
          .catch((e) => this.log.error(`Token expiry email failed for ${tenantId}: ${(e as Error)?.message}`));
      }

      const owners = await this.staff.find({ where: { tenantId, role: 'owner' } });
      const emails = new Set(owners.map((o) => o.email?.trim().toLowerCase()).filter((e): e is string => !!e));
      if (emails.size) {
        const users = await this.users.find({ where: { tenantId } });
        const ids = users.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
        const c = COPY[lang][due.stage];
        await this.notifications.create(tenantId, ids, c.title, c.body(what, dateLabel, due.daysLeft), {
          type: 'integration.token_expiry',
          stage: due.stage,
          link: path,
        });
      }
      this.log.log(`Token ${due.stage} notice sent: ${what}, tenant ${tenantId}`);
    } catch (e) {
      this.log.error(`Token expiry notification failed for ${tenantId}`, (e as Error)?.stack || String(e));
    }
  }
}
