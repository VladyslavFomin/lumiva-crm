// backend/src/tenants/tenant-access-expiry.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';

import { Tenant } from './tenant.entity';
import { BillingAlertsService } from '../billing/billing-alerts.service';

/**
 * Раз в час находит тенантов, у которых `activeUntil` уже прошёл (доступ просрочен —
 * как после истечения 14-дневного триала, так и после истечения обычного оплаченного периода),
 * и о ком мы ещё не уведомляли с момента последней оплаты, и шлёт им email + in-app уведомление
 * через BillingAlertsService. `accessExpiredNotifiedAt` не даёт слать письмо повторно на каждый
 * прогон — сбрасывается в null в TenantPlanActivationService при следующей реальной оплате.
 *
 * Независим от TenantTrialSchedulerService (который отдельно жёстко переводит истёкшие триалы
 * на free_locked) — это уведомление касается ЛЮБОГО тенанта с просроченным activeUntil, включая
 * обычных платящих клиентов, для которых никакого downgrade плана не происходит.
 */
@Injectable()
export class TenantAccessExpiryScheduler {
  private readonly logger = new Logger(TenantAccessExpiryScheduler.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly billingAlerts: BillingAlertsService,
  ) {}

  @Cron('20 * * * *')
  async notifyExpiredAccess(): Promise<void> {
    const now = new Date();
    const expired = await this.tenantRepo.find({
      where: {
        activeUntil: LessThanOrEqual(now),
        accessExpiredNotifiedAt: IsNull(),
      },
    });

    for (const tenant of expired) {
      try {
        await this.billingAlerts.notifyAccessExpired(tenant.id);
        await this.tenantRepo.update({ id: tenant.id }, { accessExpiredNotifiedAt: now });
        this.logger.log(`Sent access-expired notification to tenant ${tenant.id} (${tenant.clientKey})`);
      } catch (err) {
        this.logger.error(`Failed to notify tenant ${tenant.id} about expired access`, (err as Error)?.stack || String(err));
      }
    }
  }
}
