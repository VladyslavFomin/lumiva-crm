import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

const IN_APP_COPY: Record<'ru' | 'en' | 'tr', Record<'payment_failed' | 'access_expired', { title: string; body: string }>> = {
  ru: {
    payment_failed: { title: 'Платёж не прошёл', body: 'Не удалось провести оплату тарифа — проверьте карту и попробуйте снова в разделе «Тарифы».' },
    access_expired: { title: 'Оплата просрочена', body: 'Срок действия тарифа истёк, доступ к CRM ограничен. Выберите тариф, чтобы продолжить работу.' },
  },
  en: {
    payment_failed: { title: 'Payment failed', body: "We couldn't process your plan payment — check your card and try again in Billing." },
    access_expired: { title: 'Payment overdue', body: 'Your plan has expired and CRM access is limited. Choose a plan to continue.' },
  },
  tr: {
    payment_failed: { title: 'Ödeme başarısız', body: 'Plan ödemeniz gerçekleştirilemedi — kartınızı kontrol edip Faturalandırma bölümünden tekrar deneyin.' },
    access_expired: { title: 'Ödeme gecikti', body: 'Planınızın süresi doldu, CRM erişimi sınırlı. Devam etmek için bir plan seçin.' },
  },
};

/**
 * Уведомляет владельца тенанта (email + in-app) о проблемах с оплатой платформенного тарифа —
 * отклонённая карта/неудачный платёж или просроченный доступ. Вызывается из billing.service.ts
 * и провайдеров (yookassa/iyzico) при неуспехе, и из tenant-access-expiry.scheduler.ts при
 * истечении activeUntil. Все методы принимают tenantId и сами резолвят получателя, чтобы
 * вызывающему коду не нужно было тащить Tenant/StaffUser объекты через границы модулей.
 */
@Injectable()
export class BillingAlertsService {
  private readonly logger = new Logger(BillingAlertsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyPaymentFailed(tenantId: string, reason?: string): Promise<void> {
    await this.notify(tenantId, 'payment_failed', reason);
  }

  async notifyAccessExpired(tenantId: string): Promise<void> {
    await this.notify(tenantId, 'access_expired');
  }

  private async notify(tenantId: string, kind: 'payment_failed' | 'access_expired', reason?: string): Promise<void> {
    if (!tenantId) return;
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return;

    const lang = ((tenant.uiLanguage || 'ru').slice(0, 2) === 'en' || (tenant.uiLanguage || 'ru').slice(0, 2) === 'tr'
      ? (tenant.uiLanguage as string).slice(0, 2)
      : 'ru') as 'ru' | 'en' | 'tr';
    const host = tenant.customDomainStatus === 'active' && tenant.customDomain ? tenant.customDomain : 'crm.lumiva.agency';
    const billingUrl = `https://${host}/app/billing`;

    if (tenant.ownerEmail) {
      try {
        await this.mail.sendBillingAlertEmail({
          to: tenant.ownerEmail,
          uiLanguage: tenant.uiLanguage,
          kind,
          tenantName: tenant.name,
          billingUrl,
        });
      } catch (err) {
        this.logger.error(`Failed to send ${kind} email to tenant ${tenantId}`, (err as Error)?.stack || String(err));
      }
    }

    try {
      const owners = await this.staffRepo.find({ where: { tenantId, role: 'owner' } });
      const emails = new Set(owners.map((o) => o.email?.trim().toLowerCase()).filter((e): e is string => !!e));
      if (emails.size) {
        const users = await this.userRepo.find({ where: { tenantId } });
        const userIds = users.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
        if (userIds.length) {
          const copy = IN_APP_COPY[lang][kind];
          await this.notifications.create(tenantId, userIds, copy.title, copy.body, {
            type: `billing.${kind}`,
            reason: reason || null,
          });
        }
      }
    } catch (err) {
      this.logger.error(`Failed to create in-app notification (${kind}) for tenant ${tenantId}`, (err as Error)?.stack || String(err));
    }
  }
}
