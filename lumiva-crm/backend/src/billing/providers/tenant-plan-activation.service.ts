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
    tenant.lastBillingSessionId = idempotencyKey;
    if (tenant.status !== 'blocked') {
      tenant.status = 'active';
    }

    await this.tenantsRepo.save(tenant);
    return { applied: true };
  }
}
