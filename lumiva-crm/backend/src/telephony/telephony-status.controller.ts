// src/telephony/telephony-status.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { isTelephonyIncludedInPlan } from '../tenants/plan-entitlements';
import { TelephonyService } from './telephony.service';

/** Endpoints that must stay reachable for tenants *without* the telephony add-on — `status` is how
 * the frontend knows whether to show the feature or an upsell, and `analytics` blends in SMS
 * metrics (never gated) alongside call metrics (zeroed out here, not blocked, when the add-on
 * isn't active) for the merged "SMS и телефония" section. Deliberately not behind
 * TelephonyAddonGuard like TelephonyController. */
@Controller('telephony')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TelephonyStatusController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly telephony: TelephonyService,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: CurrentUserPayload): Promise<{ enabled: boolean; includedInPlan: boolean }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const includedInPlan = isTelephonyIncludedInPlan(tenant?.plan);
    return { enabled: !!tenant?.telephonyAddonEnabled || includedInPlan, includedInPlan };
  }

  @Get('analytics')
  @RequirePermission('telephony', 'read')
  async analytics(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.telephony.getAnalytics(user.tenantId, days ? parseInt(days, 10) : undefined);
  }
}
