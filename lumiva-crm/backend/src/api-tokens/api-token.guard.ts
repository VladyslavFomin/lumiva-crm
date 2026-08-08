// src/api-tokens/api-token.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiToken } from './api-token.entity';
import { Tenant } from '../tenants/tenant.entity';
import { getTenantBlockReason } from '../tenants/tenant-status.util';
import { TenantLogsService } from '../tenants/tenant-logs.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiToken)
    private readonly apiTokensRepo: Repository<ApiToken>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly tenantLogs: TenantLogsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();

    const rawHeaderToken =
      (req.headers['x-api-token'] as string | undefined) ||
      (req.headers['x-api-key'] as string | undefined);

    if (!rawHeaderToken) {
      throw new UnauthorizedException('X-Api-Token header is required');
    }

    const rawToken = rawHeaderToken.trim();

    const apiToken = await this.apiTokensRepo.findOne({
      where: { token: rawToken } as any,
    });

    if (!apiToken) {
      throw new UnauthorizedException('Invalid API token');
    }

    if (apiToken.isActive === false) {
      throw new UnauthorizedException('API token has been revoked');
    }

    if (apiToken.expiresAt && apiToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('API token has expired');
    }

    // защита от старых записей без tenantId
    if (!apiToken.tenantId) {
      throw new ForbiddenException('Token has no tenant bound');
    }

    const tenant = await this.tenantsRepo.findOne({
      where: { id: apiToken.tenantId },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found for this token');
    }

    const tenantBlockReason = getTenantBlockReason(tenant);
    if (tenantBlockReason) {
      await this.tenantLogs.record({
        tenantId: tenant.id,
        type: 'api_token_denied',
        statusCode: 403,
        method: req.method,
        path: req.url,
        message: `API token rejected: ${tenantBlockReason}`,
        meta: {
          tokenId: apiToken.id,
          reason: tenantBlockReason,
          activeUntil: tenant.activeUntil,
        },
      });
      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        reason: tenantBlockReason,
        message:
          tenantBlockReason === 'expired'
            ? 'Срок использования CRM закончился'
            : 'Тенант заблокирован',
        activeUntil: tenant.activeUntil,
      });
    }

    if (!tenant.apiEnabled) {
      throw new ForbiddenException('Tenant API is disabled for this company');
    }

    (req as any).tenantId = tenant.id;
    (req as any).apiToken = apiToken;

    return true;
  }
}
