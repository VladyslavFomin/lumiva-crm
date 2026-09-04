import { BadRequestException, Injectable } from '@nestjs/common';
import { YookassaApiService } from '../../integrations/yookassa/yookassa-api.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { TenantPlanActivationService, type BillingPeriod, type PlanCode } from './tenant-plan-activation.service';
import type { Tenant } from '../../tenants/tenant.entity';

/**
 * Платформенный биллинг тарифа через ЮKassa — тот же одноразовый checkout-и-продли-activeUntil
 * поток, что и Stripe (см. billing.service.ts), просто другой провайдер. Никогда не доверяем
 * телу вебхука (у ЮKassa нет встроенной подписи по умолчанию — см. yookassa-api.service.ts) —
 * verifyAndActivate всегда перезапрашивает платёж по id перед активацией.
 */
@Injectable()
export class YookassaBillingProvider {
  constructor(
    private readonly yookassa: YookassaApiService,
    private readonly settings: PlatformSettingsService,
    private readonly planActivation: TenantPlanActivationService,
  ) {}

  private async getCreds() {
    const cfg = await this.settings.getSettings();
    const shopId = (cfg?.yookassaShopId || '').trim();
    const secretKey = (cfg?.yookassaSecretKey || '').trim();
    if (!shopId || !secretKey) {
      throw new BadRequestException('YooKassa is not configured');
    }
    return { shopId, secretKey };
  }

  async createCheckout(input: {
    tenant: Tenant;
    plan: PlanCode;
    period: BillingPeriod;
    amountRub: number;
    lineName: string;
    returnUrl: string;
  }): Promise<{ url: string; ref: string }> {
    const creds = await this.getCreds();
    const result = await this.yookassa.createPayment(creds, {
      amount: input.amountRub,
      currency: 'RUB',
      description: input.lineName,
      returnUrl: input.returnUrl,
      metadata: { tenantId: input.tenant.id, plan: input.plan, period: input.period },
    });
    const url = result.confirmation?.confirmation_url;
    if (!url) throw new BadRequestException('YooKassa did not return a confirmation URL');
    return { url, ref: result.id };
  }

  async verifyAndActivate(
    paymentId: string,
  ): Promise<{ ok: boolean; tenantId: string | null }> {
    const creds = await this.getCreds();
    const result = await this.yookassa.getPayment(creds, paymentId);
    const meta = result.metadata || {};
    const tenantId = meta.tenantId || null;
    const plan = (meta.plan || 'standard') as PlanCode;
    const period = (meta.period || 'month') as BillingPeriod;
    const paid = result.status === 'succeeded' && result.paid;
    if (!paid || !tenantId) return { ok: false, tenantId };

    await this.planActivation.activatePaidCheckout({
      tenantId,
      plan,
      period,
      provider: 'yookassa',
      externalRef: paymentId,
    });
    return { ok: true, tenantId };
  }
}
