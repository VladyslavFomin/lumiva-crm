// src/public/public.controller.ts
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { TenantsService } from '../tenants/tenants.service';

@Controller('public')
export class PublicController {
  constructor(private readonly tenantsService: TenantsService) {}

  // n8n / WordPress connector: тест соединения
  @Post('ping')
  @UseGuards(ApiTokenGuard)
  async ping(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;

    return {
      ok: true,
      tenantId: tenantId ?? null,
      ts: new Date().toISOString(),
    };
  }

  // Получить модули тенента (для WordPress плагина)
  @Get('tenant/modules')
  @UseGuards(ApiTokenGuard)
  async getTenantModules(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { modules: [] };
    }

    const modules = await this.tenantsService.getTenantModules(tenantId);
    return { modules };
  }

  @Get('tenant/info')
  @UseGuards(ApiTokenGuard)
  async getTenantInfo(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { tenant: null };
    }

    const tenant = await this.tenantsService.getTenantInfo(tenantId);
    return { tenant };
  }

  @Get('tenant/meta')
  @UseGuards(ApiTokenGuard)
  async getTenantMeta(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { meta: null };
    }

    const meta = await this.tenantsService.getTenantMeta(tenantId);
    return { meta };
  }
}
