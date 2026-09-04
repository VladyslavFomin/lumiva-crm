// backend/src/tenants/tenant-trial.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Not, Repository } from 'typeorm';

import { Tenant } from './tenant.entity';
import { TenantLogsService } from './tenant-logs.service';
import { buildPlanEntitlements } from './plan-entitlements';

/**
 * Жёсткое завершение 14-дневного Enterprise-триала (см. AuthService.signup): раз в час находит
 * тенантов, у которых закончился и trialEndsAt, и activeUntil, и переводит их на free_locked —
 * так же, как самостоятельно зарегистрированный, но ещё не оплативший тенант.
 *
 * Проверяем ОБА поля, а не только trialEndsAt: если тенант успел оплатить (billing.service.ts
 * продлевает activeUntil и обнуляет trialEndsAt) или админ вручную назначил тариф из pl1
 * (tenants.service.ts тоже обнуляет trialEndsAt) — trialEndsAt уже null и запись сюда не попадёт.
 * Двойная проверка activeUntil — просто дополнительная страховка на случай рассинхронизации.
 */
@Injectable()
export class TenantTrialSchedulerService {
  private readonly logger = new Logger(TenantTrialSchedulerService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantLogs: TenantLogsService,
  ) {}

  @Cron('0 * * * *')
  async downgradeExpiredTrials(): Promise<void> {
    const now = new Date();
    // NULL trialEndsAt/activeUntil естественно не проходят "<= now" в SQL (NULL, а не true/false),
    // поэтому tenant'ы без триала или без активного paid-периода сюда не попадают без доп. фильтра.
    const expired = await this.tenantRepo.find({
      where: {
        trialEndsAt: LessThanOrEqual(now),
        activeUntil: LessThanOrEqual(now),
        plan: Not('free_locked'),
      },
    });

    for (const tenant of expired) {
      const previousPlan = tenant.plan;
      tenant.plan = 'free_locked';
      const ent = buildPlanEntitlements({
        plan: tenant.plan,
        enabledModules: tenant.enabledModules,
        enabledComponents: tenant.enabledComponents,
      });
      tenant.plan = ent.normalizedPlan;
      tenant.enabledModules = ent.enabledModules;
      tenant.enabledComponents = ent.enabledComponents;
      tenant.activeUntil = null;

      await this.tenantRepo.save(tenant);

      this.logger.log(
        `Trial expired for tenant ${tenant.id} (${tenant.clientKey}): ${previousPlan} -> free_locked`,
      );
      await this.tenantLogs.record({
        tenantId: tenant.id,
        type: 'trial_expired',
        message: `14-day Enterprise trial expired, tenant downgraded to free_locked`,
        meta: { previousPlan },
      });
    }
  }
}
