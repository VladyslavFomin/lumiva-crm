import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Tenant } from '../tenants/tenant.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { buildPlanEntitlements, normalizeTenantPlan, isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import { TenantPlanActivationService, type BillingProviderCode } from './providers/tenant-plan-activation.service';
import { PaymentProviderResolverService } from './providers/payment-provider-resolver.service';
import { YookassaBillingProvider } from './providers/yookassa-billing.provider';
import { IyzicoBillingProvider } from './providers/iyzico-billing.provider';

type PlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';
type BillingPeriod = 'month' | 'year';

/** Схлопывает гранулярные COMPONENT_KEYS в укрупнённые группы для витрины тарифов. */
const FEATURE_GROUPS: Record<string, string[]> = {
  contacts_companies: ['contacts', 'companies', 'notes'],
  leads: ['leads'],
  projects: ['projects', 'projects_analytics', 'projects_kanban', 'projects_calendar'],
  sales: ['sales', 'sales_pipeline', 'sales_analytics'],
  marketing: ['marketing', 'marketing_campaigns', 'marketing_analytics'],
  automation: ['tools', 'tools_settings', 'tools_integrations', 'tools_automation'],
  custom_objects: ['custom_objects'],
  email: ['email'],
  sms: ['sms'],
  deduplication: ['deduplication'],
  telegram: ['telegram'],
  chat: ['chat'],
  client_accounts: ['client_accounts'],
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly settings: PlatformSettingsService,
    private readonly planActivation: TenantPlanActivationService,
    private readonly providerResolver: PaymentProviderResolverService,
    private readonly yookassaProvider: YookassaBillingProvider,
    private readonly iyzicoProvider: IyzicoBillingProvider,
  ) {}

  private getStripeClient(secretKey: string) {
    return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
  }

  private async getTenantOrFail(tenantId?: string | null) {
    if (!tenantId) throw new UnauthorizedException('No tenant in auth payload');
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    return tenant;
  }

  /** Возвращает существующий Stripe Customer тенанта или создаёт и сохраняет новый. */
  private async getOrCreateStripeCustomerId(tenant: Tenant, stripe: Stripe): Promise<string> {
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;
    const customer = await stripe.customers.create({
      email: tenant.ownerEmail || undefined,
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    });
    tenant.stripeCustomerId = customer.id;
    await this.tenantsRepo.save(tenant);
    return customer.id;
  }

  private async resolvePriceId(plan: PlanCode): Promise<string> {
    const cfg = await this.settings.getSettings();
    const byPlan = {
      standard: cfg?.stripePriceStandard,
      professional: cfg?.stripePriceProfessional,
      enterprise: cfg?.stripePriceEnterprise,
      ultimate: cfg?.stripePriceUltimate,
    };
    const priceId = (byPlan[plan] || '').trim();
    if (!priceId || !priceId.startsWith('price_')) {
      throw new BadRequestException(
        `Stripe Price ID for "${plan}" is not configured. Expected value like "price_..."`,
      );
    }
    return priceId;
  }

  private getYearlyDiscount(plan: PlanCode): number {
    if (plan === 'standard') return 0.1;
    if (plan === 'professional') return 0.12;
    if (plan === 'enterprise') return 0.15;
    return 0.2;
  }

  /** Тонкий Stripe-адаптер над провайдер-независимым ядром активации тарифа (см.
   * providers/tenant-plan-activation.service.ts) — раньше вся эта логика жила прямо здесь. */
  private async applyPaidSession(session: Stripe.Checkout.Session): Promise<{ applied: boolean }> {
    const pt = session.metadata?.purchaseType;
    if (pt === 'ai_prepaid' || pt === 'storage_pack') return { applied: false };

    const tenantId = session.metadata?.tenantId;
    const plan = (session.metadata?.plan || 'standard') as PlanCode;
    const period = (session.metadata?.period || 'month') as BillingPeriod;
    if (!tenantId) return { applied: false };

    return this.planActivation.activatePaidCheckout({
      tenantId,
      plan,
      period,
      provider: 'stripe',
      externalRef: session.id,
    });
  }

  private async applyAddonSession(session: Stripe.Checkout.Session): Promise<{ applied: boolean }> {
    const meta = session.metadata || {};
    const purchaseType = meta.purchaseType;
    const tenantId = meta.tenantId;
    if (
      !tenantId ||
      (purchaseType !== 'ai_prepaid' && purchaseType !== 'storage_pack' && purchaseType !== 'telephony_addon')
    ) {
      return { applied: false };
    }

    // Этот путь аддитивный (aiPrepaidCents/storageExtraBytes НАКАПЛИВАЮТСЯ, не присваиваются),
    // и до фикса вызывался из двух независимых HTTP-путей для одной и той же Stripe-сессии —
    // вебхука и клиентского checkout-confirm сразу после редиректа успеха. Обычный
    // check-then-save без блокировки строки давал окно: обе стороны читают
    // stripeAuxLastSessionId ДО того, как любая успела сохранить новое значение, обе видят
    // несовпадение и обе начисляют — тенант получает кредит дважды за одну покупку.
    // SELECT ... FOR UPDATE внутри транзакции сериализует конкурентные вызовы по этой строке:
    // вторая транзакция ждёт первую и видит уже обновлённый stripeAuxLastSessionId.
    return this.tenantsRepo.manager.transaction(async (manager) => {
      const tenant = await manager
        .createQueryBuilder(Tenant, 'tenant')
        .setLock('pessimistic_write')
        .where('tenant.id = :id', { id: tenantId })
        .getOne();
      if (!tenant) throw new BadRequestException('Tenant not found');
      if (tenant.stripeAuxLastSessionId && tenant.stripeAuxLastSessionId === session.id) {
        return { applied: false };
      }

      if (purchaseType === 'ai_prepaid') {
        const cents = parseInt(String(meta.creditsCents || '0'), 10) || 0;
        if (cents > 0) {
          tenant.aiPrepaidCents = (tenant.aiPrepaidCents || 0) + cents;
        }
      } else if (purchaseType === 'storage_pack') {
        let bytes = BigInt(String(meta.storageBytes || '0'));
        if (bytes <= 0n) {
          bytes = BigInt(1024 * 1024 * 1024);
        }
        const cur = BigInt(tenant.storageExtraBytes || '0');
        tenant.storageExtraBytes = (cur + bytes).toString();
      } else if (purchaseType === 'telephony_addon') {
        tenant.telephonyAddonEnabled = true;
      }

      tenant.stripeAuxLastSessionId = session.id;
      await manager.save(tenant);
      return { applied: true };
    });
  }

  async getCatalog() {
    return this.settings.getBillingPlans();
  }

  /**
   * Для каждого тарифа — какие укрупнённые группы фич (FEATURE_GROUPS) открываются
   * именно на этом тарифе (не накопительно). Источник правды — isComponentAllowedByPlan
   * из plan-entitlements.ts, тот же, что реально решает видимость разделов CRM.
   */
  getPlanFeatureUnlocks(): Record<PlanCode, string[]> {
    const planOrder: PlanCode[] = ['standard', 'professional', 'enterprise', 'ultimate'];
    const result: Record<PlanCode, string[]> = {
      standard: [],
      professional: [],
      enterprise: [],
      ultimate: [],
    };
    for (const [group, keys] of Object.entries(FEATURE_GROUPS)) {
      const unlockPlan = planOrder.find((plan) => keys.every((key) => isComponentAllowedByPlan(key, plan)));
      if (unlockPlan) result[unlockPlan].push(group);
    }
    return result;
  }

  private async activatePlan(tenantId: string, plan: PlanCode) {
    const tenant = await this.getTenantOrFail(tenantId);
    tenant.plan = normalizeTenantPlan(plan);
    const ent = buildPlanEntitlements({
      plan: tenant.plan,
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });
    tenant.plan = ent.normalizedPlan;
    tenant.enabledModules = ent.enabledModules;
    tenant.enabledComponents = ent.enabledComponents;
    await this.tenantsRepo.save(tenant);
  }

  /** Считает итоговую сумму периода (месяц/год со скидкой) из месячной суммы в нужной валюте. */
  private computePeriodAmount(monthly: number, period: BillingPeriod, plan: PlanCode): number {
    const yearlyDiscount = this.getYearlyDiscount(plan);
    return period === 'year'
      ? Math.round(monthly * 12 * (1 - yearlyDiscount) * 100) / 100
      : monthly;
  }

  async createCheckoutSession(input: {
    tenantId?: string | null;
    plan: PlanCode;
    period: BillingPeriod;
    successUrl: string;
    cancelUrl: string;
    ip?: string;
  }): Promise<{ id: string; url: string | null; provider: BillingProviderCode; ref?: string }> {
    const tenant = await this.getTenantOrFail(input.tenantId);
    const period = input.period || 'month';
    const catalog = await this.settings.getBillingPlans();
    const fromCatalog = catalog.find((p) => p.code === input.plan);
    const provider = await this.providerResolver.resolveForTenant(tenant);
    const yearlyDiscount = this.getYearlyDiscount(input.plan);
    const lineName = `${fromCatalog?.title || input.plan} · ${
      period === 'year' ? `12 месяцев (-${Math.round(yearlyDiscount * 100)}%)` : '1 месяц'
    }`;

    if (provider === 'yookassa') {
      const monthlyRub = fromCatalog?.monthlyAmounts?.rub;
      if (!monthlyRub) {
        throw new BadRequestException(
          `YooKassa RUB price for "${input.plan}" is not configured`,
        );
      }
      const totalRub = this.computePeriodAmount(monthlyRub, period, input.plan);
      const result = await this.yookassaProvider.createCheckout({
        tenant,
        plan: input.plan,
        period,
        amountRub: totalRub,
        lineName,
        returnUrl: input.successUrl,
      });
      return { id: result.ref, url: result.url, provider: 'yookassa', ref: result.ref };
    }

    if (provider === 'iyzico') {
      const monthlyTry = fromCatalog?.monthlyAmounts?.try;
      if (!monthlyTry) {
        throw new BadRequestException(`iyzico TRY price for "${input.plan}" is not configured`);
      }
      const totalTry = this.computePeriodAmount(monthlyTry, period, input.plan);
      const result = await this.iyzicoProvider.createCheckout({
        tenant,
        plan: input.plan,
        period,
        amountTry: totalTry,
        lineName,
        ip: input.ip || '0.0.0.0',
        locale: tenant.uiLanguage === 'tr' ? 'tr' : 'en',
      });
      return { id: '', url: result.url, provider: 'iyzico' };
    }

    const cfg = await this.settings.getSettings();
    const secretKey =
      cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new BadRequestException('Stripe is not configured');
    }
    const stripe = this.getStripeClient(secretKey);
    const fallbackByPlan: Record<PlanCode, number> = {
      standard: 14,
      professional: 23,
      enterprise: 40,
      ultimate: 52,
    };
    const monthly = fromCatalog?.monthlyAmounts?.eur || fallbackByPlan[input.plan];
    const totalEur = this.computePeriodAmount(monthly, period, input.plan);
    const amountCents = Math.max(1, Math.round(totalEur * 100));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountCents,
            product_data: {
              name: lineName,
            },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenantId: tenant.id,
        plan: input.plan,
        period,
        monthlyPrice: String(monthly),
        yearlyDiscount: String(yearlyDiscount),
      },
      customer: await this.getOrCreateStripeCustomerId(tenant, stripe),
    });

    return {
      id: session.id,
      url: session.url,
      provider: 'stripe',
    };
  }

  /** Перепроверяет статус YooKassa-платежа server-to-server (никогда не доверяем вебхуку/query) и активирует тариф. */
  async confirmYookassaCheckout(input: { tenantId?: string | null; paymentId: string }) {
    const tenant = await this.getTenantOrFail(input.tenantId);
    const result = await this.yookassaProvider.verifyAndActivate(input.paymentId);
    if (result.tenantId && result.tenantId !== tenant.id) {
      throw new BadRequestException('Payment tenant mismatch');
    }
    return { ok: result.ok };
  }

  async handleYookassaWebhook(body: { object?: { id?: string } }): Promise<void> {
    const paymentId = body?.object?.id;
    if (!paymentId) return;
    await this.yookassaProvider.verifyAndActivate(paymentId);
  }

  async handleIyzicoCallback(token: string): Promise<{ status: 'paid' | 'failed' }> {
    return this.iyzicoProvider.handleCallback(token);
  }

  async confirmCheckoutSession(input: { tenantId?: string | null; sessionId: string }) {
    const tenant = await this.getTenantOrFail(input.tenantId);
    const cfg = await this.settings.getSettings();
    const secretKey =
      cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new BadRequestException('Stripe is not configured');
    }
    const stripe = this.getStripeClient(secretKey);
    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) return { ok: false, status: session.status, paymentStatus: session.payment_status };

    const plan = (session.metadata?.plan || 'standard') as PlanCode;
    if (session.metadata?.tenantId && session.metadata.tenantId !== tenant.id) {
      throw new BadRequestException('Session tenant mismatch');
    }
    if (session.metadata?.tenantId && session.metadata.tenantId !== tenant.id) {
      throw new BadRequestException('Session tenant mismatch');
    }
    const main = await this.applyPaidSession(session);
    if (!main.applied) {
      await this.applyAddonSession(session);
    }
    return { ok: true };
  }

  async handleStripeEvent(rawBody: Buffer, signature?: string) {
    const cfg = await this.settings.getSettings();
    const secretKey = cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    const webhookSecret =
      cfg?.stripeWebhookSecret?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secretKey || !webhookSecret) {
      throw new BadRequestException('Stripe webhook is not configured');
    }

    const stripe = this.getStripeClient(secretKey);
    if (!signature) throw new BadRequestException('Missing stripe-signature');
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paid = session.payment_status === 'paid' || session.status === 'complete';
      if (paid) {
        const main = await this.applyPaidSession(session);
        if (!main.applied) {
          await this.applyAddonSession(session);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      // The only Stripe Subscription in this system is the telephony addon (mode:'subscription')
      // — the main plan is prepaid one-time Checkout, so any subscription under a tenant's
      // customer id is unambiguously the telephony one.
      const subscription = event.data.object as Stripe.Subscription;
      await this.handleTelephonySubscriptionCancelled(subscription.customer as string);
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      await this.handlePaymentFailed(invoice.customer as string);
    }

    return { ok: true };
  }

  private async handleTelephonySubscriptionCancelled(stripeCustomerId: string) {
    if (!stripeCustomerId) return;
    const tenant = await this.tenantsRepo.findOne({ where: { stripeCustomerId } });
    if (!tenant || !tenant.telephonyAddonEnabled) return;
    tenant.telephonyAddonEnabled = false;
    await this.tenantsRepo.save(tenant);
  }

  private async handlePaymentFailed(stripeCustomerId: string) {
    if (!stripeCustomerId) return;
    const tenant = await this.tenantsRepo.findOne({ where: { stripeCustomerId } });
    if (!tenant) return;
    tenant.lastPaymentFailedAt = new Date();
    await this.tenantsRepo.save(tenant);
  }

  async createAiAddonCheckoutSession(input: {
    tenantId?: string | null;
    kind: 'ai_prepaid' | 'storage_pack' | 'telephony_addon';
    successUrl: string;
    cancelUrl: string;
  }) {
    const tenant = await this.getTenantOrFail(input.tenantId);
    const cfg = await this.settings.getSettings();
    const secretKey =
      cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new BadRequestException('Stripe is not configured');
    }
    const stripe = this.getStripeClient(secretKey);
    const customerId = await this.getOrCreateStripeCustomerId(tenant, stripe);

    const creditsCents =
      cfg?.aiCreditsPackAmountCents != null && cfg.aiCreditsPackAmountCents > 0
        ? cfg.aiCreditsPackAmountCents
        : 1000;
    const storageBytes =
      cfg?.storagePackBytes != null && BigInt(cfg.storagePackBytes || '0') > 0n
        ? BigInt(cfg.storagePackBytes as string)
        : BigInt(1024 * 1024 * 1024);

    if (input.kind === 'ai_prepaid') {
      const priceId = (cfg?.stripePriceAiCredits || '').trim();
      if (priceId.startsWith('price_')) {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: {
            tenantId: tenant.id,
            purchaseType: 'ai_prepaid',
            creditsCents: String(creditsCents),
          },
          customer: customerId,
        });
        return { id: session.id, url: session.url };
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: Math.max(50, Math.round(creditsCents)),
              product_data: {
                name: `AI-кредиты · ${(creditsCents / 100).toFixed(2)} EUR экв.`,
              },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          tenantId: tenant.id,
          purchaseType: 'ai_prepaid',
          creditsCents: String(creditsCents),
        },
        customer: customerId,
      });
      return { id: session.id, url: session.url };
    }

    if (input.kind === 'telephony_addon') {
      const telephonyPriceId = (cfg?.stripePriceTelephonyAddon || '').trim();
      if (telephonyPriceId.startsWith('price_')) {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: telephonyPriceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: { tenantId: tenant.id, purchaseType: 'telephony_addon' },
          customer: customerId,
        });
        return { id: session.id, url: session.url };
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: 1400,
              recurring: { interval: 'month' },
              product_data: { name: 'IP-телефония · запись, транскрипция, теги' },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { tenantId: tenant.id, purchaseType: 'telephony_addon' },
        customer: customerId,
      });
      return { id: session.id, url: session.url };
    }

    const priceId = (cfg?.stripePriceStoragePack || '').trim();
    if (priceId.startsWith('price_')) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          tenantId: tenant.id,
          purchaseType: 'storage_pack',
          storageBytes: storageBytes.toString(),
        },
        customer: customerId,
      });
      return { id: session.id, url: session.url };
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 499,
            product_data: {
              name: 'Доп. хранилище · +1 ГБ',
            },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenantId: tenant.id,
        purchaseType: 'storage_pack',
        storageBytes: storageBytes.toString(),
      },
      customer: customerId,
    });
    return { id: session.id, url: session.url };
  }

  /** Сессия Stripe Customer Portal — просмотр/смена/удаление способов оплаты, история счетов. */
  async createPortalSession(input: { tenantId?: string | null; returnUrl: string }) {
    const tenant = await this.getTenantOrFail(input.tenantId);
    const cfg = await this.settings.getSettings();
    const secretKey = cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new BadRequestException('Stripe is not configured');
    }
    const stripe = this.getStripeClient(secretKey);
    const customerId = await this.getOrCreateStripeCustomerId(tenant, stripe);

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: input.returnUrl,
      });
      return { url: session.url };
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('no configuration') || message.toLowerCase().includes('default configuration')) {
        throw new BadRequestException(
          'Stripe Customer Portal is not configured yet. Open Stripe Dashboard → Settings → Billing → Customer portal and save the default configuration once.',
        );
      }
      throw err;
    }
  }
}
