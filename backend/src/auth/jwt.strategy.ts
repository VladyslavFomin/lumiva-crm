// backend/src/auth/jwt.strategy.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Tenant } from '../tenants/tenant.entity';
import { getTenantBlockReason } from '../tenants/tenant-status.util';
import { TenantLogsService } from '../tenants/tenant-logs.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly tenantLogs: TenantLogsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ✅ ВАЖНО: тот же fallback, что и при sign()
      secretOrKey: process.env.JWT_SECRET || 'changeme',
    });
  }

  async validate(payload: any): Promise<CurrentUserPayload> {
    const user: CurrentUserPayload = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };

    const tenant = user.tenantId
      ? await this.tenantsRepo.findOne({ where: { id: user.tenantId } })
      : null;

    const tenantBlockReason = getTenantBlockReason(tenant);
    if (tenantBlockReason === 'blocked') {
      await this.tenantLogs.record({
        tenantId: tenant?.id || user.tenantId,
        type: 'jwt_denied',
        statusCode: 403,
        method: 'JWT',
        path: 'auth',
        message: `JWT blocked: ${tenantBlockReason}`,
        meta: {
          reason: tenantBlockReason,
          activeUntil: tenant?.activeUntil,
        },
      });

      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        reason: tenantBlockReason,
        message: 'Тенант заблокирован',
        activeUntil: tenant?.activeUntil,
      });
    }

    Logger.debug(`JWT validate user = ${JSON.stringify(user)}`, 'JwtStrategy');
    return user;
  }
}
