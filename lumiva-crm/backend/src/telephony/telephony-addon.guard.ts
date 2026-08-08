// src/telephony/telephony-addon.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { isTelephonyIncludedInPlan } from '../tenants/plan-entitlements';

/** Blocks every authenticated telephony endpoint unless the tenant has the paid add-on enabled
 * (or is on a plan that includes it for free, currently Ultimate) — a separate concern from RBAC
 * (which controls which staff *role* may use a feature the tenant already has). Runs after
 * JwtAuthGuard, needs `req.user.tenantId`. */
@Injectable()
export class TelephonyAddonGuard implements CanActivate {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId;
    if (!tenantId) return false;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.telephonyAddonEnabled && !isTelephonyIncludedInPlan(tenant.plan)) {
      throw new ForbiddenException('Telephony is not enabled for this tenant — it is a paid add-on');
    }
    return true;
  }
}
