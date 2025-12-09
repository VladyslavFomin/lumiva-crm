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

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiToken)
    private readonly apiTokensRepo: Repository<ApiToken>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
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

    if (!tenant.apiEnabled || tenant.status !== 'active') {
      throw new ForbiddenException('Tenant API is disabled or tenant blocked');
    }

    (req as any).tenantId = tenant.id;
    (req as any).apiToken = apiToken;

    return true;
  }
}