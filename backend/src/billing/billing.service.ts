import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Tenant } from '../tenants/tenant.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { buildPlanEntitlements, normalizeTenantPlan } from '../tenants/plan-entitlements';

type PlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';
type BillingPeriod = 'month' | 'year';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly settings: PlatformSettingsService,
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

  private parseMonthlyAmountFromPrice(priceRaw: string | null | undefined, fallback: number): number {
    const raw = String(priceRaw || '').trim();
    if (!raw) return fallback;
    const normalized = raw.replace(',', '.');
    const match = normalized.match(/(\d+(\.\d+)?)/);
    if (!match) return fallback;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private getYearlyDiscount(plan: PlanCode): number {
    if (plan === 'standard') return 0.1;
    if (plan === 'professional') return 0.12;
    if (plan === 'enterprise') return 0.15;
    return 0.2;
  }

  private addMonths(baseDate: Date, months: number): Date {
    const next = new Date(baseDate.getTime());
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private async applyPaidSession(session: Stripe.Checkout.Session): Promise<{ applied: boolean }> {
    const tenantId = session.metadata?.tenantId;
    const plan = (session.metadata?.plan || 'standard') as PlanCode;
    const period = (session.metadata?.period || 'month') as BillingPeriod;
    if (!tenantId) return { applied: false };

    const tenant = await this.getTenantOrFail(tenantId);
    if (tenant.lastBillingSessionId && tenant.lastBillingSessionId === session.id) {
      return { applied: false };
    }

    tenant.plan = normalizeTenantPlan(plan);
    const ent = buildPlanEntitlements({
      plan: tenant.plan,
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });
    tenant.plan = ent.normalizedPlan;
    tenant.enabledModules = ent.enabledModules;
    tenant.enabledComponents = ent.enabledComponents;

    const months = period === 'year' ? 12 : 1;
    const now = Date.now();
    const base =
      tenant.activeUntil && tenant.activeUntil.getTime() > now
        ? tenant.activeUntil
        : new Date(now);
    tenant.activeUntil = this.addMonths(base, months);
    tenant.lastBillingSessionId = session.id;
    if (tenant.status !== 'blocked') {
      tenant.status = 'active';
    }

    await this.tenantsRepo.save(tenant);
    return { applied: true };
  }

  async getCatalog() {
    return this.settings.getBillingPlans();
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

  async createCheckoutSession(input: {
    tenantId?: string | null;
    plan: PlanCode;
    period: BillingPeriod;
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
    const period = input.period || 'month';
    const catalog = await this.settings.getBillingPlans();
    const fromCatalog = catalog.find((p) => p.code === input.plan);
    const fallbackByPlan: Record<PlanCode, number> = {
      standard: 14,
      professional: 23,
      enterprise: 40,
      ultimate: 52,
    };
    const monthly = this.parseMonthlyAmountFromPrice(fromCatalog?.price as string | undefined, fallbackByPlan[input.plan]);
    const yearlyDiscount = this.getYearlyDiscount(input.plan);
    const totalEur =
      period === 'year'
        ? Math.round(monthly * 12 * (1 - yearlyDiscount) * 100) / 100
        : monthly;
    const amountCents = Math.max(1, Math.round(totalEur * 100));
    const lineName = `${fromCatalog?.title || input.plan} · ${
      period === 'year' ? `12 месяцев (-${Math.round(yearlyDiscount * 100)}%)` : '1 месяц'
    }`;

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
      customer_email: tenant.ownerEmail || undefined,
    });

    return {
      id: session.id,
      url: session.url,
    };
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
    await this.applyPaidSession(session);
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
      await this.applyPaidSession(session);
    }

    return { ok: true };
  }
}
