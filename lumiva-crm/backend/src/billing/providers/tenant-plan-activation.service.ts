import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { buildPlanEntitlements, normalizeTenantPlan } from '../../tenants/plan-entitlements';

export type PlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';
export type BillingPeriod = 'month' | 'year';
export type BillingProviderCode = 'stripe' | 'yookassa' | 'iyzico';

/**
 * Провайдер-независимое ядро активации тарифа после успешной оплаты — вынесено из
 * BillingService.applyPaidSession, чтобы Stripe/YooKassa/iyzico делились одной и той же
 * логикой продления доступа вместо трёх копий. Идемпотентность — по
 * `${provider}:${externalRef}` в tenant.lastBillingSessionId (раньше там лежал голый
 * Stripe session.id; смена формата безопасна, т.к. поле сравнивается только само с собой).
 */
@Injectable()
export class TenantPlanActivationService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  private addMonths(baseDate: Date, months: number): Date {
    const next = new Date(baseDate.getTime());
    next.setMonth(next.getMonth() + months);
    return next;
  }

  /**
   * Оплачены доп. слоты ИИ-отделов (ручное продление, как и сам тариф): count слотов на месяц.
   * Та же покупка того же количества при активных слотах продлевает срок, другое количество —
   * начинает новый месяц с новым количеством. Идемпотентно по ai_office_last_payment (отдельно
   * от lastBillingSessionId тарифа — чтобы не сломать идемпотентность оплаты тарифа).
   */
  async activateAiOfficeSlots(input: {
    tenantId: string;
    extraSlots: number;
    provider: BillingProviderCode;
    externalRef: string;
  }): Promise<{ applied: boolean }> {
    const key = `${input.provider}:${input.externalRef}`;
    const n = Math.max(0, Math.min(8, Math.round(input.extraSlots)));
    const rows = await this.tenantsRepo.query(
      `UPDATE tenants
          SET ai_office_slots_until = CASE
                WHEN ai_office_slots_until > now() AND ai_office_extra_slots = $2 THEN ai_office_slots_until + interval '1 month'
                ELSE now() + interval '1 month' END,
              ai_office_extra_slots = $2,
              ai_office_last_payment = $3
        WHERE id = $1 AND COALESCE(ai_office_last_payment, '') <> $3
        RETURNING id`,
      [input.tenantId, n, key],
    );
    const applied = Array.isArray(rows?.[0]) ? rows[0].length > 0 : (rows?.length ?? 0) > 0;
    return { applied };
  }

  async activatePaidCheckout(input: {
    tenantId: string;
    plan: PlanCode;
    period: BillingPeriod;
    provider: BillingProviderCode;
    externalRef: string;
  }): Promise<{ applied: boolean }> {
    const tenant = await this.tenantsRepo.findOne({ where: { id: input.tenantId } });
    if (!tenant) return { applied: false };

    const idempotencyKey = `${input.provider}:${input.externalRef}`;
    if (tenant.lastBillingSessionId && tenant.lastBillingSessionId === idempotencyKey) {
      return { applied: false };
    }

    tenant.plan = normalizeTenantPlan(input.plan);
    const ent = buildPlanEntitlements({
      plan: tenant.plan,
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });
    tenant.plan = ent.normalizedPlan;
    tenant.enabledModules = ent.enabledModules;
    tenant.enabledComponents = ent.enabledComponents;

    const months = input.period === 'year' ? 12 : 1;
    const now = Date.now();
    const base =
      tenant.activeUntil && tenant.activeUntil.getTime() > now ? tenant.activeUntil : new Date(now);
    tenant.activeUntil = this.addMonths(base, months);
    // Реальная оплата — триал (если он был) больше не актуален, см. applyPaidSession's исходный
    // комментарий в billing.service.ts для полного обоснования.
    tenant.trialEndsAt = null;
    // Сброс отметки "уведомление о просрочке уже отправлено" — при следующем истечении
    // activeUntil cron (tenant-access-expiry.scheduler.ts) должен уведомить заново.
    tenant.accessExpiredNotifiedAt = null;
    tenant.lastBillingSessionId = idempotencyKey;
    if (tenant.status !== 'blocked') {
      tenant.status = 'active';
    }

    await this.tenantsRepo.save(tenant);
    return { applied: true };
  }
}
