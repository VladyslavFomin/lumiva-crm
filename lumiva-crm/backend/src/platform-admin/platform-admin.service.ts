// src/platform-admin/platform-admin.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Tenant } from '../tenants/tenant.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  applyTenantModuleToggle,
  isModuleAllowedByPlan,
  isTenantModuleEnabled,
  MODULE_KEYS,
  normalizeTenantPlan,
} from '../tenants/plan-entitlements';

const EXPIRY_RISK_DAYS = 7;

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async getTenantModules(id: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const enabledModules = tenant.enabledModules || {};

    return MODULE_KEYS.map((key) => {
      const allowedByPlan = isModuleAllowedByPlan(key, tenant.plan);
      const explicit = enabledModules[key];
      const enabled = typeof explicit === 'boolean' ? explicit : allowedByPlan;
      return { key, enabled, allowedByPlan, plan: normalizeTenantPlan(tenant.plan) };
    });
  }

  async toggleTenantModule(
    id: string,
    moduleKey: string,
    enabled: boolean,
  ) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (enabled && !isModuleAllowedByPlan(moduleKey, tenant.plan)) {
      throw new BadRequestException(
        `Module "${moduleKey}" is not available on current plan "${normalizeTenantPlan(tenant.plan)}"`,
      );
    }
    const enabledModules = { ...(tenant.enabledModules || {}) };
    applyTenantModuleToggle(moduleKey, enabled, enabledModules);
    tenant.enabledModules = enabledModules;

    await this.tenantsRepo.save(tenant);

    return {
      key: moduleKey,
      enabled,
      allowedByPlan: isModuleAllowedByPlan(moduleKey, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    };
  }

  /**
   * Real billing-ops data — replaces the old "readiness %" config checker.
   *
   * Revenue is read directly from Stripe Checkout Sessions (real completed payments), not
   * estimated: the main plan is sold as prepaid one-time Checkout (extends Tenant.activeUntil),
   * not a Stripe Subscription, so there is no "MRR" object to read — summing paid sessions over
   * a window is the actual realized-revenue figure for this billing model. The telephony addon
   * is the one real Stripe Subscription in the system.
   *
   * Per-tenant risk (expired/expiring/payment-failed) is 100% local Tenant state — no Stripe call
   * needed, and it stays available even if Stripe isn't configured.
   */
  async getBillingOverview() {
    const now = new Date();
    const tenants = await this.tenantsRepo.find();

    const riskCutoff = new Date(now.getTime() + EXPIRY_RISK_DAYS * 24 * 60 * 60 * 1000);
    const tenantRows = tenants
      .filter((t) => t.plan !== 'free_locked')
      .map((t) => {
        const expired = !!t.activeUntil && t.activeUntil.getTime() < now.getTime() && t.status === 'active';
        const expiringSoon =
          !!t.activeUntil &&
          t.activeUntil.getTime() >= now.getTime() &&
          t.activeUntil.getTime() <= riskCutoff.getTime();
        return {
          id: t.id,
          name: t.name,
          clientKey: t.clientKey,
          plan: t.plan,
          status: t.status,
          activeUntil: t.activeUntil ? t.activeUntil.toISOString() : null,
          telephonyAddonEnabled: t.telephonyAddonEnabled,
          lastPaymentFailedAt: t.lastPaymentFailedAt ? t.lastPaymentFailedAt.toISOString() : null,
          expired,
          expiringSoon,
        };
      })
      .sort((a, b) => {
        // Expired first, then expiring soon, then everyone else — worst-first for an ops view.
        const rank = (r: { expired: boolean; expiringSoon: boolean }) => (r.expired ? 0 : r.expiringSoon ? 1 : 2);
        return rank(a) - rank(b);
      });

    const summary = {
      totalPayingTenants: tenantRows.length,
      expiredCount: tenantRows.filter((t) => t.expired).length,
      expiringSoonCount: tenantRows.filter((t) => t.expiringSoon).length,
      telephonySubscribers: tenantRows.filter((t) => t.telephonyAddonEnabled).length,
      recentPaymentFailures: tenantRows.filter(
        (t) => t.lastPaymentFailedAt && new Date(t.lastPaymentFailedAt).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000,
      ).length,
    };

    const cfg = await this.platformSettings.getSettings();
    const secretKey = cfg?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      return { stripeConfigured: false, revenue: null, tenants: tenantRows, summary };
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
    const since30 = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const since90 = Math.floor((now.getTime() - 90 * 24 * 60 * 60 * 1000) / 1000);

    const sumPaidSessions = async (createdGte: number) => {
      const byCurrency = new Map<string, number>();
      let count = 0;
      let startingAfter: string | undefined;
      // Cap pagination — this is an admin overview, not a full ledger export; 1000 sessions/window
      // is well beyond what a window this short would realistically contain for this business.
      for (let page = 0; page < 10; page++) {
        const batch: Stripe.ApiList<Stripe.Checkout.Session> = await stripe.checkout.sessions.list({
          created: { gte: createdGte },
          limit: 100,
          starting_after: startingAfter,
        });
        for (const session of batch.data) {
          if (session.payment_status !== 'paid') continue;
          const currency = (session.currency || 'eur').toUpperCase();
          const amount = (session.amount_total || 0) / 100;
          byCurrency.set(currency, (byCurrency.get(currency) || 0) + amount);
          count++;
        }
        if (!batch.has_more) break;
        startingAfter = batch.data[batch.data.length - 1]?.id;
      }
      return {
        count,
        byCurrency: Array.from(byCurrency.entries()).map(([currency, amount]) => ({
          currency,
          amount: Math.round(amount * 100) / 100,
        })),
      };
    };

    const [last30, last90] = await Promise.all([sumPaidSessions(since30), sumPaidSessions(since90)]);

    return {
      stripeConfigured: true,
      revenue: { last30d: last30, last90d: last90 },
      tenants: tenantRows,
      summary,
    };
  }
}
