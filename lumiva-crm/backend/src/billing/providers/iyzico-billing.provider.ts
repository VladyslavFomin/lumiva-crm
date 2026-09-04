import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IyzicoApiService } from '../../integrations/iyzico/iyzico-api.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { TenantPlanActivationService, type BillingPeriod, type PlanCode } from './tenant-plan-activation.service';
import { IyzicoBillingCheckout } from './iyzico-billing-checkout.entity';
import type { Tenant } from '../../tenants/tenant.entity';

/**
 * Платформенный биллинг тарифа через iyzico — тот же одноразовый checkout-и-продли-activeUntil
 * поток, что и Stripe/YooKassa. iyzico Checkout Form хостит ввод карты у себя и присылает нам
 * только token в callback — сопоставление token → {tenantId, plan, period} мы храним сами
 * (iyzico_billing_checkouts), в точности как payments.service.ts делает для Sale-платежей через
 * локальную таблицу Payment, а не полагаемся на эхо conversationId в ответе retrieve.
 */
@Injectable()
export class IyzicoBillingProvider {
  constructor(
    private readonly iyzico: IyzicoApiService,
    private readonly settings: PlatformSettingsService,
    private readonly planActivation: TenantPlanActivationService,
    @InjectRepository(IyzicoBillingCheckout)
    private readonly checkoutsRepo: Repository<IyzicoBillingCheckout>,
  ) {}

  private async getCreds() {
    const cfg = await this.settings.getSettings();
    const apiKey = (cfg?.iyzicoApiKey || '').trim();
    const secretKey = (cfg?.iyzicoSecretKey || '').trim();
    if (!apiKey || !secretKey) {
      throw new BadRequestException('iyzico is not configured');
    }
    return { apiKey, secretKey, sandbox: cfg?.iyzicoSandbox !== false };
  }

  async createCheckout(input: {
    tenant: Tenant;
    plan: PlanCode;
    period: BillingPeriod;
    amountTry: number;
    lineName: string;
    ip: string;
    locale: 'tr' | 'en';
  }): Promise<{ url: string }> {
    const email = (input.tenant.ownerEmail || '').trim();
    if (!email) {
      throw new BadRequestException('Owner email is required to pay via iyzico');
    }
    const creds = await this.getCreds();
    const fullName = (input.tenant.ownerName || input.tenant.name || 'Lumiva Tenant').trim();
    const parts = fullName.split(' ').filter(Boolean);
    const name = parts.slice(0, -1).join(' ') || fullName;
    const surname = parts.length > 1 ? parts.slice(-1).join(' ') : fullName;

    const conversationId = randomUUID();
    const publicApiUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const result = await this.iyzico.initializeCheckoutForm(creds, {
      conversationId,
      price: input.amountTry,
      currency: 'TRY',
      basketId: conversationId,
      callbackUrl: `${publicApiUrl}/v1/billing/iyzico/callback`,
      locale: input.locale,
      buyer: {
        id: input.tenant.id,
        name,
        surname,
        email,
        registrationAddress: 'N/A',
        ip: input.ip || '0.0.0.0',
        city: 'N/A',
        country: 'Turkey',
      },
      basketItems: [
        {
          id: `plan-${input.plan}`,
          name: input.lineName,
          category1: 'Subscription',
          price: input.amountTry.toFixed(2),
        },
      ],
    });

    if (!result.token) throw new BadRequestException('iyzico did not return a checkout token');
    await this.checkoutsRepo.save({
      token: result.token,
      tenantId: input.tenant.id,
      plan: input.plan,
      period: input.period,
    });
    if (!result.paymentPageUrl) throw new BadRequestException('iyzico did not return a payment page URL');
    return { url: result.paymentPageUrl };
  }

  async handleCallback(token: string): Promise<{ status: 'paid' | 'failed' }> {
    const row = await this.checkoutsRepo.findOne({ where: { token } });
    if (!row) return { status: 'failed' };

    const creds = await this.getCreds();
    const result = await this.iyzico.retrieveCheckoutForm(creds, {
      token,
      conversationId: randomUUID(),
    });
    const paid = result.status === 'success' && result.paymentStatus === 'SUCCESS';
    if (!paid) return { status: 'failed' };

    await this.planActivation.activatePaidCheckout({
      tenantId: row.tenantId,
      plan: row.plan as PlanCode,
      period: row.period as BillingPeriod,
      provider: 'iyzico',
      externalRef: token,
    });
    return { status: 'paid' };
  }
}
